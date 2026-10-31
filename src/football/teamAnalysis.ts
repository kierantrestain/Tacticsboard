import type { Match, MatchDetails, Stat, Team } from '../types';
import type { LeagueTable } from './types';
import type { ComparisonEntity } from './comparisonModel';
import { formatMatchStat } from '../core';
import { numericMetric } from './metrics';
export interface TeamAnalysis extends ComparisonEntity {
  team: Team;
  fixtures: Match[];
  form: { id:string; result:'W'|'D'|'L'; goalsFor:number; goalsAgainst:number }[];
  completed: number;
  reportCount: number;
}
const stat=(label:string,value:number):Stat=>({label,value,display:Number.isInteger(value)?String(value):value.toFixed(2)});
export function buildTeamAnalysis(teams:Team[],matches:Match[],reports:Record<string,MatchDetails>,table:LeagueTable|undefined,league:string,year:number):TeamAnalysis[] {
  const inSeason=matches.filter(m=>m.league===league&&(m.seasonYear===undefined||m.seasonYear===year)&&m.date.slice(0,10)>=`${year}-07-01`&&m.date.slice(0,10)<`${year+1}-07-01`);
  const tableRows=table?.groups.flatMap(g=>g.entries)||[];
  return teams.filter(t=>inSeason.some(m=>m.homeId===t.id||m.awayId===t.id)||tableRows.some(r=>r.teamId===t.id)).map(team=>{
    const fixtures=inSeason.filter(m=>m.homeId===team.id||m.awayId===team.id).sort((a,b)=>a.date.localeCompare(b.date));
    const results=fixtures.filter(m=>m.completed&&m.homeScore!=null&&m.awayScore!=null&&m.homeScore!==''&&m.awayScore!==''&&Number.isFinite(Number(m.homeScore))&&Number.isFinite(Number(m.awayScore))).map(m=>{
      const home=m.homeId===team.id,goalsFor=Number(home?m.homeScore:m.awayScore),goalsAgainst=Number(home?m.awayScore:m.homeScore);
      return {id:m.id,home,goalsFor,goalsAgainst,result:(goalsFor>goalsAgainst?'W':goalsFor<goalsAgainst?'L':'D') as 'W'|'D'|'L'};
    });
    const stats:Record<string,Stat>=Object.fromEntries(Object.entries(tableRows.find(r=>r.teamId===team.id)?.stats||{}).map(([key,s])=>[key,{...s,label:`Table · ${s.label}${key==='ppg'?' (as supplied)':''}`} ]));
    const tablePlayed=numericMetric(stats.gamesPlayed),tablePoints=numericMetric(stats.points);if(tablePlayed!==null&&tablePlayed>0&&tablePoints!==null)stats.tablePPG=stat('Table · points per game',tablePoints/tablePlayed);
    const addResults=(prefix:string,label:string,rs:typeof results)=>{
      const wins=rs.filter(r=>r.result==='W').length,draws=rs.filter(r=>r.result==='D').length,gf=rs.reduce((n,r)=>n+r.goalsFor,0),ga=rs.reduce((n,r)=>n+r.goalsAgainst,0);
      Object.assign(stats,{[prefix+'Played']:stat(`${label} · played`,rs.length),[prefix+'Wins']:stat(`${label} · wins`,wins),[prefix+'Draws']:stat(`${label} · draws`,draws),[prefix+'Losses']:stat(`${label} · losses`,rs.length-wins-draws),[prefix+'GoalsFor']:stat(`${label} · goals scored`,gf),[prefix+'GoalsAgainst']:stat(`${label} · goals conceded`,ga),[prefix+'CleanSheets']:stat(`${label} · clean sheets`,rs.filter(r=>r.goalsAgainst===0).length)});
      if(rs.length)stats[prefix+'PPG']=stat(`${label} · points per game`,(wins*3+draws)/rs.length);
    };
    addResults('results','Published results',results);addResults('home','Home results',results.filter(r=>r.home));addResults('away','Away results',results.filter(r=>!r.home));
    const values=new Map<string,{label:string;values:number[];percent:boolean}>();
    let reportCount=0;
    for(const match of fixtures.filter(m=>m.completed)){
      const report=reports[match.id],row=report?.teamStats.find(r=>r.teamId===team.id);
      if(!row||report.id!==match.id)continue;
      reportCount++;
      for(const [key,s] of Object.entries(row.stats)){
        const text=formatMatchStat(row.stats as Record<string,{display:string;label:string}>,key),n=numericMetric({label:s.label,display:text});
        if(n===null)continue;
        const entry=values.get(key)||{label:s.label,values:[],percent:text.includes('%')};entry.values.push(n);values.set(key,entry);
      }
    }
    const samples:Record<string,number>={};
    for(const [key,entry] of values){const n=entry.values.length,avg=entry.values.reduce((a,b)=>a+b,0)/n;
      stats['avg:'+key]={label:`Report avg · ${entry.label}`,value:avg,display:avg.toFixed(1)+(entry.percent?'%':'')};samples['avg:'+key]=n;
    }
    return {id:team.id,name:team.shortName,subtitle:`${results.length} results · ${reportCount} reports`,color:team.color,team,stats,samples,fixtures,form:results.slice(-5),completed:results.length,reportCount};
  });
}
