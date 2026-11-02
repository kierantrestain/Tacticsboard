import { getRecord, putRecord } from '../../studio/assetStore';
import { uid } from '../../core';
import { validateResource, makeCohort } from './import';
import type { EventDataset, CohortSnapshot, GraphicResource } from './types';
const cache=new Map<string,GraphicResource>();
const pending=new Map<string,Promise<GraphicResource>>();
export const cachedResource=(id?:string)=>id?cache.get(id):undefined;
export async function loadResource(id:string):Promise<GraphicResource>{
 const existing=cache.get(id);if(existing)return existing;
 const running=pending.get(id);if(running)return running;
 const task=(async()=>{const value=await getRecord<GraphicResource>('resources',id);if(!value)throw Error('The saved event/cohort snapshot is missing. Import the complete episode backup before presenting it.');validateResource(value);cache.set(id,value);return value;})();
 pending.set(id,task);try{return await task;}finally{pending.delete(id);}
}
export async function saveResource(dataset:EventDataset,cohort:CohortSnapshot=makeCohort(dataset)){
 const resource:GraphicResource={format:'bangon-graphic-resource',version:1,dataset:structuredClone(dataset),cohort:structuredClone(cohort),createdAt:new Date().toISOString()};
 validateResource(resource);const id='analysis-'+uid();await putRecord('resources',id,resource);cache.set(id,resource);return id;
}
