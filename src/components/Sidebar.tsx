import { useMemo, useState } from "react";
import {
  Users,
  UserRound,
  ClipboardList,
  SlidersHorizontal,
  Search,
  ArrowLeftRight,
  ExternalLink,
  ChevronRight,
  Trash2,
  Plus,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import { useStudio } from "../store";
import { dateLabel, formatMatchStat, initials, shortName, uid } from "../core";
import { FORMATIONS } from "../core";
import type { Board, Player, Side, Team } from "../types";
export function TeamBadge({
  team,
  size = "normal",
}: {
  team?: Team;
  size?: "small" | "normal" | "large";
}) {
  return (
    <span
      className={`team-badge ${size}`}
      style={
        { "--team-color": team?.color || "#8ea99b" } as React.CSSProperties
      }
    >
      <span>{team?.abbreviation?.slice(0, 3) || "FC"}</span>
    </span>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={onChange}
        className={`switch ${checked ? "on" : ""}`}
      >
        <span />
      </button>
    </label>
  );
}
export default function Sidebar() {
  const s = useStudio(),
    { board, catalogue, inspector, side } = s;
  const [search, setSearch] = useState(""),
    [replacement, setReplacement] = useState<string | null>(null),
    [showAll, setShowAll] = useState(false);
  if (!board || !catalogue) return null;
  const team = catalogue.teams.find(
    (t) => t.id === (side === "home" ? board.homeTeamId : board.awayTeamId),
  )!;
  const teamPlayers = board.players.filter((p) => p.side === side);
  const selected = board.players.find((p) => p.uid === s.selected[0]);
  const player = team.players.find(
    (p) => p.id === (s.profileId || selected?.playerId),
  );
  const profiles = team.players.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const manager = team.manager;
  const selectedDrawing = board.drawings.find((d) => d.id === s.selectedShape);
  const statScope = player?.statsByCompetition[board.competition]
    ? board.competition
    : Object.keys(player?.statsByCompetition || {})[0];
  const stats = player?.statsByCompetition[statScope] || {};
  const age = (dob?: string) =>
    dob
      ? Math.floor(
          (Date.now() - new Date(dob).getTime()) / (365.2425 * 86400000),
        )
      : null;
  const stat = (name: string) =>
    stats[name]?.display ?? stats[name]?.value?.toString() ?? "—";
  const tabs = [
    { id: "lineup", label: "Lineup", Icon: Users },
    { id: "players", label: "Players", Icon: UserRound },
    { id: "manager", label: "Manager", Icon: ClipboardList },
    { id: "match", label: "Match", Icon: ChartNoAxesCombined },
    { id: "settings", label: "Display", Icon: SlidersHorizontal },
  ] as const;
  const replace = (p: Player) => {
    if (replacement) {
      s.replacePlayer(side, replacement, p);
      setReplacement(null);
    } else if (selected?.side === side) s.replacePlayer(side, selected.uid, p);
    else if (teamPlayers.length < 11) {
      s.commit((b) => {
        b.players.push({
          uid: `${side}:${p.id}`,
          playerId: p.id,
          side,
          x: side === "home" ? 0.3 : 0.7,
          y: 0.5,
          name: p.name,
          number: p.number || "",
          position: p.position,
        });
        b.lineupSource[side] = "Analyst selection";
      });
    } else {
      s.notify(
        "Select a player on the pitch or use a lineup swap button first.",
      );
    }
  };
  return (
    <aside className="sidebar" aria-label="Team and player inspector">
      <div className="inspector-tabs">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={inspector === id ? "active" : ""}
            onClick={() => {
              s.set({ inspector: id });
              setReplacement(null);
              setShowAll(false);
            }}
            title={label}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="side-switch">
        {(["home", "away"] as Side[]).map((x) => (
          <button
            className={side === x ? "active" : ""}
            key={x}
            onClick={() => {
              s.set({ side: x, profileId: null });
              setSearch("");
              setReplacement(null);
            }}
          >
            <i style={{ background: board.colors[x] }} />
            {x === "home" ? "Home team" : "Away team"}
          </button>
        ))}
      </div>
      <div className="sidebar-scroll">
        <div className="team-inspector-heading">
          <TeamBadge team={team} />
          <div>
            <h2>{team.shortName}</h2>
            <span>{team.manager?.name || "Team profile"}</span>
          </div>
          <button
            className="icon-button"
            title="Change teams"
            onClick={() => s.set({ modal: "teams" })}
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>
        {inspector === "lineup" && (
          <>
            <div className="lineup-meta">
              <span className="small-label">STARTING SHAPE</span>
              <select
                aria-label={`${side} formation`}
                value={board.formations[side]}
                onChange={(e) => s.formation(side, e.target.value)}
              >
                {[...new Set([...FORMATIONS, board.formations[side]])].map(
                  (f) => (
                    <option key={f}>{f}</option>
                  ),
                )}
              </select>
            </div>
            <div className="source-caption">
              <ShieldCheck size={12} />
              {board.lineupSource[side]}
            </div>
            {replacement && (
              <div className="swap-prompt">
                <strong>Choose a replacement</strong>
                <span>
                  Replacing{" "}
                  {shortName(
                    board.players.find((p) => p.uid === replacement)?.name ||
                      "player",
                  )}
                </span>
                <button onClick={() => setReplacement(null)}>Cancel</button>
              </div>
            )}
            {!replacement && (
              <div className="lineup-list">
                {teamPlayers.map((p) => (
                  <div
                    key={p.uid}
                    className={`lineup-row ${s.selected.includes(p.uid) ? "selected" : ""}`}
                  >
                    <button
                      className="player-row-main"
                      onClick={() =>
                        s.set({
                          selected: [p.uid],
                          selectedShape: null,
                          profileId: null,
                        })
                      }
                    >
                      <span
                        className="shirt-number"
                        style={{ color: board.colors[side] }}
                      >
                        {p.number || "—"}
                      </span>
                      <span className="lineup-name">{p.name}</span>
                      <span className="position-code">
                        {team.players.find((x) => x.id === p.playerId)
                          ?.positionCode || "·"}
                      </span>
                    </button>
                    <button
                      className="row-action"
                      aria-label={`Replace ${p.name}`}
                      title={`Replace ${p.name}`}
                      onClick={() => {
                        setReplacement(p.uid);
                        setSearch("");
                      }}
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="section-heading">
              <h3>{replacement ? "Available squad" : "On the bench"}</h3>
              <span>
                {
                  team.players.filter(
                    (p) => !teamPlayers.some((z) => z.playerId === p.id),
                  ).length
                }
              </span>
            </div>
            <div className="search-field compact">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a squad player"
                aria-label="Search squad"
              />
            </div>
            <div className="bench-list">
              {profiles
                .filter((p) => !teamPlayers.some((z) => z.playerId === p.id))
                .map((p) => (
                  <button
                    className="bench-row"
                    key={p.id}
                    onClick={() => replace(p)}
                    title={
                      replacement
                        ? "Use this player"
                        : "Select a lineup slot to substitute"
                    }
                  >
                    <span className="shirt-number muted">
                      {p.number || "—"}
                    </span>
                    <span>{p.name}</span>
                    <small>{p.positionCode}</small>
                    <Plus size={13} />
                  </button>
                ))}
            </div>
          </>
        )}
        {inspector === "players" && (
          <>
            <div className="search-field compact">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search this squad"
                aria-label="Search player profiles"
              />
            </div>
            {player && !search && !showAll ? (
              <>
                <div className="player-hero">
                  <div
                    className="player-monogram"
                    style={
                      {
                        "--team-color": board.colors[side],
                      } as React.CSSProperties
                    }
                  >
                    {initials(player.name)}
                    <span>{player.number}</span>
                  </div>
                  <div>
                    <span className="eyebrow">PLAYER PROFILE</span>
                    <h2>{player.name}</h2>
                    <p>
                      {player.position} ·{" "}
                      {player.nationality || "Nationality not supplied"}
                    </p>
                  </div>
                </div>
                <div className="player-demographics">
                  {[
                    [
                      "Age",
                      age(player.dateOfBirth)
                        ? `${age(player.dateOfBirth)} years`
                        : "—",
                    ],
                    ["Height", player.heightCm ? `${player.heightCm} cm` : "—"],
                    ["Weight", player.weightKg ? `${player.weightKg} kg` : "—"],
                    [
                      "Born",
                      player.dateOfBirth
                        ? dateLabel(player.dateOfBirth) +
                          " " +
                          new Date(player.dateOfBirth).getUTCFullYear()
                        : "—",
                    ],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <span>{a}</span>
                      <strong>{b}</strong>
                    </div>
                  ))}
                </div>
                <div className="section-heading">
                  <h3>Season numbers</h3>
                  <span>2026/27</span>
                </div>
                <p className="stat-scope">
                  {catalogue.competitions.find((c) => c.id === statScope)
                    ?.name || "Supplied competition"}
                </p>
                <div className="key-stats">
                  {[
                    ["appearances", "Apps"],
                    ["totalGoals", "Goals"],
                    ["goalAssists", "Assists"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <strong>{stat(key)}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="detail-stats">
                  {Object.entries(stats)
                    .filter(
                      ([k]) =>
                        !["appearances", "totalGoals", "goalAssists"].includes(
                          k,
                        ) &&
                        (player.positionCode === "G" ||
                          !["saves", "shotsFaced", "goalsAgainst"].includes(k)),
                    )
                    .map(([key, v]) => (
                      <div key={key}>
                        <span>{v.label}</span>
                        <strong>{v.display ?? v.value ?? "—"}</strong>
                      </div>
                    ))}
                </div>
                <p className="data-footnote">
                  Figures retain their source competition. A dash means the
                  field was not supplied. Preferred foot, xG and tracking data
                  are not inferred.
                </p>
                {player.sourceUrl && (
                  <a
                    className="text-link"
                    href={player.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source profile <ExternalLink size={12} />
                  </a>
                )}
                <button
                  className="secondary-button full-width"
                  onClick={() => {
                    setShowAll(true);
                  }}
                >
                  Browse the full squad <ChevronRight size={14} />
                </button>
              </>
            ) : (
              <>
                <p className="muted-text">
                  {search.trim()
                    ? "Matching players"
                    : "Select a player on the pitch, or open a squad profile."}
                </p>
                {profiles.map((p) => (
                  <button
                    className="profile-row"
                    key={p.id}
                    onClick={() => {
                      const onPitch = teamPlayers.find(
                        (x) => x.playerId === p.id,
                      );
                      s.set({
                        profileId: p.id,
                        selected: onPitch ? [onPitch.uid] : [],
                        selectedShape: null,
                      });
                      setSearch("");
                      setShowAll(false);
                    }}
                  >
                    <span className="shirt-number">{p.number || "—"}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.position} · {p.nationality || "—"}
                      </small>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </>
            )}
          </>
        )}
        {inspector === "manager" && manager && (
          <>
            <div className="manager-hero">
              <div className="manager-avatar">{initials(manager.name)}</div>
              <span className="eyebrow">MANAGER DESK</span>
              <h2>{manager.name}</h2>
              <span className="nationality">
                {manager.nationality}
                {manager.status ? " · " + manager.status : ""}
              </span>
            </div>
            <p className="manager-bio">{manager.bio}</p>
            <div className="section-heading">
              <h3>Recent starting shapes</h3>
              <span>Match sample</span>
            </div>
            {manager.formations.length ? (
              <div className="formation-chips">
                {manager.formations.map((f) => (
                  <button
                    key={f.name}
                    title={`Apply ${f.name}`}
                    onClick={() => s.formation(side, f.name)}
                  >
                    <strong>{f.name}</strong>
                    <span>
                      {f.matches} {f.matches === 1 ? "match" : "matches"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-text">
                No starting formation was supplied for the available sample.
                Select an analyst template from the Lineup tab.
              </p>
            )}
            <p className="data-footnote">
              Shapes come from available starting lineups. They are a sample,
              not the manager’s permanent system.
            </p>
            <div className="analysis-lens">
              <span className="eyebrow">EDITORIAL ANALYSIS LENS</span>
              <h3>{manager.lens}</h3>
              <p>
                Test the idea against the selected match: who is free, what
                triggers the movement, and how can the opposition respond?
              </p>
            </div>
            <label className="field-label">
              Your scouting notes
              <textarea
                key={`${board.id}-${team.id}`}
                defaultValue={board.managerNotes[team.id] || ""}
                onBlur={(e) =>
                  s.commit((b) => {
                    b.managerNotes[team.id] = e.target.value;
                  })
                }
                placeholder="In possession, out of possession, pressing triggers…"
                rows={5}
              />
            </label>
            <a
              className="text-link"
              href={manager.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Manager identity source <ExternalLink size={12} />
            </a>
            <p className="data-footnote">
              Checked {dateLabel(manager.checkedAt)}{" "}
              {new Date(manager.checkedAt).getUTCFullYear()}. Editorial prompts
              are separate from measured data.
            </p>
          </>
        )}
        {inspector === "match" && (
          <>
            <div className="section-heading">
              <h3>Match desk</h3>
              <span>Source record</span>
            </div>
            {board.match ? (
              <>
                <h2 className="match-desk-title">
                  {board.match.homeName}
                  <br />
                  <span>
                    {board.match.completed
                      ? `${board.match.homeScore ?? "—"} : ${board.match.awayScore ?? "—"}`
                      : "v"}
                  </span>
                  <br />
                  {board.match.awayName}
                </h2>
                <p className="muted-text">
                  {dateLabel(board.match.date)} · {board.match.status}
                  {board.match.venue ? ` · ${board.match.venue}` : ""}
                </p>
                {s.summaries[board.match.id]?.teamStats.length ? (
                  <>
                    <div className="section-heading">
                      <h3>Team comparison</h3>
                      <span>Home / away</span>
                    </div>
                    <div className="match-stat-head">
                      <strong>{board.match.homeName}</strong>
                      <strong>{board.match.awayName}</strong>
                    </div>
                    <div className="match-stat-list">
                      {Object.entries(
                        s.summaries[board.match.id].teamStats.find(
                          (t) => t.teamId === board.homeTeamId,
                        )?.stats || {},
                      ).map(([key, v]) => (
                        <div key={key}>
                          <strong>
                            {formatMatchStat(
                              s.summaries[board.match!.id].teamStats.find(
                                (t) => t.teamId === board.homeTeamId,
                              )?.stats,
                              key,
                            )}
                          </strong>
                          <span>{v.label}</span>
                          <strong>
                            {formatMatchStat(
                              s.summaries[board.match!.id].teamStats.find(
                                (t) => t.teamId === board.awayTeamId,
                              )?.stats,
                              key,
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <p className="data-footnote">
                      Completion and accuracy percentages are calculated from
                      the supplied match totals.
                    </p>
                  </>
                ) : (
                  <p className="data-footnote">
                    No team statistics have been supplied for this match.
                  </p>
                )}
                {!!s.summaries[board.match.id]?.events.length && (
                  <>
                    <div className="section-heading">
                      <h3>Key events</h3>
                    </div>
                    <div className="match-event-list">
                      {s.summaries[board.match.id].events.map((e, i) => (
                        <div key={i}>
                          <strong>{e.minute || "·"}</strong>
                          <p>{e.text}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <a
                  className="text-link"
                  href={board.match.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open match source <ExternalLink size={12} />
                </a>
              </>
            ) : (
              <p className="muted-text">
                Load a match to inspect its supplied team statistics, events and
                confirmed lineups.
              </p>
            )}
            <button
              className="primary-button full-width"
              onClick={() => s.set({ modal: "matches" })}
            >
              Choose a match <ChevronRight size={14} />
            </button>
          </>
        )}
        {inspector === "settings" && (
          <>
            {selectedDrawing && (
              <div className="object-inspector">
                <div className="section-heading">
                  <h3>Selected annotation</h3>
                  <button
                    className="icon-button danger"
                    title="Delete annotation"
                    onClick={() => {
                      s.commit((b) => {
                        b.drawings = b.drawings.filter(
                          (d) => d.id !== selectedDrawing.id,
                        );
                      });
                      s.set({ selectedShape: null });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {selectedDrawing.type === "text" && (
                  <label className="field-label">
                    Text
                    <input
                      key={selectedDrawing.id}
                      defaultValue={selectedDrawing.text}
                      onBlur={(e) =>
                        s.commit((b) => {
                          b.drawings.find(
                            (d) => d.id === selectedDrawing.id,
                          )!.text = e.target.value.slice(0, 100);
                        })
                      }
                    />
                  </label>
                )}
                <label className="range-label">
                  Colour
                  <input
                    type="color"
                    value={selectedDrawing.color}
                    onChange={(e) =>
                      s.commit((b) => {
                        b.drawings.find(
                          (d) => d.id === selectedDrawing.id,
                        )!.color = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="range-label">
                  Line weight
                  <input
                    type="range"
                    min="1"
                    max="9"
                    value={selectedDrawing.width}
                    onChange={(e) =>
                      s.commit((b) => {
                        b.drawings.find(
                          (d) => d.id === selectedDrawing.id,
                        )!.width = Number(e.target.value);
                      })
                    }
                  />
                </label>
                <label className="range-label">
                  Opacity
                  <input
                    type="range"
                    min=".1"
                    max="1"
                    step=".05"
                    value={selectedDrawing.opacity}
                    onChange={(e) =>
                      s.commit((b) => {
                        b.drawings.find(
                          (d) => d.id === selectedDrawing.id,
                        )!.opacity = Number(e.target.value);
                      })
                    }
                  />
                </label>
              </div>
            )}
            <div className="section-heading">
              <h3>Pitch appearance</h3>
            </div>
            <div className="theme-options">
              {(["studio", "grass", "light"] as const).map((t) => (
                <button
                  key={t}
                  className={`${t} ${board.settings.theme === t ? "active" : ""}`}
                  onClick={() =>
                    s.commit((b) => {
                      b.settings.theme = t;
                    })
                  }
                >
                  <span />
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <label className="field-label">
              Camera
              <select
                value={board.settings.camera}
                onChange={(e) =>
                  s.commit((b) => {
                    b.settings.camera = e.target.value as "top" | "angle";
                  })
                }
              >
                <option value="top">Top-down analysis</option>
                <option value="angle">Broadcast angle</option>
              </select>
            </label>
            <label className="field-label">
              Pitch view
              <select
                value={board.settings.view}
                onChange={(e) =>
                  s.commit((b) => {
                    b.settings.view = e.target.value as
                      "full" | "left" | "right";
                  })
                }
              >
                <option value="full">Full pitch</option>
                <option value="left">Left half</option>
                <option value="right">Right half</option>
              </select>
            </label>
            <label className="field-label">
              Player markers
              <select
                value={board.settings.tokenStyle}
                onChange={(e) =>
                  s.commit((b) => {
                    b.settings.tokenStyle = e.target.value as "disc" | "shirt";
                  })
                }
              >
                <option value="disc">Studio discs</option>
                <option value="shirt">Shirts</option>
              </select>
            </label>
            {[
              ["names", "Player names"],
              ["numbers", "Shirt numbers"],
              ["grid", "Alignment grid"],
              ["lanes", "Five-lane guides"],
              ["trails", "Movement trails"],
              ["homeVisible", "Home team"],
              ["awayVisible", "Away team"],
              ["mediaVisible", "Reference media"],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                checked={Boolean(
                  board.settings[key as keyof Board["settings"]],
                )}
                onChange={() =>
                  s.commit((b) => {
                    (b.settings as unknown as Record<string, unknown>)[key] =
                      !b.settings[key as keyof Board["settings"]];
                  })
                }
              />
            ))}
            <div className="section-heading">
              <h3>Team colours</h3>
            </div>
            {(["home", "away"] as Side[]).map((x) => (
              <label key={x} className="range-label">
                {x === "home" ? "Home" : "Away"}
                <input
                  aria-label={`${x} colour`}
                  type="color"
                  value={board.colors[x]}
                  onChange={(e) =>
                    s.commit((b) => {
                      b.colors[x] = e.target.value;
                    })
                  }
                />
              </label>
            ))}
          </>
        )}
      </div>
      <button
        className="catalogue-footer"
        onClick={() => s.set({ modal: "teams" })}
      >
        <span className="live-dot" />
        <span>{catalogue.teams.length} clubs in the catalogue</span>
        <ChevronRight size={13} />
      </button>
    </aside>
  );
}
