import type { Point, Landmark, TrackFrame, TrackedTarget } from "./types";
import { homography, project, solveLinear } from "./geometry";
export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export function gray(frame: PixelFrame): Float32Array {
  const g = new Float32Array(frame.width * frame.height);
  for (let i = 0; i < g.length; i++) {
    const r = frame.data[i * 4],
      v = frame.data[i * 4 + 1],
      b = frame.data[i * 4 + 2];
    g[i] = r * 0.48 + v * 0.12 + b * 0.4;
  }
  return g;
}
export function patchMatch(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  px: number,
  py: number,
  range = 18,
  rx = 4,
  ry = 4,
) {
  x = Math.round(x);
  y = Math.round(y);
  const values: number[] = [];
  let mean = 0;
  for (let j = -ry; j <= ry; j++)
    for (let i = -rx; i <= rx; i++) {
      const v =
        a[
          Math.max(0, Math.min(h - 1, y + j)) * w +
            Math.max(0, Math.min(w - 1, x + i))
        ];
      values.push(v);
      mean += v;
    }
  mean /= values.length;
  let variance = 0;
  for (let i = 0; i < values.length; i++) {
    values[i] -= mean;
    variance += values[i] * values[i];
  }
  if (variance < values.length * 5) return { x: px, y: py, score: 0 };
  let best = -1,
    bx = px,
    by = py;
  const evaluate = (cx: number, cy: number) => {
    if (cx < rx || cy < ry || cx >= w - rx || cy >= h - ry) return;
    let sum = 0,
      sum2 = 0,
      cross = 0,
      k = 0;
    for (let j = -ry; j <= ry; j++)
      for (let i = -rx; i <= rx; i++) {
        const v = b[(cy + j) * w + cx + i];
        sum += v;
        sum2 += v * v;
        cross += values[k++] * v;
      }
    const den = Math.sqrt(
      variance * Math.max(1, sum2 - (sum * sum) / values.length),
    );
    const score = cross / den;
    if (score > best) {
      best = score;
      bx = cx;
      by = cy;
    }
  };
  for (let cy = Math.round(py - range); cy <= py + range; cy += 3)
    for (let cx = Math.round(px - range); cx <= px + range; cx += 3)
      evaluate(cx, cy);
  const cx = bx,
    cy = by;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++)
      evaluate(Math.round(cx + i), Math.round(cy + j));
  return { x: bx, y: by, score: Math.max(0, best) };
}
export function affineFit(pairs: { a: Point; b: Point }[]): number[] | null {
  if (pairs.length < 3) return null;
  const mat = Array.from({ length: 3 }, () => [0, 0, 0]),
    x = [0, 0, 0],
    y = [0, 0, 0];
  for (const p of pairs) {
    const row = [p.a.x, p.a.y, 1];
    for (let i = 0; i < 3; i++) {
      x[i] += row[i] * p.b.x;
      y[i] += row[i] * p.b.y;
      for (let j = 0; j < 3; j++) mat[i][j] += row[i] * row[j];
    }
  }
  const a = solveLinear(mat, x),
    b = solveLinear(mat, y);
  return a && b ? [...a, ...b] : null;
}
export const applyAffine = (m: number[], p: Point): Point => ({
  x: m[0] * p.x + m[1] * p.y + m[2],
  y: m[3] * p.x + m[4] * p.y + m[5],
});
export function robustCamera(pairs: { a: Point; b: Point }[]): {
  matrix: number[];
  confidence: number;
} {
  const identity = [1, 0, 0, 0, 1, 0];
  if (pairs.length < 3) return { matrix: identity, confidence: 0 };
  let best: typeof pairs = [];
  for (let k = 0; k < Math.min(40, pairs.length * 3); k++) {
    const sample = [
        pairs[k % pairs.length],
        pairs[(k * 3 + 1) % pairs.length],
        pairs[(k * 7 + 2) % pairs.length],
      ],
      m = affineFit(sample);
    if (!m) continue;
    const inliers = pairs.filter((p) => {
      const q = applyAffine(m, p.a);
      return Math.hypot(q.x - p.b.x, q.y - p.b.y) < 3.5;
    });
    if (inliers.length > best.length) best = inliers;
  }
  const m = affineFit(best);
  if (!m || m[0] < 0.75 || m[0] > 1.3 || m[4] < 0.75 || m[4] > 1.3)
    return { matrix: identity, confidence: 0 };
  return { matrix: m, confidence: best.length / pairs.length };
}
export class MotionTracker {
  previous: Float32Array;
  w: number;
  h: number;
  landmarks: Landmark[];
  targets: TrackedTarget[];
  positions: Record<string, Point>;
  frameCount = 0;
  fixedCamera = false;
  constructor(
    frame: PixelFrame,
    landmarks: Landmark[],
    targets: TrackedTarget[],
  ) {
    this.w = frame.width;
    this.h = frame.height;
    this.previous = gray(frame);
    this.landmarks = structuredClone(landmarks);
    this.targets = structuredClone(targets);
    this.positions = Object.fromEntries(
      targets.map((t) => [t.id, { ...t.image }]),
    );
  }
  step(
    frame: PixelFrame,
    time: number,
    detections: {
      x: number;
      y: number;
      w: number;
      h: number;
      confidence: number;
    }[] = [],
  ): TrackFrame & { map?: number[] } {
    const current = gray(frame),
      { w, h } = this;
    let diff = 0,
      count = 0;
    for (let i = 0; i < current.length; i += 37) {
      diff += Math.abs(current[i] - this.previous[i]);
      count++;
    }
    const cut = diff / count > 65;
    const pairs: { a: Point; b: Point }[] = [];
    for (let iy = 1; iy <= 4; iy++)
      for (let ix = 1; ix <= 7; ix++) {
        const x = (ix * w) / 8,
          y = (iy * h) / 5;
        if (
          Object.values(this.positions).some(
            (p) => Math.hypot(p.x * w - x, p.y * h - y) < 18,
          )
        )
          continue;
        const found = patchMatch(
          this.previous,
          current,
          w,
          h,
          x,
          y,
          x,
          y,
          20,
          3,
          3,
        );
        if (found.score > 0.78) pairs.push({ a: { x, y }, b: found });
      }
    const camera = cut
      ? { matrix: [1, 0, 0, 0, 1, 0], confidence: 0 }
      : this.fixedCamera
        ? { matrix: [1, 0, 0, 0, 1, 0], confidence: 1 }
        : robustCamera(pairs);
    if (!cut)
      this.landmarks = this.landmarks.map((l) => {
        const q = applyAffine(camera.matrix, {
          x: l.image.x * w,
          y: l.image.y * h,
        });
        return { ...l, image: { x: q.x / w, y: q.y / h } };
      });
    const map = homography(this.landmarks);
    const used = new Set<number>();
    const points = this.targets.map((t) => {
      const old = this.positions[t.id],
        prediction = applyAffine(camera.matrix, { x: old.x * w, y: old.y * h });
      const offset = Math.max(4, Math.min(12, (t.box?.h || 0.07) * h * 0.4));
      let match = cut
        ? { x: prediction.x, y: prediction.y - offset, score: 0 }
        : patchMatch(
            this.previous,
            current,
            w,
            h,
            old.x * w,
            old.y * h - offset,
            prediction.x,
            prediction.y - offset,
            15,
            4,
            6,
          );
      let x = match.x / w,
        y = (match.y + offset) / h,
        confidence = match.score;
      const near = detections
        .map((d, i) => ({ d, i, distance: Math.hypot(d.x - x, d.y - y) }))
        .filter((q) => !used.has(q.i) && q.distance < 0.055)
        .sort((a, b) => a.distance - b.distance)[0];
      if (near && !cut && (confidence < 0.8 || near.distance < 0.02)) {
        x = near.d.x;
        y = near.d.y;
        confidence = Math.max(confidence, near.d.confidence);
        used.add(near.i);
      }
      if (confidence < 0.58 || cut) {
        x = prediction.x / w;
        y = prediction.y / h;
      }
      const image = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
      this.positions[t.id] = image;
      const pitch = map ? project(map, image) : { x: -1, y: -1 };
      const review =
        cut ||
        confidence < 0.6 ||
        camera.confidence < 0.3 ||
        pitch.x < 0 ||
        pitch.x > 1 ||
        pitch.y < 0 ||
        pitch.y > 1;
      return {
        id: t.id,
        image,
        pitch,
        confidence: Math.round(confidence * 100) / 100,
        review,
      };
    });
    this.previous = current;
    this.frameCount++;
    return {
      time,
      points,
      cameraConfidence: camera.confidence,
      cut,
      map: map || undefined,
    };
  }
}
