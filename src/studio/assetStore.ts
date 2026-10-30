import { mediaDB, saveMedia, getMedia } from "../media";
import { uid } from "../core";
import type { Board } from "../types";
import type { MediaAsset } from "./types";
export async function putRecord(store: string, id: string, value: unknown) {
  const db = await mediaDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value, id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
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
export const saveProject = (b: Board) => putRecord("projects", b.id, b);
export const loadProject = (id: string) => getRecord<Board>("projects", id);
export async function importAsset(file: File): Promise<MediaAsset> {
  if (file.size > 200 * 1024 * 1024)
    throw Error(
      "Use a file smaller than 200 MB. Trim longer recordings before importing.",
    );
  const type = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/") ||
        /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name)
      ? "video"
      : null;
  if (!type) throw Error("Choose a supported image, MP4, MOV or WebM file.");
  const url = URL.createObjectURL(file);
  let element: HTMLVideoElement | HTMLImageElement;
  try {
    element = type === "video" ? document.createElement("video") : new Image();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            Error(
              "This browser could not decode the file. Try an H.264 MP4 or a WebM clip.",
            ),
          ),
        12000,
      );
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      element.onerror = () => {
        clearTimeout(timeout);
        reject(
          Error("This file or its codec is not supported by the browser."),
        );
      };
      if (element instanceof HTMLVideoElement) {
        element.muted = true;
        element.preload = "auto";
        element.onloadeddata = done;
      } else element.onload = done;
      element.src = url;
    });
    const width =
        element instanceof HTMLVideoElement
          ? element.videoWidth
          : element.naturalWidth,
      height =
        element instanceof HTMLVideoElement
          ? element.videoHeight
          : element.naturalHeight,
      duration = element instanceof HTMLVideoElement ? element.duration : 0;
    if (
      !width ||
      !height ||
      (type === "video" && (!Number.isFinite(duration) || duration <= 0))
    )
      throw Error("The file has no readable video frames.");
    const thumb = document.createElement("canvas");
    thumb.width = 320;
    thumb.height = Math.round((320 * height) / width);
    thumb.getContext("2d")!.drawImage(element, 0, 0, thumb.width, thumb.height);
    let fps = 25;
    if (type === "video") {
      try {
        const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
        const input = new Input({
          source: new BlobSource(file),
          formats: ALL_FORMATS,
        });
        const track = await input.getPrimaryVideoTrack();
        if (track) {
          const stats = await track.computePacketStats(90);
          fps = [24, 25, 30, 50, 60].reduce(
            (best, f) =>
              Math.abs(f - stats.averagePacketRate) <
              Math.abs(best - stats.averagePacketRate)
                ? f
                : best,
            25,
          );
        }
        input.dispose();
      } catch {}
    }
    const asset: MediaAsset = {
      id: uid(),
      name: file.name,
      type,
      mime: file.type,
      size: file.size,
      width,
      height,
      duration,
      fps,
      thumbnail: thumb.toDataURL("image/jpeg", 0.75),
      createdAt: new Date().toISOString(),
    };
    await saveMedia(asset.id, file);
    await putRecord("meta", asset.id, asset);
    return asset;
  } finally {
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
