import {
  Play,
  Pause,
  SkipBack,
  Repeat2,
  Plus,
  Trash2,
  Clock3,
} from "lucide-react";
import { useStudio } from "../store";
import { totalDuration } from "../core";
import type { Scene } from "../types";
function MiniPitch({
  scene,
  colors,
}: {
  scene: Scene;
  colors: { home: string; away: string };
}) {
  return (
    <svg viewBox="0 0 150 84" aria-hidden="true">
      <rect x="0" y="0" width="150" height="84" fill="#1c3b2d" />
      <rect
        x="8"
        y="6"
        width="134"
        height="72"
        fill="none"
        stroke="#abc5ad"
        strokeOpacity=".22"
      />
      <path
        d="M75 6V78M8 26H26V58H8M142 26H124V58H142"
        stroke="#abc5ad"
        strokeOpacity=".22"
        fill="none"
      />
      <circle
        cx="75"
        cy="42"
        r="11"
        stroke="#abc5ad"
        strokeOpacity=".22"
        fill="none"
      />
      {scene.players.map((p) => (
        <circle
          key={p.uid}
          cx={8 + p.x * 134}
          cy={6 + p.y * 72}
          r="2.7"
          fill={colors[p.side]}
        />
      ))}
      <circle
        cx={8 + scene.ball.x * 134}
        cy={6 + scene.ball.y * 72}
        r="1.7"
        fill="white"
      />
    </svg>
  );
}
export default function Timeline() {
  const s = useStudio(),
    { board } = s;
  if (!board) return null;
  const active = board.scenes.find((x) => x.id === board.activeScene)!;
  const time = s.previewTime ?? 0,
    total = totalDuration(board);
  return (
    <section className="timeline" aria-label="Animation scene timeline">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">STORYBOARD</span>
          <span className="timeline-subtitle">
            Build the play, phase by phase
          </span>
        </div>
        <div className="playback">
          <button
            className="icon-button"
            title="Return to beginning"
            onClick={() =>
              s.set({ playing: false, previewTime: 0, playhead: 0 })
            }
          >
            <SkipBack size={16} />
          </button>
          <button
            className="play-button"
            title={s.playing ? "Pause animation" : "Play animation (Space)"}
            aria-label={s.playing ? "Pause animation" : "Play animation"}
            onClick={() => {
              if (board.scenes.length < 2) {
                s.notify(
                  "Add a second phase and move the players to animate a sequence.",
                );
                return;
              }
              s.set({
                playing: !s.playing,
                playhead:
                  (s.previewTime ?? 0) >= total ? 0 : (s.previewTime ?? 0),
              });
            }}
          >
            {s.playing ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <input
            aria-label="Animation position"
            type="range"
            min="0"
            max={total}
            step=".02"
            value={Math.min(time, total)}
            onChange={(e) =>
              s.set({
                playing: false,
                previewTime: Number(e.target.value),
                playhead: Number(e.target.value),
              })
            }
          />
          <span className="playback-time">
            {time.toFixed(1)} / {total.toFixed(1)}s
          </span>
          <select
            aria-label="Playback speed"
            value={s.speed}
            onChange={(e) => s.set({ speed: Number(e.target.value) })}
          >
            {[0.5, 1, 1.5, 2].map((x) => (
              <option key={x} value={x}>
                {x}×
              </option>
            ))}
          </select>
          <button
            className={`icon-button ${s.loop ? "active" : ""}`}
            title="Loop playback"
            aria-label="Loop animation"
            aria-pressed={s.loop}
            onClick={() => s.set({ loop: !s.loop })}
          >
            <Repeat2 size={16} />
          </button>
        </div>
        <button className="secondary-button add-phase" onClick={s.addScene}>
          <Plus size={14} />
          Add phase
        </button>
      </div>
      <div className="scene-track">
        {board.scenes.map((scene, i) => (
          <div
            key={scene.id}
            className={`scene-card ${scene.id === board.activeScene ? "active" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`Open phase ${i + 1}: ${scene.title}`}
            onClick={() => s.selectScene(scene.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") s.selectScene(scene.id);
            }}
          >
            <div className="scene-thumb">
              <MiniPitch scene={scene} colors={board.colors} />
              <span className="scene-order">
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                className="scene-delete"
                aria-label={`Delete phase ${i + 1}`}
                title="Delete phase"
                onClick={(e) => {
                  e.stopPropagation();
                  s.deleteScene(scene.id);
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
            <div className="scene-info">
              <input
                aria-label={`Phase ${i + 1} title`}
                key={scene.id + scene.title}
                defaultValue={scene.title}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (e.target.value !== scene.title)
                    s.commit((b) => {
                      b.scenes.find((z) => z.id === scene.id)!.title =
                        e.target.value.slice(0, 60) || `Phase ${i + 1}`;
                    });
                }}
              />
              <span>
                <Clock3 size={10} />
                {scene.duration}s
              </span>
            </div>
          </div>
        ))}
        <button className="new-scene-card" onClick={s.addScene}>
          <Plus size={22} />
          <span>Next phase</span>
        </button>
        <div className="scene-note">
          <span className="eyebrow">PRESENTER NOTE</span>
          <textarea
            key={active.id}
            defaultValue={active.note}
            rows={2}
            placeholder="What should the audience notice in this phase?"
            onBlur={(e) =>
              s.commit((b) => {
                b.scenes.find((x) => x.id === active.id)!.note = e.target.value;
              })
            }
          />
          <label>
            Phase duration{" "}
            <input
              type="number"
              aria-label="Current phase duration in seconds"
              min=".5"
              max="30"
              step=".5"
              value={active.duration}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0.5 && n <= 30)
                  s.commit((b) => {
                    b.scenes.find((x) => x.id === active.id)!.duration = n;
                  });
              }}
            />
            s
          </label>
        </div>
      </div>
    </section>
  );
}
