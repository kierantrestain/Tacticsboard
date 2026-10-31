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
  it('upgrades legacy event evidence during an outage without overwriting a newer score or reviving an archived goal', async () => {
    const fixture = { ...match, id: '778899' };
    const saved = { id: fixture.id, lineups: [], teamStats: [{ teamId: 'h', stats: { totalShots: { display: '22', label: 'Shots' } } }], score: [{ teamId: 'h', score: '2' }], events: [{ minute: "30'", text: 'Confirmed goal', type: 'Goal' }], updatedAt: '2026-10-30T12:00:00Z' };
    cache.records.set('football-report:' + fixture.id, saved);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/')) throw Error('offline');
      return { ok: true, json: async () => ({ ...saved, updatedAt: '2026-10-29T12:00:00Z', score: [{ teamId: 'h', score: '1' }], events: [{ id: 'confirmed', minute: "30'", text: 'Confirmed goal', type: 'Goal', position: { x: 90, y: 50 } }], replayEvents: [{ id: 'revoked', minute: "50'", text: 'Goal. A player.', type: 'Goal' }, { id: 'chance', minute: "20'", text: 'Attempt missed. A player.', type: 'Shot Off Target' }] }) };
    }));
    const result = await loadReport(fixture, true);
    expect(result.score).toEqual(saved.score); expect(result.teamStats).toEqual(saved.teamStats); expect(result.updatedAt).toBe(saved.updatedAt);
    expect(result.events).toEqual([expect.objectContaining({ id: 'confirmed', position: { x: 90, y: 50 } })]);
    expect(result.replayEvents?.map(e=>e.id)).toEqual(['chance']);
  });
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
