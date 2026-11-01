import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Download, Search, X } from 'lucide-react';
import { download, filename } from '../core';
import { metricGroup, metricGroups } from './metrics';
import { allComparisonMetrics, comparisonColors, comparisonCSV, comparisonLabel, comparisonValue, defaultComparisonFields, type ComparisonEntity, type ComparisonSnapshot } from './comparisonModel';
import { presentComparison } from '../studio/presentComparison';

export default function ComparisonPanel({entities,kind,scope,source,updatedAt,onRemove,onClear}:{entities:ComparisonEntity[];kind:ComparisonSnapshot['kind'];scope:string;source:string;updatedAt?:string;onRemove:(id:string)=>void;onClear:()=>void}) {
  const heading=useRef<HTMLElement>(null),[inView,setInView]=useState(true);
  useEffect(()=>{const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:0});if(heading.current)observer.observe(heading.current);return()=>observer.disconnect();},[]);
  const [group,setGroup]=useState('All'),[search,setSearch]=useState(''),[basis,setBasis]=useState<ComparisonSnapshot['basis']>('totals'),[picked,setPicked]=useState<string[]|null>(null),[error,setError]=useState('');
  const metrics=useMemo(()=>allComparisonMetrics(entities),[entities]);
  const fields=(picked||defaultComparisonFields(entities)).filter(k=>metrics.some(m=>m.key===k));
  const shown=metrics.filter(m=>(group==='All'||metricGroup(m.key,m.label)===group)&&(m.label+' '+m.key).toLowerCase().includes(search.toLowerCase()));
  const snapshot:ComparisonSnapshot={kind,title:kind==='players'?'Player comparison':'Team comparison',scope,source,updatedAt,basis,entities,fields};
  const label=(key:string,text:string)=>comparisonLabel(key,text,basis);
  const value=(e:ComparisonEntity,key:string)=>comparisonValue(e,key,basis);
  return <section className="data-comparison" aria-label={`${kind==='players'?'Player':'Team'} comparison workspace`}>
    <header ref={heading}><div><span className="data-eyebrow">COMPARISON / {entities.length} OF 5</span><h3>{kind==='players'?'Compare players':'Compare teams'}</h3><p>{scope}</p></div><button onClick={onClear}>Clear</button></header>
    {!inView&&<button className="comparison-jump" onClick={()=>heading.current?.scrollIntoView({behavior:'smooth',block:'start'})}>Review {entities.length} {kind} ↑</button>}
    <div className="comparison-roster">{entities.map((e,i)=><div key={e.id} style={{'--entity-color':comparisonColors[i]} as React.CSSProperties}><i/><div><strong>{e.name}</strong><small>{e.subtitle||''}</small></div><button aria-label={`Remove ${e.name} from comparison`} onClick={()=>onRemove(e.id)}><X size={14}/></button></div>)}</div>
    {entities.length<2?<p className="comparison-prompt">Select up to four more {kind}. Compare any two to five.</p>:<>
      <div className="comparison-toolbar"><div className="mi-segmented"><button aria-pressed={basis==='totals'} onClick={()=>setBasis('totals')}>Totals</button><button aria-pressed={basis!=='totals'} onClick={()=>setBasis(kind==='players'?'per90':'permatch')}>{kind==='players'?'Per 90':'Per match'}</button></div><button onClick={()=>download(new Blob(['\ufeff'+comparisonCSV(snapshot)],{type:'text/csv;charset=utf-8'}),filename(`${snapshot.title}-${scope}`)+'.csv')}><Download size={14}/>Export all stats</button><button className="mi-primary" disabled={!fields.length} onClick={()=>{try{presentComparison(snapshot);}catch(e){setError((e as Error).message);}}}>Build graphic<ArrowUpRight size={15}/></button></div>
      <div className="comparison-highlights">{fields.slice(0,4).map(key=>{
        const metric=metrics.find(m=>m.key===key)!,values=entities.map(e=>Number(value(e,key).replace(/[% ,]/g,''))),max=Math.max(0,...values.filter(Number.isFinite));
        return <article key={key}><h4>{label(key,metric.label)}</h4>{entities.map((e,i)=><div key={e.id}><div><span>{e.name}</span><b>{value(e,key)}</b></div><div className="comparison-bar"><i style={{width:Number.isFinite(values[i])&&max>0?`${Math.max(0,values[i])/max*100}%`:'0%',background:comparisonColors[i]}}/></div></div>)}</article>;
      })}</div>
      <div className="comparison-filter"><label className="mi-search"><Search size={15}/><input aria-label="Search comparison statistics" placeholder="Search every statistic…" value={search} onChange={e=>setSearch(e.target.value)}/></label><span>{shown.length} of {metrics.length} metrics</span><button className="comparison-select-all" onClick={()=>setPicked(metrics.map(m=>m.key))}>Select all for graphic</button><button className="comparison-select-all" onClick={()=>setPicked([])}>Clear metrics</button></div>
      <div className="mi-chips">{metricGroups.filter(g=>g==='All'||metrics.some(m=>metricGroup(m.key,m.label)===g)).map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
      <div className="comparison-matrix-scroll"><table className="comparison-matrix"><thead><tr><th>Statistic <small>✓ graphic · {fields.length} selected</small></th>{entities.map((e,i)=><th key={e.id} style={{borderTopColor:comparisonColors[i]}}>{e.name}<small>{e.subtitle}</small></th>)}</tr></thead><tbody>{shown.map(m=><tr key={m.key}><th><label><input aria-label={`Graphic metric ${m.label}`} type="checkbox" checked={fields.includes(m.key)} onChange={()=>setPicked(fields.includes(m.key)?fields.filter(k=>k!==m.key):[...fields,m.key])}/>{label(m.key,m.label)}</label></th>{entities.map(e=><td key={e.id}>{value(e,m.key)}{e.samples?.[m.key]!==undefined&&<small>n={e.samples[m.key]}</small>}</td>)}</tr>)}</tbody></table></div>
      {!shown.length&&<p className="mi-empty">No matching statistics.</p>}
      <p className="data-source">{source}{updatedAt?` · checked ${new Date(updatedAt).toLocaleDateString('en-GB')}`:''}. Missing values: —. {basis==='per90'?'Counts use supplied minutes; rates retain their units.':basis==='permatch'?'Counts use played matches; report averages retain their units.':''} Charts show magnitude, not a performance score.</p>
      {error&&<p role="alert">{error}</p>}
    </>}
  </section>;
}
