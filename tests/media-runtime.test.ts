import { it, expect, vi } from "vitest";
import { newBoard } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
const state = vi.hoisted(() => ({ studio: {} as any }));
vi.mock("../src/store", () => ({
  useStudio: { getState: () => state.studio },
}));
vi.mock("../src/studio/production", () => ({ setLiveFollow: vi.fn() }));
import { selectAsset, useRuntime } from "../src/studio/runtime";
import { setLiveFollow } from "../src/studio/production";
it("opens another source privately as a new analysis and preserves the previous clip range", () => {
  const b = newBoard(
    catalogue.teams[0] as unknown as Team,
    catalogue.teams[1] as unknown as Team,
  );
  b.studio!.assetId = "old";
  b.studio!.trim = { start: 30, end: 40 };
  state.studio = { board: b, commit: (fn: any) => fn(b), set: vi.fn() };
  useRuntime.setState({
    activeCueId: "previous-shot",
    markMode: "target",
    follow: true,
  });
  selectAsset({
    id: "new",
    name: "Still.png",
    type: "image",
    mime: "image/png",
    size: 10,
    width: 1280,
    height: 720,
    duration: 0,
    fps: 25,
    thumbnail: "",
    createdAt: "2026-11-01",
  });
  expect(setLiveFollow).toHaveBeenCalledWith(false);
  expect(b.studio!.sourceRanges!.old).toEqual({ start: 30, end: 40 });
  expect(b.studio!.trim).toEqual({ start: 0, end: 5 });
  expect(useRuntime.getState()).toMatchObject({
    activeCueId: null,
    markMode: "none",
    view: "footage",
    sidebar: "tactics",
  });
  expect(state.studio.set).toHaveBeenCalledWith(
    expect.objectContaining({ tool: "select", playing: false }),
  );
});
