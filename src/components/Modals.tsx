import MatchCentre from "../football/MatchCentre";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  CalendarDays,
  ArrowUpRight,
  Download,
  Image as ImageIcon,
  FileJson,
  Video,
  FolderOpen,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowLeftRight,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useStudio } from "../store";
import { dateLabel, uid } from "../core";
import { TeamBadge } from "./Sidebar";
import type { Match, Team } from "../types";
function Shell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = useStudio();
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className={`studio-dialog ${wide ? "wide" : ""}`}
      ref={ref}
      onCancel={() => s.set({ modal: null })}
      onClick={(e) => {
        if (e.target === ref.current) s.set({ modal: null });
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">TOUCHLINE STUDIO</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="icon-button"
            title="Close"
            aria-label="Close dialog"
            onClick={() => s.set({ modal: null })}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
function CompetitionFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="competition-filter">
      {[
        ["all", "All clubs"],
        ["eng.1", "Premier League"],
        ["uefa.champions", "Champions League"],
      ].map(([id, label]) => (
        <button
          key={id}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function TeamsModal() {
  const s = useStudio(),
    { board, catalogue } = s;
  const [home, setHome] = useState(board!.homeTeamId),
    [away, setAway] = useState(board!.awayTeamId),
    [side, setSide] = useState<"home" | "away">("home"),
    [q, setQ] = useState(""),
    [competition, setCompetition] = useState("all");
  if (!catalogue || !board) return null;
  const ht = catalogue.teams.find((t) => t.id === home),
    at = catalogue.teams.find((t) => t.id === away);
  const teams = catalogue.teams.filter(
    (t) =>
      (competition === "all" || t.competitions.includes(competition)) &&
      `${t.name} ${t.abbreviation}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Shell
      title="Choose your teams"
      subtitle="Every Premier League club and every Champions League league-phase club for 2026/27."
      wide
    >
      <div className="matchup-selector">
        <button
          className={side === "home" ? "active" : ""}
          onClick={() => setSide("home")}
        >
          <span className="eyebrow">HOME TEAM</span>
          <TeamBadge team={ht} />
          <strong>{ht?.name}</strong>
          <span>Choose home team</span>
        </button>
        <ArrowLeftRight size={19} />
        <button
          className={side === "away" ? "active" : ""}
          onClick={() => setSide("away")}
        >
          <span className="eyebrow">AWAY TEAM</span>
          <TeamBadge team={at} />
          <strong>{at?.name}</strong>
          <span>Choose away team</span>
        </button>
      </div>
      <div className="dialog-filters">
        <CompetitionFilter value={competition} onChange={setCompetition} />
        <div className="search-field">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs…"
            aria-label="Search all clubs"
          />
        </div>
      </div>
      <div className="team-grid">
        {teams.map((t) => (
          <button
            className={`club-card ${(side === "home" ? home : away) === t.id ? "selected" : ""}`}
            key={t.id}
            onClick={() => (side === "home" ? setHome(t.id) : setAway(t.id))}
          >
            <TeamBadge team={t} />
            <div>
              <strong>{t.name}</strong>
              <span>
                {t.players.length} players
                {t.competitions.length > 1
                  ? " · PL + UCL"
                  : t.competitions[0] === "eng.1"
                    ? " · Premier League"
                    : " · UCL"}
              </span>
            </div>
            {(side === "home" ? home : away) === t.id && (
              <CheckCircle2 size={17} />
            )}
          </button>
        ))}
      </div>
      <footer className="dialog-footer">
        <span>
          {teams.length} clubs · Choose both sides, then load the board.
        </span>
        <button
          className="primary-button"
          onClick={() => s.chooseTeams(home, away)}
        >
          Load teams <ArrowUpRight size={16} />
        </button>
      </footer>
    </Shell>
  );
}
function MatchesModal() {
  const s = useStudio(),
    { catalogue } = s;
  const [q, setQ] = useState(""),
    [competition, setCompetition] = useState("all"),
    [date, setDate] = useState(""),
    [extra, setExtra] = useState<Match[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!catalogue) return null;
  const list = [
    ...new Map([...extra, ...catalogue.matches].map((m) => [m.id, m])).values(),
  ]
    .filter(
      (m) =>
        (competition === "all" || m.league === competition) &&
        (!date || m.date.startsWith(date)) &&
        `${m.homeName} ${m.awayName}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const refresh = async () => {
    if (!date) return;
    setBusy(true);
    setError("");
    try {
      const leagues =
        competition === "all" ? ["eng.1", "uefa.champions"] : [competition];
      const results = await Promise.all(
        leagues.map(async (league) => {
          const r = await fetch(
            `/api/football?action=fixtures&league=${league}&date=${date.replaceAll("-", "")}`,
          );
          if (!r.ok) throw Error();
          return (await r.json()).matches as Match[];
        }),
      );
      setExtra(results.flat());
      if (!results.flat().length)
        setError(
          "No fixtures are listed on this date in the selected competition.",
        );
    } catch {
      setError(
        "The live source is unavailable. The saved season archive below remains available.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Match centre"
      subtitle="Load a real fixture, its available starting lineups and the match record."
      wide
    >
      <div className="dialog-filters">
        <CompetitionFilter value={competition} onChange={setCompetition} />
        <div className="search-field">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams or a fixture…"
            aria-label="Search matches"
          />
        </div>
      </div>
      <div className="date-filter">
        <CalendarDays size={16} />
        <label>
          Match date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Match date"
          />
        </label>
        <button
          className="secondary-button"
          disabled={!date || busy}
          onClick={refresh}
        >
          {busy ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Check this date
        </button>
        {date && (
          <button
            className="text-button"
            onClick={() => {
              setDate("");
              setError("");
            }}
          >
            Clear date
          </button>
        )}
      </div>
      {error && <p className="inline-message">{error}</p>}
      <div className="match-results">
        {list.length ? (
          list.slice(0, 200).map((m) => {
            const home = catalogue.teams.find((t) => t.id === m.homeId),
              away = catalogue.teams.find((t) => t.id === m.awayId);
            return (
              <button
                className="fixture-row"
                key={m.id}
                onClick={() => s.loadMatch(m)}
                disabled={s.loading || !home || !away}
              >
                <span className="fixture-date">
                  <strong>{dateLabel(m.date)}</strong>
                  <small>
                    {m.league === "eng.1"
                      ? "Premier League"
                      : "Champions League"}
                  </small>
                </span>
                <span className="fixture-home">
                  <strong>{m.homeName}</strong>
                  <TeamBadge team={home} size="small" />
                </span>
                <span className="fixture-score">
                  {m.completed
                    ? `${m.homeScore ?? "–"}  –  ${m.awayScore ?? "–"}`
                    : new Intl.DateTimeFormat("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/London",
                      }).format(new Date(m.date))}
                  <small>{m.completed ? "Full time" : m.status}</small>
                </span>
                <span className="fixture-away">
                  <TeamBadge team={away} size="small" />
                  <strong>{m.awayName}</strong>
                </span>
                <ArrowUpRight size={15} />
              </button>
            );
          })
        ) : (
          <div className="empty-state">
            <CalendarDays size={28} />
            <h3>No matching fixtures</h3>
            <p>Clear the filters or choose a date and check the live source.</p>
          </div>
        )}
      </div>
      <footer className="dialog-footer">
        <span>{list.length} matches in this view · UK local times</span>
        <span className="muted-text">
          Pending lineups are labelled; recent selections remain editable.
        </span>
      </footer>
    </Shell>
  );
}
function LibraryModal() {
  const s = useStudio();
  return (
    <Shell
      title="Your analysis library"
      subtitle="Saved in this browser. Export a JSON file to move a complete analysis to another computer."
      wide
    >
      <div className="library-list">
        {s.library.map((b) => (
          <button
            className={`library-card ${b.id === s.board?.id ? "selected" : ""}`}
            key={b.id}
            onClick={() => s.load(b.id)}
          >
            <div className="library-icon">
              <FolderOpen size={23} />
            </div>
            <div>
              <strong>{b.title}</strong>
              <span>
                {b.scenes} {b.scenes === 1 ? "phase" : "phases"} · Saved{" "}
                {dateLabel(b.updatedAt)}
              </span>
            </div>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      <footer className="dialog-footer">
        <span>Autosave keeps your current workspace up to date.</span>
        <button className="primary-button" onClick={s.create}>
          <Plus size={15} />
          New analysis
        </button>
      </footer>
    </Shell>
  );
}
function HelpModal() {
  const rows = [
    ["V", "Select and move"],
    ["A", "Pass arrow"],
    ["R", "Movement run"],
    ["L", "Connection line"],
    ["D", "Freehand drawing"],
    ["Z / O / G", "Zone / circle / three-point zone"],
    ["H / T / E", "Highlight / text / eraser"],
    ["Space", "Play or pause the storyboard"],
    ["K", "Add the next phase"],
    ["Ctrl / ⌘ Z", "Undo"],
    ["Ctrl / ⌘ Shift Z", "Redo"],
    ["Ctrl / ⌘ S", "Save analysis"],
    ["Delete", "Delete selected markers or annotation"],
    ["F", "Enter or leave presenter view"],
    ["Shift + click", "Select more than one player"],
    ["Arrow keys", "Nudge selected players; Shift for a larger step"],
  ];
  return (
    <Shell
      title="Built for the studio"
      subtitle="Mouse, touch and pen controls share the same analysis workspace."
    >
      <div className="help-intro">
        <p>
          Drag player markers and the ball. Draw a pass, run or zone. Add a
          phase, move the players, then press Play to connect the positions.
        </p>
        <p>
          Presenter view gives you the full board with a compact drawing rail.
          TV output opens a clean, synchronised window in the same browser for a
          studio display or OBS capture.
        </p>
      </div>
      <div className="shortcut-list">
        {rows.map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <kbd>{key}</kbd>
          </div>
        ))}
      </div>
      <p className="data-footnote">
        Video exports use this browser’s supported recording format. Reference
        media stays in this browser’s local media store; reattach the original
        file after importing an analysis elsewhere.
      </p>
    </Shell>
  );
}
function DataModal() {
  const s = useStudio();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const c = s.catalogue;
  if (!c || !s.board) return null;
  const refresh = async () => {
    setBusy(true);
    setMessage("");
    try {
      const ids = [s.board!.homeTeamId, s.board!.awayTeamId];
      const updated = await Promise.all(
        ids.map(async (id) => {
          const team = c.teams.find((t) => t.id === id)!;
          const league = team.competitions.includes("eng.1")
            ? "eng.1"
            : "uefa.champions";
          const r = await fetch(
            `/api/football?action=roster&league=${league}&team=${id}&season=2026`,
          );
          if (!r.ok) throw Error();
          return { id, ...(await r.json()) };
        }),
      );
      const next = structuredClone(c);
      for (const item of updated) {
        const t = next.teams.find((t) => t.id === item.id);
        if (t) {
          const old = new Map(t.players.map((p) => [p.id, p]));
          t.players = item.players.map((p: any) => ({
            ...old.get(p.id),
            ...p,
            fplId: old.get(p.id)?.fplId,
            advanced: old.get(p.id)?.advanced,
            statsByCompetition: {
              ...old.get(p.id)?.statsByCompetition,
              ...p.statsByCompetition,
            },
          }));
          t.rosterUpdatedAt = item.updatedAt;
        }
      }
      s.set({ catalogue: next });
      setMessage(
        "Both selected squads refreshed. Existing analysis lineups and manager profiles were preserved.",
      );
    } catch {
      setMessage(
        "The live source is unavailable. Your loaded catalogue and analysis remain available.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Football data desk"
      subtitle="A clear record of the catalogue, source coverage and analysis boundaries."
    >
      <div className="data-counts">
        <div>
          <strong>20</strong>
          <span>Premier League clubs</span>
        </div>
        <div>
          <strong>36</strong>
          <span>UCL league-phase clubs</span>
        </div>
        <div>
          <strong>{c.quality.playerCount.toLocaleString()}</strong>
          <span>Squad player records</span>
        </div>
      </div>
      <div className="data-record">
        <div>
          <span>Season</span>
          <strong>{c.season}</strong>
        </div>
        <div>
          <span>Unique clubs</span>
          <strong>{c.teams.length} · five in both competitions</strong>
        </div>
        <div>
          <span>Snapshot</span>
          <strong>
            {dateLabel(c.updatedAt)} {new Date(c.updatedAt).getUTCFullYear()}
          </strong>
        </div>
        <div>
          <span>Squads and match records</span>
          <strong>ESPN + Premier League FPL</strong>
        </div>
        <div>
          <span>Manager identity</span>
          <strong>Premier League, UEFA and linked updates</strong>
        </div>
      </div>
      <h3 className="minor-heading">What the board represents</h3>
      <ul className="plain-list">
        <li>
          Real supplied squad records, shirt numbers, biographies and
          competition-scoped statistics.
        </li>
        <li>
          Confirmed match XIs when the source supplies them. Pending or
          unavailable lineups remain clearly labelled.
        </li>
        <li>
          Analyst-controlled positions and animations. They are reconstructions,
          rather than tracking data.
        </li>
        <li>
          Premier League xG/xA and match logs come from the separately labelled
          FPL feed. Missing metrics stay unknown; heatmaps and optical tracking
          are not fabricated.
        </li>
      </ul>
      <p className="data-footnote">
        The public source is not a contracted broadcast data service. A licensed
        provider can replace the adapter for guaranteed service, rights and
        advanced data coverage.
      </p>
      <button
        className="secondary-button full-width"
        onClick={refresh}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="spin" size={14} />
        ) : (
          <RefreshCw size={14} />
        )}
        Refresh selected squads
      </button>
      {message && <p className="inline-message">{message}</p>}
      <div className="source-links">
        <a
          href="https://www.premierleague.com/en/clubs"
          target="_blank"
          rel="noreferrer"
        >
          Premier League club source <ExternalLink size={12} />
        </a>
        <a
          href="https://www.uefa.com/uefachampionsleague/clubs/"
          target="_blank"
          rel="noreferrer"
        >
          UEFA team source <ExternalLink size={12} />
        </a>
      </div>
    </Shell>
  );
}
function ExportModal({
  onPNG,
  onVideo,
  onJSON,
}: {
  onPNG: () => void;
  onVideo: () => void;
  onJSON: () => void;
}) {
  return (
    <Shell
      title="Take the analysis to air"
      subtitle="Export the pitch or keep a complete editable copy of the storyboard."
    >
      <div className="export-options">
        <button onClick={onPNG}>
          <div className="export-icon">
            <ImageIcon size={23} />
          </div>
          <span>
            <strong>High-resolution still</strong>
            <small>3840 px PNG · clean pitch and annotations</small>
          </span>
          <Download size={17} />
        </button>
        <button onClick={onVideo}>
          <div className="export-icon">
            <Video size={23} />
          </div>
          <span>
            <strong>Animated sequence</strong>
            <small>Record the storyboard to a video file</small>
          </span>
          <Download size={17} />
        </button>
        <button onClick={onJSON}>
          <div className="export-icon">
            <FileJson size={23} />
          </div>
          <span>
            <strong>Editable analysis</strong>
            <small>JSON · lineups, drawings, phases and notes</small>
          </span>
          <Download size={17} />
        </button>
      </div>
      <p className="data-footnote">
        Reference files remain in this browser. Keep your original image or
        video with the JSON when transferring a project. The animation file
        format depends on browser support.
      </p>
    </Shell>
  );
}
export default function Modals(props: {
  onPNG: () => void;
  onVideo: () => void;
  onJSON: () => void;
}) {
  const modal = useStudio((s) => s.modal);
  if (modal === "teams") return <TeamsModal />;
  if (modal === "matches") return <MatchCentre />;
  if (modal === "library") return <LibraryModal />;
  if (modal === "help") return <HelpModal />;
  if (modal === "data") return <DataModal />;
  if (modal === "export") return <ExportModal {...props} />;
  return null;
}
