import { normaliseDataset } from './model';
import { aggregateEvents, EVENT_METRICS, METRIC_VERSION } from './metrics';
import type { CohortSnapshot, DataGraphic, EventDataset, FootballEvent, GraphicResource } from './types';
export function makeCohort(d:EventDataset):CohortSnapshot {
 const events=new Map<string,FootballEvent[]>();
 for(const e of d.events)if(e.playerId){const list=events.get(e.playerId)||[];list.push(e);events.set(e.playerId,list);}
 return {id:d.id+'-cohort',source:structuredClone(d.source),competitions:[d.competition],seasons:[d.season],minutesBasis:'Sum of supplied player/match minutes; estimates excluded from per-90 and radar denominators.',metricVersion:METRIC_VERSION,rows:d.players.map(p=>{
  const values=aggregateEvents(events.get(p.id)||[],d.coverage);
  return {id:p.id,name:p.name,position:p.position||'Unknown',teamIds:p.teamIds||[],minutes:d.minutes.filter(m=>m.playerId===p.id&&!m.estimated).reduce((n,m)=>n+m.minutes,0),stats:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v.coverage==='complete'?v.value:null]))};
 })};
}
export function validateCohort(c:unknown):asserts c is CohortSnapshot {
 const v=c as CohortSnapshot;
 if(!v||typeof v.id!=='string'||!v.source||!Array.isArray(v.competitions)||!v.competitions.length||!Array.isArray(v.seasons)||!v.seasons.length||typeof v.minutesBasis!=='string'||v.metricVersion!==METRIC_VERSION||!Array.isArray(v.rows)||v.rows.length>10000||new Set(v.rows.map(r=>r?.id)).size!==v.rows.length)throw Error('Invalid or unsupported radar reference population.');
 for(const r of v.rows)if(!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.position!=='string'||!Array.isArray(r.teamIds)||!Number.isFinite(r.minutes)||r.minutes<0||!r.stats||Object.values(r.stats).some(n=>n!==null&&(typeof n!=='number'||!Number.isFinite(n))))throw Error('Invalid reference values or minutes.');
}
export function validateResource(value:unknown):asserts value is GraphicResource {
 const r=value as GraphicResource;if(!r||r.format!=='bangon-graphic-resource'||r.version!==1||!Number.isFinite(Date.parse(r.createdAt)))throw Error('Invalid prepared analysis resource.');
 r.dataset=normaliseDataset(r.dataset);validateCohort(r.cohort);
}
export function validGraphic(v:unknown):v is DataGraphic {
 const g=v as DataGraphic,f=g?.filters;
 return !!g&&['map','radar'].includes(g.kind)&&typeof g.resourceId==='string'&&/^[\w-]{1,150}$/.test(g.resourceId)&&typeof g.title==='string'&&g.title.length<=120&&!!f&&['shots','passes','defending','touches','carries','network'].includes(f.mode)&&['attacking','reverse'].includes(f.orientation)&&['teamId','playerId','matchId','outcome','bodyPart','pattern','subtype','dateFrom','dateTo'].every(k=>(f as any)[k]===undefined||typeof (f as any)[k]==='string'&&(f as any)[k].length<=150)&&[f.from,f.to].every(n=>n===undefined||Number.isFinite(n)&&n>=0&&n<=7200)&&(f.from===undefined||f.to===undefined||f.from<=f.to)&&(f.period===undefined||[1,2,3,4,5].includes(f.period))&&(f.against===undefined||typeof f.against==='boolean')&&Array.isArray(g.selectedEventIds)&&g.selectedEventIds.length<=100&&g.selectedEventIds.every(id=>typeof id==='string'&&id.length<=150)&&Array.isArray(g.playerIds)&&g.playerIds.length<=5&&new Set(g.playerIds).size===g.playerIds.length&&g.playerIds.every(id=>typeof id==='string')&&Array.isArray(g.radarMetrics)&&g.radarMetrics.length<=EVENT_METRICS.length&&g.radarMetrics.every(k=>EVENT_METRICS.some(m=>m.key===k))&&new Set(g.radarMetrics).size===g.radarMetrics.length&&typeof g.position==='string'&&g.position.length<=100&&Number.isFinite(g.minimumMinutes)&&g.minimumMinutes>=0&&g.minimumMinutes<=20000&&['totals','per90'].includes(g.basis)&&(g.radarOffset===undefined||Number.isSafeInteger(g.radarOffset)&&g.radarOffset>=0&&g.radarOffset<=EVENT_METRICS.length)&&(!g.alignment||typeof g.alignment.assetId==='string'&&(g.alignment.assetRevision===undefined||Number.isSafeInteger(g.alignment.assetRevision)&&g.alignment.assetRevision>=0)&&[1,2,3,4].includes(g.alignment.period)&&[g.alignment.eventClock,g.alignment.sourceTime].every(n=>Number.isFinite(n)&&n>=0&&n<=1000000)&&typeof g.alignment.note==='string'&&g.alignment.note.length>0&&g.alignment.note.length<=1000);
}
/** RFC4180 subset: quotes/newlines/escaped quotes; no eval or formula execution. */
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!field||quoted)quoted=!quoted;else throw Error('Malformed CSV quoting.');}else if(!quoted&&(ch===','||ch==='\n')){row.push(field.replace(/\r$/,''));field='';if(ch==='\n'){rows.push(row);row=[];}}else field+=ch;}
 if(quoted)throw Error('Unclosed CSV quote.');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}return rows.filter(r=>r.some(v=>v!==''));
}
export function importEvents(text:string,metadata?:unknown):EventDataset {
 text=text.replace(/^\ufeff/,'');
 if(text.length>32*1048576)throw Error('Keep one event import within 32 MB / 100,000 events.');
 if(text.trimStart().startsWith('{'))return normaliseDataset(JSON.parse(text));
 if(!metadata)throw Error('CSV needs its companion dataset metadata JSON (source, identities, minutes, coverage and coordinates).');
 const rows=parseCSV(text),header=rows.shift();if(!header?.includes('id')||!header.includes('type')||new Set(header).size!==header.length)throw Error('CSV requires unique named columns, including id and type.');
 const numeric=new Set(['revision','period','clock','xG','xA','postShotXG']),points=['start','end'];
 const events=rows.map(row=>{if(row.length!==header.length)throw Error('CSV row has the wrong column count.');const e:Record<string,unknown>={};row.forEach((v,i)=>{const k=header[i];if(v!=='')e[k]=numeric.has(k)?Number(v):k==='qualifiers'||k==='providerTags'?v.split('|'):k==='deleted'?v==='true':v;});e.qualifiers||=[];e.revision??=0;for(const p of points){const x=e[p+'X'],y=e[p+'Y'];if(x!==undefined||y!==undefined)e[p]={x:Number(x),y:Number(y)};delete e[p+'X'];delete e[p+'Y'];}return e;});
 return normaliseDataset({...metadata as object,events});
}
