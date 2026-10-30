import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useStudio } from "../store";
import { useFootball, checkedTime } from "./data";
import type { Player, Stat, Team } from "../types";
import { TeamBadge } from "./ClubBadge";
import PlayerData from "./PlayerData";
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
export default function LeaguePlayers({ league }: { league: string }) {
  const catalogue = useStudio((s) => s.catalogue),
    season = useFootball((s) => s.season),
    [q, setQ] = useState(""),
    [club, setClub] = useState("all"),
    [sort, setSort] = useState("goals"),
    [expanded, setExpanded] = useState(""),
    [limit, setLimit] = useState(40);
  const fpl = league === "eng.1";
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
    return catalogue.teams
      .filter((t) => t.competitions.includes(league))
      .flatMap((t) =>
        t.players.map((p) => ({
          id: p.id + ":" + t.id,
          name: p.name,
          team: t,
          stats: p.statsByCompetition[league] || {},
          player: p,
        })),
      );
  }, [catalogue, season?.players, league]);
  const keys = fpl
    ? {
        goals: "goals_scored",
        assists: "assists",
        minutes: "minutes",
        xg: "expected_goals",
      }
    : {
        goals: "totalGoals",
        assists: "goalAssists",
        minutes: "minutesPlayed",
        xg: "expectedGoals",
      };
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (p) =>
            (club === "all" || p.team.id === club) &&
            `${p.name} ${p.team.name}`.toLowerCase().includes(q.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(b.stats[keys[sort as keyof typeof keys]]?.value ?? -1) -
              Number(a.stats[keys[sort as keyof typeof keys]]?.value ?? -1) ||
            a.name.localeCompare(b.name),
        ),
    [rows, club, q, sort, league],
  );
  const display = (r: Row, k: string) =>
    r.stats[k]?.display ?? r.stats[k]?.value ?? "—";
  return (
    <section className={`fc-players-view ${fpl ? "" : "ucl"}`}>
      <div className="fc-player-tools">
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
          {catalogue?.teams
            .filter((t) => t.competitions.includes(league))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
        </select>
        <select
          aria-label="Sort league player statistics"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="goals">Most goals</option>
          <option value="assists">Most assists</option>
          {fpl && (
            <>
              <option value="minutes">Most minutes</option>
              <option value="xg">Highest xG</option>
            </>
          )}
        </select>
      </div>
      <div className="fc-table-title">
        <div>
          <h2>
            {fpl
              ? "Premier League player statistics"
              : "Champions League player statistics"}
          </h2>
          <p>
            {filtered.length} players ·{" "}
            {fpl
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
      <div className="fc-leader-head">
        <span>Player</span>
        <span>Club</span>
        <span>Goals</span>
        <span>{fpl ? "FPL assists" : "Assists"}</span>
        {fpl && (
          <>
            <span>Minutes</span>
            <span>xG</span>
            <span>xA</span>
          </>
        )}
        <span />
      </div>
      {filtered.slice(0, limit).map((r) => (
        <div key={r.id}>
          <button
            className="fc-leader-row"
            aria-label={`Statistics for ${r.name}`}
            aria-expanded={expanded === r.id}
            onClick={() => setExpanded(expanded === r.id ? "" : r.id)}
          >
            <strong>{r.name}</strong>
            <span className="fc-leader-club">
              <TeamBadge team={r.team} size="small" />
              {r.team.shortName}
            </span>
            <span>{display(r, keys.goals)}</span>
            <span>{display(r, keys.assists)}</span>
            {fpl && (
              <>
                <span>{display(r, "minutes")}</span>
                <span>{display(r, "expected_goals")}</span>
                <span>{display(r, "expected_assists")}</span>
              </>
            )}
            <ChevronDown size={13} />
          </button>
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
                />
              ) : (
                <div className="detail-stats">
                  {Object.entries(r.stats).map(([k, v]) => (
                    <div key={k}>
                      <span>{v.label}</span>
                      <strong>{v.display ?? v.value ?? "—"}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {filtered.length > limit && (
        <button className="fc-more" onClick={() => setLimit((n) => n + 40)}>
          Show 40 more players
        </button>
      )}
      {!filtered.length && <p className="fc-empty">No matching players.</p>}
    </section>
  );
}
