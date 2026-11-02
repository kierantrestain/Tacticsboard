import type { Board } from "../types";
import type { MediaAsset, RundownCue, ViewMode } from "./types";
import { cueBoard } from "./cueModel";
import { statCardRows } from "../football/reportTools";
import { validComparison } from '../football/comparisonModel';

import { cachedResource } from '../football/events/resource';
import { validGraphic } from '../football/events/import';
export interface ReadinessIssue {
  code: string;
  level: "block" | "review";
  message: string;
}
export function inspectView(
  board: Board,
  view: ViewMode,
  assets: MediaAsset[],
  availability?: Record<string, boolean>,
): ReadinessIssue[] {
  const d = board.studio;
  const issues: ReadinessIssue[] = [];
  if (board.recreation && ['board', 'replay'].includes(view))
    issues.push({ code: 'report-recreation', level: 'review', message: 'Report recreation: check the actors and direction. Off-ball positions, build-up and movement are illustrative.' });
  const sequence = d?.assetId ? d.tracking[d.assetId] : undefined;
  const needsSource =
    view === "footage" || view === "split" || (view === "replay" && !!sequence);
  if (needsSource) {
    const asset = assets.find((a) => a.id === d?.assetId);
    if (!asset || (availability && availability[asset.id] === false))
      issues.push({
        code: "missing-media",
        level: "block",
        message:
          "Source media is missing. Import the project pack or choose another source.",
      });
    else if (availability && availability[asset.id] === undefined)
      issues.push({
        code: "checking-media",
        level: "block",
        message: "Checking that the source file is available on this device.",
      });
    if (
      asset?.type === "video" &&
      d &&
      (d.trim.start >= d.trim.end || d.trim.end > asset.duration + 0.1)
    )
      issues.push({
        code: "invalid-trim",
        level: "block",
        message: "Set a valid in and out point within this clip.",
      });
  }
  if ((view === "split" || view === "replay") && sequence && !sequence.reviewed)
    issues.push({
      code: "tracking-review",
      level: "block",
      message:
        "Review the calibration and player markers before taking this reconstruction to output.",
    });
  if (
    (view === "split" || view === "replay") &&
    sequence &&
    (!sequence.frames.length ||
      !sequence.targets.length ||
      sequence.frames.some((f) =>
        f.points.some((p) => !sequence.targets.some((t) => t.id === p.id)),
      ))
  )
    issues.push({
      code: "invalid-tracking",
      level: "block",
      message:
        "Rebuild this tracking sequence: observations or player identities are missing.",
    });
  if(view==='stats'&&d?.comparison&&(!validComparison(d.comparison)||!d.comparison.fields.length))issues.push({code:'invalid-comparison',level:'block',message:'Choose two to five entries and at least one statistic.'});
  if(view==='stats'&&d?.dataGraphic&&(!validGraphic(d.dataGraphic)||!cachedResource(d.dataGraphic.resourceId)))issues.push({code:'missing-event-resource',level:'block',message:'Wait for the saved event/cohort snapshot, or restore the complete episode backup.'});
  if(view==='stats'&&d?.dataGraphic?.kind==='radar'&&(!d.dataGraphic.playerIds.length||!d.dataGraphic.radarMetrics.length))issues.push({code:'empty-radar',level:'block',message:'Choose a radar player and at least one metric before presenting.'});
  if (view === "stats"&&!d?.comparison&&!d?.dataGraphic) {
    const report =
      d?.statsSnapshot ||
      (d?.statsReportId ? d.dataReports?.[d.statsReportId] : undefined);
    if (!report)
      issues.push({
        code: "missing-report",
        level: "block",
        message: "Open a match report and choose a data card first.",
      });
    else {
      if (board.match && report.id !== board.match.id)
        issues.push({
          code: "report-context",
          level: "block",
          message:
            "This report belongs to a different match. Open the correct match report.",
        });
      if (
        [d?.statsPlayerId, d?.statsComparePlayerId].some(id => id && !report.lineups.some(l => l.players.some(p => p.id === id)))
      )
        issues.push({
          code: "missing-player",
          level: "block",
          message:
            "This player is not in the saved report. Choose a player from this match.",
        });
      const rows = statCardRows(report, d?.statsPlayerId, board.match, d?.statsComparePlayerId).filter(
        (row) => !d?.statsFields || d.statsFields.includes(row.key),
      );
      if (!rows.length)
        issues.push({
          code: "empty-card",
          level: "block",
          message:
            "No statistics are available for this card. Choose another player or metric.",
        });
    }
  }
  if (
    (view === "board" || (view === "replay" && !sequence)) &&
    !board.players.length &&
    !board.drawings.length
  )
    issues.push({
      code: "empty-board",
      level: "block",
      message: "Add players or a graphic before taking this board to output.",
    });
  return issues;
}
export function inspectCue(
  board: Board,
  cue: RundownCue,
  assets: MediaAsset[],
  availability?: Record<string, boolean>,
): ReadinessIssue[] {
  const issues = inspectView(
    cueBoard(board, cue),
    cue.view,
    assets,
    availability,
  );
  if (!cue.reviewedAt)
    issues.push({
      code: "shot-review",
      level: "review",
      message: "Preview the shot, check its caption and mark it reviewed.",
    });
  if (!cue.note.trim())
    issues.push({
      code: "presenter-note",
      level: "review",
      message: "Add the point the presenter should explain.",
    });
  return issues;
}
export const viewLabels: Record<ViewMode, string> = {
  board: "Tactical board",
  footage: "Source footage",
  split: "Source + board",
  replay: "3D replay",
  stats: "Data card",
};
