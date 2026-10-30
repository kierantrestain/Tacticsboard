import { describe, it, expect } from "vitest";
import {
  homography,
  project,
  invert3,
  sampleTracking,
} from "../src/studio/geometry";
import { MotionTracker, robustCamera } from "../src/studio/visionMath";
import { emptyStudio, isStudioDocument } from "../src/studio/types";
import {
  expandedPoints,
  imageInk,
  transformInk,
} from "../src/studio/inkGeometry";
import type { Landmark, MediaInk, TrackFrame } from "../src/studio/types";
const landmarks: Landmark[] = [
  { image: { x: 0.1, y: 0.2 }, pitch: { x: 0, y: 0 }, label: "A" },
  { image: { x: 0.9, y: 0.3 }, pitch: { x: 1, y: 0 }, label: "B" },
  { image: { x: 0.8, y: 0.9 }, pitch: { x: 1, y: 1 }, label: "C" },
  { image: { x: 0.2, y: 0.85 }, pitch: { x: 0, y: 1 }, label: "D" },
];
describe("pitch calibration", () => {
  it("fits all four observed points and round-trips the image projection", () => {
    const h = homography(landmarks)!;
    expect(h).toHaveLength(9);
    for (const l of landmarks) {
      const p = project(h, l.image);
      expect(p.x).toBeCloseTo(l.pitch.x, 7);
      expect(p.y).toBeCloseTo(l.pitch.y, 7);
    }
    const p = { x: 0.36, y: 0.61 },
      q = project(invert3(h)!, project(h, p));
    expect(q.x).toBeCloseTo(p.x, 7);
    expect(q.y).toBeCloseTo(p.y, 7);
  });
  it("rejects collinear or incomplete calibration", () => {
    expect(homography(landmarks.slice(0, 3))).toBeNull();
    expect(
      homography(
        landmarks.map((l, i) => ({ ...l, image: { x: i / 4, y: 0.5 } })),
      ),
    ).toBeNull();
  });
  it("keeps pitch-locked zone corners on the same pitch through camera changes", () => {
    const h = homography(landmarks)!,
      d: MediaInk = {
        id: "a",
        type: "zone",
        points: [0.2, 0.3, 0.4, 0.6],
        color: "#fff",
        width: 3,
        opacity: 1,
        assetId: "source",
        from: 0,
        to: 20,
        space: "pitch",
      };
    const screen = imageInk(d, h)!;
    expect(screen.points).toHaveLength(8);
    const world = transformInk(screen.points, h);
    expandedPoints(d).forEach((v, i) => expect(world[i]).toBeCloseTo(v, 7));
  });
});
describe("tracking observations", () => {
  it("compensates a camera translation while rejecting outliers", () => {
    const pairs = Array.from({ length: 12 }, (_, i) => ({
      a: { x: (i % 4) * 30 + 15, y: Math.floor(i / 4) * 25 + 20 },
      b: { x: (i % 4) * 30 + 19, y: Math.floor(i / 4) * 25 + 18 },
    }));
    pairs.push({ a: { x: 20, y: 30 }, b: { x: 180, y: 220 } });
    const r = robustCamera(pairs);
    expect(r.confidence).toBeGreaterThan(0.8);
    expect(r.matrix[2]).toBeCloseTo(4, 5);
    expect(r.matrix[5]).toBeCloseTo(-2, 5);
  });
  it("tracks a translated textured player patch in a locked shot", () => {
    const width = 160,
      height = 100;
    const frame = (dx: number, dy: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const at = (y * width + x) * 4;
          data[at] = 28;
          data[at + 1] = 88;
          data[at + 2] = 44;
          data[at + 3] = 255;
          const px = x - dx,
            py = y - dy;
          if (px >= 72 && px <= 88 && py >= 40 && py <= 61) {
            data[at] = 130 + ((px * 17 + py * 23) % 120);
            data[at + 1] = 20 + ((px * 3 + py * 7) % 45);
            data[at + 2] = 40 + ((px * 9 + py * 11) % 80);
          }
        }
      return { width, height, data };
    };
    const marks = landmarks.map((l, i) => ({
      ...l,
      image: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ][i],
    }));
    const tracker = new MotionTracker(frame(0, 0), marks, [
      {
        id: "p",
        name: "Player",
        side: "home",
        number: "",
        image: { x: 0.5, y: 0.62 },
        box: { w: 0.1, h: 0.22 },
      },
    ]);
    tracker.fixedCamera = true;
    const output = tracker.step(frame(4, 2), 0.25);
    expect(output.points[0].image.x * width).toBeCloseTo(84, 0);
    expect(output.points[0].image.y * height).toBeCloseTo(64, 0);
    expect(output.points[0].confidence).toBeGreaterThan(0.8);
    expect(output.points[0].review).toBe(false);
  });
  it("never smooths an uncertain observation into a confident position", () => {
    const frames: TrackFrame[] = [
      {
        time: 0,
        cameraConfidence: 1,
        points: [
          {
            id: "p",
            image: { x: 0.2, y: 0.3 },
            pitch: { x: 0.2, y: 0.3 },
            confidence: 1,
            review: false,
          },
        ],
      },
      {
        time: 1,
        cameraConfidence: 0,
        points: [
          {
            id: "p",
            image: { x: 0.8, y: 0.8 },
            pitch: { x: 0.8, y: 0.8 },
            confidence: 0.2,
            review: true,
          },
        ],
      },
    ];
    const result = sampleTracking(frames, 0.5)[0];
    expect(result.review).toBe(true);
    expect(result.pitch).toEqual({ x: 0.2, y: 0.3 });
  });
});
describe("standalone project schema", () => {
  it("accepts a clean studio document and rejects corrupt observations", () => {
    const d = emptyStudio();
    expect(isStudioDocument(d)).toBe(true);
    d.tracking.a = {
      assetId: "a",
      start: 0,
      end: 1,
      frames: [
        {
          time: 0,
          cameraConfidence: 1,
          points: [
            {
              id: "x",
              image: { x: NaN, y: 0 },
              pitch: { x: 0, y: 0 },
              confidence: 1,
              review: false,
            },
          ],
        },
      ],
      targets: [],
      reviewed: false,
      createdAt: "",
      method: "",
    };
    expect(isStudioDocument(d)).toBe(false);
  });
});
