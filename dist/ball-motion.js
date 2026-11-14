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

function goalPosition(point) {
  return (point.x < 25 || point.x > 975) && point.y > 252 && point.y < 373;
}

function closestFoot(ball,roster,otherRoster) {
  let best;
  let range = CONTROL_RADIUS;
  for (const [id,player] of roster) {
    if (!otherRoster.has(id)) continue;
    const gap = distance(ball,player);
    if (gap >= range) continue;
    range = gap;
    best = player;
  }
  return best;
}

function findCarrier(from,to,current,end) {
  let best;
  let minimum = Infinity;
  for (const [id,player] of current) {
    const target = end.get(id);
    if (!target) continue;
    const first = distance(from,player);
    const last = distance(to,target);
    if (first > CONTROL_RADIUS || last > CONTROL_RADIUS || first + last >= minimum) continue;
    best = {player,target};
    minimum = first + last;
  }
  return best;
}

function attached(ball,anchor,currentPosition) {
  return {x:ball.x + currentPosition.x - anchor.x,y:ball.y + currentPosition.y - anchor.y};
}

function drift(anchor,at,positionAt,current,end) {
  const actual = positionAt(anchor.id,at);
  if (actual) return actual;
  const starting = current.get(anchor.id);
  const final = end.get(anchor.id);
  return starting && final ? blend(starting,final,ease(at)) : anchor;
}

function dribbled({from,to,progress,current,end,positionAt}) {
  const carrier = findCarrier(from,to,current,end);
  const pace = ease(progress);
  if (!carrier) return blend(from,to,pace);
  const {player,target} = carrier;
  const moving = drift(player,progress,positionAt,current,end);
  const foot = blend({x:from.x - player.x,y:from.y - player.y},{x:to.x - target.x,y:to.y - target.y},pace);
  const length = distance(from,to);
  const touches = Math.min(5,Math.max(2,Math.round(length / 58)));
  const tap = Math.sin(Math.PI * progress) ** 2 * Math.sin(2 * Math.PI * touches * progress) * Math.min(5,length * .04);
  return bounds({x:moving.x + foot.x + (to.x - from.x) / length * tap,
    y:moving.y + foot.y + (to.y - from.y) / length * tap});
}

function timing(motion,length) {
  if (motion === 'lob') return {
    release:.11,arrival:.89,peak:Math.min(40,length * .21),
    pace:t => .58 * ease(t) + .42 * (1 - (1 - t) ** 3 * (1 + 3 * t)),
  };
  if (motion === 'shot') return {
    release:.23,arrival:.68,peak:Math.min(13,length * .055),
    pace:t => 1 - (1 - t) ** 5 * (1 + 5 * t),
  };
  return {
    release:.085,arrival:.59 + Math.min(.23,length / 1450),peak:0,
    pace:t => 1 - (1 - t) ** 3 * (1 + 3 * t),
  };
}

function optionalBend(from,to,length,travel,motion) {
  if (motion !== 'lob' || length <= 170) return {x:0,y:0};
  const across = (to.y - from.y) / length;
  // The broad diagonal is the only course that gets an automatic lateral bend.
  if (Math.abs(across) < .28) return {x:0,y:0};
  const curve = Math.min(10,(length - 170) * .044) * (4 * travel * (1 - travel)) ** 2;
  return {
    x:-across * curve,
    y:(to.x - from.x) / length * curve,
  };
}

/**
 * Sample a transition at normalized progress. Player maps contain the on-pitch
 * players at both keyframes; positionAt uses the exact same curve as the tokens.
 */
export function sampleBallMotion({from,to,progress,motion,current,end,positionAt}) {
  if (progress <= 0 || !Number.isFinite(progress)) return from;
  if (progress >= 1) return to;
  const length = distance(from,to);
  if (length < .01) return from;
  if (motion === 'dribble') return dribbled({from,to,progress,current,end,positionAt});

  const kicker = closestFoot(from,current,end);
  const receiver = motion === 'shot' || goalPosition(to) ? null : closestFoot(to,end,current);
  const {release,arrival,peak,pace} = timing(motion,length);
  const before = at => kicker ? attached(from,kicker,drift(kicker,at,positionAt,current,end)) : from;
  const after = at => receiver ? attached(to,receiver,drift(receiver,at,positionAt,current,end)) : to;
  if (progress <= release) return bounds(before(progress));
  if (progress >= arrival) return bounds(after(progress));

  const start = before(release);
  const finish = after(arrival);
  const travel = (progress - release) / (arrival - release);
  const line = blend(start,finish,pace(travel));
  const fromCorrection = before(progress);
  const toCorrection = after(progress);
  const exitWeight = 1 - ease(clamp(travel / .28,1));
  const entryWeight = ease(clamp((travel - .65) / .35,1));
  const bend = optionalBend(start,finish,Math.max(1,distance(start,finish)),travel,motion);
  const result = bounds({
    x:line.x + (fromCorrection.x - start.x) * exitWeight + (toCorrection.x - finish.x) * entryWeight + bend.x,
    y:line.y + (fromCorrection.y - start.y) * exitWeight + (toCorrection.y - finish.y) * entryWeight + bend.y,
  });
  return peak ? {...result,lift:peak * 4 * travel * (1 - travel)} : result;
}
