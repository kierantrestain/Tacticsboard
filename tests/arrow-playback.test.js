import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planArrowStage } from '../dist/arrow-playback.js';

const point = (x,y) => ({x,y});
const player = (id,x,y,team = 'home') => ({id,team,name:id,number:1,x,y});
const anchor = (index,playerId) => ({index,playerId,dx:0,dy:0});
const mark = (id,type,start,end,anchors) => ({id,type,color:'#08e5f1',points:[start,end],anchors});

test('plays multiple linked runs and delivers a pass to a moving teammate', () => {
  const scene = {
    players: [player('passer',100,300),player('receiver',310,300),player('runner',390,470)],
    ball: {x:126,y:300,ownerId:'passer'},
    marks: [
      mark('pass','arrow',point(0,0),point(0,0),[anchor(0,'passer'),anchor(1,'receiver')]),
      mark('receiver run','run',point(0,0),point(500,280),[anchor(0,'receiver')]),
      mark('extra run','run',point(390,470),point(560,470)),
      mark('next pass','arrow',point(0,0),point(690,500),[anchor(0,'receiver')]),
      mark('line','line',point(200,110),point(450,220)),
    ],
  };
  const before = structuredClone(scene);
  const plan = planArrowStage(scene);
  assert.equal(plan.ran,3);
  assert.equal(plan.skipped,1);
  assert.equal(plan.transition,'pass');
  assert.equal(plan.scene.ball.ownerId,'receiver');
  assert.deepEqual(plan.scene.players.map(({x,y}) => [x,y]),[[100,300],[500,280],[560,470]]);
  assert.ok(Math.abs(Math.hypot(plan.scene.ball.x - 500,plan.scene.ball.y - 280) - 27) < .01);
  assert.deepEqual(plan.scene.marks.map(item => item.id),['next pass','line']);
  assert.deepEqual(scene,before);
  assert.equal(planArrowStage(plan.scene).ran,1);
});

test('leaves a loose ball at its saved location while another player runs', () => {
  const scene = {
    players:[player('runner',200,350)],
    ball:{x:222,y:350,ownerId:null},
    marks:[
      mark('run','run',point(200,350),point(500,350)),
      mark('pass elsewhere','arrow',point(800,300),point(900,300)),
    ],
  };
  const plan = planArrowStage(scene);
  assert.equal(plan.scene.players[0].x,500);
  assert.deepEqual(plan.scene.ball,scene.ball);
  assert.equal(plan.skipped,1);
  assert.equal(planArrowStage(plan.scene),null);
});

test('keeps a runner reaching a legacy loose ball from dragging it along in mid-stage', () => {
  const scene = {
    players:[player('runner',200,350)],
    ball:point(525,350),
    marks:[mark('run','run',point(200,350),point(500,350))],
  };
  const plan = planArrowStage(scene);
  assert.equal(plan.startOwner,null);
  assert.deepEqual(plan.scene.ball,{x:525,y:350,ownerId:null});
});

test('keeps the ball at the carrier’s feet and gives a dribble priority over a second run', () => {
  const scene = {
    players:[player('carrier',230,250)],
    ball:{x:249,y:268},
    marks:[
      mark('run','run',point(230,250),point(380,250)),
      mark('dribble','dribble',point(230,250),point(440,340)),
    ],
  };
  const plan = planArrowStage(scene);
  assert.equal(plan.transition,'dribble');
  assert.equal(plan.startOwner,'carrier');
  assert.deepEqual(plan.scene.ball,{x:459,y:358,ownerId:'carrier'});
  assert.equal(plan.skipped,1);
  const runOnly = planArrowStage({...scene,marks:[scene.marks[0]]});
  assert.equal(runOnly.transition,'dribble');
  assert.deepEqual(runOnly.scene.ball,{x:399,y:268,ownerId:'carrier'});
});

test('finishes a shot inside the net or at the exact off-target location', () => {
  const scene = {
    players:[player('shooter',800,330)],
    ball:{x:824,y:330,ownerId:'shooter'},
    marks:[mark('shot','shot',point(800,330),point(975,302),[anchor(0,'shooter')])],
  };
  assert.deepEqual(planArrowStage(scene).scene.ball,{x:988,y:302,ownerId:null});
  scene.marks[0].points[1] = point(975,355);
  assert.deepEqual(planArrowStage(scene).scene.ball,{x:975,y:355,ownerId:null});
});

test('honors hidden teams and avoids moving the wrong player when an arrow is anchored', () => {
  const scene = {
    players:[player('active',100,300),player('hidden',115,300,'away')],
    ball:{x:125,y:300,ownerId:'active'},
    marks:[
      mark('hidden passer','arrow',point(115,300),point(600,330),[anchor(0,'hidden')]),
      mark('hidden runner','run',point(115,300),point(600,330),[anchor(0,'hidden')]),
    ],
  };
  assert.equal(planArrowStage(scene,{away:false}),null);
  assert.equal(planArrowStage(scene).ran,1);
});
