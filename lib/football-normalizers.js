export const FPL_FIELDS = {
  minutes: "Minutes",
  starts: "Starts",
  goals_scored: "Goals",
  assists: "FPL assists",
  clean_sheets: "Clean sheets",
  goals_conceded: "Goals conceded",
  own_goals: "Own goals",
  penalties_saved: "Penalties saved",
  penalties_missed: "Penalties missed",
  yellow_cards: "Yellow cards",
  red_cards: "Red cards",
  saves: "Saves",
  tackles: "Tackles",
  clearances_blocks_interceptions: "Clearances, blocks & interceptions",
  recoveries: "Ball recoveries",
  defensive_contribution: "Defensive contributions",
  expected_goals: "Expected goals (xG)",
  expected_assists: "Expected assists (xA)",
  expected_goal_involvements: "Expected goal involvements",
  expected_goals_conceded: "Expected goals conceded",
  expected_goals_per_90: "xG per 90",
  expected_assists_per_90: "xA per 90",
  expected_goal_involvements_per_90: "xGI per 90",
  expected_goals_conceded_per_90: "xGC per 90",
  goals_conceded_per_90: "Goals conceded per 90",
  clean_sheets_per_90: "Clean sheets per 90",
  saves_per_90: "Saves per 90",
  starts_per_90: "Starts per 90",
  defensive_contribution_per_90: "Defensive contributions per 90",
};
export function fplStats(p) {
  return Object.fromEntries(
    Object.entries(FPL_FIELDS)
      .filter(([k]) => p[k] !== undefined && p[k] !== null && p[k] !== "")
      .map(([k, label]) => [
        k,
        { label, display: String(p[k]), value: Number(p[k]) },
      ]),
  );
}
export function normaliseFPL(bootstrap, fixtures, index) {
  const teams = bootstrap.teams || [],
    byFpl = new Map(
      index.teams.filter((t) => t.fplId).map((t) => [t.fplId, t]),
    ),
    old = new Map(
      (index.fixtures || []).filter((m) => m.fplId).map((m) => [m.fplId, m]),
    );
  const seasonYear = Number(
    (bootstrap.events?.[0]?.deadline_time || "").slice(0, 4),
  );
  return {
    seasonYear,
    updatedAt: new Date().toISOString(),
    weeks: (bootstrap.events || []).map((w) => ({
      id: w.id,
      name: w.name,
      deadline: w.deadline_time,
      current: w.is_current,
      next: w.is_next,
      finished: w.finished,
    })),
    players: (bootstrap.elements || []).map((p) => ({
      id: p.id,
      teamId: byFpl.get(p.team)?.id,
      name: [p.first_name, p.second_name].join(" "),
      webName: p.web_name,
      dateOfBirth: p.birth_date,
      status: p.status,
      news: p.news,
      stats: fplStats(p),
    })),
    fixtures: fixtures.flatMap((f) => {
      const h = byFpl.get(f.team_h),
        a = byFpl.get(f.team_a),
        prior = old.get(f.id);
      if (!h || !a) return [];
      return [
        {
          ...prior,
          id: prior?.id || "fpl-" + f.id,
          fplId: f.id,
          matchweek: f.event || 0,
          league: "eng.1",
          date: f.kickoff_time || "",
          name: h.shortName + " v " + a.shortName,
          homeId: h.id,
          awayId: a.id,
          homeName: h.name,
          awayName: a.name,
          homeScore: f.team_h_score === null ? null : String(f.team_h_score),
          awayScore: f.team_a_score === null ? null : String(f.team_a_score),
          status: f.finished
            ? "Full Time"
            : f.started
              ? "In Progress"
              : f.kickoff_time
                ? "Scheduled"
                : "Date TBC",
          state: f.finished ? "post" : f.started ? "in" : "pre",
          completed: !!f.finished,
          sourceUrl:
            prior?.sourceUrl || "https://fantasy.premierleague.com/fixtures",
          fplStats: f.stats || [],
        },
      ];
    }),
  };
}
export function normaliseStandings(d) {
  const groups = [];
  const walk = (n) => {
    if (n.standings?.entries)
      groups.push({
        name: n.name || n.standings.displayName,
        entries: n.standings.entries.map((e, i) => ({
          teamId: String(e.team.id),
          rank: i + 1,
          qualification: e.note?.description,
          stats: Object.fromEntries(
            (e.stats || []).map((s) => [
              s.name,
              {
                label: s.displayName || s.name,
                display: s.displayValue,
                value: s.value,
              },
            ]),
          ),
        })),
      });
    for (const c of n.children || []) walk(c);
  };
  walk(d);
  return {
    seasonYear: d.season?.year,
    updatedAt: new Date().toISOString(),
    groups,
  };
}
export function normalisePlayerHistory(d) {
  return {
    updatedAt: new Date().toISOString(),
    history: (d.history || []).map((h) => ({
      fixtureId: h.fixture,
      matchweek: h.round,
      opponentFplId: h.opponent_team,
      home: h.was_home,
      date: h.kickoff_time,
      homeScore: h.team_h_score,
      awayScore: h.team_a_score,
      stats: fplStats(h),
    })),
    pastSeasons: (d.history_past || []).map((h) => ({
      season: h.season_name,
      stats: fplStats(h),
    })),
  };
}
