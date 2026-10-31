import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Flag, Play, LayoutTemplate } from 'lucide-react';
import type { Board, Side } from '../types';
import type { HostCommand } from './host/protocol';
import { PLAYBOOK, type PlayId, type PlayRequest } from './playbookTypes';
import { unitPlayers } from './teamMovement';
import './playbook.css';

function readDraft(board: Board): PlayRequest & { configuring: boolean } {
  let value: Partial<PlayRequest> & { configuring?: boolean } = {};
  try { value = JSON.parse(sessionStorage.getItem(`touchline.playbook:${board.id}`) || board.scenes.find(s=>s.id===board.activeScene)?.play?.key || '{}'); } catch { /* A new editor starts with defaults. */ }
  if (!value || typeof value !== 'object') value = {};
  const play = PLAYBOOK.find(p=>p.id===value.id) || PLAYBOOK[0];
  return {
    configuring: value.configuring ?? !!board.scenes.find(s=>s.id===board.activeScene)?.play,
    id: play.id, side: value.side === 'away' ? 'away' : 'home', direction: value.direction === 'left' ? 'left' : 'right',
    flank: value.flank === 'bottom' ? 'bottom' : 'top', pattern: play.patterns.find(p=>p[0]===value.pattern)?.[0] || play.patterns[0][0],
    marking: value.marking === 'man' ? 'man' : 'zonal', wallSize: [3,4,5].includes(value.wallSize!) ? value.wallSize! : 4,
    seconds: [2,3,4,6].includes(value.seconds!) ? value.seconds! : 4, mode: 'setup',
    takerId: board.players.some(p=>p.uid===value.takerId) ? value.takerId : undefined,
    receiverId: board.players.some(p=>p.uid===value.receiverId) ? value.receiverId : undefined,
    outcome: ['goal','saved','off-target'].includes(value.outcome!) ? value.outcome : undefined,
    goalTarget: value.goalTarget === 'left' || value.goalTarget === 'right' ? value.goalTarget : 'centre', guides: value.guides !== false,
  };
}

export default function PlaybookPanel({ board, send, disabled = false, recording = false }: {
  board: Board; send: (command: HostCommand) => void; disabled?: boolean; recording?: boolean;
}) {
  const id = useId();
  const [draft] = useState(()=>readDraft(board));
  const [configuring, setConfiguring] = useState(draft.configuring);
  const [category, setCategory] = useState<'open' | 'restart'>(()=>PLAYBOOK.find(p=>p.id===draft.id)!.category), [playId, setPlayId] = useState<PlayId>(draft.id);
  const [side, setSide] = useState<Side>(draft.side), [direction, setDirection] = useState<'right' | 'left'>(draft.direction);
  const [flank, setFlank] = useState<'top' | 'bottom'>(draft.flank), [pattern, setPattern] = useState(draft.pattern);
  const [marking, setMarking] = useState<'zonal' | 'man'>(draft.marking), [wallSize, setWallSize] = useState(draft.wallSize), [seconds, setSeconds] = useState(draft.seconds);
  const [takerId, setTaker] = useState(draft.takerId || ''), [receiverId, setReceiver] = useState(draft.receiverId || ''), [outcome, setOutcome] = useState<PlayRequest['outcome']>(draft.outcome);
  const [goalTarget, setGoalTarget] = useState<PlayRequest['goalTarget']>(draft.goalTarget), [guides, setGuides] = useState(draft.guides);
  useEffect(()=>{try{sessionStorage.setItem(`touchline.playbook:${board.id}`,JSON.stringify({id:playId,side,direction,flank,pattern,marking,wallSize,seconds,takerId,receiverId,outcome,goalTarget,guides,configuring}));}catch{/* The editor still works when session storage is unavailable. */}},[board.id,playId,side,direction,flank,pattern,marking,wallSize,seconds,takerId,receiverId,outcome,goalTarget,guides,configuring]);
  const play = PLAYBOOK.find(p => p.id === playId)!;
  const restart = category === 'restart', shot = playId === 'penalty' || playId === 'free-kick' && pattern === 'direct';
  const outfield = unitPlayers(board, side, 'outfield'), takers = playId === 'goal-kick' ? board.players.filter(p => p.side === side) : outfield;
  const full = board.players.filter(p => p.side === 'home').length === 11 && board.players.filter(p => p.side === 'away').length === 11;
  const atEnd = board.activeScene === board.scenes.at(-1)?.id, actionStart = !!board.scenes.at(-1)?.ballAction;
  const unavailable = recording ? 'Finish or cancel the current move.' : !atEnd ? 'Open the final step to continue.' : actionStart ? 'Open the action’s finish step.' : !full && playId !== 'counter' ? 'Load both teams’ full XIs.' : '';
  const choose = (next: PlayId, configure=true) => { const p = PLAYBOOK.find(p => p.id === next)!; setPlayId(next); setPattern(p.patterns[0][0]); setTaker(''); setReceiver(''); setOutcome(undefined); setSeconds(next==='penalty'||next==='free-kick'?2:4); setConfiguring(configure); };
  const name = (s: Side) => board.context?.[s].shortName || (s === 'home' ? 'Home' : 'Away');
  const build = (mode: PlayRequest['mode']) => send({ type: 'build-play', options: {
    id: playId, side, direction, flank, pattern, marking, wallSize, seconds, mode, takerId: takerId || undefined, receiverId: receiverId || undefined, outcome, goalTarget, guides,
  } });
  const field = (key: string, label: string, value: string | number, change: (value: string) => void, options: readonly (readonly [string | number, string])[]) => <label className="play-field" htmlFor={`${id}-${key}`}>{label}<select id={`${id}-${key}`} value={value} onChange={e => change(e.target.value)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
  return <section className="playbook" aria-label="Tactical playbook"><fieldset disabled={disabled}><div className="playbook-body">
    {!configuring?<><div className="play-categories" aria-label="Play category">{([['open', 'Open play'], ['restart', 'Set pieces']] as const).map(([value, label]) => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); choose(value === 'open' ? 'counter' : 'corner',false); }}>{value === 'restart' ? <Flag size={15}/> : <Play size={15}/>} {label}</button>)}</div>
    <div className="play-grid" aria-label={restart ? 'Set piece options' : 'Open play options'}>{PLAYBOOK.filter(p => p.category === category).map(p => <button key={p.id} aria-pressed={playId === p.id} onClick={() => choose(p.id)}>{p.name}<ArrowRight size={13}/></button>)}</div>
    </>:<><div className="play-config-heading"><button onClick={()=>setConfiguring(false)}><ArrowLeft size={16}/>All plays</button><strong>{play.name}</strong></div><div className="play-fields">
      {field('team', playId === 'high-press' || playId === 'low-block' ? 'Defending team' : 'Team', side, value => { const next = value as Side; setSide(next); setDirection(next === 'home' ? 'right' : 'left'); setTaker(''); setReceiver(''); }, [['home', name('home')], ['away', name('away')]])}
      {field('direction', 'Team attacks', direction, value => setDirection(value as 'left' | 'right'), [['right', 'Right →'], ['left', '← Left']])}
      {!['penalty', 'high-press', 'low-block', 'counter'].includes(playId) && field('flank', restart ? 'Restart side' : 'Ball side', flank, value => setFlank(value as 'top' | 'bottom'), [['top', 'Top touchline'], ['bottom', 'Bottom touchline']])}
      {play.patterns.length > 1 && field('pattern', playId === 'corner' || playId === 'free-kick' ? 'Delivery' : 'Routine', pattern, setPattern, play.patterns)}
      {restart && field('taker', 'Taker', takerId, value => { setTaker(value); if (value === receiverId) setReceiver(''); }, [['', playId === 'goal-kick' ? 'Goalkeeper' : 'Automatic'], ...takers.map(p => [p.uid, `${p.number || ''} ${p.name}`.trim()] as const)])}
      {restart && !shot && field('runner', playId === 'corner' ? 'Main runner' : 'Receiver', receiverId, setReceiver, [['', 'Automatic'], ...outfield.filter(p => p.uid !== takerId).map(p => [p.uid, `${p.number || ''} ${p.name}`.trim()] as const)])}
      {(playId === 'corner' || playId === 'free-kick' && !shot) && field('marking', 'Defence', marking, value => setMarking(value as 'zonal' | 'man'), [['zonal', 'Zonal'], ['man', 'Player marking']])}
      {playId === 'free-kick' && field('wall', 'Wall', wallSize, value => setWallSize(+value), [[3, '3 players'], [4, '4 players'], [5, '5 players']])}
      {shot && <>{field('target', 'Shot target', goalTarget, value => setGoalTarget(value as PlayRequest['goalTarget']), [['left', 'Left'], ['centre', 'Centre'], ['right', 'Right']])}{field('outcome', 'Planned outcome', outcome || '', value => setOutcome((value || undefined) as PlayRequest['outcome']), [['', 'Choose for animation…'], ['goal', 'Goal'], ['saved', 'Saved'], ['off-target', 'Wide']])}</>}
      {field('seconds', shot ? 'Ball travel time' : 'Movement time', seconds, value => setSeconds(+value), [2, 3, 4, 6].map(n => [n, `${n}s`] as const))}
    </div>
    <label className="play-guides"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)}/>Show runs & distances</label>
    </>}</div>{configuring&&<div className="playbook-actions">
    {unavailable && <div className="play-status" role="status">{unavailable}{!atEnd && <button disabled={recording} onClick={() => send({ type: 'scene', id: board.scenes.at(-1)!.id })}>Final step<ArrowRight size={14}/></button>}</div>}
    <div className="play-build"><button disabled={!!unavailable || !full} onClick={() => build('setup')}><LayoutTemplate size={16}/>Place setup</button><button className="primary" disabled={!!unavailable || shot && !outcome} onClick={() => build('sequence')}><Play size={16}/>Animate</button></div>
  </div>}</fieldset></section>;
}
