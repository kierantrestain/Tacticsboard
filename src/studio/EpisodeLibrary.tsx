import { useEffect, useState } from "react";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { listCheckpoints, checkpointProject } from "./assetStore";
import type { EpisodeCheckpoint } from "./assetStore";
import {
  openEpisode,
  copyEpisode,
  freshEpisode,
  restoreEpisodeCheckpoint,
  resetDraftTactics,
  restoreSavedMoment,
} from "./episodeControl";
import { dateLabel } from "../core";
import "./episode.css";
export default function EpisodeLibrary({ onImport }: { onImport: () => void }) {
  const s = useStudio(),
    r = useRuntime(),
    [history, setHistory] = useState<EpisodeCheckpoint[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const refresh = () => {
    if (s.board)
      void listCheckpoints(s.board.id)
        .then(setHistory)
        .catch((e) => setError(e.message));
  };
  useEffect(refresh, [s.board?.id]);
  const run = async (label: string, action: () => unknown) => {
    setBusy(label);
    setError("");
    try {
      await action();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <p className="tl-dialog-intro">
        An episode contains the whole show rundown across matches. Resume
        privately, keep recovery checkpoints and back up all referenced media.
      </p>
      <div className="tl-dialog-toolbar">
        <button
          className="tl-primary"
          disabled={!!busy}
          onClick={() =>
            void run("Creating episode", async () => {
              await freshEpisode();
              r.set({ modal: null });
            })
          }
        >
          Fresh episode
        </button>
        <button className="tl-secondary" disabled={!!busy} onClick={onImport}>
          Open backup / ZIP / JSON
        </button>
        <button
          className="tl-secondary"
          onClick={() => r.set({ modal: "backup" })}
        >
          Back up complete episode
        </button>
      </div>
      <section className="episode-recovery">
        <strong>Current episode · {s.board?.title}</strong>
        <label>
          Episode name
          <input
            aria-label="Episode name"
            defaultValue={s.board?.title}
            key={s.board?.id + s.board!.title}
            maxLength={120}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== s.board?.title) {
                s.commit((b) => {
                  b.title = title;
                });
                void s.save();
              }
            }}
          />
        </label>
        <p role="status">
          {s.saveError
            ? "Save failed — previous valid save retained. Retry or make a backup."
            : s.savePending
              ? "Saving episode…"
              : s.savedAt
                ? "Saved on this device · " +
                  new Date(s.savedAt).toLocaleTimeString()
                : "No completed save yet"}
        </p>
        <div className="tl-dialog-toolbar">
          <button
            disabled={!!busy}
            className="tl-secondary"
            onClick={() =>
              void run("Saving checkpoint", () =>
                checkpointProject(s.board!, "Producer checkpoint"),
              )
            }
          >
            Save recovery checkpoint
          </button>
          <button
            disabled={!!busy || !r.activeCueId}
            className="tl-secondary"
            onClick={() =>
              void run("Restoring saved moment", restoreSavedMoment)
            }
          >
            Restore selected moment
          </button>
          <button
            disabled={!!busy}
            className="tl-secondary"
            onClick={() =>
              void run("Resetting draft tactics", resetDraftTactics)
            }
          >
            Reset draft tactics · keeps moments
          </button>
        </div>
        <p className="tl-small-note">
          Clear drawings remains in the drawing toolbar. Restoring a moment
          changes only the preview. Draft resets keep saved moments and create a
          recovery checkpoint; undo is available.
        </p>
        {history.map((c, i) => (
          <button
            className="tl-secondary"
            key={c.at + i}
            disabled={!!busy}
            onClick={() =>
              void run("Restoring checkpoint", () =>
                restoreEpisodeCheckpoint(c.board),
              )
            }
          >
            Restore {c.label} · {new Date(c.at).toLocaleString()}
          </button>
        ))}
      </section>
      <div className="tl-project-list">
        {s.library.map((b) => (
          <article key={b.id} className="episode-library-row">
            <div>
              <strong>{b.title}</strong>
              <small>
                {b.scenes} phases · {dateLabel(b.updatedAt)}
              </small>
            </div>
            <button
              className="tl-primary"
              disabled={!!busy}
              onClick={() =>
                void run("Opening episode", async () => {
                  await openEpisode(b.id);
                  r.set({ modal: null });
                })
              }
            >
              Resume
            </button>
            <button
              className="tl-secondary"
              disabled={!!busy}
              onClick={() =>
                void run("Duplicating episode", () => copyEpisode(b.id))
              }
            >
              Duplicate
            </button>
          </article>
        ))}
      </div>
      {busy && <p role="status">{busy}</p>}
      {error && (
        <p role="alert" className="film-alert">
          {error}
        </p>
      )}
    </>
  );
}
