import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { StatsViewport } from './statsViewport';

function StatisticsScroller({info,onScroll}:{info:StatsViewport;onScroll:(value:number)=>void}) {
  const ref=useRef<HTMLDivElement>(null),latest=useRef(info),userUntil=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  latest.current=info;
  const sync=useCallback(()=>{const el=ref.current;if(!el||Date.now()<userUntil.current)return;const current=latest.current,top=current.offset*el.clientHeight/current.capacity;if(Math.abs(top-el.scrollTop)>.8)el.scrollTop=top;},[]);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    sync();const observer=new ResizeObserver(sync);observer.observe(el);return()=>observer.disconnect();
  },[info.capacity,info.rows,sync]);
  useLayoutEffect(sync,[info.offset,sync]);
  useLayoutEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div ref={ref} className="statistics-scroller" role="region" tabIndex={0} aria-label="Scroll selected statistics" style={{top:`${info.top/9}%`,height:`${info.height/9}%`}} onScroll={e=>{const el=e.currentTarget;userUntil.current=Date.now()+180;clearTimeout(timer.current);timer.current=setTimeout(sync,200);if(el.clientHeight)onScroll(el.scrollTop*info.capacity/el.clientHeight);}}>
    <div aria-hidden="true" style={{height:`${info.rows/info.capacity*100}%`}}/>
  </div>;
}
export default function StatisticSurface({children,info,onScroll}:{children:ReactNode;info:StatsViewport;onScroll?:(value:number)=>void}){
  const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
  useLayoutEffect(()=>{const el=ref.current;if(!el)return;const resize=()=>{const width=Math.max(0,Math.min(el.clientWidth,el.clientHeight*16/9));setSize(old=>old.width===width?old:{width,height:width*9/16});};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[]);
  return <div ref={ref} className="statistics-surface"><div className="statistics-canvas-wrap" style={size.width?size:undefined}>{children}{info.maxOffset>0&&onScroll&&<StatisticsScroller info={info} onScroll={onScroll}/>}</div></div>;
}
export function StatisticsNavigation({info,onScroll,disabled=false}:{info:StatsViewport;onScroll:(value:number)=>void;disabled?:boolean}){
  if(!info.maxOffset)return null;
  return <div className="statistics-navigation"><span>{info.first}–{info.last} of {info.count} stats · scroll to explore</span><button disabled={disabled||info.offset<=0} aria-label="Scroll statistics to top" onClick={()=>onScroll(0)}>Top</button><button disabled={disabled||info.offset<=0} aria-label="Previous statistics" onClick={()=>onScroll(info.offset-info.capacity)}>↑</button><button disabled={disabled||info.offset>=info.maxOffset} aria-label="Next statistics" onClick={()=>onScroll(info.offset+info.capacity)}>↓</button></div>;
}
