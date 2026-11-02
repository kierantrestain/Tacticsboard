import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Clapperboard,
  Command,
  FileArchive,
  FileJson,
  FolderOpen,
  Image,
  Keyboard,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { useRuntime } from "./runtime";
import { useStudio } from "../store";
import { dateLabel } from "../core";
import { totalDuration } from '../core';
import { clipPlan } from './filmPlan';
import EpisodeLibrary from './EpisodeLibrary';
export function Dialog({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    r = useRuntime();
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="tl-dialog"
      onClose={() => r.set({ modal: null })}
      onClick={(e) => {
        if (e.target === ref.current) r.set({ modal: null });
      }}
    >
      <div className="tl-dialog-header">
        <div>
          <span className="tl-eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <button
          className="tl-icon"
          aria-label="Close dialog"
          onClick={() => r.set({ modal: null })}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export interface StudioCommand {
  title: string;
  detail: string;
  key?: string;
  action: () => void;
  Icon: typeof Box;
}
export default function Dialogs({
  onPNG,
  onVideo,
  onPack,
  onJSON,
  onImport,
  commands,
  onInstall,
}: {
  onPNG: () => void;
  onVideo: () => void;
  onPack: () => void;
  onJSON: () => void;
  onImport: () => void;
  commands: StudioCommand[];
  onInstall: () => void;
}) {
  const r = useRuntime(),
    s = useStudio(),
    [search, setSearch] = useState("");
  const asset=r.assets.find(a=>a.id===s.board?.studio?.assetId),sourceMode=['footage','split'].includes(r.view)||r.view==='replay'&&!!s.board?.studio?.tracking[asset?.id||''],rate=r.view==='stats'||sourceMode&&asset?.type==='image'?1:sourceMode?r.rate:s.speed;
  const filmDuration=r.view==='stats'?5:sourceMode&&s.board?.studio?clipPlan(s.board.studio.trim,s.board.studio.explainStops?.[asset?.id||'']||[],rate).duration:s.board?totalDuration(s.board)/rate:0;
  if (r.modal === "export")
    return (
      <Dialog title="Ready for the studio." kicker="EXPORT & HANDOFF">
        <p className="tl-dialog-intro">
          Export a clean analysis or move the entire project, including its
          source media, to another computer.
        </p>
        <div className="export-analysis-summary"><strong>Current {r.view==='stats'?'data graphic':r.view==='footage'?'source analysis':r.view==='split'?'source comparison':'tactical sequence'}</strong><span>{filmDuration.toFixed(1)} seconds · {rate}× speed · 1080p / 25 fps · silent</span><small>{r.view==='stats'?'The film captures the current statistic window for five seconds.':'Selected playback speed and explanation pauses are included.'} This exports the current analysis; saved shots remain editable in the project pack.</small></div>
        <div className="tl-export-grid">
          <button onClick={onPNG}>
            <span className="tl-export-icon">
              <Image size={25} />
            </span>
            <strong>Broadcast still</strong>
            <p>
              3840 × 2160 PNG
              <br />
              Clean graphics, source or replay
            </p>
            <span>
              Export still <ArrowRight size={14} />
            </span>
          </button>
          <button onClick={onVideo}>
            <span className="tl-export-icon">
              <Video size={25} />
            </span>
            <strong>Analysis film</strong>
            <p>
              1920 × 1080 · 25 fps
              <br />
              Frame-timed MP4 or WebM
            </p>
            <span>
              Render video <ArrowRight size={14} />
            </span>
          </button>
          <button onClick={onPack}>
            <span className="tl-export-icon">
              <FileArchive size={25} />
            </span>
            <strong>Portable project</strong>
            <p>
              Editable project + source files
              <br />
              Stills, clips, tracking and notes
            </p>
            <span>
              Download project pack <ArrowRight size={14} />
            </span>
          </button>
          <button onClick={onJSON}>
            <span className="tl-export-icon">
              <FileJson size={25} />
            </span>
            <strong>Analysis document</strong>
            <p>
              Lightweight editable JSON
              <br />
              Source files remain separate
            </p>
            <span>
              Export document <ArrowRight size={14} />
            </span>
          </button>
        </div>
        <div className="tl-dialog-note">
          <ShieldCheck size={15} />
          <p>
            All processing happens on this computer. Video exports are silent
            for commentary-led studio analysis. Available codecs depend on this
            browser.
          </p>
        </div>
      </Dialog>
    );
  if (r.modal === "projects")
    return <Dialog title="Your episodes." kicker="EPISODES & RECOVERY"><EpisodeLibrary onImport={onImport}/></Dialog>;
  if (r.modal === "shortcuts")
    return (
      <Dialog title="Designed for the moment." kicker="PRESENTER CONTROLS">
        <div className="tl-shortcut-grid">
          {[
            ["Space", "Play / pause"],
            ["← / →", "Step a nominal frame"],
            ["Shift + ← / →", "Jump one second"],
            ["I / O", "Set clip in / out"],
            ["F", "Save a freeze frame"],
            ["M", "Save any view as a rundown shot"],
            ["[ / ]", "Previous / next rundown shot"],
            ["1–9", "Recall a numbered shot"],
            ["Enter", "Send the current view to TV"],
            ["B", "Blackout / restore the TV output"],
            ["P", "Enter / exit presenter"],
            ["Ctrl / Cmd + K", "Command centre"],
            ["V / A / R", "Move / pass / run"],
            ["D / Z / C", "Ink / space / circle"],
            ["H / G / T", "Spotlight / triangle / text"],
            ["Ctrl / Cmd + Z", "Undo"],
            ["Ctrl / Cmd + Shift + Z", "Redo"],
            ["Delete", "Delete selected graphic"],
            ["Esc", "Finish marking / exit mode"],
          ].map(([key, label]) => (
            <div key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="tl-dialog-guide">
          <Monitor size={26} />
          <div>
            <h3>Prepare the story. Keep the panel in control.</h3>
            <p>
              Programme opens a clean second window without changing its held
              shot. Preview stays private until you press Enter to take. Enable
              Live follow for live drawing. Save with M and recall shots with [
              / ]. B blacks the output and restores the same held shot.
              Presenter mode keeps these output controls explicit.
            </p>
          </div>
        </div>
        <div className="tl-dialog-guide">
          <Clapperboard size={26} />
          <div>
            <h3>From footage to a tactical explanation.</h3>
            <p>
              Import a still or clip, set a range of up to 20 seconds, map four
              pitch landmarks, then mark or detect the players. Review the
              observations and build an editable 2D/3D replay. Player identities
              and uncertain tracks need analyst review.
            </p>
          </div>
        </div>
        <div className="tl-dialog-toolbar">
          <button className="tl-secondary" onClick={onInstall}>
            Install / standalone app
          </button>
          <a
            className="tl-text-link"
            href="https://github.com/kierantrestain/Tacticsboard"
            target="_blank"
            rel="noreferrer"
          >
            Software & licence notices
          </a>
        </div>
      </Dialog>
    );
  if (r.modal === "commands")
    return (
      <Dialog title="What’s the next move?" kicker="COMMAND CENTRE">
        <label className="tl-command-search">
          <Search size={20} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a view, tool or action…"
            aria-label="Search commands"
          />
        </label>
        <div className="tl-command-list">
          {commands
            .filter((c) =>
              (c.title + " " + c.detail)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => (
              <button
                key={c.title}
                onClick={() => {
                  r.set({ modal: null });
                  c.action();
                }}
              >
                <c.Icon size={20} />
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.detail}</small>
                </span>
                {c.key && <kbd>{c.key}</kbd>}
                <ArrowRight size={14} />
              </button>
            ))}
        </div>
      </Dialog>
    );
  return null;
}
