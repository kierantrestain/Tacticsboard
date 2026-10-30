import {
  normaliseFPL,
  normaliseStandings,
  normalisePlayerHistory,
} from "../lib/football-normalizers.js";
import clubIndex from "../public/data/club-index.json" with { type: "json" };
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const LEAGUES = new Set(["eng.1", "uefa.champions"]);
const string = (v) => (typeof v === "string" ? v : "");
function statsOf(a) {
  return Object.fromEntries(
    (a.statistics?.splits?.categories || []).flatMap((c) =>
      (c.stats || []).map((s) => [
        s.name,
        {
          value: s.value ?? null,
          display: s.displayValue,
          label: s.displayName || s.name,
        },
      ]),
    ),
  );
}
function player(a, league) {
  return {
    id: String(a.id),
    name: a.displayName || a.fullName,
    shortName: a.shortName,
    firstName: a.firstName,
    lastName: a.lastName,
    number: a.jersey || null,
    position: a.position?.displayName,
    positionCode: a.position?.abbreviation,
    nationality: a.citizenship,
    dateOfBirth: a.dateOfBirth,
    heightCm: a.height ? Math.round(a.height * 2.54) : null,
    weightKg: a.weight ? Math.round(a.weight / 2.20462) : null,
    birthPlace: a.birthPlace,
    statsByCompetition: { [league]: statsOf(a) },
    sourceUrl: a.links?.find((l) => l.rel?.includes("playercard"))?.href,
  };
}
export function normaliseSummary(d, id) {
  const info = d.gameInfo || {},
    competition = d.header?.competitions?.[0],
    st = competition?.status?.type || {};
  return {
    id,
    updatedAt: new Date().toISOString(),
    state: st.state,
    status: st.description,
    clock: competition?.status?.displayClock,
    attendance: info.attendance ?? null,
    venue: info.venue?.fullName,
    officials: (info.officials || []).map((o) => ({
      name: o.displayName || o.fullName,
      role: o.position?.displayName,
    })),
    score: competition?.competitors?.map((t) => ({
      teamId: String(t.id),
      score: typeof t.score === "object" ? t.score.displayValue : t.score,
    })),
    commentary: (d.commentary || [])
      .filter((c) => c.text)
      .map((c) => ({
        minute: c.time?.displayValue || c.clock?.displayValue,
        text: c.text,
      })),
    lineups: (d.rosters || []).map((r) => ({
      teamId: String(r.team?.id),
      side: r.homeAway,
      formation:
        typeof r.formation === "object" ? r.formation.displayName : r.formation,
      players: (r.roster || [])
        .filter((a) => a.athlete?.id)
        .map((a) => ({
          id: String(a.athlete.id),
          name: a.athlete.displayName,
          number: a.jersey,
          starter: !!a.starter,
          formationPlace: a.formationPlace,
          subbedIn: !!a.subbedIn,
          subbedOut: !!a.subbedOut,
          stats: Object.fromEntries(
            (a.stats || []).map((s) => [
              s.name,
              {
                label: s.displayName || s.name,
                value: s.value,
                display: s.displayValue,
              },
            ]),
          ),
          position: a.position?.displayName,
          positionCode: a.position?.abbreviation,
        })),
    })),
    teamStats: (d.boxscore?.teams || []).map((t) => ({
      teamId: String(t.team?.id),
      stats: Object.fromEntries(
        (t.statistics || []).map((s) => [
          s.name,
          { display: s.displayValue, label: s.label || s.name },
        ]),
      ),
    })),
    events: (d.keyEvents || [])
      .filter((e) => e.text)
      .map((e) => ({
        minute: e.clock?.displayValue,
        text: e.text,
        type: e.type?.text,
      })),
    sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${id}`,
  };
}
export function normaliseEvent(e, league) {
  const c = e.competitions?.[0],
    home = c?.competitors?.find((t) => t.homeAway === "home"),
    away = c?.competitors?.find((t) => t.homeAway === "away");
  if (!home || !away) return null;
  const score = (t) =>
    typeof t.score === "object" ? t.score?.displayValue : (t.score ?? null);
  const st = c.status?.type || e.status?.type || {};
  return {
    id: String(e.id),
    league,
    date: e.date,
    name: e.name,
    homeId: String(home.id),
    awayId: String(away.id),
    homeName: home.team?.displayName,
    awayName: away.team?.displayName,
    homeScore: score(home),
    awayScore: score(away),
    state: st.state,
    stage: e.seasonType?.name || e.season?.slug,
    status: st.description || "Scheduled",
    completed: !!st.completed,
    venue: c.venue?.fullName,
    sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${e.id}`,
  };
}
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost"),
    q = req.query || Object.fromEntries(url.searchParams),
    action = string(q.action),
    league = string(q.league) || "eng.1";
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ error: "GET requests only" }));
    return;
  }
  if (!LEAGUES.has(league)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Unsupported competition" }));
    return;
  }
  let path;
  const season = string(q.season) || "2026";
  if (!/^20\d{2}$/.test(season)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid season" }));
    return;
  }
  if (action === "season") path = "fpl-season";
  else if (action === "standings") path = "table";
  else if (action === "player" && /^\d{1,5}$/.test(string(q.player)))
    path = "fpl-player";
  else if (
    action === "summary" &&
    /^fpl-\d{1,5}$/.test(string(q.event)) &&
    clubIndex.fixtures.some((m) => m.id === q.event)
  )
    path = "fpl-report";
  else if (action === "summary" && /^\d{1,12}$/.test(string(q.event)))
    path = `${league}/summary?event=${q.event}`;
  else if (
    action === "roster" &&
    /^\d{1,9}$/.test(string(q.team)) &&
    /^20\d{2}$/.test(string(q.season) || "2026")
  )
    path = `${league}/teams/${q.team}/roster?season=${q.season || "2026"}`;
  else if (action === "fixtures" && /^20\d{6}$/.test(string(q.date)))
    path = `${league}/scoreboard?dates=${q.date}`;
  else {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: "A supported action and valid identifiers are required",
      }),
    );
    return;
  }
  try {
    const getJSON = async (url) => {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(9000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw Error("Source unavailable");
      return r.json();
    };
    let special;
    if (path === "fpl-season") {
      const [b, f] = await Promise.all([
        getJSON("https://fantasy.premierleague.com/api/bootstrap-static/"),
        getJSON("https://fantasy.premierleague.com/api/fixtures/"),
      ]);
      special = normaliseFPL(b, f, clubIndex);
      if (special.seasonYear !== Number(season)) throw Error("Season mismatch");
    } else if (path === "table")
      special = normaliseStandings(
        await getJSON(
          `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${season}`,
        ),
      );
    else if (path === "fpl-player")
      special = normalisePlayerHistory(
        await getJSON(
          `https://fantasy.premierleague.com/api/element-summary/${q.player}/`,
        ),
      );
    else if (path === "fpl-report") {
      const m = clubIndex.fixtures.find((m) => m.id === q.event),
        date = /^20\d{6}$/.test(string(q.date))
          ? q.date
          : m.date.slice(0, 10).replaceAll("-", "");
      const day = await getJSON(BASE + "eng.1/scoreboard?dates=" + date),
        event = (day.events || [])
          .map((e) => normaliseEvent(e, "eng.1"))
          .find((e) => e?.homeId === m.homeId && e?.awayId === m.awayId);
      special = event
        ? {
            ...normaliseSummary(
              await getJSON(BASE + "eng.1/summary?event=" + event.id),
              q.event,
            ),
            sourceUrl: event.sourceUrl,
            match: { ...m, ...event, id: q.event, fplId: m.fplId },
          }
        : {
            id: q.event,
            lineups: [],
            teamStats: [],
            events: [],
            commentary: [],
            updatedAt: new Date().toISOString(),
          };
    }
    if (special) {
      res.statusCode = 200;
      res.setHeader(
        "Cache-Control",
        `public, s-maxage=${action === "summary" ? 30 : 120}, stale-while-revalidate=60`,
      );
      res.end(JSON.stringify(special));
      return;
    }
    const upstream = await fetch(BASE + path, {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) throw new Error("Source unavailable");
    const d = await upstream.json();
    let result;
    if (action === "summary") result = normaliseSummary(d, string(q.event));
    else if (action === "roster") {
      if (d.season?.year !== Number(q.season || 2026))
        throw new Error("Season mismatch");
      result = {
        players: (d.athletes || [])
          .filter((a) => a.id)
          .map((a) => player(a, league)),
        updatedAt: d.timestamp || new Date().toISOString(),
        season: d.season,
      };
    } else
      result = {
        matches: (d.events || [])
          .map((e) => normaliseEvent(e, league))
          .filter(Boolean),
        updatedAt: new Date().toISOString(),
      };
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${action === "summary" || action === "fixtures" ? 30 : 900}, stale-while-revalidate=60`,
    );
    res.end(JSON.stringify(result));
  } catch {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "The football source is temporarily unavailable. The saved catalogue remains available.",
      }),
    );
  }
}
