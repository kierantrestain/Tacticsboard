import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Match, Team, Player } from '../types';
import type { LeagueTable } from './types';
import { useStudio } from '../store';
import { TeamBadge } from './ClubBadge';
import { buildTeamAnalysis } from './teamAnalysis';
import { metricText } from './metrics';
import ComparisonPanel from './ComparisonPanel';
import StatExplorer from './StatExplorer';
import PlayerData from './PlayerData';
import MatchReport from './MatchReport';
import { loadReport, requestFootball } from './data';
export default function LeagueTeams({league,year,teams,matches,table}:{league:string;year:number;teams:Team[];matches:Match[];table?:LeagueTable}) {
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [loading,setLoading]=useState(false),[progress,setProgress]=useState(''),[squads,setSquads]=useState<Record<string,Player[]>>({});
  const reports=useStudio(s=>s.summaries),[q,setQ]=useState(''),[compare,setCompare]=useState<string[]>([]),[expanded,setExpanded]=useState(''),[tab,setTab]=useState<'stats'|'fixtures'|'squad'>('stats'),[matchId,setMatchId]=useState(''),[playerId,setPlayerId]=useState('');
  const rows=useMemo(()=>buildTeamAnalysis(teams,matches,reports,table,league,year),[teams,matches,reports,table,league,year]);
  const filtered=rows.filter(r=>r.team.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(Number(b.stats.points?.value)||0)-(Number(a.stats.points?.value)||0)||a.name.localeCompare(b.name));
  const scope=`${league==='eng.1'?'Premier League':'Champions League'} · ${year}/${String(year+1).slice(-2)}`;
  const selected=compare.flatMap(id=>rows.filter(r=>r.id===id));
  const loadReports=async(ids:string[])=>{
    const wanted=rows.filter(r=>ids.includes(r.id)).flatMap(r=>r.fixtures.filter(m=>m.completed&&!reports[m.id]?.teamStats?.some(s=>s.teamId===r.id)));
    const queue=[...new Map(wanted.map(m=>[m.id,m])).values()];setLoading(true);let checked=0,unavailable=0;setProgress(`Checking ${queue.length} reports…`);
    try{for(let i=0;i<queue.length;i+=3){if(!alive.current)return;const results=await Promise.allSettled(queue.slice(i,i+3).map(m=>loadReport(m)));if(!alive.current)return;for(const result of results){checked++;if(result.status==='rejected'||!result.value.teamStats?.length)unavailable++;}setProgress(`${checked}/${queue.length} reports checked${unavailable?` · ${unavailable} unavailable`:''}`);}}
    finally{if(alive.current)setLoading(false);}
  };
  const loadSquad=async(teamId:string)=>{setLoading(true);setProgress('Checking season squad…');try{const response=await requestFootball(`action=roster&league=${league}&team=${teamId}&season=${year}`,3600000);if(alive.current){setSquads(old=>({...old,[teamId]:Array.isArray(response.players)?response.players:[]}));setProgress('Squad checked.');}}catch{if(alive.current)setProgress('This season squad is unavailable.');}finally{if(alive.current)setLoading(false);}};
  return <section className="league-teams"><div className="data-section-heading"><div><span className="data-eyebrow">CLUB INTELLIGENCE</span><h2>Team analysis</h2><p>{scope} · {rows.length} teams</p></div><label className="mi-search"><Search size={16}/><input aria-label="Search teams" value={q} onChange={e=>setQ(e.target.value)} placeholder="Find a team…"/></label></div>
    <p className="data-source">Official table + published results. Report averages use available completed match reports; each metric shows its sample count. Squad statistics stay in the player explorer.</p>
    {!!selected.length&&<ComparisonPanel entities={selected} kind="teams" scope={scope} source="ESPN standings, published fixtures & available match reports" updatedAt={table?.updatedAt} onClear={()=>setCompare([])} onRemove={id=>setCompare(compare.filter(x=>x!==id))}/>}
    {!!selected.length&&<button className="team-load-data" disabled={loading} onClick={()=>void loadReports(compare)}>Load season reports for compared teams</button>}{progress&&<p className="data-source" role="status">{progress}</p>}
    <div className="team-data-list">{filtered.map(r=><article className={`team-data-card ${expanded===r.id?'expanded':''}`} key={r.id}><header><button className="team-data-name" aria-expanded={expanded===r.id} aria-label={`Team analysis for ${r.team.name}`} onClick={()=>{setExpanded(expanded===r.id?'':r.id);setTab('stats');setMatchId('');setPlayerId('');}}><TeamBadge team={r.team} size="large"/><div><strong>{r.team.name}</strong><small>{r.subtitle}</small></div><ChevronDown size={16}/></button><div className="team-data-summary">{['points','pointsFor','pointsAgainst','resultsPPG'].map(k=><div key={k}><span>{({points:'PTS',pointsFor:'GF',pointsAgainst:'GA',resultsPPG:'PPG'})[k]}</span><strong>{metricText(r.stats,k)}</strong></div>)}</div><div className="team-form" aria-label="Last five results">{r.form.map(f=><span key={f.id} data-result={f.result} title={`${f.goalsFor}–${f.goalsAgainst}`}>{f.result}</span>)}</div><button className="team-compare-button" aria-label={`Compare ${r.team.name}`} aria-pressed={compare.includes(r.id)} disabled={!compare.includes(r.id)&&compare.length>=5} onClick={()=>setCompare(compare.includes(r.id)?compare.filter(x=>x!==r.id):[...compare,r.id])}>{compare.includes(r.id)?'✓ Added':'+ Compare'}</button></header>
      {expanded===r.id&&<div className="team-data-detail"><nav className="mi-tabs">{(['stats','fixtures','squad'] as const).map(t=><button key={t} aria-pressed={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='stats'?'All statistics':t==='fixtures'?'Matches & reports':'Squad'}</button>)}</nav>
        {tab==='stats'&&<><button className="team-load-data" disabled={loading} onClick={()=>void loadReports([r.id])}>{loading?'Checking reports…':'Load available season reports'}</button><StatExplorer stats={r.stats} kind="team"/><p className="data-source">{r.reportCount}/{r.completed} completed matches have team report data. Report averages use each metric’s available matches, with sample counts in comparisons. Published result totals can cover fewer matches than the official table.</p></>}
        {tab==='fixtures'&&<>{r.fixtures.map(m=><div key={m.id}><button className="team-match-row" aria-expanded={matchId===m.id} onClick={()=>setMatchId(matchId===m.id?'':m.id)}><time>{new Date(m.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</time><span>{m.homeName} v {m.awayName}</span><strong>{m.completed?`${m.homeScore??'—'} : ${m.awayScore??'—'}`:m.status}</strong></button>{matchId===m.id&&<MatchReport match={m} compact/>}</div>)}</>}
        {tab==='squad'&&<>{(squads[r.id]||r.team.players).length?(squads[r.id]||r.team.players).map(p=><div key={p.id}><button className="team-squad-row" aria-expanded={playerId===p.id} onClick={()=>setPlayerId(playerId===p.id?'':p.id)}><span>{p.number||'—'}</span><strong>{p.name}</strong><small>{p.position||'Player'}</small></button>{playerId===p.id&&<PlayerData player={p} team={r.team} league={league} seasonYear={year}/>}</div>):<div className="mi-empty"><p>No squad loaded for this season.</p><button className="team-load-data" disabled={loading} onClick={()=>void loadSquad(r.id)}>Check season squad</button></div>}</>}
      </div>}
    </article>)}</div>{!filtered.length&&<p className="mi-empty">No teams found for this season.</p>}
  </section>;
}
