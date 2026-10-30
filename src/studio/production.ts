import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import type { ProgramSnapshot } from "./types";
import { copy, isBoard, uid } from "../core";
import { putRecord } from "./assetStore";
import { emptyStudio } from "./types";
export const productionChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("touchline-production")
    : null;
const KEY = "touchline.program-snapshot";
let persistTimer: ReturnType<typeof setTimeout>;
let queuedFrame = 0;
export function readProgram(): ProgramSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    const result = raw ? JSON.parse(raw) : null;
    return isBoard(result?.board) ? result : null;
  } catch {
    return null;
  }
}
export function takeToAir(black = false) {
  const s = useStudio.getState(),
    r = useRuntime.getState();
  if (!s.board) return;
  // Cues contain saved frames for the desk. Never copy that whole library into
  // every live update or store it again inside a programme snapshot.
  const { cues, bookmarks, dataReports, ...desk } =
    s.board.studio || emptyStudio();
  const board = copy({
    ...s.board,
    studio: s.board.studio ? { ...desk, bookmarks: [] } : undefined,
  });
  const snapshot: ProgramSnapshot = {
    report:
      r.view === "stats" && desk.statsReportId
        ? copy(dataReports?.[desk.statsReportId])
        : undefined,
    id: uid(),
    board,
    view: r.view,
    camera: r.camera,
    time: r.time,
    playing: r.mediaPlaying,
    rate: r.rate,
    takenAt: Date.now(),
    black,
    teams: {
      home:
        s.catalogue?.teams.find((t) => t.id === board.homeTeamId)
          ?.abbreviation ||
        board.match?.homeName ||
        "HOME",
      away:
        s.catalogue?.teams.find((t) => t.id === board.awayTeamId)
          ?.abbreviation ||
        board.match?.awayName ||
        "AWAY",
    },
  };
  r.set({ program: snapshot });
  // Output is sent immediately. Recovery storage is coalesced off the drag path.
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {}
    void putRecord("projects", "touchline.program", snapshot).catch(() => {});
  }, 350);
  productionChannel?.postMessage({
    type: "take",
    snapshot,
    phaseTime: s.previewTime,
  });
  return snapshot;
}
export function queueLiveTake() {
  if (queuedFrame) return;
  queuedFrame = requestAnimationFrame(() => {
    queuedFrame = 0;
    const r = useRuntime.getState();
    if (r.follow && r.program && !r.program.black) takeToAir();
  });
}
export function openProgram() {
  takeToAir(!!useRuntime.getState().program?.black);
  const w = window.open(
    "/?program=1",
    "touchline-program",
    "popup,width=1600,height=900",
  );
  if (!w)
    useStudio
      .getState()
      .notify("Allow this site to open the programme window.");
  else
    useStudio
      .getState()
      .notify(
        "Clean programme output opened. Use a second display or OBS window capture.",
      );
}
