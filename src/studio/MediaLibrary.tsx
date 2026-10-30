import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Clapperboard,
  Film,
  ImagePlus,
  Plus,
  Search,
  UploadCloud,
  Check,
  FolderOpen,
} from "lucide-react";
import { useRuntime, selectAsset } from "./runtime";
import { useStudio } from "../store";
import { importAsset, listAssets } from "./assetStore";
import { timecode } from "./types";
export default function MediaLibrary() {
  const r = useRuntime(),
    s = useStudio(),
    input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const active = s.board?.studio?.assetId;
  const files = r.assets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    r.set({ busy: "Importing local media", progress: 0, error: "" });
    try {
      let last;
      for (let i = 0; i < files.length; i++) {
        last = await importAsset(files[i]);
        r.set({ progress: (i + 1) / files.length });
      }
      r.set({ assets: await listAssets() });
      if (last) selectAsset(last);
      s.notify(
        `${files.length} source${files.length === 1 ? "" : "s"} imported locally`,
      );
    } catch (e) {
      r.set({ error: e instanceof Error ? e.message : "Import failed" });
    } finally {
      r.set({
        busy: "",
        progress: 0,
        assets: await listAssets().catch(() => r.assets),
      });
    }
  };
  return (
    <aside
      className="tl-media-library"
      aria-label="Source media library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFiles(e.dataTransfer.files);
      }}
    >
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">SOURCE LIBRARY</span>
          <h2>
            Your match footage<span>{r.assets.length}</span>
          </h2>
        </div>
        <button
          className="tl-icon"
          title="Import media"
          aria-label="Import media"
          onClick={() => input.current?.click()}
        >
          <Plus size={19} />
        </button>
      </div>
      <button className="tl-import-card" onClick={() => input.current?.click()}>
        <span className="tl-import-icon">
          <UploadCloud size={22} />
        </span>
        <strong>Import footage</strong>
        <span>Stills or 10–20 second clips</span>
        <small>MP4 · MOV · WebM · JPG · PNG</small>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/*,video/*,.mov,.mkv"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <label className="tl-search">
        <Search size={15} />
        <input
          placeholder="Find a source…"
          aria-label="Search source library"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="tl-assets">
        {files.map((asset) => (
          <button
            key={asset.id}
            className={`tl-asset ${active === asset.id ? "is-active" : ""}`}
            onClick={() => selectAsset(asset)}
          >
            <div className="tl-asset-thumb">
              <img src={asset.thumbnail} alt="" />
              <span className="tl-asset-type">
                {asset.type === "video" ? (
                  <Film size={11} />
                ) : (
                  <ImagePlus size={11} />
                )}{" "}
                {asset.type === "video"
                  ? timecode(asset.duration).slice(0, 5)
                  : "STILL"}
              </span>
              {active === asset.id && (
                <i>
                  <Check size={12} />
                </i>
              )}
            </div>
            <strong title={asset.name}>{asset.name}</strong>
            <span>
              {asset.width} × {asset.height}
              <i /> {(asset.size / 1048576).toFixed(1)} MB
            </span>
          </button>
        ))}
        {!files.length && (
          <div className="tl-library-empty">
            <Clapperboard size={27} />
            <p>
              Every story starts
              <br />
              with a moment.
            </p>
            <small>Drop your source files here.</small>
          </div>
        )}
      </div>
      <div className="tl-local-note">
        <span className="tl-dot" />
        <span>Footage stays on this computer</span>
        <ArrowUpRight size={12} />
      </div>
    </aside>
  );
}
