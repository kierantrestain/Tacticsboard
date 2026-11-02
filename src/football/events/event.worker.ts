import { importEvents, makeCohort } from './import';
import { normaliseDataset } from './model';
import {gunzipSync,strFromU8} from 'fflate';
self.onmessage=(e:MessageEvent)=>{try{const input=e.data;if(input.compressed){const json=strFromU8(gunzipSync(input.compressed));if(json.length>32*1048576)throw Error('The archive exceeds the supported event limit.');input.dataset.events=JSON.parse(json);}const d=input.text!==undefined?importEvents(input.text,input.metadata):normaliseDataset(input.dataset);self.postMessage({dataset:d,cohort:input.cohort||makeCohort(d)});}catch(error){self.postMessage({error:error instanceof Error?error.message:'Event processing failed.'});}};
