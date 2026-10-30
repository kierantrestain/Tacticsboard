import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { copy, download, filename, isBoard } from "../core";
import type { Board } from "../types";
import type { MediaAsset } from "./types";
import { defaultBroadcast } from "./types";
import type { BroadcastStyle } from "./types";
import { getMedia, saveMedia, putRecord } from "./assetStore";
import { uid } from "../core";
export function productionFrame(
  raw: CanvasImageSource,
  width: number,
  height: number,
  rawWidth: number,
  rawHeight: number,
  title: string,
  sub = "TACTICAL ANALYSIS",
  broadcast?: BroadcastStyle,
  score?: {
    home: string;
    away: string;
    homeScore?: string | null;
    awayScore?: string | null;
    completed?: boolean;
  },
) {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!,
    k = width / 1920;
  const style = { ...defaultBroadcast(), ...broadcast };
  const text = (value: string, max: number) => {
    let fitted = value;
    while (fitted.length > 1 && ctx.measureText(fitted).width > max)
      fitted = fitted.slice(0, -1);
    return fitted === value ? value : fitted.slice(0, -1) + "…";
  };
  ctx.fillStyle = "#0b1410";
  ctx.fillRect(0, 0, width, height);
  if (style.showHeader) {
    ctx.fillStyle = "#f2f7ed";
    ctx.font = `800 ${27 * k}px "Manrope Variable",Arial`;
    ctx.fillText(text(style.channel, 700 * k), 55 * k, 54 * k);
    ctx.fillStyle = style.accent;
    ctx.font = `600 ${10 * k}px "Inter Variable",Arial`;
    ctx.fillText(
      text(style.programme + "  /  " + sub, 700 * k),
      56 * k,
      76 * k,
    );
  }
  if (style.showScore && score) {
    const x = width - 450 * k,
      y = 30 * k;
    ctx.fillStyle = "#1d2d20";
    ctx.fillRect(x, y, 395 * k, 48 * k);
    ctx.fillStyle = style.accent;
    ctx.fillRect(x + 142 * k, y, 110 * k, 48 * k);
    ctx.textAlign = "center";
    ctx.font = `700 ${18 * k}px "Inter Variable",Arial`;
    ctx.fillStyle = "#e5f0dc";
    ctx.fillText(text(score.home, 125 * k), x + 71 * k, y + 31 * k);
    ctx.fillText(text(score.away, 125 * k), x + 324 * k, y + 31 * k);
    ctx.fillStyle = "#18280d";
    ctx.fillText(
      score.completed ? `${score.homeScore} : ${score.awayScore}` : "v",
      x + 197 * k,
      y + 31 * k,
    );
    ctx.textAlign = "left";
  }
  const maxW = width - 70 * k,
    maxH =
      height -
      ((style.showHeader || style.showScore ? 100 : 20) +
        (style.showLowerThird ? 90 : 20)) *
        k,
    ratio = Math.min(maxW / rawWidth, maxH / rawHeight),
    w = rawWidth * ratio,
    h = rawHeight * ratio;
  const top = (style.showHeader || style.showScore ? 100 : 20) * k;
  ctx.drawImage(raw, (width - w) / 2, top + (maxH - h) / 2, w, h);
  if (style.showLowerThird) {
    ctx.fillStyle = style.accent;
    ctx.fillRect(55 * k, height - 74 * k, 4 * k, 47 * k);
    ctx.font = `600 ${10 * k}px "Inter Variable",Arial`;
    ctx.fillText(
      text(style.subtitle, width - 210 * k),
      74 * k,
      height - 62 * k,
    );
    ctx.fillStyle = "#eff4e8";
    ctx.font = `600 ${25 * k}px "Inter Variable",Arial`;
    ctx.fillText(
      text(style.headline || title, width - 160 * k),
      74 * k,
      height - 29 * k,
    );
  }
  return out;
}
export async function exportPack(board: Board, assets: MediaAsset[]) {
  const b = copy(board),
    ids = new Set(
      [
        b.studio?.assetId,
        ...Object.keys(b.studio?.ink || {}),
        ...Object.keys(b.studio?.tracking || {}),
        ...Object.keys(b.studio?.landmarks || {}),
        ...Object.keys(b.studio?.targets || {}),
        ...Object.keys(b.studio?.sourceRanges || {}),
        ...b.scenes.map((s) => s.source?.assetId),
        ...(b.studio?.bookmarks || []).map((m) => m.assetId),
        ...(b.studio?.cues || []).map((c) => c.assetId),
      ].filter(Boolean) as string[],
    ),
    included = assets.filter((a) => ids.has(a.id));
  const entries: Record<string, Uint8Array> = {},
    meta: MediaAsset[] = [];
  let size = 0;
  for (const id of ids)
    if (!included.some((a) => a.id === id))
      throw Error(
        "A referenced source is missing. Restore the project media before exporting a portable pack.",
      );
  for (const a of included) {
    const blob = await getMedia(a.id);
    if (!blob)
      throw Error(
        `The source “${a.name}” is missing. Restore it before exporting a portable pack.`,
      );
    size += blob.size;
    if (size > 200 * 1048576)
      throw Error(
        "This project exceeds the 200 MB portable-pack limit. Export JSON and keep the original source files with it.",
      );
    entries[`sources/${a.id}.bin`] = new Uint8Array(await blob.arrayBuffer());
    meta.push(a);
  }
  entries["project.json"] = strToU8(
    JSON.stringify({
      format: "touchline-project",
      version: 2,
      board: b,
      assets: meta,
    }),
  );
  return {
    blob: new Blob([zipSync(entries, { level: 0 }) as BlobPart], {
      type: "application/zip",
    }),
    name: filename(b.title) + ".touchline.zip",
  };
}
export async function importPack(file: File): Promise<Board> {
  if (file.size > 210 * 1048576)
    throw Error("Choose a project pack under 210 MB.");
  let total = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      total += entry.originalSize;
      count++;
      if (
        entry.originalSize > 201 * 1048576 ||
        total > 220 * 1048576 ||
        count > 70
      )
        throw Error("This pack exceeds the supported project size.");
      return (
        entry.name === "project.json" ||
        /^sources\/[a-zA-Z0-9-]{1,100}\.bin$/.test(entry.name)
      );
    },
  });
  if (!files["project.json"])
    throw Error("This is not a Touchline project pack.");
  const manifest = JSON.parse(strFromU8(files["project.json"]));
  if (
    manifest.format !== "touchline-project" ||
    manifest.version !== 2 ||
    !isBoard(manifest.board) ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 60
  )
    throw Error("The project manifest is invalid.");
  const b: Board = manifest.board,
    remap: Record<string, string> = {};
  for (const a of manifest.assets) {
    if (
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(a.id) ||
      !["image", "video"].includes(a.type) ||
      typeof a.name !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,/.test(a.thumbnail) ||
      a.thumbnail.length > 1000000 ||
      !Number.isFinite(a.duration)
    )
      throw Error("A media record is invalid.");
    const data = files[`sources/${a.id}.bin`];
    if (!data) throw Error("A source file is missing from this project pack.");
    const id = uid();
    remap[a.id] = id;
    await saveMedia(id, new Blob([data as BlobPart], { type: a.mime }));
    await putRecord("meta", id, { ...a, id, filmstrip: undefined });
  }
  if (b.studio) {
    const d = b.studio;
    for (const key of [
      "ink",
      "landmarks",
      "targets",
      "tracking",
      "sourceRanges",
    ] as const) {
      const record = d[key] as Record<string, any> | undefined;
      if (!record) continue;
      for (const old of Object.keys(record)) {
        const id = remap[old] || old;
        record[id] = record[old];
        if (id !== old) delete record[old];
        if (key === "ink") record[id].forEach((ink: any) => (ink.assetId = id));
        if (key === "tracking") record[id].assetId = id;
      }
    }
    if (d.assetId) d.assetId = remap[d.assetId] || d.assetId;
    d.bookmarks.forEach((m) => (m.assetId = remap[m.assetId] || m.assetId));
    d.cues?.forEach((c) => {
      if (c.assetId) c.assetId = remap[c.assetId] || c.assetId;
      if (c.tracking)
        c.tracking.assetId = remap[c.tracking.assetId] || c.tracking.assetId;
      c.ink.forEach((i) => {
        i.assetId = remap[i.assetId] || i.assetId;
      });
    });
    b.scenes.forEach((s) => {
      if (s.source)
        s.source.assetId = remap[s.source.assetId] || s.source.assetId;
    });
  }
  return b;
}
export async function encodeVideo({
  width = 1920,
  height = 1080,
  fps = 25,
  duration,
  render,
  onProgress,
  signal,
}: {
  width?: number;
  height?: number;
  fps?: number;
  duration: number;
  render: (time: number) => Promise<HTMLCanvasElement>;
  onProgress: (v: number) => void;
  signal: AbortSignal;
}) {
  const {
    Output,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    WebMOutputFormat,
    getFirstEncodableVideoCodec,
    Quality,
  } = await import("mediabunny");
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
    width,
    height,
    frameRate: fps,
    quality: new Quality({ bitrate: 10000000 }),
  });
  if (!codec)
    throw Error(
      "This browser cannot encode an analysis video. Use a current Chromium browser or export a still/project pack.",
    );
  const format =
      codec === "avc"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat(),
    target = new BufferTarget(),
    output = new Output({ format, target }),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!,
    source = new CanvasSource(canvas, {
      codec,
      quality: new Quality({ bitrate: 10000000 }),
    });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  try {
    const frames = Math.ceil(duration * fps);
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw Error("Export cancelled");
      const raw = await render(i / fps);
      ctx.drawImage(raw, 0, 0, width, height);
      await source.add(i / fps, 1 / fps);
      onProgress((i + 1) / frames);
      if (i % 20 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await output.finalize();
    return {
      blob: new Blob([target.buffer!], { type: format.mimeType }),
      extension: format.fileExtension,
    };
  } catch (e) {
    await output.cancel();
    throw e;
  }
}
