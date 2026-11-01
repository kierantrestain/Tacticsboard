import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BoardHandle } from "../BoardCanvas";
import type { ReplayHandle } from "./Pitch3D";
import type { StatsHandle } from "./StatsStage";
import type { SourceHandle } from "./types";
import { isProgramSnapshot, transportProgram } from "./productionModel";
import { thumbnail } from "./capture";
import { productionFrame } from "./exports";
import BoardCanvas from "../BoardCanvas";
import MediaStage from "./MediaStage";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { readProgram, productionChannel } from "./production";
import { listAssets } from "./assetStore";
import { frameAt, isBoard } from "../core";
import { sampleTracking } from "./geometry";
import type { ProgramSnapshot, MediaAsset } from "./types";
import { defaultBroadcast, timecode } from "./types";
import StatsStage from "./StatsStage";
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
      hideBall:true,
      drawings: [
        ...b.drawings,
        ...(asset
          ? (b.studio?.ink[asset] || []).filter(
              (d) =>
                !d.hidden && d.space === "pitch" &&
                snapshot.time >= d.from &&
                snapshot.time <= d.to,
            )
          : []),
      ],
      players: points
        .filter(
          (p) =>
            sequence.targets.some((t) => t.id === p.id) &&
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
    boardRef = useRef<BoardHandle>(null),
    sourceRef = useRef<SourceHandle>(null),
    statsRef = useRef<StatsHandle>(null),
    replayRef = useRef<ReplayHandle>(null),
    current = useRef(snapshot),
    programmeStage = useRef<HTMLDivElement>(null);
  current.current = snapshot;
  useEffect(()=>{if(snapshot&&!snapshot.black)programmeStage.current?.animate?.([{opacity:.35},{opacity:1}],{duration:160,easing:'ease-out'});},[snapshot?.cueId,snapshot?.view]);
  useEffect(() => {
    void listAssets().then(setAssets);
    const onMessage = (e: MessageEvent) => {
      if (e.data.type === "take" && isProgramSnapshot(e.data.snapshot)) {
        setSnapshot(e.data.snapshot);
        useStudio.setState({ board: e.data.snapshot.board });
      }
      if (e.data.type === "transport") {
        setSnapshot((old) => transportProgram(old, e.data));
      }
    };
    productionChannel?.addEventListener("message", onMessage);
    productionChannel?.postMessage({ type: "request-program" });
    const acknowledge = () => {
      const shot = current.current;
      let raw: HTMLCanvasElement | null = null;
      if (shot && !shot.black) {
        if (shot.view === "stats") raw = statsRef.current?.capture() || null;
        else if (shot.view === "replay" || shot.view==='split'&&shot.board.studio?.comparisonView==='3d')
          raw = replayRef.current?.capture() || null;
        else if (shot.view === "footage")
          raw = sourceRef.current?.composite() || null;
        else
          raw =
            boardRef.current?.stage()?.toCanvas({ pixelRatio: 0.6 }) || null;
        if (shot.view === "split" && raw) {
          const source = sourceRef.current?.composite();
          if (source) {
            const out = document.createElement("canvas");
            out.width = 960;
            out.height = 360;
            const c = out.getContext("2d")!;
            [source, raw].forEach((canvas, i) => {
              const scale = Math.min(480 / canvas.width, 360 / canvas.height);
              c.drawImage(
                canvas,
                i * 480 + (480 - canvas.width * scale) / 2,
                (360 - canvas.height * scale) / 2,
                canvas.width * scale,
                canvas.height * scale,
              );
            });
            raw = out;
          }
        }
        if (raw)
          raw = productionFrame(
            raw,
            960,
            540,
            raw.width,
            raw.height,
            shot.board.studio?.lowerThird || shot.board.title,
            "ANALYSIS",
            { ...defaultBroadcast(), ...shot.board.studio?.broadcast },
            {
              home: shot.teams?.home || "HOME",
              away: shot.teams?.away || "AWAY",
              ...shot.board.match,
            },
          );
      }
      productionChannel?.postMessage({
        type: "output-alive",
        id: shot?.id,
        black: shot?.black,
        thumbnail: thumbnail(raw),
      });
    };
    const heartbeat = setInterval(acknowledge, 1500);
    acknowledge();
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f")
        document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("keydown", key);
    if (snapshot) useStudio.setState({ board: snapshot.board });
    return () => {
      clearInterval(heartbeat);
      productionChannel?.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    void listAssets().then(setAssets);
  }, [snapshot?.board.studio?.assetId,snapshot?.assetRevision]);
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
    frame = reconstructedFrame(snapshot, snapshot.phaseTime ?? null),
    style = { ...defaultBroadcast(), ...b.studio?.broadcast };
  return (
    <main
      className={`tl-program ${snapshot.black ? "black" : ""}`}
      style={{ "--show-accent": style.accent } as CSSProperties}
      onDoubleClick={() => document.documentElement.requestFullscreen?.()}
    >
      {!snapshot.black && (
        <>
          {(style.showHeader || style.showScore) && (
            <header className="ts-program-header">
              {style.showHeader && (
                <>
                  <span className="tl-program-brand">
                    {style.channel}
                    <small>{style.programme}</small>
                  </span>
                  <span className="tl-program-source">
                    {snapshot.view === "stats"
                      ? "FOOTBALL DATA"
                      : snapshot.view === "footage"
                        ? "MATCH ANALYSIS"
                        : snapshot.view === "replay"
                          ? "VIRTUAL REPLAY"
                          : "TACTICAL ANALYSIS"}{" "}
                    {snapshot.view !== 'stats' && <><i />
                    {asset &&
                    ["footage", "split", "replay"].includes(snapshot.view)
                      ? timecode(snapshot.time, b.studio?.fps)
                      : b.match?.completed
                        ? "FULL TIME"
                        : "ANALYST RECONSTRUCTION"}</>}
                  </span>
                </>
              )}
              {style.showScore && (
                <div className="ts-scorebug">
                  <span style={{ borderColor: b.colors.home }}>
                    {snapshot.teams?.home || b.match?.homeName || "HOME"}
                  </span>
                  <b>
                    {b.match?.completed
                      ? `${b.match.homeScore} : ${b.match.awayScore}`
                      : "v"}
                  </b>
                  <span style={{ borderColor: b.colors.away }}>
                    {snapshot.teams?.away || b.match?.awayName || "AWAY"}
                  </span>
                </div>
              )}
            </header>
          )}
          <div
            ref={programmeStage}
            className={`tl-program-stage ${snapshot.view === "split" ? "is-split" : ""}`}
          >
            {["footage", "split"].includes(snapshot.view) && (
              <MediaStage
                ref={sourceRef}
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
              {snapshot.view === "stats" ? (
                <StatsStage
                  ref={statsRef}
                  board={b}
                  report={snapshot.report}
                  program
                />
              ) : snapshot.view === "replay" || snapshot.view==='split'&&b.studio?.comparisonView==='3d' ? (
                <Pitch3D
                  ref={replayRef}
                  board={b}
                  frame={frame}
                  camera={snapshot.camera}
                  program
                />
              ) : snapshot.view !== "footage" ? (
                <BoardCanvas ref={boardRef} program externalFrame={frame} />
              ) : null}
            </Suspense>
          </div>
          {style.showLowerThird && (
            <footer className="ts-program-lower">
              <span className="tl-program-rule" />
              <div>
                <small>{style.subtitle}</small>
                <strong>
                  {style.headline || b.studio?.lowerThird || b.title}
                </strong>
              </div>
              <span>ANALYSIS</span>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
