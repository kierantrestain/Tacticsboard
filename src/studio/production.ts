import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import type { ProgramSnapshot } from "./types";
import { copy, uid } from "../core";
import { putRecord } from "./assetStore";
export const productionChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("touchline-production")
    : null;
const KEY = "touchline.program-snapshot";
export function readProgram(): ProgramSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function takeToAir(black = false) {
  const s = useStudio.getState(),
    r = useRuntime.getState();
  if (!s.board) return;
  const snapshot: ProgramSnapshot = {
    id: uid(),
    board: copy(s.board),
    view: r.view,
    camera: r.camera,
    time: r.time,
    playing: r.mediaPlaying,
    rate: r.rate,
    takenAt: Date.now(),
    black,
  };
  r.set({ program: snapshot });
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {}
  void putRecord("projects", "touchline.program", snapshot).catch(() => {});
  productionChannel?.postMessage({
    type: "take",
    snapshot,
    phaseTime: s.previewTime,
  });
  return snapshot;
}
export function openProgram() {
  takeToAir();
  const w = window.open(
    "/?program=1",
    "touchline-program",
    "popup,width=1600,height=900",
  );
  if (!w)
    useStudio
      .getState()
      .notify("Allow this site to open the programme window.");
  else
    useStudio
      .getState()
      .notify(
        "Clean programme output opened. Use a second display or OBS window capture.",
      );
}
