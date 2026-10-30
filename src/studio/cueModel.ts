import type { Board, Frame } from "../types";
import type { CameraPreset, RundownCue, ViewMode } from "./types";
import { emptyStudio } from "./types";
import { copy, uid } from "../core";

export function makeCue(
  board: Board,
  view: ViewMode,
  camera: CameraPreset,
  time: number,
  frame?: Frame,
): RundownCue {
  const desk = board.studio || emptyStudio();
  const source = view !== "board" ? desk.assetId : undefined;
  return {
    id: uid(),
    title:
      board.scenes.find((s) => s.id === board.activeScene)?.title ||
      "Analysis moment",
    note: "",
    duration: 15,
    view,
    camera,
    time,
    frame: copy(
      frame || {
        players: board.players,
        drawings: board.drawings,
        ball: board.ball,
      },
    ),
    settings: copy(board.settings),
    colors: copy(board.colors),
    formations: copy(board.formations),
    assetId: source,
    trim: copy(desk.trim),
    ink: copy(source ? desk.ink[source] || [] : []),
    lowerThird: desk.lowerThird,
  };
}
export function cueBoard(board: Board, cue: RundownCue): Board {
  const next = copy(board);
  Object.assign(next, copy(cue.frame), {
    settings: copy(cue.settings),
    colors: copy(cue.colors),
    formations: copy(cue.formations),
  });
  next.studio ||= emptyStudio();
  next.studio.view = cue.view;
  next.studio.assetId = cue.assetId;
  next.studio.trim = copy(cue.trim);
  next.studio.lowerThird = cue.lowerThird;
  if (cue.assetId) next.studio.ink[cue.assetId] = copy(cue.ink);
  return next;
}
