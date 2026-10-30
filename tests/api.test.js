import { afterEach, describe, it, expect, vi } from "vitest";
import handler, { normaliseSummary } from "../api/football.js";
function response() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(v) {
      this.body = v;
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("football route", () => {
  it("rejects unsupported methods, competitions and injected identifiers before fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const [method, url, status] of [
      ["POST", "/api/football?action=summary&event=12", 405],
      ["GET", "/api/football?action=summary&league=other&event=12", 400],
      ["GET", "/api/football?action=summary&event=https://example.com", 400],
      ["GET", "/api/football?action=fixtures&date=2026", 400],
      ["GET", "/api/football?action=career&player=../secret", 400],
      ["GET", "/api/football?action=archive&season=1991", 400],
    ]) {
      const res = response();
      await handler({ method, url }, res);
      expect(res.statusCode).toBe(status);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("normalises and caches a supported match summary", async () => {
    const raw = {
      rosters: [
        {
          team: { id: "359" },
          homeAway: "home",
          formation: "4-3-3",
          roster: [
            {
              athlete: { id: "123", displayName: "Player" },
              starter: true,
              formationPlace: "1",
            },
          ],
        },
      ],
      boxscore: {
        teams: [
          {
            team: { id: "359" },
            statistics: [
              {
                name: "possessionPct",
                displayValue: "58.2",
                label: "Possession",
              },
            ],
          },
        ],
      },
      keyEvents: [
        {
          clock: { displayValue: "31′" },
          text: "Goal",
          type: { text: "Goal" },
        },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => raw });
    vi.stubGlobal("fetch", fetch);
    const res = response();
    await handler(
      {
        method: "GET",
        url: "/api/football?action=summary&league=eng.1&event=401878768",
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=401878768",
    );
    const actual = JSON.parse(res.body),
      expected = JSON.parse(JSON.stringify(normaliseSummary(raw, "401878768")));
    expect(Date.now() - Date.parse(actual.updatedAt)).toBeLessThan(1000);
    delete actual.updatedAt;
    delete expected.updatedAt;
    expect(actual).toEqual(expected);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=30");
  });
  it("preserves source failure and rejects another season instead of passing stale data off as current", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ season: { year: 2025 }, athletes: [] }),
      }),
    );
    const res = response();
    await handler(
      {
        method: "GET",
        url: "/api/football?action=roster&league=eng.1&team=359&season=2026",
      },
      res,
    );
    expect(res.statusCode).toBe(503);
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });
  it("reports upstream outages without returning invented records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const res = response();
    await handler(
      { method: "GET", url: "/api/football?action=fixtures&date=20261030" },
      res,
    );
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toContain("saved catalogue");
  });
  it("deduplicates historical club schedules, ignores dates outside the requested season and reports partial coverage", async () => {
    const event = (id, date) => ({
      id,
      date,
      competitions: [
        {
          competitors: [
            {
              id: "1",
              homeAway: "home",
              team: { id: "1", displayName: "One" },
              score: "2",
            },
            {
              id: "2",
              homeAway: "away",
              team: { id: "2", displayName: "Two" },
              score: "1",
            },
          ],
          status: {
            type: { state: "post", completed: true, description: "Full Time" },
          },
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.includes("scoreboard")) return { ok: false };
        if (url.includes("standings"))
          return {
            ok: true,
            json: async () => ({
              season: { year: 2025 },
              standings: {
                entries: [
                  { team: { id: "1" }, stats: [] },
                  { team: { id: "2" }, stats: [] },
                ],
              },
            }),
          };
        return {
          ok: true,
          json: async () => ({
            season: { year: 2026 },
            events: [
              event("old", "2024-10-01"),
              event("correct", "2025-10-01"),
              event("future", "2026-08-01"),
            ],
          }),
        };
      }),
    );
    const res = response();
    await handler(
      { method: "GET", url: "/api/football?action=archive&season=2025" },
      res,
    );
    const result = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(result.matches.map((m) => m.id)).toEqual(["correct"]);
    expect(result.matches[0].seasonYear).toBe(2025);
    expect(result.coverage).toMatchObject({
      returned: 1,
      expected: 380,
      complete: false,
      schedulesChecked: 2,
      schedulesUnavailable: 0,
    });
  });
  it("rejects a historical table when the provider returns a different or unknown season", async () => {
    for (const season of [{ year: 2026 }, undefined]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue({
            ok: true,
            json: async () => ({ season, standings: { entries: [] } }),
          }),
      );
      const res = response();
      await handler(
        { method: "GET", url: "/api/football?action=standings&season=2025" },
        res,
      );
      expect(res.statusCode).toBe(503);
    }
  });
});
