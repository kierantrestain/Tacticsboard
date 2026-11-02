import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialogs";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { setLiveFollow, toggleBlackout } from "./production";
import { filename } from "../core";
import { getMedia, inspectAsset } from "./assetStore";
import { episodeMediaIds } from "./episodeModel";
import {
  prepareEpisodeBackup,
  renderBackupPart,
  backupStem,
} from "./episodeTransfer";
import type { EpisodeBackup as Backup } from "./episodeTransfer";
import "./episode.css";
export default function EpisodeBackup({ legacy }: { legacy: () => void }) {
  const s = useStudio(),
    r = useRuntime(),
    [backup, setBackup] = useState<Backup | null>(null),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [ready, setReady] = useState<{ url: string; name: string } | null>(null),
    [folderSaved, setFolderSaved] = useState(false),
    cancel = useRef(false);
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );
  const included = r.assets.filter((a) =>
      episodeMediaIds(s.board!, r.assets).has(a.id),
    ),
    total = included.reduce((n, a) => n + a.size, 0);
  const update = (v: number) => {
    if (cancel.current)
      throw Error(
        "Backup preparation cancelled. Original media and episodes are unchanged.",
      );
    setProgress(v);
  };
  const prepare = async () => {
    cancel.current = false;
    setLiveFollow(false);
    setBusy("Checking source codecs and preparing integrity checks");
    setError("");
    try {
      for (const a of included) {
        const blob = await getMedia(a.id);
        if (!blob) throw Error(`Missing source: ${a.name}`);
        const inspected = await inspectAsset(
          new File([blob], a.name, { type: a.mime }),
        );
        if (
          inspected.width !== a.width ||
          inspected.height !== a.height ||
          (a.type === "video" &&
            Math.abs(inspected.duration - a.duration) > 0.1)
        )
          throw Error(
            `Source no longer matches its analysis: ${a.name}. Relink and review it.`,
          );
      }
      setBackup(await prepareEpisodeBackup(s.board!, r.assets, update));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const part = async (i: number) => {
    if (!backup) return;
    cancel.current = false;
    setError("");
    setBusy(`Preparing ZIP volume ${i + 1} of ${backup.parts.length}`);
    try {
      const blob = await renderBackupPart(backup, i);
      setReady({ url: URL.createObjectURL(blob), name: backup.parts[i].name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const folder = async () => {
    if (!backup) return;
    try {
      const directory = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      cancel.current = false;
      setBusy("Saving episode backup to your chosen folder");
      setError("");
      for (let i = 0; i < backup.parts.length; i++) {
        update(i / (backup.parts.length || 1));
        const blob = await renderBackupPart(backup, i);
        const file = await directory.getFileHandle(backup.parts[i].name, {
          create: true,
        });
        const writer = await file.createWritable();
        await writer.write(blob);
        await writer.close();
      }
      update(1);
      const file = await directory.getFileHandle(
          backupStem(backup) + ".touchline.episode.json",
          { create: true },
        ),
        writer = await file.createWritable();
      await writer.write(JSON.stringify(backup));
      await writer.close();
      setFolderSaved(true);
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "No folder selected."
          : (e as Error).message,
      );
    } finally {
      setBusy("");
    }
  };
  const manifest = useMemo(
    () =>
      backup
        ? URL.createObjectURL(
            new Blob([JSON.stringify(backup)], { type: "application/json" }),
          )
        : "",
    [backup],
  );
  useEffect(
    () => () => {
      if (manifest) URL.revokeObjectURL(manifest);
    },
    [manifest],
  );
  return (
    <Dialog
      title="Back up the complete episode."
      kicker="EPISODE / MEDIA / RECOVERY"
    >
      <div className="tl-dialog-toolbar">
        <button className="tl-secondary" onClick={() => setLiveFollow(false)}>
          Hold TV
        </button>
        <button
          className="tl-secondary"
          disabled={!r.program}
          onClick={toggleBlackout}
        >
          {r.program?.black ? "Restore TV" : "Blackout"}
        </button>
      </div>
      <p className="tl-dialog-intro">
        Includes every referenced source, show moment, review, camera, graphic
        and note. Original bytes and source timestamps stay intact.
      </p>
      <p>
        {included.length} referenced sources · {(total / 1048576).toFixed(1)} MB
      </p>
      {!backup && (
        <button
          className="tl-primary"
          disabled={!!busy}
          onClick={() => void prepare()}
        >
          Check and prepare complete backup
        </button>
      )}
      {total <= 200 * 1048576 && (
        <button className="tl-secondary" disabled={!!busy} onClick={legacy}>
          Single legacy ZIP · up to 200 MB
        </button>
      )}
      {busy && (
        <div role="status">
          <strong>{busy}</strong>
          <progress max="1" value={progress} />
          <button onClick={() => (cancel.current = true)}>
            Cancel after this bounded operation
          </button>
        </div>
      )}
      {backup && (
        <>
          <p role="status">
            Prepared {backup.parts.length} ZIP volumes plus one manifest.
            Download every file; the importer rejects incomplete or corrupt
            sets.
          </p>
          {"showDirectoryPicker" in window && (
            <button
              className="tl-primary"
              disabled={!!busy}
              onClick={() => void folder()}
            >
              Save all files to a folder
            </button>
          )}
          <a
            className="tl-secondary"
            href={manifest}
            download={backupStem(backup) + ".touchline.episode.json"}
          >
            Download episode manifest
          </a>
          <div className="episode-volume-list">
            {backup.parts.map((p, i) => (
              <button
                className="tl-secondary"
                key={p.name}
                disabled={!!busy}
                onClick={() => void part(i)}
              >
                Prepare ZIP {i + 1} · {(p.size / 1048576).toFixed(1)} MB
              </button>
            ))}
          </div>
          {ready && (
            <a className="tl-primary" href={ready.url} download={ready.name}>
              Download prepared ZIP · {ready.name}
            </a>
          )}
          {folderSaved && (
            <p role="status">
              All volumes and the final manifest were written to the selected
              folder.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="film-alert">
          {error}
        </p>
      )}
      <p className="tl-small-note">
        Each volume processes at most 32 MB of source bytes. Import the manifest
        and all numbered volumes together with Import. This route supports up to
        8 GB per episode, within available device storage; it does not load a
        giant ZIP into memory.
      </p>
    </Dialog>
  );
}
