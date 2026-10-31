import { clamp, copy, frameAt, totalDuration, uid } from '../../core';
import type { Board, Drawing } from '../../types';
import { useStudio } from '../../store';
import { editDesk, useRuntime } from '../runtime';
import { recallCue, saveCue, updateCue } from '../showControl';
import { addFootballAction } from '../footballActions';
import type { HostCommand } from './protocol';
import { availableHostViews, explanationPause } from './tabletModel';
import { addCounterattack, moveUnit, setDefensiveShape } from '../teamMovement';

export function createMovement(board: Board): Board {
  const next = copy(board), index = next.scenes.findIndex(s => s.id === next.activeScene);
  const start = next.scenes[index];
  if(start?.ballAction)throw Error('Select the action’s finish step before adding a move.');
  if (!start || next.scenes.length >= 80) throw Error('This sequence is full. Start another analysis.');
  Object.assign(start, { players: copy(next.players), ball: copy(next.ball), drawings: copy(next.drawings) });
  const end = { ...copy(start), id: uid(), title: `Move ${next.scenes.length}`, duration: 1 };
  start.duration = 2;
  next.scenes.splice(index + 1, 0, end); next.activeScene = end.id;
  return next;
}
export function playerMarks(board: Board, ids: string[], type: 'highlight' | 'link'): Drawing[] {
  const players = board.players.filter(p => ids.includes(p.uid));
  if (type === 'link') return players.length < 2 ? [] : [{ id: uid(), type: 'line', points: players.flatMap(p => [p.x, p.y]), color: '#e1ff7b', width: 3, opacity: 0.95 }];
  return players.map(p => ({ id: uid(), type: 'ellipse', points: [clamp(p.x - .029), clamp(p.y - .045), clamp(p.x + .029), clamp(p.y + .045)], color: '#e1ff7b', width: 4, opacity: 1 }));
}
let gesture: string | null = null;
export function cancelHostGesture() { if (gesture) { useStudio.getState().cancel(); gesture = null; } }
function stopAtEditableFrame() {
  const s = useStudio.getState();
  if (s.board && s.previewTime !== null) { const frame = frameAt(s.board, s.previewTime); s.commit(b => Object.assign(b, frame)); }
  s.set({ playing: false, previewTime: null }); useRuntime.setState({ mediaPlaying: false });
}
export function executeHostCommand(command: HostCommand) {
  const s = useStudio.getState(), r = useRuntime.getState(), b = s.board;
  if (!b || r.busy || s.loading) throw Error('The producer is preparing the next view.');
  if (command.type === 'cancel-gesture') { cancelHostGesture(); return; }
  const boardTools = ['move', 'highlight', 'link', 'focus', 'start-move', 'finish-move', 'cancel-move','ball-action','unit-move','team-shape','counterattack'];
  if (boardTools.includes(command.type) && r.view !== 'board') throw Error('Open the tactical board to move or select players.');
  if (command.type === 'unit-move' || command.type === 'team-shape' || command.type === 'counterattack') {
    if (command.type === 'counterattack' && r.movementDraft) throw Error('Finish or cancel the current movement first.');
    const base = copy(b);
    if (s.previewTime !== null) Object.assign(base, frameAt(b,s.previewTime));
    const next = command.type === 'unit-move' ? moveUnit(base,command.action) : command.type === 'team-shape' ? setDefensiveShape(base,command.side,command.shape,command.direction) : addCounterattack(base,command.options);
    s.commit(board=>Object.assign(board,next));
    s.set({playing:false,previewTime:null,selectedShape:null,tool:'select',...(command.type==='unit-move'?{selected:command.action.ids}:{})});
    r.set({mediaPlaying:false,multiSelect:false,...(command.type==='counterattack'?{zoom:1,pan:{x:0,y:0},panMode:false}:{})});
    if (command.type === 'counterattack') s.notify?.('Counterattack added. Both teams move together. Preview it, then adjust any step.');
    return;
  }
  if (command.type === 'move') {
    if (typeof command.gesture !== 'string' || command.gesture.length > 80 || !Array.isArray(command.positions) || command.positions.length > 45 || command.positions.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !b.players.some(q => q.uid === p.id) && p.id !== 'ball')) throw Error('That player movement is invalid.');
    if (gesture !== command.gesture) { cancelHostGesture(); stopAtEditableFrame(); s.begin(); gesture = command.gesture; }
    s.preview(board => { for (const p of command.positions) { const target = p.id === 'ball' ? board.ball : board.players.find(q => q.uid === p.id); if (target) { target.x = clamp(p.x); target.y = clamp(p.y); } } });
    if (command.final) { s.end(); gesture = null; }
    return;
  }
  if (gesture) { s.end(); gesture = null; }
  if (command.type === 'draw') {
    const d = command.drawing;
    if (!d || !['pen', 'arrow', 'run', 'ellipse', 'zone', 'line', 'spotlight'].includes(d.type) || !Array.isArray(d.points) || d.points.length < 4 || d.points.length > 4000 || d.points.some(n => !Number.isFinite(n) || n < 0 || n > 1) || !/^#[0-9a-f]{6}$/i.test(d.color)) throw Error('That mark could not be added.');
    const drawing = { ...d, id: uid(), width: 4, opacity: 1 };
    if (r.view === 'footage') {
      if (!b.studio?.assetId) throw Error('Choose a clip first.');
      const id = b.studio.assetId; r.set({ mediaPlaying: false });
      editDesk(desk => { const ink = desk.ink[id] ||= []; if (ink.length >= 500) throw Error('Clear some marks before adding more.'); ink.push({ ...drawing, assetId: id, space: 'screen', from: r.time, to: desk.trim.end }); });
    } else if (r.view === 'board') { stopAtEditableFrame(); s.commit(board => { if (board.drawings.length >= 500) throw Error('Clear some marks before adding more.'); board.drawings.push(drawing); }); }
    else throw Error('Open the board or footage to draw.');
    return;
  }
  if (command.type === 'erase') { if(r.view==='footage'&&b.studio?.assetId)editDesk(d=>{d.ink[d.assetId!]=(d.ink[d.assetId!]||[]).filter(i=>i.id!==command.id);});else if(r.view==='board')s.commit(board => { board.drawings = board.drawings.filter(d => d.id !== command.id); }); return; }
  if (command.type === 'highlight' || command.type === 'link') { stopAtEditableFrame(); s.commit(board => { if(!Array.isArray(command.ids))throw Error('Select players first.');const marks=playerMarks(board, command.ids.slice(0, 44), command.type);if(board.drawings.length+marks.length>500)throw Error('Clear some marks first.');board.drawings.push(...marks); }); return; }
  if (command.type === 'focus') { s.commit(board => { board.settings.focusPlayer = command.id && board.players.some(p => p.uid === command.id) ? command.id : undefined; }); return; }
  if (command.type === 'setting') { if (!['homeVisible', 'awayVisible', 'names', 'numbers', 'ballVisible', 'teamShape', 'lanes', 'thirds'].includes(command.key) || typeof command.value !== 'boolean') throw Error('Unknown display setting.'); s.commit(board => { board.settings[command.key] = command.value; }); return; }
  if (command.type === 'pitch') { if (['full', 'left', 'right'].includes(command.view)) s.commit(board => { board.settings.view = command.view; }); return; }
  if (command.type === 'start-move') {
    if (r.movementDraft) throw Error('Finish this move first.');
    stopAtEditableFrame();
    const before = copy(useStudio.getState().board!);
    const next = createMovement(before);
    s.commit(board => Object.assign(board, next));
    r.set({ movementDraft: { before, sceneId: next.activeScene }, view: 'board' }); s.set({ tool: 'select' }); return;
  }
  if (command.type === 'finish-move') { if (!r.movementDraft) return; r.set({ movementDraft: null }); s.save(); s.notify('Move saved. Play the sequence or add the next move.'); return; }
  if (command.type === 'cancel-move') { if (r.movementDraft) s.commit(board => Object.assign(board, r.movementDraft!.before)); r.set({ movementDraft: null }); return; }
  if (r.movementDraft && ['scene', 'cue', 'view', 'undo', 'redo', 'save-shot', 'update-shot', 'ball-action', 'play', 'restart'].includes(command.type)) throw Error('Finish or cancel the move first.');
  if (command.type === 'ball-action') { stopAtEditableFrame(); const next=addFootballAction(useStudio.getState().board!,command.action);s.commit(board=>Object.assign(board,next));s.set({playing:false,previewTime:null,selected:[],selectedShape:null});s.notify?.('Action added. Preview the sequence to play it.');return; }
  if (command.type === 'scene') { if (!b.scenes.some(scene => scene.id === command.id)) throw Error('That step is no longer in this sequence.'); s.selectScene(command.id); return; }
  if (command.type === 'cue') { if (!b.studio?.cues?.some(cue => cue.id === command.id)) throw Error('That moment is no longer in this show.'); recallCue(command.id); return; }
  if (command.type === 'view') { if (!availableHostViews(b,r.assets,r.assetAvailability).includes(command.view)) throw Error('Prepare that view on the show computer first.'); editDesk(d => { d.view = command.view; }); r.set({ view: command.view, mediaPlaying: false, mediaHolding:false, ...(command.view==='footage'?{time:b.studio?.trim.start||0}:{}) }); s.set({ playing: false, previewTime: null }); return; }
  if (command.type === 'camera') { if (['broadcast', 'overhead', 'endline', 'touchline'].includes(command.camera)) r.set({ camera: command.camera }); return; }
  if (command.type === 'duration') { const n = Number(command.seconds); if (!Number.isFinite(n)) return; s.commit(board => { const scene = board.scenes.find(x => x.id === board.activeScene); if (scene) scene.duration = Math.max(.5, Math.min(10, n)); }); return; }
  if (command.type === 'rate') { if(![.25,.5,1,2].includes(command.value))throw Error('Choose a supported playback speed.'); if(r.view==='board'||r.view==='replay'&&!b.studio?.assetId)s.set({speed:command.value,playhead:s.previewTime??0});r.set({rate:command.value}); return; }
  if (command.type === 'pause-explain') {
    const asset=r.assets.find(a=>a.id===b.studio?.assetId);if(r.view!=='footage'||asset?.type!=='video')throw Error('Open a video moment first.');
    const pause=explanationPause(b.studio!.trim,r.time,b.studio!.explainStops?.[asset.id]||[],uid());
    editDesk(d=>{(d.explainStops||={})[asset.id]=pause.stops;});r.set({time:pause.time,mediaPlaying:false,mediaHolding:false});return;
  }
  if (command.type === 'clip-in' || command.type === 'clip-out') {
    if (!b.studio?.assetId) throw Error('Choose a clip first.');
    const a = r.assets.find(x => x.id === b.studio?.assetId);
    if (!a || a.type !== 'video') throw Error('Choose a video to set the clip range.');
    editDesk(d => { if (command.type === 'clip-in') { d.trim.start = Math.min(r.time, Math.max(0, a.duration - .25)); d.trim.end = Math.min(a.duration, Math.max(d.trim.start + .25, Math.min(d.trim.start + 20, d.trim.end))); } else d.trim.end = Math.max(d.trim.start + .25, Math.min(r.time, a.duration, d.trim.start + 20)); }); return;
  }
  const isMedia = r.view === 'footage' || r.view === 'split' || r.view === 'replay' && !!b.studio?.assetId && !!b.studio?.tracking[b.studio.assetId];
  if (command.type === 'seek') { if (!Number.isFinite(command.time)) return; if (isMedia) r.set({ time: Math.max(b.studio?.trim.start || 0, Math.min(b.studio?.trim.end || 20, command.time)), mediaPlaying: false }); else s.set({ playing: false, playhead: clamp(command.time, 0, totalDuration(b)), previewTime: clamp(command.time, 0, totalDuration(b)) }); return; }
  if (command.type === 'play' || command.type === 'restart') {
    if (isMedia) { if (!r.assets.some(a => a.id === b.studio?.assetId && a.type === 'video')) throw Error('This source is a still image.'); const start = b.studio?.trim.start || 0; r.set({ mediaPlaying: command.type === 'restart' || !r.mediaPlaying, time: command.type === 'restart' || r.time >= (b.studio?.trim.end || 20) - .05 ? start : r.time }); }
    else { if (b.scenes.length < 2) throw Error('Use Add a move to animate the board.'); const t = s.previewTime ?? 0; s.set({ playing: command.type === 'restart' || !s.playing, playhead: command.type === 'restart' || t >= totalDuration(b) ? 0 : t }); }
    return;
  }
  if (command.type === 'undo') s.undo();
  else if (command.type === 'redo') s.redo();
  else if (command.type === 'update-shot') { if(!b.studio?.cues?.some(c=>c.id===r.activeCueId))throw Error('Open a saved moment first.');updateCue(); }
  else if (command.type === 'save-shot') saveCue();
  else if (command.type === 'clear') { if (r.view === 'footage' && b.studio?.assetId) editDesk(d => { d.ink[d.assetId!] = []; }); else s.commit(board => { board.drawings = []; board.settings.focusPlayer = undefined; }); }
}
