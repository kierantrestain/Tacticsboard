import { emptyStudio } from "./types";
import { frameAt, activeSceneTime } from "../core";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { takeToAir } from "./production";
import { captureThumbnail } from "./capture";
import { makeCue, cueBoard, replaceCueContent } from "./cueModel";
export { makeCue, cueBoard } from "./cueModel";

export function saveCue() {
  const s = useStudio.getState(),
    r = useRuntime.getState(),
    b = s.board;
  if (!b) return;
  if(r.movementDraft){s.notify("Finish or cancel the movement first.");return;}
  if ((b.studio?.cues?.length || 0) >= 80) {
    s.notify("This rundown has 80 shots. Remove a shot before saving another.");
    return;
  }
  const cue = makeCue(
    b,
    r.view,
    r.camera,
    r.view==='board'||r.view==='replay'&&!b.studio?.tracking[b.studio?.assetId||'']?s.previewTime??activeSceneTime(b):r.time,
    s.previewTime === null ? undefined : frameAt(b, s.previewTime),
  );
  cue.thumbnail = captureThumbnail();
  s.commit((b) => {
    b.studio ||= emptyStudio();
    (b.studio.cues ||= []).push(cue);
  });
  r.set({ activeCueId: cue.id });
  s.notify("Shot saved to the show rundown · M saves the next one");
}
export function recallCue(id: string, take = false) {
  const s = useStudio.getState(),
    r = useRuntime.getState(),
    b = s.board;
  const cue = b?.studio?.cues?.find((c) => c.id === id);
  if (!b || !cue) return;
  if(r.movementDraft){s.notify("Finish or cancel the movement first.");return;}
  if (cue.assetId && !r.assets.some((a) => a.id === cue.assetId)) {
    s.notify(
      "Source missing. The shot is open for inspection; restore its media before taking it to programme.",
    );
  }
  // Recall is one undoable edit, preserving the current rundown and source library.
  s.commit((board) => Object.assign(board, cueBoard(board, cue)));
  s.set({
    playing: false,
    speed: cue.playbackRate||1,
    previewTime: cue.phaseTime??null,
    playhead:cue.phaseTime??0,
    selected: [],
    selectedShape: null,
  });
  r.set({
    view: cue.view,
    rate: cue.playbackRate||1,
    reverseReview: false,
    camera: cue.camera,
    time: cue.time,
    mediaPlaying: false,
    mediaHolding: false,
    selectedInk: null,
    activeCueId: id,
    cueClock: { startedAt: null, elapsed: 0 },
    zoom: 1,
    pan: { x: 0, y: 0 },
    panMode: false,
    markMode: "none",
  });
  if (take) takeToAir();
}
export function stepCue(direction: number, take = false) {
  const r = useRuntime.getState(),
    cues = useStudio.getState().board?.studio?.cues || [];
  const index = cues.findIndex((c) => c.id === r.activeCueId);
  const next =
    index < 0 ? (direction > 0 ? 0 : cues.length - 1) : index + direction;
  if (cues[next]) recallCue(cues[next].id, take);
}

export function updateCue() {
  const s = useStudio.getState(),
    r = useRuntime.getState(),
    b = s.board;
  const previous = b?.studio?.cues?.find((c) => c.id === r.activeCueId);
  if (!b || !previous) return;
  if(r.movementDraft){s.notify("Finish or cancel the movement first.");return;}
  const current = makeCue(
    b,
    r.view,
    r.camera,
    r.view==='board'||r.view==='replay'&&!b.studio?.tracking[b.studio?.assetId||'']?s.previewTime??activeSceneTime(b):r.time,
    s.previewTime === null ? undefined : frameAt(b, s.previewTime),
  );
  current.thumbnail = captureThumbnail();
  s.commit((board) => {
    const i = board.studio!.cues!.findIndex((c) => c.id === previous.id);
    board.studio!.cues![i] = replaceCueContent(previous, current);
  });
  s.notify("Shot updated. Preview it again before marking it reviewed.");
}
