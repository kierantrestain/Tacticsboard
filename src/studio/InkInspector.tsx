import { expandedPoints, transformInk, imageInk } from "./inkGeometry";
import { homography } from "./geometry";
import { Copy, Eye, Layers3, Trash2, Type } from "lucide-react";
import { useStudio } from "../store";
import { copy, uid } from "../core";
import { useRuntime, editDesk } from "./runtime";
import { emptyStudio, timecode } from "./types";
export default function InkInspector() {
  const r = useRuntime(),
    s = useStudio(),
    d = s.board?.studio || emptyStudio(),
    id = d.assetId,
    ink = id ? d.ink[id] || [] : [],
    selected = ink.find((i) => i.id === r.selectedInk);
  return (
    <aside className="tl-ink-inspector">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">TELESTRATION</span>
          <h2>Graphics & timing</h2>
        </div>
        <Layers3 size={20} />
      </div>
      <div className="tl-panel-scroll">
        {selected ? (
          <>
            <div className="tl-selected-object">
              <span>{selected.type.toUpperCase()}</span>
              <strong>Selected graphic</strong>
            </div>
            <button className="film-button" aria-pressed={!selected.hidden} onClick={()=>editDesk(d=>{const ink=d.ink[id!].find(i=>i.id===selected.id)!;ink.hidden=!ink.hidden;})}>{selected.hidden?'Show this graphic':'Hide this graphic'}</button>
            <label className="tl-field">Graphic style<select aria-label="Annotation style preset" defaultValue="custom" onChange={e=>editDesk(d=>{const i=d.ink[id!].find(i=>i.id===selected.id)!;const style=({lime:{color:'#dfff81',width:4,opacity:1},cyan:{color:'#63d9db',width:4,opacity:1},white:{color:'#ffffff',width:3,opacity:1},space:{color:'#dfff81',width:2,opacity:.4}} as const)[e.target.value as 'lime'];if(style)Object.assign(i,style);})}><option value="custom">Custom</option><option value="lime">Broadcast lime</option><option value="cyan">Broadcast cyan</option><option value="white">Clean white</option><option value="space">Subtle space</option></select></label>
            {['arrow','run'].includes(selected.type)&&selected.points.length===4&&<label className="tl-range-label">Arrow curve<input type="range" aria-label="Annotation curve" min="-1" max="1" step=".05" value={selected.curve||0} onChange={e=>editDesk(d=>{d.ink[id!].find(i=>i.id===selected.id)!.curve=+e.target.value;})}/></label>}
            {selected.type==='text'&&<label className="tl-range-label">Label size<input type="range" aria-label="Annotation text size" min=".5" max="3" step=".1" value={selected.textScale||1} onChange={e=>editDesk(d=>{d.ink[id!].find(i=>i.id===selected.id)!.textScale=+e.target.value;})}/></label>}
            <p className="tl-small-note">Drag the graphic to move it. Use its corner handles to resize. Layer edits remain undoable.</p>
            {selected.type === "text" && (
              <label className="tl-field">
                On-screen text
                <input
                  key={selected.id}
                  defaultValue={selected.text}
                  onBlur={(e) =>
                    editDesk((d) => {
                      d.ink[id!].find((x) => x.id === selected.id)!.text =
                        e.target.value.slice(0, 100);
                    })
                  }
                />
              </label>
            )}
            <label className="tl-range-label">
              Colour
              <input
                type="color"
                value={selected.color}
                onChange={(e) =>
                  editDesk((d) => {
                    d.ink[id!].find((x) => x.id === selected.id)!.color =
                      e.target.value;
                  })
                }
              />
            </label>
            <label className="tl-range-label">
              Line weight
              <input
                type="range"
                min="1"
                max="10"
                value={selected.width}
                onChange={(e) =>
                  editDesk((d) => {
                    d.ink[id!].find((x) => x.id === selected.id)!.width =
                      +e.target.value;
                  })
                }
              />
            </label>
            <label className="tl-range-label">
              Opacity
              <input
                type="range"
                min=".1"
                max="1"
                step=".05"
                value={selected.opacity}
                onChange={(e) =>
                  editDesk((d) => {
                    d.ink[id!].find((x) => x.id === selected.id)!.opacity =
                      +e.target.value;
                  })
                }
              />
            </label>
            <label className="tl-check">
              <input
                type="checkbox"
                checked={selected.space === "pitch"}
                disabled={!(d.landmarks[id!]?.length === 4)}
                onChange={(e) =>
                  editDesk((d) => {
                    const old = d.ink[id!].find((x) => x.id === selected.id)!;
                    const seq = d.tracking[id!],
                      map = seq?.frames.length
                        ? seq.frames.reduce((a, b) =>
                            Math.abs(a.time - r.time) <
                            Math.abs(b.time - r.time)
                              ? a
                              : b,
                          ).map
                        : homography(d.landmarks[id!]);
                    if (!map) return;
                    if (e.target.checked) {
                      old.points = transformInk(expandedPoints(old), map);
                      old.space = "pitch";
                    } else {
                      const screen = imageInk(old, map);
                      if (screen) old.points = screen.points;
                      old.space = "screen";
                    }
                  })
                }
              />
              <span>
                Attach graphic to the pitch
                <br />
                <small>
                  {d.landmarks[id!]?.length === 4
                    ? "Follows calibrated camera movement and appears in the tactical replay."
                    : "Map four pitch landmarks to enable field attachment."}
                </small>
              </span>
            </label>
            <div className="tl-section-heading">VISIBLE ON CLIP</div>
            <div className="tl-time-pair">
              <label>
                In
                <input
                  type="number"
                  min="0"
                  max={selected.to}
                  step=".04"
                  value={selected.from}
                  onChange={(e) =>
                    editDesk((d) => {
                      d.ink[id!].find((x) => x.id === selected.id)!.from =
                        Math.max(0, Math.min(selected.to, +e.target.value));
                    })
                  }
                />
              </label>
              <label>
                Out
                <input
                  type="number"
                  min={selected.from}
                  step=".04"
                  value={selected.to}
                  onChange={(e) =>
                    editDesk((d) => {
                      d.ink[id!].find((x) => x.id === selected.id)!.to =
                        Math.max(selected.from, +e.target.value);
                    })
                  }
                />
              </label>
            </div>
            <div className="tl-two-buttons">
              <button
                className="tl-secondary"
                onClick={() =>
                  editDesk((d) => {
                    const next = copy(selected);
                    next.id = uid();
                    next.points = next.points.map((p) => p + 0.015);
                    d.ink[id!].push(next);
                    r.set({ selectedInk: next.id });
                  })
                }
              >
                <Copy size={14} />
                Duplicate
              </button>
              <button
                className="tl-danger tl-secondary"
                onClick={() => {
                  editDesk((d) => {
                    d.ink[id!] = d.ink[id!].filter((x) => x.id !== selected.id);
                  });
                  r.set({ selectedInk: null });
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </>
        ) : (
          <p className="tl-small-note">
            Select a graphic on the source to edit its style and visibility.
            Drawing pauses playback so the presenter can explain the moment.
          </p>
        )}
        <div className="tl-section-heading">
          SOURCE LAYERS <span>{ink.length}</span>
        </div>
        <div className="tl-layer-list">
          {ink
            .slice()
            .reverse()
            .map((i, n) => (
              <button
                className={r.selectedInk === i.id ? "is-active" : ""}
                key={i.id}
                onClick={() =>
                  r.set({
                    selectedInk: i.id,
                    time: i.from,
                    mediaPlaying: false,
                  })
                }
              >
                <span
                  className="tl-layer-color"
                  style={{ background: i.color }}
                />
                <span>
                  <strong>
                    {i.type === "text"
                      ? i.text
                      : i.type[0].toUpperCase() +
                        i.type.slice(1) +
                        " " +
                        (ink.length - n)}
                  </strong>
                  <small>
                    {timecode(i.from)} — {timecode(i.to)}
                  </small>
                </span>
                <Eye size={13} />
              </button>
            ))}
        </div>
      </div>
    </aside>
  );
}
