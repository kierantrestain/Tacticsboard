import type { Board, Drawing, Frame, Side, MatchDetails } from "../types";
export type ViewMode = "board" | "footage" | "split" | "replay" | "stats";
export type MatchStats = Pick<
  MatchDetails,
  "id" | "lineups" | "teamStats" | "updatedAt" | "sourceUrl"
>;
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
export interface BroadcastStyle {
  channel: string;
  programme: string;
  accent: string;
  headline: string;
  subtitle: string;
  showHeader: boolean;
  showLowerThird: boolean;
  showScore: boolean;
}
export const defaultBroadcast = (): BroadcastStyle => ({
  channel: "BANG ON",
  programme: "SPORTS",
  accent: "#c5f06a",
  headline: "",
  subtitle: "FOOTBALL ANALYSIS",
  showHeader: true,
  showLowerThird: true,
  showScore: true,
});
/** A cue holds a frame, never a nested Board/StudioDocument. */
export interface RundownCue {
  sceneId?: string;
  statsReportId?: string;
  statsPlayerId?: string;
  context?: Board["context"];
  homeTeamId?: string;
  awayTeamId?: string;
  competition?: string;
  match?: Board["match"];
  id: string;
  title: string;
  note: string;
  duration: number;
  view: ViewMode;
  camera: CameraPreset;
  time: number;
  frame: Frame;
  settings: Board["settings"];
  colors: Board["colors"];
  formations: Board["formations"];
  assetId?: string;
  trim: { start: number; end: number };
  ink: MediaInk[];
  lowerThird: string;
}
export interface StudioDocument {
  dataReports?: Record<string, MatchStats>;
  statsReportId?: string;
  statsPlayerId?: string;
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
  broadcast?: BroadcastStyle;
  cues?: RundownCue[];
}
export interface ProgramSnapshot {
  report?: MatchStats;
  id: string;
  board: Board;
  view: ViewMode;
  camera: CameraPreset;
  time: number;
  playing: boolean;
  rate: number;
  takenAt: number;
  black: boolean;
  teams?: { home: string; away: string };
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
      ["board", "footage", "split", "replay", "stats"].includes(d.view)) &&
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
    (d.statsReportId === undefined || typeof d.statsReportId === "string") &&
    (d.statsPlayerId === undefined || typeof d.statsPlayerId === "string") &&
    (d.dataReports === undefined ||
      (record(d.dataReports) &&
        Object.keys(d.dataReports).length <= 100 &&
        Object.values(d.dataReports).every(
          (report) =>
            !!report &&
            typeof report.id === "string" &&
            Array.isArray(report.lineups) &&
            report.lineups.length <= 2 &&
            report.lineups.every(
              (line) =>
                !!line &&
                typeof line.teamId === "string" &&
                Array.isArray(line.players) &&
                line.players.length <= 44 &&
                line.players.every(
                  (p) =>
                    !!p &&
                    typeof p.id === "string" &&
                    typeof p.name === "string" &&
                    typeof p.starter === "boolean" &&
                    (!p.stats ||
                      (record(p.stats) &&
                        Object.keys(p.stats).length <= 200 &&
                        Object.values(p.stats).every(
                          (v) => !!v && typeof v.label === "string",
                        ))),
                ),
            ) &&
            Array.isArray(report.teamStats) &&
            report.teamStats.length <= 2 &&
            report.teamStats.every(
              (t) =>
                !!t &&
                typeof t.teamId === "string" &&
                record(t.stats) &&
                Object.keys(t.stats).length <= 200 &&
                Object.values(t.stats).every(
                  (v) =>
                    !!v &&
                    typeof v.display === "string" &&
                    typeof v.label === "string",
                ),
            ),
        ))) &&
    Array.isArray(d.bookmarks) &&
    d.bookmarks.length <= 500 &&
    typeof d.lowerThird === "string" &&
    typeof d.showTracking === "boolean" &&
    typeof d.showTrails === "boolean" &&
    (d.broadcast === undefined ||
      (!!d.broadcast &&
        typeof d.broadcast.channel === "string" &&
        d.broadcast.channel.length <= 40 &&
        typeof d.broadcast.programme === "string" &&
        d.broadcast.programme.length <= 40 &&
        typeof d.broadcast.headline === "string" &&
        d.broadcast.headline.length <= 120 &&
        typeof d.broadcast.subtitle === "string" &&
        d.broadcast.subtitle.length <= 100 &&
        /^#[0-9a-f]{6}$/i.test(d.broadcast.accent) &&
        [
          d.broadcast.showHeader,
          d.broadcast.showLowerThird,
          d.broadcast.showScore,
        ].every((x) => typeof x === "boolean"))) &&
    (d.cues === undefined ||
      (Array.isArray(d.cues) &&
        d.cues.length <= 80 &&
        new Set(d.cues.map((c) => c?.id)).size === d.cues.length &&
        d.cues.every((c) => {
          const point = (p: { x: number; y: number }) =>
            !!p &&
            [p.x, p.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
          return (
            !!c &&
            (c.sceneId === undefined || typeof c.sceneId === "string") &&
            (c.statsReportId === undefined ||
              typeof c.statsReportId === "string") &&
            (c.statsPlayerId === undefined ||
              typeof c.statsPlayerId === "string") &&
            (c.context === undefined ||
              (record(c.context) &&
                ["home", "away"].every((side) => {
                  const t = c.context?.[side as Side];
                  return (
                    !!t &&
                    typeof t.id === "string" &&
                    typeof t.name === "string" &&
                    typeof t.shortName === "string" &&
                    typeof t.abbreviation === "string" &&
                    typeof t.color === "string" &&
                    typeof t.alternateColor === "string" &&
                    Array.isArray(t.competitions) &&
                    t.competitions.every((l) => typeof l === "string")
                  );
                }))) &&
            (c.homeTeamId === undefined || typeof c.homeTeamId === "string") &&
            (c.awayTeamId === undefined || typeof c.awayTeamId === "string") &&
            (c.competition === undefined ||
              typeof c.competition === "string") &&
            typeof c.id === "string" &&
            typeof c.title === "string" &&
            c.title.length <= 80 &&
            typeof c.note === "string" &&
            c.note.length <= 4000 &&
            typeof c.lowerThird === "string" &&
            ["board", "footage", "split", "replay", "stats"].includes(c.view) &&
            ["broadcast", "overhead", "endline", "touchline"].includes(
              c.camera,
            ) &&
            Number.isFinite(c.time) &&
            c.time >= 0 &&
            Number.isFinite(c.duration) &&
            c.duration >= 1 &&
            c.duration <= 600 &&
            (c.assetId === undefined || typeof c.assetId === "string") &&
            !!c.trim &&
            Number.isFinite(c.trim.start) &&
            Number.isFinite(c.trim.end) &&
            c.trim.start >= 0 &&
            c.trim.end >= c.trim.start &&
            !!c.frame &&
            point(c.frame.ball) &&
            Array.isArray(c.frame.players) &&
            c.frame.players.length <= 44 &&
            new Set(c.frame.players.map((p) => p?.uid)).size ===
              c.frame.players.length &&
            c.frame.players.every(
              (p) =>
                point(p) &&
                typeof p.uid === "string" &&
                typeof p.playerId === "string" &&
                typeof p.name === "string" &&
                typeof p.number === "string" &&
                ["home", "away"].includes(p.side),
            ) &&
            Array.isArray(c.frame.drawings) &&
            c.frame.drawings.length <= 500 &&
            c.frame.drawings.every(
              (i) =>
                !!i &&
                typeof i.id === "string" &&
                typeof i.color === "string" &&
                Number.isFinite(i.width) &&
                Number.isFinite(i.opacity) &&
                Array.isArray(i.points) &&
                i.points.length <= 20000 &&
                i.points.every(Number.isFinite),
            ) &&
            !!c.settings &&
            ["studio", "grass", "light"].includes(c.settings.theme) &&
            ["top", "angle"].includes(c.settings.camera) &&
            ["full", "left", "right"].includes(c.settings.view) &&
            ["disc", "shirt"].includes(c.settings.tokenStyle) &&
            !!c.colors &&
            /^#[0-9a-f]{3,8}$/i.test(c.colors.home) &&
            /^#[0-9a-f]{3,8}$/i.test(c.colors.away) &&
            !!c.formations &&
            typeof c.formations.home === "string" &&
            typeof c.formations.away === "string" &&
            Array.isArray(c.ink) &&
            c.ink.length <= 1000 &&
            c.ink.every(
              (i) =>
                !!i &&
                typeof i.id === "string" &&
                Array.isArray(i.points) &&
                i.points.length <= 20000 &&
                i.points.every(Number.isFinite) &&
                Number.isFinite(i.from) &&
                Number.isFinite(i.to),
            )
          );
        }))) &&
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
