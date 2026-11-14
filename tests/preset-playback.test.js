import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inGoal } from '../dist/ball-motion.js';
import { templates } from '../dist/data.js';
import { coreTemplateStages, extraTemplates, motionDemoTemplate } from '../dist/extra-templates.js';
import { createPlayback, initialBoard, motionBetweenStages, parseBoard } from '../dist/model.js';

const presets = [
  ...templates.map(template => ({...template,stages:coreTemplateStages(template)})),
  ...extraTemplates,
  motionDemoTemplate,
];
const distance = (a,b) => Math.hypot(a.x - b.x,a.y - b.y);
const coordinates = ({x,y}) => ({x,y});

test('the initial board uses the authored build-up sequence', () => {
  const board = initialBoard();
  assert.deepEqual(board.phases.map(({id,...stage}) => stage),coreTemplateStages(templates[0]));
});

test('every preset saves as a board and plays from one recorded checkpoint to the next', () => {
  const motionKinds = new Set();
  for (const {name,stages,settings} of presets) {
    assert.ok(stages.length >= 3,name);
    const board = initialBoard();
    board.phases = stages.map((stage,index) => ({...stage,id:`stage-${index}`}));
    Object.assign(board.settings,settings);
    const restored = parseBoard(JSON.stringify(board));
    assert.ok(restored,name);
    const sample = createPlayback(restored.phases,restored.settings);

    for (const [index,stage] of restored.phases.entries()) {
      const context = `${name} / ${stage.title}`;
      const {ball,players,marks} = stage.scene;
      if (ball.ownerId !== null) {
        const owner = players.find(player => player.id === ball.ownerId && !player.benched);
        assert.ok(owner,context + ' has a player in control');
        assert.ok(distance(owner,ball) < 32,context + ' starts at the owner’s feet');
      }
      const next = restored.phases[index + 1]?.scene;
      if (!next) continue;
      const motion = motionBetweenStages(restored.phases,index,restored.settings);
      assert.deepEqual(marks[0].points,[coordinates(ball),coordinates(next.ball)],context + ' matches its drawn arrow');
      assert.equal(motion.kicker?.id ?? null,ball.ownerId,context + ' starts from the intended owner');
      assert.equal(motion.receiver?.id ?? null,next.ball.ownerId,context + ' reaches the intended owner');
      motionKinds.add(motion.motion);

      if (motion.motion === 'shot') {
        assert.ok(ball.ownerId && next.ball.ownerId === null && inGoal(next.ball),context + ' finishes in the goal');
        assert.deepEqual(sample(index,motion.arrival).ball,coordinates(next.ball),context + ' reaches the net on time');
      } else if (motion.motion === 'dribble') {
        assert.ok(ball.ownerId && ball.ownerId === next.ball.ownerId,context + ' stays with the dribbler');
      } else {
        assert.ok(next.ball.ownerId && next.ball.ownerId !== ball.ownerId,context + ' changes possession on receipt');
      }

      assert.deepEqual(sample(index,0).ball,ball,context + ' starts at the saved ball');
      assert.deepEqual(sample(index,1).ball,next.ball,context + ' ends at the saved ball');
      let previous = ball;
      for (let frame = 1; frame <= 240; frame++) {
        const current = sample(index,frame / 240).ball;
        assert.ok(distance(previous,current) < 26,context + ' stays continuous between frames');
        previous = current;
      }
    }
  }
  assert.deepEqual([...motionKinds].sort(),['dribble','lob','pass','shot']);
});
