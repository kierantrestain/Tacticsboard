import { comparisonColors, type ComparisonSnapshot } from '../football/comparisonModel';
export function comparisonCanvas(snapshot:ComparisonSnapshot) {
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const c=canvas.getContext('2d')!;
  const text=(s:string,x:number,y:number,w:number,size=24,color='#f1f5f5',weight=600,align:CanvasTextAlign='left')=>{c.font=`${weight} ${size}px "Inter Variable",Arial`;c.fillStyle=color;c.textAlign=align;let v=s;while(v.length>1&&c.measureText(v).width>w)v=v.slice(0,-1);c.fillText(v===s?v:v.slice(0,-1)+'…',x,y);};
  const box=(x:number,y:number,w:number,h:number,color:string,r=10)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  const bg=c.createLinearGradient(0,0,1600,900);bg.addColorStop(0,'#17262e');bg.addColorStop(1,'#080f18');c.fillStyle=bg;c.fillRect(0,0,1600,900);
  box(70,61,6,50,'#dfff81',3);text(`TOUCHLINE / ${snapshot.kind==='players'?'PLAYER':'TEAM'} INTELLIGENCE`,96,81,1370,18,'#dfff81');
  text(snapshot.title,76,147,1450,45);text(snapshot.scope,76,189,1450,22,'#9fafb8');
  const count=snapshot.entities.length,left=450,width=1076/count;
  text(snapshot.basis==='per90'?'PER 90 MINUTES':snapshot.basis==='permatch'?'PER MATCH':'TOTALS & SUPPLIED RATES',80,258,350,15,'#a7b3ba');
  snapshot.entities.forEach((e,i)=>{const x=left+i*width;box(x+8,226,width-16,82,'#ffffff06');box(x+8,226,width-16,4,comparisonColors[i],2);text(e.name,x+width/2,267,width-32,count===5?21:25,'#f1f5f5',700,'center');text(e.subtitle||'',x+width/2,293,width-32,15,'#a7b3ba',500,'center');});
  const rowH=482/Math.max(1,snapshot.fields.length);
  snapshot.fields.slice(0,8).forEach((key,i)=>{const y=324+i*rowH,label=snapshot.entities.find(e=>e.stats[key])?.stats[key]?.label||key;box(76,y,1450,rowH-5,i%2?'#ffffff03':'#ffffff07',7);text(label,94,y+rowH*.55,333,Math.min(23,rowH*.32),'#bac5ca',500);
    snapshot.entities.forEach((e,j)=>{const s=e.stats[key],x=left+j*width; text(String(s?.display??s?.value??'—'),x+width/2,y+rowH*.57,width-26,Math.min(34,rowH*.47),comparisonColors[j],750,'center');
      if(e.samples?.[key]!==undefined)text(`n=${e.samples[key]}`,x+width/2,y+rowH-8,width-25,12,'#8b9ca5',500,'center');});
  });
  c.fillStyle='#ffffff19';c.fillRect(76,827,1450,1);text(`${snapshot.source} · — not supplied`,76,860,1450,17,'#96a9b1',500);
  return canvas;
}
