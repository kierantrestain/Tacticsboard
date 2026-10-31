import { useStudio } from '../store';
import { frameAt, shortName } from '../core';
import { useRuntime } from './runtime';
import { passingOptions, pitchDistance, teamDimensions } from './spatialAnalysis';
export default function SpatialInsights(){
  const s=useStudio(),r=useRuntime(),b=s.board!,frame=s.previewTime===null?b:frameAt(b,s.previewTime);
  const owner=frame.players.find(p=>p.uid===frame.ball.carrierId),player=frame.players.find(p=>p.uid===s.selected[0])||owner;
  const options=passingOptions(frame,player?.uid),nearest=player?frame.players.filter(p=>p.side!==player.side).map(p=>({p,distance:pitchDistance(player,p)})).sort((a,b)=>a.distance-b.distance)[0]:undefined;
  return <section className="spatial-insights"><div className="analysis-section-title"><span>BOARD INSIGHTS</span><span>105 × 68 m</span></div><p className="spatial-note">From the positions on this board.</p>
    {(['home','away'] as const).map(side=>{const d=teamDimensions(frame.players.filter(p=>p.side===side));return d&&<article className="spatial-team" key={side}><h3><i style={{background:b.colors[side]}}/>{b.context?.[side].shortName||side}</h3><div><div><span>Width</span><strong>{d.width.toFixed(1)}<small>m</small></strong></div><div><span>Depth</span><strong>{d.depth.toFixed(1)}<small>m</small></strong></div></div><small>{d.count} outfield players</small></article>;})}
    {player?<><div className="analysis-section-title"><span>SELECTED PLAYER</span><span>{shortName(player.name)}</span></div><div className="spatial-player-metrics"><div><span>To ball</span><strong>{pitchDistance(player,frame.ball).toFixed(1)} m</strong></div><div><span>Nearest opponent</span><strong>{nearest?`${shortName(nearest.p.name)} · ${nearest.distance.toFixed(1)} m`:'—'}</strong></div></div><button className="film-button" aria-pressed={!!b.settings.passingLanes} disabled={!owner} onClick={()=>s.commit(board=>{board.settings.passingLanes=!board.settings.passingLanes;})}>{b.settings.passingLanes?'Hide':'Show'} carrier’s passing lanes</button>
      <h4>Options within 40 m</h4><div className="spatial-options">{options.map(o=><button key={o.receiver.uid} onClick={()=>{s.set({selected:[o.receiver.uid],playing:false});r.set({multiSelect:false});}}><div><strong>{shortName(o.receiver.name)}</strong><small>{o.blocked?'Opponent in corridor':'Clear corridor'}</small></div><span>{o.distance.toFixed(1)} m</span><i className={o.blocked?'blocked':''}/></button>)}</div><p className="spatial-note">Corridor: 1.5 m either side of a straight pass. This is geometry, not a prediction.</p></>:<p className="spatial-note">Select a player or assign a ball carrier to inspect distances and passing corridors.</p>}
  </section>;
}
