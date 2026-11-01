import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { Board, Frame, Drawing } from "../types";
import type { CameraPreset } from "./types";
import type { ReplayHandle } from "./Pitch3D";
import { replayInteraction } from "./replayInteraction";
import { analysisFrame } from "./tactics";
import { useStudio } from '../store';
const presets: Record<CameraPreset, [number, number, number]> = {
  broadcast: [8, 75, 88],
  overhead: [0, 124, 0.1],
  endline: [-91, 32, 6],
  touchline: [5, 24, 83],
};
const SoftwarePitch3D = forwardRef<
  ReplayHandle,
  { board: Board; frame: Frame; camera: CameraPreset; program?: boolean }
>(({ board, frame, camera, program = false }, ref) => {
  const holder = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef({ board, frame, camera }),
    renderRef = useRef<((f: Frame) => HTMLCanvasElement) | null>(null);
  latest.current = { board, frame, camera };
  useImperativeHandle(
    ref,
    () => ({
      capture: () => {
        if (!renderRef.current) return null;
        const raw = renderRef.current(latest.current.frame),
          out = document.createElement("canvas");
        out.width = raw.width;
        out.height = raw.height;
        out.getContext("2d")!.drawImage(raw, 0, 0);
        return out;
      },
      renderFrame: (f) =>
        renderRef.current?.(analysisFrame(latest.current.board, f)) || null,
    }),
    [],
  );
  useEffect(() => {
    const el = canvas.current,
      host = holder.current;
    if (!el || !host) return;
    const images = new Map<string, HTMLImageElement>();
    const ctx = el.getContext("2d")!,
      cam = new THREE.PerspectiveCamera(43, 1, 0.1, 400);
    cam.position.set(...presets[latest.current.camera]);
    cam.lookAt(0, 0, 0);
    const initialPose=latest.current.board.studio?.cameraPose;
    if(initialPose){cam.position.set(...initialPose.position);cam.lookAt(...initialPose.target);cam.fov=initialPose.fov;cam.updateProjectionMatrix();}
    cam.updateMatrixWorld();
    let preset = latest.current.camera,
      target = cam.position.clone(),
      tween = false,
      draft: Drawing | null = null;
    let poseKey=JSON.stringify(latest.current.board.studio?.cameraPose),poseTimer:ReturnType<typeof setTimeout>;
    const savePose=()=>{clearTimeout(poseTimer);poseTimer=setTimeout(()=>useStudio.getState().commit(b=>{if(b.studio)b.studio.cameraPose={position:cam.position.toArray() as [number,number,number],target:[0,0,0],fov:cam.fov};}),200);};
    const dot = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(cam);
      return {
        x: ((v.x + 1) * el.width) / 2,
        y: ((1 - v.y) * el.height) / 2,
        z: v.z,
      };
    };
    const path = (points: { x: number; y: number }[], close = false) => {
      ctx.beginPath();
      points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      if (close) ctx.closePath();
    };
    const worldPath = (
      pts: [number, number][],
      color: string,
      width = 1,
      fill?: string,
    ) => {
      path(
        pts.map(([x, z]) => dot(x, 0.04, z)),
        !!fill,
      );
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.stroke();
    };
    const render = (f: Frame) => {
      const b = latest.current.board,
        w = el.width,
        h = el.height;
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createRadialGradient(
        w / 2,
        h * 0.55,
        10,
        w / 2,
        h * 0.5,
        w * 0.65,
      );
      gradient.addColorStop(0, "#142b48");
      gradient.addColorStop(1, "#070f1d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      worldPath(
        [
          [-59, -40],
          [59, -40],
          [59, 40],
          [-59, 40],
        ],
        "#347f43",
        1,
        "#173c27",
      );
      worldPath(
        [
          [-52.5, -34],
          [52.5, -34],
          [52.5, 34],
          [-52.5, 34],
        ],
        "#f1f5e4df",
        1.4,
        "#2c6f3a",
      );
      for (let i = 0; i < 10; i++)
        if (i % 2 === 0)
          worldPath(
            [
              [-52.5 + i * 10.5, -34],
              [-42 + i * 10.5, -34],
              [-42 + i * 10.5, 34],
              [-52.5 + i * 10.5, 34],
            ],
            "#a2dc730e",
            0.1,
            "#122f1d16",
          );
      worldPath(
        [
          [0, -34],
          [0, 34],
        ],
        "#f1f5e4cf",
        1.2,
      );
      worldPath(
        Array.from({ length: 81 }, (_, i) => [
          Math.cos((i / 80) * Math.PI * 2) * 9.15,
          Math.sin((i / 80) * Math.PI * 2) * 9.15,
        ]),
        "#f1f5e4cf",
        1.2,
      );
      for (const sign of [-1, 1]) {
        const x = sign * 52.5;
        worldPath(
          Array.from({ length: 49 }, (_, i) => {
            const a = -0.925 + (i / 48) * 1.85;
            return [sign * (41.5 - 9.15 * Math.cos(a)), 9.15 * Math.sin(a)];
          }),
          "#f1f5e4cf",
          1.2,
        );
        worldPath(
          Array.from({ length: 25 }, (_, i) => [
            sign * 41.5 + Math.cos((i / 24) * Math.PI * 2) * 0.18,
            Math.sin((i / 24) * Math.PI * 2) * 0.18,
          ]),
          "#f1f5e4",
          1,
          "#f1f5e4",
        );
        worldPath(
          [
            [x, -20.16],
            [x - sign * 16.5, -20.16],
            [x - sign * 16.5, 20.16],
            [x, 20.16],
          ],
          "#f1f5e4cf",
          1.2,
        );
        worldPath(
          [
            [x, -9.16],
            [x - sign * 5.5, -9.16],
            [x - sign * 5.5, 9.16],
            [x, 9.16],
          ],
          "#f1f5e4cf",
          1.2,
        );
        const posts = [
          dot(x, 0, -3.66),
          dot(x, 2.44, -3.66),
          dot(x, 2.44, 3.66),
          dot(x, 0, 3.66),
        ];
        path(posts);
        ctx.strokeStyle = "#c5e0edb0";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        for (let j = 0; j < 10; j++) {
          const z = -3.66 + (j * 7.32) / 9;
          path([dot(x, 2.44, z), dot(x + sign * 2, 0, z)]);
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = "#89a8bd35";
          ctx.stroke();
        }
      }
      worldPath(
        [
          [-54, -36],
          [54, -36],
        ],
        "#f1f5e4cf",
        1,
      );
      worldPath(
        [
          [-54, 36],
          [54, 36],
        ],
        "#f1f5e4cf",
        1,
      );
      for (const d of [...f.drawings, ...(draft ? [draft] : [])]) {
        const points = [];
        for (let i = 0; i < d.points.length; i += 2)
          points.push({
            x: d.points[i] * 105 - 52.5,
            z: d.points[i + 1] * 68 - 34,
          });
        if (!points.length) continue;
        ctx.save();
        ctx.globalAlpha = d.opacity;
        ctx.lineWidth = Math.max(1.3, d.width * 0.7);
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if (d.type === "zone" && points.length >= 4) {
          path(
            points.map((p) => dot(p.x, 0.1, p.z)),
            true,
          );
          ctx.globalAlpha = 0.22 * d.opacity;
          ctx.fill();
          ctx.globalAlpha = 0.7 * d.opacity;
          ctx.stroke();
        } else if (d.type === "zone" && points[1]) {
          path(
            [
              dot(points[0].x, 0.1, points[0].z),
              dot(points[1].x, 0.1, points[0].z),
              dot(points[1].x, 0.1, points[1].z),
              dot(points[0].x, 0.1, points[1].z),
            ],
            true,
          );
          ctx.globalAlpha = d.opacity * 0.22;
          ctx.fill();
          ctx.globalAlpha = d.opacity * 0.7;
          ctx.stroke();
        } else if (d.type === "triangle") {
          path(
            points.map((p) => dot(p.x, 0.1, p.z)),
            true,
          );
          ctx.globalAlpha = 0.2 * d.opacity;
          ctx.fill();
          ctx.globalAlpha = 0.7 * d.opacity;
          ctx.stroke();
        } else if (
          (d.type === "ellipse" || d.type === "spotlight") &&
          points[1]
        ) {
          if (points.length > 2) {
            path(
              points.map((p) => dot(p.x, 0.12, p.z)),
              true,
            );
            if (d.type === "spotlight") {
              ctx.globalAlpha = 0.2;
              ctx.fill();
            }
            ctx.globalAlpha = 0.8 * d.opacity;
            ctx.stroke();
            ctx.restore();
            continue;
          }
          const a = points[0],
            b = points[1];
          path(
            Array.from({ length: 65 }, (_, i) =>
              dot(
                (a.x + b.x) / 2 +
                  (Math.cos((i / 64) * Math.PI * 2) * Math.abs(b.x - a.x)) / 2,
                0.12,
                (a.z + b.z) / 2 +
                  (Math.sin((i / 64) * Math.PI * 2) * Math.abs(b.z - a.z)) / 2,
              ),
            ),
            true,
          );
          if (d.type === "spotlight") {
            ctx.globalAlpha = 0.2;
            ctx.fill();
          }
          ctx.globalAlpha = 0.8 * d.opacity;
          ctx.stroke();
        } else if (d.type === "text") {
          const p = dot(points[0].x, 2, points[0].z);
          ctx.font = "600 15px Inter,Arial";
          ctx.textAlign = "center";
          ctx.fillText(d.text || "Tactical note", p.x, p.y);
        } else {
          const ps = points.map((p) => dot(p.x, 0.15, p.z));
          if (d.type === "run" || d.type === "offside") ctx.setLineDash([8, 5]);
          path(ps);
          ctx.stroke();
          ctx.setLineDash([]);
          if (["arrow", "run", "measure"].includes(d.type) && ps.length > 1) {
            const a = ps[ps.length - 2],
              b = ps.at(-1)!,
              angle = Math.atan2(b.y - a.y, b.x - a.x);
            path(
              [
                b,
                {
                  x: b.x - Math.cos(angle - 0.45) * 11,
                  y: b.y - Math.sin(angle - 0.45) * 11,
                },
                {
                  x: b.x - Math.cos(angle + 0.45) * 11,
                  y: b.y - Math.sin(angle + 0.45) * 11,
                },
              ],
              true,
            );
            ctx.fill();
            if (d.type === "measure") {
              const text =
                Math.hypot(
                  (d.points[2] - d.points[0]) * 105,
                  (d.points[3] - d.points[1]) * 68,
                ).toFixed(1) + " m*";
              ctx.font = "600 12px Inter,Arial";
              ctx.textAlign = "center";
              ctx.fillText(text, (a.x + b.x) / 2, (a.y + b.y) / 2 - 9);
            }
          }
        }
        ctx.restore();
      }
      const right = new THREE.Vector3()
        .crossVectors(
          new THREE.Vector3(0, 1, 0),
          cam.position.clone().normalize(),
        )
        .normalize();
      const players = f.players
        .map((p) => ({ p, base: dot(p.x * 105 - 52.5, 0, p.y * 68 - 34) }))
        .sort((a, b) => b.base.z - a.base.z);
      const labels: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[] = [];
      for (const { p, base } of players) {
        if (
          p.side === "home" ? !b.settings.homeVisible : !b.settings.awayVisible
        )
          continue;
        const x = p.x * 105 - 52.5,
          z = p.y * 68 - 34,
          markerScale = Math.max(
            0.7,
            Math.min(1.6, b.settings.markerScale || 1),
          ),
          head = dot(x, 2.3 * markerScale, z),
          top = dot(x, 1.9 * markerScale, z),
          foot = dot(x, 0.3 * markerScale, z),
          side = dot(
            x + right.x * 0.8 * markerScale,
            1.2 * markerScale,
            z + right.z * 0.8 * markerScale,
          ),
          centre = dot(x, 1.2 * markerScale, z),
          radius = Math.max(
            2,
            Math.hypot(side.x - centre.x, side.y - centre.y),
          ),
          color =
            p.opacity !== undefined &&
            p.opacity < 0.8 &&
            !b.settings.focusPlayer
              ? "#ddb06d"
              : b.colors[p.side];
        ctx.save();
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.fillStyle = "#02091470";
        ctx.beginPath();
        ctx.ellipse(
          base.x,
          base.y + 3,
          radius * 1.4,
          radius * 0.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(
          base.x,
          base.y,
          radius * 1.3,
          radius * 0.43,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.lineWidth = Math.max(2, radius * 0.5);
        ctx.strokeStyle = "#0b1428";
        path([
          { x: centre.x - radius * 0.3, y: centre.y },
          { x: foot.x - radius * 0.38, y: foot.y },
          { x: foot.x - radius * 0.25, y: base.y },
        ]);
        ctx.stroke();
        path([
          { x: centre.x + radius * 0.3, y: centre.y },
          { x: foot.x + radius * 0.38, y: foot.y },
          { x: foot.x + radius * 0.25, y: base.y },
        ]);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(4, radius * 1.12);
        ctx.lineCap = "round";
        path([
          { x: top.x, y: top.y },
          { x: centre.x, y: centre.y + radius * 0.1 },
        ]);
        ctx.stroke();
        ctx.lineWidth = Math.max(2, radius * 0.35);
        path([
          { x: top.x - radius * 0.2, y: top.y + radius * 0.15 },
          { x: centre.x - radius, y: centre.y },
        ]);
        ctx.stroke();
        path([
          { x: top.x + radius * 0.2, y: top.y + radius * 0.15 },
          { x: centre.x + radius, y: centre.y },
        ]);
        ctx.stroke();
        ctx.fillStyle = "#d1b197";
        ctx.beginPath();
        ctx.arc(head.x, head.y, Math.max(2, radius * 0.42), 0, Math.PI * 2);
        ctx.fill();
        if (p.cutout) {
          let image = images.get(p.cutout);
          if (!image) {
            image = new Image();
            image.src = p.cutout;
            images.set(p.cutout, image);
          }
          if (image.complete && image.naturalWidth) {
            const ph = Math.max(12, Math.abs(base.y - head.y) * 1.35),
              pw = (ph * image.naturalWidth) / image.naturalHeight;
            ctx.drawImage(image, base.x - pw / 2, base.y - ph, pw, ph);
          }
        }
        const text =
          (b.settings.numbers && p.number ? p.number + "  " : "") +
          (b.settings.names ? p.name.split(" ").slice(-1)[0] : "");
        if (text) {
          const font = Math.max(8, Math.min(13, el.width / 100));
          ctx.font = `600 ${font}px Inter,Arial`;
          const tw = ctx.measureText(text).width;
          let lift = 0,
            best = Infinity;
          for (let step = 0; step < 7; step++) {
            const candidate = step * (font + 11),
              rect = {
                left: head.x - tw / 2 - 6,
                right: head.x + tw / 2 + 6,
                top: head.y - font - 12 - candidate,
                bottom: head.y - 5 - candidate,
              };
            let score = step * 0.01 + (rect.top < 10 ? 100 : 0);
            for (const label of labels)
              if (
                rect.left < label.right + 4 &&
                rect.right > label.left - 4 &&
                rect.top < label.bottom + 4 &&
                rect.bottom > label.top - 4
              )
                score += 10;
            for (const other of players)
              if (
                other.p.uid !== p.uid &&
                other.base.x + 10 > rect.left &&
                other.base.x - 10 < rect.right &&
                other.base.y > rect.top &&
                other.base.y - 28 < rect.bottom
              )
                score += 5;
            if (score < best) {
              best = score;
              lift = candidate;
            }
          }
          labels.push({
            left: head.x - tw / 2 - 6,
            right: head.x + tw / 2 + 6,
            top: head.y - font - 12 - lift,
            bottom: head.y - 5 - lift,
          });
          if (lift) {
            ctx.strokeStyle = "#b7cbb777";
            ctx.lineWidth = 0.8;
            path([
              { x: head.x, y: head.y - 4 },
              { x: head.x, y: head.y - 5 - lift },
            ]);
            ctx.stroke();
          }
          ctx.fillStyle = "#071324e8";
          ctx.beginPath();
          ctx.roundRect(
            head.x - tw / 2 - 6,
            head.y - font - 12 - lift,
            tw + 12,
            font + 7,
            4,
          );
          ctx.fill();
          ctx.fillStyle = "#d9eafd";
          ctx.textAlign = "center";
          ctx.fillText(text, head.x, head.y - 8 - lift);
        }
        ctx.restore();
      }
      if (b.settings.ballVisible !== false && !f.hideBall) {
        const p = dot(f.ball.x * 105 - 52.5, 0.4, f.ball.y * 68 - 34);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, w / 450), 0, Math.PI * 2);
        ctx.fillStyle = "#e2ecfa";
        ctx.fill();
      }
      return el;
    };
    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 2);
      el.width = Math.max(1, Math.floor(host.clientWidth * ratio));
      el.height = Math.max(1, Math.floor(host.clientHeight * ratio));
      cam.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      cam.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    renderRef.current = render;
    const cleanup = program
      ? () => {}
      : replayInteraction(
          el,
          cam,
          () => latest.current.frame,
          () => latest.current.board,
          (d) => (draft = d),
          (dx, dy) => {
            tween = false;
            const spherical = new THREE.Spherical().setFromVector3(
              cam.position,
            );
            spherical.theta -= dx * 0.007;
            spherical.phi = Math.max(
              0.05,
              Math.min(1.35, spherical.phi + dy * 0.006),
            );
            cam.position.setFromSpherical(spherical);
            cam.lookAt(0, 0, 0);
            cam.updateMatrixWorld();
            savePose();
          },
        );
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      tween = false;
      cam.position
        .multiplyScalar(e.deltaY > 0 ? 1.07 : 0.93)
        .clampLength(30, 180);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      savePose();
    };
    if (!program) el.addEventListener("wheel", wheel, { passive: false });
    let raf = 0;
    let lastRender = performance.now();
    const animate = () => {
      const now = performance.now(),
        damping = 1 - Math.exp(-Math.min(1, (now - lastRender) / 1000) * 10);
      lastRender = now;
      const key=JSON.stringify(latest.current.board.studio?.cameraPose);if(key!==poseKey){poseKey=key;const pose=latest.current.board.studio?.cameraPose;if(pose){cam.position.set(...pose.position);cam.lookAt(...pose.target);cam.fov=pose.fov;cam.updateProjectionMatrix();cam.updateMatrixWorld();tween=false;}}
      if (latest.current.camera !== preset) {
        preset = latest.current.camera;
        if(!latest.current.board.studio?.cameraPose){target.set(...presets[preset]);tween = true;}
      }
      if (tween) {
        cam.position.lerp(target, damping);
        cam.lookAt(0, 0, 0);
        cam.updateMatrixWorld();
        if (cam.position.distanceTo(target) < 0.05) tween = false;
      }
      render(latest.current.frame);
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(poseTimer);
      observer.disconnect();
      cleanup();
      el.removeEventListener("wheel", wheel);
      renderRef.current = null;
    };
  }, [program]);
  return (
    <div className="tl-replay-stage" ref={holder} data-testid="replay-3d">
      <canvas ref={canvas} />
      <div className="tl-3d-watermark">
        VIRTUAL REPLAY <span>EDITABLE RECONSTRUCTION</span>
      </div>
      {!program && (
        <span className="tl-software-renderer">COMPATIBILITY RENDERER</span>
      )}
    </div>
  );
});
export default SoftwarePitch3D;
