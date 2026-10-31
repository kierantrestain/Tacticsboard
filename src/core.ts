import { isFootballAction } from "./studio/footballActionTypes";
import { isPlayPhase } from "./studio/playbookTypes";
import { isReportRecreation } from "./football/recreationTypes";
import { emptyStudio, isStudioDocument } from "./studio/types";
import type {
  Board,
  BoardPlayer,
  Drawing,
  Frame,
  Lineup,
  LineupPlayer,
  Player,
  Side,
  Team,
  Catalogue,
} from "./types";
export const FORMATIONS = [
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "4-1-4-1",
  "4-4-1-1",
  "4-2-2-2",
  "3-4-3",
  "3-4-2-1",
  "3-5-2",
  "3-4-1-2",
  "5-3-2",
  "5-4-1",
];
export const uid = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export const copy = <T>(v: T): T => structuredClone(v);
export const clamp = (v: number, min = 0.025, max = 0.975) =>
  Math.min(max, Math.max(min, v));
export const shortName = (name: string) =>
  name.split(" ").length > 1 ? name.split(" ").slice(-1)[0] : name;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export function formationPoints(
  formation: string,
  side: Side,
): { x: number; y: number }[] {
  let lines = formation.split("-").map(Number);
  if (
    lines.some((n) => !Number.isInteger(n) || n < 1) ||
    lines.reduce((a, b) => a + b, 0) !== 10
  )
    lines = [4, 3, 3];
  const result = [{ x: 0.075, y: 0.5 }];
  lines.forEach((count, i) => {
    const x = 0.18 + (i / Math.max(1, lines.length - 1)) * 0.255;
    // Keep central pairs and trios connected; wide rows retain their width.
    const width =
      count === 2 ? 0.3 : count === 3 && i < lines.length - 1 ? 0.44 : 0.74;
    for (let j = 0; j < count; j++)
      result.push({
        x,
        y: count === 1 ? 0.5 : 0.5 - width / 2 + (j / (count - 1)) * width,
      });
  });
  return result.map((p) => (side === "home" ? p : { x: 1 - p.x, y: 1 - p.y }));
}
export function bestXI(team: Team, formation: string): Player[] {
  const recent = team.recentLineups?.[0];
  if (recent) {
    const starters = recent.players
      .filter((p) => p.starter)
      .sort(
        (a, b) =>
          Number(a.formationPlace || 99) - Number(b.formationPlace || 99),
      );
    if (starters.length === 11)
      return starters.map((p) => {
        const bio = team.players.find((x) => x.id === p.id);
        return {
          ...(bio || { id: p.id, name: p.name, statsByCompetition: {} }),
          number: p.number || bio?.number,
          position: p.position || bio?.position,
          positionCode: p.positionCode || bio?.positionCode,
        };
      });
  }
  const rank = (p: Player) =>
    Math.max(
      0,
      ...Object.values(p.statsByCompetition).map(
        (s) => s.appearances?.value || 0,
      ),
    );
  const ordered = [...team.players].sort((a, b) => rank(b) - rank(a));
  const lines = formation.split("-").map(Number),
    def = lines[0] || 4,
    fwd = lines.at(-1) || 3,
    mid = 10 - def - fwd;
  const result: Player[] = [];
  for (const [code, count] of [
    ["G", 1],
    ["D", def],
    ["M", mid],
    ["F", fwd],
  ] as [string, number][]) {
    result.push(
      ...ordered
        .filter((p) => p.positionCode === code && !result.includes(p))
        .slice(0, count),
    );
  }
  result.push(
    ...ordered.filter((p) => !result.includes(p)).slice(0, 11 - result.length),
  );
  return result.slice(0, 11);
}
export function arrangeXI<
  T extends { positionCode?: string; position?: string },
>(players: T[]): T[] {
  const depth = (p: T) => {
    const c = p.positionCode || "";
    if (c === "G" || /Goalkeeper/i.test(p.position || "")) return 0;
    if (c === "SW") return 0.8;
    if (c === "LB" || c === "RB" || c.startsWith("CD") || c === "D") return 1;
    if (c === "DM") return 1.7;
    if (c.startsWith("AM")) return 3;
    if (c === "LF" || c === "RF") return 3.2;
    if (c === "F" || c.startsWith("CF")) return 4;
    return 2;
  };
  const flank = (p: T) => {
    const c = p.positionCode || "";
    if (c === "LB" || c === "LM" || c === "LF") return -2;
    if (c.endsWith("-L")) return -1;
    if (c === "RB" || c === "RM" || c === "RF") return 2;
    if (c.endsWith("-R")) return 1;
    return 0;
  };
  return [...players].sort(
    (a, b) => depth(a) - depth(b) || flank(a) - flank(b),
  );
}
export function makePlayers(
  team: Team,
  side: Side,
  formation: string,
  lineup?: Lineup,
): BoardPlayer[] {
  const points = formationPoints(formation, side);
  const real = lineup?.players
    .filter((p) => p.starter)
    .sort(
      (a, b) => Number(a.formationPlace || 99) - Number(b.formationPlace || 99),
    );
  const selected = arrangeXI<Player | LineupPlayer>(
    real?.length === 11 ? real : bestXI(team, formation),
  );
  return selected.map((p, i) => ({
    uid: `${side}:${p.id}`,
    playerId: p.id,
    side,
    ...points[i],
    name: p.name,
    number: p.number || "",
    position: p.position,
  }));
}
export function newBoard(home: Team, away: Team): Board {
  const hf = home.defaultFormation || "4-3-3",
    af = away.defaultFormation || "4-3-3";
  const players = [
    ...makePlayers(home, "home", hf),
    ...makePlayers(away, "away", af),
  ];
  const scene = {
    id: uid(),
    title: "Starting shape",
    duration: 3,
    note: "",
    players: copy(players),
    drawings: [],
    ball: { x: 0.5, y: 0.5 },
  };
  return {
    context: boardContext(home, away),
    version: 1,
    studio: emptyStudio(),
    id: uid(),
    title: "The space between the lines",
    homeTeamId: home.id,
    awayTeamId: away.id,
    competition:
      home.competitions.find((c) => away.competitions.includes(c)) ||
      home.competitions[0] ||
      "eng.1",
    formations: { home: hf, away: af },
    colors: {
      home: home.color,
      away: away.color === home.color ? "#65b5ff" : away.color,
    },
    lineupSource: {
      home: home.recentLineups?.length
        ? "Recent starting XI"
        : "Squad selection",
      away: away.recentLineups?.length
        ? "Recent starting XI"
        : "Squad selection",
    },
    players,
    drawings: [],
    ball: { x: 0.5, y: 0.5 },
    scenes: [scene],
    activeScene: scene.id,
    managerNotes: {},
    settings: {
      theme: "studio",
      camera: "top",
      view: "full",
      names: true,
      numbers: true,
      grid: false,
      lanes: false,
      trails: false,
      homeVisible: true,
      awayVisible: true,
      mediaVisible: true,
      tokenStyle: "disc",
    },
  };
}
export function boardContext(
  home: Team,
  away: Team,
): NonNullable<Board["context"]> {
  const identity = (t: Team) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    abbreviation: t.abbreviation,
    color: t.color,
    alternateColor: t.alternateColor,
    badgeUrl: t.badgeUrl,
    competitions: [...t.competitions],
  });
  return { home: identity(home), away: identity(away) };
}
export function catalogueWithBoardTeams(
  catalogue: Catalogue,
  board: Board,
): Catalogue {
  const identities = [
    ...Object.values(board.context || {}),
    ...(board.studio?.cues || []).flatMap((c) =>
      Object.values(c.context || {}),
    ),
  ];
  const teams = [...catalogue.teams],
    ids = new Set(teams.map((t) => t.id));
  for (const t of identities) {
    if (ids.has(t.id)) continue;
    teams.push({
      ...t,
      archived: true,
      players: board.players
        .filter((p) => p.side === (t.id === board.homeTeamId ? "home" : "away"))
        .map((p) => ({
          id: p.playerId,
          name: p.name,
          number: p.number,
          statsByCompetition: {},
        })),
    });
    ids.add(t.id);
  }
  return teams.length === catalogue.teams.length
    ? catalogue
    : { ...catalogue, teams };
}
export function syncScene(board: Board) {
  const s = board.scenes.find((s) => s.id === board.activeScene);
  if (s) {
    s.players = copy(board.players);
    s.drawings = copy(board.drawings);
    s.ball = copy(board.ball);
  }
  return board;
}
export function frameAt(board: Board, time: number): Frame {
  const scenes = board.scenes;
  let start = 0;
  for (let i = 0; i < scenes.length; i++) {
    const a = scenes[i],
      b = scenes[i + 1];
    if (!b || time < start + a.duration) {
      if (!b || b.cut) return { players: a.players, drawings: a.drawings, ball: a.ball };
      const f = Math.max(0, Math.min(1, (time - start) / a.duration));
      const t = f * f * (3 - 2 * f);
      return {
        players: a.players.map((p) => {
          const q = b.players.find((q) => q.uid === p.uid);
          return q
            ? { ...p, x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
            : p;
        }),
        drawings: f > 0.85 ? b.drawings : a.drawings,
        ball: {
          x: a.ball.x + (b.ball.x - a.ball.x) * t,
          y: a.ball.y + (b.ball.y - a.ball.y) * t,
        },
      };
    }
    start += a.duration;
  }
  return board;
}
export const totalDuration = (board: Board) =>
  board.scenes.reduce((n, s) => n + s.duration, 0);
export const activeSceneTime = (board: Board) => {
  const index = board.scenes.findIndex((s) => s.id === board.activeScene);
  return board.scenes
    .slice(0, Math.max(0, index))
    .reduce((time, scene) => time + scene.duration, 0);
};
export function isBoard(value: unknown): value is Board {
  if (!value || typeof value !== "object") return false;
  const b = value as Board;
  const point = (p: unknown) => {
    const o = p as { x: number; y: number };
    return (
      !!o &&
      Number.isFinite(o.x) &&
      Number.isFinite(o.y) &&
      o.x >= 0 &&
      o.x <= 1 &&
      o.y >= 0 &&
      o.y <= 1
    );
  };
  const validPlayers = (ps: unknown) =>
    Array.isArray(ps) &&
    ps.length <= 44 &&
    new Set(ps.map((p) => p?.uid)).size === ps.length &&
    ps.every(
      (p) =>
        point(p) &&
        typeof p.uid === "string" &&
        typeof p.name === "string" &&
        typeof p.playerId === "string" &&
        typeof p.number === "string" &&
        (p.opacity === undefined ||
          (Number.isFinite(p.opacity) && p.opacity >= 0 && p.opacity <= 1)) &&
        ["home", "away"].includes(p.side),
    );
  const validDrawings = (ds: unknown) =>
    Array.isArray(ds) &&
    ds.length <= 500 &&
    new Set(ds.map((d) => d?.id)).size === ds.length &&
    ds.every(
      (d) =>
        !!d &&
        typeof d.id === "string" &&
        [
          "arrow",
          "run",
          "line",
          "pen",
          "zone",
          "ellipse",
          "triangle",
          "spotlight",
          "measure",
          "offside",
          "text",
        ].includes(d.type) &&
        Array.isArray(d.points) &&
        d.points.length <= 20000 &&
        d.points.length % 2 === 0 &&
        d.points.length >=
          (d.type === "text" ? 2 : d.type === "triangle" ? 6 : 4) &&
        (d.type !== "text" ||
          (typeof d.text === "string" && d.text.length <= 100)) &&
        d.points.every(
          (x: unknown) =>
            typeof x === "number" && Number.isFinite(x) && x >= -1 && x <= 2,
        ) &&
        typeof d.color === "string" &&
        /^#[0-9a-f]{3,8}$/i.test(d.color) &&
        Number.isFinite(d.width) &&
        d.width > 0 &&
        d.width < 30 &&
        Number.isFinite(d.opacity) &&
        d.opacity >= 0 &&
        d.opacity <= 1,
    );
  return (
    b.version === 1 &&
    (b.recreation === undefined || isReportRecreation(b.recreation)) &&
    (!b.studio || isStudioDocument(b.studio)) &&
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.homeTeamId === "string" &&
    typeof b.awayTeamId === "string" &&
    (b.context === undefined ||
      (!!b.context &&
        ["home", "away"].every((side) => {
          const t = b.context?.[side as Side];
          return (
            !!t &&
            t.id === (side === "home" ? b.homeTeamId : b.awayTeamId) &&
            [
              t.id,
              t.name,
              t.shortName,
              t.abbreviation,
              t.color,
              t.alternateColor,
            ].every((v) => typeof v === "string" && v.length <= 200) &&
            Array.isArray(t.competitions) &&
            t.competitions.every((c) => typeof c === "string")
          );
        }))) &&
    validPlayers(b.players) &&
    validDrawings(b.drawings) &&
    point(b.ball) &&
    Array.isArray(b.scenes) &&
    b.scenes.length >= 1 &&
    b.scenes.length <= 100 &&
    new Set(b.scenes.map((s) => s?.id)).size === b.scenes.length &&
    b.scenes.every(
      (s) =>
        !!s &&
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        typeof s.note === "string" &&
        Number.isFinite(s.duration) &&
        s.duration >= 0.2 &&
        s.duration <= 60 &&
        validPlayers(s.players) &&
        validDrawings(s.drawings) &&
        point(s.ball) && (s.ballAction === undefined || isFootballAction(s.ballAction)) && (s.cut === undefined || typeof s.cut === 'boolean') && (s.play === undefined || isPlayPhase(s.play)),
    ) &&
    !!b.settings &&
    ["studio", "grass", "light"].includes(b.settings.theme) &&
    ["top", "angle"].includes(b.settings.camera) &&
    ["full", "left", "right"].includes(b.settings.view) &&
    ["disc", "shirt"].includes(b.settings.tokenStyle) &&
    (b.settings.markerScale === undefined ||
      (Number.isFinite(b.settings.markerScale) &&
        b.settings.markerScale >= 0.7 &&
        b.settings.markerScale <= 1.6)) &&
    [
      "names",
      "numbers",
      "grid",
      "lanes",
      "trails",
      "homeVisible",
      "awayVisible",
      "mediaVisible",
    ].every(
      (k) =>
        typeof (b.settings as unknown as Record<string, unknown>)[k] ===
        "boolean",
    ) &&
    typeof b.activeScene === "string" &&
    b.scenes.some((s) => s.id === b.activeScene) &&
    !!b.managerNotes &&
    typeof b.managerNotes === "object" &&
    !Array.isArray(b.managerNotes) &&
    Object.values(b.managerNotes).every((v) => typeof v === "string") &&
    typeof b.competition === "string" &&
    !!b.formations &&
    !!b.colors &&
    !!b.lineupSource &&
    (["home", "away"] as Side[]).every(
      (s) =>
        typeof b.formations[s] === "string" &&
        typeof b.lineupSource[s] === "string" &&
        /^#[0-9a-f]{6}$/i.test(b.colors[s] || ""),
    ) &&
    (!b.match ||
      (typeof b.match.id === "string" &&
        typeof b.match.league === "string" &&
        typeof b.match.homeId === "string" &&
        typeof b.match.awayId === "string" &&
        typeof b.match.homeName === "string" &&
        typeof b.match.awayName === "string" &&
        typeof b.match.status === "string" &&
        typeof b.match.completed === "boolean" &&
        typeof b.match.sourceUrl === "string" &&
        b.match.sourceUrl.startsWith("https://") &&
        Number.isFinite(Date.parse(b.match.date)))) &&
    (!b.media ||
      (typeof b.media.id === "string" &&
        typeof b.media.name === "string" &&
        ["image", "video"].includes(b.media.type)))
  );
}
export function moveDrawing(d: Drawing, dx: number, dy: number): Drawing {
  return {
    ...d,
    points: d.points.map((p, i) =>
      Math.max(-1, Math.min(2, p + (i % 2 ? dy : dx))),
    ),
  };
}
export function download(content: Blob | string, name: string) {
  const url =
    typeof content === "string" ? content : URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (typeof content !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const filename = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "fixture-analysis";
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(new Date(date));
}

export function formatMatchStat(
  stats: Record<string, { display: string; label: string }> | undefined,
  key: string,
): string {
  if (!stats) return "—";
  const ratios: Record<string, [string, string]> = {
    shotPct: ["shotsOnTarget", "totalShots"],
    passPct: ["accuratePasses", "totalPasses"],
    crossPct: ["accurateCrosses", "totalCrosses"],
    longballPct: ["accurateLongBalls", "totalLongBalls"],
    tacklePct: ["effectiveTackles", "totalTackles"],
  };
  const pair = ratios[key];
  if (pair) {
    const a = stats[pair[0]]?.display,
      b = stats[pair[1]]?.display;
    if (
      a !== undefined &&
      b !== undefined &&
      Number.isFinite(Number(a)) &&
      Number(b) > 0
    )
      return ((Number(a) / Number(b)) * 100).toFixed(1) + "%";
    return "—";
  }
  const value = stats[key]?.display;
  return value
    ? key === "possessionPct" && !value.includes("%")
      ? value + "%"
      : value
    : "—";
}
