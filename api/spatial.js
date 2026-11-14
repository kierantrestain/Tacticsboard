const origin = 'https://api.balldontlie.io';
const routes = new Map([
  ['epl', 'epl/v2'], ['laliga', 'laliga/v1'], ['seriea', 'seriea/v1'],
  ['bundesliga', 'bundesliga/v1'], ['ligue1', 'ligue1/v1'], ['ucl', 'ucl/v1'],
  ['mls', 'mls/v1'], ['fifa', 'fifa/worldcup/v1'],
]);
const worldCups = new Set([2018, 2022, 2026]);
const numericId = /^[1-9]\d{0,11}$/;
const limits = { cacheEntries: 120, cursors: 3, touches: 20000 };
const cache = new Map();
const outcomeNames = new Map([
  ['goal','Goal'], ['save','Saved'], ['miss','Off target'], ['block','Blocked'], ['post','Woodwork'],
]);

class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function dateParts(raw) {
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(raw ?? '')) return null;
  const date = new Date(raw + 'T12:00:00Z');
  if (Number.isNaN(+date) || date.toISOString().slice(0,10) !== raw) return null;
  return [date.getUTCFullYear(),date.getUTCMonth() + 1];
}

function providerError(status) {
  if (status === 429) return new ProviderError(429, 'The match-map provider is temporarily rate-limited.');
  if ([401,403].includes(status)) return new ProviderError(503, 'The available BALLDONTLIE key or plan does not provide this data.');
  return new ProviderError(502, 'The match-map provider did not return a usable response.');
}

async function fetchPage(url,key) {
  let response;
  try {
    response = await fetch(url, {
      headers:{ Authorization:key },
      signal:AbortSignal.timeout(8500),
    });
  } catch {
    throw new ProviderError(502, 'The match-map provider could not be reached.');
  }
  if (!response.ok) throw providerError(response.status);
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body?.data)) throw providerError(502);
  return body;
}

async function collect(route,endpoint,query,key) {
  const url = new URL('/' + route + '/' + endpoint,origin);
  url.searchParams.set('per_page','100');
  for (const [name,value] of Object.entries(query)) url.searchParams.set(name,value);
  const rows = [];
  for (let page = 0; page < limits.cursors; page++) {
    const body = await fetchPage(url,key);
    rows.push(...body.data);
    const next = String(body.meta?.next_cursor ?? '');
    if (!numericId.test(next) || next === url.searchParams.get('cursor')) break;
    url.searchParams.set('cursor',next);
  }
  return rows;
}

function memoized(key,ttl,factory) {
  const existing = cache.get(key);
  if (existing?.until > Date.now()) return existing.pending;
  if (cache.size >= limits.cacheEntries) cache.delete(cache.keys().next().value);
  const entry = { until:Date.now()+ttl*1000, pending:null };
  entry.pending = factory().catch(error => {
    // Briefly retain errors to avoid hammering an unauthorized or rate-limited feed.
    entry.until = Date.now()+15_000;
    throw error;
  });
  cache.set(key,entry);
  return entry.pending;
}

const number = value => typeof value === 'number' && Number.isFinite(value);
const name = value => typeof value === 'string' && value.trim() ? value.trim().slice(0,120) : '';
const asId = value => numericId.test(String(value)) ? String(value) : '';

function fixtureRecord(entry,teams) {
  const id = asId(entry.id);
  const homeId = asId(entry.home_team_id ?? entry.home_team?.id);
  const awayId = asId(entry.away_team_id ?? entry.away_team?.id);
  if (!id || !homeId || !awayId || homeId === awayId) return null;
  const awayAtHome = typeof entry.name === 'string' ? entry.name.split(' at ') : [];
  const home = name(entry.home_team?.name) || teams.get(homeId) || (awayAtHome.length === 2 ? name(awayAtHome[1]) : '') || 'Home';
  const away = name(entry.away_team?.name) || teams.get(awayId) || (awayAtHome.length === 2 ? name(awayAtHome[0]) : '') || 'Away';
  const state = name(entry.status_state);
  const played = !['scheduled','delayed','postponed','canceled'].includes(state);
  const score = played && number(entry.home_score) && number(entry.away_score)
    ? entry.home_score + '–' + entry.away_score : '';
  return {
    id, homeId, awayId, home, away, score,
    title: home + ' ' + (score || 'v') + ' ' + away,
    date:name(entry.date ?? entry.datetime), state,
  };
}

async function matches(league,date,parts,key) {
  const route = routes.get(league);
  const [year,month] = parts;
  if (league === 'fifa' && !worldCups.has(year)) return [];
  const seasons = { 'seasons[]':year };
  const time = league === 'fifa' ? seasons : {'dates[]':date};
  const currentSeason = league === 'mls' || month >= 7 ? year : year-1;
  const query = league === 'fifa' ? seasons : {season:currentSeason};
  const [rows,teamRows] = await Promise.all([
    collect(route,'matches',time,key),
    league === 'fifa' ? Promise.resolve([]) :
      memoized(league + '/teams/' + currentSeason,21600,() => collect(route,'teams',query,key)).catch(() => []),
  ]);
  const teams = new Map(teamRows.map(team => [asId(team.id),name(team.name)]));
  return rows.filter(entry => String(entry.date ?? entry.datetime ?? '').startsWith(date))
    .map(entry => fixtureRecord(entry,teams)).filter(Boolean).sort((a,b) => a.date.localeCompare(b.date));
}

function point(x,y,reverse = false) {
  if (!number(x) || !number(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
  return {
    x:Math.round((25+(reverse ? 100-x : x)*9.5)*100)/100,
    y:Math.round((24+(reverse ? 100-y : y)*5.77)*100)/100,
  };
}

function shotPeriod(minute,addedTime) {
  if (!number(minute) || minute < 0) return null;
  if (minute <= 45 || (number(addedTime) && addedTime > 0 && minute <= 45+addedTime)) return 1;
  if (minute <= 90 || (number(addedTime) && addedTime > 0 && minute <= 90+addedTime)) return 2;
  return minute <= 105 ? 3 : 4;
}

function matchPayload(groups,homeId,awayId) {
  const layers = groups.map(result => result.status === 'fulfilled' ? result.value : []);
  const [shotRows, heatRows, avgRows, lineups] = layers;
  const names = new Map(lineups.map(({player}) => [asId(player?.id),name(player?.display_name) ||
    name([player?.first_name,player?.last_name].filter(Boolean).join(' ')) || name(player?.short_name)]));
  const playerNames = player => names.get(asId(player.player_id)) || (asId(player.player_id) ? 'Player ' + player.player_id : 'Unknown player');
  const sides = new Map([[homeId,'home'],[awayId,'away']]);
  const playerSides = new Map([...lineups,...avgRows,...shotRows]
    .flatMap(row => {
      const id = asId(row.player_id ?? row.player?.id);
      const side = sides.get(asId(row.team_id)) ?? (typeof row.is_home === 'boolean' ? (row.is_home ? 'home' : 'away') : '');
      return id && side ? [[id,side]] : [];
    }));
  const getSide = row => sides.get(asId(row.team_id)) ?? playerSides.get(asId(row.player_id)) ??
    (typeof row.is_home === 'boolean' ? (row.is_home ? 'home' : 'away') : '');

  const shots = shotRows.flatMap(row => {
    const team = getSide(row);
    // Match shots use an attack-relative axis with the targeted goal at x=0.
    // This differs from average positions, which are home-perspective.
    const coordinate = point(row.player_x,row.player_y,team === 'home');
    if (!team || !coordinate) return [];
    const xg = number(row.xg) && row.xg >= 0 && row.xg <= 1 ? row.xg : null;
    return [{
      team, player:playerNames(row), ...coordinate, xg,
      outcome:outcomeNames.get(row.shot_type) ?? 'Other',
      minute:number(row.time_minute) ? row.time_minute : null,
      period:shotPeriod(row.time_minute,row.added_time),
    }];
  });
  const countByPlayer = new Map();
  const touches = [];
  for (const row of heatRows) {
    const team = getSide(row);
    if (!team || !Array.isArray(row.dots)) continue;
    const player = playerNames(row);
    let count = 0;
    for (const dot of row.dots) {
      if (touches.length >= limits.touches) break;
      const coordinate = point(dot?.x,dot?.y);
      if (!coordinate) continue;
      touches.push({ team,player,...coordinate });
      count++;
    }
    countByPlayer.set(asId(row.player_id),count);
  }
  const averagePositions = avgRows.flatMap(row => {
    const team = getSide(row);
    const coordinate = point(row.avg_x,row.avg_y);
    return team && coordinate ? [{
      team, player:playerNames(row), ...coordinate,
      count:countByPlayer.get(asId(row.player_id)) ?? null,
    }] : [];
  });
  const coverage = { shots:shots.length > 0, heat:touches.length > 0, average:averagePositions.length > 0 };
  const note = !coverage.shots && !coverage.heat && !coverage.average
    ? 'No map coordinates are published for this match yet.' : '';
  return { shots,touches,averagePositions,coverage,note };
}

async function maps(league,id,homeId,awayId,key) {
  const route = routes.get(league);
  const query = {'match_ids[]':id};
  const get = endpoint => collect(route,endpoint,query,key).then(rows =>
    rows.filter(row => !row.match_id || asId(row.match_id) === id));
  const groups = await Promise.allSettled([
    get('match_shots'), league === 'fifa' ? Promise.resolve([]) : get('match_heatmaps'),
    get('match_avg_positions'), get('match_lineups'),
  ]);
  const failures = groups.slice(0,3).filter(group => group.status === 'rejected');
  const data = matchPayload(groups,homeId,awayId);
  if (failures.length && !Object.values(data.coverage).some(Boolean)) throw failures[0].reason;
  if (failures.length) data.note = 'Some match-map layers could not be loaded from BALLDONTLIE.';
  return data;
}

function reply(response,status,data,ttl = 0) {
  response.setHeader('Cache-Control',ttl ? `public, max-age=30, s-maxage=${ttl}` : 'no-store');
  return response.status(status).json(data);
}

export default async function spatial(request,response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow','GET');
    return reply(response,405,{error:'Use GET for match maps.'});
  }
  const query = new URL(request.url,'https://touchline.invalid').searchParams;
  const action = query.get('action');
  const key = process.env.SPATIAL_FOOTBALL_KEY;
  if (action === 'status') return reply(response,200,{available:Boolean(key)});
  if (!['matches','map'].includes(action)) return reply(response,400,{error:'Choose a supported match-map action.'});
  const league = query.get('league');
  if (!routes.has(league)) return reply(response,400,{error:'Choose a supported match-map competition.'});
  if (!key) return reply(response,503,{error:'The live match-map feed has not been connected.'});
  try {
    const date = query.get('date');
    const parts = dateParts(date);
    if (!parts) return reply(response,400,{error:'Choose a valid match date.'});
    const id = asId(query.get('id'));
    if (action === 'map' && !id) return reply(response,400,{error:'Choose a match from the fixture list.'});
    const fixtures = await memoized(`matches/${league}/${date}`,300,() => matches(league,date,parts,key));
    if (action === 'matches') return reply(response,200,{data:fixtures});
    const fixture = fixtures.find(item => item.id === id);
    if (!fixture) return reply(response,404,{error:'The selected match is not in that fixture list.'});
    const {homeId,awayId} = fixture;
    const data = await memoized(`map/${league}/${id}`,120,() => maps(league,id,homeId,awayId,key));
    return reply(response,200,{data});
  } catch (error) {
    return reply(response,error.status ?? 502,{error:error instanceof ProviderError ? error.message : 'The match map could not be loaded.'});
  }
}
