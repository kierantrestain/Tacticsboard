import { describe, expect, it } from "vitest";
import { newBoard, copy, isBoard, activeSceneTime, frameAt } from "../src/core";
import {
  applyPreset,
  analysisFrame,
  shiftUnit,
  TACTICAL_PRESETS,
} from "../src/studio/tactics";
import { cueBoard, makeCue } from "../src/studio/cueModel";
import { defaultBroadcast } from "../src/studio/types";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
const board = () =>
  newBoard(
    catalogue.teams[0] as unknown as Team,
    catalogue.teams[1] as unknown as Team,
  );
describe("show preparation and recall", () => {
  it("recalls the saved frame and camera data without overwriting the rundown or shared sources", () => {
    const b = board();
    b.studio!.assetId = "match-clip";
    b.studio!.trim = { start: 2, end: 11 };
    b.studio!.ink["match-clip"] = [
      {
        id: "pass",
        assetId: "match-clip",
        type: "arrow",
        points: [0.2, 0.3, 0.5, 0.6],
        color: "#ffffff",
        width: 4,
        opacity: 1,
        from: 2,
        to: 8,
      },
    ];
    b.studio!.broadcast = defaultBroadcast();
    const cue = makeCue(b, "footage", "endline", 6);
    b.studio!.cues = [cue];
    b.players[0].x = 0.9;
    b.studio!.ink["match-clip"] = [];
    b.studio!.ink["other-clip"] = [];
    const recalled = cueBoard(b, cue);
    expect(recalled.players[0].x).toBe(cue.frame.players[0].x);
    expect(recalled.studio!.ink["match-clip"][0].id).toBe("pass");
    expect(recalled.studio!.ink["other-clip"]).toEqual([]);
    expect(recalled.studio!.cues).toHaveLength(1);
    expect(recalled.studio!.broadcast).toEqual(defaultBroadcast());
    expect(recalled.studio!.trim).toEqual({ start: 2, end: 11 });
    expect(b.players[0].x).toBe(0.9);
    expect(isBoard(recalled)).toBe(true);
  });
  it("captures immutable frames and accepts older documents without cues", () => {
    const b = board();
    expect(isBoard(b)).toBe(true);
    const cue = makeCue(b, "board", "overhead", 0);
    b.studio!.cues = [cue];
    const before = cue.frame.players[0].x;
    b.players[0].x = 0.8;
    expect(cue.frame.players[0].x).toBe(before);
    expect(isBoard(b)).toBe(true);
    expect("studio" in cue).toBe(false);
  });
  it("rejects malformed cue data instead of allowing an invalid shot into a project", () => {
    const b = board(),
      cue = makeCue(b, "board", "overhead", 0);
    b.studio!.cues = [cue];
    cue.frame.players[0].x = NaN;
    expect(isBoard(b)).toBe(false);
    cue.frame.players[0].x = 0.2;
    cue.duration = -1;
    expect(isBoard(b)).toBe(false);
    cue.duration = 10;
    b.studio!.cues = [cue, copy(cue)];
    expect(isBoard(b)).toBe(false);
  });
  it("restores the saved phase and starts playback at that phase rather than the first scene", () => {
    const b = board(),
      first = copy(b.scenes[0]);
    b.scenes.push({
      ...copy(first),
      id: "second",
      title: "High press",
      duration: 4,
    });
    b.activeScene = "second";
    b.players[1].x = 0.7;
    b.scenes[1].players = copy(b.players);
    const cue = makeCue(b, "board", "broadcast", 0);
    b.activeScene = first.id;
    const recalled = cueBoard(b, cue);
    expect(recalled.activeScene).toBe("second");
    expect(activeSceneTime(recalled)).toBe(first.duration);
    expect(
      frameAt(recalled, activeSceneTime(recalled)).players[1].x,
    ).toBeCloseTo(0.7);
    b.scenes = b.scenes.filter((s) => s.id !== "second");
    const missing = cueBoard(b, cue);
    expect(
      missing.scenes.find((s) => s.id === missing.activeScene)?.title,
    ).toBe("High press");
    const recalledAgain = cueBoard(missing, cue);
    expect(recalledAgain.scenes).toHaveLength(missing.scenes.length);
    expect(recalledAgain.activeScene).toBe(cue.sceneId);
  });
  it("does not attach unrelated footage to a stats card or a manual board replay", () => {
    const b = board();
    b.studio!.assetId = "unrelated-video";
    expect(makeCue(b, "stats", "broadcast", 0).assetId).toBeUndefined();
    expect(makeCue(b, "replay", "broadcast", 0).assetId).toBeUndefined();
    expect(makeCue(b, "footage", "broadcast", 0).assetId).toBe(
      "unrelated-video",
    );
  });
});
describe("tactical setups and dynamic guides", () => {
  it("preserves identities and mirrors the exact setup for the opposite team", () => {
    for (const preset of TACTICAL_PRESETS) {
      const home = board(),
        away = board(),
        ids = home.players.map((p) => p.uid),
        opponents = copy(home.players.filter((p) => p.side === "away"));
      applyPreset(home, preset.id, "home");
      applyPreset(away, preset.id, "away");
      expect(home.players.map((p) => p.uid)).toEqual(ids);
      expect(home.players.filter((p) => p.side === "away")).toEqual(opponents);
      const h = home.players.filter((p) => p.side === "home"),
        a = away.players.filter((p) => p.side === "away");
      const positions = (ps: typeof h, mirror = false) =>
        ps
          .map(
            (p) =>
              `${(mirror ? 1 - p.x : p.x).toFixed(4)}:${(mirror ? 1 - p.y : p.y).toFixed(4)}`,
          )
          .sort();
      expect(positions(h)).toEqual(positions(a, true));
      expect(h[0].x).toBeCloseTo(preset.points[0][0]);
      expect(isBoard(home)).toBe(true);
      expect(isBoard(away)).toBe(true);
    }
  });
  it("moves a selected unit without compressing its shape at the edge", () => {
    const b = board(),
      players = b.players.slice(0, 3);
    players[0].x = 0.94;
    players[1].x = 0.8;
    players[2].x = 0.7;
    const distance = players[0].x - players[1].x;
    shiftUnit(
      b,
      players.map((p) => p.uid),
      0.3,
      0,
    );
    expect(players[0].x).toBeCloseTo(0.975);
    expect(players[0].x - players[1].x).toBeCloseTo(distance);
    expect(b.players[3].x).toBeLessThan(0.9);
  });
  it("recomputes team guides and player focus without saving derived graphics as editable ink", () => {
    const b = board();
    b.settings.teamShape = true;
    b.settings.teamLines = true;
    b.settings.thirds = true;
    const frame = analysisFrame(b, b);
    expect(frame.drawings.some((d) => d.id === "guide:hull")).toBe(true);
    expect(b.drawings).toEqual([]);
    const hull = copy(
      frame.drawings.find((d) => d.id === "guide:hull")!.points,
    );
    b.players[1].x = 0.95;
    const moved = analysisFrame(b, b);
    expect(
      moved.drawings.find((d) => d.id === "guide:hull")!.points,
    ).not.toEqual(hull);
    b.settings.focusPlayer = b.players[0].uid;
    const focused = analysisFrame(b, b);
    expect(focused.players[0].opacity).toBe(1);
    expect(focused.players[1].opacity).toBe(0.28);
    expect(b.players[1].opacity).toBeUndefined();
  });
});
