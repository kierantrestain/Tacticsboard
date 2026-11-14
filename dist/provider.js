const cache = new Map();

async function request(action,params) {
  const query = new URLSearchParams({action,...params});
  const result = await fetch(`/api/football?${query}`,{signal:AbortSignal.timeout(14000)});
  const body = await result.json().catch(() => ({}));
  if (!result.ok || !Array.isArray(body.data)) {
    throw new Error(body.error ?? 'Live football data is unavailable. Try the open catalog.');
  }
  return body.data;
}

function fetchProvider(action,params = {}) {
  const id = JSON.stringify([action,params]);
  if (!cache.has(id)) {
    const pending = request(action,params).catch(error => {
      if (cache.get(id) === pending) cache.delete(id);
      throw error;
    });
    cache.set(id,pending);
  }
  return cache.get(id);
}

const role = position => ({
  goalkeeper:'GK', goalie:'GK', g:'GK', defender:'DF', defence:'DF', d:'DF',
  midfielder:'MF', midfield:'MF', m:'MF', attacker:'FW', forward:'FW', f:'FW',
})[String(position).toLowerCase()] ?? '';

function hex(value) {
  return typeof value === 'string' && /^#?[\da-f]{6}$/i.test(value) ? '#' + value.replace(/^#/,'').toLowerCase() : '';
}

function kit(value) {
  const player = value?.player;
  const keeper = value?.goalkeeper;
  const primary = hex(player?.primary);
  if (!primary) return null;
  return {primary, secondary:hex(player.border), number:hex(player.number),
    goalkeeper:hex(keeper?.primary), goalkeeperNumber:hex(keeper?.number), source:'Fixture kit'};
}

function teamRecord(value) {
  const team = value.team ?? value;
  const id = String(team.id);
  const logo = `https://media.api-sports.io/football/teams/${id}.png`;
  return {
    id, name:String(team.name ?? ''), shortName:String(team.code ?? ''), country:String(team.country ?? ''),
    logo:/^[1-9]\d*$/.test(id) && team.logo === logo ? logo : '',
    colors:kit(team.colors), provider:true,
  };
}

function playerRecord(value) {
  const player = value.player ?? value;
  const number = Number(player.number);
  return {
    id:String(player.id), name:String(player.name ?? ''),
    number:Number.isInteger(number) && number > 0 && number < 1000 ? number : 0,
    role:role(player.position ?? player.pos), grid:String(player.grid ?? ''),
  };
}

export async function hasProvider() {
  try { return Boolean((await getProviderLeagues()).length); }
  catch { return false; }
}

export async function getProviderLeagues() {
  const data = await fetchProvider('leagues');
  return data.filter(item => item.league?.id && item.league.name).map(item => ({
    id:String(item.league.id), name:String(item.league.name), country:String(item.country?.name ?? ''),
    type:String(item.league.type ?? ''),
    seasons:(item.seasons ?? []).map(season => Number(season.year)).filter(Number.isInteger).sort((a,b) => b-a),
  })).sort((a,b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

export async function getProviderTeams(league,season) {
  return (await fetchProvider('teams',{league,season})).map(teamRecord).filter(team => team.id !== 'undefined' && team.name);
}

export async function searchProviderTeams(search) {
  return (await fetchProvider('search',{search:search.trim().toLowerCase().replace(/\s+/g,' ')}))
    .map(teamRecord).filter(team => team.id !== 'undefined' && team.name);
}

export async function getProviderSquad(team) {
  const data = await fetchProvider('squad',{team});
  return data.flatMap(item => (item.players ?? []).map(playerRecord)).filter(player => player.name);
}

export async function getProviderFixtures(team,league,season) {
  const recent = await fetchProvider('fixtures',league && season ? {team,league,season} : {team});
  return recent.filter(item => item.fixture?.id && item.teams?.home?.name && item.teams?.away?.name).map(item => ({
    id:String(item.fixture.id), date:String(item.fixture.date ?? ''), home:teamRecord(item.teams.home), away:teamRecord(item.teams.away),
  }));
}

export async function getProviderLineups(fixture) {
  const data = await fetchProvider('lineups',{fixture});
  return data.filter(item => item.team?.id).map(item => ({
    team:teamRecord(item.team), formation:String(item.formation ?? ''),
    starter:(item.startXI ?? []).map(playerRecord).filter(player => player.name),
    bench:(item.substitutes ?? []).map(playerRecord).filter(player => player.name),
  }));
}

export async function getProviderMatchDetails(fixture) {
  const [events,statistics] = await Promise.allSettled([
    fetchProvider('events',{fixture}),fetchProvider('statistics',{fixture}),
  ]);
  if (events.status === 'rejected' && statistics.status === 'rejected') throw events.reason;
  return {events:events.status === 'fulfilled' ? events.value : null,
    statistics:statistics.status === 'fulfilled' ? statistics.value : null};
}
