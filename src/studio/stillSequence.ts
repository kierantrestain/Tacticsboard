import type { Scene } from "../types";
import type { MediaAsset, StudioDocument } from "./types";
import { uid } from "../core";
export function buildStillSequence(
  ids: string[],
  assets: MediaAsset[],
  desk: StudioDocument,
  seconds: number,
): Scene[] {
  if (ids.length < 2 || ids.length > 20)
    throw Error("Choose between two and twenty reviewed stills.");
  if (new Set(ids).size !== ids.length)
    throw Error("Each still can appear only once in a sequence.");
  const duration = Math.max(0.25, Math.min(20, seconds));
  return ids.map((id, i) => {
    const asset = assets.find((a) => a.id === id),
      sequence = desk.tracking[id],
      frame = sequence?.frames[0];
    if (asset?.type !== "image" || !sequence?.reviewed || !frame)
      throw Error("Map and review every still before building the sequence.");
    if (sequence.targets.some((t) => !t.playerId))
      throw Error(
        "Confirm every player identity in each still so the same player can be linked between pictures.",
      );
    const seen = new Set<string>();
    const players = frame.points
      .filter(
        (p) =>
          !p.rejected && p.pitch.x >= 0 && p.pitch.x <= 1 && p.pitch.y >= 0 && p.pitch.y <= 1,
      )
      .map((p) => {
        const target = sequence.targets.find((t) => t.id === p.id);
        if (!target?.playerId)
          throw Error("A reviewed marker has no player identity.");
        const stableId = target.side + ":" + target.playerId;
        if (seen.has(stableId))
          throw Error(
            "The same player was assigned to two markers in a still.",
          );
        seen.add(stableId);
        return {
          uid: stableId,
          playerId: target.playerId,
          side: target.side,
          name: target.name,
          number: target.number,
          x: p.pitch.x,
          y: p.pitch.y,
          opacity: p.review ? 0.45 : 1,
        };
      });
    if (!players.length)
      throw Error("A still has no observed players inside the mapped pitch.");
    return {
      id: uid(),
      title: `Still ${String(i + 1).padStart(2, "0")}`,
      duration,
      note: `Source: ${asset.name}. Movement between these stills is illustrative, not measured tracking.`,
      source: {
        assetId: id,
        time: asset.referenceTime ?? asset.sourceTime ?? frame.time,
        review: frame.points.some((p) => p.review),
      },
      players,
      drawings: (desk.ink[id]||[]).filter(i=>i.space==='pitch'&&!i.hidden).map(i=>({...i,id:uid()})),
      ball: { x: 0.5, y: 0.5 },
    };
  });
}
