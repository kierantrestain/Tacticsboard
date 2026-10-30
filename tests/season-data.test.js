import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  normaliseFPL,
  normalisePlayerHistory,
} from "../lib/football-normalizers.js";
const read = (p) =>
  JSON.parse(
    readFileSync(new URL("../public/data/" + p, import.meta.url), "utf8"),
  );
const c = read("catalogue.json"),
  s = read("season.json");
describe("complete season data", () => {
  it("has every PL home/away fixture and all 38 gameweeks without duplicates", () => {
    const ms = s.fixtures.filter((m) => m.league === "eng.1");
    expect(ms).toHaveLength(380);
    expect(new Set(ms.map((m) => m.id)).size).toBe(380);
    expect(new Set(ms.map((m) => m.matchweek)).size).toBe(38);
    for (const team of c.teams.filter((t) =>
      t.competitions.includes("eng.1"),
    )) {
      expect(ms.filter((m) => m.homeId === team.id)).toHaveLength(19);
      expect(ms.filter((m) => m.awayId === team.id)).toHaveLength(19);
    }
    for (let w = 1; w <= 38; w++)
      expect(ms.filter((m) => m.matchweek === w)).toHaveLength(10);
  });
  it("has 144 UCL league-phase games, eight per club, and an actual source crest for every club", () => {
    const ms = s.fixtures.filter((m) => m.league === "uefa.champions");
    expect(ms).toHaveLength(144);
    for (const team of c.teams) {
      expect(team.badgeUrl).toMatch(/^https:\/\/a\.espncdn\.com\//);
      if (team.competitions.includes("uefa.champions"))
        expect(
          ms.filter((m) => m.homeId === team.id || m.awayId === team.id),
        ).toHaveLength(8);
    }
    expect(s.standings["eng.1"].groups[0].entries).toHaveLength(20);
    expect(s.standings["uefa.champions"].groups[0].entries).toHaveLength(36);
  });
  it("preserves individual statistics in a complete archive for every finished game", () => {
    const finished = s.fixtures.filter((m) => m.completed);
    expect(finished).toHaveLength(134);
    for (const m of finished) {
      expect(
        existsSync(
          new URL("../public/data/reports/" + m.id + ".json", import.meta.url),
        ),
      ).toBe(true);
      const d = read("reports/" + m.id + ".json");
      expect(d.lineups).toHaveLength(2);
      expect(d.teamStats).toHaveLength(2);
      expect(
        d.lineups
          .flatMap((l) => l.players)
          .some((p) => Object.keys(p.stats).length > 5),
      ).toBe(true);
    }
  });
});
describe("public player/fixture source boundaries", () => {
  it("uses official FPL gameweek IDs, keeps zero and does not invent missing metrics", () => {
    const result = normaliseFPL(
      {
        events: [{ id: 9, deadline_time: "2026-10-31T11:00Z" }],
        teams: [],
        elements: [
          {
            id: 1,
            team: 1,
            first_name: "Known",
            second_name: "Player",
            goals_scored: 0,
            expected_goals: "0.00",
          },
        ],
      },
      [
        {
          id: 9,
          event: 9,
          team_h: 1,
          team_a: 2,
          kickoff_time: null,
          finished: false,
          team_h_score: null,
          team_a_score: null,
        },
      ],
      {
        teams: [
          { id: "a", fplId: 1, name: "A", shortName: "A" },
          { id: "b", fplId: 2, name: "B", shortName: "B" },
        ],
        fixtures: [],
      },
    );
    expect(result.fixtures[0].matchweek).toBe(9);
    expect(result.fixtures[0].date).toBe("");
    expect(result.fixtures[0].homeScore).toBeNull();
    expect(result.players[0].stats.goals_scored.value).toBe(0);
    expect(result.players[0].stats.expected_goals.display).toBe("0.00");
    expect(result.players[0].stats.expected_assists).toBeUndefined();
  });
  it("keeps player match logs keyed to source fixture IDs and separate from season aggregates", () => {
    const r = normalisePlayerHistory({
      history: [
        {
          fixture: 42,
          round: 8,
          minutes: 90,
          assists: 0,
          expected_assists: "0.35",
        },
      ],
      history_past: [{ season_name: "2025/26", minutes: 2000 }],
    });
    expect(r.history[0].fixtureId).toBe(42);
    expect(r.history[0].stats.assists.label).toBe("FPL assists");
    expect(r.pastSeasons[0].stats.minutes.value).toBe(2000);
  });
});
