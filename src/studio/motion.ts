export function motionPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number, curve = 0) {
  // Bend perpendicular in metres so the same curve looks consistent in both pitch axes.
  const dx = (b.x - a.x) * 105, dy = (b.y - a.y) * 68;
  const k = 2 * (1 - t) * t * curve;
  return { x: Math.max(0, Math.min(1, a.x + (b.x - a.x) * t - dy * k / 105)), y: Math.max(0, Math.min(1, a.y + (b.y - a.y) * t + dx * k / 68)) };
}

export function validMotion(scene:import('../types').Scene) {
  const m=scene.motion;
  return m===undefined || !!m && ['smooth','linear'].includes(m.easing) && !!m.curves && typeof m.curves==='object' && !Array.isArray(m.curves) && Object.keys(m.curves).length<=44 && Object.entries(m.curves).every(([id,n])=>scene.players.some(p=>p?.uid===id)&&Number.isFinite(n)&&Math.abs(n)<=1);
}
