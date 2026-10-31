import { useId, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronsLeftRight, ChevronsRightLeft, Layers, MousePointer2, Play, Users, X } from 'lucide-react';
import type { Board, Side } from '../types';
import type { HostCommand } from './host/protocol';
import { unitPlayers, type AttackDirection, type PlayerUnit, type UnitOperation } from './teamMovement';
import './teamMovement.css';

const units: { id: PlayerUnit; label: string }[] = [
  {id:'outfield',label:'Outfield'}, {id:'team',label:'Whole team'}, {id:'back',label:'Back line'},
  {id:'midfield',label:'Midfield'}, {id:'front',label:'Attack'}, {id:'selected',label:'My selection'},
];
export default function TeamMovementPanel({board,selected,onSelect,multiSelect,onMultiSelect,send,disabled=false,recording=false}: {
  board:Board; selected:string[]; onSelect:(ids:string[])=>void;
  multiSelect:boolean; onMultiSelect:(enabled:boolean)=>void;
  send:(command:HostCommand)=>void; disabled?:boolean; recording?:boolean;
}) {
  const id=useId(), [side,setSide]=useState<Side>('home'),[unit,setUnit]=useState<PlayerUnit>('outfield');
  const [directions,setDirections]=useState<Record<Side,AttackDirection>>({home:'right',away:'left'});
  const [counterSide,setCounterSide]=useState<Side>('home'),[seconds,setSeconds]=useState(4);
  const direction=directions[side], members=unitPlayers(board,side,unit,selected), ids=members.map(p=>p.uid);
  const name=(side:Side)=>board.context?.[side].shortName||(side==='home'?'Home':'Away');
  const choose=(nextSide:Side,nextUnit:PlayerUnit)=>{setSide(nextSide);setUnit(nextUnit);onSelect(unitPlayers(board,nextSide,nextUnit,selected).map(p=>p.uid));onMultiSelect(false);};
  const move=(operation:UnitOperation)=>{onSelect(ids);onMultiSelect(false);send({type:'unit-move',action:{ids,operation,direction}});};
  const last=board.scenes.at(-1), atEnd=board.activeScene===last?.id;
  const counterReady=unitPlayers(board,counterSide,'outfield').length>0&&unitPlayers(board,counterSide==='home'?'away':'home','outfield').length>0;
  return <section className="team-movement" aria-label="Team movement controls">
    <fieldset disabled={disabled}>
      <div className="tm-heading"><span><Users size={15}/>MOVE A UNIT</span><small>{members.length} players</small></div>
      <details className="tm-details tm-counter"><summary><Play size={14}/>Build a counterattack</summary><p>Moves the attack and the recovering defence together in two editable stages.</p><label className="tm-field" htmlFor={`${id}-counter`}>Attacking team<select id={`${id}-counter`} value={counterSide} onChange={e=>setCounterSide(e.target.value as Side)}><option value="home">{name('home')}</option><option value="away">{name('away')}</option></select></label><div className="tm-counter-fields"><label className="tm-field" htmlFor={`${id}-counter-direction`}>Attacking goal<select id={`${id}-counter-direction`} value={directions[counterSide]} onChange={e=>setDirections(old=>({...old,[counterSide]:e.target.value as AttackDirection}))}><option value="right">Right →</option><option value="left">← Left</option></select></label><label className="tm-field" htmlFor={`${id}-seconds`}>Movement<select id={`${id}-seconds`} value={seconds} onChange={e=>setSeconds(+e.target.value)}>{[3,4,6].map(t=><option key={t} value={t}>{t} seconds</option>)}</select></label></div>
        {!atEnd&&<button className="tm-open-end" disabled={recording} onClick={()=>last&&send({type:'scene',id:last.id})}>Open final step to continue<ArrowRight size={15}/></button>}
        <button className="tm-counter-build" disabled={!atEnd||!counterReady||recording} onClick={()=>{onSelect([]);onMultiSelect(false);send({type:'counterattack',options:{side:counterSide,direction:directions[counterSide],seconds}});}}><Play size={16}/>Animate attack + recovery</button>
        <small>{recording?'Finish or cancel the current move first.':!counterReady?'Load players from both teams first.':'Editable tactical setup. Adjust it to match the passage you are explaining.'}</small>
      </details>
      <div className="tm-teams" aria-label="Team to move">{(['home','away'] as const).map(team=><button key={team} aria-pressed={side===team} onClick={()=>choose(team,unit==='selected'?'outfield':unit)}><i style={{background:board.colors[team]}}/>{name(team)}</button>)}</div>
      <div className="tm-context-fields"><label className="tm-field" htmlFor={`${id}-unit`}>Players to move<select id={`${id}-unit`} value={unit} onChange={e=>choose(side,e.target.value as PlayerUnit)}>{units.map(u=><option key={u.id} value={u.id}>{u.label}{u.id==='outfield'?' · keeper stays':''}</option>)}</select></label><label className="tm-field" htmlFor={`${id}-direction`}>Team attacks<select id={`${id}-direction`} value={direction} onChange={e=>setDirections(old=>({...old,[side]:e.target.value as AttackDirection}))}><option value="right">Right →</option><option value="left">← Left</option></select></label></div>
      <div className="tm-select-row"><button onClick={()=>onSelect(ids)} disabled={!ids.length}><Check size={14}/>Select {members.length}</button><button aria-pressed={multiSelect} onClick={()=>{setUnit('selected');onMultiSelect(!multiSelect);}}><MousePointer2 size={14}/>Pick players</button><button aria-label="Clear player selection" onClick={()=>{onSelect([]);onMultiSelect(false);}}><X size={15}/></button></div>
      <p className="tm-hint">{multiSelect?'Tap players to add or remove them. Turn Pick players off to drag the group.':selected.length>1?`${selected.length} selected. Drag any selected player to move them together.`:'Select a unit, then drag any selected player or use the controls below.'}</p>

      <div className="tm-nudge" aria-label="Move selected unit">
        <button disabled={!ids.length} onClick={()=>move('back')}>{direction==='right'?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}Drop back</button>
        <button disabled={!ids.length} onClick={()=>move('forward')}>{direction==='right'?<ArrowRight size={17}/>:<ArrowLeft size={17}/>}Push up</button>
        <button disabled={!ids.length} onClick={()=>move('up')}><ArrowUp size={16}/>Shift up</button><button disabled={!ids.length} onClick={()=>move('down')}><ArrowDown size={16}/>Shift down</button>
      </div>
      <div className="tm-spacing"><button disabled={ids.length<2} onClick={()=>move('narrow')}><ChevronsRightLeft size={16}/>Narrower</button><button disabled={ids.length<2} onClick={()=>move('widen')}><ChevronsLeftRight size={16}/>Wider</button><button disabled={ids.length<2} onClick={()=>move('line')}><Layers size={15}/>Align line</button></div>
      <details className="tm-details"><summary>Set the defensive shape</summary><p>Repositions this team's XI. The opponent and ball stay in place.</p><div className="tm-shapes">{([['low','Low block'],['mid','Mid block'],['high','High press']] as const).map(([shape,label])=><button key={shape} disabled={board.players.filter(p=>p.side===side).length!==11} onClick={()=>{onSelect(unitPlayers(board,side,'outfield').map(p=>p.uid));send({type:'team-shape',side,shape,direction});}}>{label}</button>)}</div>{board.players.filter(p=>p.side===side).length!==11&&<small>Load this team's full match XI to use a shape.</small>}</details>

    </fieldset>
  </section>;
}
