import type { Board, BoardPlayer, Drawing, Frame, Side } from "../types";
import { clamp, formationPoints } from "../core";
import { passingOptions } from './spatialAnalysis';

export const TACTICAL_PRESETS = [
  {
    id: "build",
    name: "Play out",
    shape: "3–2 build-up",
    description: "Split the back line, connect two pivots and hold the width.",
    formation: "3-4-3",
    points: [
      [0.07, 0.5],
      [0.23, 0.22],
      [0.2, 0.5],
      [0.23, 0.78],
      [0.4, 0.36],
      [0.4, 0.64],
      [0.56, 0.09],
      [0.56, 0.91],
      [0.7, 0.27],
      [0.77, 0.5],
      [0.7, 0.73],
    ],
    ball: [0.2, 0.5],
  },
  {
    id: "press",
    name: "High press",
    shape: "Lock the short options",
    description:
      "Push the front line high and keep the supporting units connected.",
    formation: "4-3-3",
    points: [
      [0.12, 0.5],
      [0.46, 0.16],
      [0.43, 0.39],
      [0.43, 0.61],
      [0.46, 0.84],
      [0.6, 0.25],
      [0.57, 0.5],
      [0.6, 0.75],
      [0.76, 0.19],
      [0.82, 0.5],
      [0.76, 0.81],
    ],
    ball: [0.86, 0.5],
  },
  {
    id: "block",
    name: "Low block",
    shape: "Compact 4–4–2",
    description:
      "Protect the centre with two narrow banks and a screening pair.",
    formation: "4-4-2",
    points: [
      [0.055, 0.5],
      [0.16, 0.21],
      [0.14, 0.41],
      [0.14, 0.59],
      [0.16, 0.79],
      [0.29, 0.2],
      [0.27, 0.41],
      [0.27, 0.59],
      [0.29, 0.8],
      [0.43, 0.38],
      [0.43, 0.62],
    ],
    ball: [0.57, 0.35],
  },
  {
    id: "counter",
    name: "Counterattack",
    shape: "Break into space",
    description: "Leave the first pass connected and separate the runners.",
    formation: "4-3-3",
    points: [
      [0.07, 0.5],
      [0.25, 0.17],
      [0.22, 0.4],
      [0.22, 0.6],
      [0.25, 0.83],
      [0.4, 0.31],
      [0.39, 0.52],
      [0.47, 0.7],
      [0.68, 0.12],
      [0.75, 0.44],
      [0.65, 0.87],
    ],
    ball: [0.4, 0.31],
  },
  {
    id: "overload",
    name: "Wide overload",
    shape: "Create the extra player",
    description: "Bring a midfielder and full-back close to the winger.",
    formation: "4-3-3",
    points: [
      [0.07, 0.5],
      [0.49, 0.11],
      [0.28, 0.36],
      [0.28, 0.63],
      [0.38, 0.84],
      [0.61, 0.22],
      [0.44, 0.42],
      [0.49, 0.67],
      [0.75, 0.09],
      [0.76, 0.48],
      [0.69, 0.86],
    ],
    ball: [0.61, 0.22],
  },
  {
    id: "corner",
    name: "Attacking corner",
    shape: "Near / far / edge",
    description: "Stage runs into the box and leave cover for the second ball.",
    formation: "4-3-3",
    points: [
      [0.15, 0.5],
      [0.51, 0.32],
      [0.53, 0.67],
      [0.73, 0.4],
      [0.8, 0.48],
      [0.88, 0.36],
      [0.9, 0.58],
      [0.85, 0.68],
      [0.97, 0.02],
      [0.89, 0.47],
      [0.75, 0.73],
    ],
    ball: [0.99, 0.01],
  },
] as const;
export type PresetId = (typeof TACTICAL_PRESETS)[number]["id"];
export function applyPreset(board: Board, id: PresetId, side: Side) {
  const preset = TACTICAL_PRESETS.find((p) => p.id === id)!;
  const players = board.players.filter((p) => p.side === side);
  if (players.length !== 11)
    throw Error("Load a complete XI before applying a tactical setup.");
  const mirrored = preset.points.map((point) => ({
    x: side === "home" ? point[0] : 1 - point[0],
    y: side === "home" ? point[1] : 1 - point[1],
  }));
  // Match outfield players to slots with minimal movement and a positional
  // preference, rather than assigning by array index after a formation change.
  const slots =
    id === "build"
      ? ["D", "D", "D", "M", "M", "W", "W", "F", "F", "F"]
      : id === "block"
        ? ["D", "D", "D", "D", "W", "M", "M", "W", "F", "F"]
        : ["D", "D", "D", "D", "M", "M", "M", "F", "F", "F"];
  const role = (p: BoardPlayer) =>
    /Goalkeeper|^GK?$/.test(p.position || "")
      ? "G"
      : /Defend|back|^D$/i.test(p.position || "")
        ? "D"
        : /Forward|Strik|Winger|^F$/i.test(p.position || "")
          ? "F"
          : "M";
  const keeper =
      players.find((p) => role(p) === "G") ||
      [...players].sort((a, b) => (side === "home" ? a.x - b.x : b.x - a.x))[0],
    outfield = players.filter((p) => p !== keeper);
  const cost = outfield.map((p) =>
    mirrored.slice(1).map((target, j) => {
      const r = role(p),
        want = slots[j];
      const penalty =
        want === "W"
          ? r === "D" || r === "M"
            ? 0
            : 0.15
          : r === want
            ? 0
            : r === "F" && want === "D"
              ? 0.9
              : r === "D" && want === "F"
                ? 0.7
                : 0.25;
      return (p.x - target.x) ** 2 + (p.y - target.y) ** 2 + penalty;
    }),
  );
  const dp = new Array(1 << 10).fill(Infinity),
    choice = new Array(1 << 10).fill(-1);
  dp[0] = 0;
  for (let mask = 0; mask < dp.length; mask++) {
    let index = 0;
    for (let bits = mask; bits; bits &= bits - 1) index++;
    if (index >= 10) continue;
    for (let slot = 0; slot < 10; slot++)
      if (!(mask & (1 << slot))) {
        const next = mask | (1 << slot),
          value = dp[mask] + cost[index][slot];
        if (value < dp[next]) {
          dp[next] = value;
          choice[next] = slot;
        }
      }
  }
  Object.assign(keeper, mirrored[0]);
  let mask = (1 << 10) - 1;
  for (let index = 9; index >= 0; index--) {
    const slot = choice[mask];
    Object.assign(outfield[index], mirrored[slot + 1]);
    mask ^= 1 << slot;
  }
  board.formations[side] = preset.formation;
  board.ball = {
    x: side === "home" ? preset.ball[0] : 1 - preset.ball[0],
    y: side === "home" ? preset.ball[1] : 1 - preset.ball[1],
  };
  board.settings.shapeSide = side;
  board.settings.ballVisible = true;
}
export function resetPositions(board: Board, side: Side) {
  const points = formationPoints(board.formations[side], side);
  board.players
    .filter((p) => p.side === side)
    .forEach((p, i) => Object.assign(p, points[i]));
}
export function shiftUnit(board: Board, ids: string[], dx: number, dy: number) {
  const players = board.players.filter((p) => ids.includes(p.uid));
  if (!players.length) return;
  const moveX = Math.max(
    0.025 - Math.min(...players.map((p) => p.x)),
    Math.min(dx, 0.975 - Math.max(...players.map((p) => p.x))),
  );
  const moveY = Math.max(
    0.025 - Math.min(...players.map((p) => p.y)),
    Math.min(dy, 0.975 - Math.max(...players.map((p) => p.y))),
  );
  for (const p of players) {
    p.x = clamp(p.x + moveX);
    p.y = clamp(p.y + moveY);
  }
}
export function convexHull(players: { x: number; y: number }[]) {
  const sorted = [...players].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: (typeof sorted)[number], b: typeof a, c: typeof a) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (points: typeof sorted) => {
    const out: typeof sorted = [];
    for (const p of points) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out;
  };
  if (sorted.length < 3) return sorted;
  return [
    ...half(sorted).slice(0, -1),
    ...half([...sorted].reverse()).slice(0, -1),
  ];
}
/** Derived guides follow the players during dragging and interpolation; they are not editable ink. */
export function analysisFrame(board: Board, frame: Frame): Frame {
  const settings = board.settings;
  if (
    !settings.thirds &&
    !settings.teamShape &&
    !settings.teamLines &&
    !settings.passingLanes &&
    !settings.focusPlayer
  )
    return frame;
  const side = settings.shapeSide || "home",
    color = board.colors[side];
  const team = frame.players.filter((p) => p.side === side);
  const outfield = team.filter(
    (p) => !/Goalkeeper|^GK?$/i.test(p.position || ""),
  );
  const drawings: Drawing[] = [];
  const guide = (
    id: string,
    type: Drawing["type"],
    points: number[],
    opacity = 0.7,
    ink = color,
  ): Drawing => ({
    id: "guide:" + id,
    type,
    points,
    color: ink,
    width: 2,
    opacity,
  });
  if (settings.thirds)
    for (const x of [1 / 3, 2 / 3])
      drawings.push(guide("third" + x, "line", [x, 0, x, 1], 0.45, "#ffffff"));
  if (settings.teamShape && outfield.length > 2)
    drawings.push(
      guide(
        "hull",
        "triangle",
        convexHull(outfield).flatMap((p) => [p.x, p.y]),
        0.55,
      ),
    );
  if (settings.teamLines) {
    const lines: BoardPlayer[][] = [];
    for (const p of [...outfield].sort((a, b) => a.x - b.x)) {
      const last = lines.at(-1);
      if (last && Math.abs(p.x - last[0].x) < 0.095) last.push(p);
      else lines.push([p]);
    }
    lines.forEach((line, i) => {
      if (line.length > 1)
        drawings.push(
          guide(
            "line" + i,
            "line",
            line.sort((a, b) => a.y - b.y).flatMap((p) => [p.x, p.y]),
            0.8,
          ),
        );
    });
  }
  const focused = frame.players.find((p) => p.uid === settings.focusPlayer);
  if(settings.passingLanes){const owner=frame.players.find(p=>p.uid===frame.ball.carrierId);if(owner)for(const option of passingOptions(frame))drawings.push(guide('pass:'+option.receiver.uid,'line',[owner.x,owner.y,option.receiver.x,option.receiver.y],.65,option.blocked?'#ffbf83':'#dfff81'));}
  if (focused)
    drawings.push(
      guide(
        "focus",
        "ellipse",
        [
          focused.x - 0.03,
          focused.y - 0.045,
          focused.x + 0.03,
          focused.y + 0.045,
        ],
        1,
        "#e1ff87",
      ),
    );
  return {
    ...frame,
    drawings: [...drawings, ...frame.drawings],
    players: focused
      ? frame.players.map((p) => ({
          ...p,
          opacity: (p.opacity ?? 1) * (p.uid === focused.uid ? 1 : 0.28),
        }))
      : frame.players,
  };
}
