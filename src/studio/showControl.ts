import { emptyStudio } from "./types";
import { frameAt } from "../core";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { takeToAir } from "./production";
import { makeCue, cueBoard } from "./cueModel";
export { makeCue, cueBoard } from "./cueModel";

export function saveCue() {
  const s = useStudio.getState(),
    r = useRuntime.getState(),
    b = s.board;
  if (!b) return;
  if ((b.studio?.cues?.length || 0) >= 80) {
    s.notify("This rundown has 80 shots. Remove a shot before saving another.");
    return;
  }
  const cue = makeCue(
    b,
    r.view,
    r.camera,
    r.time,
    s.previewTime === null ? undefined : frameAt(b, s.previewTime),
  );
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
  if (cue.assetId && !r.assets.some((a) => a.id === cue.assetId)) {
    s.notify(
      "This shot needs its source media. Import the portable project pack.",
    );
    return;
  }
  // Recall is one undoable edit, preserving the current rundown and source library.
  s.commit((board) => Object.assign(board, cueBoard(board, cue)));
  s.set({
    playing: false,
    previewTime: null,
    selected: [],
    selectedShape: null,
  });
  r.set({
    view: cue.view,
    camera: cue.camera,
    time: cue.time,
    mediaPlaying: false,
    selectedInk: null,
    activeCueId: id,
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
