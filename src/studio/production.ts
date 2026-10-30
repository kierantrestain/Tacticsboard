import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import type { ProgramSnapshot } from "./types";
import { copy, uid } from "../core";
import { putRecord } from "./assetStore";
import { emptyStudio } from "./types";
import { inspectView } from "./readiness";
import { isProgramSnapshot, setProgramBlack } from "./productionModel";
import { captureThumbnail } from "./capture";
export const productionChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("touchline-production")
    : null;
const KEY = "touchline.program-snapshot";
let persistTimer: ReturnType<typeof setTimeout>;
let queuedFrame = 0;
export function readProgram(): ProgramSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY),
      result = raw ? JSON.parse(raw) : null;
    return isProgramSnapshot(result) ? { ...result, playing: false } : null;
  } catch {
    return null;
  }
}
function publish(snapshot: ProgramSnapshot) {
  useRuntime.setState({ program: snapshot });
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {}
    void putRecord("projects", "touchline.program", snapshot).catch(() => {});
  }, 150);
  productionChannel?.postMessage({ type: "take", snapshot });
  return snapshot;
}
export function takeToAir({ capture = true }: { capture?: boolean } = {}) {
  const s = useStudio.getState(),
    r = useRuntime.getState();
  if (!s.board || r.busy || s.loading) return;
  if (r.program?.black) {
    s.notify("Restore the held programme before taking a new shot.");
    return;
  }
  const issue = inspectView(
    s.board,
    r.view,
    r.assets,
    r.assetAvailability,
  ).find((i) => i.level === "block");
  if (issue) {
    r.set({ follow: false });
    s.notify(issue.message);
    return;
  }
  const { cues, bookmarks, dataReports, statsSnapshot, ...desk } =
    s.board.studio || emptyStudio();
  const board = copy({
    ...s.board,
    studio: s.board.studio ? { ...desk, bookmarks: [] } : undefined,
  });
  const cue = cues?.find((c) => c.id === r.activeCueId);
  return publish({
    report:
      r.view === "stats"
        ? copy(
            statsSnapshot ||
              (desk.statsReportId
                ? dataReports?.[desk.statsReportId]
                : undefined),
          )
        : undefined,
    id: uid(),
    board,
    view: r.view,
    camera: r.camera,
    time: r.time,
    phaseTime: s.previewTime,
    playing: r.mediaPlaying && !r.mediaHolding,
    rate: r.rate,
    takenAt: Date.now(),
    black: false,
    cueId: cue?.id,
    title:
      cue?.title ||
      board.scenes.find((scene) => scene.id === board.activeScene)?.title ||
      board.title,
    thumbnail: capture ? captureThumbnail() : undefined,
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
  });
}
export function toggleBlackout() {
  const r = useRuntime.getState();
  if (!r.program) return;
  r.set({ follow: false });
  publish(setProgramBlack(r.program, !r.program.black));
}
export function setLiveFollow(enabled: boolean) {
  const r = useRuntime.getState();
  if (enabled && r.program?.black) {
    useStudio
      .getState()
      .notify("Restore programme before enabling live follow.");
    return;
  }
  if (enabled && !takeToAir()) return;
  if (!enabled && r.program) publish({ ...r.program, playing: false });
  r.set({ follow: enabled });
}
export function queueLiveTake() {
  if (queuedFrame) return;
  queuedFrame = requestAnimationFrame(() => {
    queuedFrame = 0;
    const r = useRuntime.getState();
    if (r.follow && r.program && !r.program.black && !r.busy)
      takeToAir({ capture: false });
  });
}
/** Opening/reconnecting output must never change the held shot. */
export function openProgram() {
  const w = window.open(
    "/?program=1",
    "touchline-program",
    "popup,width=1600,height=900",
  );
  useStudio
    .getState()
    .notify(
      w
        ? "Programme output opened. The held shot is unchanged."
        : "Allow this site to open the programme window.",
    );
}
