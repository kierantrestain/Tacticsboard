import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BarChart3, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
import { loadReport } from "../football/data";
import { statCardRows } from "../football/reportTools";
import { defaultBroadcast, emptyStudio } from "./types";
import type { Board, Match, MatchDetails } from "../types";
import type { MatchStats } from "./types";
export function statsCanvas(board: Board, report?: MatchStats, playerId?: string) {
  const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=900;const c=canvas.getContext("2d")!;
  const lime="#ccf56f",teal="#63d9db",white="#f5f8f7",muted="#9caeb4";
  const text=(value:string,x:number,y:number,width:number,size=24,color=white,align:CanvasTextAlign="left",weight=600)=>{c.font=`${weight} ${size}px "Inter Variable",Arial`;c.fillStyle=color;c.textAlign=align;let v=value;while(v.length>1&&c.measureText(v).width>width)v=v.slice(0,-1);c.fillText(v===value?v:v.slice(0,-1)+"…",x,y);};
  const box=(x:number,y:number,w:number,h:number,color:string,r=14)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  const bg=c.createLinearGradient(0,0,1600,900);bg.addColorStop(0,"#13272e");bg.addColorStop(1,"#080f19");c.fillStyle=bg;c.fillRect(0,0,1600,900);
  box(64,55,8,55,lime,4);text("TOUCHLINE / MATCH INTELLIGENCE",94,79,1300,18,lime);
  if(!report){text("Choose a match. Find the story.",80,420,1440,48);text("Open a match report to create your first graphic.",80,473,1440,24,muted);return canvas;}
  const players=report.lineups.flatMap(l=>l.players),player=players.find(p=>p.id===playerId),other=players.find(p=>p.id===board.studio?.statsComparePlayerId),single=!!player&&!other;
  const home=player?.name||board.context?.home.shortName||board.match?.homeName||"Home",away=other?.name||board.context?.away.shortName||board.match?.awayName||"Away";
  text(single?home:player?"Player comparison":"The match in numbers",80,145,1440,46);
  if(single)text(`${board.match?.homeName||"Home"} v ${board.match?.awayName||"Away"} · Match performance`,80,196,1440,23,muted);
  else {box(80,179,8,32,lime,3);text(home,105,204,570,27);box(1512,179,8,32,teal,3);text(away,1495,204,570,27,white,"right");if(!player&&board.match?.homeScore!=null&&board.match?.awayScore!=null)text(`${board.match.homeScore} : ${board.match.awayScore}`,800,205,250,32,white,"center");else text("VS",800,202,180,18,muted,"center");}
  const allRows=statCardRows(report,playerId,board.match,board.studio?.statsComparePlayerId),rows=(board.studio?.statsFields?board.studio.statsFields.flatMap(k=>allRows.filter(r=>r.key===k)):allRows).slice(0,8),tiles=single||board.studio?.statsLayout==='tiles';
  rows.forEach((row,i)=>{
    if(tiles){const h=Math.min(250,555/Math.ceil(rows.length/2)),x=80+(i%2)*734,y=245+Math.floor(i/2)*h;box(x,y,706,h-14,"#ffffff09");text(row.label,x+26,y+35,654,20,muted);if(single)text(row.home,x+26,y+h-40,650,Math.min(60,h*.38));else{text(row.home,x+26,y+h-38,300,Math.min(48,h*.32),lime);text(row.away,x+680,y+h-38,300,Math.min(48,h*.32),teal,"right");}}
    else {const h=Math.min(130,555/rows.length),y=242+i*h;box(80,y,1440,h-7,"#ffffff05",8);text(row.home,110,y+h*.48,220,Math.min(38,h*.47),white);text(row.label,800,y+h*.43,800,Math.min(23,h*.30),muted,"center");text(row.away,1490,y+h*.48,220,Math.min(38,h*.47),white,"right");const hn=Number(row.home.replace('%','')),an=Number(row.away.replace('%','')),valid=Number.isFinite(hn)&&Number.isFinite(an)&&hn>=0&&an>=0&&hn+an>0,ratio=valid?hn/(hn+an):.5;const bw=930,bx=335;box(bx,y+h-22,Math.max(0,bw*ratio-3),7,valid?lime:"#ffffff14",3);box(bx+bw*ratio+3,y+h-22,Math.max(0,bw*(1-ratio)-3),7,valid?teal:"#ffffff14",3);}
  });
  if(!rows.length){text("No statistics selected",80,420,1440,38);text("Choose metrics from the report to build this graphic.",80,470,1440,23,muted);}
  c.fillStyle="#ffffff18";c.fillRect(80,818,1440,1);text(`${board.match?.date?.slice(0,10)||"Match report"}  ·  ESPN match data  ·  — means not supplied`,80,857,1440,17,muted);
  return canvas;
}
export async function presentMatchData(match: Match, playerId?: string, options: { comparePlayerId?: string; fields?: string[] } = {}) {
  const s = useStudio.getState();
  if (s.board?.match?.id !== match.id) await s.loadMatch(match);
  const projectId = useStudio.getState().board?.id;
  const report = await loadReport(match);
  if (
    useStudio.getState().board?.id !== projectId ||
    useStudio.getState().board?.match?.id !== match.id
  )
    return;
  s.commit((b) => {
    b.studio ||= emptyStudio();
    (b.studio.dataReports ||= {})[match.id] = {
      id: report.id,
      lineups: report.lineups,
      teamStats: report.teamStats,
      updatedAt: report.updatedAt,
      sourceUrl: report.sourceUrl,
    };
    b.studio.statsReportId = match.id;
    b.studio.statsPlayerId = playerId;
    b.studio.statsComparePlayerId = options.comparePlayerId;
    b.studio.statsLayout = "comparison";
    b.studio.statsSnapshot = undefined;
    b.studio.statsFields = options.fields;
    const player = playerId
      ? report.lineups.flatMap((l) => l.players).find((p) => p.id === playerId)
      : undefined;
    b.studio.broadcast = {
      ...defaultBroadcast(),
      ...b.studio.broadcast,
      headline: player
        ? `${player.name} · match performance`
        : `${b.context?.home.shortName || match.homeName} v ${b.context?.away.shortName || match.awayName} · match numbers`,
    };
    b.studio.view = "stats";
  });
  s.set({ modal: null, playing: false, previewTime: null });
  useRuntime.setState({ view: "stats", mediaPlaying: false });
}
export interface StatsHandle {
  capture: () => HTMLCanvasElement;
}
const StatsStage = forwardRef<
  StatsHandle,
  { board?: Board; report?: MatchStats; program?: boolean }
>(({ board: external, report: provided, program = false }, ref) => {
  const s = useStudio(),
    b = external || s.board!,
    desk = b.studio || emptyStudio(),
    report =
      provided ||
      desk.statsSnapshot ||
      (desk.statsReportId ? desk.dataReports?.[desk.statsReportId] : undefined),
    playerId = desk.statsPlayerId,
    canvasRef = useRef<HTMLCanvasElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [metricSearch, setMetricSearch] = useState("");
  const capture = () => statsCanvas(b, report, playerId);
  useImperativeHandle(ref, () => ({ capture }), [b, report, playerId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raw = capture();
    canvas.width = raw.width;
    canvas.height = raw.height;
    canvas.getContext("2d")!.drawImage(raw, 0, 0);
  }, [b, report, playerId]);
  return (
    <div className="ts-stats-stage" data-testid="stats-stage">
      {!program && (
        <div className="ts-data-tools">
          <BarChart3 size={15} />
          {!report && (
            <button onClick={() => s.set({ modal: "matches" })}>
              Choose a match report
            </button>
          )}
          <select
            aria-label="TV data card selection"
            value={playerId || ""}
            onChange={(e) =>
              editDesk((d) => {
                d.statsPlayerId = e.target.value || undefined;
                d.statsComparePlayerId = undefined;
                d.statsFields = undefined;
              })
            }
          >
            <option value="">Whole match · both teams</option>
            {report?.lineups
              .flatMap((l) => l.players)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} · {p.name}
                </option>
              ))}
          </select>
          {playerId && <select aria-label="Compare with player" value={desk.statsComparePlayerId || ''} onChange={e=>editDesk(d=>{d.statsComparePlayerId=e.target.value||undefined;d.statsFields=undefined;})}><option value="">Individual player</option>{report?.lineups.flatMap(l=>l.players).filter(p=>p.id!==playerId).map(p=><option key={p.id} value={p.id}>vs {p.name}</option>)}</select>}
          <select aria-label="Data graphic layout" value={desk.statsLayout||'comparison'} onChange={e=>editDesk(d=>{d.statsLayout=e.target.value as 'comparison'|'tiles';})}><option value="comparison">Comparison bars</option><option value="tiles">Statistic tiles</option></select>
          {report && (
            <details className="director-metrics">
              <summary>
                <SlidersHorizontal size={14} /> Choose metrics
              </summary>
              <div>
                <strong>Card metrics · up to 8</strong>
                <p>Choose up to 8 from every supplied statistic.</p><input aria-label="Find graphic metric" placeholder="Find a metric…" value={metricSearch} onChange={e=>setMetricSearch(e.target.value)}/><button onClick={()=>editDesk(d=>{d.statsFields=[];})}>Clear selection</button>
                {statCardRows(report, playerId, b.match, desk.statsComparePlayerId).filter(row=>(row.label+row.key).toLowerCase().includes(metricSearch.toLowerCase())).map((row) => {
                  const chosen =
                      desk.statsFields ||
                      statCardRows(report, playerId, b.match, desk.statsComparePlayerId)
                        .slice(0, 8)
                        .map((r) => r.key),
                    checked = chosen.includes(row.key);
                  return (
                    <label key={row.key}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && chosen.length >= 8}
                        onChange={() =>
                          editDesk((d) => {
                            d.statsFields = checked
                              ? chosen.filter((k) => k !== row.key)
                              : [...chosen, row.key];
                          })
                        }
                      />
                      <span>{row.label}</span>
                    </label>
                  );
                })}
                <button
                  onClick={() =>
                    editDesk((d) => {
                      d.statsFields = undefined;
                    })
                  }
                >
                  Reset selection
                </button>
              </div>
            </details>
          )}
          {desk.statsSnapshot && (
            <span className="director-frozen-data">Saved report snapshot</span>
          )}
          <button
            disabled={!b.match || busy}
            onClick={async () => {
              if (!b.match) return;
              setBusy(true);
              setError("");
              try {
                const report = await loadReport(b.match, true);
                if(useStudio.getState().board?.id!==b.id || useStudio.getState().board?.match?.id!==b.match.id)return;
                editDesk((d) => {
                  d.statsSnapshot = undefined;
                  (d.dataReports ||= {})[b.match!.id] = {
                    id: report.id,
                    lineups: report.lineups,
                    teamStats: report.teamStats,
                    updatedAt: report.updatedAt,
                    sourceUrl: report.sourceUrl,
                  };
                });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "The report could not refresh.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={13} className={busy ? "spin" : ""} />
            Refresh
          </button>
        </div>
      )}
      {error && !program && <p role="alert">{error}</p>}
      <canvas
        ref={canvasRef}
        aria-label={
          playerId
            ? "Player match statistics card"
            : "Team match statistics comparison"
        }
      />
      {!report && !program && (
        <button
          className="tl-primary"
          onClick={() => s.set({ modal: "matches" })}
        >
          Choose a match
        </button>
      )}
    </div>
  );
});
export default StatsStage;
