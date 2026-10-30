import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, ChevronDown } from "lucide-react";
import { useStudio } from "../store";
import { formatMatchStat } from "../core";
import type { Match, MatchDetails } from "../types";
import { TeamBadge } from "./ClubBadge";
import { checkedTime, loadReport } from "./data";
const priority = [
  "possessionPct",
  "totalShots",
  "shotsOnTarget",
  "totalPasses",
  "passPct",
  "foulsCommitted",
  "yellowCards",
  "redCards",
  "wonCorners",
  "offsides",
];
export default function MatchReport({
  match,
  compact = false,
}: {
  match: Match;
  compact?: boolean;
}) {
  const catalogue = useStudio((s) => s.catalogue),
    details = useStudio((s) => s.summaries[match.id]);
  const [tab, setTab] = useState<"team" | "players" | "events">("team"),
    [side, setSide] = useState(match.homeId),
    [expanded, setExpanded] = useState(""),
    [filter, setFilter] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [eventCount, setEventCount] = useState(40);
  const refresh = async (force = true) => {
    setBusy(true);
    setError("");
    try {
      await loadReport(match, force);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saved data is available.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    setSide(match.homeId);
    setExpanded("");
    setFilter("");
    setError("");
    setBusy(true);
    void loadReport(match)
      .catch(() => {
        if (active) setError("The match report is not available yet.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible")
          void loadReport(match, true).catch(() => {});
      },
      match.state === "in" ? 30000 : 120000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [match.id]);
  if (!catalogue) return null;
  const home = catalogue.teams.find((t) => t.id === match.homeId),
    away = catalogue.teams.find((t) => t.id === match.awayId),
    hs = details?.teamStats.find((t) => t.teamId === match.homeId)?.stats || {},
    as = details?.teamStats.find((t) => t.teamId === match.awayId)?.stats || {};
  const keys = [...new Set([...Object.keys(hs), ...Object.keys(as)])]
    .filter((k) =>
      ((hs[k]?.label || as[k]?.label || k) + " " + k)
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((a, b) => {
      const ai = priority.indexOf(a),
        bi = priority.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  const lineup = details?.lineups.find((l) => l.teamId === side),
    events = details?.commentary?.length
      ? details.commentary
      : details?.events || [];
  const display = (v: MatchDetails | undefined, key: string, pid: string) => {
    const p = v?.lineups.flatMap((l) => l.players).find((p) => p.id === pid),
      stat = p?.stats?.[key];
    return stat?.display ?? stat?.value ?? "—";
  };
  return (
    <section
      className={`fc-report ${compact ? "compact" : ""} ${tab !== "team" ? "is-detail" : ""}`}
    >
      <div className="fc-scoreboard">
        <div>
          <TeamBadge team={home} size="large" />
          <strong>{home?.shortName || match.homeName}</strong>
        </div>
        <div>
          <b>
            {match.state === "in" || match.completed
              ? `${details?.score?.find((t) => t.teamId === match.homeId)?.score ?? match.homeScore ?? "—"} — ${details?.score?.find((t) => t.teamId === match.awayId)?.score ?? match.awayScore ?? "—"}`
              : "VS"}
          </b>
          <small className={match.state === "in" ? "fc-live" : ""}>
            {details?.clock && match.state === "in"
              ? details.clock
              : match.status}
          </small>
        </div>
        <div>
          <TeamBadge team={away} size="large" />
          <strong>{away?.shortName || match.awayName}</strong>
        </div>
      </div>
      <p className="fc-match-meta">
        {match.date
          ? new Date(match.date).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            }) + " UTC"
          : "Kickoff TBC"}
        {(details?.venue || match.venue) &&
          ` · ${details?.venue || match.venue}`}
      </p>
      <div className="fc-report-status">
        <span>
          {busy
            ? "Checking match report…"
            : `Report checked ${checkedTime(details?.updatedAt)}`}
        </span>
        <button
          aria-label="Refresh match report"
          onClick={() => void refresh()}
          disabled={busy}
        >
          <RefreshCw size={13} className={busy ? "spin" : ""} />
        </button>
      </div>
      {error && <p className="fc-source-note">{error}</p>}
      <div
        className="fc-report-tabs"
        role="tablist"
        aria-label="Match report sections"
      >
        {[
          ["team", "Team stats"],
          ["players", "Players"],
          ["events", "Commentary"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => {
              setTab(key as typeof tab);
              setFilter("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "team" && (
        <>
          <input
            className="fc-stat-search"
            aria-label="Find a match statistic"
            placeholder="Find a statistic…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="fc-stat-list">
            {keys.map((k) => (
              <div key={k}>
                <strong>{formatMatchStat(hs, k)}</strong>
                <span>{hs[k]?.label || as[k]?.label || k}</span>
                <strong>{formatMatchStat(as, k)}</strong>
              </div>
            ))}
          </div>
          {!keys.length && (
            <p className="fc-empty">
              {busy
                ? "Loading the source statistics."
                : match.completed
                  ? "No matching team statistics have been supplied."
                  : "Statistics and confirmed lineups appear as the source publishes them."}
            </p>
          )}
          {details?.attendance !== undefined && details.attendance !== null && (
            <p className="fc-source-note">
              Attendance: {details.attendance.toLocaleString("en-GB")}
            </p>
          )}
          {!!details?.officials?.length && (
            <p className="fc-source-note">
              {details.officials
                .map((o) => `${o.role || "Official"}: ${o.name}`)
                .join(" · ")}
            </p>
          )}
          <p className="fc-source-note">
            All supplied team fields are shown. Completion percentages use the
            source totals; missing values remain unknown.
          </p>
        </>
      )}
      {tab === "players" && (
        <>
          <div className="fc-team-switch">
            {[home, away].map((t) => (
              <button
                key={t?.id}
                className={side === t?.id ? "active" : ""}
                onClick={() => {
                  setSide(t!.id);
                  setExpanded("");
                }}
              >
                <TeamBadge team={t} size="small" />
                {t?.shortName}
              </button>
            ))}
          </div>
          <p className="fc-source-note">
            {lineup?.formation && `${lineup.formation} · `}Select a player to
            see every supplied match statistic.
          </p>
          <div className="fc-player-head">
            <span>Player</span>
            <span>G</span>
            <span>A</span>
            <span>Shots</span>
            <span>YC</span>
          </div>
          {lineup?.players.map((p) => (
            <div className="fc-player-entry" key={p.id}>
              <button
                className="fc-player-row"
                onClick={() => setExpanded(expanded === p.id ? "" : p.id)}
                aria-expanded={expanded === p.id}
              >
                <span>
                  <i>{p.number || "·"}</i>
                  <strong>{p.name}</strong>
                  <small>{p.starter ? "XI" : p.subbedIn ? "ON" : "SUB"}</small>
                  <ChevronDown size={11} />
                </span>
                {["totalGoals", "goalAssists", "totalShots", "yellowCards"].map(
                  (k) => (
                    <span key={k}>{display(details, k, p.id)}</span>
                  ),
                )}
              </button>
              {expanded === p.id && (
                <div className="fc-player-expanded">
                  {Object.entries(p.stats || {}).map(([k, v]) => (
                    <div key={k}>
                      <span>{v.label}</span>
                      <strong>{v.display ?? v.value ?? "—"}</strong>
                    </div>
                  ))}
                  {!Object.keys(p.stats || {}).length && (
                    <p>No individual numbers were supplied.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {!lineup?.players.length && (
            <p className="fc-empty">
              Lineups have not been supplied for this fixture.
            </p>
          )}
        </>
      )}
      {tab === "events" && (
        <>
          <div className="fc-commentary">
            {events.slice(0, eventCount).map((e, i) => (
              <div key={i}>
                <strong>{e.minute || "·"}</strong>
                <p>{e.text}</p>
              </div>
            ))}
          </div>
          {events.length > eventCount && (
            <button
              className="fc-more"
              onClick={() => setEventCount((n) => n + 60)}
            >
              Show more commentary ({events.length - eventCount} remaining)
            </button>
          )}
          {!events.length && (
            <p className="fc-empty">
              No match commentary has been supplied yet.
            </p>
          )}
        </>
      )}
      <a
        className="fc-source-link"
        href={details?.sourceUrl || match.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        Match source <ExternalLink size={12} />
      </a>
    </section>
  );
}
