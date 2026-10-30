import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "../src/types";
const cache = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  state: { summaries: {}, board: null } as any,
}));
vi.mock("../src/store", () => ({
  useStudio: {
    getState: () => cache.state,
    setState: (next: any) => Object.assign(cache.state, next),
  },
}));
vi.mock("../src/studio/assetStore", () => ({
  getRecord: vi.fn(
    async (_store: string, id: string) => cache.records.get(id) || null,
  ),
  putRecord: vi.fn(async (_store: string, id: string, value: unknown) => {
    cache.records.set(id, value);
  }),
}));
import {
  loadReport,
  loadPlayerHistory,
  useFootball,
} from "../src/football/data";
const match = {
  id: "cache-match",
  league: "eng.1",
  date: "2025-10-01",
} as Match;
beforeEach(() => {
  cache.records.clear();
  cache.state = { summaries: {}, board: null };
  useFootball.setState({ history: {} });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
});
describe("saved football source recovery", () => {
  it("opens a locally retained match report after reload without replacing it with an older shipped report", async () => {
    const saved = {
      id: match.id,
      lineups: [],
      teamStats: [],
      events: [],
      updatedAt: "2025-10-02T12:00:00Z",
    };
    cache.records.set("football-report:" + match.id, saved);
    expect(await loadReport(match)).toEqual(saved);
    expect(cache.state.summaries[match.id]).toEqual(saved);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retains player match and historical totals if the upstream feed is unavailable after reload", async () => {
    const saved = {
      updatedAt: "2025-10-02T12:00:00Z",
      history: [
        {
          fixtureId: 1,
          stats: { minutes: { label: "Minutes", value: 90, display: "90" } },
        },
      ],
      pastSeasons: [{ season: "2024/25", stats: {} }],
    };
    cache.records.set("football-player:12", saved);
    expect(await loadPlayerHistory(12, true)).toEqual(saved);
    expect(useFootball.getState().history[12]).toEqual(saved);
  });
});
