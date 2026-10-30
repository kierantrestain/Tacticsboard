import { describe, it, expect, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
const media = vi.hoisted(() => new Map<string, Blob>());
const records = vi.hoisted(() => new Map<string, unknown>());
vi.mock("../src/studio/assetStore", () => ({
  getMedia: async (id: string) => media.get(id) || null,
  saveMedia: async (id: string, value: Blob) => {
    media.set(id, value);
  },
  putRecord: async (_: string, id: string, value: unknown) => {
    records.set(id, value);
  },
}));
import { exportPack, importPack } from "../src/studio/exports";
import { newBoard } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
import type { MediaAsset } from "../src/studio/types";
import { makeCue } from "../src/studio/cueModel";
describe("portable analysis handoff", () => {
  it("round-trips original source bytes and remaps every document reference", async () => {
    const board = newBoard(
        catalogue.teams[0] as unknown as Team,
        catalogue.teams[1] as unknown as Team,
      ),
      id = "old-source";
    const asset: MediaAsset = {
      id,
      name: "test.mp4",
      type: "video",
      mime: "video/mp4",
      size: 6,
      width: 1280,
      height: 720,
      duration: 10,
      fps: 25,
      createdAt: "2026-10-30",
      thumbnail: "data:image/jpeg;base64,YWJj",
    };
    media.set(id, new Blob(["source"]));
    const d = board.studio!;
    d.assetId = id;
    d.sourceRanges = { [id]: { start: 2, end: 8 } };
    d.view = "split";
    d.ink[id] = [
      {
        id: "arrow",
        type: "arrow",
        points: [0.2, 0.3, 0.7, 0.6],
        color: "#fff",
        width: 3,
        opacity: 1,
        space: "pitch",
        assetId: id,
        from: 0,
        to: 10,
      },
    ];
    d.landmarks[id] = [];
    d.targets[id] = [];
    d.tracking[id] = {
      assetId: id,
      start: 0,
      end: 1,
      frames: [],
      targets: [],
      reviewed: true,
      method: "test",
      createdAt: "",
    };
    d.bookmarks = [
      {
        id: "moment",
        assetId: id,
        time: 1,
        title: "Moment",
        note: "Panel note",
      },
    ];
    board.scenes[0].source = { assetId: id, time: 0, review: false };
    d.cues = [makeCue(board, "footage", "endline", 4)];
    d.dataReports = {
      "match-1": {
        id: "match-1",
        lineups: [
          {
            teamId: board.homeTeamId,
            side: "home",
            players: [
              {
                id: "p1",
                name: "Saved player",
                starter: true,
                stats: {
                  totalGoals: { label: "Goals", value: 1, display: "1" },
                },
              },
            ],
          },
        ],
        teamStats: [],
      },
    };
    d.statsReportId = "match-1";
    d.statsPlayerId = "p1";
    d.cues.push(makeCue(board, "stats", "broadcast", 0));
    const result = await exportPack(board, [asset]);
    const restored = await importPack(
      new File([result.blob], "project.touchline.zip"),
    );
    const next = restored.studio!.assetId!;
    expect(next).not.toBe(id);
    expect(restored.studio!.sourceRanges?.[next]).toEqual({ start: 2, end: 8 });
    expect(restored.studio!.sourceRanges?.[id]).toBeUndefined();
    expect(await media.get(next)!.text()).toBe("source");
    expect(media.get(id)).toBeDefined();
    expect(restored.studio!.ink[next][0].assetId).toBe(next);
    expect(restored.studio!.tracking[next].assetId).toBe(next);
    expect(restored.studio!.bookmarks[0].assetId).toBe(next);
    expect(restored.scenes[0].source!.assetId).toBe(next);
    expect(restored.studio!.targets[next]).toEqual([]);
    expect(restored.studio!.landmarks[next]).toEqual([]);
    expect(restored.studio!.view).toBe("split");
    expect(restored.studio!.cues![0].assetId).toBe(next);
    expect(restored.studio!.cues![0].ink[0].assetId).toBe(next);
    expect(restored.studio!.cues![0].camera).toBe("endline");
    expect(restored.studio!.dataReports!["match-1"]).toEqual(
      d.dataReports["match-1"],
    );
    expect(restored.studio!.cues![1].statsPlayerId).toBe("p1");
    expect(restored.studio!.cues![1].assetId).toBeUndefined();
    expect(records.has(next)).toBe(true);
  });
  it("refuses an archive whose referenced source is missing", async () => {
    const board = newBoard(
      catalogue.teams[0] as unknown as Team,
      catalogue.teams[1] as unknown as Team,
    );
    const bytes = zipSync({
      "project.json": strToU8(
        JSON.stringify({
          format: "touchline-project",
          version: 2,
          board,
          assets: [
            {
              id: "missing",
              name: "source",
              type: "video",
              thumbnail: "data:image/jpeg;base64,YQ==",
              duration: 10,
            },
          ],
        }),
      ),
    });
    await expect(
      importPack(new File([bytes as BlobPart], "missing.zip")),
    ).rejects.toThrow("source file is missing");
  });
});
