import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, it, expect, vi } from "vitest";
import { newBoard, copy } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import {
  prepareEpisodeBackup,
  renderBackupPart,
  importEpisodeBackup,
  validateBackup,
  backupStem,
  BACKUP_CHUNK_BYTES,
} from "../src/studio/episodeTransfer";
import {
  getRecord,
  putRecord,
  saveProject,
  loadProject,
} from "../src/studio/assetStore";
import { importSelection } from "../src/studio/mediaModel";
const board = () =>
  newBoard(catalogue.teams[0] as any, catalogue.teams[1] as any);
const asset = (size: number) => ({
  id: "source",
  name: "Original.mp4",
  type: "video" as const,
  mime: "video/mp4",
  size,
  width: 1280,
  height: 720,
  duration: 120,
  fps: 25,
  createdAt: "2026-11-01",
  thumbnail: "data:image/png;base64,YWJj",
});
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
it("round-trips complete episode state and source bytes through actual ZIP volumes into fresh storage", async () => {
  const b = board(),
    blob = new Blob(["original bytes"], { type: "video/mp4" }),
    a = asset(blob.size),
    d = b.studio!;
  d.assetId = a.id;
  d.trim = { start: 30, end: 40 };
  d.resume = { view: "footage", time: 35, phaseTime: null };
  d.ink[a.id] = [
    {
      id: "arrow",
      type: "arrow",
      points: [0.2, 0.3, 0.8, 0.6],
      color: "#ffffff",
      width: 3,
      opacity: 1,
      assetId: a.id,
      from: 32,
      to: 36,
      space: "screen",
    },
  ];
  d.resourceIds = ["cohort-version1"];
  await putRecord("resources", "cohort-version1", {
    players: [1, 2, 3],
    version: 1,
  });
  const backup = await prepareEpisodeBackup(
    b,
    [a],
    () => {},
    async () => blob,
  );
  const files = [
    new File(
      [JSON.stringify(backup)],
      backupStem(backup) + ".touchline.episode.json",
    ),
    new File(
      [await renderBackupPart(backup, 0, async () => blob)],
      backup.parts[0].name,
    ),
  ];
  vi.stubGlobal("indexedDB", new IDBFactory());
  const restored = await importEpisodeBackup(files),
    id = restored.studio!.assetId!;
  expect(id).not.toBe(a.id);
  expect(await (await getRecord<Blob>("assets", id))!.text()).toBe(
    "original bytes",
  );
  expect(restored.studio!.resume!.time).toBe(35);
  expect(restored.studio!.ink[id][0]).toMatchObject({
    from: 32,
    to: 36,
    assetId: id,
  });
  expect(await getRecord("resources", "cohort-version1")).toEqual({
    players: [1, 2, 3],
    version: 1,
  });
});
it("rejects missing, corrupt, overlapping or unrelated volumes before changing an episode", async () => {
  const b = board(),
    blob = new Blob(["abc"]),
    a = asset(3);
  b.studio!.assetId = a.id;
  await saveProject(b);
  const backup = await prepareEpisodeBackup(
      b,
      [a],
      () => {},
      async () => blob,
    ),
    manifest = new File(
      [JSON.stringify(backup)],
      backupStem(backup) + ".touchline.episode.json",
    );
  await expect(importEpisodeBackup([manifest])).rejects.toThrow("incomplete");
  await expect(
    importEpisodeBackup([manifest, new File(["bad"], backup.parts[0].name)]),
  ).rejects.toThrow();
  expect((await loadProject(b.id))?.id).toBe(b.id);
  const bad = copy(backup);
  bad.parts[0].offset = 1;
  expect(() => validateBackup(bad)).toThrow("gap");
  expect(importSelection([manifest, { name: backup.parts[0].name }])).toBe(
    "episode",
  );
});
it("checks source-only saved references, source changes, missing data snapshots and backup namespaces", async () => {
  const b = board(),
    a = asset(3),
    blob = new Blob(["abc"]);
  b.studio!.assetId = "missing";
  await expect(
    prepareEpisodeBackup(
      b,
      [a],
      () => {},
      async () => blob,
    ),
  ).rejects.toThrow("missing");
  b.studio!.assetId = a.id;
  const backup = await prepareEpisodeBackup(
    b,
    [a],
    () => {},
    async () => blob,
  );
  await expect(
    renderBackupPart(backup, 0, async () => new Blob(["xyz"])),
  ).rejects.toThrow("changed");
  const other = await prepareEpisodeBackup(
    b,
    [a],
    () => {},
    async () => blob,
  );
  expect(other.parts[0].name).not.toBe(backup.parts[0].name);
  b.studio!.resourceIds = ["unavailable"];
  await expect(
    prepareEpisodeBackup(
      b,
      [a],
      () => {},
      async () => blob,
    ),
  ).rejects.toThrow("snapshot missing");
});
it("packages a source exceeding the old 200 MB limit with no read above 32 MB", async () => {
  const b = board(),
    chunk = new Uint8Array(1048576);
  chunk[0] = 37;
  const blob = new Blob([...Array(201).fill(chunk), new Uint8Array([9, 8, 7])]),
    a = asset(blob.size);
  b.studio!.assetId = a.id;
  b.studio!.trim = { start: 80, end: 100 };
  let largest = 0;
  const read = async () =>
    ({
      size: blob.size,
      slice: (from: number, to: number) => {
        largest = Math.max(largest, to - from);
        return blob.slice(from, to);
      },
    }) as Blob;
  const backup = await prepareEpisodeBackup(b, [a], () => {}, read);
  expect(backup.parts).toHaveLength(7);
  expect(largest).toBeLessThanOrEqual(BACKUP_CHUNK_BYTES);
  expect(backup.parts.reduce((n, p) => n + p.size, 0)).toBe(blob.size);
  expect(backup.board.studio!.trim).toEqual({ start: 80, end: 100 });
  const last = await renderBackupPart(backup, 6, async () => blob);
  expect(last.size).toBeLessThan(BACKUP_CHUNK_BYTES + 1048576);
}, 30000);
