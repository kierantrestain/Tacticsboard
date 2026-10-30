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
  return {
    id,
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
function normaliseEvent(e, league) {
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
  if (action === "summary" && /^\d{1,12}$/.test(string(q.event)))
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
      "public, s-maxage=900, stale-while-revalidate=86400",
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
