import type { Board, Drawing, Frame, Scene, Side } from '../types';
import { clamp, copy, syncScene, uid } from '../core';
import { addCounterattack, unitPlayers } from './teamMovement';
import { addFootballAction } from './footballActions';
import { PLAYBOOK, type PlayPhase, type PlayRequest } from './playbookTypes';

// Normalised to a 105 × 68 m pitch, attacking the right-hand goal.
const LENGTH = 105, WIDTH = 68;
type Point = { x: number; y: number };
type Slot = Point & { role: string; unit?: 'back' | 'midfield' | 'front' };
type Layout = { start: Frame; middle: Frame; finish: Frame; roles: Record<string, string> };
const slot = (role: string, x: number, y: number, unit?: Slot['unit']): Slot => ({ role, x, y, unit });
const metric = (a: Point, b: Point) => Math.hypot((a.x - b.x) * LENGTH, (a.y - b.y) * WIDTH);
const opposite = (side: Side): Side => side === 'home' ? 'away' : 'home';
const world = (p: Point, r: PlayRequest): Point => ({ x: r.direction === 'right' ? p.x : 1 - p.x, y: r.flank === 'top' ? p.y : 1 - p.y });
const local = world; // Both reflections are their own inverse.
const roleKey = (side: Side, role: string) => `${side}:${role}`;
const keeperOf = (b: Board, side: Side) => b.players.find(p => p.side === side && /goalkeep|^GK?$/i.test(p.position || '')) || b.players.find(p => p.side === side)!;

function validate(b: Board, r: PlayRequest) {
  const play = PLAYBOOK.find(p => p.id === r.id);
  if (!play || !['home', 'away'].includes(r.side) || !['left', 'right'].includes(r.direction) || !['top', 'bottom'].includes(r.flank)
    || !['setup', 'sequence'].includes(r.mode) || !['zonal', 'man'].includes(r.marking)
    || !play.patterns.some(p => p[0] === r.pattern) || ![2, 3, 4, 6].includes(r.seconds)
    || ![3, 4, 5].includes(r.wallSize) || !['left', 'centre', 'right'].includes(r.goalTarget) || typeof r.guides !== 'boolean') throw Error('Choose a valid play and setup.');
  if (b.activeScene !== b.scenes.at(-1)?.id) throw Error('Open the final step to add a play.');
  if (b.scenes.at(-1)?.ballAction) throw Error('Open the action’s finish step first.');
  if (b.scenes.length > 76) throw Error('This sequence is full. Start another analysis.');
  if ((r.id !== 'counter' || r.mode === 'setup') && (b.players.filter(p => p.side === 'home').length !== 11 || b.players.filter(p => p.side === 'away').length !== 11)) throw Error('Load both teams’ full XIs first.');
  const taker = r.takerId && b.players.find(p => p.uid === r.takerId), receiver = r.receiverId && b.players.find(p => p.uid === r.receiverId);
  if (r.takerId && (!taker || taker.side !== r.side || r.id !== 'goal-kick' && taker.uid === keeperOf(b, r.side).uid)) throw Error('Choose a taker from this team.');
  if (r.receiverId && (!receiver || receiver.side !== r.side || receiver.uid === keeperOf(b, r.side).uid || receiver.uid === r.takerId)) throw Error('Choose a different outfield player as the runner.');
  if (r.outcome !== undefined && !['goal', 'saved', 'off-target'].includes(r.outcome)) throw Error('Choose a shot outcome.');
  if (r.mode === 'sequence' && (r.id === 'penalty' || r.id === 'free-kick' && r.pattern === 'direct') && !r.outcome) throw Error('Choose the shot outcome, or place the setup only.');
  return play;
}

/** Assign every real player once, favouring their unit and the shortest move. */
function assign(b: Board, side: Side, slots: Slot[], keeper: Point, r: PlayRequest, fixed: Record<string, string>, roles: Record<string, string>, positions: Map<string, Point>) {
  const gk = keeperOf(b, side);
  const gkIsTaker = fixed.taker === gk.uid;
  if (!gkIsTaker) positions.set(gk.uid, world(keeper, r));
  roles[roleKey(side, 'keeper')] = gk.uid;
  const available = b.players.filter(p => p.side === side && (p.uid !== gk.uid || gkIsTaker));
  const pending = slots.filter(s => {
    const player = available.find(p => p.uid === fixed[s.role]);
    if (!player) return true;
    roles[roleKey(side, s.role)] = player.uid; positions.set(player.uid, world(s, r));
    return false;
  });
  const used = new Set(Object.entries(roles).filter(([key]) => key.startsWith(`${side}:`) && !key.endsWith(':keeper')).map(([, id]) => id));
  const players = available.filter(p => !used.has(p.uid));
  if (players.length !== pending.length) throw Error('This setup needs a complete XI with distinct roles.');
  const backs = new Set(unitPlayers(b, side, 'back').map(p => p.uid)), fronts = new Set(unitPlayers(b, side, 'front').map(p => p.uid));
  const dp = Array(1 << players.length).fill(Infinity), choices = Array(1 << players.length).fill(-1); dp[0] = 0;
  for (let mask = 0; mask < dp.length; mask++) {
    let index = 0; for (let bits = mask; bits; bits &= bits - 1) index++;
    if (index === players.length) continue;
    const p = players[index];
    for (let j = 0; j < pending.length; j++) if (!(mask & (1 << j))) {
      const target = world(pending[j], r), wanted = pending[j].unit;
      const unit = backs.has(p.uid) ? 'back' : fronts.has(p.uid) ? 'front' : 'midfield';
      const cost = (target.x - p.x) ** 2 + (target.y - p.y) ** 2 + (wanted && wanted !== unit ? .22 : 0);
      const next = mask | (1 << j);
      if (dp[mask] + cost < dp[next]) { dp[next] = dp[mask] + cost; choices[next] = j; }
    }
  }
  let mask = dp.length - 1;
  for (let i = players.length - 1; i >= 0; i--) {
    const j = choices[mask], s = pending[j];
    roles[roleKey(side, s.role)] = players[i].uid; positions.set(players[i].uid, world(s, r)); mask ^= 1 << j;
  }
}

const standard = (defending = false): Slot[] => [
  slot('back-top', defending ? .83 : .25, .17, 'back'), slot('centre-top', defending ? .88 : .22, .39, 'back'),
  slot('centre-bottom', defending ? .88 : .22, .61, 'back'), slot('back-bottom', defending ? .83 : .25, .83, 'back'),
  slot('pivot', defending ? .72 : .4, .5, 'midfield'), slot('mid-top', defending ? .7 : .45, .27, 'midfield'), slot('mid-bottom', defending ? .7 : .45, .73, 'midfield'),
  slot('wide-top', defending ? .56 : .64, .13, 'front'), slot('target', defending ? .53 : .68, .5, 'front'), slot('wide-bottom', defending ? .56 : .64, .87, 'front'),
];

function layout(b: Board, r: PlayRequest, existingRoles?: Record<string, string>): Layout {
  const side = r.side, other = opposite(side), roles: Record<string, string> = {}, positions = new Map<string, Point>();
  let attack = standard(), defend = standard(true), ownKeeper: Point = { x: .06, y: .5 }, theirKeeper: Point = { x: .97, y: .5 };
  let ball: Point = { x: .4, y: .5 }, middleBall: Point = { x: .6, y: .3 }, endBall: Point = { x: .8, y: .2 };
  const attackMoves: Record<string, Point> = {}, defendMoves: Record<string, Point> = {};
  let takerId = r.takerId;
  if (r.id === 'corner') {
    ball = { x: .996, y: .006 };
    attack = [slot('taker', .986, .025), slot('target', .79, .42, 'front'), slot('far', .77, .62, 'front'), slot('screen', .83, .51), slot('runner', .79, .28), slot('edge', .72, .47, 'midfield'), slot('short', .87, .14), slot('cover-top', .53, .35, 'back'), slot('cover-bottom', .53, .68, 'back'), slot('edge-bottom', .7, .76)];
    defend = [slot('zone-1', .985, .35), slot('zone-2', .98, .67), slot('zone-3', .84, .23), slot('zone-4', .88, .7), slot('zone-5', .84, .42), slot('zone-6', .84, .58), slot('edge-1', .77, .34), slot('edge-2', .72, .67), slot('short-cover', .88, .21), slot('outlet', .60, .16)];
    endBall = r.pattern === 'near' ? { x: .945, y: .43 } : r.pattern === 'far' ? { x: .945, y: .57 } : r.pattern === 'short' ? { x: .87, y: .14 } : { x: .77, y: .49 };
    middleBall = { ...endBall };
    Object.assign(attackMoves, { target: ['short', 'edge'].includes(r.pattern) ? { x: .945, y: .43 } : endBall, far: { x: .91, y: .64 }, screen: { x: .89, y: .51 }, runner: { x: .9, y: .3 }, edge: r.pattern === 'edge' ? endBall : { x: .76, y: .47 }, short: r.pattern === 'short' ? endBall : { x: .88, y: .14 } });
  } else if (r.id === 'free-kick') {
    ball = { x: .72, y: r.pattern === 'direct' ? .41 : .16 };
    attack = [slot('taker', ball.x - .02, ball.y), slot('target', .83, .42, 'front'), slot('far', .81, .67, 'front'), slot('runner', .78, .3), slot('edge', .7, .62), slot('short', .66, .22), slot('cover-top', .46, .35, 'back'), slot('cover-bottom', .46, .68, 'back'), slot('edge-top', .68, .08), slot('edge-bottom', .7, .86)];
    const vx = (1 - ball.x) * LENGTH, vy = (.5 - ball.y) * WIDTH, length = Math.hypot(vx, vy), ux = vx / length, uy = vy / length;
    const wall = Array.from({ length: r.wallSize }, (_, i) => {
      const offset = (i - (r.wallSize - 1) / 2) * 1.65;
      return slot(`wall-${i}`, ball.x + (ux * 10 - uy * offset) / LENGTH, ball.y + (uy * 10 + ux * offset) / WIDTH);
    });
    defend = [...wall, ...[slot('zone-1', .93, .39), slot('zone-2', .93, .64), slot('zone-3', .87, .23), slot('zone-4', .87, .76), slot('zone-5', .85, .52), slot('outlet', .52, .8), slot('cover', .9, .08)].slice(0, 10 - r.wallSize)];
    middleBall = endBall = r.pattern === 'short' ? { x: .66, y: .22 } : { x: .94, y: r.pattern === 'far' ? .61 : .42 };
    Object.assign(attackMoves, { target: r.pattern === 'short' ? { x: .94, y: .42 } : endBall, far: { x: .91, y: .66 }, runner: { x: .9, y: .3 }, edge: { x: .78, y: .61 } });
  } else if (r.id === 'throw-in') {
    ball = { x: .62, y: 0 };
    attack = standard().filter(s => !['mid-top', 'back-top'].includes(s.role));
    attack.push(slot('taker', .62, .005), slot('short', .56, .13));
    const target = attack.find(s => s.role === 'target')!; target.x = r.pattern === 'line' ? .76 : .64; target.y = .19;
    defend = standard(true); middleBall = endBall = { x: r.pattern === 'line' ? .8 : .67, y: .13 };
    attackMoves.target = endBall; attackMoves.short = { x: .6, y: .15 }; defendMoves['back-top'] = { x: .84, y: .14 };
  } else if (r.id === 'goal-kick') {
    ball = { x: .04, y: .39 }; ownKeeper = { x: .035, y: .5 };
    takerId ||= keeperOf(b, side).uid;
    attack = standard().filter(s => takerId === keeperOf(b, side).uid || s.role !== 'centre-top');
    attack.push(slot('taker', .033, .39));
    const target = attack.find(s => s.role === 'target')!; target.x = r.pattern === 'long' ? .57 : .13; target.y = r.pattern === 'long' ? .24 : .3;
    defend = standard(true).map(s => ({ ...s, x: Math.max(.22, s.x - .3) }));
    middleBall = endBall = { x: r.pattern === 'long' ? .62 : .17, y: r.pattern === 'long' ? .23 : .3 };
    attackMoves.target = endBall;
    for (const s of attack) if (!['taker', 'target'].includes(s.role)) attackMoves[s.role] = { x: Math.min(.8, s.x + .08), y: s.y };
    for (const s of defend) defendMoves[s.role] = { x: Math.max(.18, s.x - .055), y: s.y };
  } else if (r.id === 'penalty') {
    ball = { x: 1 - 11 / LENGTH, y: .5 }; theirKeeper = { x: 1, y: .5 };
    attack = [slot('taker', ball.x - .022, .5), ...Array.from({ length: 9 }, (_, i) => slot(`wait-${i}`, i < 5 ? .73 : .78, .1 + (i < 5 ? i : i - 5) * .19))];
    defend = Array.from({ length: 10 }, (_, i) => slot(`wait-${i}`, i < 5 ? .68 : .8, .12 + (i % 5) * .18));
    middleBall = endBall = { ...ball };
  } else {
    if (r.id === 'build-up') {
      ball = { x: .07, y: .5 }; middleBall = { x: .23, y: .32 }; endBall = { x: .43, y: .38 };
      attack.find(s => s.role === 'centre-top')!.y = .29; attack.find(s => s.role === 'centre-bottom')!.y = .71;
      Object.assign(attackMoves, { pivot: endBall, 'back-top': { x: .43, y: .13 }, 'back-bottom': { x: .43, y: .87 } });
      defend = standard(true).map(s => ({ ...s, x: Math.max(.32, s.x - .2) }));
      for (const s of defend) defendMoves[s.role] = { x: Math.max(.28, s.x - .05), y: clamp(s.y - .035, .07, .93) };
    } else if (r.id === 'high-press') {
      attack = standard().map(s => ({ ...s, x: Math.min(.85, s.x + .22) })); ball = { x: .96, y: .5 }; middleBall = { x: .84, y: .3 }; endBall = { x: .82, y: .33 };
      Object.assign(attackMoves, { 'wide-top': { x: .84, y: .24 }, target: { x: .89, y: .46 }, 'wide-bottom': { x: .84, y: .7 }, 'mid-top': { x: .75, y: .35 } });
      defendMoves['centre-top'] = { x: .86, y: .33 };
    } else if (r.id === 'switch') {
      ball = { x: .64, y: .13 }; middleBall = { x: .44, y: .49 }; endBall = { x: .73, y: .86 };
      attackMoves['wide-bottom'] = endBall;
      for (const s of defend) defendMoves[s.role] = { x: s.x, y: clamp(s.y + .09, .08, .94) };
    } else if (r.id === 'overlap') {
      ball = { x: .45, y: .27 }; middleBall = { x: .68, y: .2 }; endBall = { x: .85, y: .09 };
      Object.assign(attackMoves, { 'back-top': endBall, 'wide-top': { x: .75, y: .22 }, target: { x: .86, y: .46 }, 'mid-top': { x: .67, y: .32 } });
      Object.assign(defendMoves, { 'back-top': { x: .9, y: .15 }, 'centre-top': { x: .91, y: .36 }, 'mid-top': { x: .78, y: .27 } });
    } else if (r.id === 'low-block') {
      attack = standard().map(s => ({ ...s, x: .14 + s.x * .35, y: .5 + (s.y - .5) * .78 }));
      defend = standard(true).map(s => ({ ...s, x: Math.max(.39, s.x - .32) })); ball = { x: .45, y: .2 }; middleBall = { x: .39, y: .4 }; endBall = { x: .39, y: .61 };
      for (const s of attack) attackMoves[s.role] = { x: s.x - .025, y: clamp(s.y + .08, .06, .94) };
      for (const s of defend) defendMoves[s.role] = { x: Math.max(.36, s.x - .035), y: clamp(s.y + .07, .06, .94) };
    }
  }
  const fixed: Record<string, string> = {};
  if (attack.some(s => s.role === 'taker')) {
    fixed.taker = takerId || [...unitPlayers(b, side, 'outfield')].filter(p => p.uid !== r.receiverId).sort((a, c) => metric(local(a, r), ball) - metric(local(c, r), ball))[0].uid;
  }
  const receiverRole = (r.id === 'corner' || r.id === 'free-kick') && r.pattern === 'short' ? 'short' : r.id === 'corner' && r.pattern === 'edge' ? 'edge' : 'target';
  if (r.receiverId) fixed[receiverRole] = r.receiverId;
  // A non-keeper goal-kick taker still leaves one keeper and ten outfield roles.
  const existing = (team: Side) => Object.fromEntries(Object.entries(existingRoles || {}).filter(([key]) => key.startsWith(`${team}:`) && !key.endsWith(':keeper')).map(([key, id]) => [key.slice(team.length + 1), id]));
  assign(b, side, attack, ownKeeper, r, { ...fixed, ...existing(side) }, roles, positions);
  assign(b, other, defend, theirKeeper, r, existing(other), roles, positions);
  if (r.marking === 'man' && ['corner', 'free-kick'].includes(r.id)) {
    const targets = attack.filter(s => !['taker', 'cover-top', 'cover-bottom', 'short', 'edge-top', 'edge-bottom'].includes(s.role));
    const markers = defend.filter(s => !s.role.startsWith('wall'));
    targets.slice(0, markers.length).forEach((s, i) => positions.set(roles[roleKey(other, markers[i].role)], world({ x: Math.min(.96, s.x + .045), y: clamp(s.y + .035, .08, .92) }, r)));
  }
  const makeFrame = (moved: boolean): Frame => {
    const points = new Map(positions);
    if (moved) {
      for (const [role, p] of Object.entries(attackMoves)) { const id = roles[roleKey(side, role)]; if (id) points.set(id, world(p, r)); }
      for (const [role, p] of Object.entries(defendMoves)) { const id = roles[roleKey(other, role)]; if (id) points.set(id, world(p, r)); }
      if (r.marking === 'man' && r.id === 'corner') {
        const runners = ['target', 'far', 'screen', 'runner'];
        runners.forEach((role, i) => { const p = attackMoves[role], marker = roles[roleKey(other, defend[i]?.role)]; if (p && marker) points.set(marker, world({ x: Math.min(.975, p.x + .04), y: clamp(p.y + .04, .05, .95) }, r)); });
      }
    }
    return { players: b.players.map(p => ({ ...p, ...points.get(p.uid) })), drawings: [], ball: world(moved ? endBall : ball, r) };
  };
  const start = makeFrame(false), finish = makeFrame(true), middle = copy(finish); middle.ball = world(middleBall, r);
  if (roles[roleKey(side, receiverRole)]) roles[roleKey(side, 'receiver')] = roles[roleKey(side, receiverRole)];
  if (PLAYBOOK.find(p => p.id === r.id)!.category === 'restart' && r.id !== 'penalty' && !(r.id === 'free-kick' && r.pattern === 'direct')) {
    const receiver = finish.players.find(p => p.uid === roles[roleKey(side, 'receiver')])!;
    const foot = world({ x: clamp(local(receiver, r).x + .012), y: clamp(local(receiver, r).y + .012) }, r);
    finish.ball = foot; middle.ball = copy(foot);
  }
  // Separate the two planned stages for open play; set pieces have a stationary setup before delivery.
  const progress = PLAYBOOK.find(p => p.id === r.id)!.category === 'open' ? .5 : .78;
  middle.players = start.players.map(p => { const q = finish.players.find(q => q.uid === p.uid)!; return { ...p, x: p.x + (q.x - p.x) * progress, y: p.y + (q.y - p.y) * progress }; });
  if (r.id === 'corner' || r.id === 'free-kick') {
    const minimum = r.id === 'corner' ? 10.15 : 9.15;
    for (const frame of [start]) for (const p of frame.players.filter(p => p.side === other)) {
      const q = local(p, r), distance = metric(q, ball);
      if (distance < minimum) {
        const f = (minimum + .3) / Math.max(.001, distance);
        Object.assign(p, world({ x: clamp(ball.x + (q.x - ball.x) * f, .03, .99), y: clamp(ball.y + (q.y - ball.y) * f, .03, .97) }, r));
      }
    }
  }
  return { start, middle, finish, roles };
}

function guides(start: Frame, finish: Frame, r: PlayRequest): Drawing[] {
  if (!r.guides) return [];
  const result: Drawing[] = [];
  const arrow = (from: Point, to: Point, type: Drawing['type'], color: string) => result.push({ id: `play:${uid()}`, type, points: [from.x, from.y, to.x, to.y], color, width: 3, opacity: .8 });
  if (metric(start.ball, finish.ball) > .5) arrow(start.ball, finish.ball, 'arrow', '#dfff81');
  for (const p of start.players.filter(p => p.side === r.side)) { const q = finish.players.find(q => q.uid === p.uid)!; if (metric(p, q) > 3) arrow(p, q, 'run', '#87c9f5'); }
  if (r.id === 'free-kick') {
    const circle = Array.from({length:49},(_,i)=>{const angle=i/48*Math.PI*2;return [clamp(start.ball.x+Math.cos(angle)*9.15/LENGTH),clamp(start.ball.y+Math.sin(angle)*9.15/WIDTH)];}).flat();
    result.push({ id: `play:${uid()}`, type: 'line', points: circle, color: '#dfff81', width: 2, opacity: .4 });
  }
  return result;
}

/** Check edited restart setups before animating them; never silently undo a presenter's placement. */
export function restartIssues(frame: Frame, r: PlayRequest, roles: Record<string, string>): string[] {
  const ball = local(frame.ball, r), taker = roles[roleKey(r.side, 'taker')], keeper = roles[roleKey(opposite(r.side), 'keeper')];
  const opponents = frame.players.filter(p => p.side !== r.side), issues: string[] = [];
  if (r.id === 'corner') {
    if (Math.hypot((1 - ball.x) * LENGTH, ball.y * WIDTH) > 1.01) issues.push('Put the ball inside the selected corner arc.');
    if (opponents.some(p => Math.hypot((1 - local(p, r).x) * LENGTH, local(p, r).y * WIDTH) < 10.15 - .01)) issues.push('Keep defenders 9.15 m from the corner arc.');
  }
  if (r.id === 'free-kick') {
    if (opponents.some(p => metric(p, frame.ball) < 9.15 - .01)) issues.push('Move opponents at least 9.15 m from the ball.');
    const wall = Object.entries(roles).filter(([key]) => key.startsWith(`${opposite(r.side)}:wall-`)).map(([, id]) => frame.players.find(p => p.uid === id)!);
    if (wall.length >= 3 && frame.players.filter(p => p.side === r.side).some(p => wall.some(w => metric(p, w) < 1))) issues.push('Keep attackers at least 1 m from the wall.');
  }
  if (r.id === 'throw-in') {
    if (Math.abs(ball.y) > .001) issues.push('Put the ball on the selected touchline.');
    if (opponents.some(p => metric(p, frame.ball) < 2)) issues.push('Keep opponents at least 2 m from the throw-in.');
  }
  if (r.id === 'goal-kick') {
    if (ball.x > 5.5 / LENGTH + .001 || Math.abs(ball.y - .5) > 9.16 / WIDTH) issues.push('Put the ball inside the goal area.');
    if (opponents.some(p => { const q = local(p, r); return q.x < 16.5 / LENGTH && Math.abs(q.y - .5) < 20.16 / WIDTH; })) issues.push('Move opponents outside the penalty area.');
  }
  if (r.id === 'penalty') {
    if (metric(ball, { x: 1 - 11 / LENGTH, y: .5 }) > .1) issues.push('Put the ball on the penalty mark.');
    const gk = frame.players.find(p => p.uid === keeper), q = gk && local(gk, r);
    if (!q || Math.abs(q.x - 1) > .001 || Math.abs(q.y - .5) > 3.66 / WIDTH) issues.push('Put the defending keeper on the goal line between the posts.');
    if (frame.players.filter(p => p.uid !== taker && p.uid !== keeper).some(p => { const q = local(p, r); return q.x >= ball.x || metric(q, ball) < 9.15 || q.x >= 1 - 16.5 / LENGTH && Math.abs(q.y - .5) <= 20.16 / WIDTH; })) issues.push('Keep other players behind the mark, outside the area and 9.15 m away.');
  }
  return issues;
}

export function buildPlay(board: Board, r: PlayRequest): Board {
  const play = validate(board, r);
  if (r.id === 'counter' && r.mode === 'sequence') {
    const next = addCounterattack(board, { side: r.side, direction: r.direction, seconds: r.seconds });
    const start = next.scenes.at(-3)!, middle = next.scenes.at(-2)!, finish = next.scenes.at(-1)!;
    const manual = start.drawings.filter(d => !d.id.startsWith('play:'));
    start.drawings = [...manual, ...guides(start, finish, r)]; middle.drawings = copy(start.drawings); finish.drawings = copy(manual);
    if (start.drawings.length > 500) throw Error('Clear some drawings before adding this play.');
    next.drawings = copy(start.drawings);
    return next;
  }
  const next = copy(board); syncScene(next);
  const key = JSON.stringify({ id: r.id, side: r.side, direction: r.direction, flank: r.flank, pattern: r.pattern, marking: r.marking, wallSize: r.wallSize, takerId: r.takerId, receiverId: r.receiverId });
  const previous = next.scenes.at(-1)!, matching = previous.play?.phase === 'setup' && previous.play.key === key;
  const validRoles = matching && Object.values(previous.play!.roles).every(id=>next.players.some(p=>p.uid===id));
  if (matching && !validRoles && r.mode === 'sequence') throw Error('The team changed. Place the setup again.');
  const continuing = matching && validRoles;
  const generated = layout(next, r, continuing ? previous.play!.roles : undefined);
  if (continuing) for (const frame of [generated.middle, generated.finish]) frame.players = frame.players.map(p => {
    const from = generated.start.players.find(q => q.uid === p.uid)!, actual = next.players.find(q => q.uid === p.uid)!;
    return metric(from, p) < .01 ? copy(actual) : p;
  });
  const phase = (stage: PlayPhase['phase']): PlayPhase => ({ id: r.id, phase: stage, key, roles: generated.roles, basis: 'illustrative' });
  const note = `${play.name} · planned tactical sequence; edit positions and runs to match your analysis.`;
  let start: Scene;
  if (continuing) {
    start = previous; start.play = { ...phase('setup'), roles: previous.play!.roles };
    generated.roles = start.play.roles;
    Object.assign(start, { players: copy(next.players), ball: copy(next.ball), drawings: copy(next.drawings) });
  } else {
    start = { ...generated.start, id: uid(), title: `${play.name} · setup`, duration: 1, note, cut: true, play: phase('setup') };
    next.scenes.push(start);
  }
  const manual = start.drawings.filter(d => !d.id.startsWith('play:'));
  start.drawings = [...manual, ...guides(start, generated.finish, r)];
  generated.middle.drawings = copy(start.drawings); generated.finish.drawings = copy(manual);
  if (start.drawings.length > 500) throw Error('Clear some drawings before adding this play.');
  if (play.category === 'restart') {
    const issues = restartIssues(start, r, generated.roles);
    if (issues.length) throw Error(issues[0]);
  }
  if (r.mode === 'sequence') {
    if (r.id === 'penalty' || r.id === 'free-kick' && r.pattern === 'direct') {
      next.activeScene = start.id; next.players = copy(start.players); next.ball = copy(start.ball); next.drawings = copy(start.drawings);
      const result = addFootballAction(next, { kind: 'shot', fromId: generated.roles[roleKey(r.side, 'taker')], goalSide: r.direction, goalTarget: r.goalTarget, outcome: r.outcome!, seconds: r.seconds });
      const shotStart = result.scenes.find(s => s.id === start.id)!;
      shotStart.ball = copy(start.ball); shotStart.title = `${play.name} · kick`;
      for (const drawing of shotStart.drawings.filter(d => d.type === 'arrow' && d.id.startsWith('ball-action:'))) drawing.points.splice(0, 2, start.ball.x, start.ball.y);
      shotStart.play = phase('delivery');
      result.scenes.at(-1)!.play = phase('finish');
      result.activeScene = shotStart.id; result.players = copy(shotStart.players); result.ball = copy(shotStart.ball); result.drawings = copy(shotStart.drawings);
      result.settings.view = 'full'; result.settings.ballVisible = true;
      return result;
    }
    start.duration = r.seconds / 2;
    next.scenes.push({ ...generated.middle, id: uid(), title: `${play.name} · ${play.category === 'restart' ? 'delivery' : 'develop'}`, duration: r.seconds / 2, note, play: phase('delivery') }, { ...generated.finish, id: uid(), title: `${play.name} · finish`, duration: 2, note, play: phase('finish') });
  }
  const active = start;
  next.activeScene = active.id; next.players = copy(active.players); next.ball = copy(active.ball); next.drawings = copy(active.drawings);
  next.settings.view = 'full'; next.settings.ballVisible = true; next.settings.focusPlayer = undefined;
  return next;
}
