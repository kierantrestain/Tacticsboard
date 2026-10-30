import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendTrackingPhases } from "../src/studio/reconstructionBoard";
import type { TrackingSequence } from "../src/studio/types";
import { newBoard, copy, isBoard } from "../src/core";
import {
  makeCue,
  cueBoard,
  replaceCueContent,
  cueContentKey,
} from "../src/studio/cueModel";
import { inspectView, inspectCue } from "../src/studio/readiness";
import {
  setProgramBlack,
  transportProgram,
} from "../src/studio/productionModel";
import type { MediaAsset, ProgramSnapshot } from "../src/studio/types";
import type { Team } from "../src/types";
import catalogue from "../public/data/catalogue.json";
const board = () =>
  newBoard(
    catalogue.teams[0] as unknown as Team,
    catalogue.teams[1] as unknown as Team,
  );
const asset = {
  id: "clip",
  name: "Clip.mp4",
  type: "video",
  duration: 20,
} as MediaAsset;
const snapshot = (): ProgramSnapshot => ({
  id: "take-1",
  board: board(),
  view: "board",
  camera: "broadcast",
  time: 4,
  phaseTime: 1.75,
  playing: true,
  rate: 1,
  takenAt: 1,
  black: false,
});
const report = {
  id: "match",
  lineups: [],
  teamStats: [
    {
      teamId: catalogue.teams[0].id,
      stats: { shots: { label: "Shots", display: "14", value: 14 } },
    },
  ],
};

describe("held programme safety", () => {
  it("blackout and restore preserve the exact board, data, caption and phase frame, without reading preview", () => {
    const shot = snapshot();
    shot.board.studio!.lowerThird = "The original caption";
    shot.report = copy(report);
    const black = setProgramBlack(shot, true);
    shot.board.players[0].x = 0.9;
    shot.board.studio!.lowerThird = "New preview";
    const restored = setProgramBlack(black, false);
    expect(restored.board.players[0].x).not.toBe(0.9);
    expect(restored.board.studio!.lowerThird).toBe("The original caption");
    expect(restored.report).toEqual(report);
    expect(restored.phaseTime).toBe(1.75);
    expect(restored.id).toBe("take-1");
    expect(restored.playing).toBe(false);
    expect(restored.black).toBe(false);
  });
  it("rejects stale transport from an earlier take of the same project, and ignores transport during blackout", () => {
    const shot = snapshot();
    const msg = {
      snapshotId: "old-take",
      time: 8,
      playing: true,
      rate: 1,
      phaseTime: 3,
    };
    expect(transportProgram(shot, msg)).toBe(shot);
    const black = setProgramBlack(shot, true);
    expect(transportProgram(black, { ...msg, snapshotId: shot.id })).toBe(
      black,
    );
    const moved = transportProgram(shot, { ...msg, snapshotId: shot.id });
    expect(moved?.phaseTime).toBe(3);
    expect(moved?.time).toBe(8);
    expect(
      transportProgram(shot, { ...msg, snapshotId: shot.id, time: NaN }),
    ).toBe(shot);
  });
});
describe("self-contained shots and preflight", () => {
  it("freezes report values, caption visibility and selected metrics while the shared report refreshes", () => {
    const b = board();
    b.studio!.dataReports = { match: copy(report) };
    b.studio!.statsReportId = "match";
    b.studio!.broadcast = {
      channel: "BANG ON",
      programme: "SPORTS",
      accent: "#68d8e9",
      headline: "Pressure tells",
      subtitle: "SECOND HALF",
      showHeader: true,
      showScore: false,
      showLowerThird: true,
    };
    b.studio!.statsFields = ["shots"];
    const cue = makeCue(b, "stats", "broadcast", 0);
    b.studio!.dataReports.match.teamStats[0].stats.shots.display = "20";
    b.studio!.broadcast.headline = "Another story";
    b.studio!.broadcast.showScore = true;
    const recalled = cueBoard(b, cue);
    expect(
      recalled.studio!.statsSnapshot?.teamStats[0].stats.shots.display,
    ).toBe("14");
    expect(
      recalled.studio!.dataReports!.match.teamStats[0].stats.shots.display,
    ).toBe("20");
    expect(recalled.studio!.broadcast?.headline).toBe("Pressure tells");
    expect(recalled.studio!.broadcast?.showScore).toBe(false);
    expect(recalled.studio!.statsFields).toEqual(["shots"]);
    expect(cueContentKey(makeCue(recalled, "stats", "broadcast", 0))).toBe(
      cueContentKey(cue),
    );
    recalled.studio!.cues = [cue];
    expect(isBoard(recalled)).toBe(true);
  });
  it("updates a shot without losing the presenter script, sequence identity or planned time, and invalidates its review", () => {
    const b = board(),
      old = makeCue(b, "board", "broadcast", 0);
    old.note = "Explain the overload";
    old.title = "Our opener";
    old.duration = 45;
    old.reviewedAt = 1;
    b.players[0].x = 0.8;
    const updated = replaceCueContent(old, makeCue(b, "board", "overhead", 0));
    expect(updated).toMatchObject({
      id: old.id,
      note: old.note,
      title: old.title,
      duration: 45,
      camera: "overhead",
    });
    expect(updated.reviewedAt).toBeUndefined();
    expect(updated.frame.players[0].x).toBe(0.8);
  });
  it("blocks missing bytes, missing reports, invalid cards and unreviewed reconstruction, while allowing manual boards", () => {
    const b = board();
    b.studio!.assetId = "clip";
    expect(inspectView(b, "footage", [asset], { clip: false })[0].code).toBe(
      "missing-media",
    );
    expect(inspectView(b, "footage", [asset], {})[0].code).toBe(
      "checking-media",
    );
    expect(inspectView(b, "stats", [])[0].code).toBe("missing-report");
    b.studio!.statsReportId = "match";
    b.studio!.dataReports = { match: copy(report) };
    b.studio!.statsFields = [];
    expect(inspectView(b, "stats", [])[0].code).toBe("empty-card");
    b.studio!.tracking.clip = {
      assetId: "clip",
      start: 0,
      end: 2,
      frames: [],
      targets: [],
      reviewed: false,
      createdAt: "",
      method: "test",
    };
    expect(inspectView(b, "replay", [asset], { clip: true })[0].code).toBe(
      "tracking-review",
    );
    expect(inspectView(b, "board", [], {})).toEqual([]);
    const cue = makeCue(b, "board", "broadcast", 0);
    expect(inspectCue(b, cue, []).map((i) => i.code)).toEqual([
      "shot-review",
      "presenter-note",
    ]);
    cue.note = "Point out the overload";
    cue.reviewedAt = 1;
    expect(inspectCue(b, cue, [])).toEqual([]);
  });
  it("rejects malformed new shot fields and retains support for older portable shows", () => {
    const b = board(),
      cue = makeCue(b, "board", "broadcast", 0);
    b.studio!.cues = [cue];
    expect(isBoard(b)).toBe(true);
    cue.thumbnail = "javascript:bad";
    expect(isBoard(b)).toBe(false);
    delete cue.thumbnail;
    cue.statsFields = Array(9).fill("shots");
    expect(isBoard(b)).toBe(false);
    delete cue.statsFields;
    delete cue.broadcast;
    expect(isBoard(b)).toBe(true);
    b.studio!.sourceRanges = { clip: { start: 8, end: 2 } };
    expect(isBoard(b)).toBe(false);
  });
});

const tracked = (): TrackingSequence => ({
  assetId: "clip",
  start: 0,
  end: 1,
  reviewed: true,
  createdAt: "2026-10-30",
  method: "reviewed fixture",
  targets: [
    {
      id: "p",
      playerId: "known-player",
      name: "Player",
      number: "8",
      side: "home",
      image: { x: 0.3, y: 0.4 },
    },
  ],
  frames: [
    {
      time: 0,
      cameraConfidence: 1,
      points: [
        {
          id: "p",
          image: { x: 0.3, y: 0.4 },
          pitch: { x: 0.25, y: 0.6 },
          confidence: 1,
          review: false,
        },
      ],
    },
    {
      time: 1,
      cameraConfidence: 1,
      points: [
        {
          id: "p",
          image: { x: 0.5, y: 0.4 },
          pitch: { x: 0.45, y: 0.6 },
          confidence: 1,
          review: false,
        },
      ],
    },
  ],
});
describe("reviewed reconstruction preservation", () => {
  it("stores the reviewed tracking with the shot so later calibration cannot change a prepared replay", () => {
    const b = board();
    b.studio!.assetId = "clip";
    b.studio!.tracking.clip = tracked();
    const cue = makeCue(b, "replay", "broadcast", 0.5);
    b.studio!.tracking.clip.frames[0].points[0].pitch.x = 0.8;
    b.studio!.tracking.clip.targets[0].name = "Another identity";
    const recalled = cueBoard(b, cue);
    expect(recalled.studio!.tracking.clip.frames[0].points[0].pitch.x).toBe(
      0.25,
    );
    expect(recalled.studio!.tracking.clip.targets[0].name).toBe("Player");
    b.studio!.cues = [cue];
    expect(isBoard(b)).toBe(true);
  });
  it("appends editable observed positions without deleting prepared phases or continuing to override edits from source tracking", () => {
    const b = board(),
      first = copy(b.scenes[0]),
      seq = tracked();
    b.studio!.assetId = "clip";
    b.studio!.tracking.clip = seq;
    const added = appendTrackingPhases(b, seq, asset);
    expect(added).toBe(2);
    expect(b.scenes[0]).toEqual(first);
    expect(b.scenes).toHaveLength(3);
    expect(b.players[0]).toMatchObject({
      playerId: "known-player",
      x: 0.25,
      y: 0.6,
    });
    expect(b.studio!.assetId).toBeUndefined();
    expect(b.studio!.view).toBe("board");
    expect(b.studio!.tracking.clip).toBe(seq);
    expect(b.scenes[1].source).toMatchObject({ assetId: "clip", time: 0 });
    expect(isBoard(b)).toBe(true);
    seq.reviewed = false;
    expect(() => appendTrackingPhases(b, seq, asset)).toThrow("Review");
  });
});
