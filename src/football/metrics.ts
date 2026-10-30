import type { Stat } from '../types';
export const metricGroups = ['All', 'Attack', 'Passing', 'Defending', 'Goalkeeping', 'Discipline', 'Playing time'] as const;
export type MetricGroup = typeof metricGroups[number];
export function metricGroup(key: string, label = ''): MetricGroup {
  const v=(key+' '+label).toLowerCase();
  if(/conced|against|save|faced|clean.?sheet|goalkeep/.test(v))return 'Goalkeeping';
  if(/yellow|red.?card|foul|offside|discipline/.test(v))return 'Discipline';
  if(/minute|start|appearance|substitut|subins/.test(v))return 'Playing time';
  if(/tackle|intercept|clearance|block|recover|defens/.test(v))return 'Defending';
  if(/pass|cross|long.?ball|possession/.test(v))return 'Passing';
  return 'Attack';
}
export function numericMetric(stat?: Stat | { display: string; label: string }): number | null {
  if (!stat) return null;
  const raw='value' in stat && stat.value != null ? stat.value : stat.display;
  if(raw===undefined||raw===null||raw==='')return null;
  const n=Number(String(raw).replace(/[% ,]/g,''));return Number.isFinite(n)?n:null;
}
export function canPer90(key:string,label=''){return !/per.?90|pct|percent|%|minutes?|appearance|starts|form|price|points|index|rank|rating|chance/i.test(key+' '+label);}
export function metricNumber(stats:Record<string,Stat>,key:string,per90=false):number|null{
  const n=numericMetric(stats[key]);if(n===null)return null;
  if(!per90||!canPer90(key,stats[key]?.label))return n;
  const minutes=numericMetric(stats.minutes||stats.minutesPlayed);return minutes!==null&&minutes>0?n*90/minutes:null;
}
export function metricText(stats:Record<string,Stat>,key:string,per90=false){const n=metricNumber(stats,key,per90);if(per90&&canPer90(key,stats[key]?.label))return n===null?'—':n.toFixed(2);return String(stats[key]?.display??stats[key]?.value??'—');}
