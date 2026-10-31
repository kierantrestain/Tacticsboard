import { describe, expect, it } from 'vitest';
import catalogue from '../public/data/catalogue.json';
import type { Team } from '../src/types';
import { copy, frameAt, isBoard, newBoard } from '../src/core';
import { addCounterattack, moveUnit, setDefensiveShape, translateGroup, unitPlayers } from '../src/studio/teamMovement';
import { cueBoard, makeCue } from '../src/studio/cueModel';

const board=()=>newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team);
describe('moving teams and units',()=>{
  it('selects real units without including the keeper or the opposing team',()=>{
    const b=board(), outfield=unitPlayers(b,'home','outfield'), backs=unitPlayers(b,'home','back');
    expect(outfield).toHaveLength(10);expect(unitPlayers(b,'home','team')).toHaveLength(11);expect(backs.length).toBeGreaterThan(1);
    expect(outfield.every(p=>p.side==='home'&&!/goalkeep/i.test(p.position||''))).toBe(true);
    expect(unitPlayers(b,'away','selected',[backs[0].uid])).toEqual([backs[0]]);
    expect(new Set(['back','midfield','front'].flatMap(unit=>unitPlayers(b,'home',unit as 'back').map(p=>p.uid))).size).toBe(10);
  });
  it('preserves pairwise gaps for a group dragged against every edge, including a ball on the goal line',()=>{
    const positions=[{id:'a',x:.2,y:.1},{id:'b',x:.8,y:.9},{id:'c',x:.55,y:.4}];
    for(const [dx,dy] of [[2,2],[-2,-2],[.4,-.5],[-.3,.6]]){
      const moved=translateGroup(positions,dx,dy);
      expect(moved.every(p=>p.x>=.025-1e-10&&p.x<=.975+1e-10&&p.y>=.025-1e-10&&p.y<=.975+1e-10)).toBe(true);
      for(let i=1;i<moved.length;i++) {expect(moved[i].x-moved[0].x).toBeCloseTo(positions[i].x-positions[0].x);expect(moved[i].y-moved[0].y).toBeCloseTo(positions[i].y-positions[0].y);}
    }
    const boundary=[{x:0,y:.5},{x:.9,y:.6}];
    expect(translateGroup(boundary,0,0)).toEqual(boundary);
    expect(translateGroup(boundary,-1,0)).toEqual(boundary);
    expect(()=>translateGroup(positions,NaN,0)).toThrow('valid group');
  });
  it('drops the whole outfield back in the selected direction while retaining the keeper, opponent and ball',()=>{
    const b=board(),before=copy(b),ids=unitPlayers(b,'away','outfield').map(p=>p.uid);
    const next=moveUnit(b,{ids,operation:'back',direction:'left'});
    expect(b).toEqual(before);expect(next.ball).toEqual(before.ball);
    expect(next.players.filter(p=>!ids.includes(p.uid))).toEqual(before.players.filter(p=>!ids.includes(p.uid)));
    expect(next.players.filter(p=>ids.includes(p.uid)).every(p=>p.x>before.players.find(q=>q.uid===p.uid)!.x)).toBe(true);
    expect(next.scenes[0].players).toEqual(next.players);expect(isBoard(next)).toBe(true);
  });
  it('changes width without changing depth and aligns a back line with useful separation',()=>{
    const b=board(),ids=unitPlayers(b,'home','back').map(p=>p.uid), group=b.players.filter(p=>ids.includes(p.uid));
    for(const operation of ['narrow','widen'] as const){const next=moveUnit(b,{ids,operation,direction:'right'});expect(next.players.filter(p=>ids.includes(p.uid)).map(p=>p.x)).toEqual(group.map(p=>p.x));}
    const line=moveUnit(b,{ids,operation:'line',direction:'right'}).players.filter(p=>ids.includes(p.uid)).sort((a,b)=>a.y-b.y);
    expect(new Set(line.map(p=>p.x)).size).toBe(1);
    expect(line.slice(1).every((p,i)=>p.y-line[i].y>.05)).toBe(true);
    expect(()=>moveUnit(b,{ids:['unknown'],operation:'back',direction:'right'})).toThrow('Select players');
  });
  it('sets low, mid and high defensive shapes without moving the ball or the other team',()=>{
    const b=board(),before=copy(b), low=setDefensiveShape(b,'away','low','left'),mid=setDefensiveShape(b,'away','mid','left'),high=setDefensiveShape(b,'away','high','left');
    for(const next of [low,mid,high]) {expect(next.players.filter(p=>p.side==='home')).toEqual(before.players.filter(p=>p.side==='home'));expect(next.ball).toEqual(before.ball);expect(isBoard(next)).toBe(true);}
    const mean=(b:typeof low)=>unitPlayers(b,'away','outfield').reduce((n,p)=>n+p.x/10,0);
    expect(mean(low)).toBeGreaterThan(mean(mid));expect(mean(mid)).toBeGreaterThan(mean(high));expect(b).toEqual(before);
    const mirrored=setDefensiveShape(b,'away','low','right');
    for(const p of low.players.filter(p=>p.side==='away')){const q=mirrored.players.find(q=>q.uid===p.uid)!;expect(q.x).toBeCloseTo(1-p.x);expect(q.y).toBeCloseTo(1-p.y);}
  });
});
describe('counterattack with defensive recovery',()=>{
  it('animates both existing XIs, retains identities and ball travel, and recalls the complete saved sequence',()=>{
    const b=board(),before=copy(b),next=addCounterattack(b,{side:'home',direction:'right',seconds:4});
    expect(b).toEqual(before);expect(next.scenes).toHaveLength(3);expect(next.scenes[0].players).toEqual(before.players);
    expect(next.scenes.at(-1)!.players.map(p=>p.uid)).toEqual(before.players.map(p=>p.uid));
    for(const side of ['home','away'] as const)expect(next.scenes.at(-1)!.players.some(p=>p.side===side&&Math.abs(p.x-before.players.find(q=>q.uid===p.uid)!.x)>.01)).toBe(true);
    const halfway=frameAt(next,1);
    for(const side of ['home','away'] as const)expect(halfway.players.some(p=>p.side===side&&Math.abs(p.x-before.players.find(q=>q.uid===p.uid)!.x)>.005)).toBe(true);
    expect(next.scenes.every(s=>!s.ballAction)).toBe(true);expect(next.scenes[1].note).toContain('illustrative');
    const saved=makeCue(next,'board','broadcast',0);expect(cueBoard(board(),saved).scenes).toEqual(next.scenes);expect(isBoard(next)).toBe(true);
  });
  it('builds the opposing direction and rejects insertion over existing actions or an earlier step',()=>{
    const b=board(),right=addCounterattack(b,{side:'away',direction:'right',seconds:3}),left=addCounterattack(b,{side:'away',direction:'left',seconds:3});
    for(const p of right.scenes.at(-1)!.players){const q=left.scenes.at(-1)!.players.find(q=>q.uid===p.uid)!;expect(q.x).toBeCloseTo(1-p.x);expect(q.y).toBeCloseTo(p.y);}
    expect(()=>addCounterattack(right,{side:'home',direction:'right',seconds:3})).toThrow('final step');
    b.scenes[0].ballAction={kind:'shot'} as any;
    expect(()=>addCounterattack(b,{side:'home',direction:'right',seconds:4})).toThrow('finish step');
    expect(()=>addCounterattack(board(),{side:'home',direction:'right',seconds:NaN})).toThrow('valid counterattack');
  });
  it('keeps every wide player on their existing side of the pitch during recovery',()=>{
    const b=board(),next=addCounterattack(b,{side:'home',direction:'right',seconds:4});
    for(const p of next.scenes.at(-1)!.players){const original=b.players.find(q=>q.uid===p.uid)!;if(Math.abs(original.y-.5)>.02)expect(Math.sign(p.y-.5)).toBe(Math.sign(original.y-.5));}
  });
  it('keeps opposing icons apart when the attacking and recovering formation rows coincide',()=>{
    const next=addCounterattack(board(),{side:'home',direction:'right',seconds:4}),players=next.scenes.at(-1)!.players;
    const gaps=players.filter(p=>p.side==='home').flatMap(a=>players.filter(p=>p.side==='away').map(p=>Math.hypot((a.x-p.x)*105,(a.y-p.y)*68)));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(4.6-1e-8);
  });
});
