import type { Board, Scene } from '../types';
import { copy, uid } from '../core';

/** Linked pass/shot chains form a single editable block, keeping endpoints adjacent. */
export function sceneBlocks(scenes: Scene[]): Scene[][] {
  const blocks: Scene[][] = [];
  for (const scene of scenes) {
    const last = blocks.at(-1), previous = last?.at(-1);
    if (previous?.ballAction?.endSceneId === scene.id) last!.push(scene);
    else blocks.push([scene]);
  }
  return blocks;
}
export function editSequence(board: Board, id: string, action: 'duplicate' | 'earlier' | 'later') {
  const blocks = sceneBlocks(board.scenes), index = blocks.findIndex(block => block.some(s => s.id === id));
  if (index < 0) throw Error('Choose a sequence step.');
  if (action === 'duplicate') {
    const original = blocks[index];
    if (board.scenes.length + original.length > 100) throw Error('This sequence is full.');
    const ids = new Map(original.map(s => [s.id, uid()]));
    const actionIds = new Map(original.flatMap(s => s.ballAction ? [[s.ballAction.id, uid()] as const] : []));
    const cloned = copy(original).map(s => {
      s.id = ids.get(s.id)!; s.title = `${s.title} copy`.slice(0, 60);
      if (s.ballAction) { s.ballAction.endSceneId = ids.get(s.ballAction.endSceneId)!; s.ballAction.id = actionIds.get(s.ballAction.id)!; }
      for (const d of s.drawings) for (const [from, to] of actionIds) d.id = d.id.replace(`ball-action:${from}:`, `ball-action:${to}:`);
      return s;
    });
    // A duplicated block starts with its saved setup rather than moving through an unrelated phase.
    cloned[0].cut = true;
    blocks.splice(index + 1, 0, cloned);
    board.activeScene = cloned[0].id;
  } else {
    const target = index + (action === 'earlier' ? -1 : 1);
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  }
  board.scenes = blocks.flat();
  const selected = board.scenes.find(s => s.id === board.activeScene)!;
  board.players = copy(selected.players); board.ball = copy(selected.ball); board.drawings = copy(selected.drawings);
}

export function createMovement(board: Board): Board {
  const next = copy(board), index = next.scenes.findIndex(s => s.id === next.activeScene);
  const start = next.scenes[index];
  if(start?.ballAction)throw Error('Select the action’s finish step before adding a move.');
  if (!start || next.scenes.length >= 80) throw Error('This sequence is full. Start another analysis.');
  Object.assign(start, { players: copy(next.players), ball: copy(next.ball), drawings: copy(next.drawings) });
  const end = { ...copy(start), id: uid(), title: `Move ${next.scenes.length}`, duration: 1, cut: undefined, play: undefined, motion: undefined };
  start.duration = 2;
  next.scenes.splice(index + 1, 0, end); next.activeScene = end.id;
  return next;
}
