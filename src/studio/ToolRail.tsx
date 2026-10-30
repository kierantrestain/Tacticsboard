import { useState } from "react";
import { frameAt } from "../core";
import {
  ArrowUpRight,
  MoreHorizontal,
  Circle,
  Columns3,
  Eraser,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Ruler,
  ScanLine,
  Square,
  Triangle,
  Type,
  Undo2,
  Redo2,
  Trash2,
} from "lucide-react";
import type { Tool } from "../types";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
const tools = [
  ["select", "Select & move", "V", MousePointer2],
  ["arrow", "Pass arrow", "A", ArrowUpRight],
  ["run", "Movement path", "R", MoveUpRight],
  ["pen", "Freehand ink", "D", Pencil],
  ["zone", "Highlight space", "Z", Square],
  ["ellipse", "Circle", "C", Circle],
  ["spotlight", "Spotlight", "H", Highlighter],
  ["triangle", "Passing triangle", "G", Triangle],
  ["line", "Connection", "L", Minus],
  ["measure", "Distance estimate", "U", Ruler],
  ["offside", "Perspective reference line", "", ScanLine],
  ["text", "Text label", "T", Type],
  ["erase", "Erase graphic", "E", Eraser],
] as const;
export default function ToolRail() {
  const s = useStudio(),
    r = useRuntime();
  const [more, setMore] = useState(false);
  const clear = () => {
    s.commit((b) => {
      const id = b.studio?.assetId;
      if (
        id &&
        b.studio &&
        (r.view === "footage" ||
          r.view === "split" ||
          (r.view === "replay" && b.studio.tracking[id]))
      )
        b.studio.ink[id] = [];
      if (r.view !== "footage") b.drawings = [];
    });
    r.set({ selectedInk: null });
    s.set({ selectedShape: null });
  };
  return (
    <nav className="tl-tool-rail" aria-label="Broadcast telestration tools">
      <div className="tl-tool-group">
        {tools
          .filter((_, i) => i < 6)
          .map(([tool, label, key, Icon]) => (
            <button
              className={`tl-tool ${s.tool === tool ? "is-active" : ""}`}
              key={tool}
              data-testid={`tool-${tool}`}
              aria-label={label}
              aria-pressed={s.tool === tool}
              title={label + (key ? ` (${key})` : "")}
              onClick={() => {
                if (s.previewTime !== null && s.board) {
                  const frame = frameAt(s.board, s.previewTime);
                  s.commit((b) => Object.assign(b, frame));
                }
                s.set({
                  tool: tool as Tool,
                  selectedShape: null,
                  playing: false,
                });
                r.set({
                  panMode: false,
                  selectedInk: null,
                  markMode: "none",
                  mediaPlaying: false,
                });
              }}
            >
              <Icon size={21} strokeWidth={1.7} />
              {s.tool === tool && <i />}
            </button>
          ))}
        <div className="director-more-tools">
          <button
            className={`tl-tool ${more || tools.slice(6).some((t) => t[0] === s.tool) ? "is-active" : ""}`}
            aria-label="More drawing tools"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            <MoreHorizontal size={21} />
          </button>
          {more && (
            <div className="director-tools-popover">
              <strong>DRAWING TOOLS</strong>
              {tools.slice(6).map(([tool, label, key, Icon]) => (
                <button
                  key={tool}
                  aria-label={label}
                  aria-pressed={s.tool === tool}
                  onClick={() => {
                    if (s.previewTime !== null && s.board) {
                      const frame = frameAt(s.board, s.previewTime);
                      s.commit((b) => Object.assign(b, frame));
                    }
                    s.set({
                      tool: tool as Tool,
                      selectedShape: null,
                      playing: false,
                    });
                    r.set({
                      panMode: false,
                      selectedInk: null,
                      markMode: "none",
                      mediaPlaying: false,
                    });
                    setMore(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="tl-ink-colors">
        {["#66d9ff", "#ffffff", "#ffbd67", "#f075a3"].map((c) => (
          <button
            key={c}
            title={`Ink ${c}`}
            aria-label={`Ink colour ${c}`}
            className={s.color === c ? "is-active" : ""}
            style={{ background: c }}
            onClick={() => s.set({ color: c })}
          />
        ))}
      </div>
      <div className="tl-tool-utility">
        <button
          className="tl-tool ts-stroke-button"
          aria-label={`Line weight ${s.stroke}. Click to change.`}
          title={`Line weight: ${s.stroke} · click to change`}
          onClick={() => s.set({ stroke: s.stroke >= 7 ? 2 : s.stroke + 1 })}
        >
          <span
            style={{
              height: Math.min(7, s.stroke),
              width: 19,
              borderRadius: 3,
              background: "currentColor",
            }}
          />
        </button>
        <button
          className="tl-tool"
          title="Undo (Ctrl Z)"
          aria-label="Undo"
          disabled={!s.past.length}
          onClick={s.undo}
        >
          <Undo2 size={19} />
        </button>
        <button
          className="tl-tool"
          title="Redo (Ctrl Shift Z)"
          aria-label="Redo"
          disabled={!s.future.length}
          onClick={s.redo}
        >
          <Redo2 size={19} />
        </button>
        <button
          className="tl-tool"
          title="Clear graphics · undo available"
          aria-label="Clear graphics"
          onClick={clear}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </nav>
  );
}
