import type { Board, Drawing } from '../types';
import type { BallActionRequest, FootballAction } from './footballActionTypes';
import { copy, clamp, uid, shortName } from '../core';
import type { Frame } from '../types';
export const outcomeNames={completed:'Completed',intercepted:'Intercepted','on-target':'On target',goal:'Goal',saved:'Saved','off-target':'Off target',blocked:'Blocked',woodwork:'Woodwork'};
export function addFootballAction(board:Board,request:BallActionRequest):Board {
  const b=copy(board),i=b.scenes.findIndex(s=>s.id===b.activeScene),from=b.players.find(p=>p.uid===request.fromId);
  if(!from||i<0)throw Error('Choose the player making the action.');
  if(b.scenes.length>=100)throw Error('This sequence is full. Start a new analysis.');
  if(!['pass','through','shot'].includes(request.kind)||!Number.isFinite(request.seconds)||request.seconds<.5||request.seconds>6)throw Error('Choose a valid action and duration.');
  const shot=request.kind==='shot';
  if(!(shot?['on-target','goal','saved','off-target','blocked','woodwork']:['completed','intercepted']).includes(request.outcome))throw Error('Choose an outcome for this action.');
  const to=b.players.find(p=>p.uid===request.toId),interceptor=b.players.find(p=>p.uid===request.interceptorId),defender=b.players.find(p=>p.uid===request.defenderId);
  if(!shot&&(!to||to.uid===from.uid||to.side!==from.side))throw Error('Choose a teammate to receive the pass.');
  if(!shot&&request.outcome==='intercepted'&&(!interceptor||interceptor.side===from.side))throw Error('Choose the opposing player who intercepts.');
  if(shot&&request.outcome==='blocked'&&(!defender||defender.side===from.side))throw Error('Choose the opposing player who blocks the shot.');
  if(request.kind==='through'&&(!request.target||![request.target.x,request.target.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)))throw Error('Tap the space the receiver runs into.');
  if(shot&&(!['left','right'].includes(request.goalSide||'')||!['left','centre','right'].includes(request.goalTarget||'')))throw Error('Choose the goal and target.');
  const direction=request.goalSide==='left'?-1:1,foot=(p:{x:number;y:number})=>({x:clamp(p.x+.014*(shot?direction:from.side==='home'?1:-1)),y:clamp(p.y+.012)});
  let aim=request.kind==='through'?copy(request.target!):shot?{x:direction>0?1:0,y:request.goalTarget==='centre'?.5:request.goalTarget==='left'?(direction>0?.445:.555):(direction>0?.555:.445)}:foot(to!);
  if(shot&&request.outcome==='off-target')aim.y=request.goalTarget==='left'?(direction>0?.34:.66):(direction>0?.66:.34);
  if(shot&&request.outcome==='woodwork'&&request.goalTarget!=='centre')aim.y=request.goalTarget==='right'?(direction>0?.56:.44):(direction>0?.44:.56);
  let finish=copy(aim);
  if(!shot&&request.outcome==='intercepted')finish=foot(interceptor!);
  if(shot&&request.outcome==='blocked')finish=foot(defender!);
  if(shot&&request.outcome==='saved'){
    const keeper=b.players.filter(p=>p.side!==from.side).sort((a,c)=>Math.abs(a.x-aim.x)+Math.abs(a.y-.5)-Math.abs(c.x-aim.x)-Math.abs(c.y-.5))[0];
    finish=keeper?foot(keeper):{x:direction>0?.96:.04,y:aim.y};
  }
  const id=uid(),endId=uid(),actor=shortName(from.name),receiver=to?shortName(to.name):'';
  const label=(shot?`${actor} · ${outcomeNames[request.outcome]}${['goal','saved'].includes(request.outcome)?' · On target':''}`:`${actor} → ${receiver} · ${request.kind==='through'?'Through ball · ':''}${request.outcome==='intercepted'?`Intercepted by ${shortName(interceptor!.name)}`:'Completed'}`).slice(0,100);
  const action:FootballAction={...request,target:aim,id,label,endSceneId:endId,basis:'presenter',...(shot&&['goal','saved','on-target','off-target'].includes(request.outcome)?{onTarget:request.outcome!=='off-target'}:{})};
  // Each action is one transition plus a hold; the existing player/ball renderer animates both.
  const old=b.scenes[i].ballAction;
  if(old)throw Error('This step already starts an action. Select its finish step to add the next action.');
  const clean=b.drawings.filter(d=>!d.id.startsWith('ball-action:'));
  const ink:Drawing[]=[{id:`ball-action:${id}:path`,type:'arrow',points:[from.x,from.y,finish.x,finish.y],color:shot?'#ffcf82':'#dfff81',width:4,opacity:.9},{id:`ball-action:${id}:label`,type:'text',points:[.025,.025],color:'#efffd6',width:3,opacity:1,text:label}];
  if(request.kind==='through')ink.push({id:`ball-action:${id}:run`,type:'run',points:[to!.x,to!.y,aim.x,aim.y],color:'#79dee4',width:3,opacity:.85});
  if(clean.length+ink.length>500)throw Error('Clear some marks before adding this action.');
  const start=b.scenes[i];Object.assign(start,{players:copy(b.players),drawings:[...copy(clean),...copy(ink)],ball:foot(from),duration:request.seconds,ballAction:action});
  const end={...copy(start),id:endId,title:label.slice(0,60),note:label,duration:1,ball:finish,ballAction:undefined,cut:undefined,play:undefined};
  if(request.kind==='through'){const runner=end.players.find(p=>p.uid===to!.uid)!;runner.x=clamp(aim.x-.014*(from.side==='home'?1:-1));runner.y=clamp(aim.y-.012);}
  const attach=(frame:Frame,id:string)=>{const player=frame.players.find(p=>p.uid===id)!;frame.ball={...frame.ball,carrierId:id,offset:{x:frame.ball.x-player.x,y:frame.ball.y-player.y}};};
  attach(start, from.uid);
  if(!shot)attach(end, request.outcome==='intercepted'?interceptor!.uid:to!.uid);
  if(shot&&request.outcome==='saved'){
    const keeper=end.players.filter(p=>p.side!==from.side).sort((a,c)=>Math.hypot(a.x-finish.x,a.y-finish.y)-Math.hypot(c.x-finish.x,c.y-finish.y))[0];
    if(keeper)attach(end,keeper.uid);
  }
  b.scenes.splice(i+1,0,end);b.activeScene=end.id;b.players=copy(end.players);b.drawings=copy(end.drawings);b.ball=copy(end.ball);b.settings.ballVisible=true;
  return b;
}
/** Removing an action endpoint also removes its now-invalid transition and linked graphics. */
export function removeFootballActionLinks(board:Board,removedSceneId:string){
  const ids=board.scenes.filter(s=>s.id===removedSceneId||s.ballAction?.endSceneId===removedSceneId).flatMap(s=>s.ballAction?[s.ballAction.id]:[]);
  for(const s of board.scenes){if(s.ballAction&&ids.includes(s.ballAction.id))delete s.ballAction;s.drawings=s.drawings.filter(d=>!ids.some(id=>d.id.startsWith(`ball-action:${id}:`)));}
  board.drawings=board.drawings.filter(d=>!ids.some(id=>d.id.startsWith(`ball-action:${id}:`)));
}
