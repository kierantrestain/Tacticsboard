import type { Match, MatchDetails } from "../types";
import { formatMatchStat } from '../core';
export function reportCoverage(details?: MatchDetails) {
  const players = details?.lineups.flatMap((l) => l.players) || [];
  return {
    teams:
      details?.teamStats.filter((t) => Object.keys(t.stats).length).length || 0,
    teamFields: new Set(
      details?.teamStats.flatMap((t) => Object.keys(t.stats)) || [],
    ).size,
    lineups:
      details?.lineups.filter(
        (l) => l.players.filter((p) => p.starter).length === 11,
      ).length || 0,
    players: players.length,
    playersWithStats: players.filter((p) => Object.keys(p.stats || {}).length)
      .length,
    commentary: details?.commentary?.length || details?.events.length || 0,
  };
}
export function matchDigest(match: Match, details?: MatchDetails): string[] {
  const output: string[] = [],
    score = (id: string, backup?: string | null) =>
      details?.score?.find((s) => s.teamId === id)?.score ?? backup;
  const home = score(match.homeId, match.homeScore),
    away = score(match.awayId, match.awayScore);
  if (home != null && away != null && (match.completed || match.state === "in"))
    output.push(
      `${match.homeName} ${home}–${away} ${match.awayName}${match.completed ? " at full time" : " (in progress)"}.`,
    );
  const h =
      details?.teamStats.find((t) => t.teamId === match.homeId)?.stats || {},
    a = details?.teamStats.find((t) => t.teamId === match.awayId)?.stats || {};
  for (const [key, label] of [
    ["totalShots", "shots"],
    ["shotsOnTarget", "shots on target"],
    ["possessionPct", "possession"],
    ["wonCorners", "corners"],
  ])
    if (h[key]?.display !== undefined && a[key]?.display !== undefined)
      output.push(
        `${label[0].toUpperCase() + label.slice(1)}: ${match.homeName} ${h[key].display}${key === "possessionPct" && !h[key].display.includes("%") ? "%" : ""}; ${match.awayName} ${a[key].display}${key === "possessionPct" && !a[key].display.includes("%") ? "%" : ""}.`,
      );
  return output;
}
const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export function playerReportCSV(match: Match, details: MatchDetails) {
  const players = details.lineups.flatMap((l) =>
      l.players.map((p) => ({
        team: l.teamId === match.homeId ? match.homeName : match.awayName,
        p,
      })),
    ),
    keys = [...new Set(players.flatMap(({ p }) => Object.keys(p.stats || {})))];
  const labels = keys.map(
    (k) => players.find(({ p }) => p.stats?.[k])?.p.stats?.[k].label || k,
  );
  return [
    ["Match", "Date", "Team", "Player", "Started", ...labels],
    ...players.map(({ team, p }) => [
      match.name,
      match.date,
      team,
      p.name,
      p.starter ? "Yes" : "No",
      ...keys.map((k) => p.stats?.[k]?.display ?? p.stats?.[k]?.value ?? ""),
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

const priorities = [
  "possessionPct",
  "totalShots",
  "shotsOnTarget",
  "totalPasses",
  "passPct",
  "wonCorners",
  "foulsCommitted",
  "yellowCards",
  "redCards",
  "offsides",
];
export function statCardRows(
  report: Pick<MatchDetails, "lineups" | "teamStats">,
  playerId?: string,
  match?: Pick<Match, "homeId" | "awayId">,
  comparePlayerId?: string,
) {
  if (playerId) {
    const player = report.lineups
      .flatMap((l) => l.players)
      .find((p) => p.id === playerId);
    const opponent = comparePlayerId ? report.lineups.flatMap(l=>l.players).find(p=>p.id===comparePlayerId) : undefined;
    const keeper =
      player?.positionCode === "G" || /Goalkeep/i.test(player?.position || "");
    const order = keeper
      ? [
          "minutesPlayed",
          "saves",
          "shotsFaced",
          "goalsAgainst",
          "appearances",
          "yellowCards",
          "redCards",
        ]
      : [
          "minutesPlayed",
          "totalGoals",
          "goalAssists",
          "totalShots",
          "shotsOnTarget",
          "appearances",
          "foulsCommitted",
          "foulsSuffered",
          "yellowCards",
          "redCards",
          "offsides",
        ];
    return Object.entries({...opponent?.stats,...player?.stats})
      .filter(
        ([key]) =>
          keeper || !["saves", "shotsFaced", "goalsAgainst"].includes(key),
      )
      .sort(
        ([a], [b]) =>
          (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) -
          (order.indexOf(b) < 0 ? 99 : order.indexOf(b)),
      )
      .map(([key, value]) => ({
        key,
        label: value.label,
        home: String(player?.stats?.[key]?.display ?? player?.stats?.[key]?.value ?? "—"),
        away: opponent ? String(opponent.stats?.[key]?.display ?? opponent.stats?.[key]?.value ?? '—') : "",
      }));
  }
  const home =
      (match
        ? report.teamStats.find((t) => t.teamId === match.homeId)
        : report.teamStats[0]
      )?.stats || {},
    away =
      (match
        ? report.teamStats.find((t) => t.teamId === match.awayId)
        : report.teamStats[1]
      )?.stats || {};
  return [...new Set([...Object.keys(home), ...Object.keys(away)])]
    .sort(
      (a, b) =>
        (priorities.indexOf(a) < 0 ? 99 : priorities.indexOf(a)) -
        (priorities.indexOf(b) < 0 ? 99 : priorities.indexOf(b)),
    )
    .map((key) => ({
      key,
      label: home[key]?.label || away[key]?.label || key,
      home: formatMatchStat(home, key),
      away: formatMatchStat(away, key),
    }));
}
