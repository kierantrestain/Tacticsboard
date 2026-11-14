import { fullPitchBounds, halfPitchBounds, interpolateCamera, pitchStyles, validCamera } from './camera.js';
import { sampleBallMotion } from './ball-motion.js';
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

function samplePhase(scene, title, notes, moves = {}, ball = scene.ball) {
  const copy = structuredClone(scene);
  copy.players = copy.players.map(player => ({ ...player, ...moves[player.id] }));
  copy.ball = { ...ball };
  return { id: makeId(), title, notes, scene: copy };
}

export function initialBoard() {
  const template = templates[0];
  const scene = template.scene;
  const first = samplePhase(scene, 'Starting shape',
    'Split the centre-backs and give the pivot an angle to receive. Keep the wide players on the touchline.');
  const second = samplePhase(scene, 'Draw the press',
    'Play into the pivot as the first line of pressure shifts. The right-back steps forward to offer the next pass.',
    {
      'home-2': { x: 340, y: 485 },
      'home-6': { x: 335, y: 338 },
      'home-8': { x: 405, y: 396 },
      'away-9': { x: 450, y: 258 },
      'away-11': { x: 494, y: 394 },
    }, { x: 354, y: 347 });
  const third = samplePhase(scene, 'Break the line',
    'Find the wide runner behind the pressure and support the move with an inside option.',
    {
      'home-2': { x: 431, y: 492 },
      'home-6': { x: 359, y: 359 },
      'home-7': { x: 649, y: 528 },
      'home-8': { x: 532, y: 407 },
      'away-7': { x: 648, y: 483 },
      'away-9': { x: 466, y: 283 },
      'away-11': { x: 552, y: 439 },
    }, { x: 668, y: 516 });
  return {
    title: template.name,
    phases: [first, second, third],
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
  if (!scene || !(scene.camera === undefined || validCamera(scene.camera)) || !validMatchLayer(scene.matchLayer) || !isPoint(scene.ball) || !Array.isArray(scene.players) ||
      scene.players.length > 60 || !Array.isArray(scene.marks) || scene.marks.length > 500) {
    return false;
  }
  const validPlayers = scene.players.every(player =>
    isPoint(player) && isId(player.id) && ['home', 'away'].includes(player.team) &&
    Number.isInteger(player.number) && player.number >= 0 && player.number <= 999 &&
    isString(player.name, 100) && isOptionalBoolean(player.benched) &&
    (player.footballRole === undefined || footballRoles.includes(player.footballRole)));
  const validMarks = scene.marks.every(mark =>
    mark && isId(mark.id) && markTypes.has(mark.type) && isColor(mark.color) &&
    (mark.text == null || isString(mark.text, 500)) &&
    Array.isArray(mark.points) && mark.points.length >= (pointMarkTypes.has(mark.type) ? 1 : 2) &&
    mark.points.length <= 4000 && mark.points.every(isPoint));
  return validPlayers && validMarks && hasDistinctIds(scene.players) && hasDistinctIds(scene.marks);
}

function isSettings(settings) {
  return settings && isString(settings.homeName, 100) && isString(settings.awayName, 100) &&
    isColor(settings.homeColor) && isColor(settings.awayColor) &&
    formations.includes(settings.homeFormation) && formations.includes(settings.awayFormation) &&
    ['full', 'half'].includes(settings.view) && isBoolean(settings.labels) &&
    isBoolean(settings.away) && isBoolean(settings.grid) &&
    (settings.guideMode === undefined || guideModes.includes(settings.guideMode)) &&
    isOptionalBoolean(settings.home) && isOptionalBoolean(settings.snap) &&
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
  const validPhases = board.phases.every(phase =>
    phase && isId(phase.id) && isString(phase.title) && isString(phase.notes, 20_000) &&
    (phase.transition === undefined || ballMotionKinds.includes(phase.transition)) &&
    (phase.duration === undefined || validDuration(phase.duration)) && isScene(phase.scene));
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

function touches(start, end, players, targets) {
  let nearest;
  let shortest = Infinity;
  for (const player of players.values()) {
    const target = targets.get(player.id);
    if (!target) continue;
    const startDistance = distance(start, player);
    const endDistance = distance(end, target);
    const totalDistance = startDistance + endDistance;
    if (startDistance > 46 || endDistance > 46 || totalDistance >= shortest) continue;
    nearest = { player, target };
    shortest = totalDistance;
  }
  return nearest;
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

export function interpolatePlayback(phases, index, progress, view) {
  const phase = phases[index];
  if (!phase) return phases[0]?.scene;
  const from = phase.scene;
  const to = phases[index + 1]?.scene;
  if (!to || progress <= 0 || !Number.isFinite(progress)) return from;
  if (progress >= 1) return to;

  const previous = onPitchById(phases[index - 1]);
  const current = onPitchById(phase);
  const end = onPitchById(phases[index + 1]);
  const next = onPitchById(phases[index + 2]);
  const timing = [-1, 0, 1].map(offset => transitionDuration(phases, index + offset));
  function positionAt(id,t) {
    const player = current.get(id);
    if (!player) return undefined;
    const target = end.get(id);
    if (!target || t <= 0) return player;
    if (t >= 1) return target;
    const before = previous.get(id);
    const after = next.get(id);
    return {x:curvedAxis(before?.x,player.x,target.x,after?.x,timing,t),
      y:curvedAxis(before?.y,player.y,target.y,after?.y,timing,t)};
  }
  const players = from.players.map(player => ({...player,...positionAt(player.id,progress)}));
  const length = distance(from.ball,to.ball);
  const carrier = touches(from.ball,to.ball,current,end);
  const kind = phase.transition && phase.transition !== 'auto' ? phase.transition :
    (length > .01 ? matchBallAnnotation(from.marks,from.ball,to.ball,length) : null) ?? (carrier ? 'dribble' : 'pass');
  return {
    players,
    camera:interpolateCamera(from.camera,to.camera,progress,view === 'half' ? halfPitchBounds : fullPitchBounds),
    ball:sampleBallMotion({from:from.ball,to:to.ball,progress,motion:kind,current,end,positionAt}),
    marks: from.marks,
    matchLayer: from.matchLayer,
  };
}
