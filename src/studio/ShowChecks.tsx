import {
  ArrowRight,
  Check,
  ClipboardCheck,
  CalendarDays,
  Clapperboard,
  Download,
  Target,
  AlertCircle,
} from "lucide-react";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { inspectCue } from "./readiness";
import { recallCue } from "./showControl";
export default function ShowChecks() {
  const s = useStudio(),
    r = useRuntime(),
    b = s.board!;
  const cues = b.studio?.cues || [];
  const checked = cues.map((cue) => ({
    cue,
    issues: inspectCue(b, cue, r.assets, r.assetAvailability),
  }));
  const ready = checked.filter((c) => !c.issues.length).length;
  return (
    <aside className="director-checks ts-panel">
      <div className="tl-panel-title">
        <div>
          <span className="tl-eyebrow">PRODUCTION DESK</span>
          <h2>Prepare the show</h2>
        </div>
        <ClipboardCheck size={21} />
      </div>
      <div className="tl-panel-scroll">
        <p className="director-intro">
          Build a clear story. Check every shot. Then take it to screen.
        </p>
        <div className="director-setup-actions">
          <button onClick={() => s.set({ modal: "matches" })}>
            <CalendarDays size={19} />
            <span>
              <strong>Choose the match</strong>
              <small>Reports, lineups & player performance</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => r.set({ sidebar: "media" })}>
            <Clapperboard size={19} />
            <span>
              <strong>Bring in the moment</strong>
              <small>Local video, stills & reconstruction</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => r.set({ sidebar: "tactics" })}>
            <Target size={19} />
            <span>
              <strong>Explain the play</strong>
              <small>Shapes, movement & tactical guides</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="director-check-summary">
          <strong>
            {ready}
            <span> / {cues.length}</span>
          </strong>
          <div>
            <b>Shots checked</b>
            <span>
              {cues.length
                ? `${cues.length - ready} to review before the show`
                : "Save your first shot with M"}
            </span>
          </div>
        </div>
        {checked.map(({ cue, issues }, i) => (
          <button
            className="director-check-row"
            key={cue.id}
            onClick={() => {
              recallCue(cue.id);
              r.set({ sidebar: "rundown" });
            }}
          >
            {issues.length ? (
              <AlertCircle
                size={16}
                className={
                  issues.some((i) => i.level === "block")
                    ? "blocked"
                    : "needs-review"
                }
              />
            ) : (
              <Check size={16} />
            )}
            <span>
              <strong>
                {String(i + 1).padStart(2, "0")} · {cue.title}
              </strong>
              <small>
                {issues[0]?.message ||
                  "Source, caption and presenter note checked"}
              </small>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
        <div className="director-check-note">
          <strong>Before going on air</strong>
          <p>
            Open programme on your output display and check the framing in OBS
            or your vision mixer. Local receipt confirms the browser window; it
            does not confirm the downstream broadcast.
          </p>
        </div>
        <button
          className="director-backup"
          onClick={() => r.set({ modal: "export" })}
        >
          <Download size={16} />
          <span>
            <strong>Back up the complete show</strong>
            <small>Export a project pack including source media.</small>
          </span>
        </button>
        <div className="director-check-note">
          <strong>Know the source</strong>
          <p>
            Match cards use supplied report data. Missing values stay unknown.
            TV footage reconstruction needs calibration and review; unseen
            players cannot be recovered from the picture.
          </p>
        </div>
      </div>
    </aside>
  );
}
