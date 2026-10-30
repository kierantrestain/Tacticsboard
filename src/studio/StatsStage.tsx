import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BarChart3, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useStudio } from "../store";
import { useRuntime, editDesk } from "./runtime";
import { loadReport } from "../football/data";
import { statCardRows } from "../football/reportTools";
import { defaultBroadcast, emptyStudio } from "./types";
import type { Board, Match, MatchDetails } from "../types";
import type { MatchStats } from "./types";
export function statsCanvas(
  board: Board,
  report?: MatchStats,
  playerId?: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const c = canvas.getContext("2d")!;
  const accent = board.studio?.broadcast?.accent || "#c5f06a";
  const text = (
    value: string,
    x: number,
    y: number,
    width: number,
    font: string,
    color = "#eef4e6",
    align: CanvasTextAlign = "left",
  ) => {
    c.font = font;
    c.fillStyle = color;
    c.textAlign = align;
    let v = value;
    while (v.length > 1 && c.measureText(v).width > width) v = v.slice(0, -1);
    c.fillText(v === value ? v : v.slice(0, -1) + "…", x, y);
  };
  c.fillStyle = "#101b2b";
  c.fillRect(0, 0, 1600, 900);
  c.fillStyle = accent;
  c.fillRect(50, 50, 5, 48);
  if (!report) {
    text(
      "Open a match to build a data card.",
      90,
      470,
      1400,
      '600 40px "Inter Variable",Arial',
    );
    return canvas;
  }
  const player = playerId
    ? report.lineups.flatMap((l) => l.players).find((p) => p.id === playerId)
    : undefined;
  text(
    player ? "PLAYER / MATCH PERFORMANCE" : "MATCH / THE NUMBERS",
    80,
    70,
    1440,
    '600 17px "Inter Variable",Arial',
    accent,
  );
  text(
    player?.name ||
      `${board.context?.home.shortName || board.match?.homeName || "Home"}  v  ${board.context?.away.shortName || board.match?.awayName || "Away"}`,
    80,
    131,
    1440,
    '700 42px "Manrope Variable",Arial',
  );
  const allRows = statCardRows(report, playerId, board.match);
  const rows = (
    board.studio?.statsFields
      ? allRows.filter((row) => board.studio!.statsFields!.includes(row.key))
      : allRows
  ).slice(0, 8);
  if (!player) {
    text(
      board.context?.home.shortName || "HOME",
      360,
      200,
      500,
      '600 22px "Inter Variable",Arial',
      board.colors.home,
      "center",
    );
    text(
      board.context?.away.shortName || "AWAY",
      1240,
      200,
      500,
      '600 22px "Inter Variable",Arial',
      board.colors.away,
      "center",
    );
  }
  rows.forEach((row, i) => {
    const rowHeight = player
      ? Math.min(180, 570 / Math.ceil(rows.length / 2))
      : Math.min(94, 550 / rows.length);
    const top = player
      ? 215 + Math.floor(i / 2) * rowHeight
      : 230 + i * rowHeight;
    c.fillStyle = i % 2 ? "#ffffff03" : "#ffffff07";
    if (player) {
      const x = i % 2 ? 825 : 80;
      c.fillRect(x, top, 695, rowHeight - 10);
      text(
        row.label,
        x + 23,
        top + 30,
        640,
        '500 17px "Inter Variable",Arial',
        "#a3b99b",
      );
      text(
        row.home,
        x + 23,
        top + Math.min(rowHeight - 30, 104),
        640,
        '650 42px "Inter Variable",Arial',
      );
    } else {
      c.fillRect(80, top, 1440, rowHeight - 5);
      text(
        row.home,
        360,
        top + rowHeight / 2 + 9,
        440,
        '650 29px "Inter Variable",Arial',
        "#edf5e5",
        "center",
      );
      text(
        row.label,
        800,
        top + rowHeight / 2 + 7,
        400,
        '500 19px "Inter Variable",Arial',
        "#b3c7a9",
        "center",
      );
      text(
        row.away,
        1240,
        top + rowHeight / 2 + 9,
        440,
        '650 29px "Inter Variable",Arial',
        "#edf5e5",
        "center",
      );
    }
  });
  if (!rows.length)
    text(
      "No individual statistics were supplied for this selection.",
      80,
      400,
      1440,
      '500 28px "Inter Variable",Arial',
      "#a3b99b",
    );
  text(
    `Match report · ${board.match?.date?.slice(0, 10) || "Source snapshot"} · — means not supplied`,
    80,
    850,
    1440,
    '500 17px "Inter Variable",Arial',
    "#8ca580",
  );
  return canvas;
}
export async function presentMatchData(match: Match, playerId?: string) {
  const s = useStudio.getState();
  if (s.board?.match?.id !== match.id) await s.loadMatch(match);
  const projectId = useStudio.getState().board?.id;
  const report = await loadReport(match);
  if (
    useStudio.getState().board?.id !== projectId ||
    useStudio.getState().board?.match?.id !== match.id
  )
    return;
  s.commit((b) => {
    b.studio ||= emptyStudio();
    (b.studio.dataReports ||= {})[match.id] = {
      id: report.id,
      lineups: report.lineups,
      teamStats: report.teamStats,
      updatedAt: report.updatedAt,
      sourceUrl: report.sourceUrl,
    };
    b.studio.statsReportId = match.id;
    b.studio.statsPlayerId = playerId;
    b.studio.statsSnapshot = undefined;
    b.studio.statsFields = undefined;
    const player = playerId
      ? report.lineups.flatMap((l) => l.players).find((p) => p.id === playerId)
      : undefined;
    b.studio.broadcast = {
      ...defaultBroadcast(),
      ...b.studio.broadcast,
      headline: player
        ? `${player.name} · match performance`
        : `${b.context?.home.shortName || match.homeName} v ${b.context?.away.shortName || match.awayName} · match numbers`,
    };
    b.studio.view = "stats";
  });
  s.set({ modal: null, playing: false, previewTime: null });
  useRuntime.setState({ view: "stats", mediaPlaying: false });
}
export interface StatsHandle {
  capture: () => HTMLCanvasElement;
}
const StatsStage = forwardRef<
  StatsHandle,
  { board?: Board; report?: MatchStats; program?: boolean }
>(({ board: external, report: provided, program = false }, ref) => {
  const s = useStudio(),
    b = external || s.board!,
    desk = b.studio || emptyStudio(),
    report =
      provided ||
      desk.statsSnapshot ||
      (desk.statsReportId ? desk.dataReports?.[desk.statsReportId] : undefined),
    playerId = desk.statsPlayerId,
    canvasRef = useRef<HTMLCanvasElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const capture = () => statsCanvas(b, report, playerId);
  useImperativeHandle(ref, () => ({ capture }), [b, report, playerId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raw = capture();
    canvas.width = raw.width;
    canvas.height = raw.height;
    canvas.getContext("2d")!.drawImage(raw, 0, 0);
  }, [b, report, playerId]);
  return (
    <div className="ts-stats-stage" data-testid="stats-stage">
      {!program && (
        <div className="ts-data-tools">
          <BarChart3 size={15} />
          {!report && (
            <button onClick={() => s.set({ modal: "matches" })}>
              Choose a match report
            </button>
          )}
          <select
            aria-label="TV data card selection"
            value={playerId || ""}
            onChange={(e) =>
              editDesk((d) => {
                d.statsPlayerId = e.target.value || undefined;
                d.statsFields = undefined;
              })
            }
          >
            <option value="">Team comparison</option>
            {report?.lineups
              .flatMap((l) => l.players)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} · {p.name}
                </option>
              ))}
          </select>
          {report && (
            <details className="director-metrics">
              <summary>
                <SlidersHorizontal size={14} /> Choose metrics
              </summary>
              <div>
                <strong>Card metrics · up to 8</strong>
                <p>Keep the card focused on the point you are making.</p>
                {statCardRows(report, playerId, b.match).map((row, i) => {
                  const chosen =
                      desk.statsFields ||
                      statCardRows(report, playerId, b.match)
                        .slice(0, 8)
                        .map((r) => r.key),
                    checked = chosen.includes(row.key);
                  return (
                    <label key={row.key}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && chosen.length >= 8}
                        onChange={() =>
                          editDesk((d) => {
                            d.statsFields = checked
                              ? chosen.filter((k) => k !== row.key)
                              : [...chosen, row.key];
                          })
                        }
                      />
                      <span>{row.label}</span>
                    </label>
                  );
                })}
                <button
                  onClick={() =>
                    editDesk((d) => {
                      d.statsFields = undefined;
                    })
                  }
                >
                  Reset selection
                </button>
              </div>
            </details>
          )}
          {desk.statsSnapshot && (
            <span className="director-frozen-data">Saved report snapshot</span>
          )}
          <button
            disabled={!b.match || busy}
            onClick={async () => {
              if (!b.match) return;
              setBusy(true);
              setError("");
              try {
                const report = await loadReport(b.match, true);
                editDesk((d) => {
                  d.statsSnapshot = undefined;
                  (d.dataReports ||= {})[b.match!.id] = {
                    id: report.id,
                    lineups: report.lineups,
                    teamStats: report.teamStats,
                    updatedAt: report.updatedAt,
                    sourceUrl: report.sourceUrl,
                  };
                });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "The report could not refresh.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={13} className={busy ? "spin" : ""} />
            Refresh
          </button>
        </div>
      )}
      {error && !program && <p role="alert">{error}</p>}
      <canvas
        ref={canvasRef}
        aria-label={
          playerId
            ? "Player match statistics card"
            : "Team match statistics comparison"
        }
      />
      {!report && !program && (
        <button
          className="tl-primary"
          onClick={() => s.set({ modal: "matches" })}
        >
          Choose a match
        </button>
      )}
    </div>
  );
});
export default StatsStage;
