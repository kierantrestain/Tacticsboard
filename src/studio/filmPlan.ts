export interface ExplainStop { id: string; time: number; hold: number }
export function clipPlan(trim: { start: number; end: number }, stops: ExplainStop[] = []) {
  const start = Math.max(0, trim.start), end = Math.max(start, trim.end);
  const valid = stops.filter(s => Number.isFinite(s.time) && s.time >= start && s.time < end && Number.isFinite(s.hold) && s.hold > 0).sort((a,b)=>a.time-b.time).map(s => ({...s,hold:Math.min(10,s.hold)}));
  const duration = end - start + valid.reduce((n,s)=>n+s.hold,0);
  return { duration, stops: valid, sourceAt(outputTime: number) {
    let extra = 0;
    const t = Math.max(0, Math.min(duration, outputTime));
    for (const stop of valid) { const at = stop.time - start + extra; if (t < at) break; if (t < at + stop.hold) return { time: stop.time, holding: true, stopId: stop.id }; extra += stop.hold; }
    return { time: Math.max(start, Math.min(end, start+t-extra)), holding: false, stopId: undefined };
  } };
}
export function aroundMoment(time: number, duration: number, seconds = 8) {
  const length = Math.min(Math.max(.25, seconds), Math.max(.25, duration), 20);
  const start = Math.max(0, Math.min(time - length / 2, duration - length));
  return { start, end: Math.min(duration, start + length) };
}
