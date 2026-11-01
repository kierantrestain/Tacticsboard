import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Copy,
  Film,
  FolderOpen,
  ImagePlus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useStudio } from "../store";
import { copy, uid } from "../core";
import { useRuntime, selectAsset, editDesk } from "./runtime";
import {
  inspectAsset,
  persistAsset,
  listAssets,
  getMedia,
  getRecord,
  putRecord,
  deleteAsset,
} from "./assetStore";
import { mediaDB } from "../media";
import {
  duplicateSourceState,
  invalidateSourceReview,
  sourceReferences,
  validateReplacement,
} from "./mediaModel";
import type { MediaAsset } from "./types";
import { timecode } from "./types";
import "./mediaAnalysis.css";

type Pending = { file: File; asset?: MediaAsset; error?: string };
async function otherUses(id: string, boardId?: string) {
  const db = await mediaDB();
  return new Promise<string[]>((resolve, reject) => {
    const r = db.transaction("projects").objectStore("projects").getAll();
    r.onsuccess = () => {
      db.close();
      resolve(
        r.result
          .filter(
            (b) =>
              b?.id !== boardId &&
              Array.isArray(b?.scenes) &&
              (b.studio?.assetId === id ||
                b.scenes.some((s: any) => s.source?.assetId === id) ||
                b.studio?.cues?.some(
                  (c: any) =>
                    c.assetId === id ||
                    c.sequence?.some((s: any) => s.source?.assetId === id),
                ) ||
                b.studio?.ink?.[id]?.length ||
                b.studio?.targets?.[id]?.length ||
                b.studio?.tracking?.[id]),
          )
          .map((b) => b.title || "Saved project"),
      );
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
export default function MediaWorkspace() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const s = useStudio(),
    r = useRuntime(),
    input = useRef<HTMLInputElement>(null),
    replacement = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]),
    [preparing, setPreparing] = useState(false),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState(""),
    [url, setUrl] = useState(""),
    [localBusy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [replace, setReplace] = useState<Pending | null>(null),
    [remove, setRemove] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const active = r.assets.find((a) => a.id === selected),
    staged = pending.find((_, i) => selected === "pending-" + i),
    preview = staged?.asset || active;
  useEffect(() => {
    let live = true;
    const files = r.pendingFiles;
    if (!files.length) {
      setPending([]);
      return;
    }
    setPreparing(true);
    setSelected("pending-0");
    setPending(files.map((file) => ({ file })));
    void (async () => {
      for (let i = 0; i < files.length; i++) {
        let result: Pending;
        try {
          result = { file: files[i], asset: await inspectAsset(files[i]) };
        } catch (e) {
          result = { file: files[i], error: (e as Error).message };
        }
        if (!live) return;
        setPending((old) => old.map((p, j) => (j === i ? result : p)));
      }
      if (live) setPreparing(false);
    })();
    return () => {
      live = false;
    };
  }, [r.pendingFiles]);
  useEffect(() => {
    if (!selected && r.assets.length) setSelected(r.assets[0].id);
  }, [r.assets.length]);
  useEffect(() => {
    let live = true,
      u = "";
    setUrl("");
    setError("");
    setRemove(false);
    setReplace(null);
    void (async () => {
      const blob = staged?.file || (active ? await getMedia(active.id) : null);
      if (!live) return;
      if (!blob) {
        if (active)
          setError(
            "Source missing on this device. Relink the original file to restore it.",
          );
        return;
      }
      u = URL.createObjectURL(blob);
      setUrl(u);
    })();
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [selected, active?.revision, staged?.asset?.id]);
  const refresh = async () => r.set({ assets: await listAssets() });
  const perform = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const update = async (patch: Partial<MediaAsset>) => {
    if (!active) return;
    const id = active.id;
    saveQueue.current = saveQueue.current
      .then(async () => {
        const latest = await getRecord<MediaAsset>("meta", id);
        if (!latest) return;
        await putRecord("meta", id, { ...latest, ...patch });
        await refresh();
      })
      .catch((e) => setError((e as Error).message));
    await saveQueue.current;
  };
  const importAll = () =>
    perform("Saving sources", async () => {
      let first: MediaAsset | undefined;
      const failed: Pending[] = [];
      for (const p of pending) {
        if (!p.asset) {
          failed.push(p);
          continue;
        }
        try {
          const a = {
            ...p.asset,
            matchId: s.board?.match?.id,
            matchLabel:
              s.board?.match?.name ||
              `${s.board?.context?.home.shortName || "Home"} v ${s.board?.context?.away.shortName || "Away"}`,
          };
          await persistAsset(a, p.file);
          first ||= a;
        } catch (e) {
          failed.push({ ...p, error: (e as Error).message });
        }
      }
      await refresh();
      setPending(failed);
      if (!failed.length) r.set({ pendingFiles: [] });
      if (failed.length) {
        setError(
          `${failed.length} source(s) were not imported. Successfully imported sources are retained.`,
        );
      }
      if (first) {
        setSelected(first.id);
        selectAsset(first);
        if (!failed.length) r.set({ modal: null });
        s.notify("Sources imported. Originals are stored on this device.");
      }
    });
  const duplicate = () =>
    active &&
    perform("Duplicating source", async () => {
      const blob = await getMedia(active.id);
      if (!blob) throw Error("Relink the missing source before duplicating.");
      const next = {
        ...copy(active),
        id: uid(),
        name: `${active.name} copy`,
        createdAt: new Date().toISOString(),
      };
      await persistAsset(next, blob);
      s.commit((b) => {
        if (b.studio) duplicateSourceState(b.studio, active.id, next.id);
      });
      await refresh();
      setSelected(next.id);
    });
  const applyReplacement = () =>
    active &&
    replace?.asset &&
    perform("Replacing source", async () => {
      if (r.program?.board.studio?.assetId === active.id)
        throw Error(
          "The held programme still uses this source. Take a different prepared shot before replacing it.",
        );
      validateReplacement(s.board!, active, replace.asset!);
      const changed = true;
      if (changed && (await otherUses(active.id, s.board?.id)).length)
        throw Error(
          "Other saved projects use this source. Import the replacement as a new source to protect those projects.",
        );
      const next = {
        ...replace.asset!,
        id: active.id,
        name: active.name,
        notes: active.notes,
        matchId: active.matchId,
        matchLabel: active.matchLabel,
        segment: active.segment,
        tags: active.tags,
        revision: (active.revision || 0) + 1,
      };
      await persistAsset(next, replace.file);
      if (changed) s.commit((b) => invalidateSourceReview(b, active.id));
      setReplace(null);
      await refresh();
      s.notify(
        changed
          ? "Source replaced. Tracking must be reviewed again."
          : "Original source relinked. Annotations retained.",
      );
    });
  const removeSource = () =>
    active &&
    perform("Removing source", async () => {
      const refs = sourceReferences(s.board!, active.id),
        other = await otherUses(active.id, s.board?.id);
      if (refs.cues.length || refs.scenes.length || other.length)
        throw Error(
          "Saved shots or projects still use this source. Keep it or remove those references first.",
        );
      if (
        (s.board?.studio?.ink[active.id] || []).length ||
        (s.board?.studio?.targets[active.id] || []).length ||
        s.board?.studio?.tracking[active.id]
      )
        throw Error(
          "This source has editable annotations. Keep it or clear the annotations before removing it.",
        );
      await deleteAsset(active.id);
      s.commit((b) => {
        const d = b.studio;
        if (!d) return;
        for (const k of [
          "ink",
          "landmarks",
          "targets",
          "tracking",
          "sourceRanges",
          "sourcePresentations",
          "explainStops",
        ] as const)
          if (d[k]) delete d[k]![active.id];
        d.bookmarks = d.bookmarks.filter((m) => m.assetId !== active.id);
        d.stillOrder = d.stillOrder?.filter((id) => id !== active.id);
        if (d.assetId === active.id) d.assetId = undefined;
      });
      r.set({ mediaPlaying: false });
      await refresh();
      setSelected("");
      setRemove(false);
    });
  const filtered = r.assets.filter(
    (a) =>
      (!group || a.segment === group) &&
      [a.name, a.notes, a.matchLabel, a.segment, ...(a.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="media-workspace-backdrop">
      <dialog
        ref={dialog}
        className="media-workspace"
        aria-label="Media workspace"
        onCancel={(e) => {
          if (localBusy) e.preventDefault();
          else r.set({ modal: null, pendingFiles: [] });
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          r.set({ pendingFiles: Array.from(e.dataTransfer.files) });
        }}
      >
        <header>
          <div>
            <span className="film-kicker">SOURCE DESK</span>
            <h2>Pictures & footage</h2>
            <p>Preview, organise and open your next analysis.</p>
          </div>
          <button
            className="film-button"
            onClick={() => input.current?.click()}
            disabled={!!localBusy}
          >
            <Upload size={16} />
            Add sources
          </button>
          <button
            className="tl-icon"
            aria-label="Close media workspace"
            disabled={!!localBusy}
            onClick={() => r.set({ modal: null, pendingFiles: [] })}
          >
            <X size={20} />
          </button>
        </header>
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept="image/*,video/*,.mov,.mkv,.m4v"
          onChange={(e) => {
            r.set({ pendingFiles: Array.from(e.target.files || []) });
            e.target.value = "";
          }}
        />
        <input
          ref={replacement}
          hidden
          type="file"
          accept="image/*,video/*,.mov,.mkv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              void perform("Checking replacement", async () =>
                setReplace({ file: f, asset: await inspectAsset(f) }),
              );
          }}
        />
        <div className="media-workspace-grid">
          <nav aria-label="Source browser">
            <label className="tl-search">
              <Search size={15} />
              <input
                aria-label="Search media workspace"
                placeholder="Search match, segment or source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter media segment"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">All segments</option>
              {[...new Set(r.assets.map((a) => a.segment).filter(Boolean))].map(
                (g) => (
                  <option key={g}>{g}</option>
                ),
              )}
            </select>
            {!!pending.length && (
              <>
                <h3>IMPORT QUEUE · {pending.length}</h3>
                {pending.map((p, i) => (
                  <button
                    key={i}
                    className={selected === "pending-" + i ? "selected" : ""}
                    onClick={() => setSelected("pending-" + i)}
                  >
                    <ImagePlus size={16} />
                    <span>
                      <strong>{p.file.name}</strong>
                      <small>
                        {p.error ||
                          (p.asset ? "Preview ready" : "Checking source…")}
                      </small>
                    </span>
                  </button>
                ))}
              </>
            )}
            <h3>LIBRARY · {filtered.length}</h3>
            {filtered.map((a) => (
              <button
                key={a.id}
                className={selected === a.id ? "selected" : ""}
                onClick={() => setSelected(a.id)}
              >
                <img src={a.thumbnail} alt="" />
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {a.segment || a.matchLabel || `${a.width} × ${a.height}`}{" "}
                    {r.assetAvailability[a.id] === false
                      ? "· Missing source"
                      : ""}
                  </small>
                </span>
              </button>
            ))}
            {!r.assets.length && !pending.length && (
              <p className="media-empty">
                <FolderOpen />
                Drop pictures or footage here, or choose Add sources.
              </p>
            )}
          </nav>
          <main className="media-preview">
            <div className="media-preview-surface">
              {url && preview ? (
                preview.type === "video" ? (
                  <video
                    key={url}
                    src={url}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img src={url} alt={preview.name} />
                )
              ) : (
                <Clapperboard size={48} />
              )}
            </div>
            {preview && (
              <div className="media-source-summary">
                <strong>{preview.name}</strong>
                <span>
                  {preview.width} × {preview.height} ·{" "}
                  {(preview.size / 1048576).toFixed(1)} MB
                  {preview.type === "video"
                    ? ` · ${timecode(preview.duration)} · ${preview.measuredFps?.toFixed(2) || preview.fps} fps average`
                    : ""}
                </span>
              </div>
            )}
            <p>
              Original files stay on this computer. Sources up to 2 GB; select
              up to 60 seconds for analysis. Assisted tracking processes up to
              20 seconds at a time.
            </p>
            {staged?.error && <p role="alert">{staged.error}</p>}
          </main>
          <aside className="media-details">
            {active ? (
              <>
                <h3>SOURCE DETAILS</h3>
                <label>
                  Name
                  <input
                    aria-label="Source name"
                    key={active.id + "name" + active.name}
                    defaultValue={active.name}
                    maxLength={160}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== active.name) void update({ name });
                    }}
                  />
                </label>
                <label>
                  Match
                  <input
                    aria-label="Source match"
                    key={active.id + "match"}
                    defaultValue={active.matchLabel}
                    maxLength={160}
                    onBlur={(e) =>
                      void update({ matchLabel: e.target.value.slice(0, 160) })
                    }
                  />
                </label>
                <label>
                  Segment
                  <input
                    aria-label="Source segment"
                    key={active.id + "segment"}
                    defaultValue={active.segment}
                    maxLength={100}
                    placeholder="e.g. Arsenal’s pressing"
                    onBlur={(e) =>
                      void update({
                        segment: e.target.value.trim().slice(0, 100),
                      })
                    }
                  />
                </label>
                <label>
                  Tags
                  <input
                    aria-label="Source tags"
                    key={active.id + "tags"}
                    defaultValue={active.tags?.join(", ")}
                    maxLength={300}
                    placeholder="Press, transition, set piece"
                    onBlur={(e) =>
                      void update({
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .slice(0, 12),
                      })
                    }
                  />
                </label>
                <label>
                  Analyst notes
                  <textarea
                    aria-label="Source analyst notes"
                    key={active.id + "notes"}
                    defaultValue={active.notes}
                    maxLength={4000}
                    rows={4}
                    onBlur={(e) =>
                      void update({ notes: e.target.value.slice(0, 4000) })
                    }
                  />
                </label>
                <label>
                  Reference timestamp (seconds)
                  <input
                    aria-label="Source reference timestamp"
                    type="number"
                    min="0"
                    step=".01"
                    key={active.id + "ref"}
                    defaultValue={
                      active.referenceTime ?? active.sourceTime ?? 0
                    }
                    onBlur={(e) =>
                      void update({
                        referenceTime: Math.max(
                          0,
                          Math.min(1000000, +e.target.value || 0),
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="film-button primary"
                  disabled={!!localBusy}
                  onClick={() =>
                    void perform("Opening analysis", async () => {
                      await saveQueue.current;
                      const latest = await getRecord<MediaAsset>(
                        "meta",
                        active.id,
                      );
                      selectAsset(latest || active);
                      r.set({ modal: null });
                    })
                  }
                >
                  Open analysis
                </button>
                <div className="media-actions">
                  <button
                    onClick={() => void duplicate()}
                    disabled={!!localBusy}
                  >
                    <Copy size={15} />
                    Duplicate
                  </button>
                  <button
                    onClick={() => replacement.current?.click()}
                    disabled={!!localBusy}
                  >
                    Relink / replace
                  </button>
                  <button
                    onClick={() => setRemove(!remove)}
                    disabled={!!localBusy}
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
                {replace?.asset && (
                  <div className="media-confirm">
                    <strong>{replace.asset.name}</strong>
                    <p>
                      {active.fingerprint &&
                      active.fingerprint === replace.asset.fingerprint
                        ? "The sampled file signature and size match. Review tracking before presenting the restored source."
                        : "Content may differ. Existing annotations stay aligned to the original dimensions; tracking and saved shots require review."}
                    </p>
                    <button
                      className="film-button"
                      onClick={() => void applyReplacement()}
                    >
                      Use replacement
                    </button>
                    <button onClick={() => setReplace(null)}>Cancel</button>
                  </div>
                )}
                {remove && (
                  <div className="media-confirm">
                    <p>
                      Remove this local source? Referenced media and annotated
                      sources are protected.
                    </p>
                    <button
                      className="film-button"
                      onClick={() => void removeSource()}
                    >
                      Remove unused source
                    </button>
                    <button onClick={() => setRemove(false)}>
                      Keep source
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3>PREVIEW BEFORE IMPORT</h3>
                <p>
                  Check the picture or play the source before adding it to the
                  library. Unsupported files are identified individually.
                </p>
                <p>A file extension alone does not guarantee codec support.</p>
              </>
            )}
          </aside>
        </div>
        <footer>
          <span role="status">
            {localBusy ||
              (preparing
                ? "Checking selected files…"
                : error || `${r.assets.length} local sources`)}
          </span>
          {!!pending.length && (
            <button
              className="film-button primary"
              disabled={
                preparing ||
                !!localBusy ||
                !pending.some((p) => p.asset && !p.error)
              }
              onClick={() => void importAll()}
            >
              Import {pending.filter((p) => p.asset && !p.error).length} ready
              sources
            </button>
          )}
        </footer>
        {error && (
          <p role="alert" className="media-error">
            {error}
          </p>
        )}
      </dialog>
    </div>
  );
}
