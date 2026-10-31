import type { Stat } from '../types';
import { canPer90, metricText, numericMetric, displayMetric } from './metrics';
export interface ComparisonEntity {
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
  stats: Record<string, Stat>;
  samples?: Record<string, number>;
}
export interface ComparisonSnapshot {
  kind: 'players' | 'teams';
  title: string;
  scope: string;
  source: string;
  updatedAt?: string;
  basis: 'totals' | 'per90' | 'permatch';
  entities: ComparisonEntity[];
  fields: string[];
}
export const comparisonColors=['#dfff81','#72dce5','#d4b1ff','#ffbf83','#f18db6'];
export function allComparisonMetrics(entities: ComparisonEntity[]) {
  const map=new Map<string,string>();
  entities.forEach(e=>Object.entries(e.stats).forEach(([key,s])=>map.set(key,s.label||key)));
  return [...map].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label));
}
export function defaultComparisonFields(entities: ComparisonEntity[]) {
  const keys=allComparisonMetrics(entities).map(m=>m.key);
  const preferred=['goals_scored','totalGoals','assists','goalAssists','expected_goals','expected_assists','minutes','minutesPlayed','points','pointsFor','pointsAgainst','tablePPG','resultsPPG','resultsCleanSheets','avg:possessionPct','avg:totalShots','avg:passPct'];
  return [...new Set([...preferred.filter(k=>keys.includes(k)),...keys])].slice(0,6);
}
export function comparisonValue(entity:ComparisonEntity,key:string,basis:ComparisonSnapshot['basis']) {
  if(basis==='per90')return metricText(entity.stats,key,true);
  const stat=entity.stats[key];
  if(basis==='permatch'&&teamCountMetric(key,stat?.label)){
    const n=numericMetric(stat),played=numericMetric(entity.stats[key.startsWith('home')?'homePlayed':key.startsWith('away')?'awayPlayed':key.startsWith('results')?'resultsPlayed':'gamesPlayed']);
    return n!==null&&played!==null&&played>0?(n/played).toFixed(2):'—';
  }
  return displayMetric(stat);
}
export function teamCountMetric(key:string,label='') {
  return !key.startsWith('avg:')&&!/rank|ppg|rate|pct|percent|%|played|point.?difference|pointdifferential|overall|advanced|deduction/i.test(key+' '+label)&&/goal|points|win|loss|ties|draw|clean.?sheet|scored|conced/i.test(key+' '+label);
}
export function comparisonLabel(key:string,label:string,basis:ComparisonSnapshot['basis']){
  return label+(basis==='per90'&&canPer90(key,label)?' /90':basis==='permatch'&&teamCountMetric(key,label)?' /match':'');
}
export function freezeComparison(snapshot:ComparisonSnapshot):ComparisonSnapshot {
  return {...snapshot,entities:snapshot.entities.map(e=>({...e,stats:Object.fromEntries(Object.entries(e.stats).map(([key,s])=>{
    const display=comparisonValue(e,key,snapshot.basis);
    return [key,{label:comparisonLabel(key,s.label,snapshot.basis),display,value:display==='—'?null:numericMetric({label:s.label,display})}];
  }))}))};
}
export function comparisonCSV(snapshot:ComparisonSnapshot) {
  const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const metrics=allComparisonMetrics(snapshot.entities);
  return [['Scope',snapshot.scope],['Source',snapshot.source],['Basis',snapshot.basis],['Metric',...snapshot.entities.map(e=>e.name)],...metrics.map(m=>[comparisonLabel(m.key,m.label,snapshot.basis),...snapshot.entities.map(e=>comparisonValue(e,m.key,snapshot.basis))])].map(r=>r.map(cell).join(',')).join('\r\n');
}
export function validComparison(v:unknown):v is ComparisonSnapshot {
  if(!v||typeof v!=='object')return false;
  const s=v as ComparisonSnapshot;
  return ['players','teams'].includes(s.kind)&&['totals','per90','permatch'].includes(s.basis)&&[s.title,s.scope,s.source].every(t=>typeof t==='string'&&t.length<1000)&&
    (s.updatedAt===undefined||typeof s.updatedAt==='string')&&Array.isArray(s.entities)&&s.entities.length>=2&&s.entities.length<=5&&new Set(s.entities.map(e=>e?.id)).size===s.entities.length&&s.entities.every(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=200&&(e.subtitle===undefined||typeof e.subtitle==='string')&&(e.color===undefined||/^#[0-9a-f]{6}$/i.test(e.color))&&e.stats&&typeof e.stats==='object'&&!Array.isArray(e.stats)&&Object.keys(e.stats).length<=300&&Object.values(e.stats).every(s=>s&&typeof s.label==='string'&&(s.value===undefined||s.value===null||Number.isFinite(s.value))&&(s.display===undefined||typeof s.display==='string'))&&(e.samples===undefined||!!e.samples&&typeof e.samples==='object'&&Object.values(e.samples).every(n=>Number.isInteger(n)&&n>=0)))&&Array.isArray(s.fields)&&s.fields.length<=8&&s.fields.every(k=>typeof k==='string'&&s.entities.some(e=>k in e.stats));
}
