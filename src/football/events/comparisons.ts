import type {ComparisonEntity} from '../comparisonModel';
import {EVENT_METRICS,aggregateEvents} from './metrics';
import type {CohortRow,EventDataset} from './types';
export function eventPlayerEntity(row:CohortRow):ComparisonEntity{
 return{id:row.id,name:row.name,subtitle:`${row.position} · ${row.minutes.toFixed(0)} min`,stats:{minutes:{label:'Regulation minutes',value:row.minutes},...Object.fromEntries(EVENT_METRICS.map(m=>['event:'+m.key,{label:m.label+(m.unit==='%'?' %':m.unit==='ratio'?' ratio':''),value:row.stats[m.key]??null,display:row.stats[m.key]==null?'—':String(Number(row.stats[m.key]!.toFixed(2)))}]))}};
}
export function eventTeamEntity(d:EventDataset,teamId:string):ComparisonEntity {
 const team=d.teams.find(t=>t.id===teamId);if(!team||d.completeTeamIds?.length&&!d.completeTeamIds.includes(teamId))throw Error('Load a complete archive for this team first.');
 const matches=d.matches.filter(m=>[m.homeId,m.awayId].includes(teamId)),values=aggregateEvents(d.events.filter(e=>e.teamId===teamId),d.coverage);
 const results=matches.filter(m=>m.homeScore!==undefined&&m.awayScore!==undefined);let goals=0,against=0,wins=0,draws=0,clean=0;for(const m of results){const home=m.homeId===teamId,score=home?m.homeScore!:m.awayScore!,conceded=home?m.awayScore!:m.homeScore!;goals+=score;against+=conceded;wins+=Number(score>conceded);draws+=Number(score===conceded);clean+=Number(conceded===0);}
 return{id:teamId,name:team.name,subtitle:`${matches.length} match records`,stats:{gamesPlayed:{label:'Match records',value:matches.length},resultsPlayed:{label:'Completed result records',value:results.length},resultsGoalsFor:{label:'Results · Goals scored',value:goals},resultsGoalsAgainst:{label:'Results · Goals conceded',value:against},resultsWins:{label:'Results · Wins',value:wins},resultsDraws:{label:'Results · Draws',value:draws},resultsCleanSheets:{label:'Results · Clean sheets',value:clean},...Object.fromEntries(EVENT_METRICS.map(m=>{const v=values[m.key],value=v.value;return['event:'+m.key,{label:(m.key==='goals'?'Shot-event goals':m.label)+(m.unit==='%'?' %':m.unit==='ratio'?' ratio':'')+(v.coverage==='partial'?' · partial coverage':''),value,display:value===null?'—':String(Number(value.toFixed(2)))}];}))},samples:Object.fromEntries(EVENT_METRICS.map(m=>['event:'+m.key,values[m.key].denominator??matches.length]))};
}
