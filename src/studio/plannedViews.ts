import type { Board } from "../types";
import type { CameraPreset, MediaAsset, RundownCue } from "./types";
import { copy, uid, activeSceneTime, frameAt } from "../core";
import { defaultPresentation } from "./mediaModel";
import { makeCue } from "./cueModel";
import { appendTrackingPhases } from "./reconstructionBoard";
export type PlannedView =
  "original" | "annotated" | "board" | "replay" | "split";
/** Prepare snapshots privately; building a sequence never takes programme output. */
export function plannedViews(
  board: Board,
  asset: MediaAsset,
  views: PlannedView[],
  time: number,
  title: string,
  preset: CameraPreset = "broadcast",
): RundownCue[] {
  if (!views.length || views.length > 5 || new Set(views).size !== views.length)
    throw Error("Choose one to five distinct views.");
  if ((board.studio?.cues?.length || 0) + views.length > 80)
    throw Error("This rundown is full.");
  const b = copy(board),
    d = b.studio!,
    sequence = d.tracking[asset.id];
  if (views.some((v) => ["board", "replay", "split"].includes(v))) {
    if (
      !sequence?.reviewed ||
      !sequence.frames.length ||
      !sequence.targets.length
    )
      throw Error(
        "Review the player reconstruction before preparing tactical comparison views.",
      );
    const sourceScenes = b.scenes.filter((s) => s.source?.assetId === asset.id);
    b.scenes = sourceScenes;
    b.settings.ballVisible = false;
    if (!sourceScenes.length) {
      appendTrackingPhases(b, sequence, asset);
    }
  }
  const segmentId = uid();
  return views.map((view) => {
    d.assetId = asset.id;
    const source = d.sourcePresentations?.[asset.id] || defaultPresentation();
    (d.sourcePresentations ||= {})[asset.id] = {
      ...source,
      original: view === "original",
    };
    const camera = d.cameraPose,
      mode = view === "original" || view === "annotated" ? "footage" : view;
    const phase =
      b.scenes
        .filter((s) => s.source?.assetId === asset.id && s.source.time <= time)
        .at(-1) || b.scenes.find((s) => s.source?.assetId === asset.id);
    if (phase) {
      b.activeScene = phase.id;
      b.players = copy(phase.players);
      b.ball = copy(phase.ball);
      b.drawings = copy(phase.drawings);
    }
    const phaseTime = phase
      ? activeSceneTime(b) +
        Math.max(0, Math.min(phase.duration, time - (phase.source?.time || 0)))
      : 0;
    const cue = makeCue(
      b,
      mode,
      preset,
      mode === "board" ? phaseTime : time,
      mode === "board" ? frameAt(b, phaseTime) : undefined,
    );
    cue.cameraPose = copy(camera);
    cue.segmentId = segmentId;
    cue.segmentTitle = title.slice(0, 120) || asset.name.slice(0, 120);
    cue.title =
      `${cue.segmentTitle} · ${view === "board" ? "2D" : view === "replay" ? "3D" : view === "split" ? "Comparison" : view === "original" ? "Original" : "Annotated"}`.slice(
        0,
        80,
      );
    return cue;
  });
}
