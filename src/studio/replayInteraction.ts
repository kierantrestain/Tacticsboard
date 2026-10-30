import * as THREE from "three";
import type { Board, Drawing, Frame } from "../types";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { uid } from "../core";
import { homography, invert3, project } from "./geometry";
export function replayInteraction(
  element: HTMLElement,
  camera: THREE.PerspectiveCamera,
  getFrame: () => Frame,
  getBoard: () => Board,
  draft: (d: Drawing | null) => void,
  orbit?: (dx: number, dy: number) => void,
  enableOrbit?: (v: boolean) => void,
) {
  const ray = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let mode: "none" | "draw" | "player" | "shape" | "orbit" = "none",
    current: Drawing | null = null,
    id = "",
    last = { x: 0, y: 0 },
    start = { x: 0, y: 0 },
    offset = { x: 0, y: 0 };
  const point = (e: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const q = ray.ray.intersectPlane(plane, new THREE.Vector3());
    return q
      ? {
          x: Math.max(0, Math.min(1, (q.x + 52.5) / 105)),
          y: Math.max(0, Math.min(1, (q.z + 34) / 68)),
        }
      : null;
  };
  const commit = (d: Drawing) => {
    const r = useRuntime.getState();
    useStudio.getState().commit((b) => {
      const asset = b.studio?.assetId;
      if (asset && b.studio?.tracking[asset]) {
        (b.studio.ink[asset] ||= []).push({
          ...d,
          space: "pitch",
          assetId: asset,
          from: r.time,
          to: b.studio.trim.end,
        });
      } else b.drawings.push(d);
    });
  };
  const shapeAt = (p: { x: number; y: number }) =>
    getFrame()
      .drawings.slice()
      .reverse()
      .find((d) => {
        const ps = d.points;
        if (ps.length < 2) return false;
        if (d.type === "zone" && ps.length >= 4)
          return (
            p.x >= Math.min(ps[0], ps[2]) &&
            p.x <= Math.max(ps[0], ps[2]) &&
            p.y >= Math.min(ps[1], ps[3]) &&
            p.y <= Math.max(ps[1], ps[3])
          );
        for (let i = 0; i < ps.length - 2; i += 2) {
          const ax = ps[i] * 105,
            ay = ps[i + 1] * 68,
            bx = ps[i + 2] * 105,
            by = ps[i + 3] * 68,
            x = p.x * 105,
            y = p.y * 68,
            dx = bx - ax,
            dy = by - ay,
            t = Math.max(
              0,
              Math.min(
                1,
                ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1),
              ),
            );
          if (Math.hypot(x - ax - t * dx, y - ay - t * dy) < 1.8) return true;
        }
        return Math.hypot((p.x - ps[0]) * 105, (p.y - ps[1]) * 68) < 2;
      });
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const s = useStudio.getState(),
      r = useRuntime.getState(),
      p = point(e);
    if (!p) return;
    r.set({ mediaPlaying: false });
    s.set({ playing: false });
    last = { x: e.clientX, y: e.clientY };
    start = p;
    mode = "none";
    if (s.tool === "select") {
      const rect = element.getBoundingClientRect(),
        players = getFrame()
          .players.map((player) => {
            const q = new THREE.Vector3(
              player.x * 105 - 52.5,
              1.2,
              player.y * 68 - 34,
            ).project(camera);
            return {
              player,
              distance: Math.hypot(
                ((q.x + 1) * rect.width) / 2 + rect.left - e.clientX,
                ((1 - q.y) * rect.height) / 2 + rect.top - e.clientY,
              ),
            };
          })
          .sort((a, b) => a.distance - b.distance);
      const hit = players[0];
      if (hit && hit.distance < 20) {
        mode = "player";
        id = hit.player.uid;
        offset = { x: hit.player.x - p.x, y: hit.player.y - p.y };
        s.begin();
        s.set({
          selected: [id],
          selectedShape: null,
          side: hit.player.side,
          inspector: "players",
          profileId: null,
        });
      } else {
        const shape = shapeAt(p);
        if (shape) {
          mode = "shape";
          id = shape.id;
          s.begin();
          if (getBoard().drawings.some((d) => d.id === id)) {
            s.set({ selectedShape: id, selected: [], inspector: "settings" });
            r.set({ sidebar: "inspector" });
          } else r.set({ selectedInk: id, sidebar: "layers" });
        } else if (orbit) mode = "orbit";
        else return;
      }
    } else if (s.tool === "erase") {
      const shape = shapeAt(p);
      if (shape)
        s.commit((b) => {
          b.drawings = b.drawings.filter((d) => d.id !== shape.id);
          const a = b.studio?.assetId;
          if (a && b.studio)
            b.studio.ink[a] = (b.studio.ink[a] || []).filter(
              (d) => d.id !== shape.id,
            );
        });
      return;
    } else {
      const d: Drawing = {
        id: uid(),
        type: s.tool,
        points: [p.x, p.y, p.x, p.y],
        color: s.color,
        width: s.stroke,
        opacity: 1,
      };
      if (s.tool === "text") {
        d.points = [p.x, p.y];
        d.text = "Tactical note";
        commit(d);
        return;
      }
      if (s.tool === "offside") {
        d.points = [p.x, 0, p.x, 1];
        commit(d);
        return;
      }
      if (s.tool === "triangle") {
        current = current || { ...d, points: [] };
        current.points.push(p.x, p.y);
        draft(current);
        if (current.points.length === 6) {
          commit(current);
          current = null;
          draft(null);
        }
        e.stopImmediatePropagation();
        enableOrbit?.(false);
        return;
      }
      current = d;
      mode = "draw";
      draft(d);
    }
    {
      e.preventDefault();
      if (mode !== "orbit") {
        e.stopImmediatePropagation();
        enableOrbit?.(false);
      }
      element.setPointerCapture(e.pointerId);
    }
  };
  const move = (e: PointerEvent) => {
    if (mode === "none") return;
    const p = point(e);
    if (!p) return;
    const s = useStudio.getState(),
      r = useRuntime.getState();
    if (mode === "orbit") {
      orbit?.(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      return;
    }
    e.stopImmediatePropagation();
    if (mode === "draw" && current) {
      current = {
        ...current,
        points:
          current.type === "pen"
            ? [...current.points, p.x, p.y]
            : [current.points[0], current.points[1], p.x, p.y],
      };
      draft(current);
      return;
    }
    if (mode === "player") {
      const x = Math.max(0.01, Math.min(0.99, p.x + offset.x)),
        y = Math.max(0.01, Math.min(0.99, p.y + offset.y));
      s.preview((b) => {
        const asset = b.studio?.assetId,
          seq = asset ? b.studio?.tracking[asset] : undefined;
        if (id.startsWith("reconstructed:") && seq) {
          const frame = seq.frames.reduce((best, f) =>
              Math.abs(f.time - r.time) < Math.abs(best.time - r.time)
                ? f
                : best,
            ),
            target = frame.points.find((p) => "reconstructed:" + p.id === id),
            map = frame.map || homography(b.studio!.landmarks[asset!]);
          if (target) {
            target.pitch = { x, y };
            if (map) {
              const inverse = invert3(map);
              if (inverse) target.image = project(inverse, { x, y });
            }
            target.manual = true;
            target.review = false;
            target.confidence = 1;
            seq.reviewed = false;
          }
        } else {
          const player = b.players.find((p) => p.uid === id);
          if (player) {
            player.x = x;
            player.y = y;
          }
        }
      });
    } else if (mode === "shape") {
      const dx = p.x - start.x,
        dy = p.y - start.y;
      start = p;
      s.preview((b) => {
        let d = b.drawings.find((d) => d.id === id);
        const asset = b.studio?.assetId;
        if (!d && asset) d = b.studio?.ink[asset]?.find((d) => d.id === id);
        if (d)
          d.points = d.points.map((v, i) =>
            Math.max(-1, Math.min(2, v + (i % 2 ? dy : dx))),
          );
      });
    }
  };
  const up = (e: PointerEvent) => {
    if (mode === "draw" && current) {
      if (
        Math.hypot(
          current.points.at(-2)! - current.points[0],
          current.points.at(-1)! - current.points[1],
        ) > 0.003
      )
        commit(current);
      current = null;
      draft(null);
    }
    if (mode === "player" || mode === "shape") useStudio.getState().end();
    if (element.hasPointerCapture(e.pointerId))
      element.releasePointerCapture(e.pointerId);
    mode = "none";
    enableOrbit?.(true);
  };
  element.addEventListener("pointerdown", down, true);
  element.addEventListener("pointermove", move, true);
  element.addEventListener("pointerup", up, true);
  element.addEventListener("pointercancel", up, true);
  return () => {
    element.removeEventListener("pointerdown", down, true);
    element.removeEventListener("pointermove", move, true);
    element.removeEventListener("pointerup", up, true);
    element.removeEventListener("pointercancel", up, true);
  };
}
