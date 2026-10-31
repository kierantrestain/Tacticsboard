import type { BallState, Frame } from '../types';

const bound = (n: number) => Math.max(.005, Math.min(.995, n));
/** Coordinates remain portable; ownership is explicit rather than inferred during playback. */
export function resolvedBall(frame: Pick<Frame, 'players' | 'ball'>): BallState {
  const owner = frame.players.find(p => p.uid === frame.ball.carrierId);
  if (!owner) return { x: frame.ball.x, y: frame.ball.y };
  const offset = frame.ball.offset || { x: owner.side === 'home' ? .024 : -.024, y: .022 };
  return { x: bound(owner.x + offset.x), y: bound(owner.y + offset.y), carrierId: owner.uid, offset: { ...offset } };
}
export function giveBall(frame: Pick<Frame, 'players' | 'ball'>, id: string | null) {
  if (id === null) { frame.ball = { x: frame.ball.x, y: frame.ball.y }; return; }
  const owner = frame.players.find(p => p.uid === id);
  if (!owner) throw Error('Choose a player on this pitch.');
  frame.ball = resolvedBall({ players: frame.players, ball: { ...frame.ball, carrierId: id, offset: undefined } });
}
/** A deliberate ball drop close to a player attaches it; empty space releases it. */
export function dropBall(frame: Pick<Frame, 'players' | 'ball'>) {
  const nearest = frame.players.map(p => ({ p, d: Math.hypot((p.x - frame.ball.x) * 105, (p.y - frame.ball.y) * 68) }))
    .sort((a, b) => a.d - b.d)[0];
  if (nearest && nearest.d <= 3.4) giveBall(frame, nearest.p.uid);
}
export function validBall(ball: BallState, players: Frame['players']) {
  return (ball.carrierId === undefined || typeof ball.carrierId === 'string' && players.some(p => p?.uid === ball.carrierId)) &&
    (ball.offset === undefined || !!ball.offset && !!ball.carrierId && Number.isFinite(ball.offset.x) && Number.isFinite(ball.offset.y) && Math.abs(ball.offset.x) <= .1 && Math.abs(ball.offset.y) <= .1);
}
