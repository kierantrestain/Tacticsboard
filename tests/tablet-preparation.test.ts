import {describe,it,expect} from 'vitest';
import {availableHostViews,explanationPause} from '../src/studio/host/tabletModel';
import {newBoard} from '../src/core';
import catalogue from '../public/data/catalogue.json';
import type {Team} from '../src/types';
import type {MediaAsset} from '../src/studio/types';
const board=()=>newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team);
const source={id:'clip',type:'video',duration:30} as MediaAsset;
describe('host preparation controls',()=>{
 it('offers only prepared views and waits for source availability',()=>{const b=board();expect(availableHostViews(b,[])).toEqual(['board','replay']);b.studio!.assetId='clip';b.studio!.trim={start:2,end:10};expect(availableHostViews(b,[source],{})).not.toContain('footage');expect(availableHostViews(b,[source],{clip:true})).toContain('footage');expect(availableHostViews(b,[source],{clip:false})).not.toContain('footage');});
 it('keeps a missing or empty report off the host view switch',()=>{const b=board();b.studio!.statsSnapshot={id:'report',lineups:[],teamStats:[]};expect(availableHostViews(b,[])).not.toContain('stats');b.studio!.statsSnapshot.teamStats=[{teamId:b.homeTeamId,stats:{totalShots:{label:'Shots',display:'8'}}}];expect(availableHostViews(b,[])).toContain('stats');});
 it('adds a three-second pause inside the clip without changing existing pauses',()=>{const previous=[{id:'first',time:5,hold:2}];const result=explanationPause({start:2,end:10},12,previous,'new');expect(result.time).toBe(9.96);expect(result.stops.at(-1)).toEqual({id:'new',time:9.96,hold:3});expect(previous).toHaveLength(1);expect(explanationPause({start:2,end:10},0,[],'start').time).toBe(2);});
 it('reuses a nearby pause and rejects invalid or excessive pauses',()=>{const pauses=Array.from({length:20},(_,i)=>({id:String(i),time:i,hold:3}));expect(explanationPause({start:0,end:30},5.04,pauses,'duplicate').stops).toBe(pauses);expect(()=>explanationPause({start:0,end:30},25,pauses,'extra')).toThrow('20');expect(()=>explanationPause({start:2,end:2},2,[],'bad')).toThrow();expect(()=>explanationPause({start:0,end:10},NaN,[],'bad')).toThrow();});
});
