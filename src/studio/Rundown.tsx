import { BookmarkPlus, ChevronRight, Play, Radio, Trash2 } from "lucide-react";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
import { emptyStudio, timecode } from "./types";
import { takeToAir } from "./production";
export default function Rundown() {
  const s = useStudio(),
    r = useRuntime(),
    d = s.board?.studio || emptyStudio();
  const recall = (id: string, take = false) => {
    const m = d.bookmarks.find((x) => x.id === id);
    if (!m) return;
    editDesk((d) => {
      d.assetId = m.assetId;
    });
    r.set({ view: "footage", time: m.time, mediaPlaying: false });
    if (take) takeToAir();
  };
  return (
    <aside className="tl-rundown">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">PRESENTER RUNDOWN</span>
          <h2>The story in moments</h2>
        </div>
        <BookmarkPlus size={20} />
      </div>
      <div className="tl-panel-scroll">
        {!d.bookmarks.length && (
          <div className="tl-empty-panel">
            <BookmarkPlus size={32} />
            <h3>Build the conversation.</h3>
            <p>
              Mark moments in the source timeline. Recall them instantly when
              the panel wants to revisit a detail.
            </p>
          </div>
        )}
        {d.bookmarks.map((m, i) => {
          const asset = r.assets.find((a) => a.id === m.assetId);
          return (
            <article className="tl-rundown-card" key={m.id}>
              <div className="tl-rundown-image" onClick={() => recall(m.id)}>
                {asset && <img src={asset.thumbnail} alt="" />}
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{timecode(m.time, d.fps)}</b>
              </div>
              <input
                aria-label={`Moment ${i + 1} title`}
                defaultValue={m.title}
                onBlur={(e) =>
                  editDesk((d) => {
                    d.bookmarks.find((x) => x.id === m.id)!.title =
                      e.target.value.slice(0, 80);
                  })
                }
              />
              <textarea
                aria-label={`Moment ${i + 1} presenter note`}
                placeholder="Presenter cue…"
                defaultValue={m.note}
                onBlur={(e) =>
                  editDesk((d) => {
                    d.bookmarks.find((x) => x.id === m.id)!.note =
                      e.target.value;
                  })
                }
              />
              <div>
                <button className="tl-quiet" onClick={() => recall(m.id)}>
                  <Play size={13} />
                  Recall
                </button>
                <button
                  className="tl-quiet take"
                  onClick={() => recall(m.id, true)}
                >
                  <Radio size={13} />
                  Take
                </button>
                <button
                  className="tl-icon"
                  aria-label={`Remove moment ${i + 1}`}
                  onClick={() =>
                    editDesk((d) => {
                      d.bookmarks = d.bookmarks.filter((x) => x.id !== m.id);
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
