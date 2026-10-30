import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MonitorPlay,
  Play,
  Plus,
  Radio,
  TimerReset,
  Trash2,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
import { emptyStudio, timecode } from "./types";
import { takeToAir } from "./production";
import { copy, uid } from "../core";
import { recallCue, saveCue, stepCue } from "./showControl";
import MiniPitch from "./MiniPitch";
const labels = {
  board: "Tactical board",
  footage: "Source footage",
  split: "Source + board",
  replay: "3D replay",
};
export default function Rundown() {
  const s = useStudio(),
    r = useRuntime(),
    d = s.board?.studio || emptyStudio(),
    cues = d.cues || [];
  const [running, setRunning] = useState(false),
    [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed * 1000;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    setElapsed(0);
    setRunning(false);
  }, [r.activeCueId, s.board?.id]);
  const active = cues.find((c) => c.id === r.activeCueId),
    index = cues.findIndex((c) => c.id === r.activeCueId),
    total = cues.reduce((n, c) => n + c.duration, 0);
  const reorder = (id: string, delta: number) =>
    editDesk((d) => {
      const list = d.cues || [],
        from = list.findIndex((c) => c.id === id),
        to = from + delta;
      if (to >= 0 && to < list.length) {
        const [cue] = list.splice(from, 1);
        list.splice(to, 0, cue);
      }
    });
  return (
    <aside className="ts-panel ts-rundown">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">SHOW RUNDOWN</span>
          <h2>Your analysis, on cue.</h2>
        </div>
        <MonitorPlay size={22} />
      </div>
      <div className="ts-rundown-summary">
        <span>
          <b>{String(cues.length).padStart(2, "0")}</b> shots
        </span>
        <span>
          {Math.floor(total / 60)}m {total % 60}s planned
        </span>
        <button className="tl-primary" onClick={saveCue}>
          <Plus size={14} />
          Save view
        </button>
      </div>
      {!!cues.length && (
        <div className="ts-cue-transport">
          <button
            aria-label="Previous rundown shot"
            disabled={index <= 0}
            onClick={() => stepCue(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <small>
              {active
                ? `SHOT ${index + 1} / ${cues.length}`
                : "READY WHEN YOU ARE"}
            </small>
            <strong>{active?.title || "Choose the opening shot"}</strong>
          </div>
          <button
            aria-label="Next rundown shot"
            disabled={index === cues.length - 1}
            onClick={() => stepCue(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {active && (
        <div
          className={`ts-cue-clock ${elapsed > active.duration ? "over" : ""}`}
        >
          <button
            aria-label={
              running ? "Pause presenter timer" : "Start presenter timer"
            }
            onClick={() => setRunning(!running)}
          >
            {running ? <TimerReset size={14} /> : <Play size={14} />}
          </button>
          <strong>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </strong>
          <span>/ {active.duration}s cue</span>
          <button
            aria-label="Reset presenter timer"
            onClick={() => {
              setRunning(false);
              setElapsed(0);
            }}
          >
            <TimerReset size={14} />
          </button>
        </div>
      )}
      <div className="tl-panel-scroll">
        {!cues.length && (
          <div className="ts-rundown-empty">
            <BookmarkPlus size={30} />
            <h3>Prepare once. Present freely.</h3>
            <p>
              Save a board, clip frame or 3D angle. Each shot remembers the
              positions, graphics and camera.
            </p>
            <button className="tl-primary" onClick={saveCue}>
              <Plus size={15} />
              Save the opening shot
            </button>
            <small>Press M to save any view · [ / ] to cue shots</small>
          </div>
        )}
        {cues.map((cue, i) => {
          const asset = r.assets.find((a) => a.id === cue.assetId),
            missing = !!cue.assetId && !asset;
          return (
            <article
              className={`ts-cue-card ${r.activeCueId === cue.id ? "active" : ""}`}
              key={cue.id}
            >
              <button
                className="ts-cue-image"
                aria-label={`Recall shot ${i + 1}: ${cue.title}`}
                disabled={missing}
                onClick={() => recallCue(cue.id)}
              >
                {asset && cue.view !== "replay" ? (
                  <img src={asset.thumbnail} alt="" />
                ) : (
                  <MiniPitch frame={cue.frame} colors={cue.colors} />
                )}
                <span>{String(i + 1).padStart(2, "0")}</span>
                <small>{labels[cue.view]}</small>
                {r.activeCueId === cue.id && (
                  <Check className="ts-cue-check" size={18} />
                )}
              </button>
              <div className="ts-cue-body">
                <input
                  aria-label={`Shot ${i + 1} title`}
                  key={cue.id + cue.title}
                  defaultValue={cue.title}
                  onBlur={(e) =>
                    editDesk((d) => {
                      d.cues!.find((c) => c.id === cue.id)!.title =
                        e.target.value.trim().slice(0, 80) || "Untitled shot";
                    })
                  }
                />
                <textarea
                  aria-label={`Shot ${i + 1} presenter notes`}
                  placeholder="The point the panel needs to see…"
                  defaultValue={cue.note}
                  onBlur={(e) =>
                    editDesk((d) => {
                      d.cues!.find((c) => c.id === cue.id)!.note =
                        e.target.value.slice(0, 4000);
                    })
                  }
                />
                {missing && (
                  <p className="ts-missing">
                    Source media is missing. Import its project pack.
                  </p>
                )}
                <div className="ts-cue-meta">
                  <label>
                    <input
                      type="number"
                      aria-label={`Shot ${i + 1} planned seconds`}
                      min="1"
                      max="600"
                      value={cue.duration}
                      onChange={(e) =>
                        editDesk((d) => {
                          d.cues!.find((c) => c.id === cue.id)!.duration =
                            Math.max(1, Math.min(600, +e.target.value || 1));
                        })
                      }
                    />
                    sec
                  </label>
                  <span>
                    {cue.assetId
                      ? timecode(cue.time)
                      : cue.camera === "broadcast"
                        ? "Broadcast view"
                        : cue.camera}
                  </span>
                </div>
                <div className="ts-cue-actions">
                  <button
                    className="ts-recall"
                    disabled={missing}
                    onClick={() => recallCue(cue.id)}
                  >
                    <Play size={12} />
                    Recall
                  </button>
                  <button
                    className="ts-on-air"
                    disabled={missing}
                    onClick={() => recallCue(cue.id, true)}
                  >
                    <Radio size={12} />
                    To TV
                  </button>
                  <button
                    aria-label={`Move shot ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => reorder(cue.id, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    aria-label={`Move shot ${i + 1} down`}
                    disabled={i === cues.length - 1}
                    onClick={() => reorder(cue.id, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    aria-label={`Duplicate shot ${i + 1}`}
                    disabled={cues.length >= 80}
                    onClick={() =>
                      editDesk((d) => {
                        const next = copy(cue);
                        next.id = uid();
                        next.title = (cue.title + " copy").slice(0, 80);
                        d.cues!.splice(i + 1, 0, next);
                      })
                    }
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    aria-label={`Remove shot ${i + 1}`}
                    onClick={() =>
                      editDesk((d) => {
                        d.cues = d.cues!.filter((c) => c.id !== cue.id);
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!!d.bookmarks.length && (
          <div className="ts-section-title">SAVED SOURCE MOMENTS</div>
        )}
        {d.bookmarks.map((m) => (
          <div className="ts-legacy-moment" key={m.id}>
            <strong>{m.title}</strong>
            <small>{m.note}</small>
            <button
              onClick={() => {
                editDesk((d) => {
                  d.assetId = m.assetId;
                });
                r.set({ view: "footage", time: m.time, mediaPlaying: false });
                if (r.follow) takeToAir();
              }}
            >
              <Play size={12} />
              Recall {timecode(m.time)}
            </button>
          </div>
        ))}
      </div>
      <div className="ts-panel-footnote">
        M save shot <span /> [ previous <span /> ] next <span /> Enter take
      </div>
    </aside>
  );
}
