import {
  MousePointer2,
  ArrowUpRight,
  MoveUpRight,
  Minus,
  Pencil,
  Square,
  Circle,
  Triangle,
  Highlighter,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  ImagePlus,
  HelpCircle,
} from "lucide-react";
import { useRef } from "react";
import { useStudio } from "../store";
import { saveMedia } from "../media";
import { uid } from "../core";
import type { Tool } from "../types";
const tools = [
  ["select", "Select and move", "V", MousePointer2],
  ["arrow", "Pass arrow", "A", ArrowUpRight],
  ["run", "Movement run", "R", MoveUpRight],
  ["line", "Connection line", "L", Minus],
  ["pen", "Free draw", "D", Pencil],
  ["zone", "Highlight zone", "Z", Square],
  ["ellipse", "Circle", "O", Circle],
  ["triangle", "Three-point zone", "G", Triangle],
  ["spotlight", "Spotlight", "H", Highlighter],
  ["text", "Text note", "T", Type],
  ["erase", "Erase annotation", "E", Eraser],
] as const;
export default function Toolbar() {
  const s = useStudio();
  const upload = useRef<HTMLInputElement>(null);
  return (
    <nav className="tool-rail" aria-label="Tactics drawing tools">
      <div className="tools-list">
        {tools.map(([tool, label, key, Icon]) => (
          <button
            data-testid={`tool-${tool}`}
            key={tool}
            className={`tool-button ${s.tool === tool ? "active" : ""}`}
            onClick={() => s.set({ tool: tool as Tool, selectedShape: null })}
            title={`${label} (${key})`}
            aria-label={label}
            aria-pressed={s.tool === tool}
          >
            <Icon size={19} />
            {s.tool === tool && <i />}
          </button>
        ))}
      </div>
      <div className="rail-separator" />
      <div className="rail-colours">
        {["#d5f86a", "#ffffff", "#6ecbff", "#ff8b7a"].map((c) => (
          <button
            key={c}
            className={s.color === c ? "active" : ""}
            onClick={() => s.set({ color: c })}
            style={{ "--swatch": c } as React.CSSProperties}
            title={`Draw in ${c}`}
            aria-label={`Drawing colour ${c}`}
          />
        ))}
        <label className="custom-colour" title="Custom drawing colour">
          <input
            aria-label="Custom drawing colour"
            type="color"
            value={s.color}
            onChange={(e) => s.set({ color: e.target.value })}
          />
          <PlusColour />
        </label>
      </div>
      <div className="rail-separator" />
      <button
        className="tool-button"
        disabled={!s.past.length}
        onClick={s.undo}
        title="Undo (Ctrl Z)"
        aria-label="Undo"
      >
        <Undo2 size={18} />
      </button>
      <button
        className="tool-button"
        disabled={!s.future.length}
        onClick={s.redo}
        title="Redo (Ctrl Shift Z)"
        aria-label="Redo"
      >
        <Redo2 size={18} />
      </button>
      <div className="rail-bottom">
        <button
          className="tool-button"
          title="Attach a reference image or video"
          aria-label="Attach reference media"
          onClick={() => upload.current?.click()}
        >
          <ImagePlus size={18} />
        </button>
        <button
          className="tool-button"
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
          onClick={() => s.set({ modal: "help" })}
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <input
        hidden
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 100 * 1024 * 1024) {
            s.notify("Choose an image or video smaller than 100 MB.");
            return;
          }
          const id = uid();
          try {
            await saveMedia(id, f);
            s.commit((b) => {
              b.media = {
                id,
                name: f.name,
                type: f.type.startsWith("video") ? "video" : "image",
              };
              b.settings.mediaVisible = true;
            });
            s.notify(
              "Reference attached. Use the drawing tools over the image or video.",
            );
          } catch {
            s.notify("The reference could not be stored in this browser.");
          }
          e.target.value = "";
        }}
      />
    </nav>
  );
}
function PlusColour() {
  return <span>+</span>;
}
