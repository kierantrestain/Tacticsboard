import {
  ArrowUpRight,
  Monitor,
  Radio,
  Square,
  ShieldCheck,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import {
  openProgram,
  setLiveFollow,
  takeToAir,
  toggleBlackout,
} from "./production";
import { inspectView, viewLabels } from "./readiness";
import MiniPitch from "./MiniPitch";
export default function ProductionDesk() {
  const s = useStudio(),
    r = useRuntime(),
    p = r.program;
  const blockers = s.board
    ? inspectView(s.board, r.view, r.assets, r.assetAvailability).filter(
        (i) => i.level === "block",
      )
    : [];
  const acknowledged =
    !!p &&
    r.outputConnected &&
    r.outputAck?.id === p.id &&
    r.outputAck.black === p.black;
  const image = acknowledged
    ? r.outputAck?.thumbnail || p?.thumbnail
    : p?.thumbnail;
  return (
    <section
      className={`director-output ${p?.black ? "is-black" : acknowledged ? "is-connected" : ""}`}
      aria-label="Programme control"
    >
      <div className="director-monitor-label">
        <strong>
          <i /> PROGRAMME
        </strong>
        <span>
          {!r.outputConnected
            ? "Output closed"
            : !p
              ? "Standby"
              : acknowledged
                ? p.black
                  ? "Black"
                  : "Output received"
                : "Awaiting output"}
        </span>
        <button
          aria-label="Open programme window"
          title="Open clean output window"
          onClick={openProgram}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="director-monitor" data-testid="programme-monitor">
        {p?.black ? (
          <div className="director-monitor-empty">
            <Square size={20} />
            <strong>OUTPUT BLACK</strong>
            <span>Held: {p.title || p.board.title}</span>
          </div>
        ) : p ? (
          <>
            {image ? (
              <img src={image} alt={`Programme: ${p.title || p.board.title}`} />
            ) : (
              <MiniPitch frame={p.board} colors={p.board.colors} />
            )}
            <span className="director-monitor-caption">
              {viewLabels[p.view]} · {p.title || p.board.title}
            </span>
          </>
        ) : (
          <div className="director-monitor-empty">
            <Monitor size={23} />
            <strong>Ready for your opening shot</strong>
            <span>Prepare in preview, then take to programme.</span>
          </div>
        )}
      </div>
      <div className="director-output-actions">
        <button
          className="director-take"
          onClick={() => takeToAir()}
          disabled={!!r.busy || s.loading || !!p?.black || !!blockers.length}
        >
          <Radio size={16} /> Take preview <kbd>Enter</kbd>
        </button>
        <button
          className={`director-black ${p?.black ? "active" : ""}`}
          aria-pressed={!!p?.black}
          disabled={!p}
          onClick={toggleBlackout}
        >
          <Square size={12} fill="currentColor" />
          {p?.black ? "Restore held shot" : "Blackout"}
        </button>
      </div>
      <div className="director-follow">
        <label>
          <input
            type="checkbox"
            checked={r.follow}
            disabled={!!r.busy || !!p?.black}
            onChange={(e) => setLiveFollow(e.target.checked)}
          />{" "}
          Live follow
        </label>
        <span>
          {r.follow ? "Edits go to programme" : "Preview edits stay private"}
        </span>
      </div>
      {blockers.length > 0 ? (
        <button
          className="director-readiness blocked"
          onClick={() =>
            r.set({
              sidebar:
                r.view === "stats"
                  ? "show"
                  : blockers[0].code === "tracking-review"
                    ? "reconstruct"
                    : "media",
            })
          }
        >
          {blockers[0].message}
        </button>
      ) : (
        <div className="director-readiness">
          <ShieldCheck size={12} />{" "}
          {p?.black
            ? "Restore returns the held shot, unchanged."
            : "Preview sources available"}
        </div>
      )}
    </section>
  );
}
