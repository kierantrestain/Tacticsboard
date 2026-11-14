const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 625;
const CONTROL_RADIUS = 43;

function mix(start,end,amount) {
  return start + (end - start) * amount;
}

function blend(from,to,amount) {
  return {x:mix(from.x,to.x,amount), y:mix(from.y,to.y,amount)};
}

function clamp(value,maximum) {
  return Math.min(maximum,Math.max(0,value));
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function bounds({x,y}) {
  return {x:clamp(x,FIELD_WIDTH),y:clamp(y,FIELD_HEIGHT)};
}

function distance(from,to) {
  return Math.hypot(to.x - from.x,to.y - from.y);
}

export function inGoal(point) {
  return (point.x < 25 || point.x > 975) && Math.abs(point.y - 312.5) <= 31;
}

export function playerInControl(ball,players) {
  if (ball.ownerId !== undefined) return players.get(ball.ownerId);
  if (inGoal(ball)) return undefined;
  let nearest;
  let range = CONTROL_RADIUS;
  for (const player of players.values()) {
    const gap = distance(ball,player);
    if (gap >= range) continue;
    range = gap;
    nearest = player;
  }
  return nearest;
}

export function defaultBallTiming(motion,length) {
  if (motion === 'lob') return {release:.12,arrival:.87,peak:Math.min(38,length * .18),pace:ease};
  if (motion === 'shot') return {
    release:.2,arrival:.7,peak:Math.min(10,length * .04),
    pace:t => 1 - (1 - t) ** 4 * (1 + 4 * t),
  };
  return {
    release:.09,arrival:.62 + Math.min(.21,length / 1500),peak:0,
    pace:t => 1 - (1 - t) ** 3 * (1 + 3 * t),
  };
}

function attached(ball,anchor,positionAt,at) {
  const player = anchor && positionAt(anchor.id,at);
  return player ? {x:ball.x + player.x - anchor.x,y:ball.y + player.y - anchor.y} : ball;
}

function dribbled({from,to,progress,kicker,receiver,positionAt}) {
  if (!kicker || kicker.id !== receiver?.id) return blend(from,to,ease(progress));
  const moving = positionAt(kicker.id,progress);
  const foot = blend({x:from.x - kicker.x,y:from.y - kicker.y},{x:to.x - receiver.x,y:to.y - receiver.y},ease(progress));
  const length = distance(kicker,receiver);
  const touches = Math.min(6,Math.max(2,Math.round(length / 53)));
  const tap = length > 1 ? Math.sin(Math.PI * progress) ** 2 * Math.sin(2 * Math.PI * touches * progress) *
    Math.min(5,length * .04) / length : 0;
  return bounds({x:moving.x + foot.x + (receiver.x - kicker.x) * tap,
    y:moving.y + foot.y + (receiver.y - kicker.y) * tap});
}

function bendPath(from,to,amount,travel) {
  const length = distance(from,to);
  if (!amount || length < 1) return {x:0,y:0};
  const curve = amount * (4 * travel * (1 - travel)) ** 2 / length;
  return {x:-(to.y - from.y) * curve, y:(to.x - from.x) * curve};
}

/** The ball follows the passer up to release and the receiver from the first touch. */
export function sampleBallMotion({from,to,progress,motion,kicker,receiver,positionAt,ballTiming}) {
  if (progress <= 0 || !Number.isFinite(progress)) return from;
  if (progress >= 1) return to;
  if (motion === 'dribble') return dribbled({from,to,progress,kicker,receiver,positionAt});

  const length = distance(from,to);
  if (length < .01 && !kicker && !receiver) return from;
  const defaults = defaultBallTiming(motion,length);
  const {release,arrival} = ballTiming ?? defaults;
  if (progress <= release) return bounds(attached(from,kicker,positionAt,progress));
  if (progress >= arrival) return bounds(attached(to,receiver,positionAt,progress));

  const start = attached(from,kicker,positionAt,release);
  const finish = attached(to,receiver,positionAt,arrival);
  const travel = (progress - release) / (arrival - release);
  const line = blend(start,finish,defaults.pace(travel));
  const bend = bendPath(start,finish,ballTiming?.bend ?? 0,travel);
  const result = bounds({x:line.x + bend.x, y:line.y + bend.y});
  const loft = defaults.peak * 4 * travel * (1 - travel);
  return loft ? {...result,lift:loft} : result;
}
