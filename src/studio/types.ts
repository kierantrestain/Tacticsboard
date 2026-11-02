import type { Board, Drawing, Frame, Side, MatchDetails, Scene } from "../types";
import { isFootballAction } from "./footballActionTypes";
import { isReportRecreation } from "../football/recreationTypes";
import type { ReportRecreation } from "../football/recreationTypes";
import type { ExplainStop } from './filmPlan';
import { validComparison, type ComparisonSnapshot } from '../football/comparisonModel';
import { validBall } from './possession';
import { validMotion } from './motion';
import { validPresentation, validCameraPose, validGraphicExtras } from './mediaModel';
import type { SourcePresentation, CameraPose } from './mediaModel';
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
  matchId?: string;
  matchLabel?: string;
  segment?: string;
  notes?: string;
  tags?: string[];
  referenceTime?: number;
  fingerprint?: string;
  revision?: number;
  measuredFps?: number;
  timing?: 'estimated' | 'packet-average';
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
  rejected?: boolean;
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
  presenterNotes?: { host1?: string; host2?: string; producer?: string };
  landmarks?: Landmark[];
  targets?: TrackedTarget[];
  phaseTime?: number;
  sourcePresentation?: SourcePresentation;
  comparisonView?: '2d' | '3d';
  cameraPose?: CameraPose;
  playbackRate?: number;
  segmentId?: string;
  segmentTitle?: string;
  comparison?: ComparisonSnapshot;
  statsScroll?: number;
  recreation?: ReportRecreation;
  sequence?: Scene[];
  explainStops?: ExplainStop[];
  tracking?: TrackingSequence;
  broadcast?: BroadcastStyle;
  report?: MatchStats;
  statsFields?: string[];
  thumbnail?: string;
  reviewedAt?: number;
  sceneId?: string;
  statsReportId?: string;
  statsPlayerId?: string;
  statsComparePlayerId?: string;
  statsLayout?: "comparison" | "tiles";
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
  resume?: {view:ViewMode;time:number;phaseTime:number|null;cueId?:string|null};
  resourceIds?:string[];
  sourcePresentations?: Record<string, SourcePresentation>;
  comparisonView?: '2d' | '3d';
  cameraPose?: CameraPose;
  playbackRate?: number;
  stillOrder?: string[];
  comparison?: ComparisonSnapshot;
  statsScroll?: number;
  explainStops?: Record<string, ExplainStop[]>;
  statsSnapshot?: MatchStats;
  statsFields?: string[];
  sourceRanges?: Record<string, { start: number; end: number }>;
  dataReports?: Record<string, MatchStats>;
  statsReportId?: string;
  statsPlayerId?: string;
  statsComparePlayerId?: string;
  statsLayout?: "comparison" | "tiles";
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
  assetRevision?:number;
  phaseTime?: number | null;
  cueId?: string;
  title?: string;
  thumbnail?: string;
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
  step?: (direction: number) => Promise<{time:number;exact:boolean}>;
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
    (d.resume===undefined||!!d.resume&&['board','footage','split','replay','stats'].includes(d.resume.view)&&Number.isFinite(d.resume.time)&&d.resume.time>=0&&d.resume.time<=1000000&&(d.resume.phaseTime===null||Number.isFinite(d.resume.phaseTime)&&d.resume.phaseTime>=0&&d.resume.phaseTime<=6000)&&(d.resume.cueId==null||typeof d.resume.cueId==='string'&&d.resume.cueId.length<=100)) &&
    (d.resourceIds===undefined||Array.isArray(d.resourceIds)&&d.resourceIds.length<=500&&d.resourceIds.every(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,150}$/.test(id))) &&
    (d.sourcePresentations === undefined || record(d.sourcePresentations) && Object.keys(d.sourcePresentations).length<=500 && Object.values(d.sourcePresentations).every(validPresentation)) &&
    (d.comparisonView === undefined || ['2d','3d'].includes(d.comparisonView)) &&
    (d.cameraPose === undefined || validCameraPose(d.cameraPose)) &&
    (d.playbackRate === undefined || [.25,.5,1,1.5,2].includes(d.playbackRate)) &&
    (d.stillOrder === undefined || Array.isArray(d.stillOrder)&&d.stillOrder.length<=20&&d.stillOrder.every(id=>typeof id==='string')&&new Set(d.stillOrder).size===d.stillOrder.length) &&
    (d.comparison === undefined || validComparison(d.comparison)) &&
    (d.statsScroll === undefined || Number.isFinite(d.statsScroll) && d.statsScroll >= 0 && d.statsScroll <= 1500) &&
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
    (d.explainStops === undefined || (record(d.explainStops) && Object.values(d.explainStops).every(validStops))) &&
    (d.statsFields === undefined || validFields(d.statsFields)) &&
    (d.statsSnapshot === undefined ||
      isStudioDocument({
        ...emptyStudio(),
        dataReports: { snapshot: d.statsSnapshot },
      })) &&
    (d.sourceRanges === undefined ||
      (record(d.sourceRanges) &&
        Object.keys(d.sourceRanges).length <= 500 &&
        Object.values(d.sourceRanges).every(
          (r) =>
            !!r &&
            Number.isFinite(r.start) &&
            Number.isFinite(r.end) &&
            r.start >= 0 &&
            r.end >= r.start,
        ))) &&
    (d.statsReportId === undefined || typeof d.statsReportId === "string") &&
    (d.statsPlayerId === undefined || typeof d.statsPlayerId === "string") &&
    (d.statsComparePlayerId === undefined || typeof d.statsComparePlayerId === "string") &&
    (d.statsLayout === undefined || ["comparison", "tiles"].includes(d.statsLayout)) &&
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
            (c.landmarks===undefined||validCalibration(c.landmarks)) &&
            (c.targets===undefined||validTargets(c.targets)) &&
            (c.phaseTime===undefined||Number.isFinite(c.phaseTime)&&c.phaseTime>=0&&c.phaseTime<=6000) &&
            (c.sourcePresentation === undefined || validPresentation(c.sourcePresentation)) &&
            (c.comparisonView === undefined || ['2d','3d'].includes(c.comparisonView)) &&
            (c.cameraPose === undefined || validCameraPose(c.cameraPose)) &&
            (c.playbackRate === undefined || [.25,.5,1,1.5,2].includes(c.playbackRate)) &&
            (c.segmentId === undefined || typeof c.segmentId==='string'&&c.segmentId.length<=100) &&
            (c.segmentTitle === undefined || typeof c.segmentTitle==='string'&&c.segmentTitle.length<=120) &&
            (c.comparison === undefined || validComparison(c.comparison)) &&
            (c.statsScroll === undefined || Number.isFinite(c.statsScroll) && c.statsScroll >= 0 && c.statsScroll <= 1500) &&
            (c.recreation === undefined || isReportRecreation(c.recreation)) &&
            (c.explainStops === undefined || validStops(c.explainStops)) &&
            (c.sequence === undefined || (Array.isArray(c.sequence) && c.sequence.length > 0 && c.sequence.length <= 100 && new Set(c.sequence.map(s=>s.id)).size === c.sequence.length && c.sequence.every(s => (s.ballAction === undefined || isFootballAction(s.ballAction)) && typeof s.id === 'string' && typeof s.title === 'string' && s.title.length <= 120 && typeof s.note === 'string' && Number.isFinite(s.duration) && s.duration >= .25 && s.duration <= 60 && point(s.ball) && Array.isArray(s.players) && s.players.length <= 44 && new Set(s.players.map(p=>p.uid)).size === s.players.length && validBall(s.ball,s.players) && validMotion(s) && s.players.every(p=>point(p) && typeof p.uid === 'string' && typeof p.name === 'string' && typeof p.number === 'string' && typeof p.playerId === 'string' && ['home','away'].includes(p.side)) && Array.isArray(s.drawings) && s.drawings.length <= 500 && s.drawings.every(i=>i && typeof i.id === 'string' && typeof i.color === 'string' && Number.isFinite(i.width) && Number.isFinite(i.opacity) && Array.isArray(i.points) && i.points.length <= 20000 && i.points.every(Number.isFinite))))) &&
            (c.tracking === undefined ||
              isStudioDocument({
                ...emptyStudio(),
                tracking: { snapshot: c.tracking },
              })) &&
            (c.broadcast === undefined ||
              isStudioDocument({ ...emptyStudio(), broadcast: c.broadcast })) &&
            (c.report === undefined ||
              isStudioDocument({
                ...emptyStudio(),
                dataReports: { snapshot: c.report },
              })) &&
            (c.statsFields === undefined || validFields(c.statsFields)) &&
            (c.statsComparePlayerId === undefined || typeof c.statsComparePlayerId === "string") &&
            (c.statsLayout === undefined || ["comparison", "tiles"].includes(c.statsLayout)) &&
            (c.thumbnail === undefined ||
              (typeof c.thumbnail === "string" &&
                c.thumbnail.length < 200000 &&
                /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
                  c.thumbnail,
                ))) &&
            (c.reviewedAt === undefined ||
              (Number.isFinite(c.reviewedAt) && c.reviewedAt > 0)) &&
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
            (c.presenterNotes === undefined || (typeof c.presenterNotes === "object" && c.presenterNotes !== null && Object.entries(c.presenterNotes).every(([key,value]) => ["host1","host2","producer"].includes(key) && typeof value === "string" && value.length <= 4000))) &&
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
            c.frame.players.length <= 44 && validBall(c.frame.ball,c.frame.players) &&
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
                validGraphicExtras(i) &&
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
            validGraphicExtras(x) &&
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

function validFields(fields: unknown): fields is string[] {
  return (
    Array.isArray(fields) &&
    fields.length <= 1500 &&
    fields.every((f) => typeof f === "string" && f.length < 100) &&
    new Set(fields).size === fields.length
  );
}
function validStops(stops: unknown): stops is ExplainStop[] { return Array.isArray(stops) && stops.length <= 20 && new Set(stops.map(s=>s?.id)).size === stops.length && stops.every(s=>s && typeof s.id === 'string' && Number.isFinite(s.time) && s.time >= 0 && Number.isFinite(s.hold) && s.hold >= .5 && s.hold <= 10); }
function validCalibration(v:unknown):v is Landmark[] {return Array.isArray(v)&&v.length<=4&&v.every(l=>l&&[l.image?.x,l.image?.y,l.pitch?.x,l.pitch?.y].every(Number.isFinite));}
function validTargets(v:unknown):v is TrackedTarget[] {return Array.isArray(v)&&v.length<=44&&v.every(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&['home','away'].includes(t.side)&&[t.image?.x,t.image?.y].every(Number.isFinite)&&(t.cutout===undefined||typeof t.cutout==='string'&&t.cutout.length<=500000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(t.cutout)));}
