import SoftwarePitch3D from "./SoftwarePitch3D";
import { replayInteraction } from "./replayInteraction";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Board, Frame } from "../types";
import type { CameraPreset } from "./types";
import { analysisFrame } from "./tactics";
import { useStudio } from '../store';
export interface ReplayHandle {
  capture: () => HTMLCanvasElement | null;
  renderFrame: (frame: Frame) => HTMLCanvasElement | null;
}
const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  broadcast: [8, 75, 88],
  overhead: [0, 124, 0.1],
  endline: [-91, 32, 6],
  touchline: [5, 24, 83],
};
function label(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 80;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#081322ee";
  ctx.beginPath();
  ctx.roundRect(4, 4, 376, 72, 18);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(15, 25, 6, 30);
  ctx.font = "600 29px Inter,Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f8ff";
  ctx.fillText(text, 195, 52);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.scale.set(9.8, 2.05, 1);
  sprite.position.y = 4;
  sprite.userData.playerLabel = true;
  return sprite;
}
function dispose(node: THREE.Object3D) {
  node.traverse((o) => {
    if (
      o instanceof THREE.Mesh ||
      o instanceof THREE.Line ||
      o instanceof THREE.Sprite
    ) {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ("map" in m) (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    }
  });
}
const Pitch3D = forwardRef<
  ReplayHandle,
  { board: Board; frame: Frame; camera: CameraPreset; program?: boolean }
>(({ board, frame: rawFrame, camera, program = false }, ref) => {
  const frame = analysisFrame(board, rawFrame);
  const container = useRef<HTMLDivElement>(null),
    current = useRef({ board, frame, camera });
  current.current = { board, frame, camera };
  const state = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    update: (f: Frame) => void;
  } | null>(null);
  const [error, setError] = useState("");
  useImperativeHandle(
    ref,
    () => ({
      capture: () => {
        const v = state.current;
        if (!v) return null;
        v.update(current.current.frame);
        v.renderer.render(v.scene, v.camera);
        const out = document.createElement("canvas");
        out.width = v.renderer.domElement.width;
        out.height = v.renderer.domElement.height;
        out.getContext("2d")!.drawImage(v.renderer.domElement, 0, 0);
        return out;
      },
      renderFrame: (f) => {
        const v = state.current;
        if (!v) return null;
        v.update(analysisFrame(current.current.board, f));
        v.renderer.render(v.scene, v.camera);
        return v.renderer.domElement;
      },
    }),
    [],
  );
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      const surface = document.createElement("canvas");
      const context = surface.getContext("webgl2", {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      if (!context) {
        setError("software-renderer");
        return;
      }
      renderer = new THREE.WebGLRenderer({
        canvas: surface,
        context,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "This browser cannot open the 3D renderer. The tactical board remains available.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#081220", 0.0028);
    const camera3 = new THREE.PerspectiveCamera(43, 1, 0.1, 400);
    camera3.position.set(...cameraPositions[current.current.camera]);
    const controls = new OrbitControls(camera3, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.465;
    controls.minDistance = 28;
    controls.maxDistance = 180;
    controls.enabled = !program;
    const pose=current.current.board.studio?.cameraPose;
    if(pose){camera3.position.set(...pose.position);controls.target.set(...pose.target);camera3.fov=pose.fov;camera3.updateProjectionMatrix();}
    controls.addEventListener('end',()=>{if(program)return;const position=camera3.position.toArray() as [number,number,number],target=controls.target.toArray() as [number,number,number];useStudio.getState().commit(b=>{if(b.studio)b.studio.cameraPose={position,target,fov:camera3.fov};});});
    const ambient = new THREE.HemisphereLight("#cde7ff", "#15223e", 2.6);
    scene.add(ambient);
    const light = new THREE.DirectionalLight("#eff8ff", 3);
    light.position.set(-30, 80, 40);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -75,
      right: 75,
      top: 55,
      bottom: -55,
      near: 1,
      far: 180,
    });
    light.shadow.bias = -0.0005;
    scene.add(light);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(118, 1.8, 81),
      new THREE.MeshStandardMaterial({
        color: "#173c27",
        roughness: 0.7,
        metalness: 0.15,
      }),
    );
    base.position.y = -1.15;
    base.receiveShadow = true;
    scene.add(base);
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(105, 68),
      new THREE.MeshStandardMaterial({
        color: "#348449",
        roughness: 0.93,
        metalness: 0.03,
      }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);
    for (let i = 0; i < 10; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(10.5, 68),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? "#7ac26c" : "#143e23",
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-47.25 + i * 10.5, 0.008, 0);
      scene.add(stripe);
    }
    const line = (
      points: [number, number][],
      color = "#f1f5e4",
      opacity = 0.86,
    ) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map(([x, z]) => new THREE.Vector3(x, 0.035, z)),
      );
      const node = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
      scene.add(node);
      return node;
    };
    line([
      [-52.5, -34],
      [52.5, -34],
      [52.5, 34],
      [-52.5, 34],
      [-52.5, -34],
    ]);
    line([
      [0, -34],
      [0, 34],
    ]);
    line(
      Array.from({ length: 129 }, (_, i) => [
        Math.cos((i / 128) * Math.PI * 2) * 9.15,
        Math.sin((i / 128) * Math.PI * 2) * 9.15,
      ]),
    );
    for (const sign of [-1, 1]) {
      const x = sign * 52.5;
      line(
        Array.from({ length: 49 }, (_, i) => {
          const a = -0.925 + (i / 48) * 1.85;
          return [sign * (41.5 - 9.15 * Math.cos(a)), 9.15 * Math.sin(a)];
        }),
      );
      line(
        Array.from({ length: 25 }, (_, i) => [
          sign * 41.5 + Math.cos((i / 24) * Math.PI * 2) * 0.16,
          Math.sin((i / 24) * Math.PI * 2) * 0.16,
        ]),
      );
      line([
        [x, -20.16],
        [x - sign * 16.5, -20.16],
        [x - sign * 16.5, 20.16],
        [x, 20.16],
      ]);
      line([
        [x, -9.16],
        [x - sign * 5.5, -9.16],
        [x - sign * 5.5, 9.16],
        [x, 9.16],
      ]);
      const goal = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: "#e6efff",
        roughness: 0.45,
      });
      for (const z of [-3.66, 3.66]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 2.44, 8),
          material,
        );
        post.position.set(x, 1.22, z);
        goal.add(post);
      }
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 7.32, 8),
        material,
      );
      bar.rotation.x = Math.PI / 2;
      bar.position.set(x, 2.44, 0);
      goal.add(bar);
      for (let z = -3.66; z <= 3.67; z += 0.4) {
        const g = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 2.44, z),
            new THREE.Vector3(x + sign * 2, 0, z),
          ]),
          new THREE.LineBasicMaterial({
            color: "#637b9e",
            transparent: true,
            opacity: 0.3,
          }),
        );
        goal.add(g);
      }
      scene.add(goal);
    }
    for (const z of [-36, 36]) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(108, 0.08, 0.07),
        new THREE.MeshBasicMaterial({ color: "#45a8ff" }),
      );
      led.position.set(0, 0.05, z);
      scene.add(led);
    }
    const players = new Map<
        string,
        { node: THREE.Group; name: string; color: string; cutout?: string }
      >(),
      ink = new THREE.Group();
    scene.add(ink);
    let lastInk: Frame["drawings"] | null = null;
    const makePlayer = (
      name: string,
      number: string,
      color: string,
      cutout?: string,
    ) => {
      const g = new THREE.Group(),
        shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
        dark = new THREE.MeshStandardMaterial({
          color: "#111a30",
          roughness: 0.8,
        }),
        skin = new THREE.MeshStandardMaterial({
          color: "#c7a58c",
          roughness: 0.9,
        });
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1, 5, 10),
        shirt,
      );
      body.position.y = 1.45;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
      head.position.y = 2.5;
      head.castShadow = true;
      g.add(head);
      for (const sign of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.17, 0.7, 7),
          dark,
        );
        leg.position.set(sign * 0.23, 0.48, 0);
        leg.castShadow = true;
        g.add(leg);
        const arm = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.14, 0.6, 3, 7),
          shirt,
        );
        arm.position.set(sign * 0.67, 1.55, 0);
        arm.rotation.z = sign * 0.3;
        g.add(arm);
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1.05, 32),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      if (cutout) {
        for (const child of g.children) child.visible = false;
        const texture = new THREE.TextureLoader().load(cutout);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
        );
        sprite.scale.set(1.6, 3.2, 1);
        sprite.position.y = 1.6;
        g.add(sprite);
      }
      g.add(
        label(
          (number ? number + "  " : "") +
            (current.current.board.settings.names
              ? name.split(" ").slice(-1)[0]
              : ""),
          color,
        ),
      );
      return g;
    };
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 14, 10),
      new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.6 }),
    );
    ball.castShadow = true;
    scene.add(ball);
    const update = (f: Frame) => {
      const b = current.current.board;
      const ids = new Set(f.players.map((p) => p.uid));
      for (const [id, p] of players)
        if (!ids.has(id)) {
          scene.remove(p.node);
          dispose(p.node);
          players.delete(id);
        }
      for (const p of f.players) {
        let item = players.get(p.uid),
          color =
            p.opacity !== undefined &&
            p.opacity < 0.8 &&
            !b.settings.focusPlayer
              ? "#d8a464"
              : b.colors[p.side];
        if (
          !item ||
          item.color !== color ||
          item.name !==
            p.name +
              p.number +
              String(b.settings.names) +
              String(b.settings.numbers) ||
          item.cutout !== p.cutout
        ) {
          if (item) {
            scene.remove(item.node);
            dispose(item.node);
          }
          const node = makePlayer(
            p.name,
            b.settings.numbers ? p.number : "",
            color,
            p.cutout,
          );
          scene.add(node);
          item = {
            node,
            name:
              p.name +
              p.number +
              String(b.settings.names) +
              String(b.settings.numbers),
            color,
            cutout: p.cutout,
          };
          players.set(p.uid, item);
        }
        item.node.position.set(p.x * 105 - 52.5, 0.04, p.y * 68 - 34);
        item.node.scale.setScalar(
          Math.max(0.7, Math.min(1.6, b.settings.markerScale || 1)),
        );
        item.node.traverse((node) => {
          if (node instanceof THREE.Mesh || node instanceof THREE.Sprite) {
            for (const material of Array.isArray(node.material)
              ? node.material
              : [node.material]) {
              material.transparent = true;
              material.opacity = p.opacity ?? 1;
            }
          }
        });
        item.node.visible =
          p.side === "home" ? b.settings.homeVisible : b.settings.awayVisible;
      }
      ball.visible = b.settings.ballVisible !== false && !f.hideBall;
      camera3.updateMatrixWorld();
      scene.updateMatrixWorld(true);
      const labelRects: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[] = [];
      for (const item of players.values()) {
        const sprite = item.node.children.find(
          (n) => n.userData.playerLabel,
        ) as THREE.Sprite | undefined;
        if (!sprite || !item.node.visible) continue;
        let best = Infinity,
          height = 4;
        for (let step = 0; step < 7; step++) {
          const world = item.node.position.clone();
          world.y += (4 + step * 2.7) * item.node.scale.y;
          const projected = world.clone().project(camera3),
            distance = world.distanceTo(camera3.position),
            factor =
              host.clientHeight /
              (2 *
                Math.tan(THREE.MathUtils.degToRad(camera3.fov / 2)) *
                distance),
            w = 9.8 * item.node.scale.x * factor,
            h = 2.05 * item.node.scale.y * factor,
            x = ((projected.x + 1) * host.clientWidth) / 2,
            y = ((1 - projected.y) * host.clientHeight) / 2;
          const rect = {
            left: x - w / 2,
            right: x + w / 2,
            top: y - h / 2,
            bottom: y + h / 2,
          };
          let score = step * 0.01 + (rect.top < 8 ? 100 : 0);
          for (const other of labelRects)
            if (
              rect.left < other.right + 3 &&
              rect.right > other.left - 3 &&
              rect.top < other.bottom + 3 &&
              rect.bottom > other.top - 3
            )
              score += 10;
          if (score < best) {
            best = score;
            height = 4 + step * 2.7;
          }
        }
        sprite.position.y = height;
        const world = item.node.position.clone();
        world.y += height * item.node.scale.y;
        const projected = world.clone().project(camera3),
          factor =
            host.clientHeight /
            (2 *
              Math.tan(THREE.MathUtils.degToRad(camera3.fov / 2)) *
              world.distanceTo(camera3.position)),
          w = 9.8 * item.node.scale.x * factor,
          h = 2.05 * item.node.scale.y * factor,
          x = ((projected.x + 1) * host.clientWidth) / 2,
          y = ((1 - projected.y) * host.clientHeight) / 2;
        labelRects.push({
          left: x - w / 2,
          right: x + w / 2,
          top: y - h / 2,
          bottom: y + h / 2,
        });
      }
      ball.position.set(f.ball.x * 105 - 52.5, 0.4, f.ball.y * 68 - 34);
      if (f.drawings !== lastInk) {
        while (ink.children.length) {
          const n = ink.children[0];
          ink.remove(n);
          dispose(n);
        }
        for (const d of f.drawings) {
          const pts = [];
          for (let i = 0; i < d.points.length; i += 2)
            pts.push(
              new THREE.Vector3(
                d.points[i] * 105 - 52.5,
                0.14,
                d.points[i + 1] * 68 - 34,
              ),
            );
          if (pts.length < 1) continue;
          const material = new THREE.LineBasicMaterial({
            color: d.color,
            transparent: true,
            opacity: d.opacity,
          });
          if (d.type === "zone" || d.type === "triangle") {
            const shape = new THREE.Shape();
            if (d.type === "zone" && pts.length === 2) {
              shape.moveTo(pts[0].x, pts[0].z);
              shape.lineTo(pts[1].x, pts[0].z);
              shape.lineTo(pts[1].x, pts[1].z);
              shape.lineTo(pts[0].x, pts[1].z);
            } else
              pts.forEach((p, i) =>
                i ? shape.lineTo(p.x, p.z) : shape.moveTo(p.x, p.z),
              );
            shape.closePath();
            const mesh = new THREE.Mesh(
              new THREE.ShapeGeometry(shape),
              new THREE.MeshBasicMaterial({
                color: d.color,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = 0.1;
            ink.add(mesh);
          } else if (d.type === "ellipse" || d.type === "spotlight") {
            if (!pts[1]) continue;
            if (pts.length > 2) {
              const n = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]),
                material,
              );
              ink.add(n);
              continue;
            }
            const rx = Math.max(0.2, Math.abs(pts[1].x - pts[0].x) / 2),
              rz = Math.max(0.2, Math.abs(pts[1].z - pts[0].z) / 2),
              centre = pts[0].clone().add(pts[1]).multiplyScalar(0.5);
            const geometry = new THREE.BufferGeometry().setFromPoints(
              Array.from(
                { length: 65 },
                (_, i) =>
                  new THREE.Vector3(
                    centre.x + Math.cos((i / 64) * Math.PI * 2) * rx,
                    0.16,
                    centre.z + Math.sin((i / 64) * Math.PI * 2) * rz,
                  ),
              ),
            );
            ink.add(new THREE.Line(geometry, material));
          } else if (d.type === "text") {
            const sp = label(d.text || "Tactical note", d.color);
            sp.position.copy(pts[0]);
            sp.position.y = 4;
            sp.scale.set(15, 3, 1);
            ink.add(sp);
          } else {
            const lineMaterial =
              d.type === "run"
                ? new THREE.LineDashedMaterial({
                    color: d.color,
                    dashSize: 1,
                    gapSize: 0.6,
                  })
                : material;
            const node = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts),
              lineMaterial,
            );
            node.computeLineDistances();
            ink.add(node);
            if (
              ["arrow", "run", "measure"].includes(d.type) &&
              pts.length > 1
            ) {
              const from = pts[pts.length - 2],
                end = pts.at(-1)!,
                dir = end.clone().sub(from).normalize();
              const arrow = new THREE.ConeGeometry(0.65, 1.6, 3);
              const cone = new THREE.Mesh(
                arrow,
                new THREE.MeshBasicMaterial({ color: d.color }),
              );
              cone.position.copy(end);
              cone.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir,
              );
              ink.add(cone);
            }
          }
        }
        lastInk = f.drawings;
      }
    };
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera3.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera3.updateProjectionMatrix();
    };
    const obs = new ResizeObserver(resize);
    obs.observe(host);
    resize();
    state.current = { renderer, scene, camera: camera3, update };
    let previousPreset = current.current.camera,
      tween = 0,
      target = new THREE.Vector3(...cameraPositions[previousPreset]);
    let previousPose=JSON.stringify(current.current.board.studio?.cameraPose);
    controls.addEventListener("start", () => {
      tween = 0;
    });
    let draft: import("../types").Drawing | null = null;
    const cleanupInteraction = program
      ? () => {}
      : replayInteraction(
          renderer.domElement,
          camera3,
          () => current.current.frame,
          () => current.current.board,
          (d) => (draft = d),
          undefined,
          (enabled) => (controls.enabled = enabled),
        );
    let raf = 0;
    let lastRender = performance.now();
    const animate = () => {
      const now = performance.now(),
        damping = 1 - Math.exp(-Math.min(1, (now - lastRender) / 1000) * 8);
      lastRender = now;
      const next = current.current;
      const poseKey=JSON.stringify(next.board.studio?.cameraPose);
      if(poseKey!==previousPose){previousPose=poseKey;const pose=next.board.studio?.cameraPose;if(pose){camera3.position.set(...pose.position);controls.target.set(...pose.target);camera3.fov=pose.fov;camera3.updateProjectionMatrix();tween=0;}}
      if (next.camera !== previousPreset) {
        previousPreset = next.camera;
        if(!next.board.studio?.cameraPose){target.set(...cameraPositions[next.camera]);tween = 1;}
      }
      if (tween) {
        camera3.position.lerp(target, damping);
        controls.target.lerp(new THREE.Vector3(), damping);
        if (camera3.position.distanceTo(target) < 0.1) tween = 0;
      }
      update(
        draft
          ? { ...next.frame, drawings: [...next.frame.drawings, draft] }
          : next.frame,
      );
      controls.update();
      renderer.render(scene, camera3);
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      cleanupInteraction();
      controls.dispose();
      dispose(scene);
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [program]);
  if (error)
    return (
      <SoftwarePitch3D
        ref={ref}
        board={board}
        frame={frame}
        camera={camera}
        program={program}
      />
    );
  return (
    <div className="tl-replay-stage" ref={container} data-testid="replay-3d">
      {error && <div className="tl-stage-message error">{error}</div>}
      <div className="tl-3d-watermark">
        VIRTUAL REPLAY <span>EDITABLE RECONSTRUCTION</span>
      </div>
    </div>
  );
});
export default Pitch3D;
