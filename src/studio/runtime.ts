import { create } from "zustand";
import type {
  MediaAsset,
  Point,
  ViewMode,
  CameraPreset,
  ProgramSnapshot,
} from "./types";
import { emptyStudio } from "./types";
import { useStudio } from "../store";
interface Runtime {
  view: ViewMode;
  camera: CameraPreset;
  assets: MediaAsset[];
  time: number;
  mediaPlaying: boolean;
  rate: number;
  muted: boolean;
  loopClip: boolean;
  zoom: number;
  pan: Point;
  panMode: boolean;
  sidebar:
    | "inspector"
    | "media"
    | "reconstruct"
    | "layers"
    | "rundown"
    | "tactics"
    | "broadcast"
    | "show";
  activeCueId: string | null;
  compactTimeline: boolean;
  outputConnected: boolean;
  outputAck: { id: string; black: boolean; thumbnail?: string } | null;
  assetAvailability: Record<string, boolean>;
  cueClock: { startedAt: number | null; elapsed: number };
  modal: "export" | "projects" | "shortcuts" | "commands" | null;
  presenter: boolean;
  follow: boolean;
  program: ProgramSnapshot | null;
  selectedInk: string | null;
  markMode: "none" | "landmark" | "target" | "eyedropper";
  landmarkPitch: Point;
  landmarkLabel: string;
  targetSide: "home" | "away";
  progress: number;
  busy: string;
  error: string;
  online: boolean;
  set: (v: Partial<Runtime>) => void;
}
export const useRuntime = create<Runtime>((set) => ({
  view: "board",
  camera: "broadcast",
  assets: [],
  time: 0,
  mediaPlaying: false,
  rate: 1,
  muted: true,
  loopClip: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  panMode: false,
  sidebar: "rundown",
  activeCueId: null,
  compactTimeline: true,
  outputConnected: false,
  outputAck: null,
  assetAvailability: {},
  cueClock: { startedAt: null, elapsed: 0 },
  modal: null,
  presenter: false,
  follow: false,
  program: null,
  selectedInk: null,
  markMode: "none",
  landmarkPitch: { x: 0, y: 0 },
  landmarkLabel: "Corner 1",
  targetSide: "home",
  progress: 0,
  busy: "",
  error: "",
  online: navigator.onLine,
  set,
}));
export function editDesk(fn: (d: ReturnType<typeof emptyStudio>) => void) {
  useStudio.getState().commit((b) => {
    b.studio ||= emptyStudio();
    const beforeLandmarks = JSON.stringify(b.studio.landmarks);
    const beforeTargets = JSON.stringify(b.studio.targets);
    fn(b.studio);
    if (
      JSON.stringify(b.studio.landmarks) !== beforeLandmarks ||
      JSON.stringify(b.studio.targets) !== beforeTargets
    ) {
      const marks = JSON.parse(beforeLandmarks),
        targets = JSON.parse(beforeTargets);
      for (const [id, sequence] of Object.entries(b.studio.tracking)) {
        if (
          JSON.stringify(marks[id]) !==
            JSON.stringify(b.studio.landmarks[id]) ||
          JSON.stringify(targets[id]) !== JSON.stringify(b.studio.targets[id])
        )
          sequence.reviewed = false;
      }
    }
    if (b.studio.assetId)
      (b.studio.sourceRanges ||= {})[b.studio.assetId] = { ...b.studio.trim };
  });
}
export function getDesk() {
  return useStudio.getState().board?.studio || emptyStudio();
}
export function selectAsset(asset: MediaAsset) {
  editDesk((d) => {
    if (d.assetId) (d.sourceRanges ||= {})[d.assetId] = { ...d.trim };
    d.assetId = asset.id;
    d.view = "footage";
    d.trim = d.sourceRanges?.[asset.id] || {
      start: 0,
      end: Math.min(20, asset.duration || 20),
    };
    d.fps = asset.fps;
  });
  useRuntime.setState({
    view: "footage",
    time: getDesk().trim.start,
    mediaPlaying: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedInk: null,
    sidebar: "media",
  });
}
