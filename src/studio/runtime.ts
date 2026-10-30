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
    | "broadcast";
  activeCueId: string | null;
  compactTimeline: boolean;
  outputConnected: boolean;
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
  sidebar: "inspector",
  activeCueId: null,
  compactTimeline: false,
  outputConnected: false,
  modal: null,
  presenter: false,
  follow: true,
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
    fn(b.studio);
  });
}
export function getDesk() {
  return useStudio.getState().board?.studio || emptyStudio();
}
export function selectAsset(asset: MediaAsset) {
  editDesk((d) => {
    d.assetId = asset.id;
    d.view = "footage";
    d.trim = { start: 0, end: Math.min(20, asset.duration || 20) };
    d.fps = asset.fps;
  });
  useRuntime.setState({
    view: "footage",
    time: 0,
    mediaPlaying: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedInk: null,
    sidebar: "media",
  });
}
