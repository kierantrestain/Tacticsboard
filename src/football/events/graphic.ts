import type { Board } from '../../types';
import type { DataGraphic, EventFilters, GraphicResource } from './types';
export type EventFilterChanges=Record<string,string|number|boolean|null>;
const filterKeys=new Set(['teamId','playerId','matchId','period','from','to','mode','subtype','outcome','bodyPart','pattern','orientation','against','dateFrom','dateTo']);
/** A tablet may still display an older snapshot while its preceding action is in flight. */
export function filterDifference(before:EventFilters,after:EventFilters):EventFilterChanges{
 const delta:EventFilterChanges={};for(const key of new Set([...Object.keys(before),...Object.keys(after)])){const old=(before as any)[key],value=(after as any)[key];if(old!==value)delta[key]=value??null;}return delta;
}
export function mergeFilterChanges(current:EventFilters,delta:EventFilterChanges):EventFilters{
 if(!delta||typeof delta!=='object'||Array.isArray(delta)||Object.keys(delta).some(k=>!filterKeys.has(k))||Object.values(delta).some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)))throw Error('Invalid event filter change.');
 const next={...current};for(const [key,value]of Object.entries(delta)){if(value===null)delete (next as any)[key];else(next as any)[key]=value;}return next;
}
import { datasetEvents, filteredSummary } from './model';
import { validGraphic } from './import';
import {validateResource} from './import';
export function graphicSummary(r:GraphicResource,g:DataGraphic){const events=datasetEvents(r.dataset,g.filters);return filteredSummary(events,{...g.filters,teamId:undefined,playerId:undefined,matchId:undefined});}
export function updateGraphic(g:DataGraphic,patch:Partial<DataGraphic>,r:GraphicResource):DataGraphic {
 const next={...structuredClone(g),...patch};if(!validGraphic(next))throw Error('Invalid analysis selection.');
 if(patch.selectedEventIds?.some(id=>!r.dataset.events.some(e=>e.id===id)))throw Error('The selected event is outside this snapshot.');
 const f=next.filters,d=r.dataset;
 if(f.teamId&&!d.teams.some(t=>t.id===f.teamId)||f.playerId&&!d.players.some(p=>p.id===f.playerId)||f.matchId&&!d.matches.some(m=>m.id===f.matchId)||next.playerIds.some(id=>!r.cohort.rows.some(row=>row.id===id)))throw Error('This identity is outside the prepared snapshot.');
 if(d.completeTeamIds?.length&&(!f.teamId||!d.completeTeamIds.includes(f.teamId)||f.against&&f.mode!=='shots'))throw Error('This club archive contains its events and opposition shots. Load another club for a different full-team analysis.');
 const visible=new Set(graphicSummary(r,next).selected.map(e=>e.id));
 next.selectedEventIds=next.selectedEventIds.filter(id=>visible.has(id));return next;
}
export function analysisResourceIds(board:Board){return [...new Set([...(board.studio?.resourceIds||[]),board.studio?.dataGraphic?.resourceId,...(board.studio?.cues||[]).map(c=>c.dataGraphic?.resourceId)].filter(Boolean) as string[])];}
/** Resolve every saved graphic before declaring its episode pack complete. */
export function validateGraphicResource(board:Board,id:string,value:unknown){
 const graphics=[board.studio?.dataGraphic,...(board.studio?.cues||[]).map(c=>c.dataGraphic)].filter((g):g is DataGraphic=>!!g&&g.resourceId===id);
 if(!graphics.length)return;
 validateResource(value);
 for(const graphic of graphics){const restored=updateGraphic(graphic,{},value);if(restored.selectedEventIds.length!==graphic.selectedEventIds.length)throw Error('A saved event highlight is missing or outside its saved filters.');}
}
export function alignedSourceTime(g:DataGraphic,event:{period:number;clock:number}){
 const a=g.alignment;if(!a||event.period!==a.period)throw Error('Align this period to source footage before seeking.');return a.sourceTime+event.clock-a.eventClock;
}
