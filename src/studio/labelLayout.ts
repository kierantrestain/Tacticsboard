import type { BoardPlayer } from "../types";
import { shortName } from "../core";
/** Try nearby label positions without changing the measured player position. */
export function playerNameOffsets(players: BoardPlayer[], scale = 1) {
  const placed: { left: number; right: number; top: number; bottom: number }[] =
      [],
    offsets = new Map<string, number>();
  for (const p of [...players].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const x = 65 + p.x * 1070,
      y = 48 + p.y * 664,
      width = Math.min(126, shortName(p.name).length * 7.6 + 16) * scale;
    let best = 0,
      bestScore = Infinity;
    for (const offset of [0, -80, 24, -104, 48, -128]) {
      const rect = {
        left: x - width / 2,
        right: x + width / 2,
        top: y + (28 + offset) * scale,
        bottom: y + (49 + offset) * scale,
      };
      let score = Math.abs(offset) * 0.005;
      if (rect.top < 14 || rect.bottom > 746) score += 100;
      for (const other of placed)
        if (
          rect.left < other.right + 3 &&
          rect.right > other.left - 3 &&
          rect.top < other.bottom + 3 &&
          rect.bottom > other.top - 3
        )
          score += 10;
      for (const q of players)
        if (q.uid !== p.uid) {
          const qx = 65 + q.x * 1070,
            qy = 48 + q.y * 664;
          if (
            qx + 20 * scale > rect.left &&
            qx - 20 * scale < rect.right &&
            qy + 20 * scale > rect.top &&
            qy - 20 * scale < rect.bottom
          )
            score += 8;
        }
      if (score < bestScore) {
        best = offset;
        bestScore = score;
      }
    }
    offsets.set(p.uid, best);
    placed.push({
      left: x - width / 2,
      right: x + width / 2,
      top: y + (28 + best) * scale,
      bottom: y + (49 + best) * scale,
    });
  }
  return offsets;
}
