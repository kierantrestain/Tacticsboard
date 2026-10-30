import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStudio } from "../store";
import type { Player, Team } from "../types";
import { checkedTime, loadPlayerHistory, useFootball } from "./data";
export default function PlayerData({
  player,
  team,
}: {
  player: Player;
  team: Team;
}) {
  const history = useFootball((s) =>
      player.fplId ? s.history[player.fplId] : undefined,
    ),
    season = useFootball((s) => s.season),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setError("");
    if (!player.fplId) return;
    let active = true;
    setBusy(true);
    void loadPlayerHistory(player.fplId)
      .catch(() => {
        if (active) setError("Match log temporarily unavailable.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [player.fplId]);
  if (!player.fplId || !player.advanced) return null;
  const a = player.advanced;
  return (
    <div className="fc-advanced">
      <div className="section-heading">
        <h3>Premier League advanced</h3>
        <span>FPL source</span>
      </div>
      <p className="fc-source-note">
        Season {season?.seasonYear}/
        {String((season?.seasonYear || 2026) + 1).slice(-2)} · checked{" "}
        {checkedTime(a.checkedAt)}
      </p>
      <div className="fc-advanced-key">
        {["minutes", "starts", "expected_goals", "expected_assists"].map(
          (k) => (
            <div key={k}>
              <strong>{a.stats[k]?.display ?? "—"}</strong>
              <span>
                {k === "expected_goals"
                  ? "xG"
                  : k === "expected_assists"
                    ? "xA"
                    : k === "minutes"
                      ? "Minutes"
                      : "Starts"}
              </span>
            </div>
          ),
        )}
      </div>
      <details>
        <summary>
          All {Object.keys(a.stats).length} supplied season statistics
        </summary>
        <div className="detail-stats">
          {Object.entries(a.stats).map(([k, v]) => (
            <div key={k}>
              <span>{v.label}</span>
              <strong>{v.display ?? v.value ?? "—"}</strong>
            </div>
          ))}
        </div>
      </details>
      {a.status && (
        <p className="fc-source-note">
          FPL availability:{" "}
          {{
            a: "Available",
            d: "Doubtful",
            i: "Unavailable",
            s: "Suspended",
            u: "Unavailable",
            n: "Not available",
          }[a.status] || a.status}
          {a.news ? ` · ${a.news}` : ""}
        </p>
      )}
      <div className="section-heading">
        <h3>Match by match</h3>
        <button
          className="tl-icon"
          aria-label="Refresh player match log"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await loadPlayerHistory(player.fplId!, true);
            } catch {
              setError("Match log temporarily unavailable.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={13} className={busy ? "spin" : ""} />
        </button>
      </div>
      {busy && !history && (
        <p className="fc-source-note">Loading the match log…</p>
      )}
      {error && <p className="fc-source-note">{error}</p>}
      <div className="fc-history-head">
        <span>Matchweek</span>
        <span>Min</span>
        <span>G</span>
        <span>xG</span>
      </div>
      {history?.history
        .slice()
        .reverse()
        .map((h, i) => {
          const fixture = season?.fixtures.find((m) => m.fplId === h.fixtureId),
            opponent = useStudio
              .getState()
              .catalogue?.teams.find((t) => t.fplId === h.opponentFplId);
          return (
            <button
              className="fc-history-row"
              key={i}
              disabled={!fixture}
              onClick={() => {
                useFootball.setState({
                  focusMatchId: fixture!.id,
                  tab: "fixtures",
                });
                useStudio.getState().set({ modal: "matches" });
              }}
            >
              <span>
                <strong>GW {h.matchweek}</strong>
                <small>
                  {opponent?.shortName || "Opponent"} {h.home ? "(H)" : "(A)"}
                </small>
              </span>
              <span>{h.stats.minutes?.display ?? "—"}</span>
              <span>{h.stats.goals_scored?.display ?? "—"}</span>
              <span>{h.stats.expected_goals?.display ?? "—"}</span>
            </button>
          );
        })}
      <p className="fc-source-note">
        Select a match to open its report. xG/xA are supplied by FPL; its
        assists use fantasy rules and are kept separate from the ESPN figures.
      </p>
    </div>
  );
}
