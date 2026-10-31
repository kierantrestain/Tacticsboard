import type { Board, BoardPlayer, Side } from '../types';
import { clamp, copy, formationPoints, syncScene, uid } from '../core';
import { applyPreset, resetPositions } from './tactics';

export type PlayerUnit = 'outfield' | 'team' | 'back' | 'midfield' | 'front' | 'selected';
export type AttackDirection = 'left' | 'right';
export type UnitOperation = 'forward' | 'back' | 'up' | 'down' | 'narrow' | 'widen' | 'compact' | 'line' | 'flip';
export type DefensiveShape = 'low' | 'mid' | 'high' | 'formation';
export interface UnitMovement { ids: string[]; operation: UnitOperation; direction: AttackDirection }
export interface CounterattackOptions { side: Side; direction: AttackDirection; seconds: number }
export interface GroupPosition { id: string; x: number; y: number }

export function translateGroup<T extends { x: number; y: number }>(positions: T[], dx: number, dy: number): T[] {
  if (!positions.length) return [];
  if (![dx, dy, ...positions.flatMap(p => [p.x, p.y])].every(Number.isFinite)) throw Error('Choose a valid group movement.');
  // Bound one delta for the entire group. Clamping each player separately destroys its shape.
  const minX=Math.min(...positions.map(p=>p.x)),maxX=Math.max(...positions.map(p=>p.x));
  const minY=Math.min(...positions.map(p=>p.y)),maxY=Math.max(...positions.map(p=>p.y));
  const mx = Math.max(Math.min(.025,minX)-minX, Math.min(dx,Math.max(.975,maxX)-maxX));
  const my = Math.max(Math.min(.025,minY)-minY, Math.min(dy,Math.max(.975,maxY)-maxY));
  return positions.map(p => ({ ...p, x: p.x + mx, y: p.y + my }));
}
function role(player: BoardPlayer): 'keeper' | 'back' | 'midfield' | 'front' | undefined {
  const position = player.position || '';
  if (/goalkeep|^GK?$/i.test(position)) return 'keeper';
  if (/defend|back|^CB$|^LB$|^RB$|^D$/i.test(position)) return 'back';
  if (/midfield|^DM$|^AM$|^CM$|^LM$|^RM$|^M$/i.test(position)) return 'midfield';
  if (/forward|strik|winger|^CF$|^ST$|^LF$|^RF$|^F$/i.test(position)) return 'front';
}
export function unitPlayers(board: Board, side: Side, unit: PlayerUnit, selected: string[] = []) {
  if (unit === 'selected') return board.players.filter(p => selected.includes(p.uid));
  const players = board.players.filter(p => p.side === side);
  if (unit === 'team') return players;
  const keeper = players.find(p => role(p) === 'keeper') || (players.length === 11 ? players[0] : undefined);
  const outfield = players.filter(p => p !== keeper);
  if (unit === 'outfield') return outfield;
  const formation = board.formations[side].split('-').map(Number), backs = formation[0] || 4, forwards = formation.at(-1) || 3;
  return outfield.filter((p, i) => {
    const category = role(p) || (players.length === 11 ? i < backs ? 'back' : i >= 10 - forwards ? 'front' : 'midfield' : undefined);
    return category === unit;
  });
}
export function moveUnit(board: Board, action: UnitMovement): Board {
  if (!Array.isArray(action.ids) || !action.ids.length || action.ids.length > 44 || new Set(action.ids).size !== action.ids.length || action.ids.some(id => !board.players.some(p => p.uid === id))) throw Error('Select players from this board first.');
  if (!['left','right'].includes(action.direction) || !['forward','back','up','down','narrow','widen','compact','line','flip'].includes(action.operation)) throw Error('Choose a supported team movement.');
  const next = copy(board), group = next.players.filter(p => action.ids.includes(p.uid));
  const centre = group.reduce((c,p) => ({ x: c.x + p.x / group.length, y: c.y + p.y / group.length }), { x: 0, y: 0 });
  const sign = action.direction === 'right' ? 1 : -1;
  if (['forward','back','up','down'].includes(action.operation)) {
    const dx = action.operation === 'forward' ? .06 * sign : action.operation === 'back' ? -.06 * sign : 0;
    const dy = action.operation === 'up' ? -.06 : action.operation === 'down' ? .06 : 0;
    const shifted = translateGroup(group, dx, dy);
    group.forEach((p,i) => Object.assign(p, shifted[i]));
  } else if (action.operation === 'flip') {
    for (const p of group) p.y = 1 - p.y;
  } else if (action.operation === 'line') {
    const sorted = [...group].sort((a,b) => a.y - b.y);
    const width = Math.min(.8, Math.max(sorted.at(-1)!.y - sorted[0].y, (sorted.length - 1) * .085));
    const top = Math.max(.05, Math.min(.95 - width, centre.y - width / 2));
    sorted.forEach((p,i) => { p.x = centre.x; p.y = sorted.length === 1 ? centre.y : top + width * i / (sorted.length - 1); });
  } else {
    const sx = action.operation === 'compact' ? .86 : 1, sy = action.operation === 'widen' ? 1.18 : .86;
    // Use a common scale at the boundary, preserving lateral gaps and player ordering.
    let fx=sx,fy=sy;
    for(const p of group){
      const dx=p.x-centre.x,dy=p.y-centre.y;
      if(dx>0)fx=Math.min(fx,(.975-centre.x)/dx);if(dx<0)fx=Math.min(fx,(.025-centre.x)/dx);
      if(dy>0)fy=Math.min(fy,(.975-centre.y)/dy);if(dy<0)fy=Math.min(fy,(.025-centre.y)/dy);
    }
    for (const p of group) { p.x = centre.x + (p.x-centre.x)*fx; p.y = centre.y + (p.y-centre.y)*fy; }
  }
  syncScene(next);
  return next;
}
export function setDefensiveShape(board: Board, side: Side, shape: DefensiveShape, direction: AttackDirection): Board {
  if (!['home','away'].includes(side) || !['low','mid','high','formation'].includes(shape) || !['left','right'].includes(direction)) throw Error('Choose a valid team shape.');
  const next = copy(board), ball = copy(board.ball);
  if (shape === 'formation') {
    if (next.players.filter(p => p.side === side).length !== 11) throw Error('Load a complete XI first.');
    resetPositions(next, side);
  } else applyPreset(next, shape === 'high' ? 'press' : 'block', side);
  const group = unitPlayers(next, side, 'outfield');
  if (shape === 'mid') {
    const shifted = translateGroup(group, side === 'home' ? .17 : -.17, 0);
    group.forEach((p,i) => Object.assign(p, shifted[i]));
  }
  if ((side === 'home') !== (direction === 'right')) for (const p of next.players.filter(p => p.side === side)) { p.x = 1 - p.x; p.y = 1 - p.y; }
  next.ball = ball;
  syncScene(next);
  return next;
}
export function addCounterattack(board: Board, options: CounterattackOptions): Board {
  if (!['home','away'].includes(options.side) || !['left','right'].includes(options.direction) || !Number.isFinite(options.seconds) || options.seconds < 2 || options.seconds > 8) throw Error('Choose a valid counterattack setup.');
  if (board.scenes.length > 78) throw Error('This sequence is full. Start a new analysis.');
  const index = board.scenes.findIndex(s => s.id === board.activeScene);
  if (index !== board.scenes.length - 1) throw Error('Open the final step before adding a counterattack. Your existing sequence will stay intact.');
  if (board.scenes[index].ballAction) throw Error('Open the action’s finish step before adding a counterattack.');
  const opponent: Side = options.side === 'home' ? 'away' : 'home';
  const attackers = unitPlayers(board, options.side, 'outfield'), defenders = unitPlayers(board, opponent, 'outfield');
  if (!attackers.length || !defenders.length) throw Error('Load players from both teams before building the counterattack.');
  const next = copy(board); syncScene(next);
  const start = next.scenes[index];
  const targets = new Map<string, {x:number;y:number}>();
  for (const side of ['home','away'] as const) {
    const players = next.players.filter(p => p.side === side), slots = formationPoints(next.formations[side], 'home');
    const isAttack = side === options.side, knownKeeper = players.find(p => role(p) === 'keeper') || (players.length === 11 ? players[0] : undefined);
    const outfield = players.filter(p => p !== knownKeeper);
    for (const player of players) {
      const order = outfield.indexOf(player), category = role(player);
      const slot = players.length === 11 ? slots[order + 1] : undefined;
      const depth = slot ? clamp((slot.x-.18)/.255,0,1) : category === 'front' ? 1 : category === 'back' ? 0 : .5;
      const x = player === knownKeeper ? isAttack ? .12 : .95 : isAttack ? .4 + depth*.44 : .88 - depth*.28;
      // Keep the existing physical lane: recovering defenders should not swap wings.
      const y = player === knownKeeper ? .5 : clamp(.5 + (player.y-.5)*(isAttack ? 1.04 : .86),.08,.92);
      targets.set(player.uid, {x:options.direction==='right'?x:1-x,y});
    }
  }
  // A schematic should remain readable when opposing formation rows coincide.
  // Recover the defending row together, without changing identities or swapping lanes.
  const rows=new Map<string,typeof defenders>();
  for(const player of defenders){const key=targets.get(player.uid)!.x.toFixed(3);rows.set(key,[...(rows.get(key)||[]),player]);}
  for(const row of rows.values())for(let attempt=0;attempt<3;attempt++){
    const crowded=row.some(player=>attackers.some(attacker=>{const a=targets.get(attacker.uid)!,p=targets.get(player.uid)!;return Math.hypot((a.x-p.x)*105,(a.y-p.y)*68)<4.6;}));
    if(!crowded)break;
    const shifted=translateGroup(row.map(p=>({...targets.get(p.uid)!,id:p.uid})),options.direction==='right'?.04:-.04,0);
    shifted.forEach(p=>targets.set(p.id,{x:p.x,y:p.y}));
  }
  const finishPlayers = next.players.map(p => ({ ...p, ...targets.get(p.uid) }));
  const runner = finishPlayers.filter(p => p.side === options.side && p.uid !== next.players.find(q => q.side === options.side && role(q) === 'keeper')?.uid)
    .sort((a,b) => options.direction === 'right' ? b.x-a.x : a.x-b.x)[0];
  const targetBall = { x: clamp(runner.x + (options.direction === 'right' ? .014 : -.014)), y: clamp(runner.y + .012) };
  const middlePlayers = next.players.map(p => { const t = targets.get(p.uid)!; return { ...p, x: p.x+(t.x-p.x)*.55, y:p.y+(t.y-p.y)*.55 }; });
  const note = 'Editable counterattack setup: both teams move together. Positions, recovery runs and ball travel are illustrative; adjust them to your analysis.';
  start.duration = options.seconds / 2;
  const middle = { ...copy(start), id: uid(), cut: undefined, play: undefined, title: 'Counterattack · break forward', note, duration: options.seconds / 2, players: middlePlayers, ball: {x:board.ball.x+(targetBall.x-board.ball.x)*.55,y:board.ball.y+(targetBall.y-board.ball.y)*.55} };
  const finish = { ...copy(start), id: uid(), cut: undefined, play: undefined, title: 'Counterattack · defensive recovery', note, duration: 2, players: finishPlayers, ball: targetBall };
  next.scenes.push(middle, finish);
  next.activeScene = start.id;
  next.players = copy(start.players); next.drawings = copy(start.drawings); next.ball = copy(start.ball);
  next.settings.view = 'full'; next.settings.ballVisible = true;
  return next;
}
