import { lazy, Suspense, useEffect, useState } from "react";
import BoardCanvas from "../BoardCanvas";
import MediaStage from "./MediaStage";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { readProgram, productionChannel } from "./production";
import { listAssets } from "./assetStore";
import { frameAt, isBoard } from "../core";
import { sampleTracking } from "./geometry";
import type { ProgramSnapshot, MediaAsset } from "./types";
import { timecode } from "./types";
const Pitch3D = lazy(() => import("./Pitch3D"));
export function reconstructedFrame(
  snapshot: ProgramSnapshot,
  phaseTime: number | null,
) {
  const b = snapshot.board,
    asset = b.studio?.assetId,
    sequence = asset ? b.studio?.tracking[asset] : undefined;
  if (sequence && ["split", "replay"].includes(snapshot.view)) {
    const points = sampleTracking(sequence.frames, snapshot.time);
    return {
      ...b,
      drawings: [
        ...b.drawings,
        ...(asset
          ? (b.studio?.ink[asset] || []).filter(
              (d) =>
                d.space === "pitch" &&
                snapshot.time >= d.from &&
                snapshot.time <= d.to,
            )
          : []),
      ],
      players: points
        .filter(
          (p) =>
            p.pitch.x >= 0 &&
            p.pitch.x <= 1 &&
            p.pitch.y >= 0 &&
            p.pitch.y <= 1,
        )
        .map((p) => {
          const t = sequence.targets.find((t) => t.id === p.id)!;
          return {
            uid: "reconstructed:" + p.id,
            playerId: t.playerId || p.id,
            name: t.name,
            side: t.side,
            number: t.number,
            cutout: b.studio?.useSourceCutouts ? t.cutout : undefined,
            x: p.pitch.x,
            y: p.pitch.y,
            opacity: p.review ? 0.45 : 1,
          };
        }),
    };
  }
  return phaseTime === null ? b : frameAt(b, phaseTime);
}
export default function ProgramOutput() {
  const [snapshot, setSnapshot] = useState<ProgramSnapshot | null>(() =>
      readProgram(),
    ),
    [assets, setAssets] = useState<MediaAsset[]>([]),
    [phaseTime, setPhaseTime] = useState<number | null>(null);
  useEffect(() => {
    void listAssets().then(setAssets);
    const onMessage = (e: MessageEvent) => {
      if (e.data.type === "take" && isBoard(e.data.snapshot?.board)) {
        setSnapshot(e.data.snapshot);
        setPhaseTime(e.data.phaseTime ?? null);
        useStudio.setState({ board: e.data.snapshot.board });
        void listAssets().then(setAssets);
      }
      if (e.data.type === "transport") {
        setSnapshot((old) =>
          old && old.board.id === e.data.id
            ? {
                ...old,
                time: e.data.time,
                playing: e.data.playing,
                rate: e.data.rate,
              }
            : old,
        );
        setPhaseTime(e.data.phaseTime ?? null);
      }
    };
    productionChannel?.addEventListener("message", onMessage);
    productionChannel?.postMessage({ type: "request-program" });
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f")
        document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("keydown", key);
    if (snapshot) useStudio.setState({ board: snapshot.board });
    return () => {
      productionChannel?.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", key);
    };
  }, []);
  if (!snapshot)
    return (
      <main className="tl-program waiting">
        <span className="tl-wordmark">
          TOUCHLINE<span>STUDIO</span>
        </span>
        <h1>Programme output is ready.</h1>
        <p>Take a source from the operator workspace.</p>
      </main>
    );
  const b = snapshot.board,
    asset = assets.find((a) => a.id === b.studio?.assetId),
    frame = reconstructedFrame(snapshot, phaseTime);
  return (
    <main
      className={`tl-program ${snapshot.black ? "black" : ""}`}
      onDoubleClick={() => document.documentElement.requestFullscreen?.()}
    >
      {!snapshot.black && (
        <>
          <header>
            <span className="tl-program-brand">
              TOUCHLINE<small>STUDIO</small>
            </span>
            <span className="tl-program-source">
              {snapshot.view === "footage"
                ? "MATCH ANALYSIS"
                : snapshot.view === "replay"
                  ? "VIRTUAL REPLAY"
                  : "TACTICAL ANALYSIS"}{" "}
              <i />
              {asset && snapshot.view !== "board"
                ? timecode(snapshot.time, b.studio?.fps)
                : b.match?.completed
                  ? `${b.match.homeScore} — ${b.match.awayScore}`
                  : "ANALYST RECONSTRUCTION"}
            </span>
          </header>
          <div
            className={`tl-program-stage ${snapshot.view === "split" ? "is-split" : ""}`}
          >
            {["footage", "split"].includes(snapshot.view) && (
              <MediaStage
                asset={asset}
                board={b}
                program
                time={snapshot.time}
                playing={snapshot.playing}
                rate={snapshot.rate}
              />
            )}
            <Suspense
              fallback={
                <div className="tl-stage-message">Preparing replay…</div>
              }
            >
              {snapshot.view === "replay" ? (
                <Pitch3D
                  board={b}
                  frame={frame}
                  camera={snapshot.camera}
                  program
                />
              ) : snapshot.view !== "footage" ? (
                <BoardCanvas program externalFrame={frame} />
              ) : null}
            </Suspense>
          </div>
          <footer>
            <span className="tl-program-rule" />
            <strong>{b.studio?.lowerThird || b.title}</strong>
            <span>TOUCHLINE ANALYSIS</span>
          </footer>
        </>
      )}
    </main>
  );
}
