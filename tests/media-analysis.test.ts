import { describe, it, expect } from "vitest";
import { newBoard, copy, isBoard, frameAt, syncScene } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
import type { MediaAsset, MediaInk, TrackFrame } from "../src/studio/types";
import {
  importSelection,
  defaultPresentation,
  sourceGeometry,
  validPresentation,
  validCameraPose,
  mediaKind,
  validateSourceFile,
  analysisRange,
  visibleMediaInk,
  curvedPoints,
  duplicateSourceState,
  validateReplacement,
  clipCue,
  invalidateSourceReview,
} from "../src/studio/mediaModel";
import {
  makeCue,
  cueBoard,
  replaceCueContent,
  cueContentKey,
} from "../src/studio/cueModel";
import { plannedViews } from "../src/studio/plannedViews";
import { sampleTracking } from "../src/studio/geometry";
import { clipPlan } from "../src/studio/filmPlan";
import { buildStillSequence } from "../src/studio/stillSequence";
const board = () =>
  newBoard(
    catalogue.teams[0] as unknown as Team,
    catalogue.teams[1] as unknown as Team,
  );
it("routes project packs and JSON through project restore and rejects mixed destructive imports", () => {
  expect(importSelection([{ name: "analysis.touchline.zip" }])).toBe("project");
  expect(importSelection([{ name: "analysis.JSON" }])).toBe("project");
  expect(importSelection([{ name: "clip.mp4" }, { name: "still.png" }])).toBe(
    "media",
  );
  expect(() =>
    importSelection([{ name: "analysis.zip" }, { name: "clip.mp4" }]),
  ).toThrow("one project");
  expect(() =>
    importSelection([{ name: "one.json" }, { name: "two.json" }]),
  ).toThrow("one project");
});
const asset = (id = "source"): MediaAsset => ({
  id,
  name: "Match passage.mp4",
  type: "video",
  mime: "video/mp4",
  size: 500,
  width: 1280,
  height: 720,
  duration: 600,
  fps: 25,
  createdAt: "2026-11-01",
  thumbnail: "",
});
const ink = (id = "source"): MediaInk => ({
  id: "arrow",
  assetId: id,
  type: "arrow",
  points: [0.2, 0.3, 0.7, 0.5],
  color: "#dfff81",
  width: 4,
  opacity: 1,
  from: 30,
  to: 40,
  curve: 0.4,
});
const tracking = (id = "source") => ({
  assetId: id,
  start: 30,
  end: 31,
  targets: [
    {
      id: "one",
      name: "Player",
      side: "home" as const,
      number: "8",
      playerId: "bio",
      image: { x: 0.2, y: 0.3 },
    },
  ],
  frames: [30, 31].map((time) => ({
    time,
    cameraConfidence: 0.9,
    points: [
      {
        id: "one",
        image: { x: 0.2, y: 0.3 },
        pitch: { x: 0.3, y: 0.4 },
        confidence: 0.8,
        review: false,
      },
    ],
  })),
  reviewed: true,
  createdAt: "2026-11-01",
  method: "Reviewed test observations",
});

describe("source preparation boundaries", () => {
  it("accepts a long supported source without changing the short analysis and tracking limits", () => {
    expect(mediaKind({ name: "MATCH.MOV", type: "" })).toBe("video");
    expect(mediaKind({ name: "photo.JPG", type: "" })).toBe("image");
    expect(() =>
      validateSourceFile({
        name: "match.mp4",
        type: "video/mp4",
        size: 500 * 1024 ** 2,
      }),
    ).not.toThrow();
    expect(() =>
      validateSourceFile({
        name: "match.mp4",
        type: "video/mp4",
        size: 3 * 1024 ** 3,
      }),
    ).toThrow("2 GB");
    expect(() =>
      validateSourceFile({ name: "notes.txt", type: "text/plain", size: 100 }),
    ).toThrow("supported");
    expect(() =>
      validateSourceFile({ name: "bad.png", type: "image/png", size: 0 }),
    ).toThrow("empty");
    expect(analysisRange(900, 960, 5400)).toEqual({ start: 900, end: 960 });
    expect(() => analysisRange(900, 961, 5400)).toThrow("60 seconds");
    expect(() => analysisRange(20, 21, 20)).toThrow();
  });
  it("keeps source coordinates stable while changing the displayed crop and orientation", () => {
    const p = defaultPresentation();
    p.crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 };
    p.rotation = 90;
    expect(sourceGeometry(1280, 720, p)).toMatchObject({
      width: 360,
      height: 768,
      offsetX: 128,
      offsetY: 144,
      x: 360,
      y: 0,
      rotation: 90,
    });
    p.original = true;
    expect(sourceGeometry(1280, 720, p)).toMatchObject({
      width: 1280,
      height: 720,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
    });
  });
  it("rejects invalid picture adjustments and unsafe camera poses on project import", () => {
    const p = defaultPresentation();
    expect(validPresentation(p)).toBe(true);
    expect(
      validPresentation({
        ...p,
        crop: { x: 0.9, y: 0, width: 0.5, height: 1 },
      }),
    ).toBe(false);
    expect(validPresentation({ ...p, brightness: Infinity })).toBe(false);
    expect(
      validCameraPose({ position: [20, 60, 80], target: [0, 0, 0], fov: 43 }),
    ).toBe(true);
    expect(
      validCameraPose({ position: [0, 0, 0], target: [0, 0, 0], fov: 43 }),
    ).toBe(false);
    const b = board();
    b.studio!.sourcePresentations = { source: { ...p, contrast: NaN } };
    expect(isBoard(b)).toBe(false);
  });
  it("hides original and individually hidden layers without deleting their editable state", () => {
    const layers = [ink(), { ...ink(), id: "hidden", hidden: true }],
      p = defaultPresentation();
    expect(visibleMediaInk(layers, 35, p)).toHaveLength(1);
    expect(visibleMediaInk(layers, 45, p)).toEqual([]);
    expect(visibleMediaInk(layers, 35, { ...p, original: true })).toEqual([]);
    expect(visibleMediaInk(layers, 35, { ...p, annotations: false })).toEqual(
      [],
    );
    expect(layers).toHaveLength(2);
  });
  it("renders a curved path with exactly the same original endpoints", () => {
    const shape = ink(),
      points = curvedPoints(shape);
    expect(points).toHaveLength(66);
    expect(points.slice(0, 2)).toEqual(shape.points.slice(0, 2));
    expect(points.slice(-2)).toEqual(shape.points.slice(-2));
    expect(points[33]).not.toBe((shape.points[1] + shape.points[3]) / 2);
    expect(curvedPoints({ ...shape, curve: 0 })).toEqual(shape.points);
  });
  it("duplicates editable source state under new identifiers and independent objects", () => {
    const d = board().studio!;
    d.ink.source = [ink()];
    d.tracking.source = tracking();
    d.sourcePresentations = { source: defaultPresentation() };
    d.sourceRanges = { source: { start: 30, end: 40 } };
    duplicateSourceState(d, "source", "copy");
    expect(d.ink.copy[0].assetId).toBe("copy");
    expect(d.ink.copy[0].id).not.toBe("arrow");
    expect(d.tracking.copy.assetId).toBe("copy");
    d.ink.copy[0].points[0] = 0.9;
    d.sourcePresentations.copy.rotation = 90;
    expect(d.ink.source[0].points[0]).toBe(0.2);
    expect(d.sourcePresentations.source.rotation).toBe(0);
  });
  it("protects annotation geometry and all saved timestamps during replacement", () => {
    const b = board(),
      a = asset();
    b.studio!.assetId = a.id;
    b.studio!.trim = { start: 90, end: 110 };
    b.studio!.cues = [makeCue(b, "footage", "broadcast", 100)];
    expect(() => validateReplacement(b, a, { ...a, width: 1920 })).toThrow(
      "dimensions",
    );
    expect(() => validateReplacement(b, a, { ...a, duration: 100 })).toThrow(
      "ends before",
    );
    expect(() =>
      validateReplacement(b, a, { ...a, duration: 120 }),
    ).not.toThrow();
  });
  it("splits references without changing source timestamps or annotations", () => {
    const b = board();
    b.studio!.ink.source = [ink()];
    expect(clipCue(b, asset(), { start: 30, end: 40 }, 34, "split")).toEqual([
      { start: 30, end: 34 },
      { start: 34, end: 40 },
    ]);
    expect(() =>
      clipCue(b, asset(), { start: 30, end: 40 }, 30, "split"),
    ).toThrow("inside");
    expect(b.studio!.ink.source[0]).toEqual(ink());
  });
});

describe("saved source and view sequences", () => {
  it("restores picture, playback and camera settings without reading mutable source settings", () => {
    const b = board(),
      d = b.studio!;
    d.assetId = "source";
    d.sourcePresentations = {
      source: { ...defaultPresentation(), rotation: 90, brightness: 1.2 },
    };
    d.playbackRate = 0.5;
    d.comparisonView = "3d";
    d.cameraPose = { position: [30, 50, 80], target: [4, 0, 5], fov: 35 };
    d.ink.source = [ink()];
    const cue = makeCue(b, "split", "endline", 35);
    d.sourcePresentations.source.rotation = 0;
    d.ink.source[0].curve = 0;
    d.playbackRate = 2;
    const restored = cueBoard(b, cue);
    expect(restored.studio!.sourcePresentations!.source.rotation).toBe(90);
    expect(restored.studio!.ink.source[0].curve).toBe(0.4);
    expect(restored.studio!.playbackRate).toBe(0.5);
    expect(restored.studio!.comparisonView).toBe("3d");
    expect(restored.studio!.cameraPose).toEqual({
      position: [30, 50, 80],
      target: [4, 0, 5],
      fov: 35,
    });
    expect(isBoard(restored)).toBe(true);
  });
  it("creates a complete ordered five-view segment privately and keeps each original/annotated snapshot separate", () => {
    const b = board(),
      d = b.studio!;
    d.assetId = "source";
    d.trim = { start: 30, end: 40 };
    d.ink.source = [ink()];
    d.tracking.source = tracking();
    const before = JSON.stringify(b),
      cues = plannedViews(
        b,
        asset(),
        ["original", "annotated", "board", "replay", "split"],
        30,
        "The overload",
      );
    expect(JSON.stringify(b)).toBe(before);
    expect(cues.map((c) => c.view)).toEqual([
      "footage",
      "footage",
      "board",
      "replay",
      "split",
    ]);
    expect(new Set(cues.map((c) => c.segmentId)).size).toBe(1);
    expect(cues[0].sourcePresentation!.original).toBe(true);
    expect(cues[1].sourcePresentation!.original).toBe(false);
    expect(cues[2].sequence!.some((s) => s.source?.assetId === "source")).toBe(
      true,
    );
    expect(cues[3].tracking!.reviewed).toBe(true);
  });
  it("blocks unreviewed comparisons and preserves segment membership when updating a saved shot", () => {
    const b = board();
    expect(() => plannedViews(b, asset(), ["replay"], 0, "Story")).toThrow(
      "Review",
    );
    const first = makeCue(b, "board", "broadcast", 0);
    first.segmentId = "segment";
    first.segmentTitle = "The overload";
    first.note = "Explain the spare player";
    const next = makeCue(b, "board", "broadcast", 2);
    expect(replaceCueContent(first, next)).toMatchObject({
      id: first.id,
      segmentId: "segment",
      segmentTitle: "The overload",
      note: first.note,
    });
    next.cameraPose = { position: [0, 120, 0], target: [0, 0, 0], fov: 43 };
    expect(cueContentKey(first)).not.toBe(cueContentKey(next));
  });
  it("invalidates current and frozen tracking review when source content changes", () => {
    const b = board();
    b.studio!.assetId = "source";
    b.studio!.tracking.source = tracking();
    const cue = makeCue(b, "replay", "broadcast", 30);
    cue.reviewedAt = 123;
    b.studio!.cues = [cue];
    invalidateSourceReview(b, "source");
    expect(b.studio!.tracking.source.reviewed).toBe(false);
    expect(b.studio!.cues[0].tracking!.reviewed).toBe(false);
    expect(b.studio!.cues[0].reviewedAt).toBeUndefined();
  });
  it("keeps reference timestamps and pitch annotations in a reconstructed three-still sequence", () => {
    const b = board(),
      d = b.studio!,
      assets = ["one", "two", "three"].map((id, i) => ({
        ...asset(id),
        type: "image" as const,
        referenceTime: 100 + i * 3,
      }));
    for (const a of assets) {
      d.tracking[a.id] = tracking(a.id);
      d.ink[a.id] = [{ ...ink(a.id), space: "pitch", from: 0, to: 5 }];
    }
    const scenes = buildStillSequence(
      assets.map((a) => a.id),
      assets,
      d,
      1,
    );
    expect(scenes.map((s) => s.source!.time)).toEqual([100, 103, 106]);
    expect(scenes.map((s) => s.players[0].uid)).toEqual([
      "home:bio",
      "home:bio",
      "home:bio",
    ]);
    expect(scenes[1].drawings).toHaveLength(1);
    expect(scenes[1].note).toContain("illustrative");
  });
});

it("starts a prepared 2D explanation on observed source players, independently of the existing formation", () => {
  const b = board();
  b.studio!.assetId = "source";
  b.studio!.tracking.source = tracking();
  const cue = plannedViews(b, asset(), ["board"], 30, "Source")[0],
    restored = cueBoard(b, cue);
  syncScene(restored);
  expect(restored.scenes.every((s) => s.source?.assetId === "source")).toBe(
    true,
  );
  expect(frameAt(restored, cue.phaseTime!).players).toHaveLength(1);
  expect(restored.settings.ballVisible).toBe(false);
  expect(b.players).toHaveLength(22);
});

describe("timing and rejected observations", () => {
  it("exports slow and fast clips at the chosen speed while explanation holds stay in wall-clock seconds", () => {
    const p = clipPlan(
      { start: 10, end: 20 },
      [{ id: "hold", time: 12, hold: 3 }],
      0.5,
    );
    expect(p.duration).toBe(23);
    expect(p.sourceAt(3).time).toBe(11.5);
    expect(p.sourceAt(5)).toMatchObject({ time: 12, holding: true });
    expect(p.sourceAt(7)).toMatchObject({ time: 12, holding: false });
    expect(p.sourceAt(23).time).toBe(20);
    expect(clipPlan({ start: 10, end: 20 }, [], 2).duration).toBe(5);
  });
  it("omits rejected observations and does not interpolate through them or fill unseen players", () => {
    const frames = tracking().frames as TrackFrame[];
    frames[1].points[0].rejected = true;
    expect(sampleTracking(frames, 30)).toHaveLength(1);
    expect(sampleTracking(frames, 30.5)).toEqual([]);
    expect(sampleTracking(frames, 31)).toEqual([]);
    frames[1].points = [];
    expect(sampleTracking(frames, 30.5)).toEqual([]);
  });
});
