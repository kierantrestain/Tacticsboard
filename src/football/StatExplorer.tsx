import { useState } from 'react';
import type { Stat } from '../types';
import { metricGroup, metricGroups, metricText } from './metrics';
export default function StatExplorer({stats,kind='player'}:{stats:Record<string,Stat>;kind?:'player'|'team'}){
  const [filter,setFilter]=useState(''),[group,setGroup]=useState('All'),[per90,setPer90]=useState(false);
  const entries=Object.entries(stats),shown=entries.filter(([k,v])=>(group==='All'||metricGroup(k,v.label)===group)&&(k+' '+v.label).toLowerCase().includes(filter.toLowerCase()));
  const preferred=kind==='player'?['goals_scored','totalGoals','assists','goalAssists','expected_goals','minutes','minutesPlayed']:['points','pointsFor','pointsAgainst','resultsPPG','resultsCleanSheets'];
  const hero=preferred.filter(k=>stats[k]).slice(0,4);
  return <section className="stat-explorer">
    {!!hero.length&&<div className="data-stat-heroes">{hero.map(k=><article key={k}><span>{stats[k].label}</span><strong>{metricText(stats,k,per90)}</strong></article>)}</div>}
    <div className="stat-explorer-tools"><input className="fc-stat-search" aria-label={`Filter ${kind} statistics`} placeholder="Find a statistic…" value={filter} onChange={e=>setFilter(e.target.value)}/>{kind==='player'&&<div className="mi-segmented"><button aria-pressed={!per90} onClick={()=>setPer90(false)}>Totals</button><button aria-pressed={per90} onClick={()=>setPer90(true)}>Per 90</button></div>}</div>
    <div className="mi-chips">{metricGroups.filter(g=>g==='All'||entries.some(([k,v])=>metricGroup(k,v.label)===g)).map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
    <div className="data-stat-list">{shown.map(([k,v])=><div key={k}><span>{v.label}</span><strong>{metricText(stats,k,per90)}</strong></div>)}</div>
    {!shown.length&&<p className="mi-empty">No statistics available for this selection.</p>}
  </section>;
}
