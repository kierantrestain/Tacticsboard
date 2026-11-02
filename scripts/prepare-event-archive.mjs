/** Reproducible adapter for the Pappalardo/Massucco CC BY 4.0 research release.
 * Usage: node --max-old-space-size=4096 scripts/prepare-event-archive.mjs SOURCE_DIRECTORY
 * Source URLs/checksums and licence verification are documented in docs/EVENT_DATA.md.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8,gzipSync,strToU8} from 'fflate';
import {createServer} from 'vite';
const sourceDir=process.argv[2];if(!sourceDir)throw Error('Supply the directory containing the six verified original Figshare files.');
const checks={'events.zip':'7c20e8647e7eda58d7838a0c7b1ec6ab','matches.zip':'51d80beb17480919f69a53a0152c2d71','players.json':'f28ddf6326281efeda6488b2169f5609','teams.json':'1381ff9449f21105090729cf0e086b5b','eventid2name.csv':'46daf16100ece0c743eedc9adcfea162','tags2name.csv':'e7acb14918d00e40c80a898b1da8fc39'};
const inputs={};for(const [name,md5]of Object.entries(checks)){const bytes=new Uint8Array(await readFile(resolve(sourceDir,name)));if(createHash('md5').update(bytes).digest('hex')!==md5)throw Error('Original checksum differs: '+name);inputs[name]=bytes;}
const json=name=>JSON.parse(strFromU8(inputs[name]));
const zipJSON=(name,file)=>JSON.parse(strFromU8(unzipSync(inputs[name],{filter:f=>f.name===file})[file]));
const raw=zipJSON('events.zip','events_England.json'),rawMatches=zipJSON('matches.zip','matches_England.json');
const sid=n=>'wy-'+n;
const matches=rawMatches.map(m=>{const sides=Object.values(m.teamsData),home=sides.find(t=>t.side==='home'),away=sides.find(t=>t.side==='away');return{id:sid(m.wyId),competition:'Premier League',season:'2017/18',date:m.dateutc.replace(' ','T')+'Z',label:m.label,homeId:sid(home.teamId),awayId:sid(away.teamId),homeScore:home.score,awayScore:away.score};});
const teamIds=new Set(matches.flatMap(m=>[m.homeId,m.awayId]));
const teams=json('teams.json').filter(t=>teamIds.has(sid(t.wyId))).map(t=>({id:sid(t.wyId),name:t.name}));
const playerTeams=new Map();
const tagMap={301:'assist',302:'key-pass',1401:'interception',1501:'clearance',1601:'sliding-tackle',1701:'red',1702:'yellow',1703:'second-yellow',1901:'counterattack',2101:'shot-blocked',102:'own-goal',901:'through-ball',2001:'dangerous-loss'};
const events=raw.filter(e=>['1H','2H'].includes(e.matchPeriod)).map(e=>{
 const tags=e.tags.map(t=>t.id),sub=Number(e.subEventId),shot=e.eventId===10||[33,35].includes(sub),pass=e.eventId===8||e.eventId===3&&!shot;
 const type=shot?'shot':pass?'pass':e.eventId===1?'duel':e.eventId===2?'foul':sub===70?'carry':sub===71?'clearance':sub===72?'touch':e.eventId===9?'save':'other';
 const q=tags.filter(t=>tagMap[t]).map(t=>tagMap[t]);if(sub===80||sub===32)q.push('cross');if(sub===10)q.push('aerial');else if(e.eventId===1)q.push('ground');
 let outcome;
 if(shot)outcome=tags.includes(101)?'goal':tags.includes(2101)?'blocked':tags.some(t=>t>=1217&&t<=1223)?'woodwork':tags.some(t=>t>=1201&&t<=1209)?'saved':tags.some(t=>t>=1210&&t<=1216)?'off-target':undefined;
 else if(type==='duel')outcome=tags.includes(703)?'won':tags.includes(701)?'lost':undefined;
 else if(type==='save')outcome=tags.includes(101)?'failed':tags.includes(1801)?'saved':undefined;
 else outcome=tags.includes(1801)?'completed':tags.includes(1802)?'failed':undefined;
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100?{x:p.x/100,y:p.y/100}:undefined;
 if(e.playerId){const ids=playerTeams.get(sid(e.playerId))||new Set();ids.add(sid(e.teamId));playerTeams.set(sid(e.playerId),ids);}
 return {id:sid(e.id),sourceId:sid(e.id),revision:1,matchId:sid(e.matchId),teamId:sid(e.teamId),...(e.playerId?{playerId:sid(e.playerId)}:{}),period:e.matchPeriod==='1H'?1:2,clock:e.eventSec,type,outcome,start:point(e.positions[0]),...(['pass','carry'].includes(type)?{end:point(e.positions[1])}:{}),qualifiers:q,providerTags:tags.map(String),...(shot?{bodyPart:tags.includes(401)?'left':tags.includes(402)?'right':tags.includes(403)?'head-body':'other'}:{}),pattern:sub===35?'penalty':e.eventId===3?'set-piece':'open-play'};
});
const players=json('players.json').filter(p=>playerTeams.has(sid(p.wyId))).map(p=>({id:sid(p.wyId),name:((p.firstName+' '+p.lastName).trim()||p.shortName).replace(/\\u([0-9a-fA-F]{4})/g,(_,code)=>String.fromCharCode(parseInt(code,16))).replace(/\s+/g,' '),position:p.role.name,teamIds:[...playerTeams.get(sid(p.wyId))]}));
const minutes=[];
for(const m of rawMatches)for(const team of Object.values(m.teamsData)){
 const formation=team.formation,start=new Map(formation.lineup.map(p=>[p.playerId,0])),end=new Map();
 for(const sub of Array.isArray(formation.substitutions)?formation.substitutions:[]){end.set(sub.playerOut,Math.min(90,sub.minute));start.set(sub.playerIn,Math.min(90,sub.minute));}
 for(const e of events)if(e.matchId===sid(m.wyId)&&e.teamId===sid(team.teamId)&&e.playerId&&e.qualifiers.some(q=>q==='red'||q==='second-yellow')){const id=Number(e.playerId.slice(3));if(start.has(id))end.set(id,Math.min(end.get(id)??90,Math.min(90,(e.period===2?45:0)+e.clock/60)));}
 for(const [playerId,at]of start)if(playerTeams.has(sid(playerId)))minutes.push({playerId:sid(playerId),teamId:sid(team.teamId),matchId:sid(m.wyId),minutes:Math.max(0,(end.get(playerId)??90)-at),basis:'Regulation minutes derived from source XI/substitution minutes and tagged dismissal clock; capped at 90, stoppage time excluded.'});
}
const source={provider:'Pappalardo / Massucco · Wyscout research release',url:'https://doi.org/10.6084/m9.figshare.c.4415000.v5',licence:'CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/',attribution:'Luca Pappalardo & Emanuele Massucco (2019), Soccer match event dataset, Figshare; Wyscout. Normalised by Bang On; selected type/tag mappings and regulation-minute calculations. CC BY 4.0.',revision:'figshare-4415000-v5-events-7c20e864',retrievedAt:'2026-11-02T00:00:00Z',historical:true,permissionNote:'Original Figshare Events/Matches/Players/Teams item licences verified as CC BY 4.0. Historical data, not current PL coverage.'};
const coverage={types:{shot:'complete',pass:'complete',duel:'complete',foul:'complete',touch:'partial',carry:'partial',tackle:'partial',interception:'partial',clearance:'complete',save:'partial',card:'complete',other:'partial',block:'unavailable',recovery:'unavailable','take-on':'unavailable',claim:'unavailable',error:'unavailable'},coordinates:'partial',outcomes:'partial',xG:'unavailable',xA:'unavailable',recipients:'unavailable',goalmouth:'unavailable',possessions:'unavailable',metricCoverage:{completed:'complete',onTarget:'complete',tackles:'partial',tacklesWon:'partial',interceptions:'partial',boxTouches:'partial',saves:'partial',dispossessions:'unavailable'},notes:['Pattern is derived from event class: ordinary pass/shot versus direct dead-ball delivery. Subsequent set-piece phases are not supplied and are not reconstructed.','All 380 matches of Premier League 2017/18. Each club archive contains all its events plus opposition shots for its 38 matches; opposition non-shot events are not complete.','Coordinates are source on-ball events, attacking left-to-right in both halves. Integer 0–100 resolution; no off-ball tracking.','xG/xA, precise goalmouth coordinates, pass recipients, possessions, full touches/carries/recoveries and post-shot metrics are not supplied.','Interceptions and sliding tackles are explicit tags, not a complete standalone defensive feed.','Regulation minutes are derived from historical match lineups/substitutions, excluding stoppage time.','Goal area tags are categorical outcomes, not measured goalmouth locations. Own goals remain explicitly tagged, not attributed as attacking goals.']};
const base={format:'bangon-events',version:1,id:'wyscout-pl-2017-18',source,competition:'Premier League',season:'2017/18',coordinates:{width:1,height:1,origin:'top-left',orientation:'attacking'},coverage,matches,teams,players,minutes};
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {makeCohort}=await vite.ssrLoadModule('/src/football/events/import.ts');
 const {normaliseDataset}=await vite.ssrLoadModule('/src/football/events/model.ts');
 const cohort=makeCohort({...base,events}),chunks=[],out=resolve('public/data/events');await mkdir(out,{recursive:true});
 for(const t of teams){const matchIds=new Set(matches.filter(m=>[m.homeId,m.awayId].includes(t.id)).map(m=>m.id));const selected=events.filter(e=>e.teamId===t.id||e.type==='shot'&&matchIds.has(e.matchId));normaliseDataset({...base,events:selected});const bytes=gzipSync(strToU8(JSON.stringify(selected)),{level:9,mtime:0});const name=t.id+'.events';await writeFile(resolve(out,name),bytes);chunks.push({teamId:t.id,url:'/data/events/'+name,bytes:bytes.length,eventCount:selected.length,sha256:createHash('sha256').update(bytes).digest('hex')});console.log(t.name,selected.length,bytes.length);}
 await writeFile(resolve(out,'index.json'),JSON.stringify({...base,chunks,cohort}));console.log('Archive:',teams.length,'clubs',matches.length,'matches',cohort.rows.length,'independent reference players',events.length,'source events');
}finally{await vite.close();}
