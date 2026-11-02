import "fake-indexeddb/auto";
import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { newBoard, copy } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import {
  saveProject,
  loadProject,
  listCheckpoints,
  checkpointProject,
  getRecord,
  putRecord,
  commitImportedMedia,
  recoveredEpisode,
} from "../src/studio/assetStore";
import { mediaDB } from "../src/media";
import { duplicateEpisode, episodeMediaIds } from "../src/studio/episodeModel";
import { makeCue, cueBoard } from "../src/studio/cueModel";
const board = () =>
  newBoard(catalogue.teams[0] as any, catalogue.teams[1] as any);
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("orders overlapping saves and atomically retains the previous valid episode", async () => {
  const first = board(),
    last = copy(first);
  first.title = "First";
  last.title = "Last";
  await Promise.all([saveProject(first), saveProject(last)]);
  expect((await loadProject(first.id))?.title).toBe("Last");
  expect((await listCheckpoints(first.id))[0].board.title).toBe("First");
});
it("retains the head on interrupted writes, then accepts the next save", async () => {
  const first = board();
  first.title = "Valid";
  await saveProject(first);
  const next = copy(first);
  next.title = "Interrupted";
  const original = IDBDatabase.prototype.transaction;
  const spy = vi
    .spyOn(IDBDatabase.prototype, "transaction")
    .mockImplementation(function (this: IDBDatabase, ...args: any[]) {
      const tx = (original as any).apply(this, args);
      if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
      return tx;
    });
  await expect(saveProject(next)).rejects.toThrow();
  spy.mockRestore();
  expect((await loadProject(first.id))?.title).toBe("Valid");
  next.title = "Recovered";
  await saveProject(next);
  expect((await loadProject(first.id))?.title).toBe("Recovered");
});
it("rolls back every imported source and resource if a later item cannot be cloned", async () => {
  await expect(
    commitImportedMedia([
      { asset: { id: "one" } as any, blob: new Blob(["one"]) },
      {
        asset: { id: "bad", invalid: () => {} } as any,
        blob: new Blob(["two"]),
      },
    ]),
  ).rejects.toThrow();
  expect(await getRecord("assets", "one")).toBeNull();
  expect(await getRecord("meta", "one")).toBeNull();
});
it("protects immutable data snapshots from a conflicting import", async () => {
  await putRecord("resources", "frozen", { value: 1 });
  await expect(
    commitImportedMedia(
      [{ asset: { id: "new" } as any, blob: new Blob(["new"]) }],
      [{ id: "frozen", value: { value: 2 } }],
    ),
  ).rejects.toThrow();
  expect(await getRecord("assets", "new")).toBeNull();
  expect(await getRecord("resources", "frozen")).toEqual({ value: 1 });
});
it("recovers a corrupt head from the previous valid save and keeps explicit checkpoints bounded", async () => {
  const b = board();
  b.title = "Recover me";
  await saveProject(b);
  const latest = copy(b);
  latest.title = "Later";
  await saveProject(latest);
  await putRecord("projects", b.id, { corrupt: true });
  expect((await loadProject(b.id))?.title).toBe("Recover me");
  expect(recoveredEpisode(b.id)).toContain("latest valid");
  for (let i = 0; i < 5; i++) await checkpointProject(b, "Manual " + i);
  const history = await listCheckpoints(b.id);
  expect(history.filter((c) => c.label.startsWith("Manual"))).toHaveLength(3);
  expect(history[0].label).toBe("Manual 4");
});
it("copies episode state independently, retains source-only references and restores calibration per moment", () => {
  const b = board(),
    d = b.studio!;
  d.assetId = "clip";
  d.landmarks.clip = [
    { image: { x: 0.2, y: 0.3 }, pitch: { x: 0, y: 0 }, label: "Corner" },
  ];
  d.targets.clip = [
    {
      id: "p",
      name: "Known actor",
      playerId: "p",
      side: "home",
      number: "7",
      image: { x: 0.3, y: 0.4 },
    },
  ];
  d.cues = [makeCue(b, "footage", "broadcast", 3)];
  d.cues[0].note = "Private script";
  d.assetId = undefined;
  d.landmarks.clip[0].image.x = 0.8;
  const duplicate = duplicateEpisode(b);
  duplicate.studio!.cues![0].note = "Other script";
  expect(b.studio!.cues![0].note).toBe("Private script");
  expect(duplicate.id).not.toBe(b.id);
  expect(episodeMediaIds(b).has("clip")).toBe(true);
  const restored = cueBoard(b, d.cues[0]);
  expect(restored.studio!.landmarks.clip[0].image.x).toBe(0.2);
  expect(restored.studio!.targets.clip[0].playerId).toBe("p");
});

it("retains the last valid save when a document contains uncloneable extension data", async () => {
  const b = board();
  b.title = "Valid";
  await saveProject(b);
  const next = copy(b) as any;
  next.extension = () => {};
  await expect(saveProject(next)).rejects.toThrow();
  expect((await loadProject(b.id))?.title).toBe("Valid");
});
