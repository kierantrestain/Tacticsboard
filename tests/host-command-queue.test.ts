import {describe,it,expect} from 'vitest';
import {HostCommandQueue} from '../src/studio/host/commandQueue';
function gate(){let open!:()=>void;const wait=new Promise<void>(r=>{open=r;});return{wait,open};}
describe('tablet input under latency',()=>{
 it('keeps the final drag position without replaying a backlog of stale positions',async()=>{const queue=new HostCommandQueue(),block=gate(),received:number[]=[];queue.enqueue(async()=>{await block.wait;received.push(0);});for(let n=1;n<=100;n++)queue.enqueue(async()=>{received.push(n);},'move:one');block.open();await queue.idle();expect(received).toEqual([0,100]);});
 it('preserves distinct drawings, gesture boundaries and action order',async()=>{const queue=new HostCommandQueue(),block=gate(),received:string[]=[];queue.enqueue(async()=>{await block.wait;});for(const [name,key] of [['old','move:a'],['finish','move:a'],['draw',undefined],['new','move:b'],['new finish','move:b']] as const)queue.enqueue(async()=>{received.push(name);},key);block.open();await queue.idle();expect(received).toEqual(['finish','draw','new finish']);});
 it('discards unsent actions when disconnected and accepts new actions after reconnect',async()=>{const queue=new HostCommandQueue(),block=gate(),received:string[]=[];queue.enqueue(async()=>{await block.wait;received.push('sent');});queue.enqueue(async()=>{received.push('stale');});queue.clear();block.open();await queue.idle();queue.enqueue(async()=>{received.push('fresh');});await queue.idle();expect(received).toEqual(['sent','fresh']);});
});
