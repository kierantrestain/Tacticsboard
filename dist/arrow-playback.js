import { resolveMark } from './mark-anchors.js';
import { playerInControl } from './ball-motion.js';

const actions = new Map([['arrow','pass'],['run','run'],['dribble','dribble'],['lob','lob'],['shot','shot']]);
const field = {left:25,right:975,top:24,bottom:601};
const controlRange = 44;
const footDistance = 27;
const goalHalfWidth = 31;

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const distance = (first,second) => Math.hypot(first.x - second.x,first.y - second.y);
const point = (x,y) => ({x,y});
const onField = ({x,y}) => point(clamp(x,field.left,field.right),clamp(y,field.top,field.bottom));
const onBoard = ({x,y}) => point(clamp(x,0,1000),clamp(y,0,625));

export function runnableArrows(scene) {
  return scene.marks.filter(mark => actions.has(mark.type) && mark.points.length > 1);
}

function closestPlayer(position,players,maxDistance) {
  let best;
  for (const player of players.values()) {
    const gap = distance(player,position);
    if (gap > maxDistance || (best && gap === maxDistance)) continue;
    best = player;
    maxDistance = gap;
  }
  return best;
}

function atEndOfRun(player,arrow) {
  return onField(point(player.x + arrow.end.x - arrow.start.x,player.y + arrow.end.y - arrow.start.y));
}

function ballByCarrier(ball,carrier,target) {
  return {...onBoard(point(target.x + ball.x - carrier.x,target.y + ball.y - carrier.y)),ownerId:carrier.id};
}

function arrowPlayer(mark,index,position,players) {
  const anchor = mark.anchors?.find(item => item.index === index);
  return anchor ? players.get(anchor.playerId) : closestPlayer(position,players,30);
}

function planArrow(stored,players) {
  const mark = resolveMark(stored,players);
  const start = mark.points[0];
  const end = mark.points.at(-1);
  return {id:mark.id,kind:actions.get(mark.type),start,end,
    anchoredStart:mark.anchors?.some(anchor => anchor.index === 0),
    player:arrowPlayer(mark,0,start,players),
    receiver:arrowPlayer(mark,mark.points.length - 1,end,players)};
}

function finishInGoal(end) {
  if (Math.abs(end.y - 312.5) > goalHalfWidth) return onBoard(end);
  if (end.x <= field.left + 2) return point(12,end.y);
  if (end.x >= field.right - 2) return point(988,end.y);
  return onBoard(end);
}

function receiveAtFoot(origin,end,receiver,position) {
  const gap = distance(origin,position);
  if (distance(end,receiver) >= 13) return ballByCarrier(end,receiver,position);
  const foot = gap > .01 ? point(position.x + (origin.x - position.x) / gap * footDistance,
    position.y + (origin.y - position.y) / gap * footDistance) : point(position.x + footDistance,position.y);
  return {...onBoard(foot),ownerId:receiver.id};
}

/**
 * Resolve one stage from the arrows using the current board's possession.
 * A stage supports simultaneous runs and a single ball action. The source scene
 * keeps its coordinates, and the next stage keeps any arrows that did not run.
 */
export function planArrowStage(scene,settings = {}) {
  const players = new Map(scene.players
    .filter(player => !player.benched && settings[player.team] !== false)
    .map(player => [player.id,player]));
  const origin = scene.ball;
  const carrier = playerInControl(origin,players);
  const candidates = runnableArrows(scene).map(mark => planArrow(mark,players));
  const ballArrow = candidates.find(arrow => {
    const ballGap = distance(origin,arrow.start);
    if (arrow.kind === 'run' || distance(arrow.start,arrow.end) < 3 || ballGap > controlRange) return false;
    if (arrow.anchoredStart && (!arrow.player || arrow.player !== carrier)) return false;
    if (arrow.kind === 'dribble') return carrier && distance(carrier,atEndOfRun(carrier,arrow)) >= 3;
    return (carrier && arrow.player === carrier) || (!arrow.anchoredStart && ballGap <= 16);
  });
  const moves = new Map();
  const used = new Set();
  let transition = 'auto';
  const startOwner = origin.ownerId === undefined ? carrier?.id ?? null : origin.ownerId;
  let ball = {...origin,ownerId:startOwner};

  if (ballArrow?.kind === 'dribble') {
    moves.set(carrier.id,atEndOfRun(carrier,ballArrow));
  }
  if (ballArrow) used.add(ballArrow.id);

  for (const arrow of candidates) {
    const player = arrow.player;
    if (arrow.kind !== 'run' || !player || moves.has(player.id)) continue;
    const target = atEndOfRun(player,arrow);
    if (distance(player,target) < 3) continue;
    moves.set(player.id,target);
    used.add(arrow.id);
  }

  if (!used.size) return null;
  if (ballArrow) {
    transition = ballArrow.kind;
    const receiver = ballArrow.receiver;
    if (transition === 'dribble') ball = ballByCarrier(origin,carrier,moves.get(carrier.id));
    else if (transition === 'shot') ball = {...finishInGoal(ballArrow.end),ownerId:null};
    else if (receiver && receiver !== carrier && distance(ballArrow.end,receiver) <= controlRange) {
      ball = receiveAtFoot(origin,ballArrow.end,receiver,moves.get(receiver.id) ?? receiver);
    }
    else ball = {...onBoard(ballArrow.end),ownerId:null};
  } else if (carrier && moves.has(carrier.id)) {
    transition = 'dribble';
    ball = ballByCarrier(origin,carrier,moves.get(carrier.id));
  }

  const longestRun = Math.max(0,...[...moves].map(([id,target]) => distance(players.get(id),target)));
  const ballLength = distance(origin,ball);
  const runTime = longestRun > 0 ? 650 + 4.5 * longestRun : 0;
  const ballTime = transition === 'lob' ? 950 + 2 * ballLength :
    transition === 'shot' ? 680 + 1.3 * ballLength : 650 + 2.3 * ballLength;
  const duration = Math.round(clamp(Math.max(runTime,ballTime),800,5000) / 50) * 50;
  const next = structuredClone(scene);
  next.players.forEach(player => Object.assign(player,moves.get(player.id)));
  next.ball = ball;
  next.marks = next.marks.filter(mark => !used.has(mark.id));
  return {scene:next,transition,duration,startOwner,ran:used.size,skipped:candidates.length - used.size};
}
