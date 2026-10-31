import type { Board } from '../types';
import type { HostCommand } from './host/protocol';
import { shortName } from '../core';

export default function PlayerControl({board,selected,send,disabled=false,motion=false}:{board:Board;selected:string[];send:(command:HostCommand)=>void;disabled?:boolean;motion?:boolean}) {
  const player=selected.length===1?board.players.find(p=>p.uid===selected[0]):undefined;
  const owner=board.players.find(p=>p.uid===board.ball.carrierId);
  const index=board.scenes.findIndex(s=>s.id===board.activeScene),scene=board.scenes[index];
  const canMotion=index>0&&!board.scenes[index-1].ballAction;
  const update=(values:Partial<Extract<HostCommand,{type:'motion'}>>)=>send({type:'motion',easing:scene.motion?.easing||'smooth',cut:!!scene.cut,...values});
  return <fieldset className="player-control" disabled={disabled}>
    <div className="analysis-section-title"><span>POSSESSION</span><span className={owner?'possession-badge':''}>{owner?shortName(owner.name):'Loose ball'}</span></div>
    <label className="film-field">Ball carrier<select aria-label="Ball carrier" value={owner?.uid||''} onChange={e=>send({type:'possession',playerId:e.target.value||null})}><option value="">Loose ball</option>{board.players.map(p=><option key={p.uid} value={p.uid}>{p.name}</option>)}</select></label>
    {player&&<button className="film-button" onClick={()=>send({type:'possession',playerId:owner?.uid===player.uid?null:player.uid})}>{owner?.uid===player.uid?'Release ball':`Give ball to ${shortName(player.name)}`}</button>}
    {motion&&canMotion&&<div className="motion-editor"><div className="analysis-section-title"><span>INTO THIS STEP</span><span>{index+1}</span></div>
      <div className="film-segment"><button aria-pressed={!scene.cut} onClick={()=>update({cut:false})}>Animate</button><button aria-pressed={!!scene.cut} onClick={()=>update({cut:true})}>Cut</button></div>
      {!scene.cut&&<><label className="film-field">Movement speed<select aria-label="Movement easing" value={scene.motion?.easing||'smooth'} onChange={e=>update({easing:e.target.value as 'smooth'|'linear'})}><option value="smooth">Ease in & out</option><option value="linear">Constant speed</option></select></label>
      {player?<label className="film-field">{shortName(player.name)} · run curve<input aria-label="Selected player run curve" type="range" min="-.8" max=".8" step=".1" value={scene.motion?.curves[player.uid]||0} onChange={e=>update({playerId:player.uid,curve:+e.target.value})}/><span className="curve-scale"><span>Left</span><button onClick={()=>update({playerId:player.uid,curve:0})}>Straight</button><span>Right</span></span></label>:<small>Select one player to curve their run.</small>}</>}
    </div>}
  </fieldset>;
}
