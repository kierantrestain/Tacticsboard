const origin = 'https://v3.football.api-sports.io/';
const allowed = new Map([
  ['leagues', {endpoint:'leagues',ttl:86400,params:{}}],
  ['teams', {endpoint:'teams',ttl:21600,params:{league:'id',season:'season'}}],
  ['search', {endpoint:'teams',ttl:21600,params:{search:'search'}}],
  ['squad', {endpoint:'players/squads',ttl:10800,params:{team:'id'}}],
  ['fixtures', {endpoint:'fixtures',ttl:900,params:{team:'id'},optional:{league:'id',season:'season'},extra:{last:'12'}}],
  ['lineups', {endpoint:'fixtures/lineups',ttl:1800,params:{fixture:'id'}}],
]);
const validation = {
  id: /^[1-9]\d{0,8}$/,
  season: /^(?:19|20)\d{2}$/,
  search: /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'-]{2,48}$/u,
};
const shared = new Map();
const maxEntries = 240;

function failure(response,status,error) {
  response.setHeader('Cache-Control','no-store');
  return response.status(status).json({error});
}

function upstreamRequest(url,key) {
  const cacheKey = url.href;
  const existing = shared.get(cacheKey);
  if (existing && existing.until > Date.now()) return existing.pending;
  if (existing) shared.delete(cacheKey);
  const pending = fetch(url, {
    headers:{'x-apisports-key':key},
    signal:AbortSignal.timeout(9000),
  }).then(async response => {
    const body = await response.json();
    const fields = Object.keys(body?.errors ?? {});
    const quota = response.status === 429 || fields.some(field => /limit|requests/i.test(field));
    if (quota) return {status:429,error:'The football data limit has been reached. Try again later.'};
    if (fields.includes('plan')) return {status:422,error:'This season is unavailable on the configured API-Football plan.'};
    if (!response.ok || fields.length || !Array.isArray(body?.response)) {
      return {status:502,error:'API-Football did not return data for this request.'};
    }
    return {data:body.response};
  }).catch(() => ({status:502,error:'The football data service is temporarily unavailable.'}));
  if (shared.size >= maxEntries) shared.delete(shared.keys().next().value);
  shared.set(cacheKey,{pending,until:Date.now()+60_000});
  return pending;
}

export default async function football(request,response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow','GET');
    return failure(response,405,'Use GET for football data.');
  }
  const url = new URL(request.url,'https://touchline.invalid');
  const route = allowed.get(url.searchParams.get('action'));
  if (!route) return failure(response,400,'Choose a supported football data action.');
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return failure(response,503,'Live football data is unavailable on this deployment.');
  const upstream = new URL(route.endpoint,origin);
  const canonical = new URLSearchParams({action:url.searchParams.get('action')});
  for (const [name,type] of Object.entries(route.params)) {
    const raw = url.searchParams.get(name) ?? '';
    const value = type === 'search' ? raw.trim().toLowerCase().replace(/\s+/g,' ') : raw;
    if (!validation[type].test(value)) return failure(response,400,`Invalid ${name}.`);
    canonical.set(name,value);
    upstream.searchParams.set(name,value);
  }
  if (route.optional) {
    const optionals = Object.entries(route.optional);
    if (optionals.some(([name]) => url.searchParams.has(name))) {
      for (const [name,type] of optionals) {
        const value = url.searchParams.get(name) ?? '';
        if (!validation[type].test(value)) return failure(response,400,`Invalid ${name}.`);
        canonical.set(name,value);
        upstream.searchParams.set(name,value);
      }
    }
  }
  // Canonical URLs share the same cache entry even when a client adds unrelated parameters.
  if (url.searchParams.toString() !== canonical.toString()) {
    response.setHeader('Location',`/api/football?${canonical}`);
    response.setHeader('Cache-Control','public, max-age=3600');
    return response.status(308).end();
  }
  for (const [name,value] of Object.entries(route.extra ?? {})) upstream.searchParams.set(name,value);
  const result = await upstreamRequest(upstream,key);
  if (result.error) return failure(response,result.status,result.error);
  response.setHeader('Cache-Control',`public, max-age=60, s-maxage=${route.ttl}, stale-while-revalidate=3600`);
  return response.status(200).json({data:result.data});
}
