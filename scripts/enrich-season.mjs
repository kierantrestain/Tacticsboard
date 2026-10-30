import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import {
  normaliseFPL,
  normaliseStandings,
} from "../lib/football-normalizers.js";
import { normaliseSummary, normaliseEvent } from "../api/football.js";
const root = new URL("../", import.meta.url),
  cache = new URL("data-cache/final-pass/", root),
  out = new URL("public/data/", root);
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const cat = await read(new URL("catalogue.json", out)),
  b = await read(new URL("fpl-bootstrap.json", cache)),
  f = await read(new URL("fpl-fixtures.json", cache)),
  now = new Date().toISOString();
if (Number(b.events[0].deadline_time.slice(0, 4)) !== cat.seasonYear)
  throw Error("FPL season mismatch");
const canon = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const rawTeams = new Map();
for (const name of ["pl-teams", "ucl-teams"])
  for (const sport of (await read(new URL(name + ".json", cache))).sports || [])
    for (const league of sport.leagues || [])
      for (const { team: t } of league.teams || [])
        rawTeams.set(String(t.id), t);
for (const team of cat.teams) {
  const raw = rawTeams.get(team.id);
  team.badgeUrl =
    raw?.logos?.find((l) => l.rel?.includes("default"))?.href ||
    raw?.logos?.[0]?.href;
  if (!team.badgeUrl) throw Error("Missing crest for " + team.name);
  const ft = team.competitions.includes("eng.1")
    ? b.teams.find((t) =>
        [team.name, team.shortName].some((n) => canon(n) === canon(t.name)),
      )
    : undefined;
  if (team.competitions.includes("eng.1") && !ft)
    throw Error("Unmapped PL club " + team.name);
  if (ft) team.fplId = ft.id;
  const existing = new Map(team.players.map((p) => [p.id, p]));
  for (const league of team.competitions) {
    const r = await read(new URL(`roster-${league}-${team.id}.json`, cache));
    if (r.season?.year !== cat.seasonYear)
      throw Error("Roster season mismatch");
    for (const a of r.athletes || []) {
      if (!a.id) continue;
      const old = existing.get(String(a.id));
      const stats = Object.fromEntries(
        (a.statistics?.splits?.categories || []).flatMap((c) =>
          (c.stats || []).map((s) => [
            s.name,
            {
              label: s.displayName || s.name,
              value: s.value ?? null,
              display: s.displayValue,
            },
          ]),
        ),
      );
      if (old) {
        old.statsByCompetition[league] = stats;
        old.number = a.jersey ?? old.number;
      } else {
        const p = {
          id: String(a.id),
          name: a.displayName || a.fullName,
          shortName: a.shortName,
          firstName: a.firstName,
          lastName: a.lastName,
          number: a.jersey,
          position: a.position?.displayName,
          positionCode: a.position?.abbreviation,
          nationality: a.citizenship,
          dateOfBirth: a.dateOfBirth,
          heightCm: a.height ? Math.round(a.height * 2.54) : null,
          weightKg: a.weight ? Math.round(a.weight / 2.20462) : null,
          statsByCompetition: { [league]: stats },
        };
        team.players.push(p);
        existing.set(p.id, p);
      }
    }
    team.rosterUpdatedAt = r.timestamp;
    team.rosterCheckedAt = now;
  }
  if (ft)
    for (const p of team.players) {
      const candidates = b.elements.filter(
        (e) =>
          e.team === ft.id &&
          ((p.dateOfBirth && e.birth_date === p.dateOfBirth.slice(0, 10)) ||
            canon(p.name) === canon(e.first_name + " " + e.second_name)),
      );
      if (candidates.length === 1) p.fplId = candidates[0].id;
    }
}
const original = await read(new URL("old-catalogue.json", cache)).catch(
  () => cat,
);
const byPair = new Map(
  original.matches.map((m) => [[m.league, m.homeId, m.awayId].join(":"), m]),
);
const index = {
  teams: cat.teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    fplId: t.fplId,
    badgeUrl: t.badgeUrl,
  })),
  fixtures: cat.matches,
};
const live = normaliseFPL(b, f, index);
for (const m of live.fixtures) {
  const old = byPair.get([m.league, m.homeId, m.awayId].join(":"));
  if (old) {
    m.id = old.id;
    m.sourceUrl = old.sourceUrl;
    m.venue = old.venue;
  }
}
// Resolve newly completed FPL fixtures against the public matchday IDs.
const unresolved = live.fixtures.filter(
  (m) => m.completed && m.id.startsWith("fpl-"),
);
for (const date of [...new Set(unresolved.map((m) => m.date.slice(0, 10)))]) {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=" +
        date.replaceAll("-", ""),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) continue;
    const day = await response.json();
    const events = (day.events || [])
      .map((e) => normaliseEvent(e, "eng.1"))
      .filter(Boolean);
    for (const m of unresolved.filter((m) => m.date.startsWith(date))) {
      const event = events.find(
        (e) => e.homeId === m.homeId && e.awayId === m.awayId,
      );
      if (event) {
        m.id = event.id;
        m.sourceUrl = event.sourceUrl;
        m.venue = event.venue;
      }
    }
  } catch {}
}
const { readdir } = await import("node:fs/promises");
const ucl = new Map();
for (const name of (await readdir(cache)).filter((n) => /^ucl-day-/.test(n)))
  for (const e of (await read(new URL(name, cache))).events || []) {
    const m = normaliseEvent(e, "uefa.champions");
    if (
      m &&
      cat.teams.some((t) => t.id === m.homeId) &&
      cat.teams.some((t) => t.id === m.awayId)
    )
      ucl.set(m.id, m);
  }
const dates = [
  ...new Set([...ucl.values()].map((m) => m.date.slice(0, 10))),
].sort();
let round = 0,
  last = "";
const rounds = new Map();
for (const date of dates) {
  if (!last || new Date(date) - new Date(last) > 3 * 86400000) round++;
  rounds.set(date, round);
  last = date;
}
for (const m of ucl.values()) {
  m.matchweek = rounds.get(m.date.slice(0, 10));
  m.stage = "League phase";
}
cat.matches = [...live.fixtures, ...ucl.values()].sort((a, b) =>
  a.date.localeCompare(b.date),
);
if (
  live.fixtures.length !== 380 ||
  new Set(live.fixtures.map((m) => m.matchweek)).size !== 38
)
  throw Error("Premier League coverage incomplete");
if (ucl.size !== 144 || round !== 8)
  throw Error(
    "UCL league phase coverage incomplete: " + ucl.size + "/" + round,
  );
cat.updatedAt = now;
cat.quality.playerCount = cat.teams.reduce((n, t) => n + t.players.length, 0);
index.fixtures = cat.matches.map(
  ({
    id,
    fplId,
    date,
    homeId,
    awayId,
    league,
    matchweek,
    homeName,
    awayName,
    sourceUrl,
  }) => ({
    id,
    fplId,
    date,
    homeId,
    awayId,
    league,
    matchweek,
    homeName,
    awayName,
    sourceUrl,
  }),
);
const standings = {};
for (const [league, name] of [
  ["eng.1", "pl-table"],
  ["uefa.champions", "ucl-table"],
])
  standings[league] = normaliseStandings(
    await read(new URL(name + ".json", cache)),
  );
const snapshot = {
  ...live,
  fixtures: cat.matches,
  standings,
  coverage: {
    pl: 380,
    ucl: 144,
    plMatchweeks: 38,
    uclMatchdays: 8,
    crests: cat.teams.length,
    mappedPlayers: cat.teams.flatMap((t) => t.players).filter((p) => p.fplId)
      .length,
  },
  sources: [
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    "https://fantasy.premierleague.com/api/fixtures/",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/",
  ],
};
await writeFile(new URL("catalogue.json", out), JSON.stringify(cat));
await writeFile(new URL("club-index.json", out), JSON.stringify(index));
await writeFile(new URL("season.json", out), JSON.stringify(snapshot));
await mkdir(new URL("reports/", out), { recursive: true });
const completed = cat.matches.filter(
  (m) => m.completed && !m.id.startsWith("fpl-"),
);
let count = 0;
async function worker() {
  while (completed.length) {
    const m = completed.shift();
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${m.league}/summary?event=${m.id}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) throw Error(response.status);
      const raw = await response.json(),
        report = { ...normaliseSummary(raw, m.id), commentary: [] };
      await writeFile(
        new URL(`reports/${m.id}.json`, out),
        JSON.stringify(report),
      );
      count++;
      if (count % 20 === 0)
        console.log("Archived " + count + " full match reports");
    } catch (e) {
      console.log("Report unavailable", m.id, e.message);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(
  JSON.stringify({
    ...snapshot.coverage,
    players: cat.quality.playerCount,
    reports: count,
    updatedAt: now,
  }),
);
