import { describe,it,expect,vi,afterEach } from 'vitest';
import { statsWindow,statsViewport } from '../src/studio/statsViewport';
import { validComparison,freezeComparison,type ComparisonSnapshot } from '../src/football/comparisonModel';
import { newBoard,isBoard } from '../src/core';
import { emptyStudio,isStudioDocument } from '../src/studio/types';
import { makeCue,cueBoard,cueContentKey } from '../src/studio/cueModel';
import { comparisonCanvas } from '../src/studio/comparisonCanvas';
import type { Stat,Team } from '../src/types';
const club=(id:string):Team=>({id,name:id,shortName:id,abbreviation:id,color:'#123456',alternateColor:'#ffffff',players:[],competitions:['eng.1']});
const stats=Object.fromEntries(Array.from({length:67},(_,i)=>['metric'+i,{label:'Metric '+i,value:i}])) as Record<string,Stat>;
const snapshot:ComparisonSnapshot={kind:'teams',title:'Clubs',scope:'PL 2026/27',source:'ESPN',basis:'totals',entities:[{id:'a',name:'A',stats},{id:'b',name:'B',stats}],fields:Object.keys(stats)};
afterEach(()=>vi.unstubAllGlobals());
describe('unrestricted selected statistics',()=>{
 it('accepts every available comparison statistic and retains all fields in saved projects',()=>{expect(validComparison(snapshot)).toBe(true);const b=newBoard(club('a'),club('b'),'eng.1');b.studio!.comparison=freezeComparison(snapshot);b.studio!.statsScroll=58.5;const cue=makeCue(b,'stats','broadcast',0);b.studio!.cues=[cue];expect(isBoard(b)).toBe(true);const restored=JSON.parse(JSON.stringify(b));const recalled=cueBoard(restored,restored.studio.cues[0]);expect(recalled.studio!.comparison!.fields).toHaveLength(67);expect(recalled.studio!.statsScroll).toBe(58.5);expect(cueContentKey({...cue,statsScroll:0})).not.toBe(cueContentKey(cue));});
 it('opens every report field and validates long selections without the old eight-field cap',()=>{const d=emptyStudio();d.statsFields=Object.keys(stats);d.statsScroll=42;expect(isStudioDocument(d)).toBe(true);d.statsScroll=-1;expect(isStudioDocument(d)).toBe(false);d.statsScroll=NaN;expect(isStudioDocument(d)).toBe(false);});
 it('rejects duplicate or nonexistent fields while accepting the full metric union',()=>{expect(validComparison({...snapshot,fields:[...snapshot.fields,'metric0']})).toBe(false);expect(validComparison({...snapshot,fields:['missing']})).toBe(false);});
});
describe('continuous graphic viewport',()=>{
 it('can reach the final statistic, keeps fractional scrolling, and clamps either boundary',()=>{expect(statsWindow(67,1000)).toMatchObject({offset:59,maxOffset:59,first:60,last:67,count:67});expect(statsWindow(67,20.5)).toMatchObject({offset:20.5,first:21,last:29});expect(statsWindow(67,-10).offset).toBe(0);expect(statsWindow(67,Infinity).offset).toBe(0);expect(statsWindow(3,100)).toMatchObject({offset:0,maxOffset:0,first:1,last:3});});
 it('uses the right scrolling geometry for two-column tiles and single-column team comparisons',()=>{expect(statsWindow(29,100,2,4)).toMatchObject({rows:15,offset:11,maxOffset:11,first:23,last:29});const b=newBoard(club('a'),club('b'),'eng.1');b.studio!.comparison=snapshot;b.studio!.statsScroll=59;expect(statsViewport(b)).toMatchObject({count:67,offset:59,first:60,last:67,columns:1});});
 it('scrolls every selected match statistic in bars and player tiles',()=>{
  const b=newBoard(club('a'),club('b'),'eng.1');b.studio!.statsSnapshot={id:'m',teamStats:[{teamId:'a',stats},{teamId:'b',stats}],lineups:[{teamId:'a',side:'home',players:[{id:'p',name:'P',starter:true,stats}]}]};b.studio!.statsFields=Object.keys(stats);b.studio!.statsScroll=1000;
  expect(statsViewport(b)).toMatchObject({count:67,columns:1,first:60,last:67});b.studio!.statsPlayerId='p';expect(statsViewport(b)).toMatchObject({count:67,columns:2,first:61,last:67});
 });
 it('draws later metrics in the fixed broadcast canvas rather than silently slicing the first eight',()=>{
  const drawn:string[]=[];const c={fillText:(text:string)=>drawn.push(text),measureText:(text:string)=>({width:text.length*10}),createLinearGradient:()=>({addColorStop:()=>{}}),fillRect:()=>{},beginPath:()=>{},roundRect:()=>{},fill:()=>{},save:()=>{},restore:()=>{},rect:()=>{},clip:()=>{}};
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>c})});const canvas=comparisonCanvas(snapshot,59);expect(canvas.width).toBe(1600);expect(canvas.height).toBe(900);expect(drawn).toContain('Metric 66');expect(drawn).not.toContain('Metric 0');expect(drawn).toContain('60–67 / 67');
 });
});
