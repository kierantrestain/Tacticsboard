import { load } from "cheerio";
const labels = {
  STRT: ["starts", "Starts"],
  G: ["totalGoals", "Goals"],
  A: ["goalAssists", "Assists"],
  SHOT: ["totalShots", "Shots"],
  SOG: ["shotsOnTarget", "Shots on target"],
  FC: ["foulsCommitted", "Fouls committed"],
  FA: ["foulsSuffered", "Fouls suffered"],
  YC: ["yellowCards", "Yellow cards"],
  RC: ["redCards", "Red cards"],
  OFF: ["offsides", "Offsides"],
  APP: ["appearances", "Appearances"],
  MIN: ["minutesPlayed", "Minutes"],
  SV: ["saves", "Saves"],
  GA: ["goalsAgainst", "Goals conceded"],
  CS: ["cleanSheets", "Clean sheets"],
};
/** Read paired, published season/team and statistics tables. Never align unequal rows. */
export function parseCareer(html, league, playerId) {
  const $ = load(html),
    tables = $("table").toArray(),
    records = new Map();
  for (let i = 0; i < tables.length - 1; i++) {
    const headers = $(tables[i])
      .find("thead th")
      .map((_, e) => $(e).text().trim().toLowerCase())
      .get();
    if (!headers.includes("season") || !headers.includes("team")) continue;
    const left = $(tables[i]).find("tbody tr").toArray(),
      right = $(tables[i + 1])
        .find("tbody tr")
        .toArray();
    const metrics = $(tables[i + 1])
      .find("thead th")
      .map((_, e) => ({
        key: $(e).text().trim(),
        label: $(e).attr("title") || $(e).text().trim(),
      }))
      .get();
    if (!left.length || left.length !== right.length || !metrics.length)
      continue;
    left.forEach((row, n) => {
      const cells = $(row).children("td"),
        name = cells.first().text().trim(),
        season = name.match(/\b((?:19|20)\d{2})[-/](\d{2,4})\b/);
      if (!season) return;
      // A requested competition must also be present in the published row.
      if (league === "eng.1" && !/Premier League/i.test(name)) return;
      if (league === "uefa.champions" && !/Champions League/i.test(name))
        return;
      const club = cells.eq(headers.indexOf("team")),
        href = club.find("a").attr("href") || "",
        teamId = href.match(/\/id\/(\d+)/)?.[1],
        team = club.find("a").first().text().trim() || club.text().trim();
      const values = $(right[n])
        .children("td")
        .map((_, e) => $(e).text().trim())
        .get();
      if (values.length !== metrics.length) return;
      const key = season[1] + ":" + (teamId || team),
        prior = records.get(key) || {
          seasonYear: Number(season[1]),
          season: season[1] + "-" + season[2],
          teamId,
          team,
          stats: {},
        };
      values.forEach((display, j) => {
        const m = metrics[j],
          known = labels[m.key],
          key = known?.[0] || m.key,
          label = known?.[1] || m.label;
        if (display !== "" && display !== "-" && display !== "—")
          prior.stats[key] = {
            label,
            display,
            value: /^-?\d+(\.\d+)?$/.test(display) ? Number(display) : null,
          };
      });
      records.set(key, prior);
    });
  }
  return {
    playerId,
    league,
    updatedAt: new Date().toISOString(),
    sourceUrl: `https://www.espn.com/soccer/player/stats/_/id/${playerId}/type/${league}`,
    seasons: [...records.values()].sort((a, b) => b.seasonYear - a.seasonYear),
  };
}
