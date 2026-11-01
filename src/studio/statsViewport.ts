import type { Board } from '../types';
import type { MatchStats } from './types';
import { statCardRows } from '../football/reportTools';

export interface StatsViewport {
  count: number;
  rows: number;
  columns: number;
  capacity: number;
  offset: number;
  maxOffset: number;
  first: number;
  last: number;
  top: number;
  height: number;
}
/** A bounded drawing window, never a limit on selected metrics. Offset is measured in rows. */
export function statsWindow(count:number,scroll=0,columns=1,capacity=8,top=324,height=482):StatsViewport {
  const rows=Math.ceil(count/columns),maxOffset=Math.max(0,rows-capacity),bounded=Number.isFinite(scroll)?Math.max(0,Math.min(maxOffset,scroll)):0;
  const nearest=Math.round(bounded),offset=Math.abs(nearest-bounded)<.04?nearest:bounded;
  return {count,rows,columns,capacity,offset,maxOffset,first:count?Math.floor(offset)*columns+1:0,last:Math.min(count,Math.ceil(offset+capacity)*columns),top,height};
}
export function reportRows(board:Board,report?:MatchStats,playerId=board.studio?.statsPlayerId){
  const rows=report?statCardRows(report,playerId,board.match,board.studio?.statsComparePlayerId):[];
  const fields=board.studio?.statsFields;
  const lookup=new Map(rows.map(row=>[row.key,row]));
  return fields?fields.flatMap(key=>{const row=lookup.get(key);return row?[row]:[];}):rows;
}
export function statsViewport(board:Board,provided?:MatchStats,playerId=board.studio?.statsPlayerId):StatsViewport {
  const d=board.studio;
  if(d?.comparison)return statsWindow(d.comparison.fields.length,d.statsScroll);
  const report=provided||d?.statsSnapshot||(d?.statsReportId?d.dataReports?.[d.statsReportId]:undefined),count=reportRows(board,report,playerId).length;
  const single=!!playerId&&!d?.statsComparePlayerId,tiles=single||d?.statsLayout==='tiles';
  return statsWindow(count,d?.statsScroll,tiles?2:1,tiles?4:8,242,555);
}
