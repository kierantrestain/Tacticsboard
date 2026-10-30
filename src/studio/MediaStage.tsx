import { imageInk } from "./inkGeometry";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Stage,
  Layer,
  Group,
  Image as KImage,
  Rect,
  Text,
  Circle,
  Line,
  Arrow,
  Ellipse,
} from "react-konva";
import type Konva from "konva";
import type { Board, Drawing } from "../types";
import { useStudio } from "../store";
import { uid } from "../core";
import { getMedia } from "./assetStore";
import { editDesk, useRuntime } from "./runtime";
import type { MediaAsset, MediaInk, SourceHandle, Point } from "./types";
import { emptyStudio } from "./types";
import { homography, invert3, project, sampleTracking } from "./geometry";
const INK = [
  "arrow",
  "run",
  "line",
  "pen",
  "zone",
  "ellipse",
  "triangle",
  "spotlight",
  "text",
  "measure",
  "offside",
];
function Ink({
  d,
  w,
  h,
  selected,
  onSelect,
  onMove,
  distance,
}: {
  d: Drawing;
  w: number;
  h: number;
  selected: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  distance?: string;
}) {
  const points = d.points.map((p, i) => p * (i % 2 ? h : w)),
    x = points[0],
    y = points[1],
    x2 = points[2] ?? x,
    y2 = points[3] ?? y;
  const common = {
    stroke: d.color,
    strokeWidth: d.width + 1,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    hitStrokeWidth: 18,
    shadowColor: selected ? d.color : undefined,
    shadowBlur: selected ? 12 : 0,
  };
  let node;
  switch (d.type) {
    case "arrow":
    case "run":
    case "measure":
      node = (
        <>
          <Arrow
            points={points}
            {...common}
            fill={d.color}
            dash={d.type === "run" ? [14, 9] : undefined}
            pointerAtBeginning={d.type === "measure"}
            pointerLength={14}
            pointerWidth={12}
          />
          {d.type === "measure" && (
            <Group x={(x + x2) / 2} y={(y + y2) / 2}>
              <Rect
                x={-48}
                y={-18}
                width={96}
                height={34}
                fill="#0c1425"
                cornerRadius={8}
              />
              <Text
                x={-45}
                y={-11}
                width={90}
                align="center"
                text={distance || "CALIBRATE"}
                fill={d.color}
                fontSize={17}
                fontStyle="bold"
              />
            </Group>
          )}
        </>
      );
      break;
    case "line":
    case "pen":
    case "offside":
      node = (
        <Line
          points={points}
          {...common}
          dash={d.type === "offside" ? [12, 7] : undefined}
          tension={d.type === "pen" ? 0.3 : 0}
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
            strokeWidth={2}
          />
        );
        break;
      }
      node = (
        <Rect
          x={Math.min(x, x2)}
          y={Math.min(y, y2)}
          width={Math.max(2, Math.abs(x2 - x))}
          height={Math.max(2, Math.abs(y2 - y))}
          fill={d.color}
          opacity={0.23}
          stroke={d.color}
          strokeWidth={2}
          cornerRadius={6}
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
            {...common}
            fill={d.type === "spotlight" ? d.color : undefined}
            opacity={d.type === "spotlight" ? 0.25 : 1}
          />
        );
        break;
      }
      node = (
        <Ellipse
          x={(x + x2) / 2}
          y={(y + y2) / 2}
          radiusX={Math.max(8, Math.abs(x2 - x) / 2)}
          radiusY={Math.max(8, Math.abs(y2 - y) / 2)}
          {...common}
          fill={d.type === "spotlight" ? d.color : undefined}
          opacity={d.type === "spotlight" ? 0.3 : 1}
        />
      );
      break;
    case "triangle":
      node = (
        <Line points={points} closed fill={d.color} opacity={0.3} {...common} />
      );
      break;
    case "text":
      node = (
        <>
          <Rect
            x={x - 12}
            y={y - 10}
            width={Math.min(700, (d.text || "Tactical note").length * 14 + 32)}
            height={48}
            fill="#09111ee8"
            cornerRadius={9}
          />
          <Text
            x={x + 2}
            y={y + 1}
            text={d.text || "Tactical note"}
            fontSize={24}
            fontStyle="bold"
            fill={d.color}
          />
        </>
      );
      break;
  }
  return (
    <Group
      opacity={d.opacity}
      draggable={!!onMove}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onDragEnd={(e) => {
        const dx = e.target.x() / w,
          dy = e.target.y() / h;
        e.target.position({ x: 0, y: 0 });
        onMove?.(dx, dy);
      }}
    >
      {node}
    </Group>
  );
}
const MediaStage = forwardRef<
  SourceHandle,
  {
    asset?: MediaAsset;
    onImport?: () => void;
    board?: Board;
    program?: boolean;
    time?: number;
    playing?: boolean;
    rate?: number;
  }
>(
  (
    {
      asset,
      onImport,
      board: provided,
      program = false,
      time: givenTime,
      playing: givenPlaying,
      rate: givenRate,
    },
    ref,
  ) => {
    const s = useStudio(),
      r = useRuntime(),
      board = provided || s.board,
      desk = board?.studio || emptyStudio();
    const time = givenTime ?? r.time,
      playing = givenPlaying ?? r.mediaPlaying,
      rate = givenRate ?? r.rate;
    const holder = useRef<HTMLDivElement>(null),
      stage = useRef<Konva.Stage>(null),
      work = useRef<Konva.Group>(null);
    const [size, setSize] = useState({ width: 960, height: 540 }),
      [element, setElement] = useState<
        HTMLVideoElement | HTMLImageElement | null
      >(null),
      [error, setError] = useState("");
    const [draft, setDraft] = useState<MediaInk | null>(null),
      draftRef = useRef<MediaInk | null>(null);
    const drawing = useRef(false),
      pinch = useRef(0);
    const w = 1280,
      h = asset ? (1280 * asset.height) / asset.width : 720,
      scale = Math.min(size.width / w, size.height / h);
    const video = element instanceof HTMLVideoElement ? element : null;
    const capture = () => {
      if (!element) return null;
      const c = document.createElement("canvas");
      c.width = asset?.width || 1280;
      c.height = asset?.height || 720;
      try {
        c.getContext("2d")!.drawImage(element, 0, 0, c.width, c.height);
        return c;
      } catch {
        return null;
      }
    };
    const seek = async (t: number) => {
      if (!video) {
        if (!program) r.set({ time: t });
        return;
      }
      const target = Math.max(0, Math.min((asset?.duration || 1) - 0.001, t));
      if (!program) r.set({ time: target, mediaPlaying: false });
      video.pause();
      if (Math.abs(video.currentTime - target) < 0.002) {
        stage.current?.draw();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          video.removeEventListener("seeked", done);
          reject(Error("The frame could not be decoded."));
        }, 6000);
        const done = () => {
          clearTimeout(timeout);
          video.removeEventListener("seeked", done);
          stage.current?.draw();
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = target;
      });
    };
    useImperativeHandle(
      ref,
      () => ({
        capture,
        composite: () => {
          const helpers = stage.current?.find(".calibration-guide") || [];
          helpers.forEach((n) => n.hide());
          stage.current?.draw();
          const out =
            stage.current?.toCanvas({ pixelRatio: 1 / Math.max(0.1, scale) }) ||
            null;
          helpers.forEach((n) => n.show());
          stage.current?.draw();
          return out;
        },
        seek,
        element: () => element,
      }),
      [element, asset, scale],
    );
    useEffect(() => {
      const el = holder.current;
      if (!el) return;
      const obs = new ResizeObserver(() =>
        setSize({ width: el.clientWidth, height: el.clientHeight }),
      );
      obs.observe(el);
      setSize({ width: el.clientWidth, height: el.clientHeight });
      return () => obs.disconnect();
    }, []);
    useEffect(() => {
      let live = true,
        url: string | undefined;
      setElement(null);
      setError("");
      if (!asset) return;
      getMedia(asset.id)
        .then((blob) => {
          if (!blob)
            throw Error(
              "This source is not on this computer. Import its original file or open a project pack that includes the media.",
            );
          url = URL.createObjectURL(blob);
          const el =
            asset.type === "video"
              ? document.createElement("video")
              : new Image();
          if (el instanceof HTMLVideoElement) {
            el.muted = true;
            el.playsInline = true;
            el.preload = "auto";
            el.onloadeddata = () => {
              if (live) setElement(el);
            };
          } else
            el.onload = () => {
              if (live) setElement(el);
            };
          el.onerror = () =>
            setError(
              "The browser cannot decode this media file. Try an H.264 MP4 or a WebM.",
            );
          el.src = url;
        })
        .catch((e) => setError(e.message));
      return () => {
        live = false;
        if (url) URL.revokeObjectURL(url);
      };
    }, [asset?.id]);
    useEffect(() => {
      if (!video) return;
      let presented = 0;
      const redraw = () => {
        stage.current?.draw();
        if (video.requestVideoFrameCallback) {
          if (presented) video.cancelVideoFrameCallback(presented);
          presented = video.requestVideoFrameCallback(() =>
            stage.current?.draw(),
          );
        }
      };
      video.addEventListener("seeked", redraw);
      video.addEventListener("loadeddata", redraw);
      return () => {
        video.removeEventListener("seeked", redraw);
        video.removeEventListener("loadeddata", redraw);
        if (presented) video.cancelVideoFrameCallback(presented);
      };
    }, [video]);
    useEffect(() => {
      if (!video) return;
      video.playbackRate = Math.max(0.1, Math.min(4, rate));
      video.muted = program ? true : r.muted;
      if (playing && (program || !r.mediaHolding))
        video.play().catch(() => {
          if (!program) r.set({ mediaPlaying: false });
        });
      else video.pause();
    }, [video, playing, rate, r.muted, r.mediaHolding, program]);
    useEffect(() => {
      if (
        video &&
        Number.isFinite(time) &&
        Math.abs(video.currentTime - time) > (playing ? 0.25 : 0.015)
      )
        video.currentTime = Math.max(
          0,
          Math.min(asset?.duration || Infinity, time),
        );
      stage.current?.batchDraw();
    }, [time, video, playing, asset?.duration]);
    useEffect(() => {
      if (!video) return;
      let raf = 0, heldUntil = 0, lastSourceTime = video.currentTime;
      const stops = (desk.explainStops?.[asset?.id || ''] || []).filter(p=>p.time>=desk.trim.start && p.time<desk.trim.end).sort((a,b)=>a.time-b.time);
      const visited = new Set(stops.filter(p=>p.time<video.currentTime-.08).map(p=>p.id));
      const draw = () => {
        if (playing) {
          stage.current?.batchDraw();
          if (!program) {
            const now=performance.now();
            if(video.currentTime < lastSourceTime - .08){visited.clear();heldUntil=0;r.set({mediaHolding:false});}
            lastSourceTime=video.currentTime;
            if(heldUntil){
              if(now<heldUntil){raf=requestAnimationFrame(draw);return;}
              heldUntil=0;r.set({mediaHolding:false});void video.play().catch(()=>r.set({mediaPlaying:false}));
            }
            const stop=stops.find(p=>!visited.has(p.id) && video.currentTime>=p.time);
            if(stop){visited.add(stop.id);video.pause();video.currentTime=stop.time;lastSourceTime=stop.time;heldUntil=now+stop.hold*1000/Math.max(.1,rate);r.set({time:stop.time,mediaHolding:true});stage.current?.batchDraw();raf=requestAnimationFrame(draw);return;}
            const end = Math.min(asset?.duration || Infinity, desk.trim.end);
            if (video.currentTime >= end - 0.025) {
              if (r.loopClip) {video.currentTime = desk.trim.start;visited.clear();}
              else {
                video.pause();
                r.set({ time: end, mediaPlaying: false });
              }
            } else r.set({ time: video.currentTime });
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => {
        cancelAnimationFrame(raf);
        video.pause();
        if(!program)r.set({mediaHolding:false});
      };
    }, [
      video,
      playing,
      program,
      asset?.duration,
      desk.trim.start,
      desk.trim.end,
      r.loopClip,
      rate,
      JSON.stringify(desk.explainStops?.[asset?.id || '']),
    ]);
    useEffect(() => {
      drawing.current = false;
      draftRef.current = null;
      setDraft(null);
    }, [s.tool, asset?.id, r.markMode]);
    if (!board) return <div ref={holder} className="tl-media-stage" />;
    const sequence = asset ? desk.tracking[asset.id] : undefined,
      tracked = sequence ? sampleTracking(sequence.frames, time) : [];
    const targets = asset ? desk.targets[asset.id] || [] : [],
      landmarks = asset ? desk.landmarks[asset.id] || [] : [];
    const hmap = sequence?.frames.length
      ? sequence.frames.reduce((best, f) =>
          Math.abs(f.time - time) < Math.abs(best.time - time) ? f : best,
        ).map
      : homography(landmarks) || undefined;
    const visibleInk = asset
      ? (desk.ink[asset.id] || [])
          .filter((d) => time >= d.from - 0.03 && time <= d.to + 0.03)
          .map((d) => imageInk(d, hmap))
          .filter((d): d is MediaInk => !!d)
      : [];
    const point = () => {
      const q = work.current?.getRelativePointerPosition();
      return q
        ? {
            x: Math.max(0, Math.min(1, q.x / w)),
            y: Math.max(0, Math.min(1, q.y / h)),
          }
        : null;
    };
    const commitInk = (d: MediaInk) => {
      editDesk((b) => {
        (b.ink[d.assetId] ||= []).push(d);
      });
      r.set({ selectedInk: d.id });
    };
    const down = (e: any) => {
      if (program || !asset || r.panMode) return;
      const p = point();
      if (!p) return;
      r.set({ mediaPlaying: false });
      if (r.markMode === "landmark") {
        editDesk((d) => {
          const list = (d.landmarks[asset.id] ||= []);
          if (list.length < 4)
            list.push({
              image: p,
              pitch: r.landmarkPitch,
              label: r.landmarkLabel,
            });
          delete d.tracking[asset.id];
        });
        r.set({ markMode: "none" });
        return;
      }
      if (r.markMode === "target") {
        editDesk((d) => {
          const list = (d.targets[asset.id] ||= []);
          if (list.length >= 44) return;
          list.push({
            id: uid(),
            name: `${r.targetSide === "home" ? "Home" : "Away"} ${list.filter((t) => t.side === r.targetSide).length + 1}`,
            side: r.targetSide,
            number: "",
            image: p,
            box: { w: 0.025, h: 0.07 },
          });
          delete d.tracking[asset.id];
        });
        return;
      }
      if (s.tool === "select") {
        if (e.target.name() === "source-image") r.set({ selectedInk: null });
        return;
      }
      if (s.tool === "erase") return;
      if (!INK.includes(s.tool)) return;
      const d: MediaInk = {
        id: uid(),
        assetId: asset.id,
        type: s.tool as MediaInk["type"],
        points: [p.x, p.y, p.x, p.y],
        color: s.color,
        width: s.stroke,
        opacity: 1,
        from: time,
        to: Math.max(time, desk.trim.end),
      };
      if (s.tool === "text") {
        d.points = [p.x, p.y];
        d.text = "Tactical note";
        commitInk(d);
        s.set({ tool: "select" });
        return;
      }
      if (s.tool === "offside") {
        if (!hmap) {
          s.notify(
            "Calibrate four pitch landmarks before drawing a perspective reference line.",
          );
          return;
        }
        const inverse = invert3(hmap),
          world = project(hmap, p);
        if (!inverse) return;
        const a = project(inverse, { x: world.x, y: 0 }),
          b = project(inverse, { x: world.x, y: 1 });
        d.points = [a.x, a.y, b.x, b.y];
        commitInk(d);
        return;
      }
      if (s.tool === "triangle") {
        const previous = draftRef.current || { ...d, points: [] };
        previous.points.push(p.x, p.y);
        if (previous.points.length === 6) {
          commitInk(previous);
          draftRef.current = null;
          setDraft(null);
        } else {
          draftRef.current = structuredClone(previous);
          setDraft(structuredClone(previous));
        }
        return;
      }
      draftRef.current = d;
      setDraft(d);
      drawing.current = true;
    };
    const move = (e: any) => {
      if (e.evt?.touches?.length === 2) {
        e.evt.preventDefault();
        const [a, b] = e.evt.touches,
          dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch.current)
          r.set({
            zoom: Math.max(1, Math.min(4, (r.zoom * dist) / pinch.current)),
          });
        pinch.current = dist;
        drawing.current = false;
        return;
      }
      if (!drawing.current || !draftRef.current) return;
      const p = point();
      if (!p) return;
      const d = {
        ...draftRef.current,
        points:
          s.tool === "pen"
            ? [...draftRef.current.points, p.x, p.y]
            : [
                draftRef.current.points[0],
                draftRef.current.points[1],
                p.x,
                p.y,
              ],
      };
      draftRef.current = d;
      setDraft(d);
    };
    const up = () => {
      pinch.current = 0;
      if (drawing.current && draftRef.current) {
        const d = draftRef.current;
        if (d.type === 'ellipse' && Math.hypot(d.points.at(-2)!-d.points[0],d.points.at(-1)!-d.points[1]) < .006) { const [x,y]=d.points; d.points=[Math.max(0,x-.025),Math.max(0,y-.04),Math.min(1,x+.025),Math.min(1,y+.04)]; }
        if (
          Math.hypot(
            d.points.at(-2)! - d.points[0],
            d.points.at(-1)! - d.points[1],
          ) > 0.003
        )
          commitInk(d);
      }
      drawing.current = false;
      if (s.tool !== "triangle") {
        draftRef.current = null;
        setDraft(null);
      }
    };
    const selectInk = (d: MediaInk) => {
      if (s.tool === "erase")
        editDesk((b) => {
          b.ink[d.assetId] = b.ink[d.assetId].filter((x) => x.id !== d.id);
        });
      else if (s.tool === "select")
        r.set({ selectedInk: d.id, sidebar: "layers" });
    };
    const distance = (d: MediaInk) => {
      if (!hmap) return undefined;
      const a = project(hmap, { x: d.points[0], y: d.points[1] }),
        b = project(hmap, { x: d.points[2], y: d.points[3] });
      return Math.hypot((a.x - b.x) * 105, (a.y - b.y) * 68).toFixed(1) + " m*";
    };
    return (
      <div
        ref={holder}
        className={`tl-media-stage ${s.tool === "select" ? "" : "ink-cursor"} ${r.markMode !== "none" ? "mark-cursor" : ""}`}
        data-testid="media-canvas"
      >
        {!asset ? (
          <div className="tl-no-source">
            <span>FOOTAGE WORKSPACE</span>
            <h2>
              The moment.
              <br />
              The movement.
              <br />
              <em>The explanation.</em>
            </h2>
            <p>Import a still or a short match clip to start the analysis.</p>
            {!program && onImport && (
              <button className="tl-primary" onClick={onImport}>
                Import video or images
              </button>
            )}
          </div>
        ) : !element && !error ? (
          <div className="tl-stage-message">Opening local source…</div>
        ) : error ? (
          <div className="tl-stage-message error">{error}</div>
        ) : (
          <Stage
            ref={stage}
            width={Math.max(1, w * scale)}
            height={Math.max(1, h * scale)}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={down}
            onTouchStart={down}
            onMouseMove={move}
            onTouchMove={move}
            onMouseUp={up}
            onTouchEnd={up}
            onMouseLeave={up}
            onWheel={(e) => {
              if (program) return;
              e.evt.preventDefault();
              r.set({
                zoom: Math.max(
                  1,
                  Math.min(4, r.zoom * (e.evt.deltaY > 0 ? 0.9 : 1.1)),
                ),
              });
            }}
          >
            <Layer>
              <Group
                ref={work}
                x={w / 2 + (program ? 0 : r.pan.x * w)}
                y={h / 2 + (program ? 0 : r.pan.y * h)}
                offsetX={w / 2}
                offsetY={h / 2}
                scaleX={program ? 1 : r.zoom}
                scaleY={program ? 1 : r.zoom}
                draggable={!program && r.panMode}
                onDragEnd={(e) =>
                  r.set({
                    pan: {
                      x: (e.target.x() - w / 2) / w,
                      y: (e.target.y() - h / 2) / h,
                    },
                  })
                }
              >
                {element && (
                  <KImage
                    name="source-image"
                    image={element}
                    width={w}
                    height={h}
                  />
                )}
                {[...visibleInk, ...(draft ? [draft] : [])].map((d) => (
                  <Ink
                    key={d.id}
                    d={d}
                    w={w}
                    h={h}
                    selected={!program && r.selectedInk === d.id}
                    distance={distance(d)}
                    onSelect={program ? undefined : () => selectInk(d)}
                    onMove={
                      !program && s.tool === "select"
                        ? (dx, dy) =>
                            editDesk((b) => {
                              const old = b.ink[d.assetId].find(
                                (x) => x.id === d.id,
                              );
                              if (old) {
                                let x = dx,
                                  y = dy;
                                if (old.space === "pitch" && hmap) {
                                  const a = project(hmap, {
                                      x: d.points[0],
                                      y: d.points[1],
                                    }),
                                    b = project(hmap, {
                                      x: d.points[0] + dx,
                                      y: d.points[1] + dy,
                                    });
                                  x = b.x - a.x;
                                  y = b.y - a.y;
                                }
                                old.points = old.points.map((p, i) =>
                                  Math.max(
                                    -1,
                                    Math.min(2, p + (i % 2 ? y : x)),
                                  ),
                                );
                              }
                            })
                        : undefined
                    }
                  />
                ))}
                {!program &&
                  landmarks.map((l, i) => (
                    <Group
                      name="calibration-guide"
                      key={i}
                      x={l.image.x * w}
                      y={l.image.y * h}
                    >
                      <Line
                        points={[-12, 0, 12, 0]}
                        stroke="#63d9ff"
                        strokeWidth={2}
                      />
                      <Line
                        points={[0, -12, 0, 12]}
                        stroke="#63d9ff"
                        strokeWidth={2}
                      />
                      <Circle radius={5} fill="#63d9ff" />
                      <Rect
                        x={10}
                        y={-23}
                        width={28}
                        height={24}
                        fill="#114873"
                        cornerRadius={7}
                      />
                      <Text
                        x={10}
                        y={-18}
                        width={28}
                        align="center"
                        text={String(i + 1)}
                        fontSize={15}
                        fill="#fff"
                      />
                    </Group>
                  ))}
                {(desk.showTracking ||
                  (!program && r.sidebar === "reconstruct")) &&
                  targets.map((t) => {
                    const p = tracked.find((p) => p.id === t.id),
                      pos = p?.image || t.image,
                      c = p?.review ? "#ffb961" : board.colors[t.side];
                    const x = pos.x * w,
                      y = pos.y * h;
                    return (
                      <Group
                        key={t.id}
                        x={x}
                        y={y}
                        draggable={!program && s.tool === "select"}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          if (!program) r.set({ sidebar: "reconstruct" });
                        }}
                        onDragStart={() => r.set({ mediaPlaying: false })}
                        onDragEnd={(e) => {
                          const image = {
                            x: Math.max(0, Math.min(1, e.target.x() / w)),
                            y: Math.max(0, Math.min(1, e.target.y() / h)),
                          };
                          editDesk((d) => {
                            const seq = d.tracking[asset.id];
                            if (seq) {
                              const f = seq.frames.reduce((best, f) =>
                                Math.abs(f.time - time) <
                                Math.abs(best.time - time)
                                  ? f
                                  : best,
                              );
                              const point = f.points.find((p) => p.id === t.id),
                                map =
                                  f.map || homography(d.landmarks[asset.id]);
                              if (point && map)
                                Object.assign(point, {
                                  image,
                                  pitch: project(map, image),
                                  confidence: 1,
                                  review: false,
                                  manual: true,
                                });
                              seq.reviewed = false;
                            } else {
                              const target = d.targets[asset.id]?.find(
                                (z) => z.id === t.id,
                              );
                              if (target) target.image = image;
                            }
                          });
                        }}
                      >
                        <Ellipse
                          radiusX={22}
                          radiusY={8}
                          stroke={c}
                          strokeWidth={3}
                          fill={c}
                          opacity={0.45}
                        />
                        <Line
                          points={[0, -8, 0, -37]}
                          stroke={c}
                          strokeWidth={2}
                        />
                        <Rect
                          x={-Math.max(30, t.name.length * 5)}
                          y={-59}
                          width={Math.max(60, t.name.length * 10)}
                          height={25}
                          cornerRadius={7}
                          fill="#09111fe8"
                          stroke={c}
                          strokeWidth={1}
                        />
                        <Text
                          x={-100}
                          y={-54}
                          width={200}
                          align="center"
                          text={t.number ? `${t.number} ${t.name}` : t.name}
                          fill="#fff"
                          fontSize={15}
                          fontStyle="bold"
                        />
                        {p?.review && (
                          <Circle x={24} y={-4} radius={5} fill="#ffb961" />
                        )}
                      </Group>
                    );
                  })}
              </Group>
            </Layer>
          </Stage>
        )}
        {!program && r.markMode !== "none" && (
          <div className="tl-mark-hint">
            {r.markMode === "landmark"
              ? `Click ${r.landmarkLabel.toLowerCase()}`
              : "Click the feet of each player to track · Esc to finish"}
          </div>
        )}
      </div>
    );
  },
);
export default MediaStage;
