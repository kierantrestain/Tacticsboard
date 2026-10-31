import type { ComparisonSnapshot } from '../football/comparisonModel';
import { freezeComparison, validComparison } from '../football/comparisonModel';
import { useStudio } from '../store';
import { defaultBroadcast } from './types';
import { editDesk, useRuntime } from './runtime';
export function presentComparison(snapshot:ComparisonSnapshot) {
  if(!validComparison(snapshot)||!snapshot.fields.length)throw Error('Choose two to five entries and at least one graphic metric.');
  editDesk(d=>{d.comparison=freezeComparison(snapshot);d.view='stats';d.statsSnapshot=undefined;d.statsFields=undefined;d.broadcast={...defaultBroadcast(),...d.broadcast,headline:snapshot.title,subtitle:snapshot.scope,showScore:false};d.lowerThird=snapshot.title;});
  useRuntime.setState({view:'stats',sidebar:'tactics',mediaPlaying:false,activeCueId:null});
  useStudio.getState().set({modal:null,playing:false,previewTime:null});
}
