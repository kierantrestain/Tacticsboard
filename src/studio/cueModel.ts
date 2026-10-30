import type { Board, Frame } from "../types";
import type { CameraPreset, RundownCue, ViewMode } from "./types";
import { emptyStudio } from "./types";
import { copy, uid } from "../core";

export function makeCue(
  board: Board,
  view: ViewMode,
  camera: CameraPreset,
  time: number,
  frame?: Frame,
): RundownCue {
  const desk = board.studio || emptyStudio();
  const statsPlayer =
    desk.statsReportId && desk.statsPlayerId
      ? desk.dataReports?.[desk.statsReportId]?.lineups
          .flatMap((l) => l.players)
          .find((p) => p.id === desk.statsPlayerId)
      : undefined;
  const source =
    view === "footage" ||
    view === "split" ||
    (view === "replay" && desk.assetId && desk.tracking[desk.assetId])
      ? desk.assetId
      : undefined;
  return {
    sceneId: board.activeScene,
    statsReportId: desk.statsReportId,
    statsPlayerId: desk.statsPlayerId,
    context: copy(board.context),
    homeTeamId: board.homeTeamId,
    awayTeamId: board.awayTeamId,
    competition: board.competition,
    match: copy(board.match),
    id: uid(),
    title: (view === "stats"
      ? statsPlayer
        ? `${statsPlayer.name} · match stats`
        : `${board.context?.home.shortName || "Home"} v ${board.context?.away.shortName || "Away"} · numbers`
      : board.scenes.find((s) => s.id === board.activeScene)?.title ||
        "Analysis moment"
    ).slice(0, 80),
    note: "",
    duration: 15,
    view,
    camera,
    time,
    frame: copy(
      frame || {
        players: board.players,
        drawings: board.drawings,
        ball: board.ball,
      },
    ),
    settings: copy(board.settings),
    colors: copy(board.colors),
    formations: copy(board.formations),
    assetId: source,
    trim: copy(desk.trim),
    ink: copy(source ? desk.ink[source] || [] : []),
    lowerThird: desk.lowerThird || board.title,
  };
}
export function cueBoard(board: Board, cue: RundownCue): Board {
  const next = copy(board);
  const changedContext =
    !!cue.homeTeamId &&
    (cue.homeTeamId !== board.homeTeamId ||
      cue.awayTeamId !== board.awayTeamId ||
      cue.match?.id !== board.match?.id);
  if (cue.homeTeamId && cue.awayTeamId && cue.competition) {
    next.homeTeamId = cue.homeTeamId;
    next.awayTeamId = cue.awayTeamId;
    next.competition = cue.competition;
    next.context = copy(cue.context);
    next.match = copy(cue.match);
  }
  Object.assign(next, copy(cue.frame), {
    settings: copy(cue.settings),
    colors: copy(cue.colors),
    formations: copy(cue.formations),
  });
  next.studio ||= emptyStudio();
  const savedScene =
    next.scenes.find((s) => s.id === cue.sceneId) ||
    (!cue.sceneId ? next.scenes.find((s) => s.title === cue.title) : undefined);
  if (!changedContext && savedScene) next.activeScene = savedScene.id;
  else if (changedContext || !savedScene) {
    const scene = {
      ...copy(cue.frame),
      id: uid(),
      title: cue.title,
      duration: 3,
      note: cue.note,
    };
    if (changedContext) next.scenes = [scene];
    else if (next.scenes.length < 100) next.scenes.push(scene);
    else
      next.scenes[next.scenes.findIndex((s) => s.id === next.activeScene)] =
        scene;
    next.activeScene = scene.id;
  }
  next.studio.view = cue.view;
  next.studio.statsReportId = cue.statsReportId;
  next.studio.statsPlayerId = cue.statsPlayerId;
  next.studio.assetId = cue.assetId;
  next.studio.trim = copy(cue.trim);
  next.studio.lowerThird = cue.lowerThird;
  if (cue.assetId) next.studio.ink[cue.assetId] = copy(cue.ink);
  return next;
}
