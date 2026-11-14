export function validAnchors(anchors, count) {
  if (anchors === undefined) return true;
  if (!Array.isArray(anchors) || anchors.length > 2) return false;
  const indexes = new Set();
  for (const anchor of anchors) {
    if (!anchor || !Number.isInteger(anchor.index) || anchor.index < 0 || anchor.index >= count ||
        indexes.has(anchor.index) || typeof anchor.playerId !== 'string' || !anchor.playerId ||
        anchor.playerId.length > 100 || !Number.isFinite(anchor.dx) || !Number.isFinite(anchor.dy) ||
        Math.abs(anchor.dx) > 1000 || Math.abs(anchor.dy) > 625) return false;
    indexes.add(anchor.index);
  }
  return true;
}

export function resolveMark(mark, players) {
  if (!mark.anchors?.length) return mark;
  const points = [...mark.points];
  for (const anchor of mark.anchors) {
    const player = players.get(anchor.playerId);
    if (!player) continue;
    points[anchor.index] = {x:player.x + anchor.dx,y:player.y + anchor.dy};
  }
  // A highlight or a vision cone linked by its origin translates as a unit.
  if (mark.anchors.length === 1 && mark.anchors[0].index === 0 &&
      ['highlight','vision'].includes(mark.type) && points.length > 1) {
    const dx = points[0].x - mark.points[0].x;
    const dy = points[0].y - mark.points[0].y;
    for (let i = 1; i < points.length; i++) points[i] = {x:points[i].x + dx,y:points[i].y + dy};
  }
  return {...mark,points};
}

export function setAnchor(mark,index,player) {
  const anchors = (mark.anchors ?? []).filter(item => item.index !== index);
  if (player) anchors.push({index,playerId:player.id,dx:0,dy:0});
  if (anchors.length) mark.anchors = anchors;
  else delete mark.anchors;
}
