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
});
