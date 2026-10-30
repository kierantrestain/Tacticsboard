import type { Board, Drawing, Frame } from '../../types';
import type { CameraPreset, ViewMode } from '../types';
export type HostRole = 'host1' | 'host2';
export type RoomRole = HostRole | 'producer';
export interface RoomSession { room: string; token: string; role: RoomRole }
export interface RoomPresence { owner: HostRole | null; epoch: number; requested: HostRole | null; connected: Record<RoomRole, boolean>; armed: boolean }
export interface HostState {
  board: Board;
  frame: Frame;
  view: ViewMode;
  camera: CameraPreset;
  time: number;
  duration: number;
  playing: boolean;
  activeCueId: string | null;
  recordingMove: boolean;
  recordingId?: string;
  follow: boolean;
  black: boolean;
  outputConnected: boolean;
  busy: boolean;
  previewImage?: string;
  previewAspect?: number;
  visibleInk?: Drawing[];
  mediaName?: string;
  mediaType?: "video" | "image";
  availableViews?: ViewMode[];
  rate?: number;
  canUndo: boolean;
  canRedo: boolean;
}
export type HostCommand =
  | { type: 'move'; gesture: string; positions: { id: string; x: number; y: number }[]; final: boolean }
  | { type: 'draw'; drawing: Drawing }
  | { type: 'erase'; id: string }
  | { type: 'highlight'; ids: string[] }
  | { type: 'link'; ids: string[] }
  | { type: 'focus'; id: string | null }
  | { type: 'setting'; key: 'homeVisible' | 'awayVisible' | 'names' | 'numbers' | 'ballVisible' | 'teamShape' | 'lanes' | 'thirds'; value: boolean }
  | { type: 'pitch'; view: 'full' | 'left' | 'right' }
  | { type: 'scene'; id: string }
  | { type: 'cue'; id: string }
  | { type: 'seek'; time: number }
  | { type: 'view'; view: 'board' | 'footage' | 'replay' | 'stats' }
  | { type: 'camera'; camera: CameraPreset }
  | { type: 'duration'; seconds: number }
  | { type: 'rate'; value: number }
  | { type: 'clip-in' | 'clip-out' | 'undo' | 'redo' | 'clear' | 'play' | 'restart' | 'start-move' | 'finish-move' | 'cancel-move' | 'cancel-gesture' | 'save-shot' | 'update-shot' | 'pause-explain' };
export interface CommandEnvelope { role: HostRole; epoch: number; seq: number; boardId: string; sceneId: string; command: HostCommand }
export const roleName = (role: RoomRole | null) => role === 'host1' ? 'Host 1' : role === 'host2' ? 'Host 2' : 'Producer';
