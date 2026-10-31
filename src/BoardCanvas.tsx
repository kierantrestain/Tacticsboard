import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import Konva from "konva";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Circle,
  Line,
  Arrow,
  Text,
  Arc,
  Image as CanvasImage,
  Path,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Pause, Play, ImageOff, VolumeX } from "lucide-react";
import { useStudio, channel } from "./store";
import { useRuntime } from "./studio/runtime";
import { homography, invert3, project } from "./studio/geometry";
import { clamp, copy, frameAt, moveDrawing, shortName, uid } from "./core";
import type { Board, BoardPlayer, Drawing, Frame } from "./types";
import { getMedia } from "./media";
import { analysisFrame } from "./studio/tactics";
import { playerNameOffsets } from "./studio/labelLayout";
import { translateGroup } from './studio/teamMovement';
const W = 1200,
  H = 760,
  PX = 65,
  PY = 48,
  PW = 1070,
  PH = 664;
export interface BoardHandle {
  stage: () => Konva.Stage | null;
  video: () => HTMLVideoElement | null;
}
const sx = (x: number) => PX + x * PW,
  sy = (y: number) => PY + y * PH;
function mix(hex: string, white: number) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  return (
    "#" +
    [0, 2, 4]
      .map((i) =>
        Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - white) + 255 * white)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function ink(hex: string) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 180 ? "#14211d" : "#fff";
}
function Pitch({ board }: { board: Board }) {
  const light = board.settings.theme === "light",
    grass = board.settings.theme === "grass";
  const color = light ? "#d1dfd7" : grass ? "#2c7840" : "#285c3d";
  const line = light ? "#4d6962" : "#c4d4cf";
  return (
    <Group listening={false}>
      <Rect
        x={20}
        y={13}
        width={1160}
        height={734}
        cornerRadius={9}
        fill={light ? "#b9cdc5" : grass ? "#1d4e2c" : "#152d23"}
      />
      <Rect x={PX} y={PY} width={PW} height={PH} fill={color} />
      {Array.from({ length: 10 }, (_, i) => (
        <Rect
          key={i}
          x={PX + (i * PW) / 10}
          y={PY}
          width={PW / 10}
          height={PH}
          fill={i % 2 === 0 ? "#ffffff" : "#000000"}
          opacity={grass ? 0.035 : 0.022}
        />
      ))}
      {board.settings.grid &&
        Array.from({ length: 21 }, (_, i) => (
          <Line
            key={"gx" + i}
            points={[sx(i / 20), PY, sx(i / 20), PY + PH]}
            stroke={line}
            opacity={0.12}
            strokeWidth={1}
          />
        ))}
      {board.settings.grid &&
        Array.from({ length: 13 }, (_, i) => (
          <Line
            key={"gy" + i}
            points={[PX, sy(i / 12), PX + PW, sy(i / 12)]}
            stroke={line}
            opacity={0.12}
            strokeWidth={1}
          />
        ))}
      {board.settings.lanes &&
        [0.2, 0.4, 0.6, 0.8].map((n) => (
          <Line
            key={n}
            points={[PX, sy(n), PX + PW, sy(n)]}
            stroke="#63d9ff"
            opacity={0.24}
            strokeWidth={1.5}
            dash={[8, 8]}
          />
        ))}
      <Rect
        x={PX}
        y={PY}
        width={PW}
        height={PH}
        stroke={line}
        opacity={0.68}
        strokeWidth={2}
      />
      <Line
        points={[W / 2, PY, W / 2, PY + PH]}
        stroke={line}
        opacity={0.68}
        strokeWidth={2}
      />
      <Circle
        x={W / 2}
        y={H / 2}
        radius={89}
        stroke={line}
        opacity={0.68}
        strokeWidth={2}
      />
      <Circle x={W / 2} y={H / 2} radius={3} fill={line} />
      {[false, true].map((right) => (
        <Group key={String(right)}>
          <Rect
            x={right ? PX + PW - 165 : PX}
            y={H / 2 - 195}
            width={165}
            height={390}
            stroke={line}
            strokeWidth={2}
            opacity={0.68}
          />
          <Rect
            x={right ? PX + PW - 55 : PX}
            y={H / 2 - 90}
            width={55}
            height={180}
            stroke={line}
            strokeWidth={2}
            opacity={0.68}
          />
          <Circle
            x={right ? PX + PW - 110 : PX + 110}
            y={H / 2}
            radius={3}
            fill={line}
          />
          <Arc
            x={right ? PX + PW - 110 : PX + 110}
            y={H / 2}
            innerRadius={87.5}
            outerRadius={89}
            angle={108}
            rotation={right ? 126 : -54}
            fill={line}
            opacity={0.68}
          />
          <Rect
            x={right ? PX + PW : PX - 22}
            y={H / 2 - 39}
            width={22}
            height={78}
            stroke={line}
            strokeWidth={1.5}
            opacity={0.45}
          />
          {[0, 1, 2, 3].map((j) => (
            <Line
              key={j}
              points={[
                right ? PX + PW : PX - 22,
                H / 2 - 39 + j * 26,
                right ? PX + PW + 22 : PX,
                H / 2 - 39 + j * 26,
              ]}
              stroke={line}
              opacity={0.13}
            />
          ))}
        </Group>
      ))}
      {[
        [PX, PY, 0],
        [PX + PW, PY, 90],
        [PX + PW, PY + PH, 180],
        [PX, PY + PH, 270],
      ].map(([x, y, r], i) => (
        <Arc
          key={i}
          x={x}
          y={y}
          innerRadius={10}
          outerRadius={11.5}
          angle={90}
          rotation={r}
          fill={line}
          opacity={0.6}
        />
      ))}
      <Text
        x={80}
        y={728}
        text="TOUCHLINE  /  TACTICAL REPLAY"
        fontSize={9}
        letterSpacing={2}
        fill={light ? "#718572" : "#6584aa"}
      />
      <Text
        x={1010}
        y={728}
        text="EDITABLE RECONSTRUCTION"
        fontSize={9}
        letterSpacing={1.2}
        fill={light ? "#718572" : "#6584aa"}
      />
    </Group>
  );
}
function Shape({
  drawing,
  interactive,
  onSelect,
  onMove,
  onErase,
  selected,
}: {
  drawing: Drawing;
  interactive: boolean;
  onSelect: () => void;
  onMove: (dx: number, dy: number) => void;
  onErase: () => void;
  selected: boolean;
}) {
  const d = drawing,
    points = d.points.flatMap((n, i) => (i % 2 ? [sy(n)] : [sx(n)])),
    a = { x: points[0] || 0, y: points[1] || 0 },
    b = { x: points[2] ?? a.x, y: points[3] ?? a.y };
  const shapeProps = {
    stroke: d.color,
    strokeWidth: d.width,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    hitStrokeWidth: 18,
    shadowColor: selected ? "#63d9ff" : undefined,
    shadowBlur: selected ? 8 : 0,
  };
  let node;
  switch (d.type) {
    case "arrow":
    case "run":
    case "measure":
      node = (
        <Group>
          <Arrow
            points={points}
            {...shapeProps}
            pointerLength={11}
            pointerWidth={10}
            fill={d.color}
            dash={d.type === "run" ? [10, 8] : undefined}
            tension={d.type === "run" ? 0.25 : 0}
            pointerAtBeginning={d.type === "measure"}
          />
          {d.type === "measure" && (
            <Group x={(a.x + b.x) / 2} y={(a.y + b.y) / 2}>
              <Rect
                x={-43}
                y={-15}
                width={86}
                height={30}
                fill="#09182d"
                cornerRadius={6}
              />
              <Text
                x={-42}
                y={-8}
                width={84}
                text={`${Math.hypot((d.points[2] - d.points[0]) * 105, (d.points[3] - d.points[1]) * 68).toFixed(1)} m*`}
                fill={d.color}
                fontSize={15}
                align="center"
              />
            </Group>
          )}
        </Group>
      );
      break;
    case "pen":
    case "line":
    case "offside":
      node = (
        <Line
          points={points}
          {...shapeProps}
          tension={d.type === "pen" ? 0.35 : 0}
        />
      );
      break;
    case "zone":
      if (points.length >= 8) {
        node = (
          <Line
            points={points}
            closed
            fill={d.color}
            opacity={0.22}
            stroke={d.color}
            strokeWidth={d.width}
          />
        );
        break;
      }
      node = (
        <Rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.max(2, Math.abs(b.x - a.x))}
          height={Math.max(2, Math.abs(b.y - a.y))}
          fill={d.color}
          opacity={0.25}
          stroke={d.color}
          strokeWidth={d.width}
          dash={[9, 5]}
          cornerRadius={3}
        />
      );
      break;
    case "ellipse":
    case "spotlight":
      if (points.length > 4) {
        node = (
          <Line
            points={points}
            closed
            {...shapeProps}
            fill={d.type === "spotlight" ? d.color : undefined}
            opacity={d.type === "spotlight" ? 0.22 : 1}
          />
        );
        break;
      }
      node = (
        <Group>
          <Circle
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2}
            radius={Math.max(8, Math.abs(b.x - a.x) / 2)}
            scaleY={Math.abs(b.y - a.y) / Math.max(16, Math.abs(b.x - a.x))}
            {...shapeProps}
            fill={d.type === "spotlight" ? d.color : undefined}
            opacity={d.type === "spotlight" ? 0.2 : 1}
          />
        </Group>
      );
      break;
    case "triangle":
      node = (
        <Line
          points={points}
          closed
          fill={d.color}
          {...shapeProps}
          opacity={0.3}
        />
      );
      break;
    case "text":
      node = (
        <Group>
          <Rect
            x={a.x - 9}
            y={a.y - 7}
            width={Math.max(60, (d.text || "").length * 11.5)}
            height={36}
            cornerRadius={4}
            fill="#111b16"
            opacity={0.88}
          />
          <Text
            x={a.x}
            y={a.y}
            text={d.text || "Tactical note"}
            fill={d.color}
            fontSize={21}
            fontStyle="bold"
          />
        </Group>
      );
      break;
  }
  return (
    <Group
      opacity={d.opacity}
      draggable={interactive}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDblClick={onErase}
      onDragEnd={(e) => {
        const dx = e.target.x() / PW,
          dy = e.target.y() / PH;
        e.target.position({ x: 0, y: 0 });
        onMove(dx, dy);
      }}
    >
      {node}
    </Group>
  );
}
const BoardCanvas = forwardRef<
  BoardHandle,
  { program?: boolean; externalFrame?: Frame }
>(({ program = false, externalFrame }, ref) => {
  const studio = useStudio();
  const multiSelect = useRuntime(s=>s.multiSelect);
  const {
    board,
    tool,
    color,
    stroke,
    selected,
    selectedShape,
    playing,
    previewTime,
  } = studio;
  const container = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    work = useRef<Konva.Group>(null);
  const [size, setSize] = useState({ width: 1000, height: 633 });
  const [draft, setDraft] = useState<Drawing | null>(null);
  const draftRef = useRef<Drawing | null>(null);
  const drawing = useRef(false);
  useEffect(() => {
    draftRef.current = null;
    drawing.current = false;
    setDraft(null);
  }, [tool, board?.id, board?.activeScene]);
  const drag = useRef<{
    players: BoardPlayer[];
    uids: string[];
    origin: BoardPlayer;
  } | null>(null);
  const [media, setMedia] = useState<
      HTMLImageElement | HTMLVideoElement | null
    >(null),
    [mediaError, setMediaError] = useState(false),
    [videoPlaying, setVideoPlaying] = useState(false),
    [mediaTime, setMediaTime] = useState(0),
    [mediaDuration, setMediaDuration] = useState(0);
  const isVideo = !!media && media instanceof HTMLVideoElement;
  useImperativeHandle(
    ref,
    () => ({
      stage: () => stage.current,
      video: () => (media instanceof HTMLVideoElement ? media : null),
    }),
    [media],
  );
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      const scale = Math.min(w / W, h / H);
      setSize({
        width: Math.floor(W * scale),
        height: Math.floor(H * scale),
      });
    };
    const r = new ResizeObserver(update);
    r.observe(el);
    update();
    return () => r.disconnect();
  }, []);
  useEffect(() => {
    let alive = true,
      url: string | undefined;
    setMedia(null);
    setMediaError(false);
    if (!board?.media) return;
    getMedia(board.media.id)
      .then((blob) => {
        if (!blob) {
          setMediaError(true);
          return;
        }
        url = URL.createObjectURL(blob);
        const el =
          board.media?.type === "video"
            ? document.createElement("video")
            : new window.Image();
        if (el instanceof HTMLVideoElement) {
          el.muted = true;
          el.playsInline = true;
          el.addEventListener("loadeddata", () => {
            if (alive) {
              setMedia(el);
              setMediaDuration(el.duration || 0);
            }
          });
          el.addEventListener("timeupdate", () => setMediaTime(el.currentTime));
          el.addEventListener("ended", () => setVideoPlaying(false));
        } else
          el.onload = () => {
            if (alive) setMedia(el);
          };
        el.onerror = () => setMediaError(true);
        el.src = url;
      })
      .catch(() => setMediaError(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [board?.media?.id]);
  useEffect(() => {
    if (!(media instanceof HTMLVideoElement)) return;
    let id: number;
    const draw = () => {
      stage.current?.batchDraw();
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    const onMessage = (e: MessageEvent) => {
      if (e.data.type === "media" && e.data.id === board?.id) {
        media.currentTime = e.data.time || 0;
        if (e.data.play) media.play().catch(() => {});
        else media.pause();
      }
    };
    if (program) channel?.addEventListener("message", onMessage);
    return () => {
      cancelAnimationFrame(id);
      if (program) channel?.removeEventListener("message", onMessage);
      media.pause();
    };
  }, [media, program, board?.id]);
  if (!board) return <div className="canvas-container" ref={container} />;
  const scale = size.width / W;
  const frame: Frame = analysisFrame(
    board,
    externalFrame ||
      (previewTime !== null ? frameAt(board, previewTime) : board),
  );
  const labelOffsets = playerNameOffsets(
    frame.players.filter((p) =>
      p.side === "home"
        ? board.settings.homeVisible
        : board.settings.awayVisible,
    ),
    board.settings.markerScale || 1,
  );
  const angle = board.settings.camera === "angle";
  let transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    skewX?: number;
  } = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  if (angle)
    transform = { x: 92, y: 82, scaleX: 0.94, scaleY: 0.78, skewX: -0.11 };
  if (board.settings.view !== "full")
    transform = {
      x: board.settings.view === "right" ? -1090 : -22,
      y: -316,
      scaleX: 1.95,
      scaleY: 1.9,
    };
  const pos = () => {
    const p = work.current?.getRelativePointerPosition();
    return p
      ? { x: clamp((p.x - PX) / PW, 0, 1), y: clamp((p.y - PY) / PH, 0, 1) }
      : null;
  };
  const down = (
    e: KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>,
  ) => {
    if (program || playing) return;
    const p = pos();
    if (!p) return;
    if(useRuntime.getState().ballTargetPicking){useRuntime.setState({ballTarget:p,ballTargetPicking:false});return;}
    if (tool === "select") {
      if (e.target === e.target.getStage() || e.target.name() === "board-hit")
        studio.set({ selected: [], selectedShape: null });
      return;
    }
    if (tool === "erase") return;
    if (tool === "text") {
      const d: Drawing = {
        id: uid(),
        type: "text",
        points: [p.x, p.y],
        color,
        width: stroke,
        opacity: 1,
        text: "Tactical note",
      };
      studio.commit((b) => b.drawings.push(d));
      studio.set({
        selectedShape: d.id,
        selected: [],
        inspector: "settings",
        tool: "select",
      });
      return;
    }
    if (tool === "offside") {
      studio.commit((b) =>
        b.drawings.push({
          id: uid(),
          type: "offside",
          points: [p.x, 0, p.x, 1],
          color,
          width: stroke,
          opacity: 1,
        }),
      );
      return;
    }
    if (tool === "triangle") {
      const d = draftRef.current || {
        id: uid(),
        type: "triangle" as const,
        points: [],
        color,
        width: stroke,
        opacity: 1,
      };
      d.points = [...d.points, p.x, p.y];
      if (d.points.length === 6) {
        studio.commit((b) => b.drawings.push(copy(d)));
        draftRef.current = null;
        setDraft(null);
      } else {
        draftRef.current = copy(d);
        setDraft(copy(d));
      }
      return;
    }
    drawing.current = true;
    const d: Drawing = {
      id: uid(),
      type: tool,
      points: [p.x, p.y, p.x, p.y],
      color,
      width: stroke,
      opacity: 1,
    };
    draftRef.current = d;
    setDraft(d);
  };
  const move = () => {
    if (!drawing.current || !draftRef.current) return;
    const p = pos();
    if (!p) return;
    const old = draftRef.current;
    const next = {
      ...old,
      points:
        old.type === "pen"
          ? [...old.points, p.x, p.y]
          : [old.points[0], old.points[1], p.x, p.y],
    };
    draftRef.current = next;
    setDraft(next);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const d = draftRef.current;
    if (d?.type === 'ellipse' && Math.hypot(d.points.at(-2)!-d.points[0],d.points.at(-1)!-d.points[1]) < .006) {
      const [x,y] = d.points; d.points = [clamp(x-.03),clamp(y-.045),clamp(x+.03),clamp(y+.045)];
    }
    if (
      d &&
      d.points.length >= 4 &&
      Math.hypot(
        d.points.at(-2)! - d.points[0],
        d.points.at(-1)! - d.points[1],
      ) > 0.006
    ) {
      studio.commit((b) => b.drawings.push(copy(d)));
      studio.set({ selectedShape: d.id, selected: [] });
    }
    draftRef.current = null;
    setDraft(null);
  };
  const chooseShape = (d: Drawing) => {
    if (tool === "erase") {
      studio.commit((b) => {
        b.drawings = b.drawings.filter((x) => x.id !== d.id);
      });
      return;
    }
    if (tool === "select")
      studio.set({
        selectedShape: d.id,
        selected: [],
        inspector: "settings",
      });
  };
  const allShapes = [...frame.drawings, ...(draft ? [draft] : [])];
  return (
    <div
      className={`canvas-container ${tool !== "select" ? "drawing-cursor" : ""} ${program ? "program-canvas" : ""}`}
      ref={container}
      data-testid="tactics-canvas"
      aria-label={
        program
          ? "Clean television tactics output"
          : "Interactive tactics pitch. Drag a player to reposition them. Choose a drawing tool to annotate."
      }
    >
      <Stage
        ref={stage}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={down}
        onTouchStart={down}
        onMouseMove={move}
        onTouchMove={move}
        onMouseUp={up}
        onTouchEnd={up}
        onMouseLeave={up}
        style={{ touchAction: "none" }}
      >
        <Layer listening={false}>
          <Rect
            width={W}
            height={H}
            fill={board.settings.theme === "light" ? "#d4ded3" : "#0d171c"}
            cornerRadius={10}
          />
          <Group {...transform}>
            <Pitch board={board} />
          </Group>
        </Layer>
        <Layer>
          <Group ref={work} {...transform}>
            <Rect
              name="board-hit"
              x={20}
              y={13}
              width={1160}
              height={734}
              fill="rgba(0,0,0,0.001)"
            />
            {media && board.settings.mediaVisible && (
              <CanvasImage
                image={media}
                x={PX}
                y={PY}
                width={PW}
                height={PH}
                listening={false}
              />
            )}
            {board.settings.trails &&
              board.scenes.length > 1 &&
              board.scenes.slice(1).flatMap((s, i) =>
                s.players.map((p) => {
                  const before = board.scenes[i].players.find(
                    (q) => q.uid === p.uid,
                  );
                  return before ? (
                    <Arrow
                      key={`${s.id}-${p.uid}`}
                      points={[sx(before.x), sy(before.y), sx(p.x), sy(p.y)]}
                      stroke={board.colors[p.side]}
                      fill={board.colors[p.side]}
                      strokeWidth={2}
                      dash={[5, 6]}
                      opacity={0.35}
                      pointerWidth={6}
                      pointerLength={6}
                      listening={false}
                    />
                  ) : null;
                }),
              )}
            {allShapes.map((d) => (
              <Shape
                key={d.id}
                drawing={d}
                selected={!program && selectedShape === d.id}
                interactive={
                  !program &&
                  tool === "select" &&
                  !playing &&
                  !d.id.startsWith("guide:")
                }
                onSelect={() => chooseShape(d)}
                onMove={(dx, dy) =>
                  studio.commit((b) => {
                    b.drawings = b.drawings.map((x) =>
                      x.id === d.id ? moveDrawing(x, dx, dy) : x,
                    );
                  })
                }
                onErase={() => {
                  if (tool === "erase")
                    studio.commit((b) => {
                      b.drawings = b.drawings.filter((x) => x.id !== d.id);
                    });
                }}
              />
            ))}
            {frame.players
              .filter((p) =>
                p.side === "home"
                  ? board.settings.homeVisible
                  : board.settings.awayVisible,
              )
              .map((p) => {
                const c = board.colors[p.side],
                  active = !program && selected.includes(p.uid);
                const name = shortName(p.name);
                return (
                  <Group
                    key={p.uid}
                    name={`player-${p.uid}`}
                    x={sx(p.x)}
                    y={sy(p.y)}
                    scaleX={Math.max(
                      0.7,
                      Math.min(1.6, board.settings.markerScale || 1),
                    )}
                    scaleY={Math.max(
                      0.7,
                      Math.min(1.6, board.settings.markerScale || 1),
                    )}
                    opacity={p.opacity ?? 1}
                    draggable={!program && tool === "select" && !playing && !multiSelect && !useRuntime.getState().ballTargetPicking}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (tool === "select")
                        studio.set({
                          selected: e.evt.shiftKey || multiSelect
                            ? selected.includes(p.uid) ? selected.filter(id=>id!==p.uid) : [...selected,p.uid]
                            : selected.includes(p.uid) ? selected : [p.uid],
                          selectedShape: null,
                          profileId: null,
                          inspector: "players",
                          side: p.side,
                        });
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      if (tool === "select")
                        studio.set({
                          selected: multiSelect ? selected.includes(p.uid) ? selected.filter(id=>id!==p.uid) : [...selected,p.uid] : selected.includes(p.uid) ? selected : [p.uid],
                          selectedShape: null,
                          profileId: null,
                          inspector: "players",
                          side: p.side,
                        });
                    }}
                    onDragStart={() => {
                      const ids = selected.includes(p.uid) ? selected : [p.uid];
                      drag.current = {
                        players: copy(externalFrame?.players || board.players),
                        uids: ids,
                        origin: copy(p),
                      };
                      studio.set({ selected: ids, selectedShape: null });
                      studio.begin();
                    }}
                    onDragMove={(e) => {
                      if (!drag.current) return;
                      const { origin, players, uids } = drag.current;
                      const moved = translateGroup(players.filter(p=>uids.includes(p.uid)),(e.target.x()-PX)/PW-origin.x,(e.target.y()-PY)/PH-origin.y);
                      const anchor = moved.find(q=>q.uid===p.uid)!;
                      e.target.position({x:sx(anchor.x),y:sy(anchor.y)});
                      studio.preview((b) => {
                        const asset = b.studio?.assetId,
                          sequence =
                            asset && externalFrame
                              ? b.studio?.tracking[asset]
                              : undefined;
                        if (sequence?.frames.length) {
                          const time = useRuntime.getState().time;
                          const frame = sequence.frames.reduce((a, f) =>
                            Math.abs(a.time - time) < Math.abs(f.time - time)
                              ? a
                              : f,
                          );
                          const map =
                            frame.map ||
                            homography(b.studio!.landmarks[asset!]);
                          const inverse = map ? invert3(map) : null;
                          for (const id of uids) {
                            const point = frame.points.find(
                                (q) => "reconstructed:" + q.id === id,
                              ),
                              base = moved.find((q) => q.uid === id);
                            if (!point || !base) continue;
                            point.pitch = {
                              x: base.x,
                              y: base.y,
                            };
                            if (inverse)
                              point.image = project(inverse, point.pitch);
                            point.manual = true;
                            point.review = false;
                            point.confidence = 1;
                          }
                          sequence.reviewed = false;
                          return;
                        }
                        b.players = b.players.map((q) => {
                          const base = moved.find((z) => z.uid === q.uid);
                          return uids.includes(q.uid) && base
                            ? {
                                ...q,
                                x: base.x,
                                y: base.y,
                              }
                            : q;
                        });
                      });
                    }}
                    onDragEnd={() => {
                      drag.current = null;
                      studio.end();
                    }}
                  >
                    <Rect
                      x={-31}
                      y={-31}
                      width={62}
                      height={78}
                      fill="rgba(0,0,0,.001)"
                    />
                    {active && (
                      <Circle
                        radius={26}
                        stroke="#63d9ff"
                        strokeWidth={2}
                        opacity={0.95}
                      />
                    )}
                    <Circle
                      y={4}
                      radius={21}
                      fill="#020b07"
                      opacity={0.45}
                      listening={false}
                    />
                    {board.settings.tokenStyle === "shirt" ? (
                      <Path
                        data="M -12 -17 L -27 -8 L -20 3 L -14 0 L -14 21 L 14 21 L 14 0 L 20 3 L 27 -8 L 12 -17 L 6 -12 L -6 -12 Z"
                        fill={c}
                        stroke={mix(c, 0.45)}
                        strokeWidth={1.7}
                      />
                    ) : (
                      <Circle
                        radius={20}
                        fill={c}
                        stroke={mix(c, 0.5)}
                        strokeWidth={1.5}
                      />
                    )}
                    {board.settings.numbers && (
                      <Text
                        x={-23}
                        y={-8}
                        width={46}
                        text={p.number || "•"}
                        fontSize={20}
                        fontStyle="bold"
                        align="center"
                        fill={ink(c)}
                        listening={false}
                      />
                    )}
                    {board.settings.names && (
                      <Group listening={false} y={labelOffsets.get(p.uid) || 0}>
                        <Rect
                          x={-Math.min(63, name.length * 3.8 + 8)}
                          y={28}
                          width={Math.min(126, name.length * 7.6 + 16)}
                          height={21}
                          fill="#091427"
                          cornerRadius={6}
                          opacity={0.88}
                        />
                        <Text
                          x={-63}
                          y={32}
                          width={126}
                          text={
                            name.length > 17 ? name.slice(0, 16) + "…" : name
                          }
                          fontSize={15}
                          align="center"
                          fill="#f0f5ee"
                          fontStyle="bold"
                        />
                      </Group>
                    )}
                  </Group>
                );
              })}
            <Group
              visible={board.settings.ballVisible !== false}
              x={sx(frame.ball.x)}
              y={sy(frame.ball.y)}
              draggable={!program && tool === "select" && !playing && !multiSelect && !useRuntime.getState().ballTargetPicking}
              onDragStart={() => studio.begin()}
              onDragMove={(e) => {
                const x = clamp((e.target.x() - PX) / PW),
                  y = clamp((e.target.y() - PY) / PH);
                e.target.position({ x: sx(x), y: sy(y) });
                studio.preview((b) => {
                  b.ball = { x, y };
                });
              }}
              onDragEnd={() => studio.end()}
            >
              <Circle y={3} radius={11} fill="#000" opacity={0.35} />
              <Circle
                radius={9}
                fill="#f0f3ed"
                stroke="#a1afa5"
                strokeWidth={1}
              />
              <Circle radius={3} fill="#35493d" />
              <Line
                points={[-7, -3, -3, -2, -1, -7]}
                stroke="#35493d"
                strokeWidth={1}
              />
              <Line
                points={[7, 3, 3, 2, 1, 7]}
                stroke="#35493d"
                strokeWidth={1}
              />
            </Group>
          </Group>
        </Layer>
      </Stage>
      {mediaError && !program && (
        <div className="media-warning">
          <ImageOff size={14} />
          This media file is not available in this browser. Reattach it from
          your original file.
        </div>
      )}
      {isVideo && !program && (
        <div className="media-controls">
          <button
            title={
              videoPlaying ? "Pause reference video" : "Play reference video"
            }
            onClick={() => {
              const v = media as HTMLVideoElement;
              if (v.paused) {
                v.play()
                  .then(() => setVideoPlaying(true))
                  .catch(() =>
                    studio.notify(
                      "The video cannot be played in this browser.",
                    ),
                  );
              } else {
                v.pause();
                setVideoPlaying(false);
              }
              channel?.postMessage({
                type: "media",
                id: board.id,
                time: v.currentTime,
                play: !videoPlaying,
              });
            }}
          >
            {videoPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <input
            aria-label="Reference video position"
            type="range"
            min="0"
            max={mediaDuration || 1}
            step=".04"
            value={mediaTime}
            onChange={(e) => {
              const v = media as HTMLVideoElement;
              v.currentTime = Number(e.target.value);
              setMediaTime(v.currentTime);
              channel?.postMessage({
                type: "media",
                id: board.id,
                time: v.currentTime,
                play: videoPlaying,
              });
            }}
          />
          <span>
            {Math.floor(mediaTime / 60)}:
            {String(Math.floor(mediaTime % 60)).padStart(2, "0")}
          </span>
          <VolumeX size={13} />
        </div>
      )}
    </div>
  );
});
export default BoardCanvas;
