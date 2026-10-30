import {beforeEach,describe,it,expect,vi} from 'vitest';
import {newBoard} from '../src/core';
import catalogue from '../public/data/catalogue.json';
import type {Team} from '../src/types';
const state=vi.hoisted(()=>({studio:{} as any,runtime:{} as any}));
vi.mock('../src/store',()=>({useStudio:{getState:()=>state.studio}}));
vi.mock('../src/studio/runtime',()=>({useRuntime:{getState:()=>state.runtime,setState:(v:any)=>Object.assign(state.runtime,v)},editDesk:(fn:any)=>fn(state.studio.board.studio)}));
vi.mock('../src/studio/showControl',()=>({recallCue:vi.fn(),saveCue:vi.fn(),updateCue:vi.fn()}));
import {executeHostCommand} from '../src/studio/host/actions';
import {saveCue,updateCue} from '../src/studio/showControl';
beforeEach(()=>{vi.clearAllMocks();state.studio={board:newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team),loading:false,previewTime:null,set:vi.fn(),commit:(fn:any)=>fn(state.studio.board)};state.runtime={view:'board',busy:'',assets:[],assetAvailability:{},set:(v:any)=>Object.assign(state.runtime,v)};});
describe('host controls',()=>{
 it('rejects an unprepared view and opens verified footage at its clip start',()=>{expect(()=>executeHostCommand({type:'view',view:'footage'})).toThrow('Prepare');state.studio.board.studio.assetId='clip';state.studio.board.studio.trim={start:12,end:20};state.runtime.assets=[{id:'clip',type:'video',duration:30}];state.runtime.assetAvailability.clip=true;executeHostCommand({type:'view',view:'footage'});expect(state.runtime).toMatchObject({view:'footage',time:12,mediaPlaying:false});});
 it('updates the selected moment without creating a duplicate',()=>{state.runtime.activeCueId='saved';state.studio.board.studio.cues=[{id:'saved'}];executeHostCommand({type:'update-shot'});expect(updateCue).toHaveBeenCalledOnce();expect(saveCue).not.toHaveBeenCalled();executeHostCommand({type:'save-shot'});expect(saveCue).toHaveBeenCalledOnce();});
 it('blocks partial-movement saves and recalls',()=>{state.runtime.movementDraft={sceneId:'draft'};for(const command of [{type:'update-shot'},{type:'save-shot'},{type:'cue',id:'saved'},{type:'view',view:'replay'}] as const)expect(()=>executeHostCommand(command)).toThrow('Finish or cancel');expect(saveCue).not.toHaveBeenCalled();expect(updateCue).not.toHaveBeenCalled();});
 it('adds an explanation pause to video and supports validated slow motion',()=>{state.runtime.view='footage';state.runtime.time=7;state.runtime.assets=[{id:'clip',type:'video',duration:30}];state.studio.board.studio.assetId='clip';state.studio.board.studio.trim={start:3,end:15};executeHostCommand({type:'pause-explain'});expect(state.studio.board.studio.explainStops.clip).toEqual([expect.objectContaining({time:7,hold:3})]);expect(state.runtime.mediaPlaying).toBe(false);executeHostCommand({type:'pause-explain'});expect(state.studio.board.studio.explainStops.clip).toHaveLength(1);executeHostCommand({type:'rate',value:.5});expect(state.runtime.rate).toBe(.5);expect(()=>executeHostCommand({type:'rate',value:99})).toThrow('supported');});
});

it('dispatches a football action through the same host command and blocks unfinished moves',()=>{const home=state.studio.board.players.filter((p:any)=>p.side==='home'),action={kind:'pass' as const,fromId:home[0].uid,toId:home[1].uid,outcome:'completed' as const,seconds:1};executeHostCommand({type:'ball-action',action});expect(state.studio.board.scenes[0].ballAction).toMatchObject({fromId:home[0].uid,toId:home[1].uid});state.runtime.movementDraft={sceneId:'draft'};expect(()=>executeHostCommand({type:'ball-action',action})).toThrow('Finish or cancel');});
