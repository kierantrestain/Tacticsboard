import {
  STUDIO_PROTOCOL,
  commandContext,
} from "../../../server/studio-protocol.mjs";
import "./host-operation.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Hand,
  Link2,
  Maximize2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  Tablet,
  Target,
  Trash2,
  Undo2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { connectRoom, studioRequest } from "./connection";
import { roleName } from "./protocol";
import type {
  HostCommand,
  HostState,
  RoomPresence,
  RoomSession,
} from "./protocol";
import HostPitch from "./HostPitch";
import StatisticSurface, { StatisticsNavigation } from "../StatisticSurface";
import { HostCommandQueue } from "./commandQueue";
import BallActionPanel from "../BallActionPanel";
import PlayerControl from "../PlayerControl";
import type { BallActionKind } from "../footballActionTypes";
import type { TouchTool } from "./HostPitch";
import TeamMovementPanel from "../TeamMovementPanel";
import PlaybookPanel from "../PlaybookPanel";

function initialSession(): RoomSession | null {
  try {
    const s = JSON.parse(
      sessionStorage.getItem("touchline.host-session") || "null",
    );
    return ["host1", "host2"].includes(s?.role) ? s : null;
  } catch {
    return null;
  }
}
export default function HostTablet() {
  const [session, setSession] = useState<RoomSession | null>(initialSession),
    [state, setState] = useState<HostState | null>(null),
    [presence, setPresence] = useState<RoomPresence | null>(null),
    [status, setStatus] = useState("connecting"),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [joining, setJoining] = useState(false),
    [tool, setTool] = useState<TouchTool>("move"),
    [selected, setSelected] = useState<string[]>([]),
    [panel, setPanel] = useState<"moments" | "pitch" | "ball" | "plays">(
      "moments",
    );
  const [actionKind, setActionKind] = useState<BallActionKind | null>(null),
    [actionTarget, setActionTarget] = useState<{ x: number; y: number } | null>(
      null,
    ),
    [pickingTarget, setPickingTarget] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [query, setQuery] = useState(""),
    [inspecting, setInspecting] = useState<string | null>(null),
    [feedback, setFeedback] = useState({ seq: 0, status: "", message: "" });
  const clockOffset = useRef(0),
    contextRef = useRef("");
  const seq = useRef(0),
    queue = useRef(new HostCommandQueue()),
    generation = useRef(0),
    current = useRef({ state, presence, status, session });
  current.current = { state, presence, status, session };
  const ownsControl =
    !!session &&
    status === "connected" &&
    !!presence?.connected.producer &&
    presence.armed &&
    presence.owner === session.role &&
    !!state &&
    state.protocol === STUDIO_PROTOCOL;
  const canControl = ownsControl && !state?.busy;
  useEffect(() => {
    if (!session) return;
    let revision = 0;
    return connectRoom(
      session,
      (type, data) => {
        if (type === "welcome") {
          seq.current = Math.max(seq.current, data.seq || 0);
          clockOffset.current = data.time - Date.now();
          if (data.protocol !== STUDIO_PROTOCOL)
            setError(
              "Studio versions differ. Reload this tablet and the producer before filming.",
            );
        }
        if (type === "presence") {
          setPresence(data);
          generation.current++;
          queue.current.clear();
        }
        if (type === "state" && data.revision >= revision) {
          const context = commandContext(data.state);
          if (contextRef.current !== context) {
            contextRef.current = context;
            generation.current++;
            queue.current.clear();
          }
          revision = data.revision;
          setState((old) => ({
            ...data.state,
            previewImage:
              data.state.previewImage ||
              (old?.view === data.state.view ? old?.previewImage : undefined),
            previewAspect:
              data.state.previewAspect ||
              (old?.view === data.state.view ? old?.previewAspect : undefined),
          }));
        }
        if (type === "feedback") {
          setFeedback((old) => (data.seq >= old.seq ? data : old));
          if (data.status === "rejected") setError(data.message);
        }
        if (type === "ended" || type === "replaced") {
          sessionStorage.removeItem("touchline.host-session");
          setError(
            type === "replaced"
              ? "This host slot was opened on another tablet. Pair again to return."
              : "The producer ended this session.",
          );
          setSession(null);
          setState(null);
        }
      },
      (next) => {
        setStatus(next);
        if (next !== "connected") {
          generation.current++;
          queue.current.clear();
        }
        if (next === "ended") {
          sessionStorage.removeItem("touchline.host-session");
          setSession(null);
          setState(null);
          setError(
            "This studio session has ended. Ask the producer for a new code.",
          );
        }
      },
    );
  }, [session?.room, session?.token]);
  useEffect(() => {
    setSelected([]);
    setMultiSelect(false);
  }, [state?.board.id, state?.view]);
  useEffect(() => {
    setSelected((ids) =>
      state?.recordingMove
        ? ids.filter((id) => state.board.players.some((p) => p.uid === id))
        : [],
    );
    setMultiSelect(false);
    setActionKind(null);
    setActionTarget(null);
    setPickingTarget(false);
    setTool(state?.view === "footage" ? "ellipse" : "move");
  }, [state?.board.activeScene, state?.view]);
  useEffect(() => {
    if (!canControl) {
      setMultiSelect(false);
      setSelected([]);
    }
  }, [canControl]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6500);
    return () => clearTimeout(t);
  }, [error]);
  useEffect(() => {
    let lock: any;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible")
          lock = await (navigator as any).wakeLock.request("screen");
      } catch {}
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      void lock?.release();
      document.removeEventListener("visibilitychange", acquire);
    };
  }, []);
  const send = (command: HostCommand) => {
    if (
      !(command.type === "programme" ? ownsControl : canControl) ||
      !state ||
      !session ||
      !presence
    )
      return;
    const epoch = presence.epoch,
      expected = generation.current;
    const envelope = {
      protocol: STUDIO_PROTOCOL,
      context: commandContext(state),
      sentAt: Date.now() + clockOffset.current,
      seq: ++seq.current,
      epoch,
      boardId: state.board.id,
      sceneId: state.board.activeScene,
      command,
    };
    setFeedback({ seq: envelope.seq, status: "pending", message: "Sending…" });
    queue.current.enqueue(
      async () => {
        if (
          current.current.status !== "connected" ||
          generation.current !== expected ||
          current.current.presence?.epoch !== epoch ||
          commandContext(current.current.state) !== envelope.context
        )
          return;
        try {
          await studioRequest(
            "command",
            session,
            envelope,
            AbortSignal.timeout(3500),
          );
        } catch (e) {
          queue.current.clear();
          setFeedback({
            seq: envelope.seq,
            status: "rejected",
            message: "Not applied",
          });
          setError(
            (e as Error).name === "TimeoutError"
              ? "Connection slow. Check the studio before continuing."
              : (e as Error).message,
          );
        }
      },
      command.type === "move"
        ? `move:${epoch}:${command.gesture}`
        : command.type === "seek"
          ? `seek:${epoch}`
          : command.type === "stats-scroll"
            ? `stats-scroll:${epoch}`
            : undefined,
    );
  };
  async function control(data: object) {
    if (!session) return;
    try {
      await studioRequest("control", session, data);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const sleep = () => {
      if (document.visibilityState !== "hidden") return;
      generation.current++;
      queue.current.clear();
      setSelected([]);
      const c = current.current;
      if (c.session && c.presence?.owner === c.session.role)
        void studioRequest("control", c.session, {
          action: "grant",
          to: null,
        }).catch(() => {});
    };
    document.addEventListener("visibilitychange", sleep);
    return () => document.removeEventListener("visibilitychange", sleep);
  }, []);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError("");
    try {
      const result = await studioRequest("join", null, {
        code: code.replace(/\s/g, ""),
      });
      sessionStorage.setItem("touchline.host-session", JSON.stringify(result));
      setSession(result);
      seq.current = 0;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }
  if (!session)
    return (
      <main className="host-pair-screen">
        <div className="host-pair-brand">
          touchline<span>STUDIO / HOST</span>
        </div>
        <form onSubmit={join} className="host-join">
          <div className="host-join-icon">
            <Tablet size={35} />
          </div>
          <h1>Connect tablet</h1>
          <p>Enter the code from Connect tablets.</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            aria-label="Host pairing code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="film-button primary large"
            disabled={joining || code.length !== 6}
          >
            {joining ? "Connecting…" : "Connect tablet"}
            <ArrowRight />
          </button>
          {error && (
            <p role="alert" className="film-alert">
              {error}
            </p>
          )}
          <small>Use the same studio Wi-Fi as the show computer.</small>
        </form>
      </main>
    );
  const b = state?.board,
    cues = b?.studio?.cues || [],
    index = cues.findIndex((c) => c.id === state?.activeCueId),
    cue = cues[index],
    inspected = cues.find((c) => c.id === inspecting) || cue,
    filtered = cues.filter((c) =>
      (
        c.title +
        " " +
        c.segmentTitle +
        " " +
        c.note +
        " " +
        (c.presenterNotes?.[session.role as "host1" | "host2"] || "")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    other = session.role === "host1" ? "host2" : "host1";
  return (
    <main className={`host-app ${canControl ? "host-in-control" : ""}`}>
      <header className="host-header">
        <div className="host-wordmark">
          touchline<span>HOST CONTROL</span>
        </div>
        <div className="host-role">
          <Tablet size={20} />
          <strong>{roleName(session.role)}</strong>
          <span>
            <i />
            {status === "connected" && presence?.connected.producer
              ? canControl
                ? "You have the screen"
                : presence?.owner
                  ? `${roleName(presence.owner)} has the screen`
                  : "Producer holds control"
              : "Reconnecting to studio"}
          </span>
        </div>
        <button
          className="host-handover"
          disabled={
            status !== "connected" ||
            !presence?.connected.producer ||
            !presence?.armed
          }
          onClick={() =>
            void control(
              canControl
                ? {
                    action: "grant",
                    to: presence?.connected[other] ? other : null,
                  }
                : { action: "request" },
            )
          }
        >
          {canControl
            ? `Pass to ${roleName(other)}`
            : presence?.requested === session.role
              ? "Control requested"
              : "Request control"}
          <ArrowRight size={18} />
        </button>
        <button
          className="film-icon host-fullscreen"
          aria-label="Fullscreen host controls"
          onClick={() =>
            document.documentElement
              .requestFullscreen?.()
              .catch(() =>
                setError(
                  "Use Add to Home Screen for a full-screen tablet view.",
                ),
              )
          }
        >
          <Maximize2 size={20} />
        </button>
      </header>
      <div className="host-context">
        <div>
          <span className="film-kicker">
            {state?.view === "stats"
              ? "MATCH INTELLIGENCE"
              : state?.recordingMove
                ? "BUILDING A MOVEMENT"
                : state?.view === "footage"
                  ? "SOURCE ANALYSIS"
                  : "TACTICAL ANALYSIS"}
          </span>
          <h1>{cue?.title || "Waiting for the studio…"}</h1>
          <small className="host-episode-name">
            {b?.title} · v{state?.appVersion || "—"}
          </small>
        </div>
        <span
          className={`host-tv-status ${state?.follow && !state.black ? "live" : ""}`}
        >
          <i />
          {state?.black
            ? "TV blacked out"
            : state?.follow
              ? "Following on TV"
              : "Private preview"}
          <small>
            {state?.outputConnected ? "Output connected" : "No output receiver"}
          </small>
        </span>
      </div>
      <section className="host-main">
        <div className="host-canvas-column">
          <fieldset
            className="host-view-switch"
            aria-label="Host analysis view"
            disabled={!canControl || !!state?.recordingMove}
          >
            {(["board", "footage", "split", "replay", "stats"] as const).map(
              (view) => (
                <button
                  key={view}
                  aria-pressed={state?.view === view}
                  disabled={
                    !(state?.availableViews || ["board"]).includes(view)
                  }
                  onClick={() => send({ type: "view", view })}
                >
                  {
                    {
                      board: "Tactical board",
                      footage: "Footage",
                      split: "Compare",
                      replay: "3D replay",
                      stats: "Match graphic",
                    }[view]
                  }
                </button>
              ),
            )}
          </fieldset>
          <div className="host-stage">
            {!state || !b ? (
              <div className="host-wait">
                <Wifi size={32} />
                <h2>Waiting for the show computer</h2>
                <p>Your analysis appears here when the producer is ready.</p>
              </div>
            ) : state.view === "board" || state.view === "footage" ? (
              <HostPitch
                board={b}
                frame={state.frame}
                tool={tool}
                selected={selected}
                setSelected={setSelected}
                send={send}
                disabled={!canControl || state.playing}
                image={state.previewImage}
                footage={state.view === "footage"}
                aspect={state.previewAspect}
                ink={state.visibleInk}
                pickingTarget={pickingTarget}
                multiSelect={multiSelect}
                preserveSelection={!!state.recordingMove}
                onTarget={(p) => {
                  setActionTarget(p);
                  setPickingTarget(false);
                }}
              />
            ) : (
              <div className="host-preview-image">
                {state.previewImage ? (
                  state.view === "stats" && state.statsViewport ? (
                    <StatisticSurface
                      info={state.statsViewport}
                      onScroll={
                        canControl
                          ? (value) => send({ type: "stats-scroll", value })
                          : undefined
                      }
                    >
                      <img
                        src={state.previewImage}
                        alt="Current analysis preview"
                      />
                    </StatisticSurface>
                  ) : (
                    <img
                      src={state.previewImage}
                      alt="Current analysis preview"
                    />
                  )
                ) : (
                  <span>Waiting for preview…</span>
                )}
              </div>
            )}
            {status !== "connected" && (
              <div className="host-disconnected">
                <WifiOff />
                <strong>Connection interrupted</strong>
                <span>Controls are held. Reconnecting automatically.</span>
              </div>
            )}
          </div>
          {state?.view === "stats" && state.statsViewport && (
            <StatisticsNavigation
              info={state.statsViewport}
              disabled={!canControl}
              onScroll={(value) => send({ type: "stats-scroll", value })}
            />
          )}
          <fieldset
            className="host-programme-controls"
            disabled={!ownsControl}
            aria-label="Host TV output controls"
          >
            <button
              onClick={() => send({ type: "programme", action: "take" })}
              disabled={!!state?.busy || state?.black}
            >
              Take to TV
            </button>
            <button onClick={() => send({ type: "programme", action: "hold" })}>
              Hold TV
            </button>
            <button
              aria-pressed={state?.follow || false}
              disabled={!!state?.busy || state?.black}
              onClick={() =>
                send({
                  type: "programme",
                  action: state?.follow ? "hold" : "follow",
                })
              }
            >
              Live follow
            </button>
            <button
              onClick={() =>
                send({
                  type: "programme",
                  action: state?.black ? "restore" : "blackout",
                })
              }
            >
              {state?.black ? "Restore held TV" : "Blackout"}
            </button>
          </fieldset>
          <div className="host-command-status" role="status">
            {feedback.status === "pending"
              ? "Action pending"
              : feedback.status === "rejected"
                ? "Action rejected"
                : feedback.status === "applied"
                  ? "Action applied"
                  : ""}
            <span>TV: {state?.outputTitle || "No shot taken"}</span>
          </div>
          {state?.view !== "stats" && (
            <div className="host-touch-hint">
              <span>
                {state?.recordingMove
                  ? "Drag players to where they finish, then tap Done."
                  : tool === "move"
                    ? selected.length
                      ? `${selected.length} selected · drag together, or tap a destination`
                      : "Tap a player to select. Drag to move."
                    : tool === "ellipse"
                      ? "Tap a player to circle them, or drag around an area."
                      : tool === "erase"
                        ? "Tap a mark to remove it."
                        : "Draw directly on the screen."}
              </span>
              {selected.length > 0 && (
                <button onClick={() => setSelected([])}>
                  Deselect
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {(state?.view === "board" || state?.view === "footage") && (
            <fieldset
              className="host-tools"
              disabled={!canControl || !!state?.playing}
              aria-label="Touch drawing tools"
            >
              {(
                [
                  ["move", "Move", Hand],
                  ["pen", "Draw", Pencil],
                  ["arrow", "Arrow", ArrowUpRight],
                  ["run", "Run", ArrowRight],
                  ["ellipse", "Circle", Circle],
                  ["zone", "Space", Square],
                  ["erase", "Erase", Eraser],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  aria-pressed={tool === value}
                  onClick={() => setTool(value)}
                >
                  <Icon size={23} />
                  <span>{label}</span>
                </button>
              ))}
              {state?.view === "board" && (
                <>
                  <button
                    onClick={() => {
                      setPanel("ball");
                      setActionKind("pass");
                      setTool("move");
                      setMultiSelect(false);
                    }}
                  >
                    <ArrowUpRight size={23} />
                    <span>Pass</span>
                  </button>
                  <button
                    onClick={() => {
                      setPanel("ball");
                      setActionKind("shot");
                      setTool("move");
                      setMultiSelect(false);
                    }}
                  >
                    <Target size={23} />
                    <span>Shoot</span>
                  </button>
                </>
              )}
              <i />
              <button
                disabled={!state?.canUndo}
                onClick={() => send({ type: "undo" })}
              >
                <Undo2 size={23} />
                <span>Undo</span>
              </button>
              <button onClick={() => send({ type: "clear" })}>
                <Trash2 size={22} />
                <span>Clear marks</span>
              </button>
            </fieldset>
          )}
          {!!selected.length && state?.view === "board" && (
            <fieldset className="host-selection-actions" disabled={!canControl}>
              <button
                onClick={() => send({ type: "highlight", ids: selected })}
              >
                <Circle size={17} />
                Highlight
              </button>
              <button
                disabled={selected.length < 2}
                onClick={() => send({ type: "link", ids: selected })}
              >
                <Link2 size={17} />
                Connect players
              </button>
              <button
                onClick={() =>
                  send({
                    type: "focus",
                    id: b?.settings.focusPlayer ? null : selected[0],
                  })
                }
              >
                <Target size={17} />
                {b?.settings.focusPlayer ? "Show everyone" : "Focus player"}
              </button>
            </fieldset>
          )}
          {state?.view !== "stats" && (
            <fieldset
              className="host-transport"
              disabled={
                !canControl ||
                !!state?.recordingMove ||
                (state?.view === "footage" && state.mediaType === "image")
              }
            >
              <button
                className="host-replay"
                onClick={() => send({ type: "restart" })}
                aria-label="Replay from start"
              >
                <RotateCcw size={22} />
              </button>
              <button
                className="host-play"
                onClick={() => send({ type: "play" })}
              >
                {state?.playing ? <Pause size={24} /> : <Play size={24} />}
                <span>{state?.playing ? "Pause" : "Play"}</span>
              </button>
              <input
                type="range"
                min={state?.view === "footage" ? b?.studio?.trim.start || 0 : 0}
                max={state?.duration || 1}
                step={0.04}
                value={state?.time || 0}
                aria-label="Host analysis position"
                onChange={(e) => send({ type: "seek", time: +e.target.value })}
              />
              <select
                aria-label="Host replay speed"
                value={state?.rate || 1}
                onChange={(e) => send({ type: "rate", value: +e.target.value })}
              >
                {[0.25, 0.5, 1].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
              <time>
                {(state?.time || 0).toFixed(1)}
                <small> / {(state?.duration || 0).toFixed(1)}s</small>
              </time>
            </fieldset>
          )}
          {state?.view === "footage" && state.mediaType === "video" && (
            <fieldset className="host-video-controls" disabled={!canControl}>
              <div
                className="host-video-speed"
                aria-label="Video playback speed"
              >
                {[0.25, 0.5, 1].map((rate) => (
                  <button
                    key={rate}
                    aria-pressed={(state.rate || 1) === rate}
                    onClick={() => send({ type: "rate", value: rate })}
                  >
                    {rate === 1 ? "Normal" : `${rate}×`}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  send({ type: "freeze" });
                  setTool("ellipse");
                }}
              >
                Freeze & draw
              </button>
              <button
                aria-pressed={state.loop}
                onClick={() => send({ type: "loop", enabled: !state.loop })}
              >
                Loop clip
              </button>
              <button
                className="host-explain-button"
                onClick={() => {
                  send({ type: "pause-explain" });
                  setTool("ellipse");
                }}
              >
                Add 3s explanation pause
              </button>
              <span>Pause, then tap the players to circle them.</span>
            </fieldset>
          )}
          {state?.view === "board" && (
            <fieldset
              className="host-sequence"
              disabled={!canControl || state.recordingMove}
            >
              {b?.scenes.map((scene, i) => (
                <button
                  key={scene.id}
                  className={scene.id === b.activeScene ? "selected" : ""}
                  onClick={() => send({ type: "scene", id: scene.id })}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {scene.title}
                  <small>{scene.duration}s</small>
                </button>
              ))}
            </fieldset>
          )}
        </div>
        <aside className="host-sidebar">
          <div className="host-panel-tabs">
            {(
              [
                ["plays", "Plays"],
                ["pitch", "Move"],
                ["ball", "Ball"],
                ["moments", "Show"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={panel === value ? "selected" : ""}
                aria-pressed={panel === value}
                onClick={() => setPanel(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {panel === "plays" ? (
            b && (
              <div className="host-playbook">
                <PlaybookPanel
                  key={b.id}
                  board={b}
                  send={send}
                  disabled={
                    !canControl || !!state?.playing || state?.view !== "board"
                  }
                  recording={!!state?.recordingMove}
                />
              </div>
            )
          ) : panel === "ball" ? (
            b && (
              <>
                <PlayerControl
                  board={b}
                  selected={selected}
                  send={send}
                  disabled={!canControl || !!state?.playing}
                />
                <BallActionPanel
                  board={b}
                  selected={selected}
                  kind={actionKind}
                  setKind={(kind) => {
                    setActionKind(kind);
                    setActionTarget(null);
                  }}
                  target={actionTarget}
                  picking={pickingTarget}
                  onPick={() => {
                    setTool("move");
                    setPickingTarget(true);
                  }}
                  onCancelPick={() => setPickingTarget(false)}
                  onAdd={(action) => send({ type: "ball-action", action })}
                  disabled={
                    !canControl ||
                    !!state?.playing ||
                    !!state?.recordingMove ||
                    state?.view !== "board"
                  }
                />
              </>
            )
          ) : panel === "moments" ? (
            <>
              <label className="host-search">
                Find a moment
                <input
                  aria-label="Search show moments"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Match, player or topic…"
                />
              </label>
              <div className="host-cue-list">
                {filtered.length ? (
                  filtered.map((c) => (
                    <div className="host-cue-row" key={c.id}>
                      <button
                        aria-pressed={c.id === inspected?.id}
                        className={
                          c.id === state?.activeCueId ? "selected" : ""
                        }
                        onClick={() => setInspecting(c.id)}
                      >
                        <span>
                          {String(cues.indexOf(c) + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{c.title}</strong>
                          <small>
                            {c.view === "footage"
                              ? "Footage"
                              : c.view === "split"
                                ? "Comparison"
                                : c.view === "stats"
                                  ? "Data"
                                  : "Tactics"}{" "}
                            · {c.duration}s
                          </small>
                        </div>
                      </button>
                      <button
                        className="host-recall"
                        aria-label={`Recall ${c.title} to preview`}
                        disabled={!canControl || state?.recordingMove}
                        onClick={() => send({ type: "cue", id: c.id })}
                      >
                        Recall
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="host-empty">
                    {query ? "No matching moments" : "No saved moments"}
                  </div>
                )}
              </div>
              <div className="host-notes">
                <span className="film-kicker">
                  PRIVATE BROWSE · {inspected?.title || "SELECT A MOMENT"}
                </span>
                <p>
                  {inspected?.presenterNotes?.[
                    session.role as "host1" | "host2"
                  ] || "No private note for this host."}
                </p>
                {inspected?.note && (
                  <details>
                    <summary>Shared presenter script</summary>
                    <p>{inspected.note}</p>
                  </details>
                )}
                <small>Browsing notes does not change preview or TV.</small>
              </div>
              <fieldset
                className="host-next"
                disabled={!canControl || !!state?.recordingMove}
              >
                <button
                  disabled={index <= 0}
                  onClick={() => send({ type: "cue", id: cues[index - 1].id })}
                >
                  <ChevronLeft />
                  Back
                </button>
                <button
                  disabled={index >= cues.length - 1}
                  onClick={() => send({ type: "cue", id: cues[index + 1]?.id })}
                >
                  Next moment
                  <ChevronRight />
                </button>
              </fieldset>
            </>
          ) : (
            <fieldset
              className="host-pitch-controls"
              disabled={!canControl || state?.view !== "board"}
            >
              {b && (
                <TeamMovementPanel
                  key={b.id}
                  board={b}
                  selected={selected}
                  onSelect={(ids) => {
                    setSelected(ids);
                    setTool("move");
                    setPickingTarget(false);
                  }}
                  multiSelect={multiSelect}
                  onMultiSelect={(enabled) => {
                    setMultiSelect(enabled);
                    setTool("move");
                    setPickingTarget(false);
                  }}
                  send={send}
                  disabled={!canControl || !!state?.playing}
                  recording={!!state?.recordingMove}
                />
              )}
              <details className="host-display-options">
                <summary>Pitch & display options</summary>
                <span className="film-kicker">FRAME THE PITCH</span>
                <div className="host-segment">
                  {(["full", "left", "right"] as const).map((view) => (
                    <button
                      key={view}
                      aria-pressed={b?.settings.view === view}
                      onClick={() => send({ type: "pitch", view })}
                    >
                      {view === "full"
                        ? "Full pitch"
                        : view === "left"
                          ? "Left half"
                          : "Right half"}
                    </button>
                  ))}
                </div>
                {(
                  [
                    "names",
                    "numbers",
                    "ballVisible",
                    "lanes",
                    "thirds",
                  ] as const
                ).map((key) => (
                  <button
                    className="host-toggle"
                    key={key}
                    aria-pressed={
                      b?.settings[key] !== false && !!b?.settings[key]
                    }
                    onClick={() =>
                      send({
                        type: "setting",
                        key,
                        value: !(b?.settings[key] ?? key === "ballVisible"),
                      })
                    }
                  >
                    {
                      {
                        names: "Player names",
                        numbers: "Shirt numbers",
                        ballVisible: "Ball",
                        lanes: "Passing lanes",
                        thirds: "Pitch thirds",
                      }[key]
                    }
                    <span>
                      {(b?.settings[key] ?? key === "ballVisible")
                        ? "On"
                        : "Off"}
                    </span>
                  </button>
                ))}
              </details>
            </fieldset>
          )}
          <fieldset className="host-make-actions" disabled={!canControl}>
            {state?.recordingMove ? (
              <>
                <strong>Move the players to their finish.</strong>
                <button
                  className="film-button primary"
                  onClick={() => send({ type: "finish-move" })}
                >
                  <Check size={21} />
                  Done · save move
                </button>
                <button
                  className="film-text-button"
                  onClick={() => send({ type: "cancel-move" })}
                >
                  Cancel move
                </button>
              </>
            ) : (
              <>
                <button
                  className="film-button primary"
                  disabled={state?.view !== "board"}
                  onClick={() => {
                    setTool("move");
                    send({ type: "start-move" });
                  }}
                >
                  <Plus size={21} />
                  Add move
                </button>
                <button
                  className="film-button"
                  onClick={() =>
                    send({
                      type: state?.activeCueId ? "update-shot" : "save-shot",
                    })
                  }
                >
                  {state?.activeCueId ? "Update moment" : "Save moment"}
                  <Check size={19} />
                </button>
                {state?.activeCueId && (
                  <button
                    className="film-text-button"
                    onClick={() => send({ type: "save-shot" })}
                  >
                    Save new copy
                  </button>
                )}
              </>
            )}
          </fieldset>
        </aside>
      </section>
      <footer className="host-footer">
        <span>
          <Wifi size={13} />
          STUDIO LINK · {status === "connected" ? "CONNECTED" : "RECONNECTING"}
        </span>
        <button
          onClick={() => {
            sessionStorage.removeItem("touchline.host-session");
            setSession(null);
            setState(null);
          }}
        >
          Leave session
        </button>
      </footer>
      {presence?.requested && canControl && (
        <div className="host-request" role="status">
          <Hand size={20} />
          {roleName(presence.requested)} would like the screen.
          <button
            onClick={() =>
              void control({ action: "grant", to: presence.requested })
            }
          >
            Hand over
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {error && (
        <div className="host-toast" role="alert">
          {error}
          <button
            aria-label="Dismiss host message"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </main>
  );
}
