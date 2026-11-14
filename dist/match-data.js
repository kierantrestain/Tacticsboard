import { matchSampleRows } from './match-samples.js';

export const matchSamples = matchSampleRows.map(([sample]) => sample);
const samplesById = new Map(matchSampleRows.map(row => [row[0].id, row]));
const ballActions = new Set([
  'Ball Receipt*', 'Ball Recovery', 'Carry', 'Clearance', 'Dispossessed',
  'Dribble', 'Interception', 'Miscontrol', 'Pass', 'Shot',
]);
const pitch = { left:25, top:24, width:950, height:577 };
const statsBombSource = {
  name: 'Hudl StatsBomb event data',
  url: 'https://github.com/hudl/open-data',
  notes: 'Imported event locations. Heatmaps and average positions use recorded on-ball actions.',
};

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function expectedGoals(value) {
  return numeric(value) && value >= 0 && value <= 1 ? value : null;
}

function normalizeName(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0,120) : fallback;
}

function averagePositions(touches) {
  const players = new Map();
  for (const { team, player, x, y } of touches) {
    const key = team + '\0' + player;
    const position = players.get(key) ?? { team, player, x:0, y:0, count:0 };
    position.x += x;
    position.y += y;
    position.count++;
    players.set(key,position);
  }
  return [...players.values()]
    .map(({ team, player, x, y, count }) => ({ team, player, x:x/count, y:y/count, count }))
    .sort((first,second) => second.count - first.count);
}

function unpackPosition(row, names) {
  const [team, player, x, y, minute, period] = row;
  return { team, player:names[player], x, y, minute, period };
}

export async function loadMatchSample(id) {
  const row = samplesById.get(id);
  if (!row) throw new Error('That example match is unavailable.');
  const [sample, names, shotRows, touchRows] = row;
  const touches = touchRows.map(item => unpackPosition(item,names));
  const shots = shotRows.map(item => ({
    ...unpackPosition(item,names), xg:item[6], outcome:item[7],
  }));
  return { ...sample, shots, touches, averagePositions:averagePositions(touches) };
}

function labeledSides(events, meta) {
  const count = new Map();
  const lineups = [];
  for (const event of events) {
    const name = normalizeName(event?.team?.name, '');
    if (!name) continue;
    if (event.type?.name === 'Starting XI' && !lineups.includes(name)) lineups.push(name);
    count.set(name,(count.get(name) ?? 0) + 1);
  }
  const candidates = [...new Set([...lineups, ...[...count].sort((a,b) => b[1]-a[1]).map(item => item[0])])];
  const home = count.has(meta.home) ? meta.home : candidates[0];
  const away = meta.away !== home && count.has(meta.away) ? meta.away : candidates.find(name => name !== home);
  return { home, away };
}

function projectPosition(location, team) {
  if (!Array.isArray(location)) return null;
  const [x, y] = location;
  if (!numeric(x) || !numeric(y) || x < 0 || x > 120 || y < 0 || y > 80) return null;
  // StatsBomb normalises actions for both teams toward x=120. Restore the
  // board convention with the home side attacking right and away left.
  const right = team === 'home';
  return {
    x:pitch.left + (right ? x/120 : 1-x/120)*pitch.width,
    y:pitch.top + (right ? y/80 : 1-y/80)*pitch.height,
  };
}

/**
 * Parse a single match StatsBomb event array, or a JSON wrapper
 * { home, away, date, competition, title, events }. Wrapper labels are optional.
 * The source receives no upload. All projections and aggregations happen locally.
 */
export function parseMatchEvents(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const events = Array.isArray(data) ? data : data?.events;
  if (!Array.isArray(events) || events.length === 0 || events.length > 25000) {
    throw new Error('Choose one StatsBomb match event JSON file.');
  }
  const meta = Array.isArray(data) ? {} : data;
  const { home, away } = labeledSides(events,meta);
  if (!home || !away) throw new Error('Both teams must appear in the match events.');
  const touches = [], shots = [];
  const seen = new Set();
  for (const event of events) {
    if (event?.period === 5 || !ballActions.has(event?.type?.name)) continue;
    const teamName = normalizeName(event.team?.name,'');
    const team = teamName === home ? 'home' : teamName === away ? 'away' : '';
    const player = normalizeName(event.player?.name,'');
    const coordinate = team && projectPosition(event.location,team);
    if (!coordinate || !player) continue;
    if (event.id && seen.has(event.id)) continue;
    if (event.id) seen.add(event.id);
    const point = {
      team, player, ...coordinate,
      minute:numeric(event.minute) && event.minute >= 0 ? event.minute : null,
      period:numeric(event.period) && event.period > 0 ? event.period : null,
    };
    touches.push(point);
    if (event.type.name === 'Shot') {
      shots.push({
        ...point,
        xg:expectedGoals(event.shot?.statsbomb_xg),
        outcome:normalizeName(event.shot?.outcome?.name,'Other'),
      });
    }
  }
  if (!touches.length) throw new Error('No usable on-ball event coordinates were found in the file.');
  return {
    id:'imported', title:normalizeName(meta.title,home + ' v ' + away),
    competition:normalizeName(meta.competition,'Imported match'),
    date:normalizeName(meta.date,''), home, away,
    shots, touches, averagePositions:averagePositions(touches),
    source:statsBombSource,
  };
}
