import { describe, expect, it } from "vitest";
import { parseCareer } from "../lib/career-stats.js";
import {
  matchDigest,
  playerReportCSV,
  reportCoverage,
  statCardRows,
} from "../src/football/reportTools";
import { buildStillSequence } from "../src/studio/stillSequence";
import { emptyStudio } from "../src/studio/types";
import { frameAt, newBoard, catalogueWithBoardTeams } from "../src/core";
import { makeCue, cueBoard } from "../src/studio/cueModel";
import type { Match, MatchDetails, Team } from "../src/types";
import type { MediaAsset } from "../src/studio/types";
const club = (id: string): Team => ({
  id,
  name: `Club ${id}`,
  shortName: id,
  abbreviation: id,
  color: "#123456",
  alternateColor: "#ffffff",
  competitions: ["eng.1"],
  players: [],
});
const match: Match = {
  id: "1",
  name: "Home v Away",
  league: "eng.1",
  date: "2025-10-01",
  homeId: "h",
  awayId: "a",
  homeName: "Home",
  awayName: "Away",
  homeScore: "0",
  awayScore: "2",
  completed: true,
  status: "Full Time",
  sourceUrl: "https://www.espn.com/",
};
const details: MatchDetails = {
  id: "1",
  lineups: [
    {
      teamId: "h",
      side: "home",
      players: [
        {
          id: "p",
          name: "Player",
          starter: true,
          stats: { totalGoals: { label: "Goals", value: 0, display: "0" } },
        },
      ],
    },
  ],
  teamStats: [
    { teamId: "a", stats: { totalShots: { label: "Shots", display: "14" } } },
  ],
  events: [],
};
describe("verified football records", () => {
  const table = (rows = 2) =>
    `<table><thead><tr><th>season</th><th>Team</th></tr></thead><tbody><tr><td>2026-27 UEFA Champions League</td><td><a href="/soccer/team/_/id/1/example">ONE</a></td></tr><tr><td>2025-26 UEFA Champions League</td><td><a href="/soccer/team/_/id/2/example">TWO</a></td></tr></tbody></table><table><thead><tr><th title="Goals">G</th><th>A</th><th>STRT</th></tr></thead><tbody><tr><td>0</td><td>—</td><td>4</td></tr>${rows === 2 ? "<tr><td>7</td><td>3</td><td>9</td></tr>" : ""}</tbody></table>`;
  it("joins published career rows by aligned season/team tables and keeps zero distinct from missing", () => {
    const career = parseCareer(table(), "uefa.champions", "9");
    expect(career.seasons).toHaveLength(2);
    expect(career.seasons[0].stats.totalGoals.value).toBe(0);
    expect(career.seasons[0].stats.goalAssists).toBeUndefined();
    expect(career.seasons[1].teamId).toBe("2");
    expect(career.seasons[1].stats.starts.value).toBe(9);
    expect(parseCareer(table(), "eng.1", "9").seasons).toEqual([]);
    expect(parseCareer(table(1), "uefa.champions", "9").seasons).toEqual([]);
  });
  it("does not put the away team's only supplied data in the home column", () => {
    const rows = statCardRows(details, undefined, match);
    expect(rows[0]).toMatchObject({ home: "—", away: "14" });
    expect(statCardRows(details, "p", match)[0].home).toBe("0");
  });
  it("creates factual summaries and coverage without inventing absent figures", () => {
    expect(matchDigest(match, details)).toEqual([
      "Home 0–2 Away at full time.",
    ]);
    expect(reportCoverage(details)).toMatchObject({
      teams: 1,
      teamFields: 1,
      lineups: 0,
      players: 1,
      playersWithStats: 1,
    });
    expect(
      matchDigest({ ...match, completed: false, state: "pre" }, details),
    ).toEqual([]);
  });
  it("exports player rows with all supplied stat columns and neutralises spreadsheet formulas", () => {
    const copy = structuredClone(details);
    copy.lineups[0].players[0].name = '=HYPERLINK("bad")';
    const csv = playerReportCSV(match, copy);
    expect(csv).toContain('"Goals"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"0"');
  });
});
describe("still reconstruction and cross-match cues", () => {
  function setup() {
    const desk = emptyStudio(),
      assets: MediaAsset[] = [];
    for (let i = 0; i < 2; i++) {
      const id = "still-" + i;
      assets.push({
        id,
        name: id,
        type: "image",
        mime: "image/png",
        size: 1,
        width: 100,
        height: 100,
        duration: 0,
        fps: 25,
        createdAt: "",
        thumbnail: "",
      });
      desk.tracking[id] = {
        assetId: id,
        start: 0,
        end: 1,
        reviewed: true,
        method: "manual",
        createdAt: "",
        targets: [
          {
            id: "target-" + i,
            name: "Confirmed Player",
            playerId: "real-1",
            number: "7",
            side: "home",
            image: { x: 0.5, y: 0.5 },
          },
        ],
        frames: [
          {
            time: 0,
            cameraConfidence: 1,
            points: [
              {
                id: "target-" + i,
                image: { x: 0.5, y: 0.5 },
                pitch: { x: 0.2 + i * 0.4, y: 0.5 },
                confidence: 1,
                review: false,
              },
            ],
          },
        ],
      };
    }
    return { desk, assets };
  }
  it("links confirmed identities across differently numbered source markers and preserves the original stills", () => {
    const { desk, assets } = setup(),
      scenes = buildStillSequence(
        assets.map((a) => a.id),
        assets,
        desk,
        2,
      );
    expect(scenes[0].players[0].uid).toBe(scenes[1].players[0].uid);
    expect(scenes.map((s) => s.source!.assetId)).toEqual([
      "still-0",
      "still-1",
    ]);
    const b = newBoard(club("h"), club("a"));
    b.scenes = scenes;
    expect(frameAt(b, 1).players[0].x).toBeCloseTo(0.4);
    desk.tracking["still-1"].reviewed = false;
    expect(() =>
      buildStillSequence(
        assets.map((a) => a.id),
        assets,
        desk,
        2,
      ),
    ).toThrow("review");
  });
  it("rejects unassigned identities instead of guessing which person is the same player", () => {
    const { desk, assets } = setup();
    desk.tracking["still-1"].targets[0].playerId = undefined;
    expect(() =>
      buildStillSequence(
        assets.map((a) => a.id),
        assets,
        desk,
        2,
      ),
    ).toThrow("identity");
  });
  it("restores match/team context and brings archived club labels back without a current squad substitution", () => {
    const original = newBoard(club("historic-home"), club("historic-away"));
    original.match = {
      ...match,
      homeId: "historic-home",
      awayId: "historic-away",
    };
    const cue = makeCue(original, "board", "broadcast", 0),
      current = newBoard(club("current-home"), club("current-away"));
    current.studio!.cues = [cue];
    const recalled = cueBoard(current, cue);
    expect(recalled.homeTeamId).toBe("historic-home");
    expect(recalled.match?.id).toBe("1");
    const catalogue = {
      teams: [club("current-home"), club("current-away")],
    } as any;
    const restored = catalogueWithBoardTeams(catalogue, recalled);
    expect(restored.teams.find((t) => t.id === "historic-home")?.name).toBe(
      "Club historic-home",
    );
    expect(restored.teams.find((t) => t.id === "historic-home")?.archived).toBe(
      true,
    );
  });
});
