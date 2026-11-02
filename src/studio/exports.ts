import {analysisResourceIds,validateGraphicResource} from '../football/events/graphic';
import {validateResource} from '../football/events/import';
import { validMediaMetadata } from './mediaModel';
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { copy, download, filename, isBoard } from "../core";
import type { Board } from "../types";
import type { MediaAsset } from "./types";
import { defaultBroadcast } from "./types";
import type { BroadcastStyle } from "./types";
import { getMedia, getRecord, saveMedia, putRecord, commitImportedMedia } from "./assetStore";
import { remapEpisodeMedia, episodeMediaIds } from './episodeModel';
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
    ids = episodeMediaIds(b,assets),
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
        "This project exceeds the legacy ZIP limit. Use Complete episode backup for bounded numbered volumes.",
      );
    entries[`sources/${a.id}.bin`] = new Uint8Array(await blob.arrayBuffer());
    meta.push(a);
  }
  const resources:{id:string;value:unknown}[]=[];
  for(const id of analysisResourceIds(b)){const value=await getRecord('resources',id);if(!value)throw Error('A prepared data snapshot is missing. Restore it before backup.');validateGraphicResource(b,id,value);resources.push({id,value});}
  entries["project.json"] = strToU8(
    JSON.stringify({
      format: "touchline-project",
      version: 2,
      board: b,
      assets: meta,
      resources,
    }),
  );
  if(size+entries['project.json'].length>200*1048576)throw Error('Use Complete episode backup for media and prepared data exceeding the legacy ZIP limit.');
  return {
    blob: new Blob([zipSync(entries, { level: 0 }) as BlobPart], {
      type: "application/zip",
    }),
    name: filename(b.title) + ".touchline.zip",
  };
}
export async function importPack(file: File,accept:(b:Board)=>boolean=()=>true): Promise<Board> {
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
  if(!accept(b))throw Error('The episode match context is invalid. No sources were imported.');
  for (const a of manifest.assets) {
    if (
      !validMediaMetadata(a) ||
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
    if(remap[a.id]||!Number.isInteger(a.size)||a.size!==data.byteLength||typeof a.mime!=='string'||!/^(image|video)\/[a-zA-Z0-9.+-]+$/.test(a.mime))throw Error('Duplicate source, invalid size or media type in project pack.');
    remap[a.id] = uid();
  }
  const items:{asset:MediaAsset;blob:Blob}[]=[];
  for(const a of manifest.assets){
    const id=remap[a.id],data=files[`sources/${a.id}.bin`];
    items.push({blob:new Blob([data as BlobPart],{type:a.mime}),asset:{...a,id,sourceAssetId:a.sourceAssetId?remap[a.sourceAssetId]||a.sourceAssetId:undefined,filmstrip:undefined}});
  }
  if([...episodeMediaIds(b)].some(id=>!remap[id]))throw Error('The pack omits a referenced source. Existing episodes are unchanged.');
  if(manifest.resources!==undefined&&(!Array.isArray(manifest.resources)||manifest.resources.length>500||manifest.resources.some((r:any)=>!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,150}$/.test(r.id)||!r.value)))throw Error('Invalid prepared data snapshots.');
  if(analysisResourceIds(b).some(id=>!manifest.resources?.some((r:any)=>r.id===id)))throw Error('A prepared data snapshot is missing from this pack.');
  for(const r of manifest.resources||[]){if(r.value?.format==='bangon-graphic-resource')validateResource(r.value);validateGraphicResource(b,r.id,r.value);}
  await commitImportedMedia(items,manifest.resources||[]);
  if (b.studio) {
    const d = b.studio;
    for (const key of [
      "ink",
      "landmarks",
      "targets",
      "tracking",
      "sourceRanges",
      "explainStops",
      "sourcePresentations",
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
    for(const g of [d.dataGraphic,...(d.cues||[]).map(c=>c.dataGraphic)])if(g?.alignment)g.alignment.assetId=remap[g.alignment.assetId]||g.alignment.assetId;
    if (d.assetId) d.assetId = remap[d.assetId] || d.assetId;
    if(d.stillOrder)d.stillOrder=d.stillOrder.map(id=>remap[id]||id);
    d.bookmarks.forEach((m) => (m.assetId = remap[m.assetId] || m.assetId));
    d.cues?.forEach((c) => {
      c.sequence?.forEach(s => { if(s.source) s.source.assetId = remap[s.source.assetId] || s.source.assetId; });
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
