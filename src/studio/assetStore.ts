import { mediaDB, saveMedia, getMedia } from "../media";
import { uid, copy, isBoard } from "../core";
import type { Board } from "../types";
import type { MediaAsset } from "./types";
import { mediaKind, validateSourceFile } from "./mediaModel";
export async function putRecord(store: string, id: string, value: unknown) {
  const db = await mediaDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value, id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onabort = t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}
export async function getRecord<T>(
  store: string,
  id: string,
): Promise<T | null> {
  const db = await mediaDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => {
      db.close();
      resolve(r.result || null);
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
export async function listAssets(): Promise<MediaAsset[]> {
  const db = await mediaDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction("meta").objectStore("meta").getAll();
    r.onsuccess = () => {
      db.close();
      resolve(
        r.result.sort((a: MediaAsset, b: MediaAsset) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
const saves = new Map<string, Promise<void>>();
function ordered(id: string, run: () => Promise<void>) {
  const work = (saves.get(id) || Promise.resolve()).catch(() => {}).then(run);
  saves.set(id, work);
  void work
    .finally(() => {
      if (saves.get(id) === work) saves.delete(id);
    })
    .catch(() => {});
  return work;
}
export interface EpisodeCheckpoint {
  at: string;
  label: string;
  board: Board;
}
interface EpisodeRecovery {
  previous?: EpisodeCheckpoint;
  manual: EpisodeCheckpoint[];
}
/** Per-episode ordering plus an atomic previous-valid/head transaction. No media blobs are copied. */
export function saveProject(b: Board): Promise<void> {
  if (!isBoard(b))
    return Promise.reject(
      Error("Invalid episode; the previous valid save is retained."),
    );
  return ordered(b.id, async () => {
    const db = await mediaDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["projects", "checkpoints"], "readwrite"),
        projects = tx.objectStore("projects"),
        history = tx.objectStore("checkpoints");
      const old = projects.get(b.id),
        recover = history.get(b.id);
      let remaining = 2;
      const write = () => {
        if (--remaining) return;
        const value: EpisodeRecovery = recover.result || { manual: [] };
        if (isBoard(old.result))
          value.previous = {
            at: new Date().toISOString(),
            label: "Previous valid save",
            board: old.result,
          };
        try {
          history.put(value, b.id);
          projects.put(b, b.id);
        } catch {
          // A failed clone must roll back the checkpoint and head together.
          tx.abort();
        }
      };
      old.onsuccess = write;
      recover.onsuccess = write;
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(
          tx.error ||
            Error("Episode save interrupted; the last valid save is retained."),
        );
      };
    });
  });
}
const recoveryNotices = new Map<string, string>();
export const recoveredEpisode = (id: string) => recoveryNotices.get(id);
export async function loadProject(id: string) {
  const b = await getRecord<Board>("projects", id);
  if (isBoard(b)) {
    recoveryNotices.delete(id);
    return b;
  }
  const recovery = (await listCheckpoints(id)).sort((a, b) =>
    b.at.localeCompare(a.at),
  )[0];
  if (recovery) {
    recoveryNotices.set(
      id,
      "Recovered the latest valid episode checkpoint. Inspect it and save before filming.",
    );
    return copy(recovery.board);
  }
  return null;
}
export async function listCheckpoints(id: string) {
  const r = await getRecord<EpisodeRecovery>("checkpoints", id);
  return [...(r?.manual || []), ...(r?.previous ? [r.previous] : [])].filter(
    (c) => isBoard(c.board),
  );
}
export async function checkpointProject(b: Board, label: string) {
  return ordered(b.id, async () => {
    const current = (await getRecord<EpisodeRecovery>("checkpoints", b.id)) || {
      manual: [],
    };
    current.manual = [
      {
        at: new Date().toISOString(),
        label: label.slice(0, 100),
        board: copy(b),
      },
      ...current.manual,
    ].slice(0, 3);
    await putRecord("checkpoints", b.id, current);
  });
}
/** Validate everything before one transaction publishes any newly imported media. */
export async function commitImportedMedia(
  items: { asset: MediaAsset; blob: Blob }[],
  resources: { id: string; value: unknown }[] = [],
) {
  const db = await mediaDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["assets", "meta", "resources"], "readwrite");
    try {
      for (const item of items) {
        tx.objectStore("assets").put(item.blob, item.asset.id);
        tx.objectStore("meta").put(item.asset, item.asset.id);
      }
      for (const resource of resources) {
        const store = tx.objectStore("resources"),
          existing = store.get(resource.id);
        existing.onsuccess = () => {
          if (existing.result !== undefined) {
            if (
              JSON.stringify(existing.result) !== JSON.stringify(resource.value)
            )
              tx.abort();
          } else store.put(resource.value, resource.id);
        };
      }
    } catch (error) {
      tx.abort();
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        tx.error ||
          Error("Import interrupted. The previous episode is unchanged."),
      );
    };
  });
}
/** Decode a preview and bounded packet metadata; the complete File is never converted to an ArrayBuffer. */
export async function inspectAsset(file: File): Promise<MediaAsset> {
  validateSourceFile(file);
  const type = mediaKind(file)!,
    url = URL.createObjectURL(file);
  const element =
    type === "video" ? document.createElement("video") : new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            Error(
              "Preview timed out. Try a browser-supported H.264 MP4, WebM or picture.",
            ),
          ),
        15000,
      );
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      element.onerror = () => {
        clearTimeout(timeout);
        reject(
          Error(
            "This browser cannot decode this file or codec. MOV is a container; try H.264 MP4 if its codec is unsupported.",
          ),
        );
      };
      if (element instanceof HTMLVideoElement) {
        element.muted = true;
        element.playsInline = true;
        element.preload = "auto";
        element.onloadeddata = done;
      } else element.onload = done;
      element.src = url;
    });
    const video = element instanceof HTMLVideoElement,
      width = video ? element.videoWidth : element.naturalWidth,
      height = video ? element.videoHeight : element.naturalHeight,
      duration = video ? element.duration : 0;
    if (
      !width ||
      !height ||
      width * height > 64000000 ||
      (video && (!Number.isFinite(duration) || duration <= 0))
    )
      throw Error(
        "The source has no readable frames or exceeds the 64-megapixel picture limit.",
      );
    const thumb = document.createElement("canvas"),
      scale = Math.min(320 / width, 240 / height, 1);
    thumb.width = Math.round(width * scale);
    thumb.height = Math.round(height * scale);
    thumb.getContext("2d")!.drawImage(element, 0, 0, thumb.width, thumb.height);
    let fps = 25,
      measuredFps: number | undefined,
      timing: MediaAsset["timing"] = "estimated";
    if (video)
      try {
        const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
        const input = new Input({
          source: new BlobSource(file),
          formats: ALL_FORMATS,
        });
        try {
          const track = await input.getPrimaryVideoTrack();
          if (track) {
            const stats = await track.computePacketStats(90);
            if (
              Number.isFinite(stats.averagePacketRate) &&
              stats.averagePacketRate > 0
            ) {
              measuredFps = stats.averagePacketRate;
              fps = [24, 25, 30, 50, 60].reduce(
                (a, b) =>
                  Math.abs(b - measuredFps!) < Math.abs(a - measuredFps!)
                    ? b
                    : a,
                25,
              );
              timing = "packet-average";
            }
          }
        } finally {
          input.dispose();
        }
      } catch {
        /* Playback remains available; frame steps are explicitly approximate. */
      }
    let fingerprint: string | undefined;
    if (crypto.subtle) {
      const edge = 1024 * 1024,
        parts =
          file.size > 2 * edge
            ? [file.slice(0, edge), file.slice(-edge)]
            : [file];
      const sample = await new Blob([
        String(file.size),
        ...parts,
      ]).arrayBuffer();
      fingerprint = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", sample)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
    }
    return {
      id: uid(),
      name: file.name,
      type,
      mime: file.type || (type === "video" ? "video/mp4" : "image/png"),
      size: file.size,
      width,
      height,
      duration,
      fps,
      measuredFps,
      timing,
      fingerprint,
      thumbnail: thumb.toDataURL("image/jpeg", 0.8),
      createdAt: new Date().toISOString(),
    };
  } finally {
    if (element instanceof HTMLVideoElement) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    URL.revokeObjectURL(url);
  }
}
export async function persistAsset(
  asset: MediaAsset,
  blob: Blob,
): Promise<void> {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (
    estimate?.quota &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < blob.size * 1.05
  )
    throw Error(
      "There is not enough browser storage for this source. Back up the project and free space, or import a shorter clip.",
    );
  const db = await mediaDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(["assets", "meta"], "readwrite");
    t.objectStore("assets").put(blob, asset.id);
    t.objectStore("meta").put(asset, asset.id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(
        t.error ||
          Error("Source storage failed. The previous source was retained."),
      );
    };
  });
}
export async function importAsset(file: File): Promise<MediaAsset> {
  const asset = await inspectAsset(file);
  await persistAsset(asset, file);
  return asset;
}
export async function deleteAsset(id: string): Promise<void> {
  const db = await mediaDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(["assets", "meta"], "readwrite");
    t.objectStore("assets").delete(id);
    t.objectStore("meta").delete(id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error);
    };
  });
}
export async function ensureFilmstrip(
  asset: MediaAsset,
): Promise<MediaAsset | null> {
  if (asset.type !== "video" || asset.filmstrip?.length) return null;
  const blob = await getMedia(asset.id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob),
    v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(Error("Filmstrip preview timed out.")),
        12000,
      );
      v.onloadeddata = () => {
        clearTimeout(t);
        resolve();
      };
      v.onerror = () => {
        clearTimeout(t);
        reject(Error("Preview unavailable."));
      };
      v.src = url;
    });
    const frames: string[] = [];
    for (let i = 0; i < 8; i++) {
      const time = Math.max(
        0,
        Math.min(asset.duration - 0.001, (i / 8) * asset.duration),
      );
      if (Math.abs(v.currentTime - time) > 0.001)
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(
            () => reject(Error("Preview frame unavailable.")),
            6000,
          );
          v.onseeked = () => {
            clearTimeout(t);
            resolve();
          };
          v.currentTime = time;
        });
      const c = document.createElement("canvas"),
        scale = Math.min(160 / asset.width, 100 / asset.height);
      c.width = Math.round(asset.width * scale);
      c.height = Math.round(asset.height * scale);
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      frames.push(c.toDataURL("image/jpeg", 0.65));
    }
    const latest = await getRecord<MediaAsset>("meta", asset.id);
    if (!latest || latest.revision !== asset.revision) return null;
    const next = { ...latest, filmstrip: frames };
    await putRecord("meta", next.id, next);
    return next;
  } finally {
    v.pause();
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
export async function saveFreeze(
  asset: MediaAsset,
  source: HTMLCanvasElement,
  time: number,
): Promise<MediaAsset> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    source.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error("The frame could not be captured.")),
      "image/png",
    ),
  );
  const file = new File(
    [blob],
    `${asset.name.replace(/\.[^.]+$/, "")} · ${time.toFixed(2)}s.png`,
    { type: "image/png" },
  );
  const still = await importAsset(file);
  still.sourceAssetId = asset.id;
  still.sourceTime = time;
  await putRecord("meta", still.id, still);
  return still;
}
export { getMedia, saveMedia };
