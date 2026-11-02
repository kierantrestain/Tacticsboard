import { zip, unzip, strToU8, strFromU8 } from "fflate";
import { copy, filename, isBoard, uid } from "../core";
import type { Board } from "../types";
import type { MediaAsset } from "./types";
import { validMediaMetadata, MAX_SOURCE_BYTES } from "./mediaModel";
import { episodeMediaIds, remapEpisodeMedia } from "./episodeModel";
import {
  getMedia,
  putRecord,
  getRecord,
  commitImportedMedia,
} from "./assetStore";
import { mediaDB } from "../media";
export const BACKUP_CHUNK_BYTES = 32 * 1048576;
const MAX_TOTAL_BYTES = 8 * 1024 ** 3,
  MAX_ASSETS = 256;
export interface BackupPart {
  name: string;
  assetId: string;
  offset: number;
  size: number;
  digest: string;
}
export interface EpisodeBackup {
  format: "bangon-episode";
  version: 1;
  id: string;
  createdAt: string;
  board: Board;
  assets: MediaAsset[];
  parts: BackupPart[];
  resources?: { id: string; value: unknown }[];
}
export const backupStem = (backup: Pick<EpisodeBackup, "id" | "board">) =>
  filename(backup.board.title).slice(0, 100) + "-" + backup.id;
const zipFile = (files: Record<string, Uint8Array>) =>
  new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
const unzipFile = (bytes: Uint8Array) =>
  new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(
      bytes,
      {
        filter: (entry) => {
          if (entry.originalSize > BACKUP_CHUNK_BYTES + 1048576)
            throw Error("Backup volume expands beyond its supported size.");
          return ["part.json", "data.bin"].includes(entry.name);
        },
      },
      (error, data) => (error ? reject(error) : resolve(data)),
    ),
  );
/** Hash at most one bounded chunk; HTTP/LAN browsers use a worker, never a UI-thread hash loop. */
export async function digestChunk(blob: Blob) {
  if (blob.size > BACKUP_CHUNK_BYTES)
    throw Error("Integrity reads must remain bounded.");
  const bytes = await blob.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  }
  if (typeof Worker !== "undefined")
    return new Promise<string>((resolve, reject) => {
      const worker = new Worker(
        new URL("./integrity.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (e) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = () => {
        worker.terminate();
        reject(Error("The integrity worker could not read this source."));
      };
      worker.postMessage(bytes, [bytes]);
    });
  const { sha256 } = await import("@noble/hashes/sha2.js");
  return Array.from(sha256(new Uint8Array(bytes)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function prepareEpisodeBackup(
  board: Board,
  assets: MediaAsset[],
  progress: (n: number) => void = () => {},
  read = getMedia,
): Promise<EpisodeBackup> {
  if (!isBoard(board))
    throw Error("The episode is invalid. Restore a valid checkpoint first.");
  const ids = episodeMediaIds(board, assets),
    included = assets.filter((a) => ids.has(a.id));
  if (ids.size !== included.length)
    throw Error(
      "A referenced source or its original parent is missing. Relink it before claiming a complete backup.",
    );
  if (included.length > MAX_ASSETS)
    throw Error("Keep one episode within 256 sources.");
  const total = included.reduce((n, a) => n + a.size, 0);
  if (total > MAX_TOTAL_BYTES)
    throw Error(
      "Split episodes above 8 GB into separate episodes before backing up.",
    );
  const id = uid(),
    parts: BackupPart[] = [];
  let done = 0;
  for (const a of included) {
    if (!validMediaMetadata(a) || a.size <= 0 || a.size > MAX_SOURCE_BYTES)
      throw Error(`Invalid source metadata: ${a.name}`);
    const blob = await read(a.id);
    if (!blob || blob.size !== a.size)
      throw Error(
        `Source missing or size changed: ${a.name}. Relink and review it first.`,
      );
    for (let offset = 0; offset < blob.size; offset += BACKUP_CHUNK_BYTES) {
      const chunk = blob.slice(offset, offset + BACKUP_CHUNK_BYTES),
        digest = await digestChunk(chunk);
      parts.push({
        name: `${backupStem({ id, board })}.touchline.part${String(parts.length + 1).padStart(4, "0")}.zip`,
        assetId: a.id,
        offset,
        size: chunk.size,
        digest,
      });
      done += chunk.size;
      progress(total ? done / total : 1);
    }
  }
  const resources: { id: string; value: unknown }[] = [];
  for (const resourceId of (board.studio as any)?.resourceIds || []) {
    const value = await getRecord("resources", resourceId);
    if (!value) throw Error(`Prepared data snapshot missing: ${resourceId}`);
    resources.push({ id: resourceId, value });
  }
  return {
    format: "bangon-episode",
    version: 1,
    id,
    createdAt: new Date().toISOString(),
    board: copy(board),
    assets: copy(included).map((a) => ({ ...a, filmstrip: undefined })),
    parts,
    resources,
  };
}
export async function renderBackupPart(
  backup: EpisodeBackup,
  index: number,
  read = getMedia,
) {
  const part = backup.parts[index];
  if (!part) throw Error("Unknown backup volume.");
  const blob = await read(part.assetId);
  if (!blob) throw Error("Source disappeared during backup.");
  const chunk = blob.slice(part.offset, part.offset + part.size);
  if ((await digestChunk(chunk)) !== part.digest)
    throw Error("Source changed during backup. Prepare a new complete backup.");
  return new Blob(
    [
      (await zipFile({
        "part.json": strToU8(
          JSON.stringify({ backupId: backup.id, index, ...part }),
        ),
        "data.bin": new Uint8Array(await chunk.arrayBuffer()),
      })) as BlobPart,
    ],
    { type: "application/zip" },
  );
}
export function validateBackup(value: unknown): asserts value is EpisodeBackup {
  const v = value as EpisodeBackup;
  if (
    !v ||
    v.format !== "bangon-episode" ||
    v.version !== 1 ||
    !isBoard(v.board) ||
    !Array.isArray(v.assets) ||
    v.assets.length > MAX_ASSETS ||
    !Array.isArray(v.parts) ||
    v.parts.length > 512 ||
    typeof v.id !== "string" ||
    v.id.length > 100
  )
    throw Error("Invalid complete-episode manifest.");
  const ids = new Set<string>(),
    names = new Set<string>();
  let total = 0;
  for (const a of v.assets) {
    if (
      !a ||
      !validMediaMetadata(a) ||
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(a.id) ||
      ids.has(a.id) ||
      !["image", "video"].includes(a.type) ||
      typeof a.name !== "string" ||
      a.name.length > 300 ||
      typeof a.mime !== "string" ||
      !/^(image|video)\/[a-zA-Z0-9.+-]+$/.test(a.mime) ||
      !Number.isInteger(a.size) ||
      a.size <= 0 ||
      a.size > MAX_SOURCE_BYTES ||
      !Number.isFinite(a.duration) ||
      a.duration < 0 ||
      !Number.isFinite(a.width) ||
      !Number.isFinite(a.height) ||
      a.width <= 0 ||
      a.height <= 0 ||
      a.width * a.height > 64000000 ||
      typeof a.thumbnail !== "string" ||
      a.thumbnail.length > 1000000
    )
      throw Error("Invalid or duplicate source in episode manifest.");
    ids.add(a.id);
    total += a.size;
  }
  if (total > MAX_TOTAL_BYTES)
    throw Error("Episode exceeds the bounded transfer limit.");
  for (const p of v.parts) {
    if (
      !p ||
      typeof p.name !== "string" ||
      !/^[^/\\]{1,200}\.touchline\.part\d{4}\.zip$/.test(p.name) ||
      names.has(p.name) ||
      !ids.has(p.assetId) ||
      !Number.isInteger(p.offset) ||
      p.offset < 0 ||
      !Number.isInteger(p.size) ||
      p.size <= 0 ||
      p.size > BACKUP_CHUNK_BYTES ||
      !/^[a-f0-9]{64}$/.test(p.digest)
    )
      throw Error("Invalid backup volume metadata.");
    names.add(p.name);
  }
  for (const a of v.assets) {
    const parts = v.parts
      .filter((p) => p.assetId === a.id)
      .sort((a, b) => a.offset - b.offset);
    let cursor = 0;
    for (const p of parts) {
      if (p.offset !== cursor)
        throw Error("Backup volumes overlap or leave a source gap.");
      cursor += p.size;
    }
    if (cursor !== a.size)
      throw Error("Source length does not match its backup volumes.");
  }
  if ([...episodeMediaIds(v.board, v.assets)].some((id) => !ids.has(id)))
    throw Error("Manifest omits a referenced source.");
  if (
    v.resources !== undefined &&
    (!Array.isArray(v.resources) ||
      v.resources.length > 500 ||
      v.resources.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          !/^[a-zA-Z0-9-]{1,150}$/.test(r.id) ||
          !r.value,
      ) ||
      new Set(v.resources.map((r) => r.id)).size !== v.resources.length)
  )
    throw Error("Invalid prepared data snapshots.");
  if (
    v.board.studio?.resourceIds?.some(
      (id) => !v.resources?.some((r) => r.id === id),
    )
  )
    throw Error("Prepared data snapshot missing from episode backup.");
}
async function removeStaging(keys: string[]) {
  const db = await mediaDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("staging", "readwrite");
    keys.forEach((key) => tx.objectStore("staging").delete(key));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
/** Interrupted imports are isolated from published media; reclaim only expired staging. */
export async function clearExpiredImportStaging(now = Date.now()) {
  const db = await mediaDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("staging", "readwrite");
    const cursor = tx.objectStore("staging").openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      if (typeof item.value?.at === "number" && item.value.at < now - 86400000)
        item.delete();
      item.continue();
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function importEpisodeBackup(
  files: File[],
  progress: (n: number) => void = () => {},
  accept: (b: Board) => boolean = () => true,
) {
  await clearExpiredImportStaging();
  const manifests = files.filter((f) =>
    /\.touchline\.episode\.json$/i.test(f.name),
  );
  if (manifests.length !== 1)
    throw Error(
      "Select exactly one episode manifest and every numbered ZIP volume together.",
    );
  const manifest = manifests[0];
  if (manifest.size > 40 * 1048576)
    throw Error("Episode manifest is too large.");
  const v = JSON.parse(await manifest.text());
  validateBackup(v);
  if (!accept(v.board))
    throw Error(
      "The episode match context is invalid. No source files were imported.",
    );
  const byName = new Map(files.map((f) => [f.name, f]));
  if (
    byName.size !== files.length ||
    files.length !== v.parts.length + 1 ||
    v.parts.some((p) => !byName.has(p.name))
  )
    throw Error(
      "Backup is incomplete: select the manifest and every numbered volume. No episode was changed.",
    );
  const staging = uid(),
    keys: string[] = [];
  try {
    const estimate = await globalThis.navigator?.storage
        ?.estimate?.()
        .catch(() => null),
      sourceBytes = v.assets.reduce((n, a) => n + a.size, 0);
    if (
      estimate?.quota &&
      estimate.usage !== undefined &&
      estimate.quota - estimate.usage < sourceBytes * 2.1
    )
      throw Error(
        "Import needs temporary space for validation and final media. Free storage or use another device; existing episodes are unchanged.",
      );
    for (let i = 0; i < v.parts.length; i++) {
      const expected = v.parts[i],
        file = byName.get(expected.name)!;
      if (file.size > BACKUP_CHUNK_BYTES + 2 * 1048576)
        throw Error("A backup volume is too large.");
      const zip = await unzipFile(new Uint8Array(await file.arrayBuffer()));
      if (!zip["part.json"] || !zip["data.bin"])
        throw Error(`Invalid ZIP volume ${i + 1}.`);
      const part = JSON.parse(strFromU8(zip["part.json"]));
      const blob = new Blob([zip["data.bin"] as BlobPart]);
      if (
        part.backupId !== v.id ||
        part.index !== i ||
        part.assetId !== expected.assetId ||
        part.offset !== expected.offset ||
        blob.size !== expected.size ||
        (await digestChunk(blob)) !== expected.digest
      )
        throw Error(
          `Volume ${i + 1} is corrupt or belongs to a different backup.`,
        );
      const key = `${staging}:${i}`;
      keys.push(key);
      await putRecord("staging", key, { blob, at: Date.now() });
      progress((i + 1) / (v.parts.length || 1));
    }
    const remap: Record<string, string> = {};
    v.assets.forEach((a) => (remap[a.id] = uid()));
    const items: { asset: MediaAsset; blob: Blob }[] = [];
    for (const a of v.assets) {
      const indexed = v.parts
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.assetId === a.id)
        .sort((a, b) => a.p.offset - b.p.offset);
      const chunks: Blob[] = [];
      for (const { i } of indexed) {
        const staged = await getRecord<{ blob: Blob; at: number }>(
          "staging",
          `${staging}:${i}`,
        );
        const chunk = staged?.blob;
        if (!chunk)
          throw Error("Import was interrupted before a source was complete.");
        chunks.push(chunk);
      }
      const blob = new Blob(chunks, { type: a.mime });
      if (blob.size !== a.size)
        throw Error("Reassembled source length is invalid.");
      items.push({
        asset: {
          ...a,
          id: remap[a.id],
          sourceAssetId: a.sourceAssetId
            ? remap[a.sourceAssetId] || a.sourceAssetId
            : undefined,
          filmstrip: undefined,
        },
        blob,
      });
    }
    const quota = await globalThis.navigator?.storage
      ?.estimate?.()
      .catch(() => null);
    const needed = items.reduce((n, i) => n + i.blob.size, 0);
    if (
      quota?.quota &&
      quota.usage !== undefined &&
      quota.quota - quota.usage < needed * 1.1
    )
      throw Error(
        "Not enough browser storage to publish the complete episode. Existing episodes are retained.",
      );
    await commitImportedMedia(items, v.resources || []);
    return remapEpisodeMedia(copy(v.board), remap);
  } finally {
    await removeStaging(keys).catch(() => {});
  }
}
