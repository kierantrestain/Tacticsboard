import type { DataGraphic, FootballEvent, GraphicResource } from './types';
import { graphicSummary } from './graphic';
import { sourceClock,passNetwork } from './model';
import { EVENT_METRICS, percentile } from './metrics';
export const PITCH={x:64,y:196,w:980,h:634};
export const chartEvents=(r:GraphicResource,g:DataGraphic)=>graphicSummary(r,g).located.slice(0,2000);
export const eventPosition=(e:FootballEvent,g:DataGraphic)=>{let{x,y}=e.start!;if(g.filters.orientation==='reverse'){x=1-x;y=1-y;}return{x:PITCH.x+x*PITCH.w,y:PITCH.y+y*PITCH.h};};
export function eventCanvas(r:GraphicResource|undefined,g:DataGraphic){
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const c=canvas.getContext('2d')!;
 const lime='#ccf56f',white='#f1f6f4',muted='#99aeb8',colors=[lime,'#6dd8ef','#ffb580','#d0a1ff','#ff7eac'];
 c.fillStyle='#09151d';c.fillRect(0,0,1600,900);
 const text=(v:string,x:number,y:number,max=1400,size=22,color=white)=>{c.font=`600 ${size}px Inter, Arial`;c.fillStyle=color;let s=v;while(s.length>1&&c.measureText(s).width>max)s=s.slice(0,-1);c.fillText(s===v?v:s.slice(0,-1)+'…',x,y);};
 text('BANG ON / FOOTBALL INTELLIGENCE',64,47,1400,18,lime);text(g.title,64,105,1470,40);
 if(!r){text('Preparing saved analysis…',64,430);return canvas;}
 const d=r.dataset,f=g.filters,summary=graphicSummary(r,g),team=d.teams.find(t=>t.id===f.teamId),player=d.players.find(p=>p.id===f.playerId),match=d.matches.find(m=>m.id===f.matchId);
 text(`${d.competition} ${d.season}${d.source.historical?' · HISTORICAL':''} · ${player?.name||team?.name||'All supplied events'}${f.against?' · Against':''} · ${match?.label||'Season archive'}`,64,145,1470,21,muted);
 if(g.kind==='map'){
 c.fillStyle='#113735';c.fillRect(PITCH.x,PITCH.y,PITCH.w,PITCH.h);c.strokeStyle='#ffffff65';c.lineWidth=2;
 const rect=(x:number,y:number,w:number,h:number)=>c.strokeRect(PITCH.x+x*PITCH.w,PITCH.y+y*PITCH.h,w*PITCH.w,h*PITCH.h);
 rect(0,0,1,1);rect(0,.204,.157,.592);rect(.843,.204,.157,.592);rect(0,.368,.052,.264);rect(.948,.368,.052,.264);c.beginPath();c.moveTo(PITCH.x+PITCH.w/2,PITCH.y);c.lineTo(PITCH.x+PITCH.w/2,PITCH.y+PITCH.h);c.stroke();c.beginPath();c.ellipse(PITCH.x+PITCH.w/2,PITCH.y+PITCH.h/2,PITCH.w*.087,PITCH.h*.134,0,0,Math.PI*2);c.stroke();
 const plotted=chartEvents(r,g);
 if(f.mode==='network'){
  const nodes=new Map<string,{x:number;y:number;n:number}>();const add=(id:string,x:number,y:number)=>{const n=nodes.get(id)||{x:0,y:0,n:0};n.x+=x;n.y+=y;n.n++;nodes.set(id,n);};
  if(d.coverage.recipients!=='unavailable')for(const e of summary.located)if(e.playerId&&e.recipientId&&e.end&&e.outcome==='completed'){const start=eventPosition(e,g),end=eventPosition({...e,start:e.end},g);add(e.playerId,start.x,start.y);add(e.recipientId,end.x,end.y);}
  const links=passNetwork(summary.selected),max=Math.max(1,...links.map(l=>l.count));for(const l of links){const from=nodes.get(l.from),to=nodes.get(l.to);if(!from||!to)continue;c.strokeStyle='#6dd8ef88';c.lineWidth=1+8*l.count/max;c.beginPath();c.moveTo(from.x/from.n,from.y/from.n);c.lineTo(to.x/to.n,to.y/to.n);c.stroke();}
  for(const [id,n]of nodes){c.fillStyle=lime;c.beginPath();c.arc(n.x/n.n,n.y/n.n,9,0,Math.PI*2);c.fill();text(d.players.find(p=>p.id===id)?.name.split(' ').at(-1)||id,n.x/n.n+12,n.y/n.n,180,17);}
  text('On-ball pass/receipt averages · supplied recipient links only',1100,690,440,18,muted);
 }else if(['touches','carries'].includes(f.mode)){
 const bins=new Map<string,{x:number;y:number;n:number}>();for(const e of summary.located){const p=eventPosition(e,g),x=Math.min(39,Math.floor((p.x-PITCH.x)/PITCH.w*40)),y=Math.min(25,Math.floor((p.y-PITCH.y)/PITCH.h*26)),key=x+':'+y,cell=bins.get(key)||{x,y,n:0};cell.n++;bins.set(key,cell);}const max=Math.max(1,...[...bins.values()].map(b=>b.n));for(const b of bins.values()){c.fillStyle=`rgba(204,245,111,${.1+.8*b.n/max})`;c.fillRect(PITCH.x+b.x/40*PITCH.w,PITCH.y+b.y/26*PITCH.h,PITCH.w/40,PITCH.h/26);}
 }else for(const e of plotted){const p=eventPosition(e,g),selected=g.selectedEventIds.includes(e.id);c.strokeStyle=c.fillStyle=selected?'#ffffff':e.outcome==='goal'?lime:['failed','off-target','lost'].includes(e.outcome||'')?'#ff9585':'#6dd8ef';c.globalAlpha=selected?1:f.mode==='passes'?.48:.8;c.lineWidth=selected?5:2;
 if(e.end&&['passes','carries','network'].includes(f.mode)){const end=eventPosition({...e,start:e.end},g),angle=Math.atan2(end.y-p.y,end.x-p.x);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(end.x,end.y);c.stroke();c.beginPath();c.moveTo(end.x,end.y);c.lineTo(end.x-9*Math.cos(angle-.5),end.y-9*Math.sin(angle-.5));c.lineTo(end.x-9*Math.cos(angle+.5),end.y-9*Math.sin(angle+.5));c.closePath();c.fill();}
 else {c.beginPath();c.arc(p.x,p.y,selected?12:e.type==='shot'?5+Math.sqrt(e.xG??0)*18:5,0,Math.PI*2);c.fill();if(selected){c.strokeStyle=lime;c.stroke();}}}c.globalAlpha=1;
 text(`${f.orientation==='reverse'?'←':'→'} Attacking direction · ${f.mode} · ${f.subtype||'all'}`,64,865,980,19,muted);
 text(`${summary.total.toLocaleString()} filtered events`,1100,224,450,29);text(`${summary.located.length.toLocaleString()} located · ${summary.unlocated} unlocated`,1100,263,440,20,muted);
 if(f.mode==='passes')text(summary.completion===null?'Completion unavailable':`${summary.completion.toFixed(1)}% completed (${summary.completed}/${summary.knownOutcomes})`,1100,302,445,22,lime);
 if(summary.located.length>2000&&!['touches','carries'].includes(f.mode))text('Showing first 2,000 · narrow filters',1100,342,445,18,'#ffb580');
 const selected=summary.selected.find(e=>g.selectedEventIds.includes(e.id));
 if(selected){text('SELECTED EVENT',1100,395,440,18,lime);text(d.players.find(p=>p.id===selected.playerId)?.name||'Player not supplied',1100,435,440,26);text(sourceClock(selected),1100,475,440,24);text(`${selected.type} · ${selected.outcome||'outcome unavailable'}`,1100,516,440,23);text(selected.qualifiers.join(' · ')||'No supplied qualifiers',1100,556,440,18,muted);text(`xG ${selected.xG===undefined?'—':selected.xG.toFixed(3)} · xA ${selected.xA===undefined?'—':selected.xA.toFixed(3)}`,1100,596,440,22);text(`Source event ${selected.sourceId}`,1100,639,440,17,muted);text(d.matches.find(m=>m.id===selected.matchId)?.label||'',1100,677,440,19,muted);}
 else {text(summary.total?'Select an event to inspect':'No events match these filters',1100,421,440,22);text('— means not supplied',1100,466,440,21,muted);text('Cyan: supplied / completed',1100,530,440,20,'#6dd8ef');text('Coral: failed / off-target',1100,568,440,20,'#ff9585');text('Lime: goal',1100,606,440,20,lime);}
 if(f.mode==='network'&&d.coverage.recipients==='unavailable')text('Pass recipients not supplied — network unavailable',1100,730,440,20,'#ffb580');
 }else{
 const keys=g.radarMetrics.slice(g.radarOffset||0,(g.radarOffset||0)+8),cx=540,cy=506,radius=255,n=keys.length;
 for(let ring=1;ring<=4;ring++){c.strokeStyle='#ffffff24';c.beginPath();c.arc(cx,cy,radius*ring/4,0,Math.PI*2);c.stroke();text(String(ring*25),cx+8,cy-radius*ring/4+19,80,14,muted);}
 keys.forEach((key,i)=>{const a=-Math.PI/2+i*Math.PI*2/n,x=cx+Math.cos(a)*(radius+42),y=cy+Math.sin(a)*(radius+42);c.strokeStyle='#ffffff18';c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);c.stroke();c.textAlign=Math.cos(a)>.15?'left':Math.cos(a)<-.15?'right':'center';text(EVENT_METRICS.find(m=>m.key===key)?.label||key,x,y,300,20);});c.textAlign='left';
 let y=225;g.playerIds.forEach((id,pi)=>{const row=r.cohort.rows.find(row=>row.id===id);if(!row)return;const ranks=keys.map(key=>percentile(r.cohort,id,key,g));text(row.name,1080,y,465,25,colors[pi]);text(`${row.position} · ${row.minutes.toFixed(0)} min`,1080,y+31,465,18,muted);c.strokeStyle=colors[pi];c.fillStyle=colors[pi]+'14';c.lineWidth=3;
 const points=ranks.map((rank,i)=>rank.percentile===null?null:{x:cx+Math.cos(-Math.PI/2+i*Math.PI*2/n)*rank.percentile/100*radius,y:cy+Math.sin(-Math.PI/2+i*Math.PI*2/n)*rank.percentile/100*radius});
 if(n>=3&&points.every(p=>p!==null)){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p!.x,p!.y):c.moveTo(p!.x,p!.y));c.closePath();c.fill();c.stroke();}else points.forEach((p,i)=>{if(!p)return;const previous=points[(i+points.length-1)%points.length];if(previous){c.beginPath();c.moveTo(previous.x,previous.y);c.lineTo(p.x,p.y);c.stroke();}c.fillStyle=colors[pi];c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.fill();});
 const first=ranks[0];if(first)text(`${first.value===null?'—':first.value.toFixed(2)} ${g.basis==='per90'?'per 90 / rate':'total / rate'} · ${first.percentile===null?'rank unavailable':first.percentile.toFixed(0)+'th'} · n=${first.sample}`,1080,y+55,465,16,colors[pi]);y+=100;});
 const sample=keys.length&&g.playerIds.length?percentile(r.cohort,g.playerIds[0],keys[0],g).sample:0;text('Gaps mean unavailable values / ranks; lines share a 0–100 scale.',64,784,1450,18,muted);text(`${g.position} · ≥${g.minimumMinutes} minutes · ${g.basis}`,64,822,1450,23,muted);text(`Reference: ${r.cohort.competitions.join(', ')} ${r.cohort.seasons.join(', ')} · metric samples vary · n=${sample} for first metric`,64,858,1440,18,muted);
 if(!n)text('Choose radar metrics',330,500,700,32);else if(sample<20)text('Insufficient reference sample — ranks unavailable',260,530,760,25,'#ffb580');
 }
 // Required source attribution is visible on the graphic and all canvas exports.
 c.fillStyle='#09151dee';c.fillRect(64,876,1480,24);text(`${d.source.provider} · ${d.source.licence} · Normalised by Bang On`,64,893,1480,13,muted);return canvas;
}
