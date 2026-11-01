import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Copy,
  Crop,
  Expand,
  RotateCw,
  Scissors,
} from "lucide-react";
import { useStudio } from "../store";
import { copy } from "../core";
import { editDesk, useRuntime } from "./runtime";
import {
  defaultPresentation,
  analysisRange,
  clipCue,
  type SourcePresentation,
} from "./mediaModel";
import { makeCue } from "./cueModel";
import { plannedViews, type PlannedView } from "./plannedViews";
import { setLiveFollow } from "./production";
import { timecode } from "./types";
import type { MediaAsset, SourceHandle } from "./types";
import { ensureFilmstrip } from "./assetStore";
export default function SourceTools({
  asset,
  source,
}: {
  asset: MediaAsset;
  source: React.RefObject<SourceHandle | null>;
}) {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!,
    d = b.studio!,
    p = d.sourcePresentations?.[asset.id] || defaultPresentation(),
    sequence = d.tracking[asset.id];
  const [tab, setTab] = useState(asset.type === "video" ? "clip" : "picture"),
    [error, setError] = useState(""),
    [stepping, setStepping] = useState(false),
    [accuracy, setAccuracy] = useState(""),
    [views, setViews] = useState<PlannedView[]>(["original", "annotated"]),
    [title, setTitle] = useState("");
  useEffect(() => {
    setTab(asset.type === "video" ? "clip" : "picture");
    setError("");
    setAccuracy("");
    setViews(["original", "annotated"]);
  }, [asset.id]);
  useEffect(() => {
    if (asset.type === "video" && !asset.filmstrip?.length)
      void ensureFilmstrip(asset)
        .then((next) => {
          if (next)
            useRuntime.setState({
              assets: useRuntime
                .getState()
                .assets.map((a) => (a.id === next.id ? next : a)),
            });
        })
        .catch(() => {});
  }, [asset.id, asset.revision]);
  const change = (fn: (p: SourcePresentation) => void) =>
    editDesk((d) => {
      const v = ((d.sourcePresentations ||= {})[asset.id] ||=
        defaultPresentation());
      fn(v);
    });
  const run = (fn: () => void) => {
    setError("");
    try {
      fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const seek = (time: number) =>
    r.set({
      time: Math.max(0, Math.min(asset.duration || 5, time)),
      mediaPlaying: false,
      reverseReview: false,
    });
  const step = async (delta: number) => {
    setStepping(true);
    try {
      const result = await source.current?.step?.(delta);
      if (result)
        setAccuracy(
          result.exact
            ? "Decoded frame timestamp"
            : "Approximate frame step · source timing unavailable",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStepping(false);
    }
  };
  const saveClips = (mode: "duplicate" | "split") =>
    run(() => {
      const ranges = clipCue(b, asset, d.trim, r.time, mode);
      s.commit((board) => {
        for (const [i, range] of ranges.entries()) {
          const next = copy(board);
          next.studio!.trim = range;
          const cue = makeCue(next, "footage", r.camera, range.start);
          cue.title =
            `${asset.name} · ${mode === "split" ? `part ${i + 1}` : "clip copy"}`.slice(
              0,
              80,
            );
          (board.studio!.cues ||= []).push(cue);
        }
      });
      s.notify(
        mode === "split"
          ? "Two editable source clips added to Show moments."
          : "Editable clip copy added to Show moments.",
      );
    });
  const setRange = (start: number, end: number) =>
    run(() => {
      const range = analysisRange(start, end, asset.duration);
      editDesk((d) => {
        d.trim = range;
      });
      seek(start);
    });
  const bookmarks = d.bookmarks.filter((m) => m.assetId === asset.id);
  return (
    <section className="source-tools" aria-label="Source analysis controls">
      <div className="source-tool-tabs">
        {[
          ["clip", asset.type === "video" ? "Clip" : "Still"],
          ["picture", "Picture"],
          ["present", "Present"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "picture" && (
        <>
          <div className="source-ab">
            <button
              aria-pressed={p.original}
              onClick={() =>
                change((p) => {
                  p.original = true;
                })
              }
            >
              Original
            </button>
            <button
              aria-pressed={!p.original}
              onClick={() =>
                change((p) => {
                  p.original = false;
                })
              }
            >
              Annotated
            </button>
          </div>
          <div className="source-button-row">
            <button
              onClick={() =>
                change((p) => {
                  p.original = false;
                  p.rotation = ((p.rotation + 90) %
                    360) as SourcePresentation["rotation"];
                })
              }
            >
              <RotateCw size={15} />
              Rotate 90°
            </button>
            <button
              onClick={() => {
                const a =
                  source.current
                    ?.element()
                    ?.closest('[data-testid="media-canvas"]') ||
                  document.querySelector('[data-testid="media-canvas"]');
                void a?.requestFullscreen?.().catch(() => {});
              }}
            >
              <Expand size={15} />
              Fullscreen
            </button>
          </div>
          <label>
            Brightness
            <input
              aria-label="Source brightness"
              type="range"
              min=".25"
              max="2"
              step=".05"
              value={p.brightness}
              onChange={(e) =>
                change((p) => {
                  p.original = false;
                  p.brightness = +e.target.value;
                })
              }
            />
            <span>{Math.round(p.brightness * 100)}%</span>
          </label>
          <label>
            Contrast
            <input
              aria-label="Source contrast"
              type="range"
              min=".25"
              max="2"
              step=".05"
              value={p.contrast}
              onChange={(e) =>
                change((p) => {
                  p.original = false;
                  p.contrast = +e.target.value;
                })
              }
            />
            <span>{Math.round(p.contrast * 100)}%</span>
          </label>
          <details>
            <summary>
              <Crop size={15} />
              Crop source
            </summary>
            <p>
              Crop moves the source and its annotations together. Calibration
              stays in original coordinates.
            </p>
            <div className="source-crop-grid">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key}>
                  {
                    { x: "Left", y: "Top", width: "Width", height: "Height" }[
                      key
                    ]
                  }{" "}
                  %
                  <input
                    aria-label={`Crop ${key} percent`}
                    type="number"
                    min={key === "width" || key === "height" ? 10 : 0}
                    max="100"
                    step="1"
                    value={Math.round(p.crop[key] * 100)}
                    onChange={(e) =>
                      change((p) => {
                        p.original = false;
                        const value = +e.target.value / 100;
                        if (!Number.isFinite(value)) return;
                        if (key === "x")
                          p.crop.x = Math.max(
                            0,
                            Math.min(1 - p.crop.width, value),
                          );
                        if (key === "y")
                          p.crop.y = Math.max(
                            0,
                            Math.min(1 - p.crop.height, value),
                          );
                        if (key === "width")
                          p.crop.width = Math.max(
                            0.1,
                            Math.min(1 - p.crop.x, value),
                          );
                        if (key === "height")
                          p.crop.height = Math.max(
                            0.1,
                            Math.min(1 - p.crop.y, value),
                          );
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <button
            className="film-button"
            onClick={() =>
              editDesk((d) => {
                (d.sourcePresentations ||= {})[asset.id] =
                  defaultPresentation();
              })
            }
          >
            Reset picture adjustments
          </button>
          <button
            className="film-button"
            aria-pressed={p.annotations}
            onClick={() =>
              change((p) => {
                p.annotations = !p.annotations;
              })
            }
          >
            {p.annotations ? "Hide annotations" : "Show annotations"}
          </button>
        </>
      )}
      {tab === "clip" && (
        <>
          {asset.type === "video" ? (
            <>
              <div className="source-button-row">
                <button
                  disabled={stepping}
                  onClick={() => void step(-1)}
                  aria-label="Previous decoded frame"
                >
                  <ChevronLeft size={17} />
                  Frame
                </button>
                <button
                  disabled={stepping}
                  onClick={() => void step(1)}
                  aria-label="Next decoded frame"
                >
                  Frame
                  <ChevronRight size={17} />
                </button>
              </div>
              <small>
                {accuracy ||
                  "Frame steps use decoded timestamps where supported. Otherwise the estimated frame interval is labelled."}
              </small>
              <div className="source-filmstrip">
                {asset.filmstrip?.map((image, i) => (
                  <button
                    key={i}
                    aria-label={`Jump to source thumbnail ${i + 1}`}
                    onClick={() => seek((i / 8) * asset.duration)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
              <label>
                Find a moment in the full source
                <input
                  type="range"
                  aria-label="Full source position"
                  min="0"
                  max={asset.duration}
                  step=".01"
                  value={r.time}
                  onChange={(e) => seek(+e.target.value)}
                />
              </label>
              <div className="source-time-range">
                <label>
                  Clip in
                  <input
                    aria-label="Analysis clip start"
                    key={d.trim.start + "start"}
                    type="number"
                    min="0"
                    max={asset.duration}
                    step=".01"
                    defaultValue={d.trim.start}
                    onBlur={(e) =>
                      setRange(
                        +e.target.value,
                        Math.min(
                          asset.duration,
                          Math.max(+e.target.value + 0.04, d.trim.end),
                          +e.target.value + 60,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Clip out
                  <input
                    aria-label="Analysis clip end"
                    key={d.trim.end + "end"}
                    type="number"
                    min="0"
                    max={asset.duration}
                    step=".01"
                    defaultValue={d.trim.end}
                    onBlur={(e) => setRange(d.trim.start, +e.target.value)}
                  />
                </label>
              </div>
              <small>
                Original source timestamps · {asset.duration.toFixed(1)}s source
                · 60s maximum passage · tracking up to 20s
              </small>
              <details className="source-more-clip">
                <summary>Loops, reverse & clip copies</summary>
                <div className="source-button-row">
                  <button
                    onClick={() =>
                      setRange(r.time, Math.min(asset.duration, r.time + 10))
                    }
                  >
                    Start 10s clip here
                  </button>
                  <button
                    aria-pressed={r.loopClip}
                    onClick={() => r.set({ loopClip: !r.loopClip })}
                  >
                    Loop {r.loopClip ? "on" : "off"}
                  </button>
                </div>
                <button
                  className="film-button"
                  aria-pressed={r.reverseReview}
                  onClick={() =>
                    r.set({
                      reverseReview: !r.reverseReview,
                      mediaPlaying: false,
                      muted: true,
                    })
                  }
                >
                  {r.reverseReview
                    ? "Stop reverse review"
                    : "Reverse review · silent"}
                </button>
                <small>
                  Reverse review seeks backwards through the selected passage;
                  it is a review tool rather than reverse audio playback.
                </small>
                <div className="source-button-row">
                  <button onClick={() => saveClips("duplicate")}>
                    <Copy size={15} />
                    Duplicate clip
                  </button>
                  <button onClick={() => saveClips("split")}>
                    <Scissors size={15} />
                    Split at playhead
                  </button>
                </div>
              </details>
            </>
          ) : (
            <p>
              Use Picture to adjust this still, then draw directly on the
              source. Source timestamps can be added in the media workspace.
            </p>
          )}
          <button
            className="film-button"
            onClick={() =>
              run(() => {
                if (bookmarks.length >= 100)
                  throw Error(
                    "This source has 100 bookmarks. Remove an old one first.",
                  );
                editDesk((d) =>
                  d.bookmarks.push({
                    id: crypto.randomUUID(),
                    assetId: asset.id,
                    time: r.time,
                    title: `${asset.name} · ${timecode(r.time)}`,
                    note: "",
                  }),
                );
              })
            }
          >
            <BookmarkPlus size={15} />
            Bookmark this moment
          </button>
          {bookmarks.map((m) => (
            <div className="source-bookmark" key={m.id}>
              <button onClick={() => seek(m.time)}>
                {timecode(m.time)} · {m.title.replace(asset.name + " · ", "")}
              </button>
              <button
                aria-label={`Remove bookmark ${m.title}`}
                onClick={() =>
                  editDesk((d) => {
                    d.bookmarks = d.bookmarks.filter((x) => x.id !== m.id);
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "present" && (
        <>
          <p>
            Build a prepared explanation from the source and its reviewed
            reconstruction.
          </p>
          <div className="source-ab">
            <button
              aria-pressed={p.original}
              onClick={() => {
                change((p) => {
                  p.original = true;
                });
                editDesk((d) => {
                  d.view = "footage";
                });
                r.set({ view: "footage", mediaPlaying: false });
              }}
            >
              Original
            </button>
            <button
              aria-pressed={!p.original && r.view === "footage"}
              onClick={() => {
                change((p) => {
                  p.original = false;
                });
                editDesk((d) => {
                  d.view = "footage";
                });
                r.set({ view: "footage", mediaPlaying: false });
              }}
            >
              Annotated
            </button>
          </div>
          <div className="source-button-row">
            <button
              disabled={!sequence?.reviewed}
              onClick={() => {
                editDesk((d) => {
                  d.comparisonView = "2d";
                  d.view = "split";
                });
                r.set({ view: "split", mediaPlaying: false });
              }}
            >
              Source + 2D
            </button>
            <button
              disabled={!sequence?.reviewed}
              onClick={() => {
                editDesk((d) => {
                  d.comparisonView = "3d";
                  d.view = "split";
                });
                r.set({ view: "split", mediaPlaying: false });
              }}
            >
              Source + 3D
            </button>
          </div>
          {!sequence?.reviewed && (
            <button
              className="film-button"
              onClick={() => r.set({ sidebar: "reconstruct", view: "footage" })}
            >
              Map and review players
            </button>
          )}
          <label>
            Segment headline
            <input
              aria-label="Prepared view sequence title"
              value={title}
              maxLength={120}
              placeholder={asset.segment || asset.name}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="source-planned-views">
            {(
              ["original", "annotated", "board", "replay", "split"] as const
            ).map((v) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={views.includes(v)}
                  disabled={
                    ["board", "replay", "split"].includes(v) &&
                    !sequence?.reviewed
                  }
                  onChange={() =>
                    setViews((old) =>
                      old.includes(v)
                        ? old.filter((x) => x !== v)
                        : [...old, v],
                    )
                  }
                />
                {
                  {
                    original: "Original source",
                    annotated: "Annotated source",
                    board: "2D explanation",
                    replay: "3D replay",
                    split: "Side-by-side comparison",
                  }[v]
                }
              </label>
            ))}
          </div>
          <button
            className="film-button primary"
            onClick={() =>
              run(() => {
                const cues = plannedViews(
                  b,
                  asset,
                  views,
                  r.time,
                  title || asset.segment || asset.name,
                  r.camera,
                );
                setLiveFollow(false);
                s.commit((b) => {
                  (b.studio!.cues ||= []).push(...cues);
                });
                r.set({ sidebar: "rundown" });
                s.notify(
                  `${cues.length} editable shots saved in order. Programme stays held.`,
                );
              })
            }
          >
            Save {views.length} views as a segment
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="source-control-error">
          {error}
        </p>
      )}
    </section>
  );
}
