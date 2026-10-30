import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CloudCheck,
  Download,
  Expand,
  FolderOpen,
  HelpCircle,
  Loader2,
  Maximize2,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  Settings2,
  Upload,
  X,
  Layers2,
  Image as ImageIcon,
  Trash2,
  Radio,
  ArrowRight,
} from "lucide-react";
import BoardCanvas from "./BoardCanvas";
import type { BoardHandle } from "./BoardCanvas";
import { useStudio, channel } from "./store";
import {
  clamp,
  copy,
  dateLabel,
  download,
  filename,
  totalDuration,
} from "./core";
import type { Board, Catalogue, MatchDetails, Tool } from "./types";
import Toolbar from "./components/Toolbar";
import Sidebar, { TeamBadge } from "./components/Sidebar";
import Timeline from "./components/Timeline";
import Modals from "./components/Modals";

function hydrate(data: Catalogue, details: Record<string, MatchDetails>) {
  for (const t of data.teams) {
    t.recentLineups = Object.values(details)
      .flatMap((d) => {
        const line = d.lineups.find((l) => l.teamId === t.id),
          match = data.matches.find((m) => m.id === d.id);
        return line && match
          ? [
              {
                matchId: d.id,
                date: match.date,
                formation: line.formation || undefined,
                players: line.players,
              },
            ]
          : [];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  return data;
}
function drawProductionFrame(
  ctx: CanvasRenderingContext2D,
  raw: CanvasImageSource,
  rawWidth: number,
  rawHeight: number,
  b: Board,
  c: Catalogue,
  width: number,
  height: number,
) {
  const k = width / 1920;
  ctx.fillStyle = "#0c1511";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#c3f278";
  ctx.font = `800 ${34 * k}px Arial`;
  ctx.fillText("FIXTURE", 50 * k, 61 * k);
  ctx.fillStyle = "#92a698";
  ctx.font = `${12 * k}px Arial`;
  ctx.fillText("TACTICS STUDIO", 52 * k, 84 * k);
  const home = c.teams.find((t) => t.id === b.homeTeamId),
    away = c.teams.find((t) => t.id === b.awayTeamId);
  ctx.textAlign = "right";
  ctx.fillStyle = "#eef4e9";
  ctx.font = `600 ${25 * k}px Arial`;
  ctx.fillText(
    `${home?.shortName || "Home"}   ${b.match?.completed ? `${b.match.homeScore ?? "–"} — ${b.match.awayScore ?? "–"}` : "v"}   ${away?.shortName || "Away"}`,
    width - 50 * k,
    61 * k,
  );
  ctx.textAlign = "left";
  const availableW = width - 60 * k,
    availableH = height - 155 * k;
  const ratio = Math.min(availableW / rawWidth, availableH / rawHeight),
    w = rawWidth * ratio,
    h = rawHeight * ratio;
  ctx.drawImage(raw, (width - w) / 2, 107 * k, w, h);
  ctx.fillStyle = "#e7efe4";
  ctx.font = `500 ${17 * k}px Arial`;
  ctx.fillText(b.title, 50 * k, height - 23 * k);
  ctx.textAlign = "right";
  ctx.font = `${11 * k}px Arial`;
  ctx.fillStyle = "#8aa08e";
  ctx.fillText(
    "BANG ON ENTERTAINMENT  ·  ANALYST RECONSTRUCTION",
    width - 50 * k,
    height - 24 * k,
  );
  ctx.textAlign = "left";
}
export default function App() {
  const s = useStudio(),
    { board, catalogue } = s;
  const boardRef = useRef<BoardHandle>(null),
    importInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [recording, setRecording] = useState(false);
  const program = new URLSearchParams(location.search).has("output");
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/data/catalogue.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
      fetch("/data/matches.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
    ])
      .then(([d, m]) => {
        if (!active) return;
        if (!d.teams?.length) throw Error();
        s.init(hydrate(d, m), m);
        if (program)
          channel?.postMessage({
            type: "request",
            id: new URLSearchParams(location.search).get("session"),
          });
      })
      .catch((err) => {
        console.error("Studio initialisation failed", err);
        setError(
          "The football catalogue could not be loaded. Reload to reconnect to the studio.",
        );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!s.playing) return;
    let raf: number;
    const start = performance.now(),
      offset = s.playhead;
    const tick = (now: number) => {
      const state = useStudio.getState(),
        b = state.board;
      if (!b) return;
      const total = totalDuration(b);
      let t = offset + ((now - start) / 1000) * state.speed;
      if (t >= total) {
        if (state.loop) t = t % total;
        else {
          state.set({ playing: false, previewTime: total, playhead: total });
          channel?.postMessage({ type: "playback", id: b.id, time: total });
          return;
        }
      }
      state.set({ previewTime: t });
      channel?.postMessage({ type: "playback", id: b.id, time: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, s.playhead, s.speed, s.loop]);
  const togglePresenter = () => {
    const state = useStudio.getState();
    if (state.presenting) {
      state.set({ presenting: false });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      state.set({ presenting: true });
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const state = useStudio.getState();
      const el = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
        el.isContentEditable
      )
        return;
      if (state.modal) return;
      const k = e.key.toLowerCase();
      if (program) {
        if (k === "f")
          document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        e.shiftKey ? state.redo() : state.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "s") {
        e.preventDefault();
        state.save();
        state.notify("Analysis saved");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hot: Record<string, Tool> = {
        v: "select",
        a: "arrow",
        r: "run",
        l: "line",
        d: "pen",
        z: "zone",
        o: "ellipse",
        g: "triangle",
        h: "spotlight",
        t: "text",
        e: "erase",
      };
      if (hot[k]) {
        state.set({ tool: hot[k] });
        return;
      }
      if (k === "k") {
        state.addScene();
        return;
      }
      if (k === "f") {
        togglePresenter();
        return;
      }
      if (k === "?") {
        state.set({ modal: "help" });
        return;
      }
      if (k === " ") {
        e.preventDefault();
        if ((state.board?.scenes.length || 0) < 2) {
          state.notify("Add a second phase to animate the play.");
          return;
        }
        state.set({
          playing: !state.playing,
          playhead: state.previewTime ?? 0,
        });
        return;
      }
      if (k === "escape") {
        if (state.presenting) {
          state.set({ presenting: false });
          if (document.fullscreenElement) document.exitFullscreen();
        } else {
          state.cancel();
          state.set({ tool: "select", selected: [], selectedShape: null });
        }
        return;
      }
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        state.commit((b) => {
          b.players = b.players.filter((p) => !state.selected.includes(p.uid));
          b.drawings = b.drawings.filter((d) => d.id !== state.selectedShape);
        });
        state.set({ selected: [], selectedShape: null });
        return;
      }
      if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k) &&
        state.selected.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 0.035 : 0.008;
        state.commit((b) => {
          b.players = b.players.map((p) =>
            state.selected.includes(p.uid)
              ? {
                  ...p,
                  x: clamp(
                    p.x +
                      (k === "arrowright"
                        ? step
                        : k === "arrowleft"
                          ? -step
                          : 0),
                  ),
                  y: clamp(
                    p.y +
                      (k === "arrowdown" ? step : k === "arrowup" ? -step : 0),
                  ),
                }
              : p,
          );
        });
      }
    };
    window.addEventListener("keydown", key);
    const fullscreen = () => {
      if (!document.fullscreenElement)
        useStudio.getState().set({ presenting: false });
    };
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  if (error)
    return (
      <main className="error-screen">
        <div className="brand-symbol">F</div>
        <h1>The studio is temporarily unavailable.</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Reload studio</button>
      </main>
    );
  if (!board || !catalogue)
    return (
      <main className="loading-screen">
        <div className="brand-symbol">F</div>
        <h1>Setting up the studio</h1>
        <p>Loading clubs, squads and your analysis workspace.</p>
        <Loader2 className="spin" size={22} />
      </main>
    );
  const home = catalogue.teams.find((t) => t.id === board.homeTeamId),
    away = catalogue.teams.find((t) => t.id === board.awayTeamId);
  const activeScene = board.scenes.find((x) => x.id === board.activeScene)!;
  const clearSelection = async () => {
    const old = { selected: s.selected, selectedShape: s.selectedShape };
    s.set({ selected: [], selectedShape: null });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return old;
  };
  const exportPNG = async () => {
    const old = await clearSelection();
    try {
      const stage = boardRef.current?.stage();
      if (!stage) throw Error();
      const raw = stage.toCanvas({ pixelRatio: 3840 / stage.width() });
      const out = document.createElement("canvas");
      out.width = 3840;
      out.height = 2160;
      const ctx = out.getContext("2d")!;
      drawProductionFrame(
        ctx,
        raw,
        raw.width,
        raw.height,
        board,
        catalogue,
        3840,
        2160,
      );
      out.toBlob((blob) => {
        if (blob) download(blob, filename(board.title) + ".png");
        else s.notify("The image could not be exported.");
      }, "image/png");
      s.set({ modal: null });
      s.notify("4K broadcast still exported");
    } catch {
      s.notify(
        "The image could not be exported. Try hiding reference media and export again.",
      );
    } finally {
      s.set(old);
    }
  };
  const exportJSON = () => {
    s.save();
    download(
      new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }),
      filename(board.title) + ".fixture.json",
    );
    s.set({ modal: null });
    s.notify("Editable analysis exported");
  };
  const exportVideo = async () => {
    if (recording) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !HTMLCanvasElement.prototype.captureStream
    ) {
      s.notify(
        "Video recording is not supported in this browser. Export PNG or JSON instead.",
      );
      return;
    }
    if (board.scenes.length < 2) {
      s.notify("Add at least two phases before exporting an animation.");
      return;
    }
    const old = await clearSelection();
    s.set({
      modal: null,
      playing: false,
      previewTime: 0,
      playhead: 0,
      speed: 1,
    });
    setRecording(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    const mime = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/mp4",
    ].find((x) => MediaRecorder.isTypeSupported(x));
    if (!mime) {
      s.notify("This browser has no supported video recorder.");
      setRecording(false);
      s.set(old);
      return;
    }
    let raf = 0;
    let lastFrame = 0;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8000000,
    });
    const start = performance.now(),
      total = totalDuration(board);
    const draw = (now: number) => {
      const time = Math.min((now - start) / 1000, total);
      s.set({ previewTime: time });
      channel?.postMessage({ type: "playback", id: board.id, time });
      if (now - lastFrame >= 1000 / 30) {
        const stage = boardRef.current?.stage();
        if (stage) {
          const raw = stage.toCanvas({ pixelRatio: 1.4 });
          drawProductionFrame(
            ctx,
            raw,
            raw.width,
            raw.height,
            board,
            catalogue,
            1920,
            1080,
          );
        }
        lastFrame = now;
      }
      if (time < total) raf = requestAnimationFrame(draw);
      else
        setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 150);
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      download(
        new Blob(chunks, { type: mime }),
        filename(board.title) +
          (mime.startsWith("video/mp4") ? ".mp4" : ".webm"),
      );
      setRecording(false);
      s.set({ ...old, previewTime: null });
      s.notify("Animated broadcast sequence exported");
    };
    recorder.onerror = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      s.set(old);
      s.notify("The animation could not be recorded in this browser.");
    };
    try {
      recorder.start(200);
      raf = requestAnimationFrame(draw);
    } catch {
      setRecording(false);
      s.set(old);
      stream.getTracks().forEach((t) => t.stop());
      s.notify("The video recorder could not start.");
    }
  };
  if (program)
    return (
      <main className="program-page">
        <header className="program-heading">
          <div className="program-brand">
            FIXTURE<span>TACTICS STUDIO</span>
          </div>
          <div className="program-match">
            <TeamBadge team={home} />
            <strong>{home?.shortName}</strong>
            <span className="program-score">
              {board.match?.completed
                ? `${board.match.homeScore ?? "–"} — ${board.match.awayScore ?? "–"}`
                : "v"}
            </span>
            <strong>{away?.shortName}</strong>
            <TeamBadge team={away} />
          </div>
          <button
            title="Fullscreen (F)"
            className="program-fullscreen"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            <Maximize2 size={20} />
          </button>
        </header>
        <div className="program-board">
          <BoardCanvas ref={boardRef} program />
        </div>
        <footer>
          <strong>{board.title}</strong>
          <span>BANG ON ENTERTAINMENT · ANALYST RECONSTRUCTION</span>
        </footer>
      </main>
    );
  return (
    <main
      className={`studio ${s.presenting ? "presenter-layout" : ""} ${sidebarOpen ? "sidebar-open" : ""}`}
    >
      <header className="studio-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            s.set({ modal: "library" });
          }}
          aria-label="Fixture tactics studio home"
        >
          <span className="brand-symbol">F</span>
          <span className="brand-name">
            FIXTURE<span>TACTICS STUDIO</span>
          </span>
        </a>
        <div className="header-divider" />
        <div className="workspace-title">
          <span className="eyebrow">ANALYSIS WORKSPACE</span>
          <input
            aria-label="Analysis title"
            key={board.id + board.title}
            defaultValue={board.title}
            onBlur={(e) => {
              if (e.target.value !== board.title)
                s.commit((b) => {
                  b.title =
                    e.target.value.trim().slice(0, 120) || "Untitled analysis";
                });
            }}
          />
        </div>
        <span className={`autosave ${s.saveError ? "error" : ""}`}>
          <span className="live-dot" />
          {s.saveError ? "Export to save" : "All changes saved"}
        </span>
        <div className="header-actions">
          <button
            className="icon-button"
            title="Analysis library"
            aria-label="Open analysis library"
            onClick={() => s.set({ modal: "library" })}
          >
            <FolderOpen size={18} />
          </button>
          <button
            className="icon-button"
            title="Import analysis JSON"
            aria-label="Import analysis JSON"
            onClick={() => importInput.current?.click()}
          >
            <Upload size={17} />
          </button>
          <button
            className="icon-button new-analysis"
            title="New analysis"
            aria-label="New analysis"
            onClick={s.create}
          >
            <Plus size={18} />
          </button>
          <button
            className="secondary-button"
            onClick={() => s.set({ modal: "export" })}
          >
            <ArrowDownToLine size={15} />
            <span>Export</span>
            <ChevronDown size={12} />
          </button>
          <button
            className="secondary-button output-button"
            title="Open clean synchronised output in another window"
            onClick={() => {
              s.save();
              const w = window.open(
                `/?output=1&session=${encodeURIComponent(board.id)}`,
                "fixture-program",
              );
              if (w)
                s.notify(
                  "Clean TV output opened. Move it to your studio display or OBS.",
                );
              else
                s.notify("Allow pop-ups for this site to open the TV output.");
            }}
          >
            <Monitor size={15} />
            <span>TV output</span>
          </button>
          <button className="primary-button" onClick={togglePresenter}>
            <Expand size={15} />
            <span>Present</span>
          </button>
        </div>
      </header>
      <section
        className="match-bar"
        aria-label="Match selection and formation controls"
      >
        <div className="competition-label">
          <span className="competition-mark">
            {board.competition === "eng.1" ? "PL" : "CL"}
          </span>
          <div>
            <span>
              {board.competition === "eng.1"
                ? "Premier League"
                : "Champions League"}
            </span>
            <small>2026 / 27 season</small>
          </div>
        </div>
        <div className="matchup-bar">
          <button
            className="team-picker"
            onClick={() => s.set({ modal: "teams" })}
          >
            <TeamBadge team={home} size="small" />
            <strong>{home?.shortName}</strong>
            <ChevronDown size={12} />
          </button>
          <select
            aria-label="Home starting formation"
            value={board.formations.home}
            onChange={(e) => s.formation("home", e.target.value)}
          >
            {[
              ...new Set([
                "4-3-3",
                "4-2-3-1",
                "4-4-2",
                "3-4-3",
                "3-5-2",
                "5-3-2",
                board.formations.home,
              ]),
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <span className="versus">v</span>
          <select
            aria-label="Away starting formation"
            value={board.formations.away}
            onChange={(e) => s.formation("away", e.target.value)}
          >
            {[
              ...new Set([
                "4-3-3",
                "4-2-3-1",
                "4-4-2",
                "3-4-3",
                "3-5-2",
                "5-3-2",
                board.formations.away,
              ]),
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <button
            className="team-picker"
            onClick={() => s.set({ modal: "teams" })}
          >
            <TeamBadge team={away} size="small" />
            <strong>{away?.shortName}</strong>
            <ChevronDown size={12} />
          </button>
        </div>
        <button
          className="load-match-button"
          onClick={() => s.set({ modal: "matches" })}
        >
          <CalendarDays size={15} />
          Load a match
          <ChevronRight size={14} />
        </button>
      </section>
      <div className="editor-workspace">
        <Toolbar />
        <section className="board-workspace">
          <header className="board-heading">
            <div className="board-breadcrumb">
              <Layers2 size={14} />
              <span>Analysis board</span>
              <ChevronRight size={12} />
              <strong>{activeScene.title}</strong>
            </div>
            <div className="board-heading-actions">
              {board.media && (
                <>
                  <button
                    className={`small-button ${board.settings.mediaVisible ? "active" : ""}`}
                    onClick={() =>
                      s.commit((b) => {
                        b.settings.mediaVisible = !b.settings.mediaVisible;
                      })
                    }
                  >
                    <ImageIcon size={13} />
                    Reference
                  </button>
                  <button
                    className="icon-button"
                    title="Remove reference media"
                    onClick={() =>
                      s.commit((b) => {
                        b.media = undefined;
                      })
                    }
                  >
                    <X size={13} />
                  </button>
                </>
              )}
              <select
                aria-label="Board camera view"
                value={board.settings.camera}
                onChange={(e) =>
                  s.commit((b) => {
                    b.settings.camera = e.target.value as "top" | "angle";
                  })
                }
              >
                <option value="top">Top-down</option>
                <option value="angle">Broadcast angle</option>
              </select>
              <button
                className="icon-button"
                title="Display settings"
                aria-label="Display settings"
                onClick={() => {
                  s.set({ inspector: "settings" });
                  setSidebarOpen(true);
                }}
              >
                <Settings2 size={15} />
              </button>
              <button
                className="icon-button sidebar-toggle"
                title="Toggle inspector"
                aria-label="Toggle inspector"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <PanelRightClose size={16} />
                ) : (
                  <PanelRightOpen size={16} />
                )}
              </button>
            </div>
          </header>
          <div className="pitch-area">
            <BoardCanvas ref={boardRef} />
            <div className="pitch-corner-badge">
              <span className="live-dot" />
              STUDIO BOARD<span>01</span>
            </div>
          </div>
          <div className="board-caption">
            <span>
              <i style={{ background: board.colors.home }} />
              {home?.abbreviation}
              <ArrowRight size={12} />
            </span>
            <p>
              {board.match
                ? `${board.match.homeName} v ${board.match.awayName} · ${dateLabel(board.match.date)}`
                : "Custom analysis · recent starting selections"}
              <span>Positions are editable reconstructions</span>
            </p>
            <span>
              <ArrowRight size={12} />
              {away?.abbreviation}
              <i style={{ background: board.colors.away }} />
            </span>
          </div>
        </section>
        <Sidebar />
      </div>
      <Timeline />
      <footer className="studio-status">
        <span>
          <span className="live-dot" />
          STUDIO READY<span className="status-divider">/</span>
          {s.tool === "select"
            ? "Drag to reposition · Shift-click to group"
            : "Draw on the pitch · V to move players"}
        </span>
        <button onClick={() => s.set({ modal: "data" })}>
          {catalogue.teams.length} clubs ·{" "}
          {catalogue.quality.playerCount.toLocaleString()} players{" "}
          <span className="status-divider">/</span>Data desk{" "}
          <ArrowUpRight size={11} />
        </button>
      </footer>
      {s.presenting && (
        <div className="presenter-controls">
          <span>FIXTURE</span>
          <button
            onClick={() =>
              s.set({ playing: !s.playing, playhead: s.previewTime ?? 0 })
            }
          >
            {s.playing ? "Pause" : "Play"}
          </button>
          <button onClick={s.addScene}>Next phase</button>
          <button onClick={togglePresenter}>
            <X size={14} />
            Exit presenter
          </button>
        </div>
      )}
      {s.toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {s.toast}
        </div>
      )}
      {s.loading && (
        <div className="busy-overlay">
          <Loader2 className="spin" size={23} />
          <span>Loading the match record…</span>
        </div>
      )}
      {recording && (
        <div className="recording-badge">
          <Radio size={15} />
          <span>
            Recording storyboard · {(s.previewTime ?? 0).toFixed(1)}s /{" "}
            {totalDuration(board).toFixed(1)}s
          </span>
        </div>
      )}
      <Modals onPNG={exportPNG} onJSON={exportJSON} onVideo={exportVideo} />
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={importInput}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 10 * 1024 * 1024) throw Error();
            const data = JSON.parse(await f.text());
            if (!s.importBoard(data)) throw Error();
            s.notify("Analysis imported as a new saved document");
          } catch {
            s.notify(
              "That file is not a valid Fixture analysis. Use an exported .fixture.json file under 10 MB.",
            );
          }
          e.target.value = "";
        }}
      />
    </main>
  );
}
