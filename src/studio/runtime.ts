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
import type { Board } from "../types";
import { setLiveFollow } from './production';
interface Runtime {
  pendingFiles: File[];
  annotationText: string;
  reverseReview: boolean;
  multiSelect: boolean;
  ballActionKind: import("./footballActionTypes").BallActionKind | null;
  ballTargetPicking: boolean;
  ballTarget: {x:number;y:number} | null;
  tabletPanel: boolean;
  movementDraft: { before: Board; sceneId: string } | null;
  view: ViewMode;
  camera: CameraPreset;
  assets: MediaAsset[];
  time: number;
  mediaPlaying: boolean;
  mediaHolding: boolean;
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
  modal: "export" | "projects" | "shortcuts" | "commands" | "media" | "backup" | "events" | null;
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
  pendingFiles: [],
  annotationText: "Tactical note",
  reverseReview: false,
  multiSelect: false,
  ballActionKind:null,
  ballTargetPicking:false,
  ballTarget:null,
  tabletPanel: false,
  movementDraft: null,
  view: "board",
  camera: "broadcast",
  assets: [],
  time: 0,
  mediaPlaying: false,
  mediaHolding: false,
  rate: 1,
  muted: true,
  loopClip: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  panMode: false,
  sidebar: "tactics",
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
  const changed=getDesk().assetId!==asset.id;
  setLiveFollow(false);
  editDesk((d) => {
    if (d.assetId) (d.sourceRanges ||= {})[d.assetId] = { ...d.trim };
    d.assetId = asset.id;
    d.view = "footage";
    d.trim = d.sourceRanges?.[asset.id] || {
      start: 0,
      end: asset.type === "image" ? 5 : Math.min(20, asset.duration || 20),
    };
    d.fps = asset.fps;
  });
  useRuntime.setState({
    activeCueId:changed?null:useRuntime.getState().activeCueId,
    view: "footage",
    time: getDesk().trim.start,
    mediaPlaying: false,
  mediaHolding: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedInk: null,
    sidebar: "tactics",
    reverseReview: false,
    markMode:'none',
    panMode:false,
  });
  if(changed)useStudio.getState().set({tool:'select',selected:[],selectedShape:null,playing:false,previewTime:null});
}
