import type { Board } from "../../types";
import type { MediaAsset, ViewMode } from "../types";
import type { ExplainStop } from "../filmPlan";
import { inspectView } from "../readiness";
export function availableHostViews(
  board: Board,
  assets: MediaAsset[],
  availability?: Record<string, boolean>,
): ViewMode[] {
  return (
    ["board", "footage", "split", "replay", "stats"] as ViewMode[]
  ).filter(
    (view) =>
      !inspectView(board, view, assets, availability).some(
        (issue) => issue.level === "block",
      ),
  );
}
export function explanationPause(
  trim: { start: number; end: number },
  time: number,
  existing: ExplainStop[],
  id: string,
) {
  if (!Number.isFinite(time) || trim.end - trim.start < 0.04)
    throw Error("Choose a valid video range first.");
  const at = Math.max(trim.start, Math.min(trim.end - 0.04, time));
  const duplicate = existing.find((s) => Math.abs(s.time - at) < 0.1);
  if (duplicate) return { time: duplicate.time, stops: existing };
  if (existing.length >= 20)
    throw Error("This clip already has 20 explanation pauses.");
  return { time: at, stops: [...existing, { id, time: at, hold: 3 }] };
}
