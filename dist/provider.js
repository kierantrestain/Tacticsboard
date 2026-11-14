const endpoint = 'https://v3.football.api-sports.io/';
export const providerDocs = 'https://www.api-football.com/documentation-v3';
export const providerDashboard = 'https://dashboard.api-football.com/';

let activeKey = '';
let connectionRevision = 0;
const cache = new Map();

async function request(key, route, params) {
  const url = new URL(route, endpoint);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const result = await fetch(url, {
    headers: { 'x-apisports-key': key },
    signal: AbortSignal.timeout(15000),
    credentials: 'omit',
    cache: 'no-store',
  });
  const body = await result.json().catch(() => ({}));
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {});
  if (errors.length) throw new Error(errors.filter(error => typeof error === 'string').join(' ') || 'API-Football rejected the request.');
  if (!result.ok || !Array.isArray(body.response)) throw new Error(`API-Football returned HTTP ${result.status}.`);
  return body.response;
}

function fetchProvider(route, params = {}) {
  if (!activeKey) return Promise.reject(new Error('Connect an API-Football key first.'));
  const id = JSON.stringify([route, params]);
  if (!cache.has(id)) {
    const pending = request(activeKey, route, params).catch(error => {
      if (cache.get(id) === pending) cache.delete(id);
      throw error;
    });
    cache.set(id, pending);
  }
  return cache.get(id);
}

const role = position => ({
  goalkeeper: 'GK', goalie: 'GK', g: 'GK',
  defender: 'DF', defence: 'DF', d: 'DF',
  midfielder: 'MF', midfield: 'MF', m: 'MF',
  attacker: 'FW', forward: 'FW', f: 'FW',
})[String(position).toLowerCase()] ?? '';

function teamRecord(value) {
  const team = value.team ?? value;
  const id = String(team.id);
  return {
    id, name: String(team.name ?? ''),
    shortName: String(team.code ?? ''),
    country: String(team.country ?? ''),
    provider: true,
  };
}

function playerRecord(value) {
  const player = value.player ?? value;
  const number = Number(player.number);
  return {
    id: String(player.id), name: String(player.name ?? ''),
    number: Number.isInteger(number) && number > 0 && number < 1000 ? number : 0,
    role: role(player.position ?? player.pos),
    grid: String(player.grid ?? ''),
  };
}

function leagueRecords(data) {
  const leagues = data.filter(item => item.league?.id && item.league.name).map(item => ({
    id: String(item.league.id),
    name: String(item.league.name),
    country: String(item.country?.name ?? ''),
    seasons: (item.seasons ?? []).map(season => Number(season.year)).filter(Number.isInteger).sort((a, b) => b - a),
  }));
  return leagues.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

export function hasProvider() {
  return Boolean(activeKey);
}

export async function connectProvider(key) {
  const clean = key.trim();
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(clean)) throw new Error('Enter a valid API-Football key.');
  const revision = ++connectionRevision;
  const params = {};
  const response = await request(clean, 'leagues', params);
  if (revision !== connectionRevision) throw new Error('This connection was replaced.');
  activeKey = clean;
  cache.clear();
  cache.set(JSON.stringify(['leagues', params]), Promise.resolve(response));
  return leagueRecords(response);
}

export function disconnectProvider() {
  connectionRevision += 1;
  activeKey = '';
  cache.clear();
}

export async function getProviderLeagues() {
  return leagueRecords(await fetchProvider('leagues'));
}

export async function getProviderTeams(league, season) {
  return (await fetchProvider('teams', { league, season })).map(teamRecord).filter(team => team.id !== 'undefined' && team.name);
}

export async function getProviderSquad(team) {
  const data = await fetchProvider('players/squads', { team });
  return data.flatMap(item => (item.players ?? []).map(playerRecord)).filter(player => player.name);
}

export async function getProviderFixtures(team, league, season) {
  const recent = await fetchProvider('fixtures', { team, league, season, last: 10 });
  return recent.filter(item => item.fixture?.id && item.teams?.home?.name && item.teams?.away?.name).map(item => ({
    id: String(item.fixture.id),
    date: String(item.fixture.date ?? ''),
    home: teamRecord(item.teams.home),
    away: teamRecord(item.teams.away),
  }));
}

export async function getProviderLineups(fixture) {
  const data = await fetchProvider('fixtures/lineups', { fixture });
  return data.filter(item => item.team?.id).map(item => ({
    team: teamRecord(item.team),
    formation: String(item.formation ?? ''),
    starter: (item.startXI ?? []).map(playerRecord).filter(player => player.name),
    bench: (item.substitutes ?? []).map(playerRecord).filter(player => player.name),
  }));
}
