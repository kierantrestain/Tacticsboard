import type {DataGraphic,GraphicResource} from './types';
import {EVENT_METRICS,percentile} from './metrics';
import {graphicSummary} from './graphic';
const cell=(value:unknown)=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function analysisCSV(r:GraphicResource,g:DataGraphic){
 const context=[['Source',r.dataset.source.attribution],['Source URL',r.dataset.source.url],['Revision',r.dataset.source.revision],['Competition / season',r.dataset.competition+' '+r.dataset.season],['Filters',JSON.stringify(g.filters)]];
 if(g.kind==='radar'){
  return [...context,['Cohort',r.cohort.competitions.join(', ')+' '+r.cohort.seasons.join(', ')],['Position / minimum minutes',g.position+' / '+g.minimumMinutes],['Basis / definitions',g.basis+' / '+r.cohort.metricVersion],['Minutes basis',r.cohort.minutesBasis],['Player','Player ID','Minutes','Metric','Definition','Value ('+g.basis+')','Bang On percentile','Covered reference n'],...g.playerIds.flatMap(id=>g.radarMetrics.map(key=>{const row=r.cohort.rows.find(row=>row.id===id),def=EVENT_METRICS.find(m=>m.key===key),p=percentile(r.cohort,id,key,g);return[row?.name,id,row?.minutes,def?.label,def?.definition,p.value??'Unavailable',p.percentile??'Unavailable',p.sample];}))].map(row=>row.map(cell).join(',')).join('\r\n');
 }
 return [...context,['Canonical ID','Source ID','Revision','Match ID','Team ID','Player ID','Period','Period clock (seconds)','Type','Outcome','Start x','Start y','End x','End y','xG','xA','Post-shot xG','Recipient','Qualifiers'],...graphicSummary(r,g).selected.map(e=>[e.id,e.sourceId,e.revision,e.matchId,e.teamId,e.playerId,e.period,e.clock,e.type,e.outcome,e.start?.x,e.start?.y,e.end?.x,e.end?.y,e.xG,e.xA,e.postShotXG,e.recipientId,e.qualifiers.join('|')])].map(row=>row.map(cell).join(',')).join('\r\n');
}
