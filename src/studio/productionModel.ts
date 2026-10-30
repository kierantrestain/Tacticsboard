import type { ProgramSnapshot } from "./types";
import { copy, isBoard } from "../core";

/** Black is a cover over the held shot. Neither operation reads the editor. */
export function setProgramBlack(
  snapshot: ProgramSnapshot,
  black: boolean,
): ProgramSnapshot {
  return { ...copy(snapshot), black, playing: false };
}
export interface ProgramTransport {
  snapshotId: string;
  time: number;
  playing: boolean;
  rate: number;
  phaseTime: number | null;
}
export function transportProgram(
  snapshot: ProgramSnapshot | null,
  message: ProgramTransport,
): ProgramSnapshot | null {
  if (
    !snapshot ||
    snapshot.black ||
    message.snapshotId !== snapshot.id ||
    !Number.isFinite(message.time) ||
    message.time < 0 ||
    !Number.isFinite(message.rate) ||
    message.rate <= 0 ||
    (message.phaseTime !== null &&
      (!Number.isFinite(message.phaseTime) || message.phaseTime < 0))
  )
    return snapshot;
  return {
    ...snapshot,
    time: message.time,
    playing: message.playing,
    rate: message.rate,
    phaseTime: message.phaseTime,
  };
}
export function isProgramSnapshot(value: unknown): value is ProgramSnapshot {
  const s = value as ProgramSnapshot;
  return (
    !!s &&
    isBoard(s.board) &&
    typeof s.id === "string" &&
    ["board", "footage", "split", "replay", "stats"].includes(s.view) &&
    ["broadcast", "overhead", "endline", "touchline"].includes(s.camera) &&
    Number.isFinite(s.time) &&
    s.time >= 0 &&
    Number.isFinite(s.rate) &&
    s.rate > 0 &&
    typeof s.black === "boolean" &&
    (s.phaseTime == null || (Number.isFinite(s.phaseTime) && s.phaseTime >= 0))
  );
}
