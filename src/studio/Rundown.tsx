import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  TimerReset,
  Trash2,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
import { defaultBroadcast, emptyStudio } from "./types";
import { copy, uid, frameAt } from "../core";
import { recallCue, saveCue, stepCue, updateCue, makeCue } from "./showControl";
import { inspectCue, viewLabels } from "./readiness";
import { cueContentKey } from "./cueModel";
import MiniPitch from "./MiniPitch";
export default function Rundown() {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!,
    d = b.studio || emptyStudio(),
    cues = d.cues || [];
  const [, tick] = useState(0);
  const selectedRow = useRef<HTMLElement>(null);
  useEffect(() => {
    selectedRow.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [r.activeCueId]);
  useEffect(() => {
    if (!r.cueClock.startedAt) return;
    const t = setInterval(() => tick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, [r.cueClock.startedAt]);
  const elapsed =
    r.cueClock.elapsed +
    (r.cueClock.startedAt
      ? Math.floor((Date.now() - r.cueClock.startedAt) / 1000)
      : 0);
  const active = cues.find((c) => c.id === r.activeCueId),
    index = cues.findIndex((c) => c.id === r.activeCueId),
    total = cues.reduce((n, c) => n + c.duration, 0);
  const current = active
    ? makeCue(
        b,
        r.view,
        r.camera,
        r.time,
        s.previewTime === null ? undefined : frameAt(b, s.previewTime),
      )
    : null;
  const dirty =
    active && current && cueContentKey(active) !== cueContentKey(current);
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
    <aside className="ts-panel director-rundown">
      <div className="director-rundown-head">
        <div>
          <span className="tl-eyebrow">SHOW RUNDOWN</span>
          <h2>
            {cues.length} shots{" "}
            <small>
              {Math.floor(total / 60)}:{String(total % 60).padStart(2, "0")}{" "}
              planned
            </small>
          </h2>
        </div>
        <button className="tl-primary" onClick={saveCue}>
          <Plus size={15} /> Save shot
        </button>
      </div>
      {active && (
        <div
          className={`director-cue-transport ${elapsed > active.duration ? "over" : ""}`}
        >
          <button
            aria-label="Previous rundown shot"
            disabled={index <= 0}
            onClick={() => stepCue(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {index + 1} / {cues.length}
          </span>
          <button
            aria-label="Next rundown shot"
            disabled={index === cues.length - 1}
            onClick={() => stepCue(1)}
          >
            <ChevronRight size={17} />
          </button>
          <button
            aria-label={
              r.cueClock.startedAt
                ? "Pause presenter timer"
                : "Start presenter timer"
            }
            onClick={() =>
              r.set({
                cueClock: {
                  startedAt: r.cueClock.startedAt ? null : Date.now(),
                  elapsed,
                },
              })
            }
          >
            {r.cueClock.startedAt ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <strong>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </strong>
          <small>/ {active.duration}s</small>
          <button
            aria-label="Reset presenter timer"
            onClick={() => r.set({ cueClock: { startedAt: null, elapsed: 0 } })}
          >
            <TimerReset size={14} />
          </button>
        </div>
      )}
      <div className="tl-panel-scroll">
        {!cues.length && (
          <div className="director-empty">
            <h3>Your story starts here.</h3>
            <p>
              Arrange the board, choose a clip or make a data card. Save each
              moment as a shot.
            </p>
            <button className="tl-primary" onClick={saveCue}>
              <Plus size={15} /> Save opening shot
            </button>
          </div>
        )}
        {cues.map((cue, i) => {
          const issues = inspectCue(b, cue, r.assets, r.assetAvailability),
            blocked = issues.some((i) => i.level === "block"),
            selected = cue.id === r.activeCueId;
          return (
            <article
              className={`director-cue ${selected ? "selected" : ""}`}
              key={cue.id}
              ref={selected ? selectedRow : undefined}
            >
              <button
                className="director-cue-row"
                aria-label={`Recall shot ${i + 1}: ${cue.title}`}
                onClick={() => recallCue(cue.id)}
              >
                <span className="director-cue-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="director-cue-thumb">
                  {cue.thumbnail ? (
                    <img src={cue.thumbnail} alt="" />
                  ) : cue.view === "stats" ? (
                    <span className="director-stats-thumb">
                      MATCH
                      <br />
                      <b>DATA</b>
                    </span>
                  ) : (
                    <MiniPitch frame={cue.frame} colors={cue.colors} />
                  )}
                </div>
                <span className="director-cue-label">
                  <strong>{cue.title}</strong>
                  <small>
                    {viewLabels[cue.view]} · {cue.duration}s
                  </small>
                  <em
                    className={
                      blocked
                        ? "blocked"
                        : issues.length
                          ? "needs-review"
                          : "ready"
                    }
                  >
                    {blocked
                      ? "Source needs attention"
                      : issues.length
                        ? "Needs review"
                        : "Reviewed"}
                  </em>
                </span>
                {r.program?.cueId === cue.id && !r.program.black && (
                  <i className="director-cue-tally" title="Held on programme" />
                )}
              </button>
              {selected && (
                <div className="director-cue-editor">
                  <label>
                    SHOT TITLE
                    <input
                      aria-label={`Shot ${i + 1} title`}
                      key={cue.id + cue.title}
                      defaultValue={cue.title}
                      maxLength={80}
                      onBlur={(e) =>
                        editDesk((d) => {
                          const c = d.cues!.find((c) => c.id === cue.id)!;
                          c.title =
                            e.target.value.trim().slice(0, 80) ||
                            "Untitled shot";
                        })
                      }
                    />
                  </label>
                  <label>
                    ON-SCREEN CAPTION
                    <input
                      aria-label={`Shot ${i + 1} caption`}
                      maxLength={120}
                      value={
                        b.studio?.broadcast?.headline ||
                        b.studio?.lowerThird ||
                        b.title
                      }
                      onChange={(e) =>
                        editDesk((d) => {
                          d.broadcast = {
                            ...defaultBroadcast(),
                            ...d.broadcast,
                            headline: e.target.value,
                          };
                        })
                      }
                    />
                  </label>
                  <label>
                    PRESENTER NOTE
                    <textarea
                      aria-label={`Shot ${i + 1} presenter notes`}
                      key={cue.id + cue.note}
                      placeholder="The one point the audience should understand…"
                      defaultValue={cue.note}
                      maxLength={4000}
                      onBlur={(e) =>
                        editDesk((d) => {
                          d.cues!.find((c) => c.id === cue.id)!.note =
                            e.target.value.slice(0, 4000);
                        })
                      }
                    />
                  </label>
                  <div className="director-cue-timing">
                    <label>
                      Planned{" "}
                      <input
                        type="number"
                        aria-label={`Shot ${i + 1} planned seconds`}
                        min={1}
                        max={600}
                        value={cue.duration}
                        onChange={(e) =>
                          editDesk((d) => {
                            d.cues!.find((c) => c.id === cue.id)!.duration =
                              Math.max(1, Math.min(600, +e.target.value || 1));
                          })
                        }
                      />{" "}
                      sec
                    </label>
                    <details>
                      <summary aria-label={`Shot ${i + 1} options`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div>
                        <button
                          disabled={i === 0}
                          onClick={() => reorder(cue.id, -1)}
                        >
                          <ArrowUp size={13} />
                          Move up
                        </button>
                        <button
                          disabled={i === cues.length - 1}
                          onClick={() => reorder(cue.id, 1)}
                        >
                          <ArrowDown size={13} />
                          Move down
                        </button>
                        <button
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
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            editDesk((d) => {
                              d.cues = d.cues!.filter((c) => c.id !== cue.id);
                            });
                            r.set({ activeCueId: null });
                            s.notify("Shot removed. Undo restores it.");
                          }}
                        >
                          <Trash2 size={13} />
                          Remove shot
                        </button>
                      </div>
                    </details>
                  </div>
                  {dirty && (
                    <p className="director-shot-warning">
                      Preview has changes that are not saved in this shot.
                    </p>
                  )}
                  {issues
                    .filter((i) => i.level === "block")
                    .map((issue) => (
                      <p key={issue.code} className="director-shot-warning">
                        {issue.message}
                      </p>
                    ))}
                  <div className="director-cue-actions">
                    <button disabled={!dirty} onClick={updateCue}>
                      Update shot
                    </button>
                    <button
                      disabled={!!dirty || blocked}
                      onClick={() =>
                        editDesk((d) => {
                          d.cues!.find((c) => c.id === cue.id)!.reviewedAt =
                            Date.now();
                        })
                      }
                    >
                      <Check size={13} />
                      {cue.reviewedAt ? "Reviewed" : "Mark reviewed"}
                    </button>
                    <button
                      disabled={blocked || !!r.busy || !!r.program?.black}
                      onClick={() => recallCue(cue.id, true)}
                    >
                      <Radio size={13} />
                      Take saved
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="director-rundown-foot">
        <button onClick={() => r.set({ sidebar: "show" })}>
          Check the show <ChevronRight size={13} />
        </button>
        <span>M save · [ / ] cue</span>
      </div>
    </aside>
  );
}
