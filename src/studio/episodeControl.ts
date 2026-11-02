import { useStudio } from "../store";
import { copy, frameAt, newBoard, uid } from "../core";
import { useRuntime } from "./runtime";
import { setLiveFollow } from "./production";
import { checkpointProject, loadProject } from "./assetStore";
import { duplicateEpisode } from "./episodeModel";
import { recallCue } from "./showControl";
export function resumeEpisode(hold = true) {
  const s = useStudio.getState(),
    b = s.board;
  if (!b) return;
  if (hold) setLiveFollow(false);
  const resume = b.studio?.resume,
    rate = b.studio?.playbackRate || 1;
  useRuntime.setState({
    view: resume?.view || b.studio?.view || "board",
    time: resume?.time ?? b.studio?.trim.start ?? 0,
    activeCueId:
      resume?.cueId && b.studio?.cues?.some((c) => c.id === resume.cueId)
        ? resume.cueId
        : null,
    rate,
    mediaPlaying: false,
    mediaHolding: false,
    reverseReview: false,
    follow: false,
    markMode: "none",
    selectedInk: null,
    movementDraft: null,
    panMode: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
  s.set({
    playing: false,
    previewTime: resume?.phaseTime ?? null,
    playhead: resume?.phaseTime ?? 0,
    speed: rate,
    selected: [],
    selectedShape: null,
  });
}
export async function openEpisode(id: string) {
  setLiveFollow(false);
  await useStudio.getState().save();
  if (useStudio.getState().saveError)
    throw Error(
      "Save failed. Back up or recover this draft before changing episodes.",
    );
  await useStudio.getState().load(id);
  resumeEpisode();
}
export async function copyEpisode(id: string) {
  setLiveFollow(false);
  await useStudio.getState().save();
  if (useStudio.getState().saveError)
    throw Error("Save failed. Back up this draft before duplicating.");
  const original = await loadProject(id);
  if (!original) throw Error("This episode has no valid saved state.");
  const b = duplicateEpisode(original);
  if (!useStudio.getState().importBoard(b))
    throw Error("This episode cannot be opened with its saved match context.");
  const s = useStudio.getState();
  s.commit((next) => {
    next.title = b.title;
  });
  await s.save();
  if (useStudio.getState().saveError)
    throw Error("The copy could not be saved. Keep the original episode.");
  resumeEpisode();
}
export async function freshEpisode() {
  const s = useStudio.getState();
  setLiveFollow(false);
  if (s.board)
    await checkpointProject(s.board, "Before starting a fresh episode");
  await s.save();
  s.create();
  resumeEpisode();
}
export async function restoreEpisodeCheckpoint(
  board: import("../types").Board,
) {
  const s = useStudio.getState(),
    current = s.board;
  if (!current || current.id !== board.id)
    throw Error("Open the checkpoint’s episode first.");
  setLiveFollow(false);
  await checkpointProject(current, "Before recovery");
  if (useStudio.getState().board?.id !== current.id)
    throw Error("Episode changed; recovery was cancelled.");
  s.commit((b) => Object.assign(b, copy(board)));
  resumeEpisode();
  await s.save();
}
export async function resetDraftTactics() {
  const s = useStudio.getState(),
    b = s.board;
  if (!b || !s.catalogue) return;
  setLiveFollow(false);
  await checkpointProject(b, "Before resetting draft tactics");
  if (useStudio.getState().board?.id !== b.id)
    throw Error("Episode changed; reset was cancelled.");
  const home = s.catalogue.teams.find((t) => t.id === b.homeTeamId)!,
    away = s.catalogue.teams.find((t) => t.id === b.awayTeamId)!,
    setup = newBoard(home, away);
  s.commit((next) => {
    next.players = setup.players;
    next.ball = setup.ball;
    next.drawings = [];
    next.scenes = setup.scenes;
    next.activeScene = setup.activeScene;
    if (next.studio) {
      next.studio.view = "board";
      next.studio.resume = undefined;
    }
  });
  resumeEpisode();
  await s.save();
}
export function restoreSavedMoment() {
  const id = useRuntime.getState().activeCueId;
  if (!id) throw Error("Select a saved show moment first.");
  recallCue(id);
}
