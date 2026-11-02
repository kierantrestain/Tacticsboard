import type { Board } from "../types";
import type { MediaAsset } from "./types";
import { copy, uid } from "../core";
/** One reference inventory shared by legacy packs, full backups and missing-media checks. */
export function episodeMediaIds(b: Board, assets: MediaAsset[] = []) {
  const d = b.studio;
  const ids = new Set(
    [
      d?.assetId,
      ...[
        "ink",
        "tracking",
        "landmarks",
        "targets",
        "sourceRanges",
        "sourcePresentations",
        "explainStops",
      ].flatMap((key) => Object.keys((d as any)?.[key] || {})),
      ...(d?.stillOrder || []),
      ...b.scenes.map((s) => s.source?.assetId),
      ...(d?.bookmarks.map((m) => m.assetId) || []),
      ...(d?.cues?.flatMap((c) => [
        c.assetId,
        ...(c.sequence?.map((s) => s.source?.assetId) || []),
      ]) || []),
    ].filter(Boolean) as string[],
  );
  for (const id of ids) {
    const parent = assets.find((a) => a.id === id)?.sourceAssetId;
    if (parent) ids.add(parent);
  }
  return ids;
}
export function remapEpisodeMedia(b: Board, remap: Record<string, string>) {
  const d = b.studio;
  if (!d) return b;
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
      if (key === "ink") record[id].forEach((i: any) => (i.assetId = id));
      if (key === "tracking") record[id].assetId = id;
    }
  }
  if (d.assetId) d.assetId = remap[d.assetId] || d.assetId;
  if (d.stillOrder) d.stillOrder = d.stillOrder.map((id) => remap[id] || id);
  d.bookmarks.forEach((m) => (m.assetId = remap[m.assetId] || m.assetId));
  for (const c of d.cues || []) {
    if (c.assetId) c.assetId = remap[c.assetId] || c.assetId;
    if (c.tracking)
      c.tracking.assetId = remap[c.tracking.assetId] || c.tracking.assetId;
    c.ink.forEach((i) => (i.assetId = remap[i.assetId] || i.assetId));
    c.sequence?.forEach((s) => {
      if (s.source)
        s.source.assetId = remap[s.source.assetId] || s.source.assetId;
    });
  }
  b.scenes.forEach((s) => {
    if (s.source)
      s.source.assetId = remap[s.source.assetId] || s.source.assetId;
  });
  return b;
}
export function duplicateEpisode(b: Board) {
  const next = copy(b);
  next.id = uid();
  next.title = (b.title + " · copy").slice(0, 120);
  return next;
}
