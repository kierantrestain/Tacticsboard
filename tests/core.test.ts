import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  arrangeXI,
  formatMatchStat,
  formationPoints,
  FORMATIONS,
  newBoard,
  makePlayers,
  frameAt,
  syncScene,
  isBoard,
  copy,
  totalDuration,
} from "../src/core";
import type { Catalogue, MatchDetails } from "../src/types";
const catalogue: Catalogue = JSON.parse(
  readFileSync(
    new URL("../public/data/catalogue.json", import.meta.url),
    "utf8",
  ),
);
const summaries: Record<string, MatchDetails> = JSON.parse(
  readFileSync(new URL("../public/data/matches.json", import.meta.url), "utf8"),
);
const arsenal = catalogue.teams.find((t) => t.id === "359")!,
  everton = catalogue.teams.find((t) => t.id === "368")!;

describe("catalogue integrity", () => {
  it("contains every competition member, deduplicates overlapping clubs and keeps complete squads", () => {
    expect(catalogue.teams).toHaveLength(51);
    expect(
      catalogue.teams.filter((t) => t.competitions.includes("eng.1")),
    ).toHaveLength(20);
    expect(
      catalogue.teams.filter((t) => t.competitions.includes("uefa.champions")),
    ).toHaveLength(36);
    expect(new Set(catalogue.teams.map((t) => t.id)).size).toBe(51);
    expect(catalogue.teams.reduce((n, t) => n + t.players.length, 0)).toBe(
      1609,
    );
    for (const team of catalogue.teams) {
      expect(team.players.length).toBeGreaterThanOrEqual(11);
      expect(new Set(team.players.map((p) => p.id)).size).toBe(
        team.players.length,
      );
      expect(team.manager?.name).toBeTruthy();
      expect(team.manager?.sourceUrl).toMatch(/^https:/);
      for (const p of team.players)
        for (const scope of Object.keys(p.statsByCompetition))
          expect(team.competitions).toContain(scope);
    }
    expect(catalogue.quality.issues).toEqual([]);
  });
  it("takes manager changes from independently checked sources", () => {
    expect(arsenal.manager?.name).not.toBe("Arsène Wenger");
    expect(
      catalogue.teams.find((t) => t.name === "Fenerbahce")?.manager?.name,
    ).toBe("Dirk Kuyt");
  });
});
describe("formation and confirmed lineup mapping", () => {
  it.each(FORMATIONS)(
    "%s has one keeper, ten outfield slots and mirrored opponents",
    (formation) => {
      const a = formationPoints(formation, "home"),
        b = formationPoints(formation, "away");
      expect(a).toHaveLength(11);
      for (let i = 0; i < 11; i++) {
        expect(a[i].x).toBeGreaterThan(0);
        expect(a[i].x).toBeLessThan(0.5);
        expect(a[i].x + b[i].x).toBeCloseTo(1);
        expect(a[i].y + b[i].y).toBeCloseTo(1);
      }
    },
  );
  it("does not mistake ESPN formation identifiers for spatial order", () => {
    const line = summaries["401878768"].lineups.find(
      (l) => l.teamId === arsenal.id,
    )!;
    const ordered = arrangeXI(line.players.filter((p) => p.starter));
    expect(ordered.map((p) => p.positionCode)).toEqual([
      "G",
      "LB",
      "CD-L",
      "CD-R",
      "RB",
      "LM",
      "RM",
      "AM-L",
      "AM",
      "AM-R",
      "F",
    ]);
    const markers = makePlayers(arsenal, "home", "4-2-3-1", line);
    expect(markers).toHaveLength(11);
    expect(markers[1].name).toBe("Myles Lewis-Skelly");
    expect(markers[10].name).toBe("Viktor Gyökeres");
    expect(markers.slice(1, 5).every((p) => p.x === markers[1].x)).toBe(true);
  });
  it("uses a safe 4-3-3 template for malformed formations", () => {
    expect(formationPoints("99-1", "home")).toEqual(
      formationPoints("4-3-3", "home"),
    );
  });
});
describe("storyboard animation and portable documents", () => {
  it("interpolates stable player identities and the ball without changing stored keyframes", () => {
    const b = newBoard(arsenal, everton);
    const first = copy(b.scenes[0]);
    const next = copy(first);
    next.id = "next";
    next.players[0].x += 0.3;
    next.ball.x = 0.8;
    b.scenes.push(next);
    expect(frameAt(b, 0).players[0].x).toBe(first.players[0].x);
    expect(frameAt(b, 1.5).players[0].x).toBeCloseTo(first.players[0].x + 0.15);
    expect(frameAt(b, 1.5).ball.x).toBeCloseTo(0.65);
    expect(frameAt(b, totalDuration(b)).players[0].x).toBe(next.players[0].x);
    expect(b.scenes[0]).toEqual(first);
  });
  it("synchronises only the active phase", () => {
    const b = newBoard(arsenal, everton);
    b.players[0].x = 0.2;
    syncScene(b);
    expect(b.scenes[0].players[0].x).toBe(0.2);
  });
  it("accepts exported documents and rejects corrupt or unsafe imports", () => {
    const b = newBoard(arsenal, everton);
    expect(isBoard(JSON.parse(JSON.stringify(b)))).toBe(true);
    for (const change of [
      (x: any) => (x.players[0].x = Infinity),
      (x: any) => (x.scenes = []),
      (x: any) => (x.activeScene = "missing"),
      (x: any) => delete x.managerNotes,
      (x: any) => (x.settings.names = "yes"),
      (x: any) => (x.colors.home = "javascript:bad"),
      (x: any) => (x.scenes[0].duration = -1),
    ]) {
      const bad = copy(b);
      change(bad);
      expect(isBoard(bad)).toBe(false);
    }
  });
});

describe("match statistic presentation", () => {
  it("calculates percentages from counts instead of presenting a rounded source ratio as a percent", () => {
    const stats = {
      accuratePasses: { display: "440", label: "Accurate passes" },
      totalPasses: { display: "508", label: "Passes" },
      passPct: { display: "0.9", label: "Pass completion %" },
      possessionPct: { display: "58", label: "Possession" },
    };
    expect(formatMatchStat(stats, "passPct")).toBe("86.6%");
    expect(formatMatchStat(stats, "possessionPct")).toBe("58%");
    expect(formatMatchStat({}, "passPct")).toBe("—");
  });
});
