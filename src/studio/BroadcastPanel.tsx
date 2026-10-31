import { Monitor, Radio, SlidersHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import { useStudio } from "../store";
import { editDesk, useRuntime } from "./runtime";
import { defaultBroadcast } from "./types";
import type { BroadcastStyle } from "./types";
import { openProgram, takeToAir, toggleBlackout } from "./production";
export default function BroadcastPanel() {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!,
    style = { ...defaultBroadcast(), ...b.studio?.broadcast };
  const set = (patch: Partial<BroadcastStyle>) =>
    editDesk((d) => {
      d.broadcast = { ...style, ...patch };
    });
  return (
    <aside className="ts-panel">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">BROADCAST DESIGN</span>
          <h2>TV design</h2>
        </div>
        <SlidersHorizontal size={21} />
      </div>
      <div className="tl-panel-scroll">
        <div
          className="ts-brand-preview"
          style={{ "--show-accent": style.accent } as CSSProperties}
        >
          <span className="ts-preview-bug">
            <b>{style.channel}</b>
            <small>{style.programme}</small>
          </span>
          <span className="ts-preview-analysis">MATCH ANALYSIS</span>
          <div>
            <small>{style.subtitle}</small>
            <strong>{style.headline || b.studio?.lowerThird || b.title}</strong>
          </div>
        </div>
        <div className="ts-section-title">CHANNEL IDENTITY</div>
        <label className="ts-field">
          Channel name
          <input
            value={style.channel}
            maxLength={40}
            onChange={(e) => set({ channel: e.target.value })}
          />
        </label>
        <label className="ts-field">
          Channel division
          <input
            value={style.programme}
            maxLength={40}
            onChange={(e) => set({ programme: e.target.value })}
          />
        </label>
        <div className="ts-accent-row">
          <span>Show accent</span>
          {["#c5f06a", "#66d9ff", "#ff645d", "#c3a5ff", "#ffbd67"].map((c) => (
            <button
              key={c}
              style={{ background: c }}
              aria-label={`Show accent ${c}`}
              aria-pressed={style.accent === c}
              onClick={() => set({ accent: c })}
            />
          ))}
          <input
            type="color"
            aria-label="Custom show accent"
            value={style.accent}
            onChange={(e) => set({ accent: e.target.value })}
          />
        </div>
        <div className="ts-section-title">ON-SCREEN CAPTION</div>
        <label className="ts-field">
          Headline
          <input
            value={style.headline}
            maxLength={120}
            placeholder={b.studio?.lowerThird || b.title}
            onChange={(e) => set({ headline: e.target.value })}
          />
        </label>
        <label className="ts-field">
          Segment label
          <input
            value={style.subtitle}
            maxLength={100}
            onChange={(e) => set({ subtitle: e.target.value })}
          />
        </label>
        <div className="ts-guide-options">
          {(
            [
              ["showHeader", "Channel identity"],
              ["showLowerThird", "Lower-third caption"],
              ["showScore", "Match score / teams"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={style[key]}
              className={style[key] ? "active" : ""}
              onClick={() => set({ [key]: !style[key] })}
            >
              {label}
              <span className="ts-switch" />
            </button>
          ))}
        </div>
        <div className="ts-section-title">OUTPUT CONTROL</div>
        <button className="ts-wide-action" onClick={openProgram}>
          <Monitor size={16} />
          Open clean TV window
        </button>
        <button
          className="ts-wide-action"
          onClick={() => (r.program?.black ? toggleBlackout() : takeToAir())}
        >
          <Radio size={16} />
          {r.program?.black
            ? "Restore held programme"
            : "Send current view to TV"}
        </button>
        <p className="ts-note">
          Move the clean window to your studio display, or capture it in OBS.
          Double-click the output to fill the screen. Presenter notes stay on
          this desk.
        </p>
      </div>
    </aside>
  );
}
