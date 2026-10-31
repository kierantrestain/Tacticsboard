import { describe, it, expect } from 'vitest';
import { normaliseSummary } from '../api/football.js';
import { normaliseReportEvent } from '../lib/match-events.js';
import { buildReportReplay, collectReportMoments, defaultReplayOptions, reportedPoint } from '../src/football/reportReplay';
import { isReportRecreation } from '../src/football/recreationTypes';
import { copy, frameAt, isBoard, newBoard, totalDuration } from '../src/core';
import { cueBoard, makeCue, cueContentKey } from '../src/studio/cueModel';
import { isStudioDocument } from '../src/studio/types';
import { inspectView } from '../src/studio/readiness';
import type { Catalogue, Match, MatchDetails, Team } from '../src/types';

const team = (id: string, name: string, color: string): Team => ({ id, name, shortName: name, abbreviation: name.slice(0,3), color, alternateColor: '#ffffff', competitions: ['eng.1'], players: [], defaultFormation: '4-3-3' });
const home = team('h', 'Home FC', '#b42222'), away = team('a', 'Away FC', '#2222bb');
const match: Match = { id: 'match-one', league: 'eng.1', name: 'Home FC v Away FC', homeId: 'h', awayId: 'a', homeName: home.name, awayName: away.name, date: '2026-10-01T15:00:00Z', status: 'Full Time', completed: true, state: 'post', homeScore: '1', awayScore: '0', sourceUrl: 'https://example.org/match' };
const catalogue = { teams: [home, away] } as Catalogue;
const rawGoal = { id: 'goal-1', text: 'Goal! Home FC 1, Away FC 0. Alex Striker (Home FC) scores from close range. Assisted by Sam Creator.', clock: { value: 1800, displayValue: "30'" }, type: { text: 'Goal' }, team: { id: 'h' }, participants: [{ athlete: { id: 'striker', displayName: 'Alex Striker' } }, { athlete: { id: 'creator', displayName: 'Sam Creator' } }], fieldPositionX: 92, fieldPositionY: 55, fieldPosition2X: 100, fieldPosition2Y: 52, scoringPlay: true };
const report = (): MatchDetails => ({ id: match.id, sourceUrl: match.sourceUrl, teamStats: [], lineups: [{ teamId: 'h', side: 'home', players: [{ id: 'striker', name: 'Alex Striker', number: '9', position: 'Forward', starter: false, subbedIn: true }, { id: 'creator', name: 'Sam Creator', number: '8', position: 'Midfielder', starter: true }] }, { teamId: 'a', side: 'away', players: [{ id: 'keeper', name: 'Jo Keeper', number: '1', position: 'Goalkeeper', starter: true }] }], events: [normaliseReportEvent(rawGoal)], commentary: [] });
const setup = () => { const d = report(), moment = collectReportMoments(match, d)[0], current = newBoard(home, away); return { d, moment, current, options: defaultReplayOptions(match, moment) }; };

describe('report event evidence', () => {
  it('preserves identities, minutes and coordinates through both API event paths', () => {
    const actual = normaliseSummary({ keyEvents: [rawGoal], commentary: [{ time: rawGoal.clock, text: rawGoal.text, play: rawGoal }] }, match.id);
    expect(actual.events[0]).toMatchObject({ id: 'goal-1', seconds: 1800, teamId: 'h', participants: [{ id: 'striker' }, { id: 'creator' }], position: { x: 92, y: 55, targetX: 100, targetY: 52 } });
    expect(actual.commentary[0]).toMatchObject(actual.events[0]);
    const absent = normaliseReportEvent({ text: 'Incident', fieldPositionX: null, fieldPositionY: 0 });
    expect(absent.position).toBeUndefined();
    expect(normaliseReportEvent({ text: 'Incident', fieldPositionX: 0, fieldPositionY: 0 }).position).toEqual({ x: 0, y: 0 });
    expect(normaliseReportEvent({ text: 'Incident', fieldPositionX: 101, fieldPositionY: 55 }).position).toBeUndefined();
  });
  it('deduplicates key-event/commentary goals and retains provider evidence', () => {
    const d = report(); d.commentary = [normaliseReportEvent({ time: rawGoal.clock, text: rawGoal.text, play: rawGoal }, true)];
    const moments = collectReportMoments(match, d);
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({ kind: 'goal', actorId: 'striker', assisterId: 'creator', outcome: 'goal' });
    expect(collectReportMoments({ ...match, id: 'wrong' }, d)).toEqual([]);
  });
  it('resolves legacy reports without coordinates and excludes disallowed goals', () => {
    const d = report(); d.events = [{ minute: "30'", text: rawGoal.text, type: 'Goal' }, { minute: "51'", text: 'VAR Decision: No Goal for Alex Striker.', type: 'Goal Disallowed' }, { minute: "60'", text: 'Goal kick. Jo Keeper (Away FC).', type: 'Goal Kick' }];
    const moments = collectReportMoments(match, d);
    expect(moments).toHaveLength(1); expect(moments[0].actorId).toBe('striker'); expect(moments[0].event.position).toBeUndefined();
  });
  it('keeps shot outcomes distinct and does not call every on-target shot saved', () => {
    const d = report(); d.events = [
      { id: 'saved', text: 'Attempt saved. Alex Striker (Home FC) shoots.', type: 'Shot On Target' },
      { id: 'target', text: 'Alex Striker (Home FC) shoots on target.', type: 'Shot On Target' },
      { id: 'miss', text: 'Attempt missed. Alex Striker (Home FC) shoots wide.' },
      { id: 'block', text: 'Attempt blocked. Alex Striker (Home FC) shoots.' },
      { id: 'woodwork', text: 'Alex Striker (Home FC) hits the bar.' },
    ];
    expect(collectReportMoments(match, d).map(m => m.outcome)).toEqual(['saved','on-target','off-target','blocked','woodwork']);
  });
});
describe('editable report recreations', () => {
  it('anchors the shot to source coordinates and animates the ball without changing the input', () => {
    const { d, moment, current, options } = setup(), before = copy(current), b = buildReportReplay(current, catalogue, match, d, moment, options);
    expect(current).toEqual(before); expect(b.id).toBe(current.id); expect(b.match?.id).toBe(match.id); expect(b.players.map(p=>p.playerId).sort()).toEqual(['creator','striker']);
    const shotIndex = b.scenes.findIndex(s => s.ballAction?.kind === 'shot'), start = b.scenes[shotIndex], end = b.scenes[shotIndex+1];
    expect(start.ball).toEqual({ x: .92, y: .55 }); expect(end.ball).toEqual({ x: 1, y: .52 });
    const time = b.scenes.slice(0,shotIndex).reduce((n,s)=>n+s.duration,0)+start.duration/2;
    expect(frameAt(b,time).ball.x).toBeCloseTo(.96); expect(totalDuration(b)).toBeGreaterThan(5);
    expect(b.recreation?.coordinateBasis).toBe('provider'); expect(isBoard(b)).toBe(true);
    expect(b.scenes.every(s=>s.drawings.some(i=>i.text?.includes('ILLUSTRATIVE')))).toBe(true);
  });
  it('mirrors provider positions for the opposite direction and labels edited origins illustrative', () => {
    const { d, moment, current, options } = setup();
    expect(reportedPoint(moment,'left')).toEqual({x:1-.92,y:1-.55});
    const b = buildReportReplay(current,catalogue,match,d,moment,{...options,goalSide:'left'});
    expect(b.scenes.find(s=>s.ballAction?.kind==='shot')!.ball.x).toBeCloseTo(.08);
    const edited = buildReportReplay(current,catalogue,match,d,moment,{...options,origin:{x:.8,y:.4}});
    expect(edited.recreation?.coordinateBasis).toBe('illustrative');
    expect(edited.scenes.find(s=>s.ballAction?.kind==='shot')!.ball).toEqual({x:.8,y:.4});
  });
  it('joins the assist to the source shot location in either display direction without a ball jump', () => {
    const { d, moment, current, options } = setup();
    for (const goalSide of ['left','right'] as const) {
      const b=buildReportReplay(current,catalogue,match,d,moment,{...options,goalSide});
      const pass=b.scenes.find(s=>s.ballAction?.kind==='pass')!;
      const shot=b.scenes.find(s=>s.ballAction?.kind==='shot')!;
      expect(pass.ball).toEqual(b.scenes[0].ball);
      expect(pass.ballAction?.target).toEqual(shot.ball);
      const shotTime=b.scenes.slice(0,b.scenes.indexOf(shot)).reduce((n,s)=>n+s.duration,0);
      const before=frameAt(b,shotTime-.0001).ball, after=frameAt(b,shotTime).ball;
      expect(before.x).toBeCloseTo(after.x,3);expect(before.y).toBeCloseTo(after.y,3);
    }
  });
  it('retains the fixture competition and reverses the illustrative XI with the action', () => {
    const { d, moment, current, options } = setup();
    for(const lineup of d.lineups) {
      for(let i=0;i<10;i++)lineup.players.push({id:`${lineup.side}-extra-${i}`,name:`Player ${i}`,number:String(i+10),position:'Midfielder',starter:true});
    }
    const ucl={...match,league:'uefa.champions'};
    const right=buildReportReplay(current,catalogue,ucl,d,moment,{...options,includeXI:true,goalSide:'right'});
    const left=buildReportReplay(current,catalogue,ucl,d,moment,{...options,includeXI:true,goalSide:'left'});
    const p=right.players.find(p=>p.playerId==='home-extra-0')!, q=left.players.find(p=>p.playerId==='home-extra-0')!;
    expect(right.competition).toBe('uefa.champions');
    expect(left.players.filter(p=>p.side==='home')).toHaveLength(11);
    expect(q.x).toBeCloseTo(1-p.x);expect(q.y).toBeCloseTo(1-p.y);
  });
  it('uses a scorer who came off the bench without substituting a current squad or inventing unseen players', () => {
    const { d,moment,current,options }=setup();
    const b=buildReportReplay(current,catalogue,match,d,moment,{...options,includeXI:true});
    expect(b.players.map(p=>p.playerId).sort()).toEqual(['creator','striker']);
    expect(b.players.find(p=>p.playerId==='striker')?.name).toBe('Alex Striker');
    expect(()=>buildReportReplay(current,catalogue,match,d,moment,{...options,actorId:'not-in-match'})).toThrow('match lineup');
    expect(()=>buildReportReplay(current,catalogue,match,d,moment,{...options,assisterId:'keeper'})).toThrow('teammate');
  });
  it('can build a finish without adding a pass and retains missing-location uncertainty', () => {
    const { d,moment,current,options }=setup(); delete moment.event.position; d.events=[moment.event];
    const b=buildReportReplay(current,catalogue,match,d,moment,{...options,assisterId:undefined});
    expect(b.scenes.filter(s=>s.ballAction)).toHaveLength(1); expect(b.recreation?.coordinateBasis).toBe('illustrative');
    expect(b.players).toHaveLength(1);
  });
  it('retains an unnamed block endpoint without assigning a fabricated defender', () => {
    const {d,current}=setup();d.events=[{id:'block',text:'Attempt blocked. Alex Striker (Home FC) shoots.',type:'Shot Blocked',position:{x:85,y:50,targetX:88,targetY:51}}];
    const moment=collectReportMoments(match,d)[0],b=buildReportReplay(current,catalogue,match,d,moment,defaultReplayOptions(match,moment));
    expect(b.scenes.find(s=>s.ballAction)?.ballAction).toMatchObject({outcome:'blocked'});
    expect(b.scenes.find(s=>s.ballAction)?.ballAction?.defenderId).toBeUndefined(); expect(b.scenes.at(-1)?.ball).toEqual({x:.88,y:.51}); expect(isBoard(b)).toBe(true);
  });
  it('creates an editable position board for a set play without fabricating its pass or finish', () => {
    const {d,current}=setup();d.events=[{id:'corner',minute:"20'",text:'Corner, Home FC. Conceded by Jo Keeper.',participants:[{id:'keeper',name:'Jo Keeper'}]}];
    const moment=collectReportMoments(match,d)[0], b=buildReportReplay(current,catalogue,match,d,moment,{...defaultReplayOptions(match,moment),actorId:'creator'});
    expect(b.scenes.some(s=>s.ballAction)).toBe(false); expect(b.scenes).toHaveLength(2); expect(isBoard(b)).toBe(true);
  });
  it('keeps event provenance through saved cues, recall and JSON round trips', () => {
    const {d,moment,current,options}=setup(),b=buildReportReplay(current,catalogue,match,d,moment,options),cue=makeCue(b,'board','broadcast',0);
    b.studio!.cues=[cue]; const saved=JSON.parse(JSON.stringify(b));
    expect(isBoard(saved)).toBe(true);expect(isStudioDocument(saved.studio)).toBe(true);
    const recalled=cueBoard(newBoard(home,away),saved.studio.cues[0]);expect(recalled.recreation).toEqual(b.recreation);expect(recalled.scenes).toEqual(b.scenes);expect(recalled.title).toBe(b.title);
    const altered=copy(cue);altered.recreation!.sourceText='Another incident';expect(cueContentKey(altered)).not.toEqual(cueContentKey(cue));
    expect(inspectView(recalled,'board',[]).some(i=>i.code==='report-recreation'&&i.level==='review')).toBe(true);
    saved.recreation.sourceUrl='javascript:alert(1)';expect(isBoard(saved)).toBe(false);
    expect(isReportRecreation({...b.recreation,coordinateBasis:'tracking'})).toBe(false);
  });
});
