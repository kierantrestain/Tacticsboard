import { describe,it,expect } from 'vitest';
import { newBoard,copy,frameAt,syncScene,isBoard } from '../src/core';
import { giveBall,dropBall,resolvedBall } from '../src/studio/possession';
import { createMovement } from '../src/studio/sequenceEditing';
import { moveUnit } from '../src/studio/teamMovement';
import { addFootballAction } from '../src/studio/footballActions';
import { editSequence,sceneBlocks } from '../src/studio/sequenceEditing';
import { passingOptions,teamDimensions } from '../src/studio/spatialAnalysis';
import { makeCue,cueBoard } from '../src/studio/cueModel';
import catalogue from '../public/data/catalogue.json';
import type { Team } from '../src/types';
const setup=()=>newBoard(catalogue.teams[0] as Team,catalogue.teams[1] as Team,'eng.1');
describe('possessed ball movement',()=>{
 it('follows individual, bounded group, and curved replay movement with a constant foot offset',()=>{
  let b=setup();const p=b.players[4];giveBall(b,p.uid);syncScene(b);
  const offset=copy(b.ball.offset!);b.players[4].x+=.1;syncScene(b);expect(b.ball.x-b.players[4].x).toBeCloseTo(offset.x);
  b=moveUnit(b,{ids:b.players.filter(p=>p.side==='home').map(p=>p.uid),operation:'forward',direction:'right'});syncScene(b);expect(b.ball.x-b.players.find(q=>q.uid===p.uid)!.x).toBeCloseTo(offset.x);
  b=createMovement(b);b.players.find(q=>q.uid===p.uid)!.x+=.2;syncScene(b);b.scenes[1].motion={easing:'linear',curves:{[p.uid]:.6}};
  for(const time of [.2,.8,1,1.8,2.2]){const frame=frameAt(b,time),owner=frame.players.find(q=>q.uid===p.uid)!;expect(frame.ball.carrierId).toBe(p.uid);expect(frame.ball.x-owner.x).toBeCloseTo(offset.x);expect(frame.ball.y-owner.y).toBeCloseTo(offset.y);}
  expect(frameAt(b,1).players.find(q=>q.uid===p.uid)!.y).not.toBeCloseTo(b.scenes[0].players.find(q=>q.uid===p.uid)!.y);
 });
 it('attaches a deliberately dropped ball, releases it in space, and removes a deleted carrier',()=>{
  const b=setup(),p=b.players[2];b.ball={x:p.x+.01,y:p.y};dropBall(b);expect(b.ball.carrierId).toBe(p.uid);
  giveBall(b,null);b.ball={x:.5,y:.01};dropBall(b);expect(b.ball.carrierId).toBeUndefined();
  giveBall(b,p.uid);b.players=b.players.filter(q=>q.uid!==p.uid);syncScene(b);expect(b.ball.carrierId).toBeUndefined();
 });
 it('transfers completed and intercepted passes and leaves the ball in flight between endpoints',()=>{
  const b=setup(),home=b.players.filter(p=>p.side==='home'),away=b.players.filter(p=>p.side==='away');
  for(const intercepted of [false,true]){const n=addFootballAction(b,{kind:'pass',fromId:home[2].uid,toId:home[3].uid,seconds:1,outcome:intercepted?'intercepted':'completed',interceptorId:away[2].uid});expect(frameAt(n,.5).ball.carrierId).toBeUndefined();expect(frameAt(n,1).ball.carrierId).toBe(intercepted?away[2].uid:home[3].uid);expect(isBoard(n)).toBe(true);}
 });
 it('preserves possession in saved cues and rejects unknown owners and invalid offsets',()=>{
  const b=setup();giveBall(b,b.players[1].uid);syncScene(b);const cue=makeCue(b,'board','broadcast',0);expect(cueBoard(b,JSON.parse(JSON.stringify(cue))).ball).toEqual(b.ball);
  const bad=copy(b);bad.ball.carrierId='missing';expect(isBoard(bad)).toBe(false);bad.ball=copy(b.ball);bad.ball.offset=null as any;expect(isBoard(bad)).toBe(false);expect(resolvedBall({...b,players:[]})).toEqual({x:b.ball.x,y:b.ball.y});
 });
});
describe('editable sequence chains',()=>{
 it('duplicates chained football actions as one block with independent links and ownership',()=>{
  const b=setup(),ps=b.players.filter(p=>p.side==='home');let n=addFootballAction(b,{kind:'pass',fromId:ps[2].uid,toId:ps[3].uid,seconds:1,outcome:'completed'});n=addFootballAction(n,{kind:'pass',fromId:ps[3].uid,toId:ps[4].uid,seconds:1,outcome:'completed'});
  editSequence(n,n.scenes[1].id,'duplicate');expect(sceneBlocks(n.scenes).map(b=>b.length)).toEqual([3,3]);expect(n.scenes[3].ballAction!.endSceneId).toBe(n.scenes[4].id);expect(n.scenes[3].ballAction!.id).not.toBe(n.scenes[0].ballAction!.id);expect(n.scenes[3].cut).toBe(true);expect(isBoard(n)).toBe(true);
  editSequence(n,n.scenes[4].id,'earlier');expect(n.scenes[0].ballAction!.endSceneId).toBe(n.scenes[1].id);expect(n.scenes[0].ballAction!.id).not.toBe(n.scenes[3].ballAction!.id);
 });
 it('supports cuts and constant speed without interpolating through a restart',()=>{
  let b=setup();b=createMovement(b);const p=b.players[2];p.x+=.2;syncScene(b);b.scenes[1].motion={easing:'linear',curves:{}};expect(frameAt(b,.5).players[2].x).toBeCloseTo(b.scenes[0].players[2].x+.05);b.scenes[1].cut=true;expect(frameAt(b,1).players[2].x).toBe(b.scenes[0].players[2].x);expect(frameAt(b,2).players[2].x).toBe(p.x);
 });
});
describe('board geometry',()=>{
 it('reports real pitch-axis dimensions and detects defenders inside a passing corridor',()=>{
  const b=setup(),owner=b.players[1],receiver=b.players[2],defender=b.players.find(p=>p.side==='away')!;
  Object.assign(owner,{x:.2,y:.5});Object.assign(receiver,{x:.5,y:.5});Object.assign(defender,{x:.35,y:.51});b.players=[owner,receiver,defender];giveBall(b,owner.uid);
  expect(passingOptions(b)[0].distance).toBeCloseTo(31.5);expect(passingOptions(b)[0].blocked).toBe(true);defender.y=.6;expect(passingOptions(b)[0].blocked).toBe(false);expect(teamDimensions([owner,receiver])!.depth).toBeCloseTo(31.5);
 });
});
