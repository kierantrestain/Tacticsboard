import type { Board, Catalogue, Match, MatchDetails, ReportEvent } from '../types';
import type { BallOutcome } from '../studio/footballActionTypes';
import { addFootballAction } from '../studio/footballActions';
import { boardContext, copy, makePlayers, newBoard, shortName, uid } from '../core';
import { emptyStudio } from '../studio/types';

export type MomentKind = 'goal' | 'chance' | 'set-piece' | 'incident';
export interface ReportMoment {
  id: string;
  kind: MomentKind;
  title: string;
  minute: string;
  seconds: number;
  event: ReportEvent;
  actorId?: string;
  assisterId?: string;
  teamId?: string;
  outcome?: BallOutcome;
  ownGoal: boolean;
}
export interface ReplayOptions {
  actorId: string;
  assisterId?: string;
  goalSide: 'left' | 'right';
  includeXI: boolean;
  origin?: { x: number; y: number };
  assistOrigin?: { x: number; y: number };
  seconds: number;
}
const key = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fingerprint = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
const minuteSeconds = (minute = '') => minute.split('+').reduce((sum, part) => sum + (parseInt(part, 10) || 0), 0) * 60;
export function collectReportMoments(match: Match, report?: MatchDetails): ReportMoment[] {
  if (!report || report.id !== match.id) return [];
  const players = report.lineups.flatMap(l => l.players.map(p => ({ ...p, teamId: l.teamId })));
  const named = (text: string) => {
    const normal = ` ${key(text)} `;
    const found = players.filter(p => normal.includes(` ${key(p.name)} `));
    return found.length === 1 ? found[0] : undefined;
  };
  const participant = (e: ReportEvent, i: number) => {
    const p = e.participants?.[i];
    return p && (players.find(x => p.id && x.id === p.id) || named(p.name || ''));
  };
  const output: ReportMoment[] = [], ids = new Set<string>(), texts = new Set<string>();
  for (const e of [...report.events, ...(report.commentary?.length ? report.commentary : report.replayEvents || [])]) {
    const text = e.text || '', type = key(e.type), lower = text.toLowerCase();
    if (!text || /goal (?:disallowed|cancelled)|no goal|goal overturned|var.*(?:no goal|disallowed)/i.test(text)) continue;
    const ownGoal = /^own goal/i.test(text) || type.includes('own goal');
    let kind: MomentKind, outcome: BallOutcome | undefined;
    if (ownGoal || /^goal!/.test(lower) || type === 'goal' || /^goal (?:header|penalty|free kick|right foot|left foot)/.test(type) || e.scoringPlay === true) {
      kind = 'goal'; outcome = 'goal';
    } else if (/attempt saved|penalty saved/.test(lower)) {
      kind = 'chance'; outcome = 'saved';
    } else if (type.includes('shot on target')) {
      kind = 'chance'; outcome = 'on-target';
    } else if (/attempt blocked/.test(lower) || type.includes('shot blocked')) {
      kind = 'chance'; outcome = 'blocked';
    } else if (/attempt missed|misses.*penalty|penalty missed/.test(lower) || type.includes('shot off target')) {
      kind = 'chance'; outcome = 'off-target';
    } else if (/hits the (?:bar|post)|hits the (?:left|right) post|woodwork/.test(lower)) {
      kind = 'chance'; outcome = 'woodwork';
    } else if (/^corner[, .]|wins a free kick|penalty (?:awarded|conceded)|^penalty,/.test(lower)) {
      kind = 'set-piece';
    } else if (/^foul by|is shown the (?:yellow|red) card/.test(lower) || /(?:^| )(?:foul|yellow card|red card)(?: |$)/.test(type)) {
      kind = 'incident';
    } else continue;
    const beforeAssist = text.split(/assisted by/i)[0];
    const actor = kind === 'set-piece' && /^corner[, .]/i.test(text) && !/taken by/i.test(text) ? undefined : participant(e, 0) || named(beforeAssist.replace(/^goal!.*?\.\s*/i, ''));
    const assistText = text.match(/assisted by ([^.]+?)(?: with | following | after |\.|$)/i)?.[1];
    const assister = assistText ? named(assistText) || participant(e, 1) : undefined;
    const textId = key(text), id = e.id && !e.id.startsWith('commentary-') ? e.id : `${kind}-${fingerprint(`${e.minute}|${textId}`)}`;
    if (ids.has(id) || texts.has(`${e.minute}|${textId}`)) continue;
    ids.add(id); texts.add(`${e.minute}|${textId}`);
    const name = actor?.name || (kind === 'set-piece' ? 'Set play' : kind === 'incident' ? 'Incident' : 'Unidentified player');
    const label = ownGoal ? 'Own goal' : kind === 'goal' ? 'Goal' : kind === 'chance' ? outcome === 'off-target' ? 'Missed chance' : outcome === 'woodwork' ? 'Woodwork' : outcome === 'blocked' ? 'Blocked shot' : outcome === 'on-target' ? 'On-target shot' : 'Saved shot' : kind === 'set-piece' ? 'Set play' : 'Incident';
    output.push({ id, kind, title: `${name} · ${label}`, minute: e.minute || 'Time not supplied', seconds: e.seconds ?? minuteSeconds(e.minute), event: e, actorId: actor?.id, assisterId: assister?.teamId === actor?.teamId ? assister?.id : undefined, teamId: actor?.teamId || e.teamId || (key(e.teamName) === key(match.homeName) ? match.homeId : key(e.teamName) === key(match.awayName) ? match.awayId : undefined), outcome, ownGoal });
  }
  return output.sort((a, b) => a.seconds - b.seconds);
}
export function defaultReplayOptions(match: Match, moment: ReportMoment): ReplayOptions {
  const ownTeam = moment.teamId === match.awayId ? 'away' : 'home';
  return { actorId: moment.actorId || '', assisterId: moment.assisterId, goalSide: (ownTeam === 'home') !== moment.ownGoal ? 'right' : 'left', includeXI: false, seconds: 1.5 };
}
export function reportedPoint(moment: ReportMoment, goalSide: 'left' | 'right', target = false) {
  const p = moment.event.position;
  const x = target ? p?.targetX : p?.x, y = target ? p?.targetY : p?.y;
  if (x === undefined || y === undefined || ![x, y].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return undefined;
  // ESPN's event field coordinates are displayed attacking right; reverse both axes for a left-hand presentation.
  return goalSide === 'right' ? { x: x / 100, y: y / 100 } : { x: 1 - x / 100, y: 1 - y / 100 };
}
export function suggestedOrigin(moment: ReportMoment, goalSide: 'left' | 'right') {
  const reported = reportedPoint(moment, goalSide);
  if (reported) return reported;
  const text = moment.event.text || '';
  let x = /very close range|six yard/i.test(text) ? .945 : /outside the box|long range/i.test(text) ? .76 : /penalty/i.test(text) ? .895 : .87;
  let y = /left side/i.test(text) ? .7 : /right side/i.test(text) ? .3 : .5;
  if (goalSide === 'left') { x = 1 - x; y = 1 - y; }
  return { x, y };
}
export function buildReportReplay(current: Board, catalogue: Catalogue, match: Match, report: MatchDetails, moment: ReportMoment, options: ReplayOptions): Board {
  if (report.id !== match.id || !collectReportMoments(match, report).some(m => m.id === moment.id)) throw Error('Choose an event from this match report.');
  const home = catalogue.teams.find(t => t.id === match.homeId), away = catalogue.teams.find(t => t.id === match.awayId);
  if (!home || !away) throw Error('Load the clubs for this fixture first.');
  const roster = report.lineups.flatMap(l => l.players.map(p => ({ ...p, side: l.teamId === match.homeId ? 'home' as const : 'away' as const, teamId: l.teamId })));
  const actor = roster.find(p => p.id === options.actorId);
  if (!actor) throw Error('Choose the named player from this match lineup.');
  const assister = options.assisterId ? roster.find(p => p.id === options.assisterId) : undefined;
  if (options.assisterId && (!assister || assister.id === actor.id || assister.side !== actor.side)) throw Error('Choose a different teammate for the build-up.');
  if (!['left', 'right'].includes(options.goalSide) || !Number.isFinite(options.seconds) || options.seconds < .5 || options.seconds > 5) throw Error('Choose a valid direction and ball travel time.');
  for (const p of [options.origin, options.assistOrigin]) if (p && ![p.x, p.y].every(n => Number.isFinite(n) && n >= .025 && n <= .975)) throw Error('Keep player positions inside the pitch.');
  const fresh = newBoard(home, away), b: Board = { ...fresh, id: current.id, title:current.title, competition: match.league, studio: copy(current.studio || emptyStudio()), managerNotes: copy(current.managerNotes), context: boardContext(home, away), match: copy(match) };
  b.players = [];
  if (options.includeXI) for (const [side, team] of [['home', home], ['away', away]] as const) {
    const line = report.lineups.find(l => l.teamId === team.id);
    if (line?.formation) b.formations[side] = line.formation;
    if (line?.players.filter(p => p.starter).length === 11) b.players.push(...makePlayers(team, side, line.formation || '4-3-3', line));
  }
  const usualGoal = (actor.side === 'home') !== moment.ownGoal ? 'right' : 'left';
  if (options.goalSide !== usualGoal) for (const player of b.players) {
    player.x = 1 - player.x; player.y = 1 - player.y;
  }
  for (const p of [actor, assister].filter(Boolean) as typeof roster) {
    if (!b.players.some(x => x.playerId === p.id)) {
      if (options.includeXI && b.players.filter(x => x.side === p.side).length >= 11) {
        const replace = [...b.players].reverse().find(x => x.side === p.side && ![actor.id, assister?.id].includes(x.playerId));
        if (replace) b.players = b.players.filter(x => x.uid !== replace.uid);
      }
      b.players.push({ uid: `${p.side}:${p.id}`, playerId: p.id, side: p.side, name: p.name, number: p.number || '', position: p.position, x: .5, y: .5 });
    }
  }
  const origin = options.origin || suggestedOrigin(moment, options.goalSide), sign = options.goalSide === 'right' ? 1 : -1;
  const marker = b.players.find(p => p.playerId === actor.id)!;
  marker.x = Math.max(.025, Math.min(.975, origin.x - .014 * sign)); marker.y = Math.max(.025, Math.min(.975, origin.y - .012));
  if (assister) {
    const p = b.players.find(p => p.playerId === assister.id)!;
    const assistPoint = options.assistOrigin || { x: Math.max(.06, Math.min(.94, origin.x - .17 * sign)), y: origin.y > .5 ? .3 : .7 };
    p.x = assistPoint.x; p.y = assistPoint.y;
  }
  const title = `${actor.name} · ${moment.title.split(' · ').at(-1)}`;
  if(!b.studio?.episodeNamed&&!b.studio?.cues?.length)b.title = `${moment.minute} · ${title}`.slice(0, 120);
  b.recreation = { version: 1, matchId: match.id, eventId: moment.id, minute: moment.minute, title: title.slice(0, 120), sourceText: (moment.event.text || '').slice(0, 4000), sourceUrl: report.sourceUrl || match.sourceUrl, actorId: actor.id, assisterId: assister?.id, coordinateBasis: !options.origin && reportedPoint(moment, options.goalSide) ? 'provider' : 'illustrative', layoutBasis: 'illustrative', createdAt: new Date().toISOString() };
  b.lineupSource = { home: 'Report recreation · off-ball layout illustrative', away: 'Report recreation · off-ball layout illustrative' };
  b.settings = { ...b.settings, tokenStyle: 'disc', ballVisible: true, focusPlayer: undefined, teamShape: false, teamLines: false };
  b.ball = assister ? { ...b.players.find(p => p.playerId === assister.id)! } : copy(origin);
  b.ball = { x: b.ball.x, y: b.ball.y };
  const basis = { id: `report-replay:${uid()}`, type: 'text' as const, points: [.035, .95], color: '#e1ff7b', width: 2, opacity: .95, text: 'REPORT RECREATION · ILLUSTRATIVE MOVEMENT' };
  b.drawings = [basis];
  const first = { id: uid(), title: `${moment.minute} · Set the scene`.slice(0, 60), duration: 2, note: `${moment.event.text}\nShot location ${b.recreation.coordinateBasis === 'provider' ? 'supplied by the report' : 'illustrative'}. Other positions and movement are illustrative.`, players: copy(b.players), drawings: copy(b.drawings), ball: copy(b.ball) };
  b.scenes = [first]; b.activeScene = first.id;
  const actionStart = { ...copy(first), id: uid(), title: 'The reported action' };
  b.scenes.push(actionStart); b.activeScene = actionStart.id;
  let result = b;
  if (moment.outcome) {
    if (assister && !moment.ownGoal) {
      result = addFootballAction(result, { kind: 'pass', fromId: `${assister.side}:${assister.id}`, toId: marker.uid, outcome: 'completed', seconds: options.seconds });
      const pass = result.scenes.find(s => s.ballAction?.kind === 'pass')!;
      const end = result.scenes.find(s => s.id === pass.ballAction!.endSceneId)!;
      const start = options.assistOrigin || result.players.find(p => p.playerId === assister.id)!;
      pass.ball = { x: start.x, y: start.y };
      pass.ballAction!.target = copy(origin); end.ball = copy(origin); result.ball = copy(origin);
      for (const frame of [pass, end]) for (const ink of frame.drawings) {
        if (ink.id === `ball-action:${pass.ballAction!.id}:path`) ink.points = [start.x, start.y, origin.x, origin.y];
      }
    }
    // A blocked shot can retain the source endpoint without inventing a named blocker.
    const outcome = moment.outcome === 'blocked' ? 'on-target' : moment.outcome;
    result = addFootballAction(result, { kind: 'shot', fromId: marker.uid, outcome, seconds: options.seconds, goalSide: options.goalSide, goalTarget: 'centre' });
    const shotStart = result.scenes.find(s => s.ballAction?.kind === 'shot')!, finish = result.scenes.find(s => s.id === shotStart.ballAction!.endSceneId)!;
    const target = reportedPoint(moment, options.goalSide, true);
    shotStart.ball = copy(origin);
    if (target) finish.ball = copy(target);
    if (moment.outcome === 'blocked') { shotStart.ballAction!.outcome = 'blocked'; delete shotStart.ballAction!.onTarget; if (!target) finish.ball = { x: Math.max(.03, Math.min(.97, origin.x + .04 * sign)), y: origin.y }; }
    shotStart.ballAction!.label = `${shortName(actor.name)} · ${moment.ownGoal ? 'Own goal' : moment.outcome === 'goal' ? 'Goal' : moment.outcome === 'saved' ? 'Saved' : moment.outcome === 'off-target' ? 'Off target' : moment.outcome === 'blocked' ? 'Blocked' : moment.outcome === 'woodwork' ? 'Woodwork' : 'Shot'}`;
    shotStart.ballAction!.target = copy(finish.ball);
    for (const frame of [shotStart, finish]) for (const ink of frame.drawings) {
      if (ink.id === `ball-action:${shotStart.ballAction!.id}:path`) ink.points = [origin.x, origin.y, finish.ball.x, finish.ball.y];
      if (ink.id === `ball-action:${shotStart.ballAction!.id}:label`) ink.text = shotStart.ballAction!.label;
    }
    finish.title = moment.ownGoal ? 'Own goal · finish' : `${moment.title.split(' · ').at(-1)} · finish`;
    finish.duration = 3;
  } else {
    result.scenes[1].duration = 3;
    result.scenes[1].title = 'Incident position · add the movement';
  }
  result.scenes[0].title = `${moment.minute} · ${shortName(actor.name)}`.slice(0, 60);
  result.activeScene = result.scenes[0].id;
  result.players = copy(result.scenes[0].players); result.drawings = copy(result.scenes[0].drawings); result.ball = copy(result.scenes[0].ball);
  result.studio ||= emptyStudio();
  result.studio.assetId = undefined; result.media = undefined; result.studio.view = 'board';
  result.studio.lowerThird = `${moment.minute} · ${title} · Recreation`.slice(0, 120);
  if (result.studio.broadcast) result.studio.broadcast.headline = result.studio.lowerThird;
  return result;
}
