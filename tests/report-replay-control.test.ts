import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, newBoard } from '../src/core';
import { cueContentKey, makeCue } from '../src/studio/cueModel';
import { collectReportMoments } from '../src/football/reportReplay';
import catalogueData from '../public/data/catalogue.json';
import reportData from '../public/data/reports/401878768.json';
import type { Catalogue, Match, MatchDetails, Board } from '../src/types';
const state = vi.hoisted(() => ({ studio: {} as any, runtime: {} as any, holds: [] as boolean[] }));
vi.mock('../src/store', () => ({ useStudio: { getState: () => state.studio } }));
vi.mock('../src/studio/runtime', () => ({ useRuntime: { getState: () => state.runtime } }));
vi.mock('../src/studio/production', () => ({ setLiveFollow: (value: boolean) => { state.holds.push(value); state.runtime.follow = value; } }));
import { createReportReplays } from '../src/football/replayControl';
const catalogue = catalogueData as unknown as Catalogue, report = reportData as unknown as MatchDetails;
const match = catalogue.matches.find(m=>m.id===report.id)! as Match;
beforeEach(() => {
  state.holds = [];
  state.studio = { board: newBoard(catalogue.teams[0], catalogue.teams[1]), catalogue, loading: false, set: (v:any)=>Object.assign(state.studio,v), notify: vi.fn(), past: [] as Board[], commit: (fn:any)=>{ const before=copy(state.studio.board); fn(state.studio.board); state.studio.past.push(before); } };
  state.runtime = { view:'board',camera:'broadcast',time:0,follow:true,busy:'',set:(v:any)=>Object.assign(state.runtime,v) };
});
describe('report draft workflow', () => {
  it('creates both goals as separate saved sequences, preserves the current show, and holds programme before editing', () => {
    const current = state.studio.board as Board; current.scenes.push({...copy(current.scenes[0]),id:'unsaved-move'});
    current.studio!.cues = [makeCue(current,'board','broadcast',0)];
    const previousId = current.studio!.cues[0].id;
    const goals=collectReportMoments(match,report).filter(m=>m.kind==='goal');
    expect(goals).toHaveLength(2);
    const created=createReportReplays(match,report,goals.map(moment=>({moment})));
    expect(created).toHaveLength(2);expect(created.every(c=>c.sequence!.length>=3&&!c.reviewedAt&&c.recreation?.matchId===match.id)).toBe(true);
    expect(state.studio.board.studio.cues.some((c:any)=>c.id===previousId)).toBe(true);
    expect(state.studio.board.studio.cues.some((c:any)=>c.title.includes('retained draft'))).toBe(true);
    expect(state.holds).toEqual([false]);expect(state.runtime.activeCueId).toBe(created[0].id);expect(state.studio.past).toHaveLength(1);
  });
  it('does not duplicate a saved recreation or retain an unchanged saved moment again', () => {
    const goals=collectReportMoments(match,report).filter(m=>m.kind==='goal');
    const first=createReportReplays(match,report,[{moment:goals[0]}])[0];
    const current=state.studio.board as Board;
    expect(cueContentKey(makeCue(current,'board','broadcast',0))).toBe(cueContentKey(first));
    expect(()=>createReportReplays(match,report,[{moment:goals[0]}])).toThrow('already saved');
    createReportReplays(match,report,[{moment:goals[1]}]);
    expect(state.studio.board.studio.cues).toHaveLength(2);
  });
  it('rejects unfinished movement and a full show without changing the board', () => {
    const goal=collectReportMoments(match,report).find(m=>m.kind==='goal')!;
    state.runtime.movementDraft={sceneId:'moving'};const before=copy(state.studio.board);
    expect(()=>createReportReplays(match,report,[{moment:goal}])).toThrow('Finish or cancel');expect(state.studio.board).toEqual(before);
    state.runtime.movementDraft=null;state.studio.board.studio.cues=Array.from({length:80},()=>makeCue(before,'board','broadcast',0));
    expect(()=>createReportReplays(match,report,[{moment:goal}])).toThrow('not enough room');expect(state.holds).toHaveLength(0);
  });
  it('retains an edited single-step workspace after reload, even without undo history', () => {
    const current = state.studio.board as Board;
    current.players[0].x = .47;
    current.scenes[0].players = copy(current.players);
    const before = copy(current);
    const goal = collectReportMoments(match,report).find(m=>m.kind==='goal')!;
    createReportReplays(match,report,[{moment:goal}]);
    const retained = state.studio.board.studio.cues.find((c:any)=>c.title.includes('retained draft'));
    expect(retained.frame.players).toEqual(before.players);
    expect(retained.sequence).toEqual(before.scenes);
    expect(state.studio.past).toHaveLength(1);
  });
  it('saves one draft when the same event is requested twice in a batch', () => {
    const goal=collectReportMoments(match,report).find(m=>m.kind==='goal')!;
    expect(createReportReplays(match,report,[{moment:goal},{moment:goal}])).toHaveLength(1);
    expect(state.studio.board.studio.cues).toHaveLength(1);
  });
});
