import {
  bootFootball,
  refreshFootball,
  refreshTeam,
  useFootball,
  checkedTime,
} from "../football/data";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDownToLine,
  BarChart3,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BookmarkPlus,
  Box,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Columns2,
  Command,
  Download,
  Expand,
  Focus,
  FolderOpen,
  Grid2X2,
  Grip,
  Hand,
  HelpCircle,
  Image,
  Layers3,
  Loader2,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  Upload,
  Users,
  Video,
  Waypoints,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import BoardCanvas from "../BoardCanvas";
import type { BoardHandle } from "../BoardCanvas";
import Sidebar, { TeamBadge } from "../components/Sidebar";
import Modals from "../components/Modals";
import { useStudio } from "../store";
import {
  clamp,
  copy,
  download,
  filename,
  frameAt,
  totalDuration,
  isBoard,
  uid,
  catalogueWithBoardTeams,
  activeSceneTime,
} from "../core";
import type { Catalogue, MatchDetails, Tool, Frame } from "../types";
import { useRuntime, editDesk, selectAsset } from "./runtime";
import { defaultBroadcast, emptyStudio, timecode } from "./types";
import type {
  MediaAsset,
  SourceHandle,
  ProgramSnapshot,
  ViewMode,
} from "./types";
import { listAssets, importAsset, loadProject } from "./assetStore";
import {
  encodeVideo,
  exportPack,
  importPack,
  productionFrame,
} from "./exports";
import ProgramOutput, { reconstructedFrame } from "./ProgramOutput";
import {
  openProgram,
  productionChannel,
  readProgram,
  takeToAir,
  queueLiveTake,
} from "./production";
import TacticsPanel from "./TacticsPanel";
import BroadcastPanel from "./BroadcastPanel";
import StatsStage from "./StatsStage";
import type { StatsHandle } from "./StatsStage";
import { recallCue, saveCue, stepCue } from "./showControl";
import MediaStage from "./MediaStage";
import MediaLibrary from "./MediaLibrary";
import Reconstruction from "./Reconstruction";
import InkInspector from "./InkInspector";
import Rundown from "./Rundown";
import Transport, { bookmarkMoment, freezeFrame } from "./Transport";
import ToolRail from "./ToolRail";
import Dialogs from "./Dialogs";
import type { StudioCommand } from "./Dialogs";
import type { ReplayHandle } from "./Pitch3D";
import { cancelVision } from "./visionClient";
const Pitch3D = lazy(() => import("./Pitch3D"));
function hydrate(data: Catalogue, details: Record<string, MatchDetails>) {
  for (const t of data.teams)
    t.recentLineups = Object.values(details)
      .flatMap((d) => {
        const line = d.lineups.find((l) => l.teamId === t.id),
          match = data.matches.find((m) => m.id === d.id);
        return line && match
          ? [
              {
                matchId: d.id,
                date: match.date,
                formation: line.formation || undefined,
                players: line.players,
              },
            ]
          : [];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  return data;
}
let previousFollow = false;
function presenter() {
  const r = useRuntime.getState();
  if (r.presenter) {
    r.set({ presenter: false, follow: previousFollow });
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } else {
    previousFollow = r.follow;
    r.set({ presenter: true, follow: true });
    takeToAir();
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}
function setView(view: ViewMode) {
  const r = useRuntime.getState();
  const state = useStudio.getState();
  if (state.board) {
    const next = copy(state.board);
    next.studio ||= emptyStudio();
    next.studio.view = view;
    state.set({ board: next });
    state.save();
  }
  r.set({
    view,
    time:
      view === "replay"
        ? useStudio.getState().board?.studio?.trim.start || 0
        : r.time,
    mediaPlaying: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    panMode: false,
    markMode: "none",
  });
  useStudio.getState().set({ playing: false, previewTime: null });
}
function Mark() {
  return (
    <span className="tl-brand-mark">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M8 8h20M18 8v20M8 18l10 10 10-10" />
      </svg>
    </span>
  );
}
function Operator() {
  const s = useStudio(),
    r = useRuntime(),
    { board: b, catalogue } = s;
  const sourceRef = useRef<SourceHandle>(null),
    statsRef = useRef<StatsHandle>(null),
    boardRef = useRef<BoardHandle>(null),
    replayRef = useRef<ReplayHandle>(null),
    importRef = useRef<HTMLInputElement>(null),
    projectRef = useRef<HTMLInputElement>(null),
    abortRef = useRef<AbortController | null>(null),
    installRef = useRef<any>(null);
  const dataCheckedAt = useFootball((s) => s.checkedAt);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshFootball();
    }, 120000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!b || !catalogue) return;
    void refreshTeam(b.homeTeamId, b.competition);
    void refreshTeam(b.awayTeamId, b.competition);
  }, [b?.homeTeamId, b?.awayTeamId, b?.competition, !!catalogue]);
  const [error, setError] = useState(""),
    [exportReady, setExportReady] = useState<{
      url: string;
      name: string;
    } | null>(null),
    [canInstall, setCanInstall] = useState(false);
  useEffect(
    () => () => {
      if (exportReady) URL.revokeObjectURL(exportReady.url);
    },
    [exportReady],
  );
  const readyExport = (blob: Blob, name: string) =>
    setExportReady({ url: URL.createObjectURL(blob), name });
  const asset = r.assets.find((a) => a.id === b?.studio?.assetId),
    desk = b?.studio || emptyStudio();
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/data/catalogue.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
      fetch("/data/matches.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
      listAssets(),
      loadProject(localStorage.getItem("fixture.active-document") || "").catch(
        () => null,
      ),
    ])
      .then(([data, matches, assets, saved]) => {
        if (!active) return;
        const restoredCatalogue =
          saved && isBoard(saved)
            ? catalogueWithBoardTeams(hydrate(data, matches), saved)
            : hydrate(data, matches);
        s.init(restoredCatalogue, matches);
        if (
          saved &&
          isBoard(saved) &&
          restoredCatalogue.teams.some((t: any) => t.id === saved.homeTeamId) &&
          restoredCatalogue.teams.some((t: any) => t.id === saved.awayTeamId)
        )
          useStudio.setState({ board: saved });
        const old = useStudio.getState().board!;
        if (!old.studio) {
          const next = copy(old);
          next.studio = emptyStudio();
          next.settings.theme = "studio";
          next.settings.camera = "top";
          next.settings.tokenStyle = "shirt";
          useStudio.setState({ board: next });
        }
        r.set({
          assets,
          program: readProgram(),
          view: useStudio.getState().board?.studio?.view || "board",
        });
        s.set({ color: "#66d9ff" });
        void bootFootball();
      })
      .catch((e) => {
        console.error(e);
        setError(
          "The analysis workspace could not be opened. Reload to recover the saved project.",
        );
      });
    const online = () => r.set({ online: navigator.onLine });
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const install = (e: Event) => {
      e.preventDefault();
      installRef.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      active = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    if (!s.playing) return;
    let raf = 0;
    const start = performance.now(),
      offset = s.playhead;
    const tick = (now: number) => {
      const state = useStudio.getState();
      if (!state.board) return;
      const total = totalDuration(state.board);
      let time = offset + ((now - start) / 1000) * state.speed;
      if (time >= total) {
        if (state.loop) time %= total;
        else {
          state.set({ playing: false, previewTime: total, playhead: total });
          return;
        }
      }
      state.set({ previewTime: time });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, s.playhead, s.speed, s.loop]);
  useEffect(() => {
    if (
      r.view !== "replay" ||
      !r.mediaPlaying ||
      !asset ||
      !desk.tracking[asset.id]
    )
      return;
    let raf = 0;
    const start = performance.now(),
      offset = r.time,
      end = desk.tracking[asset.id].end;
    const tick = (now: number) => {
      let t = offset + ((now - start) / 1000) * useRuntime.getState().rate;
      if (t >= end) {
        if (useRuntime.getState().loopClip)
          t =
            desk.trim.start +
            ((t - desk.trim.start) % (end - desk.trim.start || 1));
        else {
          r.set({ time: end, mediaPlaying: false });
          return;
        }
      }
      r.set({ time: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [r.view, r.mediaPlaying, r.rate, asset?.id]);
  useEffect(() => {
    let lastSeen = 0;
    const heartbeat = setInterval(() => {
      const connected = Date.now() - lastSeen < 10000;
      if (useRuntime.getState().outputConnected !== connected)
        r.set({ outputConnected: connected });
    }, 2000);
    const listener = (e: MessageEvent) => {
      if (e.data.type === "output-alive") {
        lastSeen = Date.now();
        r.set({ outputConnected: true });
      }
      if (e.data.type === "request-program") {
        const program = useRuntime.getState().program;
        if (program)
          productionChannel?.postMessage({
            type: "take",
            snapshot: program,
            phaseTime: useStudio.getState().previewTime,
          });
      }
    };
    productionChannel?.addEventListener("message", listener);
    return () => {
      clearInterval(heartbeat);
      productionChannel?.removeEventListener("message", listener);
    };
  }, []);
  useEffect(() => {
    if (!r.follow || !r.program) return;
    queueLiveTake();
  }, [b, r.view, r.camera, r.follow, !!r.program]);
  useEffect(() => {
    if (r.follow && !r.program?.black && r.program?.board.id === b?.id)
      productionChannel?.postMessage({
        type: "transport",
        id: b?.id,
        time: r.time,
        playing: r.mediaPlaying,
        rate: r.rate,
        phaseTime: s.previewTime,
      });
  }, [r.time, r.mediaPlaying, r.rate, s.previewTime, r.follow]);
  useEffect(() => {
    r.set({ activeCueId: null });
  }, [b?.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement,
        state = useStudio.getState(),
        runtime = useRuntime.getState(),
        board = state.board;
      if (
        !board ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable
      )
        return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        runtime.set({
          modal: runtime.modal === "commands" ? null : "commands",
        });
        return;
      }
      if (runtime.modal || state.modal) return;
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        e.shiftKey ? state.redo() : state.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "s") {
        e.preventDefault();
        state.save();
        state.notify("Project saved on this device");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = runtime.assets.find((a) => a.id === board.studio?.assetId),
        isMedia = !!a && ["footage", "split", "replay"].includes(runtime.view);
      if (k === "escape") {
        runtime.set({ markMode: "none", selectedInk: null });
        state.set({ tool: "select", selected: [], selectedShape: null });
        if (runtime.presenter) presenter();
        return;
      }
      if (k === "p") {
        presenter();
        return;
      }
      if (k === "f") {
        void freezeFrame(a, sourceRef.current);
        return;
      }
      if (k === "m") {
        saveCue();
        return;
      }
      if (k === "[" || k === "]") {
        e.preventDefault();
        stepCue(k === "]" ? 1 : -1);
        return;
      }
      if (k === "enter") {
        e.preventDefault();
        takeToAir();
        return;
      }
      if (k === "b" && !e.repeat) {
        e.preventDefault();
        takeToAir(!runtime.program?.black);
        return;
      }
      if (/^[1-9]$/.test(k)) {
        const cue = board.studio?.cues?.[Number(k) - 1];
        if (cue) recallCue(cue.id);
        return;
      }
      if (k === " ") {
        e.preventDefault();
        if (isMedia && a?.type === "video") {
          const d = board.studio || emptyStudio();
          runtime.set({
            mediaPlaying: !runtime.mediaPlaying,
            time:
              runtime.time >= d.trim.end - 0.05 ? d.trim.start : runtime.time,
          });
        } else if (board.scenes.length > 1)
          state.set({
            playing: !state.playing,
            playhead: state.previewTime ?? activeSceneTime(board),
          });
        return;
      }
      if (["arrowleft", "arrowright"].includes(k) && isMedia) {
        e.preventDefault();
        runtime.set({
          time: Math.max(
            0,
            Math.min(
              a?.duration || 20,
              runtime.time +
                (k === "arrowright" ? 1 : -1) *
                  (e.shiftKey ? 1 : 1 / (board.studio?.fps || 25)),
            ),
          ),
          mediaPlaying: false,
          markMode: "none",
        });
        return;
      }
      if (k === "i" && isMedia) {
        editDesk((d) => {
          d.trim.start = runtime.time;
          d.trim.end = Math.min(
            a?.duration || 20,
            Math.max(
              d.trim.start + 0.25,
              Math.min(d.trim.start + 20, d.trim.end),
            ),
          );
        });
        return;
      }
      if (k === "o" && isMedia) {
        editDesk((d) => {
          d.trim.end = Math.max(
            d.trim.start + 0.25,
            Math.min(runtime.time, d.trim.start + 20, a?.duration || 20),
          );
        });
        return;
      }
      const tools: Record<string, Tool> = {
        v: "select",
        a: "arrow",
        r: "run",
        d: "pen",
        z: "zone",
        c: "ellipse",
        h: "spotlight",
        g: "triangle",
        l: "line",
        u: "measure",
        t: "text",
        e: "erase",
      };
      if (tools[k]) {
        state.set({ tool: tools[k] });
        runtime.set({ panMode: false, markMode: "none" });
        return;
      }
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        if (runtime.selectedInk && board.studio?.assetId) {
          const id = board.studio.assetId;
          editDesk((d) => {
            d.ink[id] = d.ink[id].filter((i) => i.id !== runtime.selectedInk);
          });
          runtime.set({ selectedInk: null });
        } else
          state.commit((b) => {
            b.drawings = b.drawings.filter((d) => d.id !== state.selectedShape);
            b.players = b.players.filter(
              (p) => !state.selected.includes(p.uid),
            );
          });
        return;
      }
      if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k) &&
        state.selected.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 0.035 : 0.008;
        state.commit((b) => {
          b.players = b.players.map((p) =>
            state.selected.includes(p.uid)
              ? {
                  ...p,
                  x: clamp(
                    p.x +
                      (k === "arrowright"
                        ? step
                        : k === "arrowleft"
                          ? -step
                          : 0),
                  ),
                  y: clamp(
                    p.y +
                      (k === "arrowdown" ? step : k === "arrowup" ? -step : 0),
                  ),
                }
              : p,
          );
        });
      }
    };
    window.addEventListener("keydown", key);
    const fullscreen = () => {
      if (!document.fullscreenElement && useRuntime.getState().presenter)
        useRuntime.setState({ presenter: false, follow: previousFollow });
    };
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  const install = async () => {
    if (installRef.current) {
      await installRef.current.prompt();
      installRef.current = null;
      setCanInstall(false);
    } else {
      s.notify(
        "Install from your browser menu: “Install Touchline” / “Add to Dock” / “Add to Home Screen”.",
      );
    }
  };
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    r.set({ busy: "Importing footage locally", progress: 0, error: "" });
    try {
      let last;
      for (let i = 0; i < files.length; i++) {
        last = await importAsset(files[i]);
        r.set({ progress: (i + 1) / files.length });
      }
      r.set({ assets: await listAssets() });
      if (last) selectAsset(last);
    } catch (e) {
      r.set({ error: e instanceof Error ? e.message : "Import failed" });
    } finally {
      r.set({ busy: "", progress: 0 });
    }
  };
  const capture = () => {
    const state = useRuntime.getState();
    if (state.view === "stats") return statsRef.current?.capture() || null;
    if (state.view === "split") {
      const source = sourceRef.current?.composite(),
        replay = boardRef.current?.stage()?.toCanvas({ pixelRatio: 2 });
      if (!source || !replay) return null;
      const out = document.createElement("canvas");
      out.width = 2560;
      out.height = 900;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#080f1d";
      ctx.fillRect(0, 0, out.width, out.height);
      for (const [i, image] of [source, replay].entries()) {
        const scale = Math.min(1250 / image.width, 850 / image.height),
          w = image.width * scale,
          h = image.height * scale;
        ctx.drawImage(image, i * 1280 + (1280 - w) / 2, (900 - h) / 2, w, h);
      }
      return out;
    }
    if (state.view === "footage") return sourceRef.current?.composite() || null;
    if (state.view === "replay") return replayRef.current?.capture() || null;
    const stage = boardRef.current?.stage();
    stage?.draw();
    return stage?.toCanvas({ pixelRatio: 2 }) || null;
  };
  const still = async () => {
    const board = useStudio.getState().board;
    if (!board) return;
    r.set({ modal: null });
    const selection = {
      selected: s.selected,
      selectedShape: s.selectedShape,
      selectedInk: r.selectedInk,
    };
    flushSync(() => {
      s.set({ selected: [], selectedShape: null });
      r.set({ selectedInk: null });
    });
    try {
      await document.fonts.ready;
      const raw = capture();
      if (!raw) throw Error("Open a source or replay first.");
      const out = productionFrame(
        raw,
        3840,
        2160,
        raw.width,
        raw.height,
        board.studio?.lowerThird || board.title,
        r.view === "stats"
          ? "MATCH INTELLIGENCE"
          : r.view === "footage"
            ? "MATCH ANALYSIS"
            : "TACTICAL REPLAY",
        { ...defaultBroadcast(), ...board.studio?.broadcast },
        {
          home:
            catalogue?.teams.find((t) => t.id === board.homeTeamId)
              ?.abbreviation || "HOME",
          away:
            catalogue?.teams.find((t) => t.id === board.awayTeamId)
              ?.abbreviation || "AWAY",
          ...board.match,
        },
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        out.toBlob(
          (b) =>
            b ? resolve(b) : reject(Error("The still could not be rendered.")),
          "image/png",
        ),
      );
      readyExport(blob, filename(board.title) + ".png");
      s.notify("4K broadcast still exported");
    } catch (e) {
      r.set({ error: e instanceof Error ? e.message : "Still export failed" });
    } finally {
      s.set({
        selected: selection.selected,
        selectedShape: selection.selectedShape,
      });
      r.set({ selectedInk: selection.selectedInk });
    }
  };
  const film = async () => {
    const state = useStudio.getState(),
      runtime = useRuntime.getState(),
      board = state.board;
    if (!board) return;
    const a = runtime.assets.find((a) => a.id === board.studio?.assetId),
      sourceMode = !!a && ["footage", "split", "replay"].includes(runtime.view),
      start = sourceMode ? board.studio?.trim.start || 0 : 0,
      duration =
        runtime.view === "stats"
          ? 5
          : sourceMode
            ? Math.min(20, (board.studio?.trim.end || a!.duration) - start)
            : totalDuration(board);
    if (duration <= 0 || duration > 60) {
      r.set({
        error:
          "Choose a source range up to 20 seconds, or a storyboard up to 60 seconds.",
      });
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    r.set({
      modal: null,
      busy: "Rendering frame-timed 1080p analysis",
      progress: 0,
      mediaPlaying: false,
      selectedInk: null,
    });
    s.set({ playing: false, selected: [], selectedShape: null });
    try {
      await document.fonts.ready;
      const result = await encodeVideo({
        duration,
        fps: 25,
        signal: abort.signal,
        onProgress: (p) => r.set({ progress: p }),
        render: async (time) => {
          if (sourceMode) {
            if (runtime.view !== "replay")
              await sourceRef.current?.seek(start + time);
            flushSync(() => r.set({ time: start + time }));
          } else flushSync(() => s.set({ previewTime: time }));
          let raw: HTMLCanvasElement | null;
          if (runtime.view === "replay") {
            const snapshot: ProgramSnapshot = {
              id: "export",
              board,
              view: runtime.view,
              camera: runtime.camera,
              time: start + time,
              playing: false,
              rate: 1,
              takenAt: 0,
              black: false,
            };
            raw =
              replayRef.current?.renderFrame(
                sourceMode
                  ? reconstructedFrame(snapshot, null)
                  : frameAt(board, time),
              ) || null;
          } else raw = capture();
          if (!raw) throw Error("The analysis view is not ready.");
          return productionFrame(
            raw,
            1920,
            1080,
            raw.width,
            raw.height,
            board.studio?.lowerThird || board.title,
            runtime.view === "stats"
              ? "MATCH INTELLIGENCE"
              : runtime.view === "footage"
                ? "MATCH ANALYSIS"
                : "TACTICAL REPLAY",
            { ...defaultBroadcast(), ...board.studio?.broadcast },
            {
              home:
                catalogue?.teams.find((t) => t.id === board.homeTeamId)
                  ?.abbreviation || "HOME",
              away:
                catalogue?.teams.find((t) => t.id === board.awayTeamId)
                  ?.abbreviation || "AWAY",
              ...board.match,
            },
          );
        },
      });
      readyExport(
        result.blob,
        filename(board.title) + "." + result.extension.replace(/^\./, ""),
      );
      s.notify("1080p analysis film exported at 25 fps");
    } catch (e) {
      r.set({ error: e instanceof Error ? e.message : "Video export failed" });
    } finally {
      r.set({ busy: "", progress: 0, time: start });
      s.set({ previewTime: null });
      abortRef.current = null;
    }
  };
  const pack = async () => {
    if (!b) return;
    r.set({
      busy: "Packing project and source files",
      progress: 0,
      modal: null,
    });
    try {
      const result = await exportPack(b, r.assets);
      readyExport(result.blob, result.name);
      s.notify("Portable project pack exported");
    } catch (e) {
      r.set({
        error: e instanceof Error ? e.message : "Project export failed",
      });
    } finally {
      r.set({ busy: "" });
    }
  };
  const json = () => {
    if (!b) return;
    s.save();
    download(
      new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
      filename(b.title) + ".touchline.json",
    );
    r.set({ modal: null });
    s.notify("Editable analysis document exported");
  };
  const importProject = async (file: File) => {
    if (!/\.zip$/i.test(file.name) && file.size > 10 * 1048576) {
      r.set({ error: "Choose an analysis JSON smaller than 10 MB." });
      return;
    }
    r.set({ busy: "Opening project", error: "" });
    try {
      const board = /\.zip$/i.test(file.name)
        ? await importPack(file)
        : JSON.parse(await file.text());
      if (!s.importBoard(board))
        throw Error(
          "This file is not a valid project for the loaded club catalogue.",
        );
      r.set({
        assets: await listAssets(),
        modal: null,
        view: board.studio?.view || "board",
        time: 0,
        mediaPlaying: false,
      });
      s.notify("Project opened as a separate analysis");
    } catch (e) {
      r.set({
        error: e instanceof Error ? e.message : "Project import failed",
      });
    } finally {
      r.set({ busy: "" });
    }
  };
  if (error)
    return (
      <main className="tl-loading">
        <Mark />
        <h1>The studio needs to reconnect.</h1>
        <p>{error}</p>
        <button className="tl-primary" onClick={() => location.reload()}>
          Recover workspace
        </button>
      </main>
    );
  if (!b || !catalogue)
    return (
      <main className="tl-loading">
        <Mark />
        <span className="tl-eyebrow">TOUCHLINE STUDIO</span>
        <h1>Preparing your analysis room.</h1>
        <p>Opening the catalogue and locally saved projects.</p>
        <Loader2 className="spin" size={22} />
      </main>
    );
  const home = catalogue.teams.find((t) => t.id === b.homeTeamId),
    away = catalogue.teams.find((t) => t.id === b.awayTeamId),
    active = b.scenes.find((x) => x.id === b.activeScene)!,
    snapshot: ProgramSnapshot = {
      id: "preview",
      board: b,
      view: r.view,
      camera: r.camera,
      time: r.time,
      playing: r.mediaPlaying,
      rate: r.rate,
      takenAt: 0,
      black: false,
    },
    previewFrame = reconstructedFrame(snapshot, s.previewTime),
    isFootage = ["footage", "split"].includes(r.view),
    isReconstruction = !!asset && !!desk.tracking[asset.id];
  const commands: StudioCommand[] = [
    {
      title: "Open tactical setups",
      detail: "Build-up, pressing, blocks, counters and player guides",
      Icon: Target,
      action: () => {
        setView("board");
        r.set({ sidebar: "tactics" });
      },
    },
    {
      title: "Save view to show rundown",
      detail: "Remember this frame, graphics and camera angle",
      key: "M",
      Icon: BookmarkPlus,
      action: saveCue,
    },
    {
      title: "Style the TV output",
      detail: "Channel identity, match score and lower-third design",
      Icon: Monitor,
      action: () => r.set({ sidebar: "broadcast" }),
    },
    {
      title: "Import match footage",
      detail: "Open stills or short clips from this computer",
      Icon: Upload,
      action: () => importRef.current?.click(),
    },
    {
      title: "Load a match",
      detail: "Confirmed lineups, score and supplied statistics",
      Icon: CalendarDays,
      action: () => s.set({ modal: "matches" }),
    },
    {
      title: "Open tactical board",
      detail: "Move players and build editable phases",
      Icon: Grid2X2,
      action: () => setView("board"),
    },
    {
      title: "Analyse footage",
      detail: "Frame control, telestration and freeze frames",
      Icon: Clapperboard,
      action: () => setView("footage"),
    },
    {
      title: "Compare source and replay",
      detail: "Source footage alongside the reconstructed play",
      Icon: Columns2,
      action: () => setView("split"),
    },
    {
      title: "Open 3D replay",
      detail: "See the tactical story from another angle",
      Icon: Box,
      action: () => setView("replay"),
    },
    {
      title: "Reconstruct the play",
      detail: "Calibrate, detect, track and review",
      Icon: Waypoints,
      action: () => {
        setView("footage");
        r.set({ sidebar: "reconstruct" });
      },
    },
    {
      title: "Take preview to programme",
      detail: "Recall this view on the clean output",
      Icon: Radio,
      action: () => takeToAir(),
    },
    {
      title: "Open programme window",
      detail: "Second display / OBS window capture",
      Icon: Monitor,
      action: openProgram,
    },
    {
      title: "Enter presenter mode",
      detail: "Large touch controls and live follow",
      Icon: Expand,
      key: "P",
      action: presenter,
    },
    {
      title: "Mark a rundown moment",
      detail: "Recall this frame during the panel discussion",
      Icon: BookmarkPlus,
      key: "M",
      action: () => bookmarkMoment(asset),
    },
    {
      title: "Save a freeze frame",
      detail: "Capture the current source frame to the library",
      Icon: Camera,
      key: "F",
      action: () => freezeFrame(asset, sourceRef.current),
    },
    {
      title: "Export analysis",
      detail: "4K still, 1080p film, editable project pack",
      Icon: ArrowDownToLine,
      action: () => r.set({ modal: "export" }),
    },
  ];
  const nav = [
    [
      "studio",
      "Studio",
      Grid2X2,
      () => {
        setView("board");
        r.set({ sidebar: "inspector" });
      },
    ],
    [
      "tactics",
      "Tactics",
      Target,
      () => {
        setView("board");
        r.set({ sidebar: "tactics" });
      },
    ],
    [
      "sources",
      "Sources",
      Clapperboard,
      () => {
        setView("footage");
        r.set({ sidebar: "media" });
      },
    ],
    [
      "reconstruct",
      "Rebuild",
      Waypoints,
      () => {
        setView("footage");
        r.set({ sidebar: "reconstruct" });
      },
    ],
    ["rundown", "Rundown", BookmarkPlus, () => r.set({ sidebar: "rundown" })],
    ["matches", "Matches", CalendarDays, () => s.set({ modal: "matches" })],
    ["clubs", "Clubs", Users, () => s.set({ modal: "teams" })],
    ["projects", "Projects", FolderOpen, () => r.set({ modal: "projects" })],
  ] as const;
  return (
    <main
      className={`tl-app ${r.presenter ? "tl-presenting" : ""} ${r.compactTimeline ? "ts-compact" : ""} ${r.view === "stats" ? "ts-data" : ""}`}
    >
      <header className="tl-header">
        <a
          className="tl-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            r.set({ modal: "projects" });
          }}
          aria-label="Touchline Studio home"
        >
          <Mark />
          <span>
            touchline<span>STUDIO</span>
          </span>
        </a>
        <span className="tl-header-divider" />
        <div className="tl-project-title">
          <span>ANALYSIS WORKSPACE</span>
          <input
            aria-label="Analysis title"
            key={b.id + b.title}
            defaultValue={b.title}
            onBlur={(e) => {
              if (e.target.value !== b.title)
                s.commit((b) => {
                  b.title =
                    e.target.value.trim().slice(0, 120) || "Untitled analysis";
                });
            }}
          />
        </div>
        <span className={`tl-save-state ${s.saveError ? "error" : ""}`}>
          <ShieldCheck size={12} />
          {s.saveError ? "Export to back up" : "Saved on device"}
        </span>
        <button
          className="tl-command-button"
          title="Command centre (Ctrl K)"
          aria-label="Open command centre"
          onClick={() => r.set({ modal: "commands" })}
        >
          <Search size={16} />
          <kbd>⌘ K</kbd>
        </button>
        <div className="tl-header-actions">
          <button
            className="tl-secondary"
            onClick={() => importRef.current?.click()}
          >
            <Plus size={16} />
            <span>Import</span>
          </button>
          <button
            className="tl-secondary"
            onClick={() => r.set({ modal: "export" })}
          >
            <ArrowDownToLine size={15} />
            <span>Export</span>
          </button>
          <button
            className="tl-secondary tl-programme-button"
            onClick={openProgram}
          >
            <Monitor size={16} />
            <span>Programme</span>
          </button>
          <button
            className="tl-present-button"
            aria-label="Presenter mode"
            onClick={presenter}
          >
            <Expand size={17} />
            <span>Presenter</span>
          </button>
        </div>
      </header>
      <nav className="tl-main-nav" aria-label="Studio navigation">
        <div className="tl-nav-items">
          {nav.map(([id, label, Icon, action]) => (
            <button
              key={id}
              title={label}
              aria-label={label}
              className={
                (id === "studio" &&
                  r.view === "board" &&
                  !["tactics", "broadcast", "rundown"].includes(r.sidebar)) ||
                (id === "sources" && r.sidebar === "media") ||
                id === r.sidebar
                  ? "is-active"
                  : ""
              }
              onClick={action}
            >
              <Icon size={22} strokeWidth={1.65} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="tl-nav-bottom">
          <button
            aria-label="Install standalone app"
            title="Install Touchline"
            onClick={install}
          >
            <Download size={20} />
          </button>
          <button
            aria-label="Keyboard shortcuts and help"
            title="Presenter controls"
            onClick={() => r.set({ modal: "shortcuts" })}
          >
            <HelpCircle size={21} />
          </button>
          <button
            aria-label="Broadcast settings"
            title="Broadcast identity & TV graphics"
            onClick={() => r.set({ sidebar: "broadcast" })}
          >
            <Monitor size={21} />
          </button>
          <button
            aria-label="Display settings"
            title="Workspace settings"
            onClick={() => {
              r.set({ sidebar: "inspector" });
              s.set({ inspector: "settings" });
            }}
          >
            <Settings2 size={21} />
          </button>
          <span className="tl-profile">TL</span>
        </div>
      </nav>
      <section className="tl-workspace">
        <div className="tl-workspace-bar">
          <div
            className="tl-view-tabs"
            role="tablist"
            aria-label="Analysis views"
          >
            {[
              ["board", "Tactical board", Grid2X2],
              ["footage", "Footage", Clapperboard],
              ["split", "Compare", Columns2],
              ["replay", "3D replay", Box],
              ["stats", "Data cards", BarChart3],
            ].map(([view, label, Icon]) => {
              const I = Icon as typeof Box;
              return (
                <button
                  key={view as string}
                  role="tab"
                  aria-selected={r.view === view}
                  className={r.view === view ? "is-active" : ""}
                  onClick={() => setView(view as ViewMode)}
                >
                  <I size={15} />
                  <span>{label as string}</span>
                </button>
              );
            })}
          </div>
          <button
            className="tl-match-context"
            onClick={() => s.set({ modal: "matches" })}
          >
            <TeamBadge team={home} size="small" />
            <strong>{home?.shortName}</strong>
            <span>v</span>
            <strong>{away?.shortName}</strong>
            <TeamBadge team={away} size="small" />
            <ChevronDown size={12} />
          </button>
        </div>
        <div className="tl-viewport-shell">
          <ToolRail />
          <div className="tl-viewport">
            <div className="ts-quickbar">
              <span>
                <i />
                {r.program?.black
                  ? "TV BLACKED OUT"
                  : r.follow
                    ? "LIVE WORKSPACE"
                    : "REHEARSAL"}
              </span>
              <button
                className={r.sidebar === "tactics" ? "active" : ""}
                onClick={() => r.set({ sidebar: "tactics" })}
              >
                <Target size={14} />
                Tactical setups
              </button>
              <button
                onClick={() => {
                  saveCue();
                  r.set({ sidebar: "rundown" });
                }}
              >
                <BookmarkPlus size={14} />
                Save shot <kbd>M</kbd>
              </button>
              <button onClick={() => r.set({ sidebar: "broadcast" })}>
                <Monitor size={14} />
                <span>TV design</span>
              </button>
            </div>
            <div className="tl-viewport-heading">
              <span className="tl-preview-label">
                <i />
                EDITOR PREVIEW
              </span>
              <span className="tl-stage-context">
                {r.view === "stats"
                  ? "MATCH DATA CARD"
                  : r.view === "footage"
                    ? asset?.name || "SOURCE ANALYSIS"
                    : r.view === "replay"
                      ? "VIRTUAL STADIUM"
                      : r.view === "split"
                        ? "SOURCE ↔ RECONSTRUCTION"
                        : active.title}
              </span>
              <div className="tl-viewport-controls">
                <button
                  className="tl-icon"
                  aria-label={
                    r.compactTimeline ? "Show storyboard" : "Expand pitch"
                  }
                  title={r.compactTimeline ? "Show storyboard" : "Expand pitch"}
                  aria-pressed={r.compactTimeline}
                  onClick={() => r.set({ compactTimeline: !r.compactTimeline })}
                >
                  <Maximize2 size={15} />
                </button>
                {r.view === "replay" ? (
                  <select
                    aria-label="3D camera angle"
                    value={r.camera}
                    onChange={(e) =>
                      r.set({ camera: e.target.value as typeof r.camera })
                    }
                  >
                    <option value="broadcast">Broadcast camera</option>
                    <option value="overhead">Overhead</option>
                    <option value="endline">Goal view</option>
                    <option value="touchline">Touchline</option>
                  </select>
                ) : (
                  <>
                    <button
                      className={`tl-icon ${r.panMode ? "is-active" : ""}`}
                      title="Pan source"
                      aria-label="Pan source"
                      onClick={() => r.set({ panMode: !r.panMode })}
                    >
                      <Hand size={15} />
                    </button>
                    <button
                      className="tl-icon"
                      aria-label="Zoom out"
                      onClick={() =>
                        r.set({ zoom: Math.max(1, r.zoom - 0.25) })
                      }
                    >
                      <ZoomOut size={15} />
                    </button>
                    <span>{Math.round(r.zoom * 100)}%</span>
                    <button
                      className="tl-icon"
                      aria-label="Zoom in"
                      onClick={() =>
                        r.set({ zoom: Math.min(4, r.zoom + 0.25) })
                      }
                    >
                      <ZoomIn size={15} />
                    </button>
                    <button
                      className="tl-icon"
                      title="Reset view"
                      aria-label="Reset canvas view"
                      onClick={() =>
                        r.set({ zoom: 1, pan: { x: 0, y: 0 }, panMode: false })
                      }
                    >
                      <Focus size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div
              className={`tl-canvas-deck ${r.view === "split" ? "is-split" : ""}`}
            >
              <div
                className={`tl-source-container ${isFootage ? "" : "tl-hidden-source"}`}
              >
                <MediaStage ref={sourceRef} asset={asset} />
                {r.view === "split" && (
                  <span className="tl-stage-chip">
                    SOURCE / {timecode(r.time, desk.fps)}
                  </span>
                )}
              </div>
              {r.view === "stats" ? (
                <StatsStage ref={statsRef} />
              ) : r.view === "replay" ? (
                <Suspense
                  fallback={
                    <div className="tl-stage-message">
                      <Loader2 className="spin" />
                      Preparing the virtual stadium…
                    </div>
                  }
                >
                  <Pitch3D
                    ref={replayRef}
                    board={b}
                    frame={previewFrame}
                    camera={r.camera}
                  />
                </Suspense>
              ) : r.view !== "footage" ? (
                <div
                  className="tl-board-container"
                  onWheel={(e) =>
                    r.set({
                      zoom: Math.max(
                        1,
                        Math.min(4, r.zoom * (e.deltaY > 0 ? 0.9 : 1.1)),
                      ),
                    })
                  }
                >
                  <div
                    className="tl-board-zoom"
                    style={{
                      transform: `translate(${r.pan.x * 100}%,${r.pan.y * 100}%) scale(${r.zoom})`,
                    }}
                  >
                    <BoardCanvas
                      ref={boardRef}
                      externalFrame={
                        r.view === "split" && isReconstruction
                          ? previewFrame
                          : undefined
                      }
                    />
                  </div>
                  {r.panMode && (
                    <div
                      className="tl-board-pan"
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        e.currentTarget.dataset.lastX = String(e.clientX);
                        e.currentTarget.dataset.lastY = String(e.clientY);
                      }}
                      onPointerMove={(e) => {
                        if (!e.currentTarget.hasPointerCapture(e.pointerId))
                          return;
                        const x = Number(e.currentTarget.dataset.lastX),
                          y = Number(e.currentTarget.dataset.lastY);
                        r.set({
                          pan: {
                            x:
                              r.pan.x +
                              (e.clientX - x) / e.currentTarget.clientWidth,
                            y:
                              r.pan.y +
                              (e.clientY - y) / e.currentTarget.clientHeight,
                          },
                        });
                        e.currentTarget.dataset.lastX = String(e.clientX);
                        e.currentTarget.dataset.lastY = String(e.clientY);
                      }}
                      onPointerUp={(e) =>
                        e.currentTarget.releasePointerCapture(e.pointerId)
                      }
                    />
                  )}
                  {r.view === "split" && (
                    <span className="tl-stage-chip">
                      {isReconstruction
                        ? "RECONSTRUCTED POSITIONS"
                        : "TACTICAL BOARD"}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
            <div className="tl-stage-footer">
              <span>
                <i style={{ background: b.colors.home }} />
                {home?.shortName} <ArrowRight size={12} />
              </span>
              <p>
                {r.view === "stats"
                  ? "Choose a team or player card · M saves this view"
                  : r.view === "replay"
                    ? "Drag to orbit · scroll to move closer"
                    : r.view === "footage"
                      ? "Draw to explain · use ← / → to step through the moment"
                      : r.view === "split"
                        ? "Observe the source. Explain the structure."
                        : "Drag a player · Shift-click to group · draw the next move"}
              </p>
              <span>
                <ArrowRight size={12} />
                {away?.shortName}
                <i style={{ background: b.colors.away }} />
              </span>
            </div>
          </div>
        </div>
        <Transport asset={asset} source={sourceRef} />
      </section>
      <section className="tl-inspector-shell">
        <div className="tl-inspector-switch">
          <button
            aria-label="Tactical setups and guides"
            title="Tactical setups & live guides"
            className={r.sidebar === "tactics" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "tactics" })}
          >
            <Target size={18} />
          </button>
          <button
            aria-label="Broadcast design inspector"
            title="Broadcast design"
            className={r.sidebar === "broadcast" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "broadcast" })}
          >
            <Monitor size={18} />
          </button>
          <button
            aria-label="Team and match inspector"
            title="Team & match"
            className={r.sidebar === "inspector" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "inspector" })}
          >
            <Users size={18} />
          </button>
          <button
            aria-label="Source media library"
            title="Source library"
            className={r.sidebar === "media" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "media" })}
          >
            <Clapperboard size={18} />
          </button>
          <button
            aria-label="Reconstruction tools"
            title="Reconstruct the play"
            className={r.sidebar === "reconstruct" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "reconstruct" })}
          >
            <Waypoints size={18} />
          </button>
          <button
            aria-label="Graphics layers"
            title="Graphics & timing"
            className={r.sidebar === "layers" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "layers" })}
          >
            <Layers3 size={18} />
          </button>
          <button
            aria-label="Presenter rundown"
            title="Presenter rundown"
            className={r.sidebar === "rundown" ? "is-active" : ""}
            onClick={() => r.set({ sidebar: "rundown" })}
          >
            <BookmarkPlus size={18} />
          </button>
        </div>
        {r.sidebar === "tactics" ? (
          <TacticsPanel />
        ) : r.sidebar === "broadcast" ? (
          <BroadcastPanel />
        ) : r.sidebar === "inspector" ? (
          <Sidebar />
        ) : r.sidebar === "media" ? (
          <MediaLibrary />
        ) : r.sidebar === "reconstruct" ? (
          <Reconstruction asset={asset} source={sourceRef} />
        ) : r.sidebar === "layers" ? (
          <InkInspector />
        ) : (
          <Rundown />
        )}
        <div className="tl-air-control">
          <div>
            <span className={`tl-air-state ${r.program ? "on-air" : ""}`}>
              <i />
              {r.program?.black
                ? "OUTPUT BLACKED OUT"
                : !r.outputConnected
                  ? "OPEN TV OUTPUT"
                  : r.program
                    ? r.follow
                      ? "LIVE FOLLOW ON"
                      : "PROGRAMME HELD"
                    : "TV OUTPUT READY"}
            </span>
            <button
              className={r.follow ? "is-active" : ""}
              aria-pressed={r.follow}
              onClick={() => r.set({ follow: !r.follow })}
            >
              Live follow <span />
            </button>
          </div>
          <button className="tl-take-button" onClick={() => takeToAir()}>
            <Radio size={17} />
            <strong>
              {r.program?.black
                ? "RESTORE TV OUTPUT"
                : r.follow
                  ? "SEND VIEW TO TV"
                  : "TAKE TO PROGRAMME"}
            </strong>
            <ArrowRight size={18} />
          </button>
          <div className="tl-program-secondary">
            <button onClick={openProgram}>
              <Monitor size={12} />
              Open output
            </button>
            <button
              aria-pressed={!!r.program?.black}
              onClick={() => takeToAir(!r.program?.black)}
            >
              <Square size={11} fill="currentColor" />
              {r.program?.black ? "Restore" : "Blackout"}
            </button>
          </div>
        </div>
      </section>
      <footer className="tl-status">
        <span>
          <span className="tl-dot" />
          TOUCHLINE STUDIO <i />
          {r.online ? "Workspace ready" : "Offline workspace"}
          {r.online ? <Wifi size={11} /> : <WifiOff size={11} />}
        </span>
        <button onClick={() => s.set({ modal: "data" })}>
          {catalogue.teams.length} clubs <i />
          {catalogue.quality.playerCount.toLocaleString()} player records{" "}
          <ArrowUpRight size={11} />
        </button>
        <button
          className="tl-data-check"
          onClick={() => s.set({ modal: "matches" })}
        >
          Football data{" "}
          {dataCheckedAt ? "checked " + checkedTime(dataCheckedAt) : "loading…"}
        </button>
        <span className="tl-status-right">
          {r.view === "replay"
            ? "3D ENGINE"
            : r.view === "footage"
              ? "SOURCE ANALYSIS"
              : "TACTICAL ENGINE"}
          <i />
          ON-DEVICE PROCESSING
        </span>
      </footer>
      {r.presenter && (
        <>
          {!!desk.cues?.length && (
            <div className="ts-presenter-cue">
              <small>{`SHOT ${
                Math.max(
                  0,
                  desk.cues.findIndex((c) => c.id === r.activeCueId),
                ) + 1
              } / ${desk.cues.length}`}</small>
              <strong>
                {desk.cues.find((c) => c.id === r.activeCueId)?.title ||
                  "Select the first shot"}
              </strong>
              <p>
                {desk.cues.find((c) => c.id === r.activeCueId)?.note ||
                  "Use the arrows to move through your prepared analysis."}
              </p>
            </div>
          )}
          <div className="tl-presenter-hud">
            <span>
              <Mark />
              TOUCHLINE <i />
              LIVE FOLLOW
            </span>
            <button
              aria-label="Previous presenter shot"
              onClick={() => stepCue(-1)}
            >
              <ChevronLeft size={20} />
              <span>Previous</span>
            </button>
            <button aria-label="Next presenter shot" onClick={() => stepCue(1)}>
              <ChevronRight size={20} />
              <span>Next shot</span>
            </button>
            <button
              onClick={() => {
                if (asset && r.view !== "board")
                  r.set({ mediaPlaying: !r.mediaPlaying });
                else
                  s.set({
                    playing: !s.playing,
                    playhead: s.previewTime ?? activeSceneTime(b),
                  });
              }}
            >
              {r.mediaPlaying || s.playing ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
              <span>{r.mediaPlaying || s.playing ? "Pause" : "Play"}</span>
            </button>
            <button onClick={() => bookmarkMoment(asset)}>
              <BookmarkPlus size={20} />
              <span>Save shot</span>
            </button>
            <button onClick={s.undo}>
              <RotateIcon />
              <span>Undo</span>
            </button>
            <button onClick={presenter}>
              <X size={20} />
              <span>Exit</span>
            </button>
          </div>
        </>
      )}
      {s.toast && (
        <div className="tl-toast" role="status">
          <Check size={16} />
          {s.toast}
        </div>
      )}
      {exportReady && (
        <div className="tl-export-ready" role="status">
          <div>
            <strong>Your export is ready.</strong>
            <span>{exportReady.name}</span>
          </div>
          <a href={exportReady.url} download={exportReady.name}>
            <Download size={16} />
            Download file
          </a>
          <button
            className="tl-icon"
            aria-label="Dismiss ready export"
            onClick={() => setExportReady(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {(r.busy || s.loading) && (
        <div className="tl-busy" role="status">
          <div className="tl-busy-icon">
            <Loader2 className="spin" size={25} />
          </div>
          <h3>{r.busy || "Loading the match record"}</h3>
          <p>
            {r.busy.includes("Tracking")
              ? "Following selected players and compensating the camera…"
              : r.busy.includes("Rendering")
                ? "Encoding each frame at its intended timestamp."
                : "Your source files remain on this computer."}
          </p>
          {r.progress > 0 && (
            <>
              <div className="tl-progress">
                <span style={{ width: `${r.progress * 100}%` }} />
              </div>
              <strong>{Math.round(r.progress * 100)}%</strong>
            </>
          )}
          {r.busy.includes("Rendering") && (
            <button
              className="tl-secondary"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel export
            </button>
          )}
          {r.busy.includes("Tracking") && (
            <button
              className="tl-secondary"
              onClick={() => {
                cancelVision();
                r.set({ busy: "", progress: 0 });
              }}
            >
              Cancel tracking
            </button>
          )}
        </div>
      )}
      {r.error && (
        <div className="tl-error-banner" role="alert">
          <span>{r.error}</span>
          <button
            className="tl-icon"
            aria-label="Dismiss error"
            onClick={() => r.set({ error: "" })}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <Dialogs
        onPNG={still}
        onVideo={film}
        onPack={pack}
        onJSON={json}
        onImport={() => projectRef.current?.click()}
        commands={commands}
        onInstall={install}
      />
      <Modals onPNG={still} onVideo={film} onJSON={json} />
      <input
        ref={importRef}
        hidden
        type="file"
        accept="image/*,video/*,.mov,.mkv"
        multiple
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={projectRef}
        hidden
        type="file"
        accept=".json,.zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importProject(file);
          e.target.value = "";
        }}
      />
    </main>
  );
}
function RotateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 10a8 8 0 1 1 1 9M4 10V4m0 6h6" />
    </svg>
  );
}
export default function StudioApp() {
  return new URLSearchParams(location.search).has("program") ? (
    <ProgramOutput />
  ) : (
    <Operator />
  );
}
