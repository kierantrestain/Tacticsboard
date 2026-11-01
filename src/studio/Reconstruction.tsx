import { appendTrackingPhases } from "./reconstructionBoard";
import { playerCutout } from "./cutouts";
import StillSequence from "./StillSequence";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Crosshair,
  Focus,
  Layers3,
  MousePointer2,
  Scan,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  Waypoints,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Box,
} from "lucide-react";
import { useStudio } from "../store";
import { copy, uid } from "../core";
import { editDesk, useRuntime } from "./runtime";
import type {
  MediaAsset,
  SourceHandle,
  TrackedTarget,
  TrackingSequence,
  TrackFrame,
} from "./types";
import { emptyStudio, timecode } from "./types";
import { homography, pitchPresets, project } from "./geometry";
import { vision, pixels, cancelVision } from "./visionClient";
export default function Reconstruction({
  asset,
  source,
}: {
  asset?: MediaAsset;
  source: React.RefObject<SourceHandle | null>;
}) {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!;
  const d = b.studio || emptyStudio(),
    marks = asset ? d.landmarks[asset.id] || [] : [],
    targets = asset ? d.targets[asset.id] || [] : [],
    seq = asset ? d.tracking[asset.id] : undefined;
  const [preset, setPreset] = useState("full"),
    [fixed, setFixed] = useState(false);
  const config = pitchPresets.find((p) => p.id === preset)!;
  const map = homography(marks);
  const issues =
    seq?.frames.reduce(
      (n, f) => n + f.points.filter((p) => p.review&&!p.rejected).length,
      0,
    ) || 0;
  const startFrame = async () => {
    if (!source.current)
      throw Error("Open the footage or comparison view to prepare the source.");
    r.set({ mediaPlaying: false });
    await source.current.seek(d.trim.start);
    return source.current.capture();
  };
  const detect = async () => {
    if (!asset) return;
    r.set({
      busy: "Preparing on-device player detection",
      progress: 0,
      error: "",
    });
    try {
      const frame = await startFrame();
      if (!frame) throw Error("The source frame is not ready.");
      const image = pixels(frame);
      const detections: {
        x: number;
        y: number;
        w: number;
        h: number;
        confidence: number;
      }[] = await vision("detect", { frame: image });
      let i = 0;
      const found: TrackedTarget[] = detections
        .filter((p) => {
          if (!map) return true;
          const q = project(map, p);
          return q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1;
        })
        .map((p) => {
          const x = Math.max(
              0,
              Math.min(image.width - 1, Math.floor(p.x * image.width)),
            ),
            y = Math.max(
              0,
              Math.min(
                image.height - 1,
                Math.floor((p.y - p.h * 0.55) * image.height),
              ),
            ),
            at = (y * image.width + x) * 4,
            rgb = [image.data[at], image.data[at + 1], image.data[at + 2]];
          const color = (hex: string) =>
            [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
          const dist = (c: number[]) =>
            c.reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0);
          const side =
            dist(color(b.colors.home)) <= dist(color(b.colors.away))
              ? "home"
              : "away";
          return {
            id: uid(),
            name: `Player ${String(++i).padStart(2, "0")}`,
            side,
            number: "",
            image: { x: p.x, y: p.y },
            box: { w: p.w, h: p.h },
            confidence: p.confidence,
          };
        });
      if (!found.length)
        throw Error(
          "No suitable people were found in this frame. Use “Mark players” to select the players relevant to your story.",
        );
      for (const target of found) target.cutout = playerCutout(frame, target);
      editDesk((d) => {
        d.targets[asset.id] = found;
        delete d.tracking[asset.id];
      });
      s.notify(
        `${found.length} people detected. Confirm their teams and identities.`,
      );
    } catch (e) {
      r.set({
        error: e instanceof Error ? e.message : "Detection unavailable",
      });
    } finally {
      r.set({ busy: "", progress: 0 });
    }
  };
  const track = async () => {
    if (!asset || !map || !targets.length) return;
    r.set({
      busy:
        asset.type === "image"
          ? "Mapping the still"
          : "Tracking the selected passage",
      progress: 0,
      error: "",
      markMode: "none",
    });
    try {
      const raw = await startFrame();
      if (!raw) throw Error("The source frame is not ready.");
      const prepared = copy(targets);
      for (const target of prepared)
        if (!target.cutout) target.cutout = playerCutout(raw, target);
      editDesk((d) => {
        d.targets[asset.id] = prepared;
      });
      const first: TrackFrame = {
        time: d.trim.start,
        cameraConfidence: 1,
        map,
        points: prepared.map((t) => ({
          id: t.id,
          image: copy(t.image),
          pitch: project(map, t.image),
          confidence: t.confidence ?? 1,
          review: false,
          manual: !t.confidence,
        })),
      };
      const frames = [first],
        end = Math.min(
          d.trim.end,
          d.trim.start + 20,
          asset.duration || d.trim.end,
        );
      if (asset.type === "video") {
        await vision("start", {
          frame: pixels(raw),
          landmarks: marks,
          targets: prepared,
          fixedCamera: fixed,
        });
        for (
          let time = d.trim.start + 0.25;
          time <= end + 0.005;
          time += 0.25
        ) {
          await source.current!.seek(time);
          const frame = source.current!.capture();
          if (!frame) throw Error("The source frame could not be decoded.");
          const out = await vision("step", {
            frame: pixels(frame),
            time: Math.min(time, end),
            refresh: frames.length % 6 === 0,
          });
          frames.push(out);
          r.set({
            progress:
              (time - d.trim.start) / Math.max(0.25, end - d.trim.start),
          });
          if (out.cut) {
            s.notify(
              `Camera cut detected at ${timecode(time)}. Tracking stops for a calibration review.`,
            );
            break;
          }
        }
      }
      const result: TrackingSequence = {
        assetId: asset.id,
        start: d.trim.start,
        end: frames.at(-1)!.time,
        frames,
        targets: prepared,
        reviewed: false,
        createdAt: new Date().toISOString(),
        method:
          "Four-point pitch calibration, local patch motion tracking, camera compensation and optional MediaPipe person re-detection",
      };
      editDesk((d) => {
        d.tracking[asset.id] = result;
        d.showTracking = true;
      });
      r.set({ time: d.trim.start });
      await source.current?.seek(d.trim.start);
      s.notify(
        "Passage reconstructed. Review the markers before building your replay.",
      );
    } catch (e) {
      r.set({
        error: e instanceof Error ? e.message : "Tracking could not finish",
      });
    } finally {
      r.set({ busy: "", progress: 0, mediaPlaying: false });
    }
  };
  const build = () => {
    if (!asset || !seq?.reviewed) return;
    if ((s.board?.scenes.length || 0) >= 100) {
      s.notify(
        "The storyboard has 100 phases. Remove a phase before building another replay.",
      );
      return;
    }
    let added = 0;
    s.commit((b) => {
      added = appendTrackingPhases(b, seq, asset);
    });
    if (!added) {
      s.notify("No reviewed tracking frames are available to build.");
      return;
    }
    r.set({
      view: "board",
      sidebar: "tactics",
      time: seq.start,
      mediaPlaying: false,
    });
    s.notify(
      `${added} editable phases added. Existing phases and the original source are preserved.`,
    );
  };
  if (!asset)
    return (
      <aside className="tl-reconstruct">
        <div className="tl-panel-title">
          <div>
            <span className="tl-eyebrow">CLIP → TACTICAL REPLAY</span>
            <h2>Reconstruction</h2>
          </div>
          <Waypoints size={20} />
        </div>
        <div className="tl-empty-panel">
          <Focus size={34} />
          <h3>Import a source</h3>
          <p>
            Import a match still or a short clip. Calibrate the pitch, mark the
            players, then turn the movement into an editable replay.
          </p>
          <button
            className="tl-primary"
            onClick={() => r.set({ sidebar: "media", view: "footage" })}
          >
            Open source library <ArrowRight size={15} />
          </button>
        </div>
      </aside>
    );
  return (
    <aside className="tl-reconstruct">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">CLIP → TACTICAL REPLAY</span>
          <h2>Reconstruction</h2>
        </div>
        <Waypoints size={20} />
      </div>
      <div className="tl-reconstruction-scroll">
        <p className="ts-reconstruction-note">
          Analyst-assisted reconstruction. The pitch map locates visible
          players; team and identity suggestions need confirmation. Hidden
          players and the ball are not reconstructed automatically.
        </p>
        <div className="tl-workflow-step">
          <span className={`tl-step-number ${map ? "complete" : ""}`}>
            {map ? <Check size={14} /> : 1}
          </span>
          <div>
            <h3>Map the pitch</h3>
            <p>
              Pause on a clear start frame. Match four visible pitch landmarks.
            </p>
          </div>
        </div>
        <label className="tl-field">
          Landmark set
          <select
            aria-label="Pitch landmark set"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              editDesk((d) => {
                d.landmarks[asset.id] = [];
                delete d.tracking[asset.id];
              });
            }}
          >
            {pitchPresets.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="tl-calibration-mini">
          <svg viewBox="0 0 210 136">
            <rect x="1" y="1" width="208" height="134" rx="3" />
            <path d="M105 1V135M1 28H34V108H1M209 28H176V108H209" />
            <circle cx="105" cy="68" r="18" />
            {config.points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x * 208 + 1}
                  cy={p.y * 134 + 1}
                  r="6"
                  className={i < marks.length ? "done" : "pending"}
                />
                <text x={p.x * 208 + 1} y={p.y * 134 + 4}>
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
          <span>{marks.length} / 4 points matched</span>
        </div>
        <div className="tl-two-buttons">
          <button
            className="tl-secondary"
            disabled={marks.length >= 4}
            onClick={() => {
              r.set({
                view: "footage",
                markMode: "landmark",
                landmarkPitch: config.points[marks.length],
                landmarkLabel: config.points[marks.length].label,
                mediaPlaying: false,
              });
              if (!marks.length)
                editDesk((d) => {
                  d.trim.start = r.time;
                  d.trim.end = Math.min(
                    asset.duration || 20,
                    Math.max(r.time + 0.25, d.trim.end),
                  );
                });
            }}
          >
            <Crosshair size={14} />
            {marks.length === 4
              ? "Calibrated"
              : `Mark point ${marks.length + 1}`}
          </button>
          <button
            className="tl-icon"
            aria-label="Reset pitch calibration"
            title="Reset calibration"
            onClick={() =>
              editDesk((d) => {
                d.landmarks[asset.id] = [];
                delete d.tracking[asset.id];
              })
            }
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="tl-workflow-step">
          <span
            className={`tl-step-number ${targets.length ? "complete" : ""}`}
          >
            {targets.length ? <Check size={14} /> : 2}
          </span>
          <div>
            <h3>Identify the players</h3>
            <p>
              Detect people or mark their feet. Assign the players needed for
              the story.
            </p>
          </div>
        </div>
        <button className="tl-ai-button" onClick={detect} disabled={!!r.busy}>
          <Scan size={16} />
          <span>
            Detect players <small>On-device vision</small>
          </span>
          <Sparkles size={13} />
        </button>
        <div className="tl-two-buttons">
          <button
            className={`tl-secondary ${r.markMode === "target" ? "is-active" : ""}`}
            onClick={async () => {
              try {
                await startFrame();
                r.set({
                  markMode: r.markMode === "target" ? "none" : "target",
                  view: "footage",
                  mediaPlaying: false,
                });
              } catch (e) {
                r.set({
                  view: "footage",
                  error: "Open the source, then select Mark players again.",
                });
              }
            }}
          >
            <MousePointer2 size={14} />
            {r.markMode === "target" ? "Finish marking" : "Mark players"}
          </button>
          <select
            aria-label="Team for new markers"
            value={r.targetSide}
            onChange={(e) =>
              r.set({ targetSide: e.target.value as "home" | "away" })
            }
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </div>
        <p className="tl-small-note">
          Team colours are an initial suggestion. Confirm the team and real
          identity of each marker.
        </p>
        <div className="tl-target-list">
          {targets.map((t, i) => (
            <div className="tl-target-row" key={t.id}>
              <span
                className="tl-target-dot"
                style={{ background: b.colors[t.side] }}
              >
                {t.number || String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <select
                  aria-label={`Identity for ${t.name}`}
                  value={t.playerId || ""}
                  onChange={(e) =>
                    editDesk((d) => {
                      const target = d.targets[asset.id].find(
                        (x) => x.id === t.id,
                      )!;
                      const player = s.catalogue?.teams
                        .find(
                          (x) =>
                            x.id ===
                            (t.side === "home" ? b.homeTeamId : b.awayTeamId),
                        )
                        ?.players.find((p) => p.id === e.target.value);
                      Object.assign(target, {
                        playerId: player?.id,
                        name: player?.name || `Player ${i + 1}`,
                        number: player?.number || "",
                      });
                      if (d.tracking[asset.id]) {
                        d.tracking[asset.id].targets = copy(
                          d.targets[asset.id],
                        );
                        d.tracking[asset.id].reviewed = false;
                      }
                    })
                  }
                >
                  <option value="">{t.name} · unassigned</option>
                  {s.catalogue?.teams
                    .find(
                      (x) =>
                        x.id ===
                        (t.side === "home" ? b.homeTeamId : b.awayTeamId),
                    )
                    ?.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                </select>
                <button
                  className="tl-side-label"
                  onClick={() =>
                    editDesk((d) => {
                      const target = d.targets[asset.id].find(
                        (x) => x.id === t.id,
                      )!;
                      target.side = target.side === "home" ? "away" : "home";
                      target.playerId = undefined;
                      target.name = `Player ${i + 1}`;
                      target.number = "";
                      delete d.tracking[asset.id];
                    })
                  }
                >
                  {t.side === "home" ? "Home" : "Away"} team · change
                </button>
              </div>
              <button
                className="tl-icon"
                aria-label={`Remove marker ${i + 1}`}
                onClick={() =>
                  editDesk((d) => {
                    d.targets[asset.id] = d.targets[asset.id].filter(
                      (z) => z.id !== t.id,
                    );
                    delete d.tracking[asset.id];
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="tl-workflow-step">
          <span className={`tl-step-number ${seq ? "complete" : ""}`}>
            {seq ? <Check size={14} /> : 3}
          </span>
          <div>
            <h3>
              {asset.type === "image"
                ? "Project the positions"
                : "Track the passage"}
            </h3>
            <p>
              {asset.type === "image"
                ? "Convert the marked still into pitch coordinates."
                : "Follow the selected players for up to 20 seconds."}
            </p>
          </div>
        </div>
        {asset.type === "video" && (
          <label className="tl-field">
            Camera motion
            <select
              aria-label="Reconstruction camera motion"
              value={fixed ? "fixed" : "track"}
              onChange={(e) => setFixed(e.target.value === "fixed")}
            >
              <option value="track">Compensate camera movement</option>
              <option value="fixed">Locked camera / static shot</option>
            </select>
          </label>
        )}
        {asset.type==='video'&&d.trim.end-d.trim.start>20&&<p className="tl-small-note">Tracking processes the first 20 seconds of this passage. Shorten the clip range to focus on another moment.</p>}
        <button
          className="tl-primary full"
          disabled={!map || !targets.length || !!r.busy}
          onClick={track}
        >
          <Waypoints size={16} />
          {asset.type === "image"
            ? "Map still to pitch"
            : "Track selected range"}
          <ChevronRight size={15} />
        </button>
        {seq && (
          <>
            <details className="tracking-review-details"><summary>Review sampled observations</summary><p className="tl-small-note">Drag a marker on the source to correct its nearest sampled frame. Reject an uncertain observation to hide it from reconstruction and interpolation.</p><div className="tracking-review-jumps">{seq.frames.filter(f=>f.points.some(p=>p.review&&!p.rejected)).slice(0,16).map(f=><button key={f.time} onClick={()=>r.set({time:f.time,mediaPlaying:false})}>{timecode(f.time)} · {f.points.filter(p=>p.review&&!p.rejected).length} flagged</button>)}</div>{(()=>{const frame=seq.frames.length?seq.frames.reduce((a,b)=>Math.abs(a.time-r.time)<Math.abs(b.time-r.time)?a:b):undefined;if(!frame)return <p>No sampled observations. Track the source again.</p>;return <><strong className="tl-small-note">Sample {timecode(frame.time)} · camera confidence {Math.round(frame.cameraConfidence*100)}%</strong>{frame.points.map(p=><div className="tracking-review-point" key={p.id}><button onClick={()=>r.set({time:frame.time,mediaPlaying:false})}>{seq.targets.find(t=>t.id===p.id)?.name||'Player'}<small>{p.rejected?'Rejected':p.manual?'Manually reviewed':`${Math.round(p.confidence*100)}% tracking confidence`}</small></button><button aria-label={`${p.rejected?'Restore':'Reject'} observation ${p.id}`} onClick={()=>editDesk(d=>{const sample=d.tracking[asset.id].frames.find(f=>f.time===frame.time)!.points.find(q=>q.id===p.id)!;sample.rejected=!sample.rejected;d.tracking[asset.id].reviewed=false;})}>{p.rejected?'Restore':'Reject'}</button></div>)}</>;})()}</details>
            <div className={`tl-quality-card ${issues ? "needs-review" : ""}`}>
              <span>
                {issues ? (
                  <AlertTriangle size={17} />
                ) : (
                  <ShieldCheck size={17} />
                )}
              </span>
              <div>
                <strong>
                  {issues
                    ? "Review highlighted observations"
                    : "Ready for analyst review"}
                </strong>
                <p>
                  {seq.frames.length} sampled frames · {targets.length} players
                  {issues ? ` · ${issues} uncertain observations` : ""}
                </p>
              </div>
            </div>
            <p className="tl-small-note">
              Scrub the clip. Drag any incorrect marker to correct that frame.
              Check pitch alignment and player identity before using the replay.
              Ball movement is not inferred.
            </p>
            <label className="tl-check">
              <input
                type="checkbox"
                checked={seq.reviewed}
                onChange={(e) =>
                  editDesk((d) => {
                    d.tracking[asset.id].reviewed = e.target.checked;
                  })
                }
              />
              <span>I have reviewed the calibration and player markers.</span>
            </label>
            <button
              className="tl-primary full"
              disabled={!seq.reviewed}
              onClick={build}
            >
              <Layers3 size={16} />
              Build editable replay <ArrowRight size={15} />
            </button>
            {b.scenes.some((s) => s.source?.assetId === asset.id) && (
              <button
                className="tl-secondary full"
                onClick={() =>
                  r.set({
                    view: "replay",
                    time: seq.start,
                    mediaPlaying: false,
                  })
                }
              >
                <Box size={15} />
                Open 3D replay
              </button>
            )}
          </>
        )}
        <div className="tl-method-note">
          <ShieldCheck size={13} />
          <p>
            Analyst-assisted reconstruction. Camera cuts and uncertain
            observations are flagged. This is an editable interpretation, not
            official optical tracking.
          </p>
        </div>
        <StillSequence />
      </div>
    </aside>
  );
}
