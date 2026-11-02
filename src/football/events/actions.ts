import { useStudio } from '../../store';
import { editDesk, useRuntime } from '../../studio/runtime';
import { setLiveFollow } from '../../studio/production';
import { defaultBroadcast } from '../../studio/types';
import { cachedResource, loadResource } from './resource';
import { updateGraphic, alignedSourceTime } from './graphic';
import type { DataGraphic } from './types';
export async function presentGraphic(graphic:DataGraphic){
 const requestedCue=useRuntime.getState().activeCueId;const boardId=useStudio.getState().board?.id;if(!boardId)throw Error('Open an episode before preparing a graphic.');
 const resource=await loadResource(graphic.resourceId);graphic=updateGraphic(graphic,{},resource);if(useStudio.getState().board?.id!==boardId||useRuntime.getState().activeCueId!==requestedCue)throw Error('The selected episode changed while preparing data.');
 setLiveFollow(false);editDesk(d=>{d.dataGraphic=structuredClone(graphic);d.resourceIds=[...new Set([...(d.resourceIds||[]),graphic.resourceId])];d.comparison=undefined;d.view='stats';d.broadcast={...defaultBroadcast(),...d.broadcast,headline:graphic.title,subtitle:'FOOTBALL INTELLIGENCE',showScore:false};});
 useRuntime.setState({view:'stats',activeCueId:null,mediaPlaying:false});useStudio.getState().set({modal:null,playing:false,previewTime:null});
}
export function changeGraphic(patch:Partial<DataGraphic>){
 const g=useStudio.getState().board?.studio?.dataGraphic,r=cachedResource(g?.resourceId);if(!g||!r)throw Error('Wait for the prepared analysis to load.');const next=updateGraphic(g,patch,r);editDesk(d=>{d.dataGraphic=next;if(patch.title!==undefined){d.lowerThird=next.title;if(d.broadcast)d.broadcast.headline=next.title;}});
}
export function seekSelectedEvent(){
 const s=useStudio.getState(),g=s.board?.studio?.dataGraphic,r=cachedResource(g?.resourceId),e=r?.dataset.events.find(e=>g?.selectedEventIds.includes(e.id));if(!g||!e||!g.alignment)throw Error('Choose an event and align this period to footage first.');
 const asset=useRuntime.getState().assets.find(a=>a.id===g.alignment?.assetId),time=alignedSourceTime(g,e);if(asset&&g.alignment.assetRevision!==(asset.revision||0))throw Error('The aligned source was replaced or needs review. Align this period again before seeking.');if(!asset||time<0||time>asset.duration)throw Error('Aligned event is outside the available source.');
 setLiveFollow(false);editDesk(d=>{d.assetId=asset.id;d.trim={start:Math.max(0,time-3),end:Math.min(asset.duration,time+7)};d.view='footage';});useRuntime.setState({view:'footage',time,mediaPlaying:false});
}
