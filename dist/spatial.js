export const spatialLeagues = [
  {id:'epl',name:'Premier League',url:'https://epl.balldontlie.io/'},
  {id:'laliga',name:'La Liga',url:'https://laliga.balldontlie.io/'},
  {id:'seriea',name:'Serie A',url:'https://seriea.balldontlie.io/'},
  {id:'bundesliga',name:'Bundesliga',url:'https://bundesliga.balldontlie.io/'},
  {id:'ligue1',name:'Ligue 1',url:'https://ligue1.balldontlie.io/'},
  {id:'ucl',name:'Champions League',url:'https://ucl.balldontlie.io/'},
  {id:'mls',name:'MLS',url:'https://mls.balldontlie.io/'},
  {id:'fifa',name:'FIFA World Cup',url:'https://fifa.balldontlie.io/'},
];
const matchesByKey = new Map();

async function request(action,params = {}) {
  const query = new URLSearchParams({action,...params});
  const response = await fetch(`/api/spatial?${query}`,{signal:AbortSignal.timeout(28500)});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The live match-map feed could not be loaded.');
  return body;
}

export async function getSpatialStatus() {
  try { return (await request('status')).available === true; }
  catch { return false; }
}

export async function findSpatialMatches({league,date}) {
  const competition = spatialLeagues.find(item => item.id === league);
  if (!competition) throw new Error('Choose a match-map competition.');
  const { data } = await request('matches',{league,date});
  if (!Array.isArray(data)) throw new Error('No match list was returned.');
  return data.map(match => {
    const record = {...match,league,competition:competition.name};
    matchesByKey.set(`${league}/${match.id}`,record);
    if (matchesByKey.size > 180) matchesByKey.delete(matchesByKey.keys().next().value);
    return record;
  });
}

export async function loadSpatialMatch({league,id}) {
  const competition = spatialLeagues.find(item => item.id === league);
  const match = matchesByKey.get(`${league}/${id}`);
  if (!competition || !match) throw new Error('Choose a match from the fixture list.');
  const date = String(match.date).slice(0,10);
  const { data } = await request('map',{league,id,date});
  if (!data) throw new Error('The selected fixture returned no match-map data.');
  return {
    ...match,...data,
    source:{name:'BALLDONTLIE',url:competition.url,
      notes:'Heatmap dots and average positions are provided for the whole match.'},
  };
}
