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
import { createMovement } from '../src/studio/host/actions';
beforeEach(()=>{vi.clearAllMocks();state.studio={board:newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team),loading:false,previewTime:null,set:vi.fn(),commit:(fn:any)=>fn(state.studio.board)};state.runtime={view:'board',busy:'',assets:[],assetAvailability:{},set:(v:any)=>Object.assign(state.runtime,v)};});
describe('host controls',()=>{
 it('rejects an unprepared view and opens verified footage at its clip start',()=>{expect(()=>executeHostCommand({type:'view',view:'footage'})).toThrow('Prepare');state.studio.board.studio.assetId='clip';state.studio.board.studio.trim={start:12,end:20};state.runtime.assets=[{id:'clip',type:'video',duration:30}];state.runtime.assetAvailability.clip=true;executeHostCommand({type:'view',view:'footage'});expect(state.runtime).toMatchObject({view:'footage',time:12,mediaPlaying:false});});
 it('updates the selected moment without creating a duplicate',()=>{state.runtime.activeCueId='saved';state.studio.board.studio.cues=[{id:'saved'}];executeHostCommand({type:'update-shot'});expect(updateCue).toHaveBeenCalledOnce();expect(saveCue).not.toHaveBeenCalled();executeHostCommand({type:'save-shot'});expect(saveCue).toHaveBeenCalledOnce();});
 it('blocks partial-movement saves and recalls',()=>{state.runtime.movementDraft={sceneId:'draft'};for(const command of [{type:'update-shot'},{type:'save-shot'},{type:'cue',id:'saved'},{type:'view',view:'replay'}] as const)expect(()=>executeHostCommand(command)).toThrow('Finish or cancel');expect(saveCue).not.toHaveBeenCalled();expect(updateCue).not.toHaveBeenCalled();});
 it('adds an explanation pause to video and supports validated slow motion',()=>{state.runtime.view='footage';state.runtime.time=7;state.runtime.assets=[{id:'clip',type:'video',duration:30}];state.studio.board.studio.assetId='clip';state.studio.board.studio.trim={start:3,end:15};executeHostCommand({type:'pause-explain'});expect(state.studio.board.studio.explainStops.clip).toEqual([expect.objectContaining({time:7,hold:3})]);expect(state.runtime.mediaPlaying).toBe(false);executeHostCommand({type:'pause-explain'});expect(state.studio.board.studio.explainStops.clip).toHaveLength(1);executeHostCommand({type:'rate',value:.5});expect(state.runtime.rate).toBe(.5);expect(()=>executeHostCommand({type:'rate',value:99})).toThrow('supported');});
});

it('dispatches a football action through the same host command and blocks unfinished moves',()=>{const home=state.studio.board.players.filter((p:any)=>p.side==='home'),action={kind:'pass' as const,fromId:home[0].uid,toId:home[1].uid,outcome:'completed' as const,seconds:1};executeHostCommand({type:'ball-action',action});expect(state.studio.board.scenes[0].ballAction).toMatchObject({fromId:home[0].uid,toId:home[1].uid});state.runtime.movementDraft={sceneId:'draft'};expect(()=>executeHostCommand({type:'ball-action',action})).toThrow('Finish or cancel');});

it('uses one undoable edit for a team move and allows unit positioning while recording a movement',()=>{
 const b=state.studio.board, ids=b.players.filter((p:any)=>p.side==='away'&&!/goalkeep/i.test(p.position||'')).map((p:any)=>p.uid);
 const before=b.players.filter((p:any)=>ids.includes(p.uid)).map((p:any)=>p.x),commit=vi.fn((fn:any)=>fn(state.studio.board));state.studio.commit=commit;
 state.runtime.movementDraft={sceneId:b.activeScene};executeHostCommand({type:'unit-move',action:{ids,operation:'back',direction:'left'}});
 expect(commit).toHaveBeenCalledOnce();expect(state.studio.board.players.filter((p:any)=>ids.includes(p.uid)).every((p:any,i:number)=>p.x>before[i])).toBe(true);
 expect(()=>executeHostCommand({type:'counterattack',options:{side:'home',direction:'right',seconds:4}})).toThrow('Finish or cancel');
});

it('applies board playback speed at the current playhead and rejects board movement in footage view',()=>{
 state.studio.previewTime=2.5;executeHostCommand({type:'rate',value:.5});expect(state.studio.set).toHaveBeenCalledWith({speed:.5,playhead:2.5});
 state.runtime.view='footage';expect(()=>executeHostCommand({type:'team-shape',side:'home',shape:'low',direction:'right'})).toThrow('Open the tactical board');
});

it('builds a set piece as one undoable host command and holds incomplete movement drafts',()=>{
 const options={id:'corner' as const,side:'home' as const,direction:'right' as const,flank:'top' as const,pattern:'near',marking:'zonal' as const,wallSize:4,seconds:4,mode:'sequence' as const,goalTarget:'centre' as const,guides:true};
 const commit=vi.fn((fn:any)=>fn(state.studio.board));state.studio.commit=commit;
 executeHostCommand({type:'build-play',options});expect(commit).toHaveBeenCalledOnce();expect(state.studio.board.scenes.at(-1).play).toMatchObject({id:'corner',phase:'finish'});
 state.runtime.movementDraft={sceneId:'draft'};expect(()=>executeHostCommand({type:'build-play',options})).toThrow('Finish or cancel');
 state.studio.board.scenes.find((s:any)=>s.id===state.studio.board.activeScene).cut=true;const next=createMovement(state.studio.board);expect(next.scenes.find(s=>s.id===next.activeScene)!.cut).toBeUndefined();
});

it('plays from the selected step and keeps restart as a full-sequence replay',()=>{
 const b=state.studio.board,first=structuredClone(b.scenes[0]);first.id='next';b.scenes.push(first);b.activeScene='next';
 executeHostCommand({type:'play'});expect(state.studio.set).toHaveBeenCalledWith({playing:true,playhead:b.scenes[0].duration});
 executeHostCommand({type:'restart'});expect(state.studio.set).toHaveBeenCalledWith({playing:true,playhead:0});
});

it('assigns and releases possession on the tablet and keeps the carried ball in a unit move',()=>{
 const b=state.studio.board,p=b.players.find((p:any)=>p.side==='home'&&!/goalkeep/i.test(p.position||''));executeHostCommand({type:'possession',playerId:p.uid});expect(b.ball.carrierId).toBe(p.uid);const offset=b.ball.x-p.x;
 executeHostCommand({type:'unit-move',action:{ids:[p.uid],operation:'forward',direction:'right'}});expect(b.ball.x-b.players.find((q:any)=>q.uid===p.uid).x).toBeCloseTo(offset);
 executeHostCommand({type:'possession',playerId:null});expect(b.ball.carrierId).toBeUndefined();expect(()=>executeHostCommand({type:'possession',playerId:'missing'})).toThrow('Choose a player');
});
it('validates and saves actual run curves through the shared controller command',()=>{
 const next=createMovement(state.studio.board);state.studio.board=next;const id=next.players[1].uid;executeHostCommand({type:'motion',easing:'linear',cut:false,playerId:id,curve:.5});expect(next.scenes[1].motion).toEqual({easing:'linear',curves:{[id]:.5}});expect(()=>executeHostCommand({type:'motion',easing:'linear',cut:false,playerId:id,curve:Infinity})).toThrow('valid movement');
 state.runtime.movementDraft={sceneId:next.activeScene};expect(()=>executeHostCommand({type:'sequence-edit',id:next.activeScene,action:'duplicate'})).toThrow('Finish');
});
it('scrolls a complete prepared statistic graphic through the host command without losing selections',()=>{
 const b=state.studio.board,stats=Object.fromEntries(Array.from({length:20},(_,i)=>['s'+i,{label:'Stat '+i,value:i}]));b.studio.comparison={kind:'teams',title:'Clubs',scope:'PL',source:'ESPN',basis:'totals',fields:Object.keys(stats),entities:[{id:'a',name:'A',stats},{id:'b',name:'B',stats}]};state.runtime.view='stats';
 executeHostCommand({type:'stats-scroll',value:500});expect(state.studio.set).toHaveBeenCalledWith(expect.objectContaining({board:expect.objectContaining({studio:expect.objectContaining({statsScroll:12,comparison:expect.objectContaining({fields:expect.any(Array)})})})}));
 expect(b.studio.comparison.fields).toHaveLength(20);state.runtime.view='board';expect(()=>executeHostCommand({type:'stats-scroll',value:1})).toThrow('prepared statistic');
});

it('changes board replay speed when an untracked source remains selected',()=>{
 state.runtime.view='replay';state.studio.board.studio.assetId='untracked-source';state.studio.previewTime=2.5;
 executeHostCommand({type:'rate',value:.5});expect(state.studio.set).toHaveBeenCalledWith({speed:.5,playhead:2.5});expect(state.studio.board.studio.playbackRate).toBe(.5);
});
