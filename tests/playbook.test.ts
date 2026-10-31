import { describe, expect, it } from 'vitest';
import catalogue from '../public/data/catalogue.json';
import type { Team } from '../src/types';
import { activeSceneTime, copy, frameAt, isBoard, newBoard, syncScene } from '../src/core';
import { buildPlay, restartIssues } from '../src/studio/playbook';
import { PLAYBOOK, type PlayRequest } from '../src/studio/playbookTypes';
import { makeCue, cueBoard } from '../src/studio/cueModel';

const board = () => newBoard(catalogue.teams[0] as unknown as Team, catalogue.teams[1] as unknown as Team);
const request = (overrides: Partial<PlayRequest> = {}): PlayRequest => ({ id: 'corner', side: 'home', direction: 'right', flank: 'top', pattern: 'near', marking: 'zonal', wallSize: 4, seconds: 4, mode: 'sequence', goalTarget: 'centre', guides: true, ...overrides });
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot((a.x - b.x) * 105, (a.y - b.y) * 68);

describe('complete tactical playbook', () => {
  for (const play of PLAYBOOK) for (const [pattern] of play.patterns) for (const direction of ['right', 'left'] as const) {
    it(`${play.name} / ${pattern} toward ${direction}: retains the two XIs and creates editable phases`, () => {
      const b = board(), before = copy(b), r = request({ id: play.id, pattern, direction, side: direction === 'right' ? 'away' : 'home', flank: 'bottom', outcome: 'saved' });
      const next = buildPlay(b, r);
      expect(b).toEqual(before); expect(isBoard(next)).toBe(true);
      expect(next.scenes.length).toBeGreaterThan(2);
      for (const scene of next.scenes) {
        expect(scene.players.map(p => p.uid)).toEqual(before.players.map(p => p.uid));
        expect(scene.players.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
      }
      expect(next.match).toEqual(before.match); expect(next.lineupSource).toEqual(before.lineupSource);
      expect(next.scenes.find(s=>s.id===next.activeScene)?.play?.phase||'setup').not.toBe('finish');
      const setup = next.scenes.find(s => s.play?.phase === 'setup');
      if (setup && play.category === 'restart') expect(restartIssues(setup, r, setup.play!.roles)).toEqual([]);
      const saved = makeCue(next, 'board', 'broadcast', 0);
      expect(cueBoard(board(), saved).scenes).toEqual(next.scenes);
    });
  }
  it('uses cuts into a new restart instead of animating the old ball into the corner', () => {
    const b = board(), next = buildPlay(b, request({ mode: 'setup' })), setup = next.scenes.at(-1)!;
    expect(setup.cut).toBe(true);
    expect(frameAt(next, b.scenes[0].duration - .01).ball).toEqual(b.ball);
    expect(frameAt(next, activeSceneTime(next)).ball).toEqual(setup.ball);
  });
  it('continues an edited setup without replacing the presenter’s stationary players or duplicating setup', () => {
    const r = request(), setup = buildPlay(board(), { ...r, mode: 'setup' });
    const coverId = setup.scenes.at(-1)!.play!.roles['home:cover-top'];
    const cover = setup.players.find(p => p.uid === coverId)!; cover.x = .44; cover.y = .28; syncScene(setup);
    const next = buildPlay(setup, r);
    expect(next.scenes).toHaveLength(setup.scenes.length + 2);
    expect(next.scenes.at(-1)!.players.find(p => p.uid === coverId)).toMatchObject({x:.44,y:.28});
    expect(next.scenes.at(-2)!.cut).toBeUndefined();
  });
  it('rejects edited illegal restart positions instead of silently repairing them', () => {
    const r = request({ id:'penalty', pattern:'direct', mode:'setup' }), setup = buildPlay(board(), r);
    setup.ball.x = .5; syncScene(setup);
    expect(() => buildPlay(setup, { ...r, mode:'sequence', outcome:'goal' })).toThrow('penalty mark');
  });
  it('honours the run-guide toggle on a placed setup and on a counterattack', () => {
    const r=request(),setup=buildPlay(board(),{...r,mode:'setup'});
    expect(setup.drawings.some(d=>d.id.startsWith('play:'))).toBe(true);
    const next=buildPlay(setup,{...r,guides:false});
    expect(next.scenes.slice(1).every(s=>s.drawings.every(d=>!d.id.startsWith('play:')))).toBe(true);
    const counter=buildPlay(board(),request({id:'counter',pattern:'break',guides:true}));
    expect(counter.scenes[0].drawings.some(d=>d.type==='run')).toBe(true);
    expect(buildPlay(board(),request({id:'counter',pattern:'break',guides:false})).drawings).toHaveLength(0);
  });
  it('asks for a new setup when a named player has been replaced, and can rebuild it',()=>{
    const r=request(),setup=buildPlay(board(),{...r,mode:'setup'}),taker=setup.scenes.at(-1)!.play!.roles['home:taker'];
    setup.players.find(p=>p.uid===taker)!.uid='replacement';syncScene(setup);
    expect(()=>buildPlay(setup,r)).toThrow('team changed');
    expect(isBoard(buildPlay(setup,{...r,mode:'setup'}))).toBe(true);
  });
  it('requires the presenter to choose a shot outcome and preserves a legal ball origin when animating it', () => {
    const r = request({id:'penalty',pattern:'direct'});
    expect(() => buildPlay(board(), r)).toThrow('outcome');
    const next = buildPlay(board(), { ...r, outcome:'saved' }), shot = next.scenes.find(s => s.ballAction)!;
    expect(shot.ball.x).toBeCloseTo(1 - 11/105); expect(shot.ball.y).toBe(.5);
    expect(shot.ballAction).toMatchObject({outcome:'saved',goalSide:'right'});
    expect(next.scenes.at(-1)?.cut).toBeUndefined();
    const frame = frameAt(next, next.scenes[0].duration + shot.duration/2);
    expect(frame.ball.x).toBeGreaterThan(shot.ball.x);
  });
  it('uses the selected ball-travel time for a direct set-piece animation',()=>{
    const next=buildPlay(board(),request({id:'free-kick',pattern:'direct',seconds:6,outcome:'saved'})),shot=next.scenes.find(s=>s.ballAction)!;
    expect(shot.duration).toBe(6);expect(shot.ballAction!.seconds).toBe(6);expect(isBoard(next)).toBe(true);
  });
  for (const [id, pattern] of [['corner','short'],['corner','edge'],['corner','far'],['free-kick','short'],['throw-in','line'],['goal-kick','short'],['goal-kick','long']] as const) {
    it(`routes ${id} / ${pattern} to the named receiver`, () => {
      const b = board(), players = b.players.filter(p => p.side === 'home'), r = request({id,pattern,takerId:id==='goal-kick'?players[2].uid:players[1].uid,receiverId:players[6].uid});
      const next = buildPlay(b, r), end = next.scenes.at(-1)!;
      expect(end.play!.roles['home:receiver']).toBe(r.receiverId);
      expect(distance(end.ball,end.players.find(p=>p.uid===r.receiverId)!)).toBeLessThan(2);
    });
  }
  for (const id of ['corner','free-kick','throw-in','goal-kick','penalty'] as const) for (const marking of ['zonal','man'] as const) {
    it(`${id} / ${marking}: starts with legal restart geometry`, () => {
      const r = request({ id, pattern: PLAYBOOK.find(p=>p.id===id)!.patterns[0][0], marking, mode:'setup' });
      const next = buildPlay(board(), r), scene = next.scenes.at(-1)!;
      expect(restartIssues(scene,r,scene.play!.roles)).toEqual([]);
      const opponent = scene.players.filter(p=>p.side==='away');
      if(id==='corner') expect(Math.min(...opponent.map(p=>distance(p,{x:1,y:0})))).toBeGreaterThanOrEqual(10.15);
      if(id==='free-kick') expect(Math.min(...opponent.map(p=>distance(p,scene.ball)))).toBeGreaterThanOrEqual(9.15);
      if(id==='throw-in') {expect(scene.ball.y).toBe(0);expect(Math.min(...opponent.map(p=>distance(p,scene.ball)))).toBeGreaterThanOrEqual(2);}
      if(id==='goal-kick') {expect(scene.ball.x*105).toBeLessThan(5.5);expect(opponent.every(p=>p.x*105>=16.5||Math.abs(p.y-.5)*68>=20.16)).toBe(true);}
      if(id==='penalty') {
        const taker=scene.play!.roles['home:taker'],keeper=scene.play!.roles['away:keeper'];
        expect(scene.players.find(p=>p.uid===keeper)!.x).toBe(1);
        expect(scene.players.filter(p=>p.uid!==taker&&p.uid!==keeper).every(p=>p.x<scene.ball.x&&distance(p,scene.ball)>=9.15&&(p.x<1-16.5/105||Math.abs(p.y-.5)>20.16/68))).toBe(true);
      }
    });
  }
  it('reflects restarts across the selected goal and touchline without changing player identities', () => {
    const b=board(),r=request({mode:'setup'}),a=buildPlay(b,r).scenes.at(-1)!,c=buildPlay(b,{...r,direction:'left',flank:'bottom'}).scenes.at(-1)!;
    expect(c.ball.x).toBeCloseTo(1-a.ball.x);expect(c.ball.y).toBeCloseTo(1-a.ball.y);
    expect(new Set(c.players.map(p=>p.uid))).toEqual(new Set(a.players.map(p=>p.uid)));
  });
  it('rejects invalid or incomplete requests atomically', () => {
    const b=board(),before=copy(b),r=request();
    for(const overrides of [{seconds:99},{wallSize:0},{pattern:'unknown'},{side:'unknown'},{marking:'unknown'},{takerId:b.players.find(p=>p.side==='away')!.uid}] as any[]) expect(()=>buildPlay(b,{...r,...overrides})).toThrow();
    const same=b.players.filter(p=>p.side==='home')[1].uid;expect(()=>buildPlay(b,{...r,takerId:same,receiverId:same})).toThrow('different');
    const missing=copy(b);missing.players.pop();expect(()=>buildPlay(missing,r)).toThrow('full XIs');expect(b).toEqual(before);
    const long=copy(b);long.scenes=Array.from({length:78},(_,i)=>({...copy(b.scenes[0]),id:String(i)}));long.activeScene='77';expect(()=>buildPlay(long,r)).toThrow('full');
    const setup=buildPlay(b,r);setup.activeScene=setup.scenes[0].id;expect(()=>buildPlay(setup,r)).toThrow('final step');
  });
});
