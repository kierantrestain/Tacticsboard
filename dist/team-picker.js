import { catalogSource, getCatalogSquad, leagues, searchTeams } from './catalog.js';
import { getClubKit } from './kits.js';
import { suggestCrestKit } from './crest-color.js';
import {
  getProviderFixtures, getProviderLeagues, getProviderLineups, getProviderSquad,
  getProviderTeams, searchProviderTeams,
} from './provider.js';

const popular = [
  { name:'Premier League', country:'England', catalog:'en.1', mark:'PL', tint:'#5b2468' },
  { name:'La Liga', country:'Spain', catalog:'es.1', mark:'LL', tint:'#a63736' },
  { name:'Bundesliga', country:'Germany', catalog:'de.1', mark:'BL', tint:'#9d363e' },
  { name:'Serie A', country:'Italy', catalog:'it.1', mark:'SA', tint:'#275c96' },
  { name:'Ligue 1', country:'France', catalog:'fr.1', mark:'L1', tint:'#3c5640' },
  { name:'Champions League', country:'', catalog:'uefa.cl', mark:'CL', tint:'#344f96' },
  { name:'Championship', country:'England', catalog:'en.2', mark:'EFL', tint:'#35598b' },
  { name:'Women’s Super League', country:'England', catalog:'', mark:'WSL', tint:'#8b385b' },
  { name:'World Cup', country:'', catalog:'worldcup.2026', mark:'WC', tint:'#6f5433' },
];

const arrows = '<svg aria-hidden="true" viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m7 4 5 5-5 5"/></svg>';
const fieldMark = '<svg aria-hidden="true" viewBox="0 0 60 42" width="52" height="38" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="54" height="36" rx="2"/><path d="M30 3v36M3 12h9v18H3m54-18h-9v18h9"/><circle cx="30" cy="21" r="7"/></svg>';
const magnifier = '<svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.6" cy="8.6" r="4.8"/><path d="m12 12 4 4"/></svg>';
const dateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric'});
const roleLabels = {GK:'Goalkeepers',DF:'Defenders',MF:'Midfielders',FW:'Forwards'};
const localLeagues = [...leagues].sort((a,b) => leagueLabel(a).localeCompare(leagueLabel(b)));

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
}

function fold(value) {
  return String(value ?? '').normalize('NFD').toLowerCase().replace(/\p{M}+/gu,'').replace(/[’']/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

function leagueLabel(league) {
  return [league.name,league.country,league.season].filter(Boolean).join(' · ');
}

function option(value,label) {
  return `<option value="${escape(value)}">${escape(label)}</option>`;
}

function button(text,attributes = '',accent = false) {
  return `<button type="button" class="button ${accent ? 'button-accent' : 'button-muted'}" ${attributes}>${escape(text)}</button>`;
}

function colorHex(value) {
  return /^#[a-f\d]{6}$/i.test(value ?? '') ? value : '';
}

function teamKit(team) {
  const found = team.colors ?? getClubKit(team);
  const primary = colorHex(found?.primary ?? found?.[0]);
  if (!primary) return null;
  const secondary = colorHex(found?.secondary ?? found?.[1]) || colorHex(getClubKit(team)?.secondary);
  return {...found,primary,secondary:secondary || primary};
}

function safeLogo(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://media.api-sports.io' && /^\/football\/teams\/\d+\.png$/.test(url.pathname)
      ? url.origin + url.pathname : '';
  } catch { return ''; }
}

function badge(team) {
  const logo = safeLogo(team.logo);
  const fallback = escape(team.shortName || team.name.slice(0,3).toUpperCase());
  return `<span class="tp-badge"><span aria-hidden="true">${fallback}</span>
    ${logo ? `<img alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="${escape(logo)}">` : ''}
  </span>`;
}

function swatches(kit) {
  return kit ? `<span class="tp-swatches" aria-label="Kit colours" title="Kit colours">
    <i style="--kit-colour:${kit.primary}"></i><i style="--kit-colour:${kit.secondary}"></i></span>` : '';
}

function lookupPopular(item, list) {
  if (!item.catalog && list === localLeagues) return;
  const exact = list.find(league => league.id === item.catalog);
  if (exact) return exact;
  const aliases = {
    'laliga':'la liga',
    'uefa champions league':'champions league',
    'fifa world cup':'world cup',
    'efl championship':'championship',
    'fa wsl':'womens super league',
    'fa womens super league':'womens super league',
    'wsl':'womens super league',
  };
  return list.find(league => (aliases[fold(league.name)] ?? fold(league.name)) === fold(item.name)
    && (!item.country || fold(league.country) === fold(item.country)));
}

function groupedPlayers(players) {
  const sorted = new Map(Object.entries(roleLabels).map(([role]) => [role,[]]));
  sorted.set('',[]);
  for (const player of players) {
    const role = player.role ?? player.position;
    sorted.get(sorted.has(role) ? role : '').push(player);
  }
  return [...sorted.entries()].filter(([,list]) => list.length).map(([role,list]) => `
    <section class="tp-player-group"><h5>${roleLabels[role] ?? 'Squad players'}</h5>
      ${list.map(player => `<div class="tp-player"><span>${player.number || '–'}</span>${escape(player.name)}</div>`).join('')}</section>`).join('');
}

export function mountTeamPicker(root, { side, onApply, onFixture }) {
  let source = 'catalog';
  let liveLeagues = [];
  let teams = [];
  let chosen = null;
  let activeFixtures = new Map();
  let requestId = 0;
  let changed = false;
  let pending = false;
  let allLeagueResults = false;

  root.innerHTML = `
    <div class="tp-toolbar">
      <span class="tp-source-note" id="tpSourceNote">Dated league catalog</span>
      <div class="segment tp-source" role="group" aria-label="Football data source">
        ${button('Football data','data-tp-source="live" aria-pressed="false" disabled')}
        ${button('Catalog','data-tp-source="catalog" aria-pressed="true"')}
      </div>
    </div>
    <div class="tp-quick"><h3>Popular competitions</h3><div class="tp-chips"></div></div>
    <div class="tp-filters">
      <label class="tp-country">Country<select class="input" name="country"></select></label>
      <label class="tp-league">Competition<select class="input" name="league"></select></label>
      <label class="tp-season">Season<select class="input" name="season"></select></label>
    </div>
    <div class="tp-main">
      <section class="tp-list-panel" aria-label="Teams">
        <form class="tp-search">
          <label>${magnifier}<span class="visually-hidden">Find a team</span><input class="input" type="search" name="teamSearch" placeholder="Search clubs or national teams" autocomplete="off"></label>
          <button type="submit" class="button button-muted tp-search-all" hidden>Search all leagues</button>
        </form>
        <div class="tp-results-heading"><h3>Teams</h3><span class="picker-status tp-status" role="status"></span></div>
        <div class="tp-results"></div>
        <button class="button button-muted tp-more" type="button" data-tp-action="more" hidden>Show more teams</button>
      </section>
      <section class="tp-detail" aria-label="Team and squad"></section>
    </div>
    <details class="picker-credit tp-credit"><summary>Data sources and licences</summary>
      <p><a href="https://www.api-football.com/coverage" target="_blank" rel="noreferrer">API-Football</a> supplies supported competitions, squads and fixture lineups.</p>
      ${catalogSource.sources.map(data => `<p><a href="${escape(data.url)}" target="_blank" rel="noreferrer">${escape(data.name)}</a> · <a href="${escape(data.licenseUrl)}" target="_blank" rel="noreferrer">${escape(data.license)}</a></p>`).join('')}
    </details>`;

  const find = selector => root.querySelector(selector);
  const field = name => find(`[name="${name}"]`);
  const status = find('.tp-status');
  const results = find('.tp-results');
  const detail = find('.tp-detail');
  const sourceNote = find('#tpSourceNote');
  const country = field('country');
  const competition = field('league');
  const season = field('season');
  const search = field('teamSearch');
  const searchAll = find('.tp-search-all');
  const showMore = find('.tp-more');
  let displayLimit = 48;

  function connected(token) {
    const dialog = root.closest('dialog');
    return root.isConnected && (!dialog || dialog.open) && token === requestId;
  }

  function begin(message = '') {
    pending = Boolean(message);
    status.textContent = message;
    return ++requestId;
  }

  function showError(message) {
    pending = false;
    status.textContent = message;
  }

  function currentLeagues() {
    return source === 'live' ? liveLeagues : localLeagues;
  }

  function currentLeague() {
    return currentLeagues().find(league => String(league.id) === competition.value);
  }

  function renderChips() {
    find('.tp-chips').innerHTML = popular.flatMap(item => {
      const league = lookupPopular(item,currentLeagues());
      return league ? [`<button type="button" class="tp-chip" data-tp-league="${escape(league.id)}"
        aria-pressed="${competition.value === String(league.id)}" style="--league-tint:${item.tint}">
        <span>${escape(item.mark)}</span>${escape(item.name)}</button>`] : [];
    }).join('');
  }

  function renderFilters(leagueId = '') {
    const list = currentLeagues();
    const countries = [...new Set(list.map(league => league.country).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    const known = list.find(league => String(league.id) === String(leagueId));
    country.innerHTML = option('','All countries') + countries.map(name => option(name,name)).join('');
    country.value = known?.country ?? '';
    renderCompetitions(leagueId);
    searchAll.hidden = source !== 'live';
  }

  function renderCompetitions(leagueId = '') {
    const list = currentLeagues().filter(league => !country.value || country.value === league.country);
    competition.innerHTML = option('','All competitions') + list.map(league => option(league.id,leagueLabel(league))).join('');
    if (list.some(league => String(league.id) === String(leagueId))) competition.value = String(leagueId);
    renderChips();
  }

  function renderSeasons() {
    const league = currentLeague();
    const seasons = source === 'live' ? (league?.seasons ?? []) : league?.season ? [league.season] : [];
    season.innerHTML = seasons.length ? seasons.map(year => option(year,year)).join('') : option('','Choose a competition');
    season.disabled = seasons.length <= 1;
  }

  function visibleTeams() {
    const query = search.value.trim();
    if (source === 'live') {
      const terms = fold(query).split(' ').filter(Boolean);
      return teams.filter(team => {
        const label = fold([team.name,team.shortName,team.country].filter(Boolean).join(' '));
        return terms.every(term => label.includes(term));
      });
    }
    const local = searchTeams(query,competition.value);
    if (!country.value || competition.value) return local;
    const countryLeagues = new Set(localLeagues.filter(league => league.country === country.value).map(league => league.id));
    return local.filter(team => countryLeagues.has(team.leagueId));
  }

  function renderResults() {
    const list = visibleTeams();
    results.innerHTML = list.slice(0,displayLimit).map(team => {
      const subtitle = source === 'live' ? team.country || currentLeague()?.name : [team.league,team.season].filter(Boolean).join(' · ');
      const kit = teamKit(team);
      return `<button type="button" class="tp-team" data-tp-team="${escape(team.id)}" aria-pressed="${chosen?.team.id === team.id}">
        ${badge(team)}<span class="tp-team-name"><strong>${escape(team.name)}</strong>
        <small>${escape(subtitle)}${team.hasSquad ? ' · Squad available' : ''}</small></span>${swatches(kit)}${arrows}</button>`;
    }).join('');
    showMore.hidden = list.length <= displayLimit;
    if (pending) return;
    const lead = list.length > displayLimit ? `Showing ${displayLimit} of ` : '';
    status.textContent = list.length ? `${lead}${list.length} ${list.length === 1 ? 'team' : 'teams'}`
      : source === 'live' && !competition.value && !allLeagueResults
        ? 'Pick a competition or search all leagues.' : 'No teams found.';
  }

  function renderEmpty() {
    detail.innerHTML = `<div class="tp-empty">${fieldMark}<h3>Pick your ${escape(side)} team</h3>
      <p>Browse by competition or find a team by name. Select a team to preview its kit and squad.</p></div>`;
  }

  function clearSelection() {
    chosen = null;
    activeFixtures.clear();
    renderEmpty();
  }

  async function loadLeagueTeams() {
    const league = currentLeague();
    const year = season.value;
    begin();
    teams = [];
    allLeagueResults = false;
    displayLimit = 48;
    clearSelection();
    renderResults();
    if (source !== 'live' || !league || !year) return;
    const token = begin('Loading teams…');
    try {
      const found = await getProviderTeams(league.id,year);
      if (!connected(token)) return;
      teams = found;
      pending = false;
      renderResults();
    } catch (error) {
      if (connected(token)) {
        showError(error?.message || 'Football data is temporarily unavailable.');
        if (season.options.length > 1) season.focus();
      }
    }
  }

  function chooseLeague(leagueId) {
    const league = currentLeagues().find(item => String(item.id) === leagueId);
    if (!league) return;
    country.value = league.country ?? '';
    renderCompetitions(leagueId);
    renderSeasons();
    search.value = '';
    void loadLeagueTeams();
  }

  function renderSquad(team, squad, note, loading = false) {
    const kit = teamKit(team);
    const kitLabel = kit?.source === 'Crest colours' ? 'Colours suggested from crest' : kit?.source || 'Team colours';
    const size = squad?.players?.length ?? 0;
    detail.innerHTML = `<div class="tp-club-section"><header>${badge(team)}
      <div><h3>${escape(team.name)}</h3><p>${escape([team.country,team.league].filter(Boolean).join(' · '))}</p></div>
    </header>${kit ? `<div class="tp-kit-line">${swatches(kit)}<span>${escape(kitLabel)}</span></div>` : ''}
      <div class="tp-squad-title"><h4>Squad</h4><span>${size ? `${size} players` : ''}</span></div>
      <p class="tp-detail-note">${escape(note)}</p>
      ${size ? `<div class="tp-squad">${groupedPlayers(squad.players)}</div>` : ''}
      <div class="tp-apply">
        ${size ? button(`Load ${side} squad`, 'data-tp-action="apply"', true) : ''}
        ${button(`Use as ${side} team`, `data-tp-action="identity"${loading ? ' disabled' : ''}`, !size)}
        ${team.provider ? button('Recent fixtures', 'data-tp-action="fixtures"') : ''}
      </div></div>`;
  }

  async function selectTeam(id) {
    const team = visibleTeams().find(item => String(item.id) === id);
    if (!team) return;
    const kit = teamKit(team);
    chosen = {team:kit ? {...team,colors:kit} : team,squad:team.provider ? null : getCatalogSquad(team.id)};
    activeFixtures.clear();
    const token = begin();
    renderResults();
    if (!team.provider) {
      renderSquad(team,chosen.squad,chosen.squad?.season ? `Tournament squad · ${chosen.squad.season}`
        : 'League membership and kit colours can be used with editable players.');
      return;
    }
    renderSquad(team,null,'Loading current squad…',true);
    const preview = kit || !team.logo ? Promise.resolve(null) : suggestCrestKit(team.logo).catch(() => null);
    const [playersResult,crestResult] = await Promise.allSettled([getProviderSquad(team.id),preview]);
    if (!connected(token)) return;
    const colors = crestResult.status === 'fulfilled' ? crestResult.value : null;
    if (colors) chosen.team = {...team,colors};
    if (playersResult.status === 'rejected') {
      renderSquad(chosen.team,null,playersResult.reason?.message || 'Could not load the squad.');
      return;
    }
    const players = playersResult.value;
    chosen.squad = players.length ? {players} : null;
    renderSquad(chosen.team,chosen.squad,players.length ? 'Current squad from API-Football.' : 'No player list is available for this team.');
  }

  async function fetchAllTeams() {
    if (source !== 'live') return;
    const query = search.value.trim();
    if (query.length < 3) {
      status.textContent = 'Enter at least three characters to search all leagues.';
      search.focus();
      return;
    }
    const token = begin('Searching all leagues…');
    clearSelection();
    teams = [];
    renderResults();
    try {
      const matches = await searchProviderTeams(query);
      if (!connected(token)) return;
      country.value = '';
      renderCompetitions();
      renderSeasons();
      teams = matches;
      allLeagueResults = true;
      displayLimit = 48;
      pending = false;
      renderResults();
    } catch (error) {
      if (connected(token)) showError(error?.message || 'Could not search teams.');
    }
  }

  async function fixtures() {
    if (!chosen?.team.provider) return;
    const token = begin('Loading recent fixtures…');
    const league = competition.value;
    const year = season.value;
    try {
      const data = await getProviderFixtures(chosen.team.id,league,year);
      if (!connected(token)) return;
      activeFixtures = new Map(data.map(match => [String(match.id),match]));
      detail.innerHTML = `<div class="tp-club-section"><div class="tp-squad-title"><h3>Recent fixtures</h3>
        ${button('Back to squad','data-tp-action="back"')}</div>
        <div class="tp-fixtures">${data.map(match => {
          const date = new Date(match.date);
          return `<button type="button" class="tp-team" data-tp-fixture="${escape(match.id)}">
            <span class="tp-team-name"><strong>${escape(`${match.home.name} v ${match.away.name}`)}</strong>
            <small>${Number.isFinite(+date) ? escape(dateFormat.format(date)) : ''}</small></span>${arrows}</button>`;
        }).join('')}</div></div>`;
      showError(data.length ? 'Select a match to load both starting XIs.' : 'No recent fixtures available.');
    } catch (error) {
      if (connected(token)) showError(error?.message || 'Could not load fixtures.');
    }
  }

  async function selectFixture(id) {
    const match = activeFixtures.get(id);
    if (!match) return;
    const token = begin('Loading both lineups…');
    try {
      const lineups = await getProviderLineups(id);
      if (!connected(token)) return;
      const sides = [match.home,match.away].map(team => {
        const lineup = lineups.find(item => String(item.team.id) === String(team.id));
        if (!lineup) return;
        const teamRecord = {...team,...lineup.team, logo:lineup.team.logo || team.logo, country:lineup.team.country || team.country};
        const colors = teamKit(teamRecord);
        return {...lineup,team:colors ? {...teamRecord,colors} : teamRecord};
      });
      if (sides.some(item => !item?.starter.length)) {
        showError('Starting XIs are unavailable for this fixture.');
        return;
      }
      onFixture(sides);
    } catch (error) {
      if (connected(token)) showError(error?.message || 'Could not load lineups.');
    }
  }

  function showSource(next) {
    source = next;
    search.value = '';
    root.querySelectorAll('[data-tp-source]').forEach(control => {
      const active = control.dataset.tpSource === source;
      control.classList.toggle('selected',active);
      control.setAttribute('aria-pressed',String(active));
    });
    sourceNote.textContent = source === 'live' ? 'Squads and fixtures by API-Football' : 'Dated league catalog';
    renderFilters(lookupPopular(popular[0],currentLeagues())?.id ?? '');
    renderSeasons();
    void loadLeagueTeams();
  }

  root.addEventListener('click',event => {
    const control = event.target.closest('button');
    if (!control || control.disabled) return;
    changed = true;
    const {tpSource,tpLeague,tpTeam,tpFixture,tpAction} = control.dataset;
    if (tpSource && tpSource !== source) showSource(tpSource);
    if (tpLeague) chooseLeague(tpLeague);
    if (tpTeam) void selectTeam(tpTeam);
    if (tpFixture) void selectFixture(tpFixture);
    if (tpAction === 'apply' && chosen?.squad) onApply(chosen.team,chosen.squad);
    if (tpAction === 'identity' && chosen) onApply(chosen.team,null);
    if (tpAction === 'fixtures') void fixtures();
    if (tpAction === 'back' && chosen) void selectTeam(String(chosen.team.id));
    if (tpAction === 'more') {
      displayLimit += 48;
      renderResults();
    }
  });

  root.addEventListener('submit',event => {
    event.preventDefault();
    changed = true;
    void fetchAllTeams();
  });
  search.addEventListener('input', () => {
    changed = true;
    displayLimit = 48;
    renderResults();
  });
  country.addEventListener('change', () => {
    changed = true;
    renderCompetitions();
    renderSeasons();
    void loadLeagueTeams();
  });
  competition.addEventListener('change', () => {
    changed = true;
    renderChips();
    renderSeasons();
    void loadLeagueTeams();
  });
  season.addEventListener('change', () => {
    changed = true;
    void loadLeagueTeams();
  });
  root.addEventListener('error', event => {
    if (event.target.matches?.('.tp-badge img')) event.target.hidden = true;
  }, true);

  showSource('catalog');
  const initial = requestId;
  getProviderLeagues().then(data => {
    if (!root.isConnected || !Array.isArray(data) || !data.length) return;
    liveLeagues = data;
    find('[data-tp-source="live"]').disabled = false;
    if (!changed && connected(initial)) showSource('live');
    else if (source === 'catalog') sourceNote.textContent = 'Dated catalog · API-Football available';
  }).catch(() => {
    if (root.isConnected) find('[data-tp-source="live"]').title = 'API-Football is unavailable. The dated catalog is ready to use.';
  });
}
