import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Camera,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  FastForward,
  Pause,
  Play,
  Plus,
  Repeat2,
  Rewind,
  Scissors,
  SkipBack,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useStudio } from "../store";
import { totalDuration, uid } from "../core";
import { useRuntime, editDesk } from "./runtime";
import type { MediaAsset, SourceHandle } from "./types";
import { emptyStudio, timecode } from "./types";
import { getMedia, putRecord, saveFreeze } from "./assetStore";
export async function freezeFrame(
  asset: MediaAsset | undefined,
  source: SourceHandle | null,
) {
  if (!asset || !source) return;
  const raw = source.capture();
  if (!raw) return;
  const r = useRuntime.getState(),
    s = useStudio.getState();
  r.set({ busy: "Saving freeze frame", progress: 0 });
  try {
    const still = await saveFreeze(asset, raw, r.time);
    r.set({ assets: [still, ...r.assets] });
    s.notify("Freeze frame saved to the source library.");
  } catch (e) {
    r.set({
      error: e instanceof Error ? e.message : "The frame could not be saved.",
    });
  } finally {
    r.set({ busy: "" });
  }
}
export function bookmarkMoment(asset?: MediaAsset) {
  const s = useStudio.getState(),
    r = useRuntime.getState();
  if (!asset) {
    s.addScene();
    return;
  }
  editDesk((d) => {
    d.bookmarks.push({
      id: uid(),
      assetId: asset.id,
      time: r.time,
      title: `Moment ${String(d.bookmarks.length + 1).padStart(2, "0")}`,
      note: "",
    });
  });
  s.notify("Moment added to the rundown.");
}
export default function Transport({
  asset,
  source,
}: {
  asset?: MediaAsset;
  source: React.RefObject<SourceHandle | null>;
}) {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!,
    d = b.studio || emptyStudio(),
    isSource =
      !!asset &&
      (r.view === "footage" ||
        r.view === "split" ||
        (r.view === "replay" && !!d.tracking[asset.id]));
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const duration = isSource ? asset!.duration || d.trim.end : totalDuration(b),
    time = isSource ? r.time : (s.previewTime ?? 0),
    playing = isSource ? r.mediaPlaying : s.playing;
  useEffect(() => {
    let alive = true;
    setFilmstrip(asset?.filmstrip || []);
    if (!asset || asset.type !== "video" || asset.filmstrip?.length) return;
    let url: string;
    const make = async () => {
      const blob = await getMedia(asset.id);
      if (!blob || !alive) return;
      url = URL.createObjectURL(blob);
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject();
      });
      const images = [];
      for (let i = 0; i < 8; i++) {
        if (!alive) break;
        const t = Math.min(asset.duration - 0.1, (asset.duration * i) / 8);
        if (Math.abs(v.currentTime - t) > 0.01)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1000);
            v.onseeked = () => {
              clearTimeout(timer);
              resolve();
            };
            v.currentTime = t;
          });
        const c = document.createElement("canvas");
        c.width = 192;
        c.height = Math.round((192 * asset.height) / asset.width);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        images.push(c.toDataURL("image/jpeg", 0.55));
      }
      if (alive) {
        setFilmstrip(images);
        const updated = { ...asset, filmstrip: images };
        await putRecord("meta", asset.id, updated);
        r.set({
          assets: useRuntime
            .getState()
            .assets.map((a) => (a.id === asset.id ? updated : a)),
        });
      }
      URL.revokeObjectURL(url);
    };
    void make().catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset?.id]);
  const seek = (t: number) => {
    if (isSource)
      r.set({
        time: Math.max(0, Math.min(duration, t)),
        mediaPlaying: false,
        markMode: "none",
      });
    else
      s.set({
        previewTime: Math.max(0, Math.min(duration, t)),
        playing: false,
        playhead: t,
      });
  };
  const toggle = () => {
    if (isSource) {
      if (asset?.type === "image") return;
      let t = r.time;
      if (t >= Math.min(d.trim.end, duration) - 0.05 || t < d.trim.start)
        t = d.trim.start;
      r.set({ mediaPlaying: !r.mediaPlaying, time: t });
    } else {
      if (b.scenes.length < 2) {
        s.notify("Add a second phase to animate the tactical replay.");
        return;
      }
      s.set({ playing: !s.playing, playhead: time >= duration ? 0 : time });
    }
  };
  return (
    <section
      className="tl-transport"
      aria-label="Analysis transport and timeline"
    >
      <div className="tl-transport-top">
        <div className="tl-timeline-heading">
          <span className="tl-eyebrow">
            {isSource ? "SOURCE TIMELINE" : "TACTICAL STORYBOARD"}
          </span>
          <strong>
            {isSource ? asset?.name : "Build the story, moment by moment"}
          </strong>
        </div>
        <div className="tl-playback-controls">
          <button
            className="tl-icon"
            aria-label="Return to start"
            onClick={() => seek(isSource ? d.trim.start : 0)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="tl-icon"
            aria-label="Previous frame"
            title="Previous nominal frame (←)"
            onClick={() => seek(time - 1 / d.fps)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="tl-play-button"
            aria-label={playing ? "Pause analysis" : "Play analysis"}
            onClick={toggle}
          >
            {playing ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            className="tl-icon"
            aria-label="Next frame"
            title="Next nominal frame (→)"
            onClick={() => seek(time + 1 / d.fps)}
          >
            <ChevronRight size={19} />
          </button>
          <span className="tl-timecode">
            {timecode(time, d.fps)}
            <small>/ {timecode(duration, d.fps)}</small>
          </span>
          <select
            aria-label="Analysis playback speed"
            value={isSource ? r.rate : s.speed}
            onChange={(e) =>
              isSource
                ? r.set({ rate: +e.target.value })
                : s.set({ speed: +e.target.value })
            }
          >
            {[0.25, 0.5, 1, 1.5, 2].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
          <button
            className={`tl-icon ${r.loopClip ? "is-active" : ""}`}
            aria-label="Loop selected range"
            aria-pressed={r.loopClip}
            onClick={() => {
              r.set({ loopClip: !r.loopClip });
              s.set({ loop: !s.loop });
            }}
          >
            <Repeat2 size={17} />
          </button>
          {isSource && (
            <button
              className="tl-icon"
              aria-label={r.muted ? "Unmute source" : "Mute source"}
              onClick={() => r.set({ muted: !r.muted })}
            >
              {r.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          )}
        </div>
        <div className="tl-transport-actions">
          {isSource ? (
            <>
              <button
                className="tl-quiet"
                onClick={() => freezeFrame(asset, source.current)}
              >
                <Camera size={15} />
                <span>Freeze frame</span>
              </button>
              <button
                className="tl-quiet"
                onClick={() => bookmarkMoment(asset)}
              >
                <BookmarkPlus size={15} />
                <span>Mark moment</span>
              </button>
            </>
          ) : (
            <button className="tl-secondary" onClick={s.addScene}>
              <Plus size={15} />
              Add phase
            </button>
          )}
        </div>
      </div>
      {isSource ? (
        <>
          <div className="tl-filmstrip">
            <div className="tl-filmstrip-images">
              {(filmstrip.length ? filmstrip : [asset!.thumbnail]).map(
                (img, i) => (
                  <img key={i} src={img} alt="" />
                ),
              )}
            </div>
            <div
              className="tl-trim-shade left"
              style={{ width: `${(d.trim.start / duration) * 100}%` }}
            />
            <div
              className="tl-trim-shade right"
              style={{
                width: `${Math.max(0, ((duration - d.trim.end) / duration) * 100)}%`,
              }}
            />
            <div
              className="tl-selected-range"
              style={{
                left: `${(d.trim.start / duration) * 100}%`,
                width: `${(Math.min(duration, d.trim.end - d.trim.start) / duration) * 100}%`,
              }}
            />
            <input
              aria-label="Source playhead"
              type="range"
              min="0"
              max={duration}
              step={1 / d.fps}
              value={Math.min(duration, time)}
              onChange={(e) => seek(+e.target.value)}
            />
            <div
              className="tl-playhead"
              style={{ left: `${(time / duration) * 100}%` }}
            >
              <span />
              {timecode(time, d.fps)}
            </div>
            {d.bookmarks
              .filter((m) => m.assetId === asset!.id)
              .map((m) => (
                <button
                  key={m.id}
                  className="tl-moment-marker"
                  style={{ left: `${(m.time / duration) * 100}%` }}
                  title={m.title}
                  onClick={() => seek(m.time)}
                >
                  <BookmarkPlus size={13} />
                </button>
              ))}
          </div>
          <div className="tl-trim-controls">
            <span>
              <Scissors size={13} />
              ANALYSIS RANGE
            </span>
            <button
              onClick={() =>
                editDesk((d) => {
                  d.trim.start = time;
                  d.trim.end = Math.min(
                    asset!.duration || 20,
                    Math.max(time + 0.25, Math.min(time + 20, d.trim.end)),
                  );
                })
              }
            >
              Set in <kbd>I</kbd>
            </button>
            <strong>{timecode(d.trim.start, d.fps)}</strong>
            <i>→</i>
            <strong>{timecode(d.trim.end, d.fps)}</strong>
            <button
              onClick={() =>
                editDesk((d) => {
                  d.trim.end = Math.max(
                    d.trim.start + 0.25,
                    Math.min(time, d.trim.start + 20, asset!.duration || 20),
                  );
                })
              }
            >
              Set out <kbd>O</kbd>
            </button>
            <span className="tl-range-length">
              {(d.trim.end - d.trim.start).toFixed(1)} sec
            </span>
            <small>Frame step: {d.fps} fps</small>
            <select
              aria-label="Nominal frame rate"
              value={d.fps}
              onChange={(e) =>
                editDesk((d) => {
                  d.fps = +e.target.value;
                })
              }
            >
              {[24, 25, 30, 50, 60].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div className="tl-phases">
          {b.scenes.map((scene, i) => (
            <div
              className={`tl-phase ${b.activeScene === scene.id ? "is-active" : ""}`}
              key={scene.id}
              role="button"
              tabIndex={0}
              onClick={() => s.selectScene(scene.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") s.selectScene(scene.id);
              }}
            >
              <div className="tl-phase-preview">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <svg viewBox="0 0 140 78">
                  <rect x="4" y="4" width="132" height="70" />
                  <path d="M70 4V74M4 24H22V54H4M136 24H118V54H136" />
                  <circle cx="70" cy="39" r="11" />
                  {scene.players.map((p) => (
                    <circle
                      key={p.uid}
                      className="tl-mini-player"
                      cx={4 + p.x * 132}
                      cy={4 + p.y * 70}
                      r="2.8"
                      fill={b.colors[p.side]}
                    />
                  ))}
                </svg>
                <button
                  className="tl-phase-delete"
                  aria-label={`Delete phase ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    s.deleteScene(scene.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
              <div className="tl-phase-name">
                <input
                  aria-label={`Phase ${i + 1} title`}
                  defaultValue={scene.title}
                  key={scene.id + scene.title}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    if (e.target.value !== scene.title)
                      s.commit((b) => {
                        b.scenes.find((x) => x.id === scene.id)!.title =
                          e.target.value.slice(0, 60) || "Untitled phase";
                      });
                  }}
                />
                <span>{scene.duration.toFixed(1)}s</span>
              </div>
            </div>
          ))}
          <button className="tl-add-phase" onClick={s.addScene}>
            <Plus size={22} />
            <span>Next phase</span>
          </button>
          <div className="tl-presenter-note">
            <label>
              PRESENTER NOTE
              <textarea
                key={b.activeScene}
                defaultValue={
                  b.scenes.find((x) => x.id === b.activeScene)?.note
                }
                placeholder="What should the panel notice?"
                onBlur={(e) =>
                  s.commit((b) => {
                    b.scenes.find((x) => x.id === b.activeScene)!.note =
                      e.target.value;
                  })
                }
              />
            </label>
            <label className="tl-phase-duration">
              Hold / transition
              <input
                aria-label="Phase duration"
                type="number"
                min=".25"
                max="60"
                step=".25"
                value={
                  b.scenes.find((x) => x.id === b.activeScene)?.duration || 1
                }
                onChange={(e) =>
                  s.commit((b) => {
                    b.scenes.find((x) => x.id === b.activeScene)!.duration =
                      Math.max(0.25, Math.min(60, +e.target.value));
                  })
                }
              />{" "}
              s
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
