import type { Board, Drawing } from "../types";
import type { MediaAsset, MediaInk, StudioDocument } from "./types";
import { copy, uid } from "../core";

export interface SourcePresentation {
  original: boolean;
  annotations: boolean;
  rotation: 0 | 90 | 180 | 270;
  crop: { x: number; y: number; width: number; height: number };
  brightness: number;
  contrast: number;
}
export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}
export const defaultPresentation = (): SourcePresentation => ({
  original: false,
  annotations: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  brightness: 1,
  contrast: 1,
});
export function validPresentation(v: unknown): v is SourcePresentation {
  const p = v as SourcePresentation,
    c = p?.crop;
  return (
    !!p &&
    typeof p.original === "boolean" &&
    typeof p.annotations === "boolean" &&
    [0, 90, 180, 270].includes(p.rotation) &&
    [p.brightness, p.contrast].every(
      (n) => Number.isFinite(n) && n >= 0.25 && n <= 2,
    ) &&
    !!c &&
    [c.x, c.y, c.width, c.height].every(Number.isFinite) &&
    c.x >= 0 &&
    c.y >= 0 &&
    c.width >= 0.1 &&
    c.height >= 0.1 &&
    c.x + c.width <= 1.000001 &&
    c.y + c.height <= 1.000001
  );
}
export function validCameraPose(v: unknown): v is CameraPose {
  const p = v as CameraPose;
  return (
    !!p &&
    [p.position, p.target].every(
      (a) =>
        Array.isArray(a) &&
        a.length === 3 &&
        a.every((n) => Number.isFinite(n) && Math.abs(n) <= 400),
    ) &&
    p.position.some((n, i) => Math.abs(n - p.target[i]) > 0.01) &&
    Number.isFinite(p.fov) &&
    p.fov >= 15 &&
    p.fov <= 90
  );
}
export function validGraphicExtras(d: Drawing) {
  return (
    (d.hidden === undefined || typeof d.hidden === "boolean") &&
    (d.curve === undefined ||
      (Number.isFinite(d.curve) && Math.abs(d.curve) <= 1)) &&
    (d.textScale === undefined ||
      (Number.isFinite(d.textScale) && d.textScale >= 0.5 && d.textScale <= 3))
  );
}
export function validMediaMetadata(a: MediaAsset) {
  return (
    [a.matchId, a.matchLabel, a.segment, a.notes].every(
      (v) => v === undefined || (typeof v === "string" && v.length <= 4000),
    ) &&
    (a.tags === undefined ||
      (Array.isArray(a.tags) &&
        a.tags.length <= 12 &&
        a.tags.every((t) => typeof t === "string" && t.length <= 300))) &&
    [a.referenceTime, a.sourceTime].every(
      (v) => v === undefined || (Number.isFinite(v) && v >= 0 && v <= 1000000),
    ) &&
    (a.revision === undefined ||
      (Number.isInteger(a.revision) && a.revision >= 0)) &&
    (a.measuredFps === undefined ||
      (Number.isFinite(a.measuredFps) &&
        a.measuredFps > 0 &&
        a.measuredFps <= 1000))
  );
}
/** Coordinates always refer to the original source, including after crop/rotation. */
export function sourceGeometry(
  width: number,
  height: number,
  p: SourcePresentation,
) {
  const c = p.original ? defaultPresentation().crop : p.crop,
    rotation = p.original ? 0 : p.rotation,
    cw = width * c.width,
    ch = height * c.height;
  return {
    width: rotation % 180 ? ch : cw,
    height: rotation % 180 ? cw : ch,
    rotation,
    offsetX: width * c.x,
    offsetY: height * c.y,
    x: rotation === 90 ? ch : rotation === 180 ? cw : 0,
    y: rotation === 180 ? ch : rotation === 270 ? cw : 0,
    crop: c,
  };
}
export const MAX_SOURCE_BYTES = 2 * 1024 ** 3;
export const MAX_ANALYSIS_SECONDS = 60;
export const MAX_TRACKING_SECONDS = 20;
/** Project packs replace the draft; do not silently mix them into source batches. */
export function importSelection(files: { name: string }[]) {
  const projects = files.filter((f) => /\.(zip|json)$/i.test(f.name));
  if (projects.length && files.length !== 1)
    throw Error(
      "Open one project pack or JSON at a time. Import source media separately.",
    );
  return projects.length ? "project" : "media";
}
export function mediaKind(file: {
  name: string;
  type: string;
}): MediaAsset["type"] | null {
  return /^image\//.test(file.type) ||
    /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(file.name)
    ? "image"
    : /^video\//.test(file.type) || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name)
      ? "video"
      : null;
}
export function validateSourceFile(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!mediaKind(file))
    throw Error("Choose a browser-supported picture, MP4, MOV or WebM.");
  if (!file.size) throw Error("This file is empty.");
  if (file.size > MAX_SOURCE_BYTES)
    throw Error(
      "Choose a source under 2 GB. Keep larger recordings in your media editor and export the relevant passage.",
    );
}
export function analysisRange(start: number, end: number, duration: number) {
  if (
    ![start, end, duration].every(Number.isFinite) ||
    duration <= 0 ||
    start < 0 ||
    end > duration + 0.001 ||
    end - start < 0.04 ||
    end - start > MAX_ANALYSIS_SECONDS + 0.001
  )
    throw Error(
      "Choose a passage between one frame and 60 seconds inside the source.",
    );
  return { start, end };
}
export function visibleMediaInk(
  ink: MediaInk[],
  time: number,
  p: SourcePresentation,
) {
  return p.original || !p.annotations
    ? []
    : ink.filter(
        (i) => !i.hidden && time >= i.from - 0.03 && time <= i.to + 0.03,
      );
}
export function curvedPoints(d: Drawing): number[] {
  if (!d.curve || d.points.length !== 4 || !["arrow", "run"].includes(d.type))
    return d.points;
  const [x, y, tx, ty] = d.points,
    cx = (x + tx) / 2 - (ty - y) * d.curve,
    cy = (y + ty) / 2 + (tx - x) * d.curve;
  return Array.from({ length: 33 }, (_, i) => {
    const t = i / 32,
      u = 1 - t;
    return [
      u * u * x + 2 * u * t * cx + t * t * tx,
      u * u * y + 2 * u * t * cy + t * t * ty,
    ];
  }).flat();
}
export function sourceReferences(board: Board, id: string) {
  const d = board.studio;
  return {
    cues:
      d?.cues?.filter(
        (c) =>
          c.assetId === id || c.sequence?.some((s) => s.source?.assetId === id),
      ) || [],
    scenes: board.scenes.filter((s) => s.source?.assetId === id),
    active: d?.assetId === id,
  };
}
export function validateReplacement(
  board: Board,
  old: MediaAsset,
  next: MediaAsset,
) {
  if (
    old.type !== next.type ||
    old.width !== next.width ||
    old.height !== next.height
  )
    throw Error(
      "Use the same source type and dimensions to preserve annotation alignment. Import a different shot as a new source.",
    );
  const d = board.studio;
  const ends = [
    d?.sourceRanges?.[old.id]?.end || 0,
    d?.assetId === old.id ? d.trim.end : 0,
    ...(d?.cues || [])
      .filter((c) => c.assetId === old.id)
      .map((c) => Math.max(c.time, c.trim.end)),
    ...board.scenes
      .filter((s) => s.source?.assetId === old.id)
      .map((s) => s.source!.time),
  ];
  if (next.type === "video" && next.duration + 0.05 < Math.max(...ends))
    throw Error(
      "The replacement ends before a saved analysis. Choose the complete original source.",
    );
}
export function invalidateSourceReview(board: Board, id: string) {
  const d = board.studio;
  if (!d) return;
  if (d.tracking[id]) d.tracking[id].reviewed = false;
  for (const c of d.cues || [])
    if (c.assetId === id) {
      c.reviewedAt = undefined;
      if (c.tracking) c.tracking.reviewed = false;
    }
}
export function duplicateSourceState(
  d: StudioDocument,
  from: string,
  to: string,
) {
  for (const key of [
    "ink",
    "targets",
    "landmarks",
    "tracking",
    "sourceRanges",
    "explainStops",
    "sourcePresentations",
  ] as const) {
    const source = d[key]?.[from];
    if (source === undefined) continue;
    ((d[key] as Record<string, unknown>) || ((d as any)[key] = {}))[to] =
      copy(source);
  }
  for (const ink of d.ink[to] || []) {
    ink.id = uid();
    ink.assetId = to;
  }
  if (d.tracking[to]) d.tracking[to].assetId = to;
}
export function clipCue(
  board: Board,
  asset: MediaAsset,
  range: { start: number; end: number },
  time: number,
  mode: "duplicate" | "split",
) {
  analysisRange(range.start, range.end, asset.duration);
  if (
    mode === "split" &&
    (time - range.start < 0.04 || range.end - time < 0.04)
  )
    throw Error("Place the playhead inside the clip before splitting.");
  if ((board.studio?.cues?.length || 0) + (mode === "split" ? 2 : 1) > 80)
    throw Error("This rundown is full.");
  return mode === "split"
    ? [
        { start: range.start, end: time },
        { start: time, end: range.end },
      ]
    : [{ ...range }];
}
