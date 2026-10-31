import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Film, MapPin, Pause, Play, Plus, Search, Sparkles, Target } from 'lucide-react';
import type { Board, Match, MatchDetails } from '../types';
import { frameAt, shortName, totalDuration } from '../core';
import { useStudio } from '../store';
import { useRuntime } from '../studio/runtime';
import { recallCue } from '../studio/showControl';
import { collectReportMoments, buildReportReplay, defaultReplayOptions, reportedPoint, type MomentKind, type ReportMoment, type ReplayOptions } from './reportReplay';
import { createReportReplays } from './replayControl';
import './recreation.css';

function ReplayPitch({ board, time, place, onPlace }: { board: Board; time: number; place: 'origin' | 'assistOrigin' | null; onPlace: (point: { x: number; y: number }) => void }) {
  const frame = frameAt(board, time), x = (n: number) => 35 + n * 630, y = (n: number) => 25 + n * 408;
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!place) return;
    const p = e.currentTarget.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const matrix = e.currentTarget.getScreenCTM(); if (!matrix) return;
    const local = p.matrixTransform(matrix.inverse());
    onPlace({ x: Math.max(.025, Math.min(.975, (local.x - 35) / 630)), y: Math.max(.025, Math.min(.975, (local.y - 25) / 408)) });
  };
  return <svg className={`rr-pitch ${place ? 'placing' : ''}`} viewBox="0 0 700 458" role="img" aria-label={place ? `Tap the pitch to set ${place === 'origin' ? 'the action' : 'the build-up'} position` : 'Preview of the report recreation'} onPointerDown={e => { if (place) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); move(e); } }} onPointerMove={e => { if (e.buttons) move(e); }}>
    <defs><linearGradient id="rr-grass" x2="1" y2="1"><stop stopColor="#224e3b"/><stop offset="1" stopColor="#173e32"/></linearGradient><marker id="rr-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#e1ff7b"/></marker></defs>
    <rect width="700" height="458" rx="16" fill="#102c24"/><rect x="35" y="25" width="630" height="408" fill="url(#rr-grass)"/>
    {Array.from({ length: 10 }, (_, i) => <rect key={i} x={35 + i * 63} y="25" width="63" height="408" fill={i % 2 ? '#fff' : '#000'} opacity=".035"/>)}
    <g stroke="#e1eee1" strokeWidth="1.5" opacity=".7" fill="none"><rect x="35" y="25" width="630" height="408"/><path d="M350 25V433M35 108H134V350H35M665 108H566V350H665M35 174H69V284H35M665 174H631V284H665M35 205H22V253H35M665 205H678V253H665"/><circle cx="350" cy="229" r="55"/><path d="M134 186a55 55 0 0 1 0 86M566 186a55 55 0 0 0 0 86"/></g>
    <g fill="#e1eee1" opacity=".7"><circle cx="350" cy="229" r="2"/><circle cx="101" cy="229" r="2"/><circle cx="599" cy="229" r="2"/></g>
    {frame.drawings.filter(d => ['arrow', 'run', 'line'].includes(d.type)).map(d => <polyline key={d.id} points={d.points.map((v, i) => i % 2 ? y(v) : x(v)).join(' ')} fill="none" stroke={d.color} strokeWidth="2.5" markerEnd="url(#rr-arrow)" strokeDasharray={d.type === 'run' ? '7 6' : undefined}/>)}
    {frame.players.map(p => <g key={p.uid}><circle cx={x(p.x)} cy={y(p.y)} r="12" fill={board.colors[p.side]} stroke="#edf7ee" strokeWidth="1.5"/><text x={x(p.x)} y={y(p.y) + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="800">{p.number}</text><text x={x(p.x)} y={y(p.y) + 25} textAnchor="middle" fill="white" fontSize="10" fontWeight="600" stroke="#17392c" strokeWidth="3" paintOrder="stroke">{shortName(p.name)}</text></g>)}
    <circle cx={x(frame.ball.x)} cy={y(frame.ball.y)} r="4.5" fill="white" stroke="#182f26"/>
    <text x="35" y="450" fill="#adc7b2" fontSize="8" letterSpacing="1.5">ILLUSTRATIVE RECREATION · REPORT EVIDENCE RETAINED</text>
  </svg>;
}
function ReplaySetup({ match, report, moment, onBack }: { match: Match; report: MatchDetails; moment: ReportMoment; onBack: () => void }) {
  const current = useStudio(s => s.board), catalogue = useStudio(s => s.catalogue);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start' }); }, [moment.id]);
  const [options, setOptions] = useState<ReplayOptions>(() => defaultReplayOptions(match, moment)), [error, setError] = useState(''), [place, setPlace] = useState<'origin' | 'assistOrigin' | null>(null), [playing, setPlaying] = useState(false), [time, setTime] = useState(0);
  const players = report.lineups.flatMap(l => l.players.map(p => ({ ...p, teamId: l.teamId })));
  const actor = players.find(p => p.id === options.actorId), teammates = players.filter(p => p.teamId === actor?.teamId && p.id !== actor?.id);
  const patch = (v: Partial<ReplayOptions>) => { setOptions(old => ({ ...old, ...v })); setPlaying(false); setTime(0); setError(''); };
  const built = useMemo(() => {
    if (!current || !catalogue) return { error: 'The analysis workspace is unavailable.' };
    try { return { board: buildReportReplay(current, catalogue, match, report, moment, options) }; }
    catch (e) { return { error: (e as Error).message }; }
  }, [current, catalogue, match.id, report, moment.id, options]);
  useEffect(() => {
    if (!playing || !built.board) return;
    let frame = 0; const start = performance.now(), duration = totalDuration(built.board);
    const tick = (now: number) => { const t = Math.max(0, (now - start) / 1000); setTime(Math.min(t, duration)); if (t < duration) frame = requestAnimationFrame(tick); else setPlaying(false); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, built.board]);
  const sourcePoint = reportedPoint(moment, options.goalSide);
  return <section ref={panel} className="rr-setup" aria-label="Prepare report recreation">
    <button className="rr-back" onClick={onBack}><ArrowLeft size={16}/> All report actions</button>
    <div className="rr-heading"><span className="rr-minute">{moment.minute}</span><div><span className="rr-eyebrow">FROM THE MATCH REPORT</span><h3>{moment.title}</h3></div></div>
    <p className="rr-source-text">{moment.event.text}</p>
    <div className="rr-evidence"><span><Check size={13}/> Reported incident and outcome</span><span><MapPin size={13}/>{sourcePoint && !options.origin ? 'Source action location available' : 'Illustrative action location'}</span></div>
    <div className="rr-setup-grid"><div className="rr-preview">
      {built.board ? <ReplayPitch board={built.board} time={time} place={place} onPlace={p => patch({ [place!]: p })}/> : <div className="rr-preview-empty"><Target size={36}/><strong>Choose the player to build the scene.</strong></div>}
      <div className="rr-preview-tools"><button disabled={!built.board || !!place} onClick={() => { if (!playing) setTime(0); setPlaying(v => !v); }}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? 'Pause preview' : 'Preview action'}</button><span>{time.toFixed(1)} / {built.board ? totalDuration(built.board).toFixed(1) : '0.0'}s</span></div>
      <div className="rr-place-tools"><button aria-pressed={place === 'origin'} onClick={() => setPlace(place === 'origin' ? null : 'origin')}><MapPin size={15}/>{place === 'origin' ? 'Done placing action' : 'Place action'}</button>{options.assisterId && <button aria-pressed={place === 'assistOrigin'} onClick={() => setPlace(place === 'assistOrigin' ? null : 'assistOrigin')}>Place build-up</button>}{options.origin && sourcePoint && <button onClick={() => patch({ origin: undefined })}>Use report location</button>}</div>
      <p className="rr-caption">{place ? 'Tap or drag on the pitch. The preview updates immediately.' : 'Reported coordinates anchor the action when supplied. Other players, timing and the assist path are illustrative.'}</p>
    </div><div className="rr-fields">
      <label>Player making the action<select aria-label="Recreation player" value={options.actorId} onChange={e => patch({ actorId: e.target.value, assisterId: undefined })}><option value="">Choose from the match lineup…</option>{report.lineups.map(l => <optgroup key={l.teamId} label={l.teamId === match.homeId ? match.homeName : match.awayName}>{l.players.map(p => <option key={p.id} value={p.id}>{p.number || '–'} · {p.name}</option>)}</optgroup>)}</select></label>
      {moment.outcome && !moment.ownGoal && <label>Build-up player<select aria-label="Recreation build-up player" value={options.assisterId || ''} onChange={e => patch({ assisterId: e.target.value || undefined })}><option value="">Finish only · no added pass</option>{teammates.map(p => <option key={p.id} value={p.id}>{p.name}{p.id === moment.assisterId ? ' · reported assist' : ' · analyst selection'}</option>)}</select></label>}
      <label>Direction of this action<select aria-label="Recreation attacking goal" value={options.goalSide} onChange={e => patch({ goalSide: e.target.value as 'left' | 'right', origin: undefined, assistOrigin: undefined })}><option value="right">Towards the right-hand goal</option><option value="left">Towards the left-hand goal</option></select></label>
      <label>Players on the board<select aria-label="Recreation player layout" value={options.includeXI ? 'xi' : 'actors'} onChange={e => patch({ includeXI: e.target.value === 'xi' })}><option value="actors">Key actors · cleanest view</option><option value="xi">Match XI · illustrative shape</option></select></label>
      <label>Ball travel time<select aria-label="Recreation ball travel time" value={options.seconds} onChange={e => patch({ seconds: +e.target.value })}>{[1, 1.5, 2, 3].map(n => <option key={n} value={n}>{n} seconds per action</option>)}</select></label>
      {!sourcePoint && <label>Starting area<select aria-label="Recreation starting area" value="custom" onChange={e => { const x = +e.target.value; if (x) patch({ origin: { x: options.goalSide === 'right' ? x : 1 - x, y: .5 } }); }}><option value="custom">{options.origin ? 'Position chosen on pitch' : 'Suggested from the report wording'}</option><option value="0.945">Close range</option><option value="0.87">Inside the box</option><option value="0.76">Outside the box</option></select></label>}
      <p className="rr-limit"><strong>A recreation, not a tracking replay.</strong> The report cannot reveal every player or the full build-up. Check the scene against footage, then edit any step on the main board.</p>
      {(error || (!options.actorId && built.error)) && <p role="alert" className="rr-error">{error || built.error}</p>}
      <button className="rr-build" disabled={!built.board} onClick={() => { try { createReportReplays(match, report, [{ moment, options }]); } catch (e) { setError((e as Error).message); } }}><Plus size={18}/> Build editable replay <ArrowUpRight size={17}/></button>
      <small>Saved as a new show moment. Existing moments stay saved and programme remains held.</small>
    </div></div>
  </section>;
}
export default function ReportReplays({ match, report, initialId }: { match: Match; report: MatchDetails; initialId?: string | null }) {
  const moments = useMemo(() => collectReportMoments(match, report), [match.id, report]);
  const storedCues = useStudio(s => s.board?.studio?.cues), cues = storedCues || [];
  const [chosen, setChosen] = useState<string | null>(initialId || null), [category, setCategory] = useState<MomentKind | 'all'>('all'), [search, setSearch] = useState(''), [error, setError] = useState('');
  const active = moments.find(m => m.id === chosen), goals = moments.filter(m => m.kind === 'goal');
  const saved = (id: string) => cues.find(c => c.recreation?.matchId === match.id && c.recreation.eventId === id);
  const pendingGoals = goals.filter(m => m.actorId && !saved(m.id));
  const shown = moments.filter(m => (category === 'all' || m.kind === category) && `${m.title} ${m.event.text}`.toLowerCase().includes(search.toLowerCase()));
  if (active) return <ReplaySetup key={active.id} match={match} report={report} moment={active} onBack={() => setChosen(null)}/>;
  return <section className="rr-browser" aria-label="Recreate goals and actions">
    <div className="rr-hero"><div><span className="rr-eyebrow"><Film size={15}/> REPORT TO REPLAY</span><h3>Bring the key moments onto the pitch.</h3><p>Choose a goal or action. Keep its reported evidence, prepare the scene, then make the point.</p></div><button disabled={!pendingGoals.length} onClick={() => { try { createReportReplays(match, report, pendingGoals.map(moment => ({ moment }))); } catch (e) { setError((e as Error).message); } }}><Sparkles size={17}/> Save {pendingGoals.length || 'all'} goal {pendingGoals.length === 1 ? 'draft' : 'drafts'}</button></div>
    <div className="rr-summary"><span><b>{goals.length}</b> Goals</span><span><b>{moments.filter(m => m.kind === 'chance').length}</b> Chances</span><span><b>{moments.filter(m => m.event.position).length}</b> Located actions</span><span><b>{moments.filter(m => saved(m.id)).length}</b> In the show</span></div>
    <div className="rr-filters"><div>{([['all', 'All actions'], ['goal', 'Goals'], ['chance', 'Chances'], ['set-piece', 'Set plays'], ['incident', 'Incidents']] as const).map(([id, label]) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>)}</div><label><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a player or moment…" aria-label="Search recreatable actions"/></label></div>
    {error && <p role="alert" className="rr-error">{error}</p>}
    <div className="rr-cards">{shown.map(moment => {
      const cue = saved(moment.id);
      return <article key={moment.id} className={`rr-card ${moment.kind === 'goal' ? 'is-goal' : ''}`}><div className="rr-card-top"><b className="rr-minute">{moment.minute}</b><span>{moment.kind === 'goal' ? 'GOAL' : moment.kind === 'chance' ? 'CHANCE' : moment.kind === 'set-piece' ? 'SET PLAY' : 'INCIDENT'}</span>{moment.event.position && <small><MapPin size={12}/> Located</small>}</div><h4>{moment.title}</h4><p>{moment.event.text}</p><div className="rr-card-footer"><small>{moment.actorId ? moment.assisterId ? 'Player + assist identified' : 'Player identified' : 'Choose the player in setup'}</small>{cue ? <button onClick={() => { useStudio.getState().set({ modal: null }); recallCue(cue.id); }}>Edit saved replay <ArrowUpRight size={15}/></button> : <button aria-label={`Recreate ${moment.minute} ${moment.title}`} onClick={() => setChosen(moment.id)}>Recreate <ArrowUpRight size={15}/></button>}</div></article>;
    })}</div>
    {!shown.length && <p className="rr-empty">{moments.length ? 'No actions match these filters.' : 'This report has not supplied recreatable events yet. Refresh the report after play begins.'}</p>}
    <p className="rr-caption">Goals and incidents come from the report. Locations are used only when supplied; unseen movement and off-ball positions remain illustrative. Set plays and incidents start as editable position boards.</p>
  </section>;
}

export function RecreationEvidence() {
  const b = useStudio(s => s.board), r = useRuntime(), evidence = b?.recreation;
  if (!evidence || !['board', 'replay'].includes(r.view)) return null;
  return <section className="rr-desk-evidence" aria-label="Report recreation evidence"><span className="rr-eyebrow"><Film size={13}/> REPORT RECREATION</span><strong>{evidence.minute} · {evidence.title}</strong><p>{evidence.coordinateBasis === 'provider' ? 'The report supplies an action location. ' : 'Action location is illustrative. '}Positioning and movement remain editable illustrations.</p><details><summary>Read the source incident</summary><p>{evidence.sourceText}</p><a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Open match source <ArrowUpRight size={12}/></a></details></section>;
}
