import type { EventDataset, EventFilters, EventPoint, FootballEvent } from './types';
export const EVENT_TYPES=['pass','shot','tackle','interception','recovery','block','clearance','touch','carry','take-on','duel','foul','card','save','claim','error','other'] as const;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[\w:.-]{1,150}$/.test(v);
const text=(v:unknown,n=500):v is string=>typeof v==='string'&&v.length>0&&v.length<=n;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const cover=(v:unknown)=>['complete','partial','unavailable'].includes(v as string);
function point(v:unknown,w:number,h:number){const p=v as EventPoint;return !!p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h;}
/** Input coordinates are explicit; every stored/plotted event is normalised attacking left-to-right. */
export function normalisePoint(p:EventPoint,c:EventDataset['coordinates'],direction?:'left'|'right'):EventPoint{
 if(!point(p,c.width,c.height))throw Error('An event coordinate is outside its declared pitch.');
 let x=p.x/c.width,y=c.origin==='bottom-left'?1-p.y/c.height:p.y/c.height;
 if(c.orientation==='fixed'){if(!direction)throw Error('Fixed coordinates need a supplied attacking direction for each match/team/period.');if(direction==='left'){x=1-x;y=1-y;}}
 return {x,y};
}
export function validateDataset(value:unknown):asserts value is EventDataset{
 const d=value as EventDataset;
 if(!d||d.format!=='bangon-events'||d.version!==1||!id(d.id)||!text(d.competition,150)||!text(d.season,100))throw Error('Use a supported Bang On event dataset (version 1).');
 const s=d.source,c=d.coordinates;
 if(!s||!text(s.provider,150)||!/^https:\/\/[^\s]+$/.test(s.url)||!text(s.licence,200)||!text(s.attribution,2000)||!text(s.revision,150)||!Number.isFinite(Date.parse(s.retrievedAt))||typeof s.historical!=='boolean')throw Error('Event source, licence, attribution and revision are required.');
 if(!c||!finite(c.width)||!finite(c.height)||c.width<=0||c.height<=0||!['top-left','bottom-left'].includes(c.origin)||!['attacking','fixed'].includes(c.orientation))throw Error('Declare the source coordinate system and orientation.');
 if(!d.coverage||!d.coverage.types||Object.entries(d.coverage.types).some(([k,v])=>!EVENT_TYPES.includes(k as any)||!cover(v))||['coordinates','outcomes','xG','xA','recipients','goalmouth','possessions'].some(k=>!cover((d.coverage as any)[k]))||!Array.isArray(d.coverage.notes)||d.coverage.notes.some(n=>!text(n,2000)))throw Error('Declare data coverage; missing is not zero.');
 if(d.coverage.metricCoverage&&(typeof d.coverage.metricCoverage!=='object'||Array.isArray(d.coverage.metricCoverage)||Object.values(d.coverage.metricCoverage).some(v=>!cover(v))))throw Error('Invalid metric coverage.');
 if(!Array.isArray(d.events)||d.events.length>100000||!Array.isArray(d.matches)||!Array.isArray(d.teams)||!Array.isArray(d.players)||!Array.isArray(d.minutes))throw Error('Keep one import within 100,000 events and include its identity tables.');
 for(const group of [d.teams,d.players])if(group.length>10000||new Set(group.map(v=>v?.id)).size!==group.length||group.some(v=>!v||!id(v.id)||!text(v.name,200)))throw Error('Invalid or duplicate team/player identity.');
 const teams=new Set(d.teams.map(t=>t.id)),players=new Set(d.players.map(p=>p.id)),matches=new Set(d.matches.map(m=>m.id));
 if(d.matches.length>1000||matches.size!==d.matches.length||d.matches.some(m=>!id(m.id)||!text(m.competition,150)||!text(m.season,100)||!text(m.label,300)||!Number.isFinite(Date.parse(m.date))||!teams.has(m.homeId)||!teams.has(m.awayId)||m.homeId===m.awayId||[m.homeScore,m.awayScore].some(n=>n!==undefined&&(!Number.isSafeInteger(n)||n<0))))throw Error('Invalid match identity, date or score.');
 const matchIndex=new Map(d.matches.map(m=>[m.id,m]));
 const canonical=new Map<string,string>();
 for(const e of d.events){
  if(!e)throw Error('An event cannot be null.');
  const match=matchIndex.get(e.matchId);
  if(canonical.has(e.id)&&canonical.get(e.id)!==e.sourceId)throw Error('Duplicate canonical event ID.');
  canonical.set(e.id,e.sourceId);
  if(e.deleted!==undefined&&typeof e.deleted!=='boolean'||e.possessionId!==undefined&&!id(e.possessionId))throw Error('Invalid correction or possession identifier.');
  if(!e||!id(e.id)||!id(e.sourceId)||!Number.isSafeInteger(e.revision)||e.revision<0||!match||![match.homeId,match.awayId].includes(e.teamId)||e.playerId!==undefined&&!players.has(e.playerId)||e.recipientId!==undefined&&!players.has(e.recipientId)||![1,2,3,4,5].includes(e.period)||!finite(e.clock)||e.clock<0||e.clock>7200||!EVENT_TYPES.includes(e.type)||!Array.isArray(e.qualifiers)||e.qualifiers.length>100||e.qualifiers.some(q=>!text(q,150))||e.providerTags!==undefined&&(!Array.isArray(e.providerTags)||e.providerTags.length>100||e.providerTags.some(q=>!text(q,150))))throw Error('Invalid event identity, clock, type or qualifier.');
  if(e.outcome!==undefined&&!['completed','failed','goal','saved','blocked','off-target','woodwork','won','lost'].includes(e.outcome)||e.pattern!==undefined&&!['open-play','set-piece','penalty'].includes(e.pattern)||e.bodyPart!==undefined&&!['left','right','head-body','other'].includes(e.bodyPart))throw Error('Unsupported outcome, pattern or body part.');
  for(const p of [e.start,e.end])if(p!==undefined&&!point(p,c.width,c.height))throw Error('Invalid source event coordinate.');
  if(e.goalmouth!==undefined&&(!finite(e.goalmouth.y)||!finite(e.goalmouth.z)||e.goalmouth.y<0||e.goalmouth.y>1||e.goalmouth.z<0||e.goalmouth.z>1))throw Error('Goalmouth coordinates must be genuinely supplied in the declared 0–1 goal frame.');
  for(const n of [e.xG,e.xA,e.postShotXG])if(n!==undefined&&(!finite(n)||n<0||n>1))throw Error('Expected values must be supplied probabilities between zero and one.');
  if((e.start||e.end)&&c.orientation==='fixed'&&!['left','right'].includes(c.directions?.[`${e.matchId}:${e.teamId}:${e.period}`]||''))throw Error('Missing attacking direction for a located event.');
 }
 if(d.minutes.length>50000||d.minutes.some(m=>!players.has(m.playerId)||!teams.has(m.teamId)||!matches.has(m.matchId)||!finite(m.minutes)||m.minutes<0||m.minutes>150||!text(m.basis,300)))throw Error('Invalid minutes or denominator context.');
 if(d.minutes.some(m=>{const match=matchIndex.get(m.matchId)!;return ![match.homeId,match.awayId].includes(m.teamId)||m.estimated!==undefined&&typeof m.estimated!=='boolean';})||d.players.some(p=>p.position!==undefined&&!text(p.position,100)||p.teamIds!==undefined&&(!Array.isArray(p.teamIds)||p.teamIds.some(t=>!teams.has(t))))||d.completeTeamIds!==undefined&&(!Array.isArray(d.completeTeamIds)||!d.completeTeamIds.length||d.completeTeamIds.some(t=>!teams.has(t))))throw Error('Invalid player/team or minutes coverage context.');
 if(new Set(d.minutes.map(m=>[m.matchId,m.teamId,m.playerId].join(':'))).size!==d.minutes.length)throw Error('Duplicate minutes would inflate rate denominators.');
}
export function normaliseDataset(value:unknown):EventDataset{
 validateDataset(value);const d=structuredClone(value),latest=new Map<string,FootballEvent>();
 for(const e of d.events){const key=e.sourceId,previous=latest.get(key);if(previous&&previous.id!==e.id)throw Error('A source event has conflicting canonical IDs.');if(previous&&previous.revision===e.revision&&JSON.stringify(previous)!==JSON.stringify(e))throw Error('Conflicting event corrections need distinct revision numbers.');if(!previous||e.revision>previous.revision)latest.set(key,e);}
 d.events=[...latest.values()].filter(e=>!e.deleted).map(e=>{const direction=d.coordinates.directions?.[`${e.matchId}:${e.teamId}:${e.period}`];return{...e,start:e.start?normalisePoint(e.start,d.coordinates,direction):undefined,end:e.end?normalisePoint(e.end,d.coordinates,direction):undefined};});
 d.coordinates={width:1,height:1,origin:'top-left',orientation:'attacking'};
 return d;
}
export const progressive=(e:FootballEvent)=>e.type==='pass'&&!!e.start&&!!e.end&&e.end.x-e.start.x>=.1&&e.end.x>=.5;
export const boxEntry=(e:FootballEvent)=>!!e.start&&!!e.end&&e.end.x>=.843&&e.end.y>=.204&&e.end.y<=.796&&!(e.start.x>=.843&&e.start.y>=.204&&e.start.y<=.796);
export function filterEvents(events:FootballEvent[],f:EventFilters){
 return events.filter(e=>(!f.teamId||e.teamId===f.teamId)&&(!f.playerId||e.playerId===f.playerId)&&(!f.matchId||e.matchId===f.matchId)&&(!f.period||e.period===f.period)&&(f.from===undefined||e.clock>=f.from)&&(f.to===undefined||e.clock<=f.to)&&(!f.outcome||e.outcome===f.outcome)&&(!f.bodyPart||e.bodyPart===f.bodyPart)&&(!f.pattern||e.pattern===f.pattern)).filter(e=>{
 if(f.mode==='shots')return e.type==='shot';if(f.mode==='passes'||f.mode==='network'){if(e.type!=='pass')return false;}else if(f.mode==='touches'){return e.type==='touch';}else if(f.mode==='carries'){return e.type==='carry';}else if(!['tackle','interception','recovery','block','clearance'].includes(e.type)&&!['interception','block','clearance','sliding-tackle'].some(q=>e.qualifiers.includes(q)))return false;
 switch(f.subtype){case'cross':return e.qualifiers.includes('cross');case'open-cross':return e.qualifiers.includes('cross')&&e.pattern==='open-play';case'set-piece':return e.pattern==='set-piece';case'key-pass':return e.qualifiers.includes('key-pass');case'progressive':return progressive(e);case'final-third':return !!e.start&&!!e.end&&e.start.x<2/3&&e.end.x>=2/3;case'box-entry':return boxEntry(e);case'tackle':return e.type==='tackle'||e.qualifiers.includes('sliding-tackle');case'interception':case'recovery':case'block':case'clearance':return e.type===f.subtype||e.qualifiers.includes(f.subtype);default:return true;}
 });
}
export function filteredSummary(events:FootballEvent[],filters:EventFilters){const selected=filterEvents(events,filters),located=selected.filter(e=>!!e.start&&(!['passes','carries','network'].includes(filters.mode)||!!e.end)),known=selected.filter(e=>e.outcome==='completed'||e.outcome==='failed'),completed=known.filter(e=>e.outcome==='completed').length;return{selected,located,total:selected.length,unlocated:selected.length-located.length,knownOutcomes:known.length,completed,completion:known.length?100*completed/known.length:null};}
/** Against is resolved from actual opponents in each match, never today's squad. */
export function datasetEvents(d:EventDataset,f:EventFilters){
 const matches=new Set(d.matches.filter(m=>(!f.matchId||m.id===f.matchId)&&(!f.dateFrom||m.date.slice(0,10)>=f.dateFrom)&&(!f.dateTo||m.date.slice(0,10)<=f.dateTo)&&(!f.teamId||[m.homeId,m.awayId].includes(f.teamId))).map(m=>m.id));
 return d.events.filter(e=>matches.has(e.matchId)&&(!f.teamId||(f.against?e.teamId!==f.teamId:e.teamId===f.teamId))&&(!f.playerId||e.playerId===f.playerId)&&(!f.period||e.period===f.period)&&(f.from===undefined||e.clock>=f.from)&&(f.to===undefined||e.clock<=f.to));
}
export function passNetwork(events:FootballEvent[]){const links=new Map<string,{from:string;to:string;count:number}>();for(const e of events)if(e.type==='pass'&&e.outcome==='completed'&&e.playerId&&e.recipientId){const key=e.playerId+'>'+e.recipientId;const l=links.get(key)||{from:e.playerId,to:e.recipientId,count:0};l.count++;links.set(key,l);}return [...links.values()];}
export function sourceClock(e:Pick<FootballEvent,'period'|'clock'>){const base=[0,0,45,90,105,0][e.period]||0,m=Math.floor(e.clock/60),sec=Math.floor(e.clock%60);return `${e.period===5?'SO ':''}${base+m}:${String(sec).padStart(2,'0')} · P${e.period}`;}
