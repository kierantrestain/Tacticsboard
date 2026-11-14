import { resolveMark, validAnchors } from './mark-anchors.js';
import { fullPitchBounds, halfPitchBounds, interpolateCamera, pitchStyles, validCamera } from './camera.js';
import { defaultBallTiming, inGoal, playerInControl, sampleBallMotion } from './ball-motion.js';
import { coreTemplateStages } from './extra-templates.js';
import { validMatchLayer } from './match-layer.js';
import { formations, teamInfo, templates } from './data.js';

const storageKey = 'touchline-board-v1';
const libraryKey = 'touchline-library-v1';
const libraryLimit = 12;
const sharePrefix = '#board=';
const gzipPrefix = 'gz.';
const maxShareBytes = 9_000_000;
const guideModes = ['lanes', 'thirds', 'zones'];
const markTypes = new Set(['arrow', 'run', 'dribble', 'lob', 'shot', 'line', 'pen', 'zone', 'text', 'cone', 'highlight', 'target', 'rectangle', 'oval', 'vision', 'cross', 'number', 'measure', 'path', 'space']);
const pointMarkTypes = new Set(['text', 'cone', 'highlight', 'target', 'cross', 'number']);
const footballRoles = ['GK', 'DF', 'MF', 'FW'];
export const ballMotionKinds = Object.freeze(['auto', 'pass', 'dribble', 'lob', 'shot']);
const defaultTransitionDuration = 1350;

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function initialBoard() {
  const template = templates[0];
  return {
    title: template.name,
    phases: coreTemplateStages(template).map(stage => ({id:makeId(),...structuredClone(stage)})),
    active: 0,
    settings: {
      homeName: teamInfo.home.name,
      awayName: teamInfo.away.name,
      homeColor: teamInfo.home.color,
      awayColor: teamInfo.away.color,
      homeFormation: template.homeFormation ?? '4-3-3',
      awayFormation: template.awayFormation ?? '4-4-2',
      labels: false,
      home: true,
      away: true,
      view: 'full',
      grid: false,
      guideMode: 'zones',
      snap: false,
    },
  };
}

const isString = (value, max = 200) => typeof value === 'string' && value.length <= max;
const isId = value => isString(value, 100) && value.length > 0;
const isColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const isBoolean = value => typeof value === 'boolean';
const isOptionalBoolean = value => value === undefined || isBoolean(value);
const isPoint = value => value && Number.isFinite(value.x) && Number.isFinite(value.y) &&
  value.x >= 0 && value.x <= 1000 && value.y >= 0 && value.y <= 625;

function hasDistinctIds(items) {
  return new Set(items.map(item => item.id)).size === items.length;
}

function isScene(scene) {
  if (!scene || !(scene.camera === undefined || validCamera(scene.camera)) || !validMatchLayer(scene.matchLayer) || !isPoint(scene.ball) || (scene.ball.ownerId != null && !isId(scene.ball.ownerId)) || !Array.isArray(scene.players) ||
      scene.players.length > 60 || !Array.isArray(scene.marks) || scene.marks.length > 500) {
    return false;
  }
  const validPlayers = scene.players.every(player =>
    isPoint(player) && isId(player.id) && ['home', 'away'].includes(player.team) &&
    Number.isInteger(player.number) && player.number >= 0 && player.number <= 999 &&
    isString(player.name, 100) && isOptionalBoolean(player.benched) && (player.providerPlayerId === undefined || /^[1-9]\d{0,11}$/.test(player.providerPlayerId)) &&
    (player.footballRole === undefined || footballRoles.includes(player.footballRole)));
  const validMarks = scene.marks.every(mark =>
    mark && isId(mark.id) && markTypes.has(mark.type) && isColor(mark.color) &&
    (mark.text == null || isString(mark.text, 500)) &&
    Array.isArray(mark.points) && mark.points.length >= (pointMarkTypes.has(mark.type) ? 1 : 2) &&
    mark.points.length <= 4000 && mark.points.every(isPoint) && validAnchors(mark.anchors,mark.points.length));
  return validPlayers && validMarks && hasDistinctIds(scene.players) && hasDistinctIds(scene.marks);
}

function isSettings(settings) {
  return settings && isString(settings.homeName, 100) && isString(settings.awayName, 100) &&
    isColor(settings.homeColor) && isColor(settings.awayColor) &&
    formations.includes(settings.homeFormation) && formations.includes(settings.awayFormation) &&
    ['full', 'half'].includes(settings.view) && isBoolean(settings.labels) &&
    isBoolean(settings.away) && isBoolean(settings.grid) &&
    (settings.guideMode === undefined || guideModes.includes(settings.guideMode)) &&
    isOptionalBoolean(settings.home) && isOptionalBoolean(settings.snap) && isOptionalBoolean(settings.ghostRuns) &&
    (settings.markerStyle === undefined || ['kit','solid','outline'].includes(settings.markerStyle)) &&
    (settings.pitchStyle === undefined || pitchStyles.some(style => style.id === settings.pitchStyle)) &&
    ['home','away'].every(team => ['Trim','Number','Keeper','KeeperNumber'].every(suffix =>
      settings[team + suffix] === undefined || isColor(settings[team + suffix])));
}

function isBoard(board) {
  if (!board || !isString(board.title) || !isSettings(board.settings) ||
      !Array.isArray(board.phases) || board.phases.length < 1 || board.phases.length > 100 ||
      !Number.isInteger(board.active) || board.active < 0 || board.active >= board.phases.length) {
    return false;
  }
  if (board.fixture !== undefined && (!board.fixture || !/^[1-9]\d{0,8}$/.test(board.fixture.id) ||
      !['home','away'].every(side => board.fixture[side] && /^[1-9]\d{0,8}$/.test(board.fixture[side].id) &&
        isString(board.fixture[side].name,120)))) return false;
  const validPhases = board.phases.every(phase =>
    phase && isId(phase.id) && isString(phase.title) && isString(phase.notes, 20_000) &&
    (phase.transition === undefined || ballMotionKinds.includes(phase.transition)) &&
    (phase.duration === undefined || validDuration(phase.duration)) &&
    (phase.ballTiming === undefined || validBallTiming(phase.ballTiming)) && isScene(phase.scene));
  return validPhases && hasDistinctIds(board.phases);
}

export function parseBoard(text) {
  if (!isString(text, 8_000_000)) return null;
  try {
    const board = JSON.parse(text);
    return isBoard(board) ? board : null;
  } catch {
    return null;
  }
}

function decodeShare(encoded) {
  return Uint8Array.from(
    atob(encoded.replaceAll('-', '+').replaceAll('_', '/')),
    character => character.charCodeAt(0),
  );
}

function encodeShare(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function collectShareBytes(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxShareBytes) {
        await reader.cancel();
        throw new RangeError('The board is too large for a share link.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function loadBoard() {
  const fragment = window.location.hash;
  if (fragment.startsWith(sharePrefix)) {
    try {
      const payload = fragment.slice(sharePrefix.length);
      const gzip = payload.startsWith(gzipPrefix);
      const encoded = gzip ? payload.slice(gzipPrefix.length) : payload;
      if (encoded.length > 12_000_000) return null;
      let bytes = decodeShare(encoded);
      if (gzip) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes = await collectShareBytes(stream);
      }
      return parseBoard(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      return null;
    }
  }
  try {
    return parseBoard(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function saveBoard(board) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function listSavedBoards() {
  try {
    const items = JSON.parse(window.localStorage.getItem(libraryKey));
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && isId(item.id) && Number.isFinite(item.modified) &&
      isBoard(item.board) && item.title === item.board.title)
      .sort((left, right) => right.modified - left.modified)
      .slice(0, libraryLimit);
  } catch {
    return [];
  }
}

export function storeSavedBoard(board) {
  try {
    if (!isBoard(board)) return null;
    const items = listSavedBoards();
    const existing = items.find(item => item.title === board.title);
    const record = {
      id: existing?.id ?? makeId(),
      title: board.title,
      modified: Date.now(),
      board: structuredClone(board),
    };
    const next = [record, ...items.filter(item => item.title !== board.title)].slice(0, libraryLimit);
    window.localStorage.setItem(libraryKey, JSON.stringify(next));
    return record;
  } catch {
    return null;
  }
}

export function renameSavedBoard(id,title) {
  try {
    const name = typeof title === 'string' ? title.trim() : '';
    if (!name || name.length > 100) return null;
    const items = listSavedBoards();
    const record = items.find(item => item.id === id);
    if (!record || items.some(item => item.id !== id && item.title.toLowerCase() === name.toLowerCase())) return null;
    record.title = name;
    record.board.title = name;
    window.localStorage.setItem(libraryKey,JSON.stringify(items));
    return items;
  } catch { return null; }
}

export function removeSavedBoard(id) {
  try {
    const items = listSavedBoards();
    const remaining = items.filter(item => item.id !== id);
    if (items.length === remaining.length) return false;
    window.localStorage.setItem(libraryKey, JSON.stringify(remaining));
    return true;
  } catch {
    return false;
  }
}

export async function sharedUrl(board) {
  const bytes = new TextEncoder().encode(JSON.stringify(board));
  if (bytes.byteLength > maxShareBytes) {
    throw new RangeError('The board is too large for a share link.');
  }
  let encoded;
  if (typeof CompressionStream === 'function' && typeof DecompressionStream === 'function') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressed = await collectShareBytes(stream);
      if (compressed.byteLength + gzipPrefix.length < bytes.byteLength) {
        encoded = gzipPrefix + encodeShare(compressed);
      }
    } catch {
      // The plain format is also understood by older browsers.
    }
  }
  const url = new URL(window.location.href);
  url.hash = sharePrefix + (encoded ?? encodeShare(bytes));
  return url.href;
}

export function downloadBoard(board) {
  const slug = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], {
    type: 'application/json',
  }));
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${slug || 'touchline-board'}.json`,
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function between(from, to, progress) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function interpolateScene(from, to, progress) {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  const matched = new Map(to.players.map(player => [player.id, player]));
  return {
    players: from.players.map(player => ({
      ...player,
      ...between(player, matched.get(player.id) ?? player, progress),
    })),
    ball: between(from.ball, to.ball, progress),
    marks: from.marks,
    matchLayer: from.matchLayer,
  };
}

function validDuration(duration) {
  return Number.isInteger(duration) && duration >= 500 && duration <= 5000;
}

export function transitionDuration(phases, index) {
  const duration = phases[index]?.duration;
  return validDuration(duration) ? duration : defaultTransitionDuration;
}

function tangent(before, slope, beforeTime, time) {
  if (!before || !slope || Math.sign(before) !== Math.sign(slope)) return 0;
  // A weighted harmonic mean preserves direction through unevenly timed stages.
  const beforeWeight = 2 * time + beforeTime;
  const weight = time + 2 * beforeTime;
  return (beforeWeight + weight) / (beforeWeight / before + weight / slope);
}

function curvedAxis(previous, start, end, next, timing, progress) {
  const [previousTime, time, nextTime] = timing;
  const slope = (end - start) / time;
  if (slope === 0) return start;
  const enter = previous === undefined ? 0 : tangent((start - previous) / previousTime, slope, previousTime, time);
  const leave = next === undefined ? 0 : tangent(slope, (next - end) / nextTime, time, nextTime);
  const square = progress ** 2;
  const cube = square * progress;
  const position = (2 * cube - 3 * square + 1) * start + (cube - 2 * square + progress) * time * enter +
    (-2 * cube + 3 * square) * end + (cube - square) * time * leave;
  return Math.max(Math.min(start, end), Math.min(position, Math.max(start, end)));
}

function onPitchById(phase) {
  return new Map((phase?.scene.players ?? []).filter(player => !player.benched).map(player => [player.id, player]));
}

function distance(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function validBallTiming(timing) {
  return timing && Number.isFinite(timing.release) && Number.isFinite(timing.arrival) &&
    timing.release >= 0 && timing.arrival <= 1 && timing.arrival - timing.release >= .099999 &&
    (timing.bend === undefined || (Number.isFinite(timing.bend) && Math.abs(timing.bend) <= 100));
}

const annotationMotions = new Map([['arrow', 'pass'], ['dribble', 'dribble'], ['lob', 'lob'], ['shot', 'shot']]);

function matchBallAnnotation(marks, from, to, length) {
  let closest;
  let score = Infinity;
  for (const mark of marks) {
    const kind = annotationMotions.get(mark.type);
    if (!kind) continue;
    const start = mark.points[0];
    const end = mark.points.at(-1);
    const markLength = distance(start, end);
    if (markLength < 8) continue;
    const startDistance = distance(from, start);
    const endDistance = distance(to, end);
    const alignment = ((to.x - from.x) * (end.x - start.x) + (to.y - from.y) * (end.y - start.y)) /
      (length * markLength);
    const error = startDistance + endDistance;
    if (alignment < .75 || startDistance > 50 || endDistance > Math.max(50, length * .4) || error >= score) continue;
    closest = kind;
    score = error;
  }
  return closest;
}

function ballMotion(phase,nextPhase,current,end,options) {
  const {ball:from,marks} = phase.scene;
  const {ball:to} = nextPhase.scene;
  const visible = players => new Map([...players].filter(([,player]) => options[player.team] !== false));
  const kicker = playerInControl(from,visible(current));
  const receiver = playerInControl(to,visible(end));
  const length = distance(from,to);
  if (length < .01 && (from.ownerId === undefined || to.ownerId === undefined)) {
    return {motion:'pass',from,to,ballTiming:phase.ballTiming};
  }
  const annotation = length > .01 ? matchBallAnnotation(marks.map(mark => resolveMark(mark,current)),from,to,length) : null;
  const type = phase.transition && phase.transition !== 'auto' ? phase.transition :
    (kicker && receiver?.id === kicker.id ? 'dribble' : annotation ?? (inGoal(to) ? 'shot' : 'pass'));
  return {motion:type,from,to,kicker,receiver:type === 'shot' ? undefined : receiver,ballTiming:phase.ballTiming};
}

export function motionBetweenStages(phases,index,options = {}) {
  if (!phases[index + 1]) return null;
  const motion = ballMotion(phases[index],phases[index + 1],onPitchById(phases[index]),onPitchById(phases[index + 1]),options);
  const {release,arrival} = motion.ballTiming ?? defaultBallTiming(motion.motion,distance(motion.from,motion.to));
  return {...motion,release:motion.motion === 'dribble' ? 0 : release,arrival:motion.motion === 'dribble' ? 1 : arrival};
}

export function createPlayback(phases, options = {}) {
  const {view} = options;
  const onPitch = phases.map(onPitchById);
  const segments = phases.slice(0,-1).map((phase,index) => {
    const from = phase.scene;
    const to = phases[index + 1].scene;
    const previous = onPitch[index - 1];
    const current = onPitch[index];
    const end = onPitch[index + 1];
    const next = onPitch[index + 2];
    const timing = [-1, 0, 1].map(offset => transitionDuration(phases, index + offset));
    const ball = ballMotion(phase,phases[index + 1],current,end,options);
    const paths = new Map();
    for (const [id,player] of current) {
      const target = end.get(id);
      if (!target || (player.x === target.x && player.y === target.y)) continue;
      const before = previous?.get(id);
      const after = next?.get(id);
      paths.set(id,t => ({
        x:curvedAxis(before?.x,player.x,target.x,after?.x,timing,t),
        y:curvedAxis(before?.y,player.y,target.y,after?.y,timing,t),
      }));
    }
    function positionAt(id,t) {
      if (t <= 0) return current.get(id);
      if (t >= 1) return end.get(id) ?? current.get(id);
      return paths.get(id)?.(t) ?? current.get(id);
    }
    return progress => {
      if (progress <= 0 || !Number.isFinite(progress)) return from;
      if (progress >= 1) return to;
      return {
        players:from.players.map(player => paths.has(player.id) ? {...player,...positionAt(player.id,progress)} : player),
        camera:interpolateCamera(from.camera,to.camera,progress,view === 'half' ? halfPitchBounds : fullPitchBounds),
        ball:sampleBallMotion({...ball,progress,positionAt}),
        marks:from.marks,
        matchLayer:from.matchLayer,
      };
    };
  });
  return (index,progress) => segments[index]?.(progress) ?? phases[index]?.scene ?? phases[0]?.scene;
}

export function interpolatePlayback(phases,index,progress,view) {
  return createPlayback(phases, typeof view === 'object' ? view : {view})(index,progress);
}
