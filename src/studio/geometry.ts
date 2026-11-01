import type { Point, Landmark, TrackFrame, TrackPoint } from "./types";
// Eight-parameter projective map. Coordinates are normalised to the source image and pitch.
export function solveLinear(
  matrix: number[][],
  values: number[],
): number[] | null {
  const n = values.length,
    a = matrix.map((row, i) => [...row, values[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < 1e-10) return null;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const div = a[c][c];
    for (let j = c; j <= n; j++) a[c][j] /= div;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const k = a[r][c];
        for (let j = c; j <= n; j++) a[r][j] -= k * a[c][j];
      }
  }
  return a.map((row) => row[n]);
}
export function homography(pairs: Landmark[]): number[] | null {
  if (pairs.length !== 4) return null;
  const a: number[][] = [],
    b: number[] = [];
  for (const {
    image: { x, y },
    pitch: { x: u, y: v },
  } of pairs) {
    a.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y],
      [0, 0, 0, x, y, 1, -v * x, -v * y],
    );
    b.push(u, v);
  }
  const h = solveLinear(a, b);
  return h ? [...h, 1] : null;
}
export function project(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-8) return { x: -10, y: -10 };
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}
export function invert3(h: number[]): number[] | null {
  const [a, b, c, d, e, f, g, k, i] = h;
  const out = [
    e * i - f * k,
    c * k - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * k - e * g,
    b * g - a * k,
    a * e - b * d,
  ];
  const det = a * out[0] + b * out[3] + c * out[6];
  return Math.abs(det) < 1e-10 ? null : out.map((v) => v / det);
}
export function sampleTracking(
  frames: TrackFrame[],
  time: number,
): TrackPoint[] {
  if (!frames.length) return [];
  const next = frames.findIndex((f) => f.time > time);
  const a = frames[Math.max(0, next < 0 ? frames.length - 1 : next - 1)],
    b = next < 0 ? a : frames[next],
    t =
      a === b
        ? 0
        : Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
  return a.points.flatMap((p) => {
    const q = b.points.find((q) => q.id === p.id);
    if(p.rejected || (t>0&&q?.rejected) || (!q&&a!==b&&t>0))return [];
    if (!q || p.review || q.review)
      return [{ ...p, review: p.review || !!q?.review }];
    return [{
      ...p,
      image: {
        x: p.image.x + (q.image.x - p.image.x) * t,
        y: p.image.y + (q.image.y - p.image.y) * t,
      },
      pitch: {
        x: p.pitch.x + (q.pitch.x - p.pitch.x) * t,
        y: p.pitch.y + (q.pitch.y - p.pitch.y) * t,
      },
      confidence: Math.min(p.confidence, q.confidence),
    }];
  });
}
export const pitchPresets: {
  id: string;
  name: string;
  points: { x: number; y: number; label: string }[];
}[] = [
  {
    id: "full",
    name: "Full pitch",
    points: [
      { x: 0, y: 0, label: "Top-left corner" },
      { x: 1, y: 0, label: "Top-right corner" },
      { x: 1, y: 1, label: "Bottom-right corner" },
      { x: 0, y: 1, label: "Bottom-left corner" },
    ],
  },
  {
    id: "leftbox",
    name: "Left penalty area",
    points: [
      { x: 0, y: 0.20353, label: "Goal line · upper box corner" },
      { x: 0.15714, y: 0.20353, label: "Penalty line · upper corner" },
      { x: 0.15714, y: 0.79647, label: "Penalty line · lower corner" },
      { x: 0, y: 0.79647, label: "Goal line · lower box corner" },
    ],
  },
  {
    id: "rightbox",
    name: "Right penalty area",
    points: [
      { x: 0.84286, y: 0.20353, label: "Penalty line · upper corner" },
      { x: 1, y: 0.20353, label: "Goal line · upper box corner" },
      { x: 1, y: 0.79647, label: "Goal line · lower box corner" },
      { x: 0.84286, y: 0.79647, label: "Penalty line · lower corner" },
    ],
  },
];
