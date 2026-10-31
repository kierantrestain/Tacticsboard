import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Board, Drawing, Frame } from '../../types';
import { clamp, shortName, uid } from '../../core';
import type { HostCommand } from './protocol';
import { translateGroup } from '../teamMovement';
import { playerNameOffsets } from '../labelLayout';
export type TouchTool = 'move' | 'pen' | 'arrow' | 'run' | 'ellipse' | 'zone' | 'erase';
const x = (n: number) => 65 + n * 1070, y = (n: number) => 48 + n * 664;
function Shape({ d }: { d: Drawing }) {
  const p = d.points, a = x(p[0]), b = y(p[1]), c = x(p.at(-2)!), e = y(p.at(-1)!);
  const common = { stroke: d.color, strokeWidth: Math.max(3, d.width), opacity: d.opacity, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (d.type === 'ellipse' || d.type === 'spotlight') return <ellipse data-mark={d.id} cx={(a + c) / 2} cy={(b + e) / 2} rx={Math.abs(c - a) / 2} ry={Math.abs(e - b) / 2} {...common} fill={d.type === 'spotlight' ? d.color : 'none'} fillOpacity={.12}/>;
  if (d.type === 'zone') return <rect data-mark={d.id} x={Math.min(a, c)} y={Math.min(b, e)} width={Math.abs(c - a)} height={Math.abs(e - b)} {...common} fill={d.color} fillOpacity={.12} rx={7}/>;
  if (d.type === 'text') return <text x={a} y={b} fill={d.color} fontSize={24}>{d.text}</text>;
  const points = p.reduce<number[]>((all, n, i) => [...all, i % 2 ? y(n) : x(n)], []).join(' ');
  return <g data-mark={d.id}><polyline points={points} {...common} strokeDasharray={d.type === 'run' ? '12 9' : undefined}/>{['arrow', 'run'].includes(d.type) && <path d="M-16 -8 0 0 -16 8" transform={`translate(${c},${e}) rotate(${Math.atan2(e - b, c - a) * 180 / Math.PI})`} {...common}/>}<polyline points={points} stroke="transparent" strokeWidth={24} fill="none"/></g>;
}
export default function HostPitch({ board, frame, tool, selected, setSelected, send, disabled, image, footage = false, aspect = 16/9, ink = [], pickingTarget=false,onTarget,multiSelect=false,preserveSelection=false }: { board: Board; frame: Frame; tool: TouchTool; selected: string[]; setSelected: (ids: string[]) => void; send: (c: HostCommand) => void; disabled: boolean; image?: string; footage?: boolean; aspect?:number; ink?:Drawing[];pickingTarget?:boolean;onTarget?:(p:{x:number;y:number})=>void;multiSelect?:boolean;preserveSelection?:boolean }) {
  const mediaHeight = 1200/Math.max(.25,Math.min(4,aspect));
  const svg = useRef<SVGSVGElement>(null), lastSend = useRef(0);
  const gesture = useRef<{ id: string; origin: { x: number; y: number }; positions: { id: string; x: number; y: number }[]; drawing?: Drawing; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number }[]>([]), [draft, setDraft] = useState<Drawing | null>(null);
  const previousBoard=useRef(board.id);
  useEffect(() => { if (disabled) { gesture.current = null; setGhost([]); setDraft(null); } }, [disabled]);
  useEffect(() => { gesture.current = null; setGhost([]); setDraft(null); if(!preserveSelection||previousBoard.current!==board.id)setSelected([]);previousBoard.current=board.id; }, [board.activeScene, board.id]);
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const node = svg.current!, p = node.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const matrix = node.getScreenCTM(); if (!matrix) return { x: .5, y: .5 };
    const local = p.matrixTransform(matrix.inverse());
    return footage ? { x: clamp(local.x / 1200), y: clamp(local.y / mediaHeight) } : { x: clamp((local.x - 65) / 1070), y: clamp((local.y - 48) / 664) };
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || !e.isPrimary) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.target as Element, id = target.closest('[data-player]')?.getAttribute('data-player'), p = point(e);
    if(pickingTarget&&!footage){onTarget?.(p);return;}
    if (tool === 'erase') { const mark = target.closest('[data-mark]')?.getAttribute('data-mark'); if (mark) send({ type: 'erase', id: mark }); return; }
    if (tool === 'move' && !footage) {
      if (multiSelect) { if(id&&id!=='ball')setSelected(selected.includes(id)?selected.filter(uid=>uid!==id):[...selected,id]);return; }
      const ids = id ? selected.includes(id) ? selected : [id] : selected;
      if (!ids.length) { setSelected([]); return; }
      setSelected(ids);
      const positions = ids.flatMap(id => { const t = id === 'ball' ? frame.ball : frame.players.find(p => p.uid === id); return t ? [{ id, x: t.x, y: t.y }] : []; });
      const centre = positions.reduce((a, p) => ({ x: a.x + p.x / positions.length, y: a.y + p.y / positions.length }), { x: 0, y: 0 });
      gesture.current = { id: uid(), origin: id ? p : centre, positions, moved: !id }; return;
    }
    if (tool === 'move') return;
    const drawing: Drawing = { id: uid(), type: tool, points: [p.x, p.y, p.x, p.y], color: '#e1ff7b', width: 4, opacity: 1 };
    gesture.current = { id: uid(), origin: p, positions: [], drawing, moved: false }; setDraft(drawing);
  };
  const move = (e: PointerEvent<SVGSVGElement>, final = false) => {
    const g = gesture.current; if (!g || disabled) return;
    const p = point(e), delta = { x: p.x - g.origin.x, y: p.y - g.origin.y };
    if (Math.hypot(delta.x, delta.y) > .004) g.moved = true;
    if (g.drawing) {
      const d = g.drawing;
      const next = { ...d, points: d.type === 'pen' ? [...d.points.slice(-3996), p.x, p.y] : [d.points[0], d.points[1], p.x, p.y] };
      if (final && !g.moved && d.type === 'ellipse') { next.points = [clamp(p.x-.03),clamp(p.y-.045),clamp(p.x+.03),clamp(p.y+.045)]; g.moved = true; }
      g.drawing = next; setDraft(next);
      if (final && g.moved) send({ type: 'draw', drawing: next });
    } else if (g.moved) {
      const positions = translateGroup(g.positions,delta.x,delta.y);
      setGhost(positions);
      if (final || performance.now() - lastSend.current > 80) { lastSend.current = performance.now(); send({ type: 'move', gesture: g.id, positions, final }); }
    }
    if (final) { gesture.current = null; setDraft(null); setTimeout(() => setGhost([]), 180); }
  };
  const cancel = () => { if (gesture.current?.positions.length) send({ type: 'cancel-gesture' }); gesture.current = null; setGhost([]); setDraft(null); };
  const viewBox = footage ? `0 0 1200 ${mediaHeight}` : board.settings.view === 'left' ? '0 0 650 760' : board.settings.view === 'right' ? '550 0 650 760' : '0 0 1200 760';
  const ball = ghost.find(p => p.id === 'ball') || frame.ball;
  const visiblePlayers=frame.players.filter(p=>p.side==='home'?board.settings.homeVisible:board.settings.awayVisible);
  const labelOffsets=playerNameOffsets(visiblePlayers.map(p=>({...p,...ghost.find(q=>q.id===p.uid)})));
  return <svg ref={svg} className={`host-pitch tool-${tool}`} viewBox={viewBox} role="application" aria-label={footage ? 'Mark the paused footage' : 'Touch tactical board. Select or drag a player.'} onPointerDown={down} onPointerMove={e => move(e)} onPointerUp={e => move(e, true)} onPointerCancel={cancel}>
    {footage ? <><rect width="1200" height={mediaHeight} fill="#0b1011"/>{image && <image href={image} width="1200" height={mediaHeight} preserveAspectRatio="xMidYMid meet"/>}{tool==='erase'&&<g opacity="0" transform={`translate(${-65*1200/1070},${-48*mediaHeight/664}) scale(${1200/1070},${mediaHeight/664})`}>{ink.map(d=><Shape key={d.id} d={d}/>)}</g>}</> : <>
      <rect width="1200" height="760" rx="20" fill="#152d23"/><rect x="65" y="48" width="1070" height="664" rx="2" fill="#285c3d"/>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={65 + i * 107} y={48} width={107} height={664} fill={i % 2 ? '#ffffff' : '#000000'} opacity={.014}/>)}
      <g fill="none" stroke="#c4d4cf" strokeWidth="2" opacity=".6"><rect x="65" y="48" width="1070" height="664"/><path d="M600 48v664M65 185h165v390H65M1135 185H970v390h165M65 290h55v180H65M1135 290h-55v180h55"/><circle cx="600" cy="380" r="89"/><path d="M230 307a89 89 0 0 1 0 146M970 307a89 89 0 0 0 0 146"/></g>
      <g fill="#c4d4cf" opacity=".8"><circle cx="600" cy="380" r="3"/><circle cx="175" cy="380" r="3"/><circle cx="1025" cy="380" r="3"/></g>
      {board.settings.lanes && [.2,.4,.6,.8].map(n => <path key={n} d={`M65 ${y(n)}H1135`} stroke="#e1ff7b" opacity=".22" strokeDasharray="9 8"/>)}
      {board.settings.thirds && [1/3,2/3].map(n => <path key={n} d={`M${x(n)} 48V712`} stroke="#e1ff7b" opacity=".22" strokeDasharray="9 8"/>)}
      {frame.drawings.map(d => <Shape key={d.id} d={d}/>)}
      {frame.players.filter(p => p.side === 'home' ? board.settings.homeVisible : board.settings.awayVisible).map(p => { const position = ghost.find(q => q.id === p.uid) || p, active = selected.includes(p.uid), name = shortName(p.name); return <g key={p.uid} data-player={p.uid} transform={`translate(${x(position.x)},${y(position.y)})`} opacity={board.settings.focusPlayer && board.settings.focusPlayer !== p.uid ? .25 : 1}>
        <circle r="39" fill="transparent"/>{active && <circle r="30" stroke="#e1ff7b" strokeWidth="2.5" strokeDasharray="3 4" fill="none"/>}<circle cy="4" r="23" fill="#070d10" opacity=".4"/><circle r="23" fill={board.colors[p.side]} stroke="#ffffffb0" strokeWidth="2"/>
        {board.settings.numbers && <text textAnchor="middle" y="7" fontSize="21" fontWeight="750" fill="#fff" stroke="#000" strokeWidth=".4" paintOrder="stroke">{p.number}</text>}
        {board.settings.names && <g transform={`translate(0,${labelOffsets.get(p.uid)||0})`}><rect x={-Math.min(63, name.length * 3.8 + 8)} y="28" width={Math.min(126, name.length * 7.6 + 16)} height="21" rx="6" fill="#0a151bf0"/><text textAnchor="middle" y="44" fill="#f7faf9" fontSize="15" fontWeight="600">{name.length > 17 ? name.slice(0,16) + '…' : name}</text></g>}
      </g>; })}
      {board.settings.ballVisible !== false && <g data-player="ball" transform={`translate(${x(ball.x)},${y(ball.y)})`}><circle r="31" fill="transparent"/><circle r="10" fill="#fff" stroke="#070d10" strokeWidth="2"/><circle r="3.5" fill="#243a3d"/>{selected.includes('ball') && <circle r="17" stroke="#e1ff7b" fill="none" strokeWidth="2"/>}</g>}
    </>}
    {draft && (footage ? <g transform={`translate(${-65*1200/1070},${-48*mediaHeight/664}) scale(${1200/1070},${mediaHeight/664})`}><Shape d={draft}/></g> : <Shape d={draft}/>)}
  </svg>;
}
