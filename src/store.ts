import { loadReport } from "./football/data";
import { saveProject, loadProject } from "./studio/assetStore";
import { create } from "zustand";
import type {
  Board,
  Catalogue,
  Side,
  Tool,
  Team,
  Match,
  MatchDetails,
  Player,
  SavedBoard,
} from "./types";
import {
  copy,
  uid,
  newBoard,
  syncScene,
  formationPoints,
  makePlayers,
  isBoard,
  boardContext,
  catalogueWithBoardTeams,
} from "./core";
const IS_OUTPUT =
  new URLSearchParams(location.search).has("output") ||
  new URLSearchParams(location.search).has("program");
const ACTIVE = "fixture.active-document";
const PREFIX = "fixture.document.";
const INDEX = "fixture.documents";
let interaction: Board | null = null;
let timer: ReturnType<typeof setTimeout>;
let saveTimer: ReturnType<typeof setTimeout>;
export const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("fixture-program")
    : null;
function readActive(): Board | null {
  try {
    const id =
      new URLSearchParams(location.search).get("session") ||
      localStorage.getItem(ACTIVE);
    const raw = id ? localStorage.getItem(PREFIX + id) : null;
    const d = raw ? JSON.parse(raw) : null;
    return isBoard(d) ? d : null;
  } catch {
    return null;
  }
}
function readIndex(): SavedBoard[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX) || "[]");
  } catch {
    return [];
  }
}
interface Studio {
  catalogue: Catalogue | null;
  board: Board | null;
  past: Board[];
  future: Board[];
  tool: Tool;
  color: string;
  stroke: number;
  selected: string[];
  selectedShape: string | null;
  inspector: "lineup" | "players" | "manager" | "match" | "settings";
  side: Side;
  profileId: string | null;
  playing: boolean;
  playhead: number;
  previewTime: number | null;
  loop: boolean;
  speed: number;
  presenting: boolean;
  modal: "matches" | "teams" | "library" | "export" | "help" | "data" | null;
  toast: string;
  savedAt: string;
  saveError: boolean;
  library: SavedBoard[];
  summaries: Record<string, MatchDetails>;
  loading: boolean;
  init: (data: Catalogue, details: Record<string, MatchDetails>) => void;
  commit: (fn: (b: Board) => void) => void;
  preview: (fn: (b: Board) => void) => void;
  begin: () => void;
  end: () => void;
  cancel: () => void;
  undo: () => void;
  redo: () => void;
  set: (patch: Partial<Studio>) => void;
  notify: (text: string) => void;
  save: () => void;
  load: (id: string) => void;
  importBoard: (b: unknown) => boolean;
  create: () => void;
  formation: (side: Side, f: string) => void;
  chooseTeams: (h: string, a: string) => void;
  loadMatch: (m: Match) => Promise<void>;
  replacePlayer: (side: Side, oldUid: string, p: Player) => void;
  addScene: () => void;
  selectScene: (id: string) => void;
  deleteScene: (id: string) => void;
}
export const useStudio = create<Studio>((set, get) => ({
  catalogue: null,
  board: readActive(),
  past: [],
  future: [],
  tool: "select",
  color: "#d5f86a",
  stroke: 3,
  selected: [],
  selectedShape: null,
  inspector: "lineup",
  side: "home",
  profileId: null,
  playing: false,
  playhead: 0,
  previewTime: null,
  loop: false,
  speed: 1,
  presenting: false,
  modal: null,
  toast: "",
  savedAt: "",
  saveError: false,
  library: readIndex(),
  summaries: {},
  loading: false,
  init: (catalogue, summaries) => {
    const old = get().board;
    if (old) catalogue = catalogueWithBoardTeams(catalogue, old);
    const h = catalogue.teams.find((t) => t.id === "359") || catalogue.teams[0];
    const a = catalogue.teams.find((t) => t.id === "382") || catalogue.teams[1];
    set({
      catalogue,
      summaries,
      board:
        old &&
        catalogue.teams.some((t) => t.id === old.homeTeamId) &&
        catalogue.teams.some((t) => t.id === old.awayTeamId)
          ? old
          : newBoard(h, a),
    });
    if (!IS_OUTPUT) get().save();
  },
  set: (patch) => set(patch),
  notify: (text) => {
    clearTimeout(timer);
    set({ toast: text });
    timer = setTimeout(() => set({ toast: "" }), 4200);
  },
  commit: (fn) => {
    const old = get().board;
    if (!old) return;
    const next = copy(old);
    fn(next);
    syncScene(next);
    set({
      board: next,
      past: [...get().past, copy(old)].slice(-70),
      future: [],
      previewTime: null,
    });
  },
  preview: (fn) => {
    const b = get().board;
    if (!b) return;
    const n = copy(b);
    fn(n);
    syncScene(n);
    set({ board: n, previewTime: null });
  },
  begin: () => {
    if (get().board) interaction = copy(get().board);
    set({ playing: false, previewTime: null });
  },
  end: () => {
    if (interaction) {
      set({ past: [...get().past, interaction].slice(-70), future: [] });
      interaction = null;
    }
    get().save();
  },
  cancel: () => {
    if (interaction) {
      set({ board: interaction });
      interaction = null;
    }
  },
  undo: () => {
    const { past, board, future } = get();
    if (!past.length || !board) return;
    set({
      board: past.at(-1)!,
      past: past.slice(0, -1),
      future: [copy(board), ...future],
      selected: [],
      selectedShape: null,
      playing: false,
      previewTime: null,
    });
  },
  redo: () => {
    const { past, board, future } = get();
    if (!future.length || !board) return;
    set({
      board: future[0],
      past: [...past, copy(board)],
      future: future.slice(1),
      selected: [],
      selectedShape: null,
      playing: false,
      previewTime: null,
    });
  },
  save: async () => {
    const b = get().board;
    if (!b || IS_OUTPUT) return;
    try {
      await saveProject(b);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX) && key !== PREFIX + b.id) {
          try {
            const old = JSON.parse(localStorage.getItem(key) || "null");
            if (isBoard(old)) await saveProject(old);
            localStorage.removeItem(key);
          } catch {}
        }
      }
      const at = new Date().toISOString();
      const entry = {
        id: b.id,
        title: b.title,
        updatedAt: at,
        homeTeamId: b.homeTeamId,
        awayTeamId: b.awayTeamId,
        scenes: b.scenes.length,
      };
      const library = [
        entry,
        ...readIndex().filter((x) => x.id !== b.id),
      ].slice(0, 100);
      localStorage.setItem(INDEX, JSON.stringify(library));
      if (get().board?.id === b.id) {
        try {
          localStorage.setItem(PREFIX + b.id, JSON.stringify(b));
        } catch {
          localStorage.removeItem(PREFIX + b.id);
        }
        localStorage.setItem(ACTIVE, b.id);
        set({ savedAt: at, saveError: false, library });
      }
    } catch {
      set({ saveError: true });
      get().notify(
        "Autosave needs more browser storage. Export a project pack to keep this analysis.",
      );
    }
  },
  load: async (id) => {
    try {
      const b =
        (await loadProject(id)) ||
        JSON.parse(localStorage.getItem(PREFIX + id) || "null");
      const catalogue =
        isBoard(b) && get().catalogue
          ? catalogueWithBoardTeams(get().catalogue!, b)
          : null;
      if (
        !isBoard(b) ||
        !catalogue?.teams.some((t) => t.id === b.homeTeamId) ||
        !catalogue.teams.some((t) => t.id === b.awayTeamId)
      )
        throw Error();
      set({
        catalogue,
        board: b,
        past: [],
        future: [],
        modal: null,
        playing: false,
        previewTime: null,
        selected: [],
        selectedShape: null,
        profileId: null,
      });
      get().save();
      get().notify("Analysis opened");
    } catch {
      get().notify("That analysis could not be opened.");
    }
  },
  importBoard: (value) => {
    if (!isBoard(value)) return false;
    const catalogue = get().catalogue
      ? catalogueWithBoardTeams(get().catalogue!, value)
      : null;
    const teams = catalogue?.teams;
    if (
      !teams?.some((t) => t.id === value.homeTeamId) ||
      !teams.some((t) => t.id === value.awayTeamId)
    )
      return false;
    const b = copy(value);
    b.id = uid();
    b.managerNotes = b.managerNotes || {};
    set({
      catalogue,
      board: b,
      selected: [],
      selectedShape: null,
      profileId: null,
      past: [],
      future: [],
      playing: false,
      previewTime: null,
      modal: null,
    });
    get().save();
    return true;
  },
  create: () => {
    const { catalogue } = get();
    if (!catalogue) return;
    get().save();
    const old = get().board;
    const h =
        catalogue.teams.find((t) => t.id === old?.homeTeamId) ||
        catalogue.teams[0],
      a =
        catalogue.teams.find((t) => t.id === old?.awayTeamId) ||
        catalogue.teams[1];
    set({
      board: newBoard(h, a),
      playing: false,
      playhead: 0,
      profileId: null,
      past: [],
      future: [],
      modal: null,
      previewTime: null,
      selected: [],
      selectedShape: null,
    });
    get().save();
  },
  formation: (side, f) => {
    get().commit((b) => {
      b.formations[side] = f;
      const points = formationPoints(f, side);
      b.players
        .filter((p) => p.side === side)
        .forEach((p, i) => {
          p.x = points[i]?.x ?? 0.5;
          p.y = points[i]?.y ?? 0.5;
        });
    });
    get().notify(`${f} shape applied`);
  },
  chooseTeams: (h, a) => {
    const { catalogue } = get();
    if (!catalogue) return;
    const ht = catalogue.teams.find((t) => t.id === h),
      at = catalogue.teams.find((t) => t.id === a);
    if (!ht || !at) return;
    get().commit((b) => {
      const next = newBoard(ht, at);
      b.homeTeamId = h;
      b.context = boardContext(ht, at);
      b.awayTeamId = a;
      b.competition = next.competition;
      b.ball = copy(next.ball);
      b.colors = next.colors;
      b.formations = next.formations;
      b.players = next.players;
      b.drawings = [];
      b.match = undefined;
      b.lineupSource = next.lineupSource;
      b.scenes = next.scenes;
      b.activeScene = next.activeScene;
    });
    set({ modal: null, selected: [], selectedShape: null, profileId: null });
    get().notify("Teams and recent starting selections loaded");
  },
  loadMatch: async (m) => {
    const { catalogue } = get();
    if (!catalogue) return;
    const ht = catalogue.teams.find((t) => t.id === m.homeId),
      at = catalogue.teams.find((t) => t.id === m.awayId);
    if (!ht || !at) {
      throw Error("This fixture includes a club outside the loaded catalogue.");
    }
    set({ loading: true });
    let d = get().summaries[m.id];
    if (!d) {
      try {
        d = await loadReport(m);
      } catch {}
    } else void loadReport(m).catch(() => {});
    get().commit((b) => {
      b.homeTeamId = ht.id;
      b.context = boardContext(ht, at);
      b.awayTeamId = at.id;
      b.competition = m.league;
      if (b.studio) {
        if (b.match && b.match.id !== m.id) b.studio.assetId = undefined;
        b.studio.view = "board";
      }
      b.match = m;
      b.title = `${ht.shortName} v ${at.shortName} — match analysis`;
      b.colors = {
        home: ht.color,
        away: at.color === ht.color ? "#65b5ff" : at.color,
      };
      b.drawings = [];
      for (const [side, t] of [
        ["home", ht],
        ["away", at],
      ] as [Side, Team][]) {
        const l = d?.lineups.find((l) => l.teamId === t.id);
        const confirmed = l?.players.filter((p) => p.starter).length === 11;
        b.formations[side] = l?.formation || t.defaultFormation || "4-3-3";
        b.players = b.players
          .filter((p) => p.side !== side)
          .concat(
            m.seasonYear && m.seasonYear !== catalogue.seasonYear && !confirmed
              ? []
              : makePlayers(
                  t,
                  side,
                  b.formations[side],
                  confirmed ? l : undefined,
                ),
          );
        b.lineupSource[side] = confirmed
          ? "Confirmed match XI"
          : m.seasonYear && m.seasonYear !== catalogue.seasonYear
            ? "Historical lineup unavailable · no current XI substituted"
            : m.completed
              ? "Recent XI · match lineup unavailable"
              : "Recent XI · match lineup pending";
      }
      const scene = {
        id: uid(),
        title: "Starting shape",
        duration: 3,
        note: "",
        players: copy(b.players),
        drawings: [],
        ball: { x: 0.5, y: 0.5 },
      };
      b.scenes = [scene];
      b.activeScene = scene.id;
      b.ball = copy(scene.ball);
    });
    if (d) set({ summaries: { ...get().summaries, [m.id]: d } });
    set({
      modal: null,
      loading: false,
      selected: [],
      selectedShape: null,
      profileId: null,
    });
    get().notify(
      d
        ? "Match and available confirmed lineups loaded"
        : "Match loaded with clearly labelled recent selections",
    );
  },
  replacePlayer: (side, oldUid, p) => {
    if (
      get().board?.players.some((x) => x.side === side && x.playerId === p.id)
    ) {
      get().notify("That player is already on the pitch.");
      return;
    }
    get().commit((b) => {
      const old = b.players.find((x) => x.uid === oldUid);
      if (!old) return;
      Object.assign(old, {
        uid: `${side}:${p.id}`,
        playerId: p.id,
        name: p.name,
        number: p.number || "",
        position: p.position,
      });
      b.lineupSource[side] = "Analyst selection";
    });
    set({ selected: [`${side}:${p.id}`] });
    get().notify("Lineup updated");
  },
  addScene: () => {
    get().commit((b) => {
      const scene = {
        id: uid(),
        title: `Phase ${String(b.scenes.length + 1).padStart(2, "0")}`,
        duration: 3,
        note: "",
        players: copy(b.players),
        drawings: copy(b.drawings),
        ball: copy(b.ball),
      };
      b.scenes.push(scene);
      b.activeScene = scene.id;
    });
    set({ playing: false, previewTime: null });
    get().notify("Next phase added. Move the players to build the sequence.");
  },
  selectScene: (id) => {
    get().commit((b) => {
      const s = b.scenes.find((s) => s.id === id);
      if (!s) return;
      b.activeScene = id;
      b.players = copy(s.players);
      b.drawings = copy(s.drawings);
      b.ball = copy(s.ball);
    });
    set({
      playing: false,
      previewTime: null,
      selected: [],
      selectedShape: null,
    });
  },
  deleteScene: (id) => {
    if (get().board!.scenes.length === 1) {
      get().notify("Keep at least one phase in the analysis.");
      return;
    }
    get().commit((b) => {
      b.scenes = b.scenes.filter((s) => s.id !== id);
      if (b.activeScene === id) {
        const s = b.scenes[0];
        b.activeScene = s.id;
        b.players = copy(s.players);
        b.drawings = copy(s.drawings);
        b.ball = copy(s.ball);
      }
    });
  },
}));
let last: Board | null = null;
if (!IS_OUTPUT) {
  useStudio.subscribe((state) => {
    if (state.board && state.board !== last) {
      last = state.board;
      channel?.postMessage({ type: "board", board: state.board });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => useStudio.getState().save(), 600);
    }
  });
  channel?.addEventListener("message", (e) => {
    const s = useStudio.getState();
    if (
      e.data.type === "request" &&
      s.board &&
      (!e.data.id || e.data.id === s.board.id)
    ) {
      channel?.postMessage({ type: "board", board: s.board });
      channel?.postMessage({
        type: "playback",
        id: s.board.id,
        time: s.previewTime,
      });
    }
  });
  window.addEventListener("beforeunload", () => useStudio.getState().save());
} else if (!new URLSearchParams(location.search).has("program")) {
  channel?.addEventListener("message", (e) => {
    const target = new URLSearchParams(location.search).get("session");
    if (
      e.data.type === "board" &&
      isBoard(e.data.board) &&
      (!target || target === e.data.board.id)
    )
      useStudio.setState({ board: e.data.board });
    if (e.data.type === "playback" && (!target || target === e.data.id))
      useStudio.setState({ previewTime: e.data.time });
  });
  window.addEventListener("storage", (e) => {
    const b = useStudio.getState().board;
    if (b && e.key === PREFIX + b.id && e.newValue) {
      try {
        const d = JSON.parse(e.newValue);
        if (isBoard(d)) useStudio.setState({ board: d });
      } catch {}
    }
  });
}
