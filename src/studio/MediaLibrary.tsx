import { Film, ImagePlus, FolderOpen, Plus } from "lucide-react";
import { useRuntime, selectAsset } from "./runtime";
import { useStudio } from "../store";
export default function MediaLibrary() {
  const r = useRuntime(),
    s = useStudio();
  return (
    <aside className="tl-media-library">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">SOURCE DESK</span>
          <h2>
            Pictures & footage <span>{r.assets.length}</span>
          </h2>
        </div>
      </div>
      <button
        className="film-button primary"
        onClick={() => r.set({ modal: "media" })}
      >
        <FolderOpen size={18} />
        Open media workspace
      </button>
      <p className="ts-note">
        Preview imports, organise sources by match and segment, add notes or
        restore missing files.
      </p>
      <div className="tl-assets">
        {r.assets.map((a) => (
          <button
            key={a.id}
            className={`tl-asset ${s.board?.studio?.assetId === a.id ? "is-active" : ""}`}
            onClick={() => selectAsset(a)}
          >
            <div className="tl-asset-thumb">
              <img src={a.thumbnail} alt="" />
              <span className="tl-asset-type">
                {a.type === "video" ? (
                  <Film size={12} />
                ) : (
                  <ImagePlus size={12} />
                )}{" "}
                {r.assetAvailability[a.id] === false
                  ? "MISSING"
                  : a.type.toUpperCase()}
              </span>
            </div>
            <strong>{a.name}</strong>
            <span>
              {a.segment || a.matchLabel || `${a.width} × ${a.height}`}
            </span>
          </button>
        ))}
      </div>
      <button className="film-button" onClick={() => r.set({ modal: "media" })}>
        <Plus size={17} />
        Add sources
      </button>
    </aside>
  );
}
