import { useEffect } from 'react';
import { create } from 'zustand';
import { useStudio } from '../../store';
import { copy, frameAt, totalDuration } from '../../core';
import { useRuntime } from '../runtime';
import { captureHostPreview } from '../capture';
import { setLiveFollow } from '../production';
import { connectRoom, studioRequest } from './connection';
import { cancelHostGesture, executeHostCommand } from './actions';
import type { CommandEnvelope, HostState, RoomPresence, RoomSession } from './protocol';

interface Pairing extends RoomSession { codes: Record<string, string>; expiresAt: number; origins: string[] }
interface LinkState { session: Pairing | null; presence: RoomPresence | null; status: string; available: boolean | null; canProduce: boolean; origins: string[]; error: string; set: (v: Partial<LinkState>) => void }
function savedSession(): Pairing | null { try { const v = JSON.parse(sessionStorage.getItem('touchline.producer-room') || 'null'); return v?.role === 'producer' ? v : null; } catch { return null; } }
export const useStudioLink = create<LinkState>((set) => ({ session: savedSession(), presence: null, status: 'offline', available: null, canProduce: false, origins: [], error: '', set }));
export async function discoverStudioHub() {
  try { const result = await studioRequest('status'); useStudioLink.setState({ available: !!result.enabled, canProduce: !!result.canProduce, origins: result.origins || [] }); }
  catch { useStudioLink.setState({ available: false }); }
}
export async function startStudioRoom() {
  try {
    const result = await studioRequest('rooms', null, {});
    const session: Pairing = { ...result, role: 'producer' };
    sessionStorage.setItem('touchline.producer-room', JSON.stringify(session));
    useStudioLink.setState({ session, error: '' });
  } catch (e) { useStudioLink.setState({ error: (e as Error).message }); }
}
export async function roomControl(data: object) {
  const s = useStudioLink.getState().session;
  if (!s) return;
  try { return await studioRequest('control', s, data); }
  catch (e) { useStudioLink.setState({ error: (e as Error).message }); }
}
export async function endStudioRoom() {
  await roomControl({ action: 'end' });
  sessionStorage.removeItem('touchline.producer-room');
  useStudioLink.setState({ session: null, presence: null, status: 'offline' });
  setLiveFollow(false);
}
export function hostSnapshot(includeImage = false): HostState | null {
  const s = useStudio.getState(), r = useRuntime.getState();
  if (!s.board) return null;
  const board = copy(s.board);
  // The host needs the current scene and cue labels, not the entire research archive.
  if (board.studio) {
    board.studio = { ...board.studio, tracking: {}, targets: {}, landmarks: {}, dataReports: undefined, statsSnapshot: undefined, ink: {}, bookmarks: [], cues: board.studio.cues?.map(c => ({ ...c, sequence: undefined, report: undefined, tracking: undefined, thumbnail: undefined, ink: [], frame: { players: [], drawings: [], ball: {x:.5,y:.5} } })) };
  }
  const asset = r.assets.find(a => a.id === board.studio?.assetId);
  const isMedia = r.view === 'footage' || r.view === 'split' || r.view === 'replay' && !!s.board.studio?.tracking[asset?.id || ''];
  const preview=includeImage && r.view!=='board'?captureHostPreview():undefined;
  const visibleInk=r.view==='footage' ? (s.board.studio?.ink[asset?.id||'']||[]).filter(d=>r.time>=d.from-.03&&r.time<=d.to+.03):[];
  return { board, visibleInk, previewAspect:preview?.aspect, frame: s.previewTime === null ? { players: board.players, drawings: board.drawings, ball: board.ball } : copy(frameAt(s.board, s.previewTime)), view: r.view, camera: r.camera, time: isMedia ? r.time : s.previewTime ?? 0, duration: isMedia ? board.studio?.trim.end || asset?.duration || 0 : totalDuration(board), playing: isMedia ? r.mediaPlaying : s.playing, activeCueId: r.activeCueId, recordingMove: !!r.movementDraft, recordingId: r.movementDraft?.sceneId, follow: r.follow, black: !!r.program?.black, outputConnected: r.outputConnected, busy: !!r.busy || s.loading, previewImage: preview?.image, mediaName: asset?.name, canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}
export function useProducerRoom() {
  const session = useStudioLink(s => s.session);
  useEffect(() => { void discoverStudioHub(); }, []);
  useEffect(() => {
    if (!session) return;
    let presence: RoomPresence | null = null, dirty = true, sending = false, closed = false, lastImage = 0;
    const stop = connectRoom(session, (type, data) => {
      if (type === 'presence') {
        if (presence?.epoch !== data.epoch) cancelHostGesture();
        presence = data; dirty = true; useStudioLink.setState({ presence: data });
      }
      if (type === 'command') {
        const e = data as CommandEnvelope, b = useStudio.getState().board;
        try {
          if (!presence?.armed || presence.owner !== e.role || presence.epoch !== e.epoch) throw Error('Control changed. Request the screen again.');
          if (!b || b.id !== e.boardId || b.activeScene !== e.sceneId) throw Error('The analysis changed. Wait for the tablet to catch up.');
          executeHostCommand(e.command);
        } catch (error) {
          void studioRequest('feedback', session, { to: e.role, message: (error as Error).message }).catch(() => {});
        }
        dirty = true;
      }
      if (type === 'ended' || type === 'replaced') { sessionStorage.removeItem('touchline.producer-room'); useStudioLink.setState({ session: null, presence: null }); cancelHostGesture(); setLiveFollow(false); }
    }, status => { useStudioLink.setState({ status }); if(status === 'ended'){sessionStorage.removeItem('touchline.producer-room');useStudioLink.setState({session:null,presence:null});setLiveFollow(false);} if (status !== 'connected') { cancelHostGesture(); if (status === 'offline') setLiveFollow(false); } });
    const unStudio = useStudio.subscribe(() => { dirty = true; }), unRuntime = useRuntime.subscribe(() => { dirty = true; });
    const tick = setInterval(async () => {
      const picture = useRuntime.getState().view !== 'board' && Date.now() - lastImage > 240;
      if ((!dirty && !picture) || sending || closed || useStudioLink.getState().status !== 'connected') return;
      const state = hostSnapshot(picture); if (!state) return;
      if (picture) lastImage = Date.now();
      dirty = false; sending = true;
      try { await studioRequest('state', session, { state }, AbortSignal.timeout(5000)); } catch { dirty = true; } finally { sending = false; }
    }, 60);
    return () => { closed = true; stop(); unStudio(); unRuntime(); clearInterval(tick); cancelHostGesture(); };
  }, [session?.room, session?.token]);
}
