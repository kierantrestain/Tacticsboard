import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Focus,
  RotateCcw,
  Target,
  Users,
  FlipVertical2,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import {
  TACTICAL_PRESETS,
  applyPreset,
  resetPositions,
  shiftUnit,
} from "./tactics";
import type { Side } from "../types";
import { copy, uid } from "../core";
export default function TacticsPanel() {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!;
  const [side, setSide] = useState<Side>(b.settings.shapeSide || "home"),
    [newPhase, setNewPhase] = useState(true);
  const team = s.catalogue?.teams.find(
    (t) => t.id === (side === "home" ? b.homeTeamId : b.awayTeamId),
  );
  const selected = b.players.filter((p) => s.selected.includes(p.uid));
  const toggle = (key: "thirds" | "teamShape" | "teamLines" | "lanes") =>
    s.commit((b) => {
      b.settings[key] = !b.settings[key];
      b.settings.shapeSide = side;
    });
  return (
    <aside className="ts-panel">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">TACTICAL WORKSPACE</span>
          <h2>Explain the game.</h2>
        </div>
        <Target size={21} />
      </div>
      <div className="tl-panel-scroll">
        <div className="ts-segment">
          {(["home", "away"] as Side[]).map((x) => (
            <button
              key={x}
              className={side === x ? "active" : ""}
              onClick={() => {
                setSide(x);
                s.commit((b) => {
                  b.settings.shapeSide = x;
                });
              }}
            >
              <i style={{ background: b.colors[x] }} />
              {s.catalogue?.teams.find(
                (t) => t.id === (x === "home" ? b.homeTeamId : b.awayTeamId),
              )?.shortName || x}
            </button>
          ))}
        </div>
        <div className="ts-section-title">
          <span>TACTICAL SETUPS</span>
          <span>06</span>
        </div>
        <p className="ts-note">
          Starting points for your analysis. Your players keep their identities.
        </p>
        <label className="ts-check">
          <input
            type="checkbox"
            checked={newPhase}
            onChange={(e) => setNewPhase(e.target.checked)}
          />{" "}
          Add each setup as a new phase
        </label>
        {b.players.filter((player) => player.side === side).length !== 11 && (
          <p className="ts-note">
            Load a complete XI to use starting-point templates. The
            reconstructed visible players stay as observed.
          </p>
        )}
        <div className="ts-preset-grid">
          {TACTICAL_PRESETS.map((p) => (
            <button
              key={p.id}
              title={p.description}
              disabled={
                b.players.filter((player) => player.side === side).length !== 11
              }
              onClick={() => {
                if (newPhase && b.scenes.length >= 100) {
                  s.notify("This storyboard has reached 100 phases.");
                  return;
                }
                s.commit((b) => {
                  if (newPhase) {
                    const scene = {
                      id: uid(),
                      title: p.name,
                      duration: 3,
                      note: p.description,
                      players: copy(b.players),
                      drawings: [],
                      ball: copy(b.ball),
                    };
                    b.scenes.push(scene);
                    b.activeScene = scene.id;
                    b.drawings = [];
                  }
                  applyPreset(b, p.id, side);
                  b.settings.focusPlayer = undefined;
                  const scene = b.scenes.find((c) => c.id === b.activeScene);
                  if (scene) {
                    scene.title = p.name;
                    scene.note = p.description;
                  }
                });
                s.set({
                  selected: [],
                  selectedShape: null,
                  tool: "select",
                  previewTime: null,
                });
                r.set({
                  view: "board",
                  zoom: 1,
                  pan: { x: 0, y: 0 },
                  mediaPlaying: false,
                });
                s.notify(
                  `${p.name} · ${team?.shortName || side} · undo available`,
                );
              }}
            >
              <svg viewBox="0 0 100 62" aria-hidden="true">
                <path d="M2 2H98V60H2ZM50 2V60" />
                <circle cx="50" cy="31" r="9" />
                {p.points.map(([x, y], i) => (
                  <circle
                    key={i}
                    className="ts-preset-dot"
                    cx={4 + x * 92}
                    cy={4 + y * 54}
                    r="2.5"
                  />
                ))}
              </svg>
              <strong>{p.name}</strong>
              <small>{p.shape}</small>
            </button>
          ))}
        </div>
        <div className="ts-section-title">
          <span>ON-SCREEN PLAYERS</span>
          <span>TOUCH / MOUSE</span>
        </div>
        <div className="ts-two-actions">
          <button
            className={b.settings.tokenStyle === "disc" ? "active" : ""}
            aria-pressed={b.settings.tokenStyle === "disc"}
            onClick={() =>
              s.commit((b) => {
                b.settings.tokenStyle = "disc";
              })
            }
          >
            Numbered discs
          </button>
          <button
            className={b.settings.tokenStyle === "shirt" ? "active" : ""}
            aria-pressed={b.settings.tokenStyle === "shirt"}
            onClick={() =>
              s.commit((b) => {
                b.settings.tokenStyle = "shirt";
              })
            }
          >
            Shirts
          </button>
        </div>
        <label className="ts-marker-size">
          Marker size{" "}
          <input
            aria-label="Player marker size"
            type="range"
            min=".7"
            max="1.6"
            step=".1"
            value={b.settings.markerScale || 1}
            onChange={(e) =>
              s.commit((b) => {
                b.settings.markerScale = +e.target.value;
              })
            }
          />
          <span>{Math.round((b.settings.markerScale || 1) * 100)}%</span>
        </label>
        <div className="ts-section-title">
          <span>LIVE GUIDES</span>
          <span>FOLLOW PLAYERS</span>
        </div>
        <div className="ts-guide-options">
          {(
            [
              ["teamShape", "Team shape"],
              ["teamLines", "Unit connections"],
              ["thirds", "Pitch thirds"],
              ["lanes", "Five channels"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={!!b.settings[key]}
              className={b.settings[key] ? "active" : ""}
              onClick={() => toggle(key)}
            >
              {label}
              <span className="ts-switch" />
            </button>
          ))}
        </div>
        <div className="ts-section-title">
          <span>MOVE A UNIT</span>
          <span>
            {selected.length ? `${selected.length} SELECTED` : "CHOOSE PLAYERS"}
          </span>
        </div>
        <div className="ts-two-actions">
          <button
            onClick={() =>
              s.set({
                selected: b.players
                  .filter((p) => p.side === side)
                  .map((p) => p.uid),
                tool: "select",
              })
            }
          >
            <Users size={14} />
            Select team
          </button>
          <button onClick={() => s.set({ selected: [], selectedShape: null })}>
            Deselect
          </button>
        </div>
        <div className="ts-unit-move">
          {[
            [ArrowLeft, -0.035, 0, "Move unit left"],
            [ArrowUp, 0, -0.035, "Move unit up"],
            [ArrowDown, 0, 0.035, "Move unit down"],
            [ArrowRight, 0.035, 0, "Move unit right"],
          ].map(([Icon, dx, dy, label]) => {
            const I = Icon as typeof ArrowLeft;
            return (
              <button
                key={label as string}
                aria-label={label as string}
                disabled={!selected.length}
                onClick={() =>
                  s.commit((b) =>
                    shiftUnit(b, s.selected, dx as number, dy as number),
                  )
                }
              >
                <I size={18} />
              </button>
            );
          })}
        </div>
        <button
          className="ts-wide-action"
          disabled={selected.length !== 1 && !b.settings.focusPlayer}
          onClick={() =>
            s.commit((b) => {
              b.settings.focusPlayer = b.settings.focusPlayer
                ? undefined
                : selected[0]?.uid;
            })
          }
        >
          <Focus size={16} />
          {b.settings.focusPlayer
            ? "Remove player spotlight"
            : "Spotlight selected player"}
        </button>
        <div className="ts-two-actions">
          <button onClick={() => s.commit((b) => resetPositions(b, side))}>
            <RotateCcw size={14} />
            Reset shape
          </button>
          <button
            onClick={() =>
              s.commit((b) => {
                b.players
                  .filter((p) => p.side === side)
                  .forEach((p) => (p.y = 1 - p.y));
              })
            }
          >
            <FlipVertical2 size={14} />
            Flip flanks
          </button>
        </div>
      </div>
    </aside>
  );
}
