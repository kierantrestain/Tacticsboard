export type BallActionKind = 'pass' | 'through' | 'shot';
export type BallOutcome = 'completed' | 'intercepted' | 'on-target' | 'goal' | 'saved' | 'off-target' | 'blocked' | 'woodwork';
export interface BallActionRequest {
  kind: BallActionKind;
  fromId: string;
  toId?: string;
  interceptorId?: string;
  defenderId?: string;
  target?: {x:number;y:number};
  goalSide?: 'left'|'right';
  goalTarget?: 'left'|'centre'|'right';
  outcome: BallOutcome;
  seconds: number;
}
export interface FootballAction extends BallActionRequest {
  id:string;
  label:string;
  endSceneId:string;
  basis:'presenter';
  onTarget?:boolean;
}
export function isFootballAction(value: unknown): value is FootballAction {
  if(!value||typeof value!=='object')return false;
  const a=value as FootballAction;
  return ['pass','through','shot'].includes(a.kind)&&typeof a.id==='string'&&typeof a.fromId==='string'&&typeof a.label==='string'&&a.label.length<=100&&typeof a.endSceneId==='string'&&a.basis==='presenter'&&Number.isFinite(a.seconds)&&a.seconds>=.5&&a.seconds<=6&&[a.toId,a.interceptorId,a.defenderId].every(id=>id===undefined||typeof id==='string')&&(a.kind==='shot'?['on-target','goal','saved','off-target','blocked','woodwork']:['completed','intercepted']).includes(a.outcome)&&(a.onTarget===undefined||typeof a.onTarget==='boolean')&&(a.goalSide===undefined||['left','right'].includes(a.goalSide))&&(a.goalTarget===undefined||['left','centre','right'].includes(a.goalTarget))&&(a.target===undefined||!!a.target&&typeof a.target==='object'&&[a.target.x,a.target.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1));
}
