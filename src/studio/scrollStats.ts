import { useStudio } from '../store';
import { statsViewport } from './statsViewport';
import { emptyStudio } from './types';
/** Scrolling navigates the prepared graphic without adding drawing edits to Undo. */
export function scrollStats(value:number){
  if(!Number.isFinite(value))return;
  const s=useStudio.getState(),b=s.board;if(!b)return;
  const info=statsViewport(b),offset=Math.max(0,Math.min(info.maxOffset,value));
  if(Math.abs(offset-(b.studio?.statsScroll||0))<.001)return;
  s.set({board:{...b,studio:{...(b.studio||emptyStudio()),statsScroll:offset}}});
}
