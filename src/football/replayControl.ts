import type { Match, MatchDetails } from '../types';
import { copy, newBoard, totalDuration } from '../core';
import type { Board } from '../types';
import { useStudio } from '../store';
import { useRuntime } from '../studio/runtime';
import { cueContentKey, makeCue } from '../studio/cueModel';
import { setLiveFollow } from '../studio/production';
import { buildReportReplay, defaultReplayOptions, type ReportMoment, type ReplayOptions } from './reportReplay';

function workspaceContent(board: Board) {
  return JSON.stringify([
    board.title, board.match, board.media, board.recreation,
    board.players, board.ball, board.drawings,
    board.scenes.map(({ id: _id, ...scene }) => scene),
    board.settings, board.colors, board.formations,
    board.studio?.assetId, board.studio?.lowerThird,
    board.studio?.statsSnapshot, board.studio?.broadcast,
  ]);
}

/** One undoable edit. New report drafts never replace an existing saved show moment. */
export function createReportReplays(match: Match, report: MatchDetails, requests: { moment: ReportMoment; options?: ReplayOptions }[]) {
  const s = useStudio.getState(), r = useRuntime.getState(), current = s.board;
  if (!current || !s.catalogue) throw Error('Open the analysis workspace first.');
  if (r.movementDraft) throw Error('Finish or cancel the current movement first.');
  if (r.busy || s.loading) throw Error('Wait for the current operation to finish.');
  const existing = current.studio?.cues || [];
  const seen = new Set(existing.filter(c => c.recreation?.matchId === match.id).map(c => c.recreation!.eventId));
  const selected = requests.filter(q => {
    if (seen.has(q.moment.id)) return false;
    seen.add(q.moment.id);
    return true;
  });
  if (!selected.length) throw Error('These events are already saved. Open their moments in the show to edit them.');
  const snapshot = makeCue(current, r.view, r.camera, r.time);
  const active = existing.find(c => c.id === r.activeCueId);
  const home = s.catalogue.teams.find(t => t.id === current.homeTeamId);
  const away = s.catalogue.teams.find(t => t.id === current.awayTeamId);
  const pristine = r.view === 'board' && home && away && workspaceContent(current) === workspaceContent(newBoard(home, away));
  const keepCurrent = !pristine && (!active || cueContentKey(snapshot) !== cueContentKey(active));
  if (existing.length + selected.length + (keepCurrent ? 1 : 0) > 80) throw Error('There is not enough room in the show. Remove unused moments first.');
  const drafts = selected.map(({ moment, options }) => buildReportReplay(current, s.catalogue!, match, report, moment, options || defaultReplayOptions(match, moment)));
  const cues = drafts.map(draft => {
    const cue = makeCue(draft, 'board', 'broadcast', 0);
    cue.title = draft.title.slice(0, 80);
    cue.note = `${draft.recreation!.sourceText}\n\nExplain the reported incident. Positions and movement are illustrative; check the source before presenting.`;
    cue.duration = Math.ceil(totalDuration(draft));
    return cue;
  });
  const retained = keepCurrent ? snapshot : undefined;
  if (retained) { retained.title = `${retained.title} · retained draft`.slice(0, 80); retained.note ||= 'Workspace retained before creating report replays.'; }
  const next = copy(drafts[0]);
  next.studio!.cues = [...copy(existing), ...(retained ? [retained] : []), ...cues];
  setLiveFollow(false);
  s.commit(board => Object.assign(board, next));
  s.set({ modal: null, playing: false, previewTime: null, selected: [], selectedShape: null, tool: 'select' });
  r.set({ view: 'board', time: 0, mediaPlaying: false, mediaHolding: false, activeCueId: cues[0].id, ballActionKind: null, ballTargetPicking: false, movementDraft: null, zoom: 1, pan: { x: 0, y: 0 }, sidebar: 'rundown' });
  s.notify(`${cues.length} report ${cues.length === 1 ? 'replay' : 'replays'} saved as editable drafts. Programme is held.`);
  return cues;
}
