import type {Board} from '../../types';
import type {DataGraphic} from './types';
import type {GraphicOptions} from './Controls';
import {cachedResource} from './resource';
import {graphicSummary} from './graphic';
import {sourceClock} from './model';
export interface EventHostSnapshot {graphic:DataGraphic;options:GraphicOptions;events:{id:string;label:string}[];total:number;summary:string}
export function eventHostSnapshot(b:Board):EventHostSnapshot|undefined {
 const g=b.studio?.dataGraphic,r=cachedResource(g?.resourceId);if(!g||!r)return;
 const d=r.dataset,summary=graphicSummary(r,g);return{graphic:structuredClone(g),options:{teams:d.teams,players:d.players,matches:d.matches,completeTeamIds:d.completeTeamIds},events:summary.selected.slice(0,100).map(e=>({id:e.id,label:`${sourceClock(e)} · ${d.players.find(p=>p.id===e.playerId)?.name||'Unknown player'} · ${e.type} · ${e.outcome||'unknown outcome'} · xG ${e.xG??'—'}`})),total:summary.total,summary:`${d.competition} ${d.season}${d.source.historical?' · historical':''} · ${summary.located.length} located / ${summary.total} filtered events`};
}
