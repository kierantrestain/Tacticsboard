import type { Board, Drawing, Side } from "../types";
export type ViewMode = "board" | "footage" | "split" | "replay";
export type CameraPreset = "broadcast" | "overhead" | "endline" | "touchline";
export interface Point {
  x: number;
  y: number;
}
export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "image";
  mime: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
  createdAt: string;
  thumbnail: string;
  filmstrip?: string[];
  sourceAssetId?: string;
  sourceTime?: number;
}
export interface MediaInk extends Drawing {
  space?: "screen" | "pitch";
  from: number;
  to: number;
  assetId: string;
}
export interface Landmark {
  image: Point;
  pitch: Point;
  label: string;
}
export interface TrackedTarget {
  cutout?: string;
  id: string;
  name: string;
  side: Side;
  number: string;
  playerId?: string;
  image: Point;
  box?: { w: number; h: number };
  color?: string;
  confidence?: number;
}
export interface TrackPoint {
  id: string;
  image: Point;
  pitch: Point;
  confidence: number;
  review: boolean;
  manual?: boolean;
}
export interface TrackFrame {
  time: number;
  points: TrackPoint[];
  cameraConfidence: number;
  cut?: boolean;
  map?: number[];
}
export interface TrackingSequence {
  assetId: string;
  start: number;
  end: number;
  frames: TrackFrame[];
  targets: TrackedTarget[];
  reviewed: boolean;
  createdAt: string;
  method: string;
}
export interface Bookmark {
  id: string;
  assetId: string;
  time: number;
  title: string;
  note: string;
}
export interface StudioDocument {
  version: 2;
  view?: ViewMode;
  assetId?: string;
  trim: { start: number; end: number };
  fps: number;
  ink: Record<string, MediaInk[]>;
  bookmarks: Bookmark[];
  landmarks: Record<string, Landmark[]>;
  targets: Record<string, TrackedTarget[]>;
  tracking: Record<string, TrackingSequence>;
  showTracking: boolean;
  useSourceCutouts?: boolean;
  showTrails: boolean;
  lowerThird: string;
}
export interface ProgramSnapshot {
  id: string;
  board: Board;
  view: ViewMode;
  camera: CameraPreset;
  time: number;
  playing: boolean;
  rate: number;
  takenAt: number;
  black: boolean;
}
export interface SourceHandle {
  capture: () => HTMLCanvasElement | null;
  composite: () => HTMLCanvasElement | null;
  seek: (time: number) => Promise<void>;
  element: () => HTMLVideoElement | HTMLImageElement | null;
}
export const emptyStudio = (): StudioDocument => ({
  version: 2,
  trim: { start: 0, end: 20 },
  fps: 25,
  ink: {},
  bookmarks: [],
  landmarks: {},
  targets: {},
  tracking: {},
  showTracking: true,
  showTrails: false,
  lowerThird: "",
});
export function isStudioDocument(v: unknown): v is StudioDocument {
  if (!v || typeof v !== "object") return false;
  const d = v as StudioDocument;
  const record = (x: unknown) =>
    !!x && typeof x === "object" && !Array.isArray(x);
  return (
    d.version === 2 &&
    (d.view === undefined ||
      ["board", "footage", "split", "replay"].includes(d.view)) &&
    !!d.trim &&
    Number.isFinite(d.trim.start) &&
    Number.isFinite(d.trim.end) &&
    d.trim.start >= 0 &&
    d.trim.end >= d.trim.start &&
    [24, 25, 30, 50, 60].includes(d.fps) &&
    record(d.ink) &&
    record(d.landmarks) &&
    record(d.targets) &&
    record(d.tracking) &&
    Array.isArray(d.bookmarks) &&
    d.bookmarks.length <= 500 &&
    typeof d.lowerThird === "string" &&
    typeof d.showTracking === "boolean" &&
    typeof d.showTrails === "boolean" &&
    Object.values(d.ink).every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 1000 &&
        a.every(
          (x) =>
            !!x &&
            Array.isArray(x.points) &&
            x.points.length <= 20000 &&
            x.points.every(Number.isFinite) &&
            typeof x.id === "string" &&
            typeof x.color === "string" &&
            Number.isFinite(x.from) &&
            Number.isFinite(x.to),
        ),
    ) &&
    Object.values(d.landmarks).every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 4 &&
        a.every(
          (l) =>
            !!l?.image &&
            !!l?.pitch &&
            [l.image.x, l.image.y, l.pitch.x, l.pitch.y].every(Number.isFinite),
        ),
    ) &&
    Object.values(d.targets).every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 44 &&
        a.every(
          (t) =>
            typeof t.id === "string" &&
            typeof t.name === "string" &&
            ["home", "away"].includes(t.side) &&
            [t.image?.x, t.image?.y].every(Number.isFinite) &&
            (t.cutout === undefined ||
              (typeof t.cutout === "string" &&
                t.cutout.length <= 500000 &&
                /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(t.cutout))),
        ),
    ) &&
    Object.values(d.tracking).every(
      (t) =>
        Array.isArray(t.frames) &&
        t.frames.length <= 1000 &&
        Array.isArray(t.targets) &&
        t.frames.every(
          (f) =>
            Number.isFinite(f.time) &&
            Array.isArray(f.points) &&
            f.points.length <= 44 &&
            f.points.every((p) =>
              [
                p.image?.x,
                p.image?.y,
                p.pitch?.x,
                p.pitch?.y,
                p.confidence,
              ].every(Number.isFinite),
            ),
        ),
    )
  );
}
export const timecode = (seconds: number, fps = 25) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}:${String(Math.floor((s % 1) * fps)).padStart(2, "0")}`;
};
