import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useStudio } from "../store";
import type { LineupPlayer, Match, Player, Stat, Team } from "../types";
import {
  checkedTime,
  loadCareer,
  loadPlayerHistory,
  useFootball,
} from "./data";
const display = (s?: Stat) => s?.display ?? s?.value ?? "—";
function Stats({ stats }: { stats: Record<string, Stat> }) {
  const [filter, setFilter] = useState("");
  const entries = Object.entries(stats).filter(([k, v]) =>
    (k + " " + v.label).toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <input
        className="fc-stat-search"
        aria-label="Filter player statistics"
        placeholder="Find a player statistic…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="detail-stats fp-stat-grid">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span>{v.label}</span>
            <strong>{display(v)}</strong>
          </div>
        ))}
      </div>
      {!entries.length && (
        <p className="fc-source-note">
          {filter
            ? "No statistics match this search."
            : "No individual figures were supplied by this source."}
        </p>
      )}
    </>
  );
}
export default function PlayerData({
  player,
  team,
  league: givenLeague,
  match,
  matchPlayer,
  seasonYear,
}: {
  player: Player;
  team: Team;
  league?: string;
  match?: Match;
  matchPlayer?: LineupPlayer;
  seasonYear?: number;
}) {
  const s = useStudio(),
    season = useFootball((st) => st.season),
    league = givenLeague || s.board?.competition || "eng.1";
  const resolved =
    team.players.find(
      (p) => p.id === player.id || (!!player.fplId && p.fplId === player.fplId),
    ) || player;
  const fplId = player.fplId || resolved.fplId,
    espnId = /^\d+$/.test(resolved.id) ? resolved.id : undefined;
  const history = useFootball((st) => (fplId ? st.history[fplId] : undefined)),
    career = useFootball((st) =>
      espnId ? st.careers[league + ":" + espnId] : undefined,
    );
  const context =
    match ||
    (!seasonYear &&
    s.board?.match &&
    [s.board.match.homeId, s.board.match.awayId].includes(team.id)
      ? s.board.match
      : undefined);
  const line =
    matchPlayer ||
    (context
      ? s.summaries[context.id]?.lineups
          .flatMap((l) => l.players)
          .find((p) => p.id === resolved.id)
      : undefined);
  const [tab, setTab] = useState<"match" | "season" | "history">(
      context ? "match" : "season",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selectedYear, setSelectedYear] = useState(
      String(
        seasonYear ||
          context?.seasonYear ||
          season?.seasonYear ||
          s.catalogue?.seasonYear ||
          2026,
      ),
    ),
    [selectedGame, setSelectedGame] = useState("");
  const currentYear = season?.seasonYear || s.catalogue?.seasonYear || 2026;
  const refresh = async (force = false) => {
    setBusy(true);
    setError("");
    const results = await Promise.allSettled([
      ...(fplId ? [loadPlayerHistory(fplId, force)] : []),
      ...(espnId ? [loadCareer(espnId, league, force)] : []),
    ]);
    if (results.some((r) => r.status === "rejected"))
      setError(
        "Some player records could not refresh. Available source records remain below.",
      );
    setBusy(false);
  };
  useEffect(() => {
    void refresh();
    setSelectedGame("");
    setSelectedYear(String(seasonYear || context?.seasonYear || currentYear));
    setTab(context ? "match" : "season");
  }, [resolved.id, fplId, league, context?.id, seasonYear]);
  const fplGame = selectedGame
    ? history?.history.find((h) => String(h.fixtureId) === selectedGame)
    : context?.fplId
      ? history?.history.find((h) => h.fixtureId === context.fplId)
      : undefined;
  const fplPast = history?.pastSeasons.find((p) =>
    p.season.startsWith(selectedYear),
  );
  const careerRows =
    career?.seasons.filter((p) => p.seasonYear === Number(selectedYear)) || [];
  const isCurrent = Number(selectedYear) === currentYear;
  const advanced = player.advanced || resolved.advanced;
  const seasonFpl =
    league === "eng.1"
      ? isCurrent
        ? advanced?.stats
        : fplPast?.stats
      : undefined;
  const seasonEspn = careerRows.length
    ? careerRows
    : isCurrent && Object.keys(resolved.statsByCompetition[league] || {}).length
      ? [
          {
            seasonYear: currentYear,
            season: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
            team: team.shortName,
            stats: resolved.statsByCompetition[league],
          },
        ]
      : [];
  const years = [
    ...new Set([
      String(currentYear),
      ...(career?.seasons.map((p) => String(p.seasonYear)) || []),
      ...(league === "eng.1"
        ? history?.pastSeasons.map((p) => p.season.slice(0, 4)) || []
        : []),
    ]),
  ]
    .sort()
    .reverse();
  const availableGameStats = selectedGame ? undefined : line?.stats;
  return (
    <section
      className="fp-analysis"
      aria-label={`Player analysis for ${player.name}`}
    >
      <header className="fp-analysis-header">
        <div>
          <small>PLAYER ANALYSIS</small>
          <strong>{player.name}</strong>
          <span>
            {team.shortName} ·{" "}
            {league === "eng.1" ? "Premier League" : "Champions League"}
          </span>
        </div>
        <button
          className="tl-icon"
          aria-label={`Refresh analysis for ${player.name}`}
          disabled={busy}
          onClick={() => void refresh(true)}
        >
          <RefreshCw size={14} className={busy ? "spin" : ""} />
        </button>
      </header>
      <div
        className="fp-tabs"
        role="tablist"
        aria-label={`Statistics views for ${player.name}`}
      >
        {(
          [
            ["match", "This game"],
            ["season", "Season"],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {busy && !history && !career && (
        <p className="fc-source-note">Checking player records…</p>
      )}
      {error && <p className="fc-source-note">{error}</p>}
      {tab === "match" && (
        <>
          {context && !selectedGame && (
            <p className="fp-context">
              {context.homeName} v {context.awayName}
              <small>
                {new Date(context.date).toLocaleDateString("en-GB")} ·{" "}
                {line
                  ? line.starter
                    ? "Started"
                    : line.subbedIn
                      ? "Came on"
                      : "Named substitute"
                  : "Not listed in the supplied lineup"}
              </small>
            </p>
          )}
          {!!history?.history.length && (
            <label className="fp-select">
              Game log
              <select
                aria-label={`Match for ${player.name}`}
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
              >
                <option value="">
                  {context ? "Selected match report" : "Choose a PL game"}
                </option>
                {history.history
                  .slice()
                  .reverse()
                  .map((h, i) => {
                    const opponent = s.catalogue?.teams.find(
                      (t) => t.fplId === h.opponentFplId,
                    );
                    return (
                      <option key={h.fixtureId + ":" + i} value={h.fixtureId}>
                        GW {h.matchweek} · {opponent?.shortName || "Opponent"}{" "}
                        {h.home ? "(H)" : "(A)"} · {h.date.slice(0, 10)}
                      </option>
                    );
                  })}
              </select>
            </label>
          )}
          {availableGameStats && (
            <>
              <h4>Match report · ESPN</h4>
              <Stats stats={availableGameStats} />
            </>
          )}
          {fplGame && (
            <>
              <h4>Premier League match detail · FPL</h4>
              <Stats stats={fplGame.stats} />
              <p className="fc-source-note">
                FPL assists follow fantasy rules. They are separate from the
                official match-report assist count.
              </p>
            </>
          )}
          {!availableGameStats && !fplGame && (
            <p className="fc-empty">
              Choose a game from the log or open this player from a match
              report. Missing match statistics are not treated as zero.
            </p>
          )}
        </>
      )}
      {tab === "season" && (
        <>
          <label className="fp-select">
            Season
            <select
              aria-label={`Season statistics for ${player.name}`}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {[...new Set([...years, selectedYear])]
                .sort()
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}/{String(Number(y) + 1).slice(-2)}
                  </option>
                ))}
            </select>
          </label>
          {seasonEspn.map((row, i) => (
            <div key={row.team + ":" + i}>
              <h4>{row.team} · competition totals · ESPN</h4>
              <Stats stats={row.stats} />
            </div>
          ))}
          {seasonFpl && (
            <>
              <h4>Premier League season detail · FPL</h4>
              <div className="fp-kpis">
                {[
                  "minutes",
                  "goals_scored",
                  "expected_goals",
                  "expected_assists",
                ].map((k) => (
                  <div key={k}>
                    <strong>{display(seasonFpl[k])}</strong>
                    <small>
                      {
                        {
                          minutes: "Minutes",
                          goals_scored: "Goals",
                          expected_goals: "xG",
                          expected_assists: "xA",
                        }[k as "minutes"]
                      }
                    </small>
                  </div>
                ))}
              </div>
              <Stats stats={seasonFpl} />
            </>
          )}
          {!seasonEspn.length && !seasonFpl && (
            <p className="fc-empty">
              No verified figures for this competition and season are available
              from the connected sources.
            </p>
          )}
          {isCurrent && advanced?.news && (
            <p className="fc-source-note">
              FPL availability note: {advanced.news}
            </p>
          )}
        </>
      )}
      {tab === "history" && (
        <>
          <h4>Competition career · ESPN</h4>
          {career?.seasons.length ? (
            <>
              <div className="fp-career-head">
                <span>Season / club</span>
                <span>G</span>
                <span>A</span>
                <span>Starts</span>
              </div>
              {career.seasons.map((row, i) => (
                <details
                  className="fp-career-row"
                  key={row.season + row.team + ":" + i}
                >
                  <summary>
                    <span>
                      <strong>{row.season}</strong>
                      <small>{row.team}</small>
                    </span>
                    <span>{display(row.stats.totalGoals)}</span>
                    <span>{display(row.stats.goalAssists)}</span>
                    <span>{display(row.stats.starts)}</span>
                  </summary>
                  <Stats stats={row.stats} />
                  <button
                    className="fp-history-link"
                    onClick={() => {
                      setSelectedYear(String(row.seasonYear));
                      setTab("season");
                    }}
                  >
                    Open this season
                  </button>
                </details>
              ))}
            </>
          ) : (
            <p className="fc-source-note">
              Competition career records are unavailable for this player.
            </p>
          )}
          {!!history?.pastSeasons.length && (
            <>
              <h4>Premier League history · FPL</h4>
              <p className="fc-source-note">
                Historical minutes, goals, fantasy assists, defensive fields and
                xG/xA where the source supplies them.
              </p>
              {history.pastSeasons
                .slice()
                .reverse()
                .map((row) => (
                  <details className="fp-past-season" key={row.season}>
                    <summary>
                      <strong>{row.season}</strong>
                      <span>
                        {display(row.stats.minutes)} min ·{" "}
                        {display(row.stats.goals_scored)} goals
                      </span>
                    </summary>
                    <Stats stats={row.stats} />
                  </details>
                ))}
            </>
          )}
          {!career?.seasons.length && !history?.pastSeasons.length && (
            <p className="fc-empty">
              No historical records have been supplied yet. The source profile
              remains available below.
            </p>
          )}
        </>
      )}
      <footer className="fp-source">
        {career?.updatedAt
          ? `Career checked ${checkedTime(career.updatedAt)}`
          : history?.updatedAt
            ? `PL history checked ${checkedTime(history.updatedAt)}`
            : "Saved source snapshot"}
        {career?.sourceUrl && (
          <a href={career.sourceUrl} target="_blank" rel="noreferrer">
            Source <ExternalLink size={11} />
          </a>
        )}
      </footer>
    </section>
  );
}
