import type { Frame } from "../types";
export default function MiniPitch({
  frame,
  colors,
}: {
  frame: Frame;
  colors: { home: string; away: string };
}) {
  return (
    <svg className="ts-mini-pitch" viewBox="0 0 210 132" aria-hidden="true">
      <rect width="210" height="132" rx="4" fill="#1a4638" />
      <path
        d="M8 8H202V124H8ZM105 8V124M8 37H37V95H8M202 37H173V95H202"
        fill="none"
        stroke="#ffffff55"
        strokeWidth="1"
      />
      <circle cx="105" cy="66" r="17" fill="none" stroke="#ffffff55" />
      {frame.drawings
        .filter((d) => ["arrow", "run", "line"].includes(d.type))
        .slice(0, 20)
        .map((d) => (
          <polyline
            key={d.id}
            points={d.points.reduce(
              (s, p, i) => s + (i % 2 ? 8 + p * 116 + " " : 8 + p * 194 + ","),
              "",
            )}
            fill="none"
            stroke={d.color}
            strokeWidth="1.4"
          />
        ))}
      {frame.players.map((p) => (
        <circle
          key={p.uid}
          cx={8 + p.x * 194}
          cy={8 + p.y * 116}
          r="3.5"
          fill={colors[p.side]}
          stroke="#071210"
          strokeWidth="1"
        />
      ))}
      <circle
        cx={8 + frame.ball.x * 194}
        cy={8 + frame.ball.y * 116}
        r="2"
        fill="white"
      />
    </svg>
  );
}
