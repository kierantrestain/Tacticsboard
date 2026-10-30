import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { newBoard } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
const state = vi.hoisted(() => ({
  studio: {} as any,
  runtime: {} as any,
  messages: [] as any[],
}));
vi.mock("../src/store", () => ({
  useStudio: { getState: () => state.studio },
}));
vi.mock("../src/studio/runtime", () => ({
  useRuntime: {
    getState: () => state.runtime,
    setState: (next: any) => Object.assign(state.runtime, next),
  },
}));
vi.mock("../src/studio/assetStore", () => ({
  putRecord: vi.fn(async () => {}),
}));
vi.mock("../src/studio/capture", () => ({ captureThumbnail: () => undefined }));
let production: typeof import("../src/studio/production");
beforeAll(async () => {
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage(message: any) {
        state.messages.push(message);
      }
    },
  );
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("window", { open: vi.fn(() => ({})) });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
    setTimeout(callback, 1),
  );
  production = await import("../src/studio/production");
});
beforeEach(() => {
  vi.useFakeTimers();
  state.messages = [];
  state.studio = {
    board: newBoard(
      catalogue.teams[0] as unknown as Team,
      catalogue.teams[1] as unknown as Team,
    ),
    catalogue,
    previewTime: 1.5,
    notify: vi.fn(),
  };
  state.runtime = {
    view: "board",
    camera: "broadcast",
    time: 0,
    rate: 1,
    mediaPlaying: false,
    follow: false,
    program: null,
    busy: "",
    assets: [],
    assetAvailability: {},
    set: (next: any) => Object.assign(state.runtime, next),
  };
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});
describe("output controller", () => {
  it("opens/reopens output without taking the current preview", () => {
    production.takeToAir();
    const held = state.runtime.program;
    state.studio.board.players[0].x = 0.9;
    state.studio.previewTime = 6;
    production.openProgram();
    expect(state.runtime.program).toBe(held);
    expect(state.messages).toHaveLength(1);
  });
  it("does not unblack or substitute preview content on take or live-follow", () => {
    production.takeToAir();
    const original = state.runtime.program.board.players[0].x;
    production.toggleBlackout();
    state.studio.board.players[0].x = 0.9;
    production.takeToAir();
    production.setLiveFollow(true);
    expect(state.runtime.program.black).toBe(true);
    expect(state.runtime.follow).toBe(false);
    production.toggleBlackout();
    expect(state.runtime.program.board.players[0].x).toBe(original);
    expect(state.runtime.program.phaseTime).toBe(1.5);
  });
  it("stops a live follow if its newly selected source is unavailable and ignores updates during export", () => {
    production.setLiveFollow(true);
    const held = state.runtime.program;
    state.runtime.busy = "Rendering";
    production.takeToAir();
    expect(state.runtime.program).toBe(held);
    production.queueLiveTake();
    vi.advanceTimersByTime(20);
    expect(state.runtime.program).toBe(held);
    state.runtime.busy = "";
    state.runtime.view = "footage";
    production.queueLiveTake();
    vi.advanceTimersByTime(20);
    expect(state.runtime.follow).toBe(false);
    expect(state.runtime.program).toBe(held);
    expect(state.studio.notify).toHaveBeenCalled();
  });
});
