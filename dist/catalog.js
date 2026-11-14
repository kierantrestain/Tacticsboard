import { competitionRows, sourceRows, squadRows } from './catalog-data.js';

export const catalogSources = Object.fromEntries(Object.entries(sourceRows).map(([id, row]) => {
  const [name, url, license] = row;
  return [id, { name, url, license,
    licenseUrl: license === 'CC BY 4.0' ? 'https://creativecommons.org/licenses/by/4.0/' :
      'https://creativecommons.org/publicdomain/zero/1.0/',
  }];
}));

export const catalogSource = {
  name: 'OpenFootball and Football Charts',
  url: 'https://github.com/openfootball',
  license: 'CC0 1.0 and CC BY 4.0',
  sources: Object.values(catalogSources),
};

const worldCup = {
  id: 'worldcup.2026', name: 'FIFA World Cup', country: 'International', season: '2026', source: catalogSources.worldcup,
};

function fold(value) {
  return String(value ?? '').normalize('NFD').toLowerCase().replace(/\p{M}+/gu, '')
    .replace(/[ßøđł]/g, character => ({ ß:'ss', ø:'o', đ:'d', ł:'l' })[character])
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function compactId(name) {
  return fold(name).replaceAll(' ', '-');
}

const clubPrefixes = /^(ac|afc|as|ca|cd|cf|club|fc|fk|pae|sc|sk|ss|tsg|ud)$/i;
const clubSuffixes = /^(ac|afc|as|bc|ca|cd|cf|fc|fk|kv|sc|sk|ss)$/i;
const knownAbbreviations = {
  'manchester-city-fc': 'MCI', 'manchester-united-fc': 'MUN', 'real-madrid-cf': 'RMA',
  'paris-saint-germain-fc': 'PSG', 'afc-ajax': 'AJA', 'fc-bayern-munchen': 'BAY',
  'fc-internazionale-milano': 'INT', 'atletico-de-madrid': 'ATM', 'club-atletico-de-madrid': 'ATM',
  'tottenham-hotspur-fc': 'TOT', 'sporting-clube-de-portugal': 'SCP',
  'brighton-hove-albion-fc': 'BHA', 'wolverhampton-wanderers-fc': 'WOL',
};
const commonClubAliases = {
  'manchester-city-fc': 'man city|mancity',
  'manchester-united-fc': 'man united|man utd|manu',
  'real-madrid-cf': 'real madrid|los blancos',
  'paris-saint-germain-fc': 'psg|paris sg',
  'fc-bayern-munchen': 'bayern munich',
  'fc-internazionale-milano': 'inter milan',
  'club-atletico-de-madrid': 'atletico madrid|atleti',
  'sporting-clube-de-portugal': 'sporting lisbon',
  'sport-lisboa-e-benfica': 'benfica',
  'wolverhampton-wanderers-fc': 'wolves',
  'brighton-hove-albion-fc': 'brighton',
  'fc-barcelona': 'barca',
  'athletic-club': 'athletic bilbao',
  'psv': 'eindhoven',
};
const commonCountryAliases = {
  'CZE':'Czechia', 'CIV':"Côte d’Ivoire", 'KOR':'Korea Republic|Korea',
  'TUR':'Türkiye|Turkey', 'CPV':'Cabo Verde', 'USA':'US|United States of America'
};

function shortClubName(name, key) {
  if (knownAbbreviations[key]) return knownAbbreviations[key];
  const words = name.replace(/\s+\([A-Z]{3}\)$/, '').split(/\s+/);
  if (words.length > 1 && clubPrefixes.test(words[0])) words.shift();
  if (words.length > 1 && clubSuffixes.test(words.at(-1))) words.pop();
  const readable = fold(words.find(word => /\p{L}/u.test(word)) ?? name).replaceAll(' ', '');
  return readable.slice(0, 3).toUpperCase();
}

const clubLeagues = competitionRows.map(([id, name, country, season, sourceId, clubs]) => {
  const source = catalogSources[sourceId];
  const teams = clubs.map(club => {
    const key = compactId(club);
    return {
      id: id + '/' + key,
      name: club,
      country,
      leagueId: id,
      league: name,
      season,
      shortName: shortClubName(club, key),
      hasSquad: false,
      kind: 'club',
      source,
    };
  });
  return { id, name, country, season, source, teams };
});

const nationalTeams = squadRows.map(([code, name]) => ({
  id: worldCup.id + '/' + code,
  name,
  country: name,
  leagueId: worldCup.id,
  league: worldCup.name,
  season: worldCup.season,
  shortName: code,
  hasSquad: true,
  kind: 'national',
  source: worldCup.source,
}));

export const leagues = [...clubLeagues, { ...worldCup, teams:nationalTeams }];
export const catalogStats = {
  competitions: leagues.length,
  clubCompetitions: clubLeagues.length,
  clubEntries: clubLeagues.reduce((count, league) => count + league.teams.length, 0),
  nationalTeams: nationalTeams.length,
  squadPlayers: squadRows.reduce((count, row) => count + row[2].length, 0),
};

const squads = new Map(squadRows.map(([code, name, players]) => [worldCup.id + '/' + code, {
  name,
  season: worldCup.season,
  source: worldCup.source,
  players: players.map(([name, number, position]) => ({ name, number, position })),
}]));

export function getCatalogSquad(teamId) {
  return squads.get(teamId) ?? null;
}

const indexedTeams = leagues.flatMap(league => league.teams).map(team => {
  const name = fold(team.name);
  const shortName = fold(team.shortName);
  const aliases = ((team.kind === 'club'
    ? commonClubAliases[compactId(team.name.replace(/\s+\([A-Z]{3}\)$/, ''))]
    : commonCountryAliases[team.shortName]) || '').split('|').filter(Boolean).map(fold);
  const context = fold(team.league + ' ' + team.country + ' ' + team.season);
  return { team, name, shortName, aliases, context };
});

function scoreTeam(entry, search, terms) {
  if (entry.name === search || entry.shortName === search) return 9;
  if (entry.aliases.includes(search)) return 8;
  if (entry.name.startsWith(search)) return 7;
  const matchesName = term => entry.name.includes(term) || entry.aliases.some(alias => alias.includes(term));
  if (matchesName(search)) return 6;
  if (terms.every(matchesName)) return 5;
  if (terms.every(term => matchesName(term) || entry.context.includes(term))) return 3;
  return 0;
}

export function searchTeams(query, leagueId = '') {
  const search = fold(query);
  const entries = leagueId ? indexedTeams.filter(entry => entry.team.leagueId === leagueId) : indexedTeams;
  if (!search) return entries.map(entry => entry.team);
  const terms = search.split(' ');
  return entries.map(entry => ({ team:entry.team, score:scoreTeam(entry, search, terms) }))
    .filter(entry => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .map(entry => entry.team);
}
