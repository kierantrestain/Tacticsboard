import { beforeEach, describe, expect, it, vi } from "vitest";
import { newBoard } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Catalogue, Match, MatchDetails, Team } from "../src/types";
const mocks = vi.hoisted(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage() {}
      addEventListener() {}
    },
  );
  return { loadReport: vi.fn() };
});
vi.mock("../src/football/data", () => ({ loadReport: mocks.loadReport }));
vi.mock("../src/studio/assetStore", () => ({
  saveProject: vi.fn(async () => {}),
  loadProject: vi.fn(async () => null),
}));
import { useStudio } from "../src/store";
import { presentMatchData } from "../src/studio/StatsStage";
import { useRuntime, selectAsset, editDesk } from "../src/studio/runtime";
import type { MediaAsset } from "../src/studio/types";
const home = catalogue.teams[0] as unknown as Team,
  away = catalogue.teams[1] as unknown as Team;
const match = (id: string): Match =>
  ({
    id,
    homeId: home.id,
    awayId: away.id,
    homeName: home.name,
    awayName: away.name,
    league: "eng.1",
    date: "2026-10-01",
    completed: true,
    homeScore: "2",
    awayScore: "1",
  }) as Match;
const report = (id: string): MatchDetails =>
  ({ id, lineups: [], teamStats: [], events: [] }) as unknown as MatchDetails;
beforeEach(() => {
  mocks.loadReport.mockReset();
  useStudio.setState({
    board: newBoard(home, away),
    catalogue: catalogue as unknown as Catalogue,
    summaries: {},
    past: [],
    future: [],
    loading: false,
  });
});
describe("fixture and source context", () => {
  it('preserves a deliberately named episode across fixture changes',async()=>{const b=useStudio.getState().board!;b.title='Bang On · Episode 12';b.studio!.episodeNamed=true;mocks.loadReport.mockResolvedValue(report('named'));await useStudio.getState().loadMatch(match('named'));expect(useStudio.getState().board!.title).toBe('Bang On · Episode 12');});
  it("a later match selection wins when an earlier report finishes last", async () => {
    let finishFirst!: (r: MatchDetails) => void;
    mocks.loadReport.mockImplementation((m: Match) =>
      m.id === "first"
        ? new Promise((resolve) => {
            finishFirst = resolve;
          })
        : Promise.resolve(report(m.id)),
    );
    const first = useStudio.getState().loadMatch(match("first"));
    await useStudio.getState().loadMatch(match("second"));
    finishFirst(report("first"));
    await first;
    const b = useStudio.getState().board!;
    expect(b.match?.id).toBe("second");
    expect(b.studio!.statsReportId).toBe("second");
    expect(b.studio!.dataReports?.second.id).toBe("second");
  });
  it("clears old report selections and captions when changing fixture", async () => {
    const b = useStudio.getState().board!;
    b.match = match("old");
    b.studio!.statsSnapshot = report("old");
    b.studio!.statsReportId = "old";
    b.studio!.statsPlayerId = "old-player";
    b.studio!.assetId = "old-clip";
    mocks.loadReport.mockResolvedValue(report("new"));
    await useStudio.getState().loadMatch(match("new"));
    const d = useStudio.getState().board!.studio!;
    expect(d.statsSnapshot).toBeUndefined();
    expect(d.statsPlayerId).toBeUndefined();
    expect(d.assetId).toBeUndefined();
    expect(d.statsReportId).toBe("new");
  });
  it("opening a player data card for the same match preserves the existing tactical storyboard", async () => {
    const b = useStudio.getState().board!;
    b.match = match("same");
    b.scenes[0].title = "Our tactical work";
    b.scenes.push({
      ...structuredClone(b.scenes[0]),
      id: "second",
      title: "The counter",
    });
    mocks.loadReport.mockResolvedValue(report("same"));
    await presentMatchData(match("same"));
    expect(useStudio.getState().board!.scenes.map((s) => s.title)).toEqual([
      "Our tactical work",
      "The counter",
    ]);
    expect(useRuntime.getState().view).toBe("stats");
  });
  it("returns each source to its saved analysis range instead of losing the trim on switching", () => {
    const asset = (id: string) =>
      ({ id, type: "video", duration: 30, fps: 25 }) as MediaAsset;
    selectAsset(asset("one"));
    useStudio.getState().board!.studio!.trim = { start: 4, end: 12 };
    selectAsset(asset("two"));
    useStudio.getState().board!.studio!.trim = { start: 7, end: 15 };
    selectAsset(asset("one"));
    expect(useStudio.getState().board!.studio!.trim).toEqual({
      start: 4,
      end: 12,
    });
    expect(useRuntime.getState().time).toBe(4);
    expect(useStudio.getState().board!.studio!.sourceRanges?.two).toEqual({
      start: 7,
      end: 15,
    });
  });
});

it("invalidates tracking review when its calibration changes, while retaining other source reviews", () => {
  const b = useStudio.getState().board!;
  b.studio!.tracking.one = {
    assetId: "one",
    start: 0,
    end: 1,
    frames: [],
    targets: [],
    reviewed: true,
    createdAt: "",
    method: "test",
  };
  b.studio!.tracking.two = { ...b.studio!.tracking.one, assetId: "two" };
  editDesk((d) => {
    d.landmarks.one = [
      { image: { x: 0.2, y: 0.3 }, pitch: { x: 0, y: 0 }, label: "Corner" },
    ];
  });
  expect(useStudio.getState().board!.studio!.tracking.one.reviewed).toBe(false);
  expect(useStudio.getState().board!.studio!.tracking.two.reviewed).toBe(true);
});
