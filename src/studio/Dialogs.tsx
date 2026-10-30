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
  if (r.modal === "export")
    return (
      <Dialog title="Ready for the studio." kicker="EXPORT & HANDOFF">
        <p className="tl-dialog-intro">
          Export a clean analysis or move the entire project, including its
          source media, to another computer.
        </p>
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
    return (
      <Dialog title="Your analysis room." kicker="PROJECT LIBRARY">
        <div className="tl-dialog-toolbar">
          <button
            className="tl-primary"
            onClick={() => {
              s.create();
              r.set({
                modal: null,
                view: "board",
                time: 0,
                mediaPlaying: false,
              });
            }}
          >
            <Plus size={15} />
            New analysis
          </button>
          <button className="tl-secondary" onClick={onImport}>
            <FolderOpen size={15} />
            Open project pack / JSON
          </button>
        </div>
        <div className="tl-project-list">
          {s.library.map((b) => (
            <button
              key={b.id}
              onClick={async () => {
                await s.load(b.id);
                r.set({
                  modal: null,
                  view: useStudio.getState().board?.studio?.view || "board",
                  time: 0,
                  mediaPlaying: false,
                });
              }}
            >
              <span className="tl-project-icon">
                <Box size={22} />
              </span>
              <div>
                <strong>{b.title}</strong>
                <span>
                  {
                    s.catalogue?.teams.find((t) => t.id === b.homeTeamId)
                      ?.shortName
                  }{" "}
                  /{" "}
                  {
                    s.catalogue?.teams.find((t) => t.id === b.awayTeamId)
                      ?.shortName
                  }{" "}
                  · {b.scenes} phases
                </span>
              </div>
              <time>{dateLabel(b.updatedAt)}</time>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
        <div className="tl-dialog-note">
          <ShieldCheck size={15} />
          <p>
            Projects autosave to this browser’s device storage. Use a portable
            project pack for backup and transfer.
          </p>
        </div>
      </Dialog>
    );
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
            ["M", "Mark a rundown moment"],
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
            <h3>Rehearse in preview. Take the moment to air.</h3>
            <p>
              Programme opens a clean second window. “Take” recalls the prepared
              view; “Live follow” mirrors editing. Presenter mode enables live
              follow and gives the panel large touch controls. Use OBS window
              capture for the same-computer output.
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
