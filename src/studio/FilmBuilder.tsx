import { useEffect, useRef, useState } from 'react';
import { Copy, ChevronLeft, Highlighter, MoreHorizontal, Redo2, Ruler, ScanLine, Triangle, Type, ArrowRight, ArrowUpRight, BookmarkPlus, Camera, Check, ChevronRight, Circle, Clapperboard, Download, Eraser, Film, Hand, Link2, Pause, Pencil, Play, Plus, RotateCcw, Scissors, Sparkles, Square, Target, Trash2, Undo2, Upload, Users, X } from 'lucide-react';
import { useStudio } from '../store';
import type { Tool } from '../types';
import { activeSceneTime, copy, frameAt, totalDuration, uid } from '../core';
import { editDesk, selectAsset, useRuntime } from './runtime';
import { executeHostCommand } from './host/actions';
import type { HostCommand } from './host/protocol';
import { aroundMoment, clipPlan } from './filmPlan';
import type { MediaAsset, SourceHandle } from './types';
import { emptyStudio } from './types';
import { pixels, vision } from './visionClient';
import { saveCue, updateCue, recallCue } from './showControl';
import MiniPitch from './MiniPitch';
import BallActionPanel from './BallActionPanel';
import { RecreationEvidence } from '../football/ReportReplays';
import TeamMovementPanel from './TeamMovementPanel';
import PlaybookPanel from './PlaybookPanel';
import SpatialInsights from './SpatialInsights';
import PlayerControl from './PlayerControl';
import { sceneBlocks } from './sequenceEditing';

export function quickAction(command: HostCommand) { try { executeHostCommand(command); } catch (e) { useStudio.getState().notify((e as Error).message); } }
export function QuickTools() {
  const s=useStudio(),r=useRuntime(),[more,setMore]=useState(false);
  useEffect(()=>setMore(false),[r.tabletPanel,r.modal,r.view,s.board?.id]);
  const choose=(tool:Tool)=>{
    if(s.board&&s.previewTime!==null){const frame=frameAt(s.board,s.previewTime);s.commit(b=>Object.assign(b,frame));}
    s.set({tool,playing:false,selectedShape:null});r.set({mediaPlaying:false,panMode:false,markMode:'none',ballTargetPicking:false});setMore(false);
  };
  return <div className="film-tools" aria-label="Drawing tools">{([['select','Move',Hand],['ellipse','Circle',Circle],['arrow','Arrow',ArrowUpRight],['run','Run',ArrowRight],['pen','Draw',Pencil],['zone','Space',Square],['erase','Erase',Eraser]] as const).map(([tool,label,Icon])=><button key={tool} title={label} aria-pressed={s.tool===tool} onClick={()=>choose(tool)}><Icon size={19}/><span>{label}</span></button>)}
    <div className="film-more"><button aria-label="More drawing tools" aria-expanded={more} onClick={()=>setMore(!more)}><MoreHorizontal size={19}/><span>More</span></button>{more&&<div className="film-tool-popover">{([['line','Line',Link2],['triangle','Triangle',Triangle],['spotlight','Spotlight',Highlighter],['text','Text',Type],['measure','Distance',Ruler],['offside','Reference line',ScanLine]] as const).map(([tool,label,Icon])=><button key={tool} aria-pressed={s.tool===tool} onClick={()=>choose(tool)}><Icon size={17}/>{label}</button>)}<button disabled={!s.future.length} onClick={()=>quickAction({type:'redo'})}><Redo2 size={17}/>Redo</button><label>Ink<input type="color" aria-label="Drawing colour" value={s.color} onChange={e=>s.set({color:e.target.value})}/></label><label>Width<input type="range" aria-label="Drawing width" min="1" max="8" value={s.stroke} onChange={e=>s.set({stroke:+e.target.value})}/></label></div>}</div>
    {r.view==='board'&&(['pass','shot'] as const).map(kind=><button key={kind} onClick={()=>{s.set({tool:'select',playing:false});r.set({sidebar:'tactics',ballActionKind:kind,ballTarget:null,ballTargetPicking:false});}}>{kind==='pass'?<ArrowUpRight size={19}/>:<Target size={19}/>}<span>{kind==='pass'?'Pass':'Shoot'}</span></button>)}<i/><button disabled={!s.past.length} onClick={()=>quickAction({type:'undo'})}><Undo2 size={19}/><span>Undo</span></button><button aria-label="Clear drawings" title="Clear drawings" onClick={()=>quickAction({type:'clear'})}><Trash2 size={18}/></button>
  </div>;
}
export function FilmTimeline({ asset }: { asset?: MediaAsset }) {
  const s=useStudio(), r=useRuntime(), b=s.board!, source=r.view==='footage', d=b.studio||emptyStudio();
  const time=source?r.time:s.previewTime??activeSceneTime(b), duration=source?asset?.duration||1:totalDuration(b), playing=source?r.mediaPlaying:s.playing;
  const blocks=sceneBlocks(b.scenes),groups=new Map(blocks.flatMap((block,index)=>block.map(scene=>[scene.id,{index,size:block.length}] as const)));
  return <section className="film-timeline" aria-label="Build and preview the sequence">
    <div className="film-timeline-top">
      <div><span className="film-kicker">{source?'YOUR CLIP':'YOUR SEQUENCE'}</span><strong>{source?asset?.name||'Import a video to start':`${b.scenes.length} ${b.scenes.length===1?'step':'steps'} · ${duration.toFixed(1)} seconds`}</strong></div>
      <div className="film-playback">
        <button aria-label="Preview sequence from start" onClick={()=>quickAction({type:'restart'})} disabled={!!r.movementDraft}><RotateCcw size={18}/></button>
        <button className="film-play" onClick={()=>quickAction({type:'play'})} disabled={!!r.movementDraft}>{playing?<Pause size={18}/>:<Play size={18}/>}<span>{playing?'Pause':'Play'}</span></button>
        <select aria-label="Analysis playback speed" value={source?r.rate:s.speed} disabled={!!r.movementDraft} onChange={e=>quickAction({type:'rate',value:+e.target.value})}>{[.25,.5,1,2].map(rate=><option key={rate} value={rate}>{rate===1?'1×':`${rate}×`}</option>)}</select>
        <time>{time.toFixed(1)}<small> / {duration.toFixed(1)}s</small></time>
      </div>
      {r.movementDraft?<div className="film-move-finish"><button className="film-button primary" onClick={()=>quickAction({type:'finish-move'})}><Check size={17}/>Done · save move</button><button className="film-cancel-move" aria-label="Cancel current movement" onClick={()=>quickAction({type:'cancel-move'})}><X size={17}/></button></div>:!source?<button className="film-button" onClick={()=>quickAction({type:'start-move'})}><Plus size={18}/>Add move</button>:null}
    </div>
    <input className={`film-scrubber ${source?'':'film-board-scrubber'}`} type="range" min={source?d.trim.start:0} max={source?d.trim.end:duration} step={.04} value={Math.min(time,source?d.trim.end:duration)} aria-label={source?'Find the analysis moment':'Tactical replay position'} disabled={!!r.movementDraft} onChange={e=>quickAction({type:'seek',time:+e.target.value})}/>
    {source?<div className="film-clip-range"><span><Scissors size={15}/>Selected {d.trim.start.toFixed(1)} – {d.trim.end.toFixed(1)}s</span><strong>{(d.trim.end-d.trim.start).toFixed(1)}s clip</strong></div>:<div className="film-step-strip">{b.scenes.map((scene,i)=><div key={scene.id} className={`film-step-card ${b.activeScene===scene.id?'selected':''}`}>
      <button disabled={!!r.movementDraft} onClick={()=>s.selectScene(scene.id)} aria-label={`Open sequence step ${i+1}`}><MiniPitch frame={scene} colors={b.colors}/><span>{String(i+1).padStart(2,'0')}</span></button>
      <input aria-label={`Step ${i+1} name`} value={scene.title} onChange={e=>s.commit(board=>{board.scenes.find(x=>x.id===scene.id)!.title=e.target.value.slice(0,60);})}/>
      <div><label><input aria-label={`Step ${i+1} seconds`} type="number" min={.5} max={10} step={.5} value={scene.duration} onChange={e=>s.commit(board=>{board.scenes.find(x=>x.id===scene.id)!.duration=Math.max(.5,Math.min(10,+e.target.value));})}/>s</label>{(['earlier','later','duplicate'] as const).map(action=><button key={action} title={`${action==='duplicate'?'Duplicate':`Move ${action}`} ${groups.get(scene.id)!.size>1?'action chain':'step'}`} aria-label={`${action==='duplicate'?'Duplicate':`Move ${action}`} sequence step ${i+1}`} disabled={!!r.movementDraft||action==='earlier'&&groups.get(scene.id)!.index===0||action==='later'&&groups.get(scene.id)!.index===blocks.length-1} onClick={()=>quickAction({type:'sequence-edit',id:scene.id,action})}>{action==='duplicate'?<Copy size={12}/>:action==='earlier'?<ChevronLeft size={12}/>:<ChevronRight size={12}/>}</button>)}<button aria-label={`Remove sequence step ${i+1}`} disabled={b.scenes.length<2||!!r.movementDraft} onClick={()=>s.deleteScene(scene.id)}><X size={13}/></button></div>
    </div>)}</div>}
  </section>;
}
export default function FilmBuilder({ onImport, onFreeze, onFilm, source }: { onImport:()=>void; onFreeze:()=>void; onFilm:()=>void; source:React.RefObject<SourceHandle|null> }) {
  const s=useStudio(),r=useRuntime(),b=s.board!,d=b.studio||emptyStudio(),asset=r.assets.find(a=>a.id===d.assetId),isSource=r.view==='footage',isStats=r.view==='stats';
  const [tab,setTab]=useState<'plays'|'move'|'ball'|'inspect'|'display'>('plays');
  useEffect(()=>{setTab('plays');},[b.id]);
  useEffect(()=>{if(r.ballActionKind)setTab('ball');},[r.ballActionKind]);
  useEffect(()=>{if(r.view!=='board')r.set({ballActionKind:null,ballTargetPicking:false,ballTarget:null});},[r.view]);
  const stops=d.explainStops?.[asset?.id||'']||[];
  const addStop=()=>{
    if(!asset||asset.type!=='video')return;
    r.set({mediaPlaying:false});
    editDesk(d=>{const list=(d.explainStops||={})[asset.id]||=[];if(list.length>=20)return;const time=Math.max(d.trim.start,Math.min(r.time,d.trim.end-.04));if(list.some(p=>Math.abs(p.time-time)<.1))return;list.push({id:uid(),time,hold:3});});
    s.set({tool:'ellipse',color:'#dfff81',stroke:4});
  };
  const autoCircle=async()=>{
    if(!asset||!source.current)return;const boardId=b.id,assetId=asset.id,time=r.time;
    r.set({mediaPlaying:false,busy:'Finding people',error:''});
    try {
      await source.current.seek(time);const canvas=source.current.capture();if(!canvas)throw Error('Pause on a clear frame first.');
      const found=await vision('detect',{frame:pixels(canvas)}) as {x:number;y:number;w:number;h:number;confidence:number}[];
      if(useStudio.getState().board?.id!==boardId||useStudio.getState().board?.studio?.assetId!==assetId)return;
      const visible=found.filter(p=>p.confidence>=.45).slice(0,30);
      editDesk(d=>{const ink=d.ink[assetId]||=[];for(const p of visible.slice(0,Math.max(0,500-ink.length)))ink.push({id:uid(),type:'ellipse',points:[Math.max(0,p.x-p.w*.7),Math.max(0,p.y-p.h*.15),Math.min(1,p.x+p.w*.7),Math.min(1,p.y+p.h*.08)],color:'#dfff81',width:4,opacity:1,from:time,to:d.trim.end,space:'screen',assetId});});
      s.notify(visible.length?`${visible.length} marked · check unwanted circles`:'No clear detections. Use Circle player.');
    }catch(e){r.set({error:(e as Error).message});}finally{r.set({busy:''});}
  };
  const save=()=>{if(r.movementDraft)return;if(r.activeCueId)updateCue();else saveCue();r.set({sidebar:'rundown'});};
  const newAnalysis=()=>{
    if(r.movementDraft)return;
    r.set({activeCueId:null,mediaPlaying:false,view:'board'});
    s.commit(board=>{const origin=board.scenes[0];board.players=copy(origin.players);board.ball=copy(origin.ball);board.settings.view='full';const first={id:uid(),title:'Starting shape',duration:3,note:'',players:copy(board.players),drawings:[],ball:copy(board.ball)};board.recreation=undefined;board.scenes=[first];board.activeScene=first.id;board.drawings=[];if(board.studio){board.studio.view='board';board.studio.lowerThird='';if(board.studio.broadcast)board.studio.broadcast.headline='';}});
    s.set({playing:false,previewTime:null});setTab('plays');
  };
  const selectPlayers=(selected:string[])=>{s.set({tool:'select',selected,selectedShape:null,playing:false});r.set({ballTargetPicking:false});};
  const toggle=(key:'names'|'numbers'|'homeVisible'|'awayVisible'|'ballVisible'|'teamShape'|'teamLines'|'thirds'|'lanes')=>s.commit(board=>{board.settings[key]=!(board.settings[key]??false);});
  return <aside className="film-builder unified-editor" aria-label="Analysis editor">
    <RecreationEvidence/>
    {!isSource&&!isStats&&<div className="film-edit-tabs" role="tablist" aria-label="Analysis tools">{([['plays','Plays'],['move','Move'],['ball','Ball'],['inspect','Inspect'],['display','Display']] as const).map(([value,label])=><button key={value} role="tab" aria-selected={tab===value} aria-pressed={tab===value} onClick={()=>{setTab(value);r.set({ballActionKind:value==='ball'?'pass':null,ballTargetPicking:false,multiSelect:false});}}>{label}</button>)}</div>}
    <div className="film-builder-content">
      {isStats?<label className="film-field">Headline<input aria-label="Graphic headline" maxLength={120} value={d.comparison?.title||d.broadcast?.headline||d.lowerThird} onChange={e=>editDesk(d=>{d.lowerThird=e.target.value;if(d.broadcast)d.broadcast.headline=e.target.value;if(d.comparison)d.comparison.title=e.target.value;})}/></label>:isSource?<>
        {asset?<>
          {asset.type==='video'&&<><div className="film-segment">{[6,10,15].map(n=><button key={n} onClick={()=>editDesk(d=>{d.trim=aroundMoment(r.time,asset.duration,n);})}>{n}s clip</button>)}</div><div className="film-two-buttons"><button className="film-button" onClick={()=>quickAction({type:'clip-in'})}>Set start</button><button className="film-button" onClick={()=>quickAction({type:'clip-out'})}>Set end</button></div><button className="film-button" onClick={addStop}><Pause size={18}/>Add explanation pause</button></>}
          <button className="film-button" disabled={!!r.busy} onClick={()=>void autoCircle()}><Sparkles size={18}/>Circle visible players</button><button className="film-button" onClick={onFreeze}><Camera size={17}/>Save still</button>
          {stops.map((stop,i)=><div className="film-explain-stop" key={stop.id}><Pause size={14}/><span>{stop.time.toFixed(1)}s</span><select aria-label={`Explanation pause ${i+1} length`} value={stop.hold} onChange={e=>editDesk(d=>{d.explainStops![asset.id].find(s=>s.id===stop.id)!.hold=+e.target.value;})}>{[1,2,3,5,8].map(n=><option key={n} value={n}>{n}s pause</option>)}</select><button aria-label={`Remove explanation pause ${i+1}`} onClick={()=>editDesk(d=>{d.explainStops![asset.id]=d.explainStops![asset.id].filter(s=>s.id!==stop.id);})}><X size={14}/></button></div>)}
        </>:<button className="film-button primary" onClick={onImport}><Upload size={18}/>Import video or image</button>}
      </>:<>
        {tab==='plays'&&<PlaybookPanel key={b.id} board={b} send={quickAction} disabled={!!r.busy||s.playing} recording={!!r.movementDraft}/>}
        {tab==='move'&&<TeamMovementPanel key={b.id} board={b} selected={s.selected} onSelect={selectPlayers} multiSelect={r.multiSelect} onMultiSelect={multiSelect=>{r.set({multiSelect});s.set({tool:'select',playing:false});}} send={quickAction} disabled={!!r.busy} recording={!!r.movementDraft}/>}
        {tab==='ball'&&<PlayerControl board={b} selected={s.selected} send={quickAction} disabled={!!r.busy||s.playing}/>}
        {tab==='ball'&&<BallActionPanel board={b} selected={s.selected} kind={r.ballActionKind} setKind={kind=>r.set({ballActionKind:kind,ballTarget:null})} target={r.ballTarget} picking={r.ballTargetPicking} onPick={()=>{s.set({tool:'select',playing:false,previewTime:null});r.set({ballTargetPicking:true,multiSelect:false});}} onCancelPick={()=>r.set({ballTargetPicking:false})} onAdd={action=>executeHostCommand({type:'ball-action',action})} disabled={!!r.movementDraft||!!r.busy}/>}
        {tab==='inspect'&&<SpatialInsights/>}
        {tab==='display'&&<>
          {!!s.selected.length&&<div className="film-two-buttons"><button className="film-button" onClick={()=>quickAction({type:'highlight',ids:s.selected})}><Circle size={17}/>Highlight</button><button className="film-button" disabled={s.selected.length<2} onClick={()=>quickAction({type:'link',ids:s.selected})}><Link2 size={17}/>Connect</button></div>}
          <div className="film-segment">{(['full','left','right'] as const).map(view=><button key={view} aria-pressed={b.settings.view===view} onClick={()=>quickAction({type:'pitch',view})}>{view==='full'?'Full pitch':view==='left'?'Left half':'Right half'}</button>)}</div>
          <div className="film-two-buttons">{(['disc','shirt'] as const).map(tokenStyle=><button className="film-button" key={tokenStyle} aria-pressed={b.settings.tokenStyle===tokenStyle} onClick={()=>s.commit(board=>{board.settings.tokenStyle=tokenStyle;})}>{tokenStyle==='disc'?'Discs':'Shirts'}</button>)}</div>
          <label className="film-field">Player size<input aria-label="Player marker size" type="range" min=".7" max="1.6" step=".1" value={b.settings.markerScale||1} onChange={e=>s.commit(board=>{board.settings.markerScale=+e.target.value;})}/></label>
          {(['names','numbers','homeVisible','awayVisible','ballVisible','teamShape','teamLines','thirds','lanes'] as const).map(key=><button className="film-display-toggle" key={key} aria-pressed={b.settings[key]??key==='ballVisible'} onClick={()=>toggle(key)}>{({names:'Names',numbers:'Numbers',homeVisible:b.context?.home.shortName||'Home',awayVisible:b.context?.away.shortName||'Away',ballVisible:'Ball',teamShape:'Team shape',teamLines:'Unit lines',thirds:'Pitch thirds',lanes:'Five channels'})[key]}<span>{(b.settings[key]??key==='ballVisible')?'On':'Off'}</span></button>)}
          <button className="film-button" disabled={!s.selected.length&&!b.settings.focusPlayer} onClick={()=>quickAction({type:'focus',id:b.settings.focusPlayer?null:s.selected[0]})}><Target size={17}/>{b.settings.focusPlayer?'Remove focus':'Focus selected player'}</button>
        </>}
      </>}
    </div>
    <div className="editor-save"><button className="film-button primary" disabled={!!r.movementDraft||!!r.busy} onClick={save}><BookmarkPlus size={17}/>{r.activeCueId?'Update moment':'Save moment'}</button><button className="film-button" title="New analysis" aria-label="New analysis" disabled={!!r.movementDraft} onClick={newAnalysis}><Plus size={18}/></button><button className="film-button" title="Export analysis video" aria-label="Export analysis video" disabled={!!r.movementDraft||!!r.busy} onClick={onFilm}><Download size={17}/></button></div>
  </aside>;
}
