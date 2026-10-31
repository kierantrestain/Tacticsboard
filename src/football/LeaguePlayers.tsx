import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useStudio } from "../store";
import { useFootball, checkedTime, requestFootball } from "./data";
import type { Player, Stat, Team } from "../types";
import { TeamBadge } from "./ClubBadge";
import PlayerData from "./PlayerData";
import ComparisonPanel from "./ComparisonPanel";
import { metricGroups, metricGroup, metricNumber, metricText, canPer90, type MetricGroup } from "./metrics";
import { download, filename } from "../core";
type Row = {
  id: string;
  name: string;
  team: Team;
  stats: Record<string, Stat>;
  player?: Player;
  fplId?: number;
  status?: string;
  news?: string;
};
export default function LeaguePlayers({
  league,
  seasonYear,
  archiveTeams,
}: {
  league: string;
  seasonYear?: number;
  archiveTeams?: Team[];
}) {
  const catalogue = useStudio((s) => s.catalogue),
    season = useFootball((s) => s.season),
    [feed,setFeed] = useState<'fpl'|'espn'>('fpl'),
    [q, setQ] = useState(""),
    [club, setClub] = useState("all"),
    [sort, setSort] = useState(""),
    [group,setGroup]=useState<MetricGroup>("All"),
    [per90,setPer90]=useState(false),
    [minimum,setMinimum]=useState(0),
    [ascending,setAscending]=useState(false),
    [columns,setColumns]=useState<string[]|null>(null),
    [compare,setCompare]=useState<string[]>([]),
    [expanded, setExpanded] = useState(""),
    [limit, setLimit] = useState(40);
  const historic =
    !!seasonYear &&
    seasonYear !== (season?.seasonYear || catalogue?.seasonYear);
  const [historicTeams, setHistoricTeams] = useState<Team[]>([]),
    [rosterBusy, setRosterBusy] = useState(false),
    [rosterFailures, setRosterFailures] = useState(0);
  useEffect(() => {
    if (!historic || !archiveTeams?.length) return;
    let active = true;
    setRosterBusy(true);
    setRosterFailures(0);
    setHistoricTeams([]);
    void (async () => {
      const loaded: Team[] = [];
      let failed = 0;
      for (let i = 0; i < archiveTeams.length; i += 4) {
        const results = await Promise.allSettled(
          archiveTeams.slice(i, i + 4).map(async (t) => {
            const r = await requestFootball(
              `action=roster&league=${league}&team=${t.id}&season=${seasonYear}`,
              3600000,
            );
            return { ...t, players: r.players };
          }),
        );
        if (!active) return;
        for (const result of results) {
          if (result.status === "fulfilled") loaded.push(result.value);
          else failed++;
        }
        setHistoricTeams([...loaded]);
        setRosterFailures(failed);
      }
      if (active) setRosterBusy(false);
    })();
    return () => {
      active = false;
    };
  }, [historic, league, seasonYear, archiveTeams]);
  const fpl = league === "eng.1" && !historic && feed==='fpl';
  const rows = useMemo<Row[]>(() => {
    if (!catalogue) return [];
    const lookup = new Map(catalogue.teams.map((t) => [t.id, t]));
    if (fpl)
      return (season?.players || []).flatMap((p) => {
        const team = p.teamId ? lookup.get(p.teamId) : undefined;
        return team
          ? [
              {
                id: "fpl-" + p.id,
                name: p.name,
                team,
                stats: p.stats,
                fplId: p.id,
                status: p.status,
                news: p.news,
              },
            ]
          : [];
      });
    return (historic ? historicTeams : catalogue.teams)
      .filter(
        (t) => t.competitions.includes(league) && (historic || !t.archived),
      )
      .flatMap((t) =>
        t.players.map((p) => ({
          id: p.id + ":" + t.id,
          name: p.name,
          team: t,
          stats: p.statsByCompetition[league] || {},
          player: p,
        })),
      );
  }, [catalogue, season?.players, league, historic, historicTeams]);
  const metrics=useMemo(()=>{const entries=new Map<string,string>();rows.forEach(r=>Object.entries(r.stats).forEach(([key,stat])=>entries.set(key,stat.label||key)));return [...entries].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label));},[rows]);
  const visibleMetrics=metrics.filter(m=>group==='All'||metricGroup(m.key,m.label)===group);
  const defaultSort=fpl?'goals_scored':'totalGoals',sortKey=sort||defaultSort;
  const defaultColumns=(fpl?['goals_scored','assists','minutes','expected_goals','expected_assists']:['totalGoals','goalAssists','minutesPlayed','totalShots','shotsOnTarget']).filter(k=>metrics.some(m=>m.key===k));
  const shownColumns=[...new Set([sortKey,...(columns||defaultColumns)])].filter(k=>metrics.some(m=>m.key===k)).slice(0,6);
  const filtered=useMemo(()=>rows.filter(p=>(club==='all'||p.team.id===club)&&`${p.name} ${p.team.name}`.toLowerCase().includes(q.toLowerCase())&&(minimum===0||(metricNumber(p.stats,fpl?'minutes':'minutesPlayed')??-1)>=minimum)).sort((a,b)=>{const av=metricNumber(a.stats,sortKey,per90),bv=metricNumber(b.stats,sortKey,per90);if(av===null&&bv===null)return a.name.localeCompare(b.name);if(av===null)return 1;if(bv===null)return -1;return (ascending?av-bv:bv-av)||a.name.localeCompare(b.name);}),[rows,club,q,sortKey,per90,minimum,ascending,fpl]);
  useEffect(()=>setLimit(40),[q,club,sortKey,minimum,per90,ascending]);
  const label=(key:string)=>{const name=metrics.find(m=>m.key===key)?.label||key;return name+(per90&&canPer90(key,name)?' /90':'');};
  const grid={gridTemplateColumns:`minmax(190px,1.7fr) minmax(130px,1fr) repeat(${shownColumns.length},minmax(82px,.65fr)) 36px`};
  const exportRows=()=>{const cell=(x:unknown)=>{let v=String(x??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};const csv=[['Player','Club',...shownColumns.map(label)],...filtered.map(r=>[r.name,r.team.name,...shownColumns.map(k=>metricText(r.stats,k,per90))])].map(row=>row.map(cell).join(',')).join('\r\n');download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),filename(`${league}-${seasonYear||season?.seasonYear}-players`)+'.csv');};
  return (
    <section className={`fc-players-view ${fpl ? "" : "ucl"}`}>
      <div className="fc-player-tools">
        {league==='eng.1'&&!historic&&<select aria-label="Player data source" value={feed} onChange={e=>{setFeed(e.target.value as 'fpl'|'espn');setSort('');setColumns(null);setCompare([]);setExpanded('');}}><option value="fpl">FPL · season & expected stats</option><option value="espn">ESPN · competition stats</option></select>}
        <label>
          <Search size={15} />
          <input
            aria-label="Search all league players"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(40);
            }}
            placeholder="Find a player or club…"
          />
        </label>
        <select
          aria-label="Player statistics club"
          value={club}
          onChange={(e) => {
            setClub(e.target.value);
            setLimit(40);
          }}
        >
          <option value="all">All clubs</option>
          {(historic ? historicTeams : catalogue?.teams)
            ?.filter((t) => historic || !t.archived)
            .filter((t) => t.competitions.includes(league))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
        </select>
        <button onClick={exportRows} disabled={!filtered.length}>Export filtered data</button>
      </div>
      <div className="mi-explorer-controls"><div className="mi-chips">{metricGroups.filter(g=>g==='All'||metrics.some(m=>metricGroup(m.key,m.label)===g)).map(g=><button key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);const first=metrics.find(m=>g==='All'||metricGroup(m.key,m.label)===g);if(g!=='All'&&first)setSort(first.key);}}>{g}</button>)}</div><div className="mi-explorer-options"><label>Rank by<select aria-label="Sort league player statistics" value={sortKey} onChange={e=>setSort(e.target.value)}>{visibleMetrics.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></label><button onClick={()=>setAscending(!ascending)} aria-pressed={ascending}>{ascending?'Lowest first ↑':'Highest first ↓'}</button><label>Minimum minutes<select aria-label="Minimum minutes played" value={minimum} onChange={e=>setMinimum(+e.target.value)}>{[0,90,270,450,900,1800].map(n=><option key={n} value={n}>{n===0?'Any minutes':`${n}+ minutes`}</option>)}</select></label><div className="mi-segmented" aria-label="Player statistics basis"><button aria-pressed={!per90} onClick={()=>setPer90(false)}>Totals</button><button aria-pressed={per90} onClick={()=>setPer90(true)}>Per 90</button></div><details className="mi-column-picker"><summary>Choose columns</summary><div>{metrics.map(m=><label key={m.key}><input type="checkbox" checked={(columns||defaultColumns).includes(m.key)} disabled={!(columns||defaultColumns).includes(m.key)&&(columns||defaultColumns).length>=5} onChange={()=>{const current=columns||defaultColumns;setColumns(current.includes(m.key)?current.filter(k=>k!==m.key):[...current,m.key]);}}/>{m.label}</label>)}<button onClick={()=>setColumns(null)}>Reset columns</button></div></details></div><p className="mi-caption">{metrics.length} available metrics · The ranking metric stays visible. {per90?'Count statistics are divided by supplied minutes × 90; rates and percentages retain their original units. Players with no minutes show —.':'Select a player for match logs, season totals and career history.'}</p></div>
      <div className="fc-table-title">
        <div>
          <h2>
            {league === "eng.1"
              ? "Premier League player statistics"
              : "Champions League player statistics"}
          </h2>
          <p>
            {filtered.length} players ·{" "}
            {historic
              ? `${seasonYear}/${String((seasonYear || 0) + 1).slice(-2)} · ${historicTeams.length}/${archiveTeams?.length || 0} historical squads${rosterBusy ? " loading" : " checked"}${rosterFailures ? ` · ${rosterFailures} unavailable` : ""}`
              : fpl
                ? "FPL registered players; registration can differ from the current club squad."
                : "ESPN competition-scoped squad records."}
          </p>
        </div>
        <span>
          {fpl
            ? "FPL · checked " + checkedTime(season?.updatedAt)
            : "ESPN · roster source"}
        </span>
      </div>
      {compare.length>0&&<ComparisonPanel entities={compare.flatMap(id=>rows.filter(r=>r.id===id).map(r=>({id:r.id,name:r.name,subtitle:r.team.shortName,color:r.team.color,stats:r.stats})))} kind="players" scope={`${league==='eng.1'?'Premier League':'Champions League'} · ${seasonYear||season?.seasonYear}/${String((seasonYear||season?.seasonYear||0)+1).slice(-2)}`} source={fpl?'FPL season data':'ESPN competition squad records'} updatedAt={fpl?season?.updatedAt:undefined} onRemove={id=>setCompare(compare.filter(x=>x!==id))} onClear={()=>setCompare([])}/>}
      <div className="mi-leader-scroll"><div className="fc-leader-head" style={grid}><span>Player</span><span>Club</span>{shownColumns.map(k=><button key={k} onClick={()=>{if(sortKey===k)setAscending(!ascending);else{setSort(k);setAscending(false);}}}>{label(k)}{sortKey===k?(ascending?' ↑':' ↓'):''}</button>)}<span>VS</span></div>
      {filtered.slice(0, limit).map((r) => (
        <div key={r.id}>
          <div className="fc-leader-row mi-leader-row" style={grid}>
            <button aria-label={`Statistics for ${r.name}`} aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id?'':r.id)}><strong>{r.name}</strong><ChevronDown size={13}/></button>
            <span className="fc-leader-club"><TeamBadge team={r.team} size="small"/>{r.team.shortName}</span>
            {shownColumns.map(k=><span key={k} className={sortKey===k?'mi-ranked':''}>{metricText(r.stats,k,per90)}</span>)}
            <button aria-label={`Compare ${r.name}`} aria-pressed={compare.includes(r.id)} disabled={!compare.includes(r.id)&&compare.length>=5} onClick={()=>setCompare(compare.includes(r.id)?compare.filter(id=>id!==r.id):[...compare,r.id])}>{compare.includes(r.id)?'✓':'+'}</button>
          </div>
          {expanded === r.id && (
            <div className="fc-leader-details">
              {r.fplId ? (
                <PlayerData
                  player={{
                    id: r.id,
                    name: r.name,
                    fplId: r.fplId,
                    statsByCompetition: {},
                    advanced: {
                      checkedAt: season!.updatedAt,
                      stats: r.stats,
                      status: r.status,
                      news: r.news,
                    },
                  }}
                  team={r.team}
                  league={league}
                />
              ) : (
                <PlayerData
                  player={
                    r.player || {
                      id: r.id,
                      name: r.name,
                      statsByCompetition: { [league]: r.stats },
                    }
                  }
                  team={r.team}
                  league={league}
                  seasonYear={seasonYear}
                />
              )}
            </div>
          )}
        </div>
      ))}
      </div>
      {filtered.length > limit && (
        <button className="fc-more" onClick={() => setLimit((n) => n + 40)}>
          Show 40 more players
        </button>
      )}
      {!filtered.length && <p className="fc-empty">No matching players.</p>}
    </section>
  );
}
