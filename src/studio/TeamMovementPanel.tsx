import { useId, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronsLeftRight, ChevronsRightLeft, Layers, MousePointer2, Play, Users, X } from 'lucide-react';
import type { Board, Side } from '../types';
import type { HostCommand } from './host/protocol';
import { unitPlayers, type AttackDirection, type PlayerUnit, type UnitOperation } from './teamMovement';
import './teamMovement.css';
import PlayerControl from './PlayerControl';

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
  const direction=directions[side], members=unitPlayers(board,side,unit,selected), ids=members.map(p=>p.uid);
  const name=(side:Side)=>board.context?.[side].shortName||(side==='home'?'Home':'Away');
  const choose=(nextSide:Side,nextUnit:PlayerUnit)=>{setSide(nextSide);setUnit(nextUnit);onSelect(unitPlayers(board,nextSide,nextUnit,selected).map(p=>p.uid));onMultiSelect(false);};
  const move=(operation:UnitOperation)=>{onSelect(ids);onMultiSelect(false);send({type:'unit-move',action:{ids,operation,direction}});};
  return <section className="team-movement" aria-label="Team movement controls">
    <PlayerControl board={board} selected={selected} send={send} disabled={disabled} motion/>
    <fieldset disabled={disabled}>
      <div className="tm-heading"><span><Users size={15}/>MOVE A UNIT</span><small>{members.length} players</small></div>
      <div className="tm-teams" aria-label="Team to move">{(['home','away'] as const).map(team=><button key={team} aria-pressed={side===team} onClick={()=>choose(team,unit==='selected'?'outfield':unit)}><i style={{background:board.colors[team]}}/>{name(team)}</button>)}</div>
      <div className="tm-context-fields"><label className="tm-field" htmlFor={`${id}-unit`}>Players to move<select id={`${id}-unit`} value={unit} onChange={e=>choose(side,e.target.value as PlayerUnit)}>{units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select></label><label className="tm-field" htmlFor={`${id}-direction`}>Team attacks<select id={`${id}-direction`} value={direction} onChange={e=>setDirections(old=>({...old,[side]:e.target.value as AttackDirection}))}><option value="right">Right →</option><option value="left">← Left</option></select></label></div>
      <div className="tm-select-row"><button onClick={()=>onSelect(ids)} disabled={!ids.length}><Check size={14}/>Select {members.length}</button><button aria-pressed={multiSelect} onClick={()=>{setUnit('selected');onMultiSelect(!multiSelect);}}><MousePointer2 size={14}/>{multiSelect?'Finish picking':'Pick players'}</button><button aria-label="Clear player selection" onClick={()=>{onSelect([]);onMultiSelect(false);}}><X size={15}/></button></div>
      <p className="tm-hint">{multiSelect?'Tap players. Finish picking to drag.':selected.length>1?`${selected.length} selected · drag together`:'Drag a unit or use the controls.'}</p>

      <div className="tm-nudge" aria-label="Move selected unit">
        <button disabled={!ids.length} onClick={()=>move('back')}>{direction==='right'?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}Drop back</button>
        <button disabled={!ids.length} onClick={()=>move('forward')}>{direction==='right'?<ArrowRight size={17}/>:<ArrowLeft size={17}/>}Push up</button>
        <button disabled={!ids.length} onClick={()=>move('up')}><ArrowUp size={16}/>Shift up</button><button disabled={!ids.length} onClick={()=>move('down')}><ArrowDown size={16}/>Shift down</button>
      </div>
      <div className="tm-spacing"><button disabled={ids.length<2} onClick={()=>move('narrow')}><ChevronsRightLeft size={16}/>Narrower</button><button disabled={ids.length<2} onClick={()=>move('widen')}><ChevronsLeftRight size={16}/>Wider</button><button disabled={ids.length<2} onClick={()=>move('line')}><Layers size={15}/>Align line</button></div>
      <details className="tm-details"><summary>Team shape</summary><div className="tm-shapes">{([['low','Low block'],['mid','Mid block'],['high','High press'],['formation','Reset formation']] as const).map(([shape,label])=><button key={shape} disabled={board.players.filter(p=>p.side===side).length!==11} onClick={()=>{onSelect(unitPlayers(board,side,'outfield').map(p=>p.uid));send({type:'team-shape',side,shape,direction});}}>{label}</button>)}<button disabled={!ids.length} onClick={()=>move('flip')}>Flip flanks</button></div>{board.players.filter(p=>p.side===side).length!==11&&<small>Full XI required.</small>}</details>

    </fieldset>
  </section>;
}
