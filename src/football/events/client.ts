import { sha256 } from '@noble/hashes/sha2.js';
import type { CohortSnapshot, EventDataset, EventIndex } from './types';
export function processEvents(input:{text?:string;metadata?:unknown;dataset?:unknown;cohort?:CohortSnapshot;compressed?:Uint8Array}):Promise<{dataset:EventDataset;cohort:CohortSnapshot}>{
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./event.worker.ts',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('Event processing timed out. Split this import into smaller match groups.'));},30000);worker.onmessage=e=>{clearTimeout(timer);worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Event worker could not process this dataset.'));};worker.postMessage(input);});
}
let index:EventIndex|null=null;
export async function historicalIndex(){if(index)return index;const r=await fetch('/data/events/index.json');if(!r.ok)throw Error('The historical event archive is unavailable in this installation.');index=await r.json();return index!;}
export async function historicalTeam(teamId:string){
 const index=await historicalIndex(),chunk=index.chunks.find(c=>c.teamId===teamId);if(!chunk)throw Error('This club has no event archive.');
 const response=await fetch(chunk.url);if(!response.ok)throw Error('The event archive could not be loaded. Existing prepared graphics are unchanged.');
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==chunk.bytes||Array.from(sha256(bytes),n=>n.toString(16).padStart(2,'0')).join('')!==chunk.sha256)throw Error('The event archive failed its integrity check.');
 const {chunks,cohort,...base}=index;return processEvents({dataset:{...base,completeTeamIds:[teamId]},compressed:bytes,cohort});
}
