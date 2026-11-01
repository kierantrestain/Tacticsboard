import type { Drawing } from "../types";
import type { MediaInk } from "./types";
import { curvedPoints } from './mediaModel';
import { invert3, project } from "./geometry";
export function expandedPoints(d: Drawing): number[] {
  const p = curvedPoints(d);
  if (p.length !== 4) return p;
  if (d.type === "zone")
    return [p[0], p[1], p[2], p[1], p[2], p[3], p[0], p[3]];
  if (d.type === "ellipse" || d.type === "spotlight") {
    const out: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      out.push(
        (p[0] + p[2]) / 2 + (Math.cos(t) * Math.abs(p[2] - p[0])) / 2,
        (p[1] + p[3]) / 2 + (Math.sin(t) * Math.abs(p[3] - p[1])) / 2,
      );
    }
    return out;
  }
  return p;
}
export function transformInk(points: number[], map: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const p = project(map, { x: points[i], y: points[i + 1] });
    out.push(p.x, p.y);
  }
  return out;
}
export function imageInk(
  d: MediaInk,
  map: number[] | undefined,
): MediaInk | null {
  if (d.space !== "pitch") return d;
  if (!map) return null;
  const inverse = invert3(map);
  if (!inverse) return null;
  return { ...d, points: transformInk(expandedPoints(d), inverse) };
}
