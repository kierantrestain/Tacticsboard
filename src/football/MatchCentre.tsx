import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Search,
  RefreshCw,
  X,
  ArrowUpRight,
  Trophy,
  UserRound,
  SlidersHorizontal,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime } from "../studio/runtime";
import {
  checkedTime,
  loadReport,
  refreshFootball,
  refreshMatchday,
  useFootball,
} from "./data";
import { TeamBadge } from "./ClubBadge";
import MatchReport from "./MatchReport";
import LeaguePlayers from "./LeaguePlayers";
import type { Match } from "../types";
const stat = (stats: any, key: string) =>
  stats[key]?.display ?? stats[key]?.value ?? "—";
export default function MatchCentre() {
  const catalogue = useStudio((s) => s.catalogue),
    season = useFootball((s) => s.season),
    refreshing = useFootball((s) => s.refreshing),
    error = useFootball((s) => s.error),
    checked = useFootball((s) => s.checkedAt),
    tab = useFootball((s) => s.tab),
    focus = useFootball((s) => s.focusMatchId),
    ref = useRef<HTMLDialogElement>(null),
    initialized = useRef(false);
  const [league, setLeague] = useState("eng.1"),
    [week, setWeek] = useState<number | "all">("all"),
    [q, setQ] = useState(""),
    [club, setClub] = useState("all"),
    [status, setStatus] = useState("all"),
    [date, setDate] = useState(""),
    [selected, setSelected] = useState(""),
    [limit, setLimit] = useState(40),
    [reportError, setReportError] = useState(""),
    [analysing, setAnalysing] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    const today = new Date().toISOString().slice(0, 10);
    void Promise.allSettled(
      ["eng.1", "uefa.champions"].map((l) => refreshMatchday(today, l)),
    );
    return () => ref.current?.close();
  }, []);
  useEffect(() => {
    if (!season || initialized.current || focus) return;
    initialized.current = true;
    setWeek(
      season.weeks.find((w) => w.next)?.id ||
        season.weeks.find((w) => w.current)?.id ||
        "all",
    );
  }, [season, focus]);
  const all = season?.fixtures || catalogue?.matches || [],
    teams = catalogue?.teams || [],
    lookup = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const filtered = useMemo(
    () =>
      all
        .filter(
          (m) =>
            m.league === league &&
            (week === "all" || m.matchweek === week) &&
            (club === "all" || m.homeId === club || m.awayId === club) &&
            (!date || m.date.startsWith(date)) &&
            (status === "all" ||
              (status === "results" && m.completed) ||
              (status === "upcoming" && !m.completed) ||
              (status === "live" && m.state === "in")) &&
            `${m.homeName} ${m.awayName}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          status === "results"
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date),
        ),
    [all, league, week, club, date, status, q],
  );
  useEffect(() => {
    setLimit(40);
    if (!filtered.some((m) => m.id === selected))
      setSelected(filtered[0]?.id || "");
  }, [league, week, club, date, status, q]);
  useEffect(() => {
    if (!filtered.some((m) => m.id === selected))
      setSelected(filtered[0]?.id || "");
  }, [filtered, selected]);
  useEffect(() => {
    if (!focus || !season) return;
    const target = season.fixtures.find((m) => m.id === focus);
    if (target) {
      initialized.current = true;
      setLeague(target.league);
      setWeek(target.matchweek || "all");
      setQ("");
      setClub("all");
      setDate("");
      setStatus("all");
      setSelected(target.id);
    }
    useFootball.setState({ focusMatchId: undefined });
  }, [focus, season]);
  useEffect(() => {
    if (!season) return;
    const days = [
      ...new Set(
        season.fixtures
          .filter(
            (m) =>
              m.league === league &&
              (date
                ? m.date.startsWith(date)
                : week !== "all" && m.matchweek === week),
          )
          .map((m) => m.date.slice(0, 10)),
      ),
    ].filter(Boolean);
    if (days.length <= 4)
      void Promise.allSettled(days.map((day) => refreshMatchday(day, league)));
  }, [league, week, date]);
  const match = all.find((m) => m.id === selected),
    rounds =
      league === "eng.1"
        ? Array.from({ length: 38 }, (_, i) => i + 1)
        : Array.from({ length: 8 }, (_, i) => i + 1);
  const chooseLeague = (value: string) => {
    setLeague(value);
    setClub("all");
    setQ("");
    setDate("");
    setStatus("all");
    setWeek(
      value === "eng.1"
        ? season?.weeks.find((w) => w.next)?.id || "all"
        : all
            .filter((m) => m.league === value && !m.completed)
            .sort((a, b) => a.date.localeCompare(b.date))[0]?.matchweek ||
            "all",
    );
  };
  const analyse = async (m: Match) => {
    setAnalysing(true);
    setReportError("");
    try {
      await useStudio.getState().loadMatch(m);
      useStudio.getState().set({ inspector: "match" });
      useRuntime.setState({
        view: "board",
        sidebar: "inspector",
        time: 0,
        mediaPlaying: false,
      });
    } catch {
      setReportError("This match could not be opened.");
    } finally {
      setAnalysing(false);
    }
  };
  const form = (id: string) =>
    all
      .filter(
        (m) =>
          m.league === league &&
          m.completed &&
          (m.homeId === id || m.awayId === id),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse()
      .map((m) => {
        const us = Number(m.homeId === id ? m.homeScore : m.awayScore),
          them = Number(m.homeId === id ? m.awayScore : m.homeScore);
        return { id: m.id, result: us > them ? "W" : us < them ? "L" : "D" };
      });
  return (
    <dialog
      ref={ref}
      className="fc-dialog"
      onCancel={() => useStudio.getState().set({ modal: null })}
    >
      <header className="fc-header">
        <div>
          <span className="tl-eyebrow">
            FOOTBALL INTELLIGENCE / {catalogue?.season}
          </span>
          <h1>
            Match centre<span>{all.length} fixtures</span>
          </h1>
          <p>
            The full Premier League season. Every published UCL league-phase
            fixture.
          </p>
        </div>
        <button
          className="tl-icon"
          aria-label="Close match centre"
          onClick={() => useStudio.getState().set({ modal: null })}
        >
          <X size={22} />
        </button>
      </header>
      <div className="fc-toolbar">
        <div className="fc-competitions">
          {[
            ["eng.1", "Premier League"],
            ["uefa.champions", "Champions League"],
          ].map(([id, label]) => (
            <button
              className={league === id ? "active" : ""}
              key={id}
              onClick={() => chooseLeague(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="fc-view-switch">
          <button
            className={tab === "fixtures" ? "active" : ""}
            onClick={() => useFootball.setState({ tab: "fixtures" })}
          >
            <CalendarDays size={15} />
            Fixtures
          </button>
          <button
            className={tab === "players" ? "active" : ""}
            onClick={() => useFootball.setState({ tab: "players" })}
          >
            <UserRound size={15} />
            Players
          </button>
          <button
            className={tab === "table" ? "active" : ""}
            onClick={() => useFootball.setState({ tab: "table" })}
          >
            <Trophy size={15} />
            Table
          </button>
        </div>
        <button
          className="fc-refresh"
          onClick={() => {
            void refreshFootball();
            if (date) void refreshMatchday(date, league);
            if (match) void loadReport(match, true).catch(() => {});
          }}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          {refreshing ? "Checking…" : "Refresh data"}
        </button>
      </div>
      {tab === "fixtures" ? (
        <>
          <div className="fc-filterbar">
            <label>
              <Search size={15} />
              <input
                aria-label="Search season fixtures"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setWeek("all");
                }}
                placeholder="Search any team or match…"
              />
            </label>
            <select
              aria-label="Filter fixtures by club"
              value={club}
              onChange={(e) => {
                setClub(e.target.value);
                setWeek("all");
              }}
            >
              <option value="all">All clubs</option>
              {teams
                .filter((t) => t.competitions.includes(league))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
            </select>
            <select
              aria-label="Fixture status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All fixtures</option>
              <option value="upcoming">Upcoming</option>
              <option value="results">Results</option>
              <option value="live">Live now</option>
            </select>
            <input
              type="date"
              aria-label="Fixture date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setWeek("all");
              }}
            />
            {(q || date || club !== "all") && (
              <button
                className="fc-reset"
                onClick={() => {
                  setQ("");
                  setDate("");
                  setClub("all");
                  setWeek("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div
            className="fc-rounds"
            role="group"
            aria-label={
              league === "eng.1"
                ? "Premier League gameweeks"
                : "Champions League matchdays"
            }
          >
            <button
              aria-pressed={week === "all"}
              onClick={() => setWeek("all")}
            >
              Full season
            </button>
            {rounds.map((n) => (
              <button
                aria-label={`${league === "eng.1" ? "Gameweek" : "Matchday"} ${n}`}
                aria-pressed={week === n}
                key={n}
                onClick={() => {
                  setWeek(n);
                  setDate("");
                }}
              >
                <small>{league === "eng.1" ? "GW" : "MD"}</small>
                {String(n).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="fc-body">
            <div className="fc-fixture-column">
              <div className="fc-list-heading">
                <strong>
                  {week === "all"
                    ? "Season fixtures"
                    : `${league === "eng.1" ? "Gameweek" : "Matchday"} ${week}`}
                </strong>
                <span>{filtered.length} matches</span>
              </div>
              {filtered.slice(0, limit).map((m) => (
                <button
                  key={m.id}
                  className={`fc-fixture ${selected === m.id ? "selected" : ""}`}
                  onClick={() => setSelected(m.id)}
                  onPointerEnter={() => {
                    if (m.completed) void loadReport(m).catch(() => {});
                  }}
                  aria-label={`${m.homeName} versus ${m.awayName}, ${m.completed ? m.homeScore + " to " + m.awayScore : m.status}`}
                >
                  <div className="fc-fixture-top">
                    <span>
                      {m.date
                        ? new Date(m.date).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          })
                        : "Date TBC"}{" "}
                      · {league === "eng.1" ? "GW" : "MD"}{" "}
                      {m.matchweek || "TBC"}
                    </span>
                    <span className={m.state === "in" ? "fc-live" : ""}>
                      {m.state === "in"
                        ? "LIVE"
                        : m.completed
                          ? "FT"
                          : m.date
                            ? new Date(m.date).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              }) + " UTC"
                            : "TBC"}
                    </span>
                  </div>
                  <div className="fc-fixture-team">
                    <TeamBadge team={lookup.get(m.homeId)} size="small" />
                    <strong>
                      {lookup.get(m.homeId)?.shortName || m.homeName}
                    </strong>
                    <b>{m.completed || m.state === "in" ? m.homeScore : "–"}</b>
                  </div>
                  <div className="fc-fixture-team">
                    <TeamBadge team={lookup.get(m.awayId)} size="small" />
                    <strong>
                      {lookup.get(m.awayId)?.shortName || m.awayName}
                    </strong>
                    <b>{m.completed || m.state === "in" ? m.awayScore : "–"}</b>
                  </div>
                </button>
              ))}
              {filtered.length > limit && (
                <button
                  className="fc-more"
                  onClick={() => setLimit((n) => n + 40)}
                >
                  Show 40 more matches
                </button>
              )}
              {!filtered.length && (
                <div className="fc-empty">
                  <CalendarDays size={25} />
                  <h3>No fixtures match these filters.</h3>
                  <p>Choose another matchweek or clear the filters.</p>
                </div>
              )}
            </div>
            <div className="fc-detail-column">
              {match ? (
                <>
                  <MatchReport key={match.id} match={match} />
                  <div className="fc-analyse-bar">
                    <p>
                      {reportError ||
                        "Open the available lineups on the tactical board, then build your explanation."}
                    </p>
                    <button
                      className="tl-primary"
                      onClick={() => void analyse(match)}
                      disabled={analysing}
                    >
                      {analysing ? "Opening analysis…" : "Analyse this match"}
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="fc-empty">
                  Select a fixture to inspect its report.
                </div>
              )}
            </div>
          </div>
        </>
      ) : tab === "players" ? (
        <LeaguePlayers league={league} />
      ) : (
        <div className="fc-table-scroll">
          {season?.standings[league]?.groups.map((g, i) => (
            <section key={i}>
              <div className="fc-table-title">
                <h2>{g.name}</h2>
                <span>
                  Checked {checkedTime(season.standings[league].updatedAt)}
                </span>
              </div>
              <table className="fc-league-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Club</th>
                    {[
                      "P",
                      "W",
                      "D",
                      "L",
                      "GF",
                      "GA",
                      "GD",
                      "Pts",
                      "Last five",
                    ].map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.entries.map((row) => (
                    <tr key={row.teamId}>
                      <td>
                        {stat(row.stats, "rank") !== "—"
                          ? stat(row.stats, "rank")
                          : row.rank}
                      </td>
                      <td>
                        <button
                          aria-label={`View ${lookup.get(row.teamId)?.name} fixtures`}
                          onClick={() => {
                            setClub(row.teamId);
                            setWeek("all");
                            useFootball.setState({ tab: "fixtures" });
                          }}
                        >
                          <TeamBadge
                            team={lookup.get(row.teamId)}
                            size="small"
                          />
                          <strong>
                            {lookup.get(row.teamId)?.shortName || row.teamId}
                          </strong>
                          {row.qualification && (
                            <small title={row.qualification}>
                              {row.qualification}
                            </small>
                          )}
                        </button>
                      </td>
                      {[
                        "gamesPlayed",
                        "wins",
                        "ties",
                        "losses",
                        "pointsFor",
                        "pointsAgainst",
                        "pointDifferential",
                        "points",
                      ].map((k) => (
                        <td
                          className={k === "points" ? "fc-points" : ""}
                          key={k}
                        >
                          {stat(row.stats, k)}
                        </td>
                      ))}
                      <td>
                        <div className="fc-form">
                          {form(row.teamId).map((r) => (
                            <span className={r.result} key={r.id}>
                              {r.result}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )) || <p>Opening the league tables…</p>}
        </div>
      )}
      <footer className="fc-footer">
        <span>
          <i className={error ? "warning" : ""} />
          {refreshing
            ? "Refreshing public feeds"
            : `Data checked ${checkedTime(checked)}`}
          {error ? " · Saved values retained for unavailable sources." : ""}
        </span>
        <span>
          {league === "eng.1"
            ? "380 fixtures · 38 official gameweeks"
            : "144 league-phase fixtures · Knockout pairings appear after the draw"}{" "}
          · ESPN + Premier League FPL
        </span>
      </footer>
    </dialog>
  );
}
