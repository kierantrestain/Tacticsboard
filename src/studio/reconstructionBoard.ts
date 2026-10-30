import type { Board } from "../types";
import type { MediaAsset, TrackingSequence } from "./types";
import { emptyStudio, timecode } from "./types";
import { copy, uid } from "../core";

/** Detach the editable board from tracking so subsequent player edits are visible. */
export function appendTrackingPhases(
  board: Board,
  sequence: TrackingSequence,
  asset: MediaAsset,
): number {
  if (!sequence.reviewed || sequence.assetId !== asset.id)
    throw Error("Review this source reconstruction first.");
  const selected = sequence.frames
    .filter((_, i) => i % 4 === 0 || i === sequence.frames.length - 1)
    .slice(0, Math.max(0, 100 - board.scenes.length));
  const phases = selected.map((frame, i) => ({
    id: uid(),
    title:
      i === 0 ? "Source shape" : `Moment ${String(i + 1).padStart(2, "0")}`,
    duration: Math.max(
      0.25,
      (selected[i + 1]?.time ?? frame.time + 1) - frame.time,
    ),
    note: `Source ${asset.name} · ${timecode(frame.time)}${frame.points.some((p) => p.review) ? " · includes observations flagged for review" : ""}`,
    source: {
      assetId: asset.id,
      time: frame.time,
      review: frame.points.some((p) => p.review),
    },
    players: frame.points.flatMap((p) => {
      const target = sequence.targets.find((t) => t.id === p.id);
      if (
        !target ||
        p.pitch.x < 0 ||
        p.pitch.x > 1 ||
        p.pitch.y < 0 ||
        p.pitch.y > 1
      )
        return [];
      return [
        {
          uid: `reconstructed:${target.id}`,
          playerId: target.playerId || target.id,
          side: target.side,
          name: target.name,
          number: target.number,
          x: p.pitch.x,
          y: p.pitch.y,
          opacity: p.review ? 0.45 : 1,
        },
      ];
    }),
    drawings: [],
    ball: { x: 0.5, y: 0.5 },
  }));
  if (!phases.length) return 0;
  board.scenes.push(...phases);
  board.activeScene = phases[0].id;
  board.players = copy(phases[0].players);
  board.drawings = [];
  board.ball = { x: 0.5, y: 0.5 };
  board.settings.ballVisible = false;
  board.studio ||= emptyStudio();
  board.studio.assetId = undefined;
  board.studio.view = "board";
  board.lineupSource = {
    home: "Reconstructed visible players",
    away: "Reconstructed visible players",
  };
  return phases.length;
}
