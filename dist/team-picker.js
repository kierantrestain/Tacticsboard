import { catalogSource, getCatalogSquad, leagues, searchTeams } from './catalog.js';
import {
  connectProvider, disconnectProvider, getProviderFixtures, getProviderLeagues, getProviderLineups,
  getProviderSquad, getProviderTeams, hasProvider, providerDashboard, providerDocs,
} from './provider.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const leagueLabel = league => [league.country,league.name,league.season].filter(Boolean).join(' · ');
const option = (value, label) => `<option value="${escape(value)}">${escape(label)}</option>`;
const button = (text, attributes = '', accent = false) =>
  `<button type="button" class="button ${accent ? 'button-accent' : 'button-muted'}" ${attributes}>${escape(text)}</button>`;

const dateFormat = new Intl.DateTimeFormat('en-GB',{ day:'numeric',month:'short',year:'numeric' });

export function mountTeamPicker(root, { side, onApply, onFixture }) {
  const local = leagues.slice().sort((a,b) => leagueLabel(a).localeCompare(leagueLabel(b)));
  let mode = 'catalog';
  let networkLeagues = [];
  let networkTeams = [];
  let chosen = null;
  let activeFixtures = new Map();
  let requestId = 0;

  root.innerHTML = `
    <div class="segment picker-modes" role="group" aria-label="Football data source">
      ${button('Open catalog', 'data-mode="catalog" aria-pressed="true"')}
      ${button('API-Football', 'data-mode="provider" aria-pressed="false"')}
    </div>
    <div class="picker-work"></div>
    <div class="picker-status" role="status"></div>
    <div class="picker-results"></div>
    <div class="picker-detail"></div>
    <details class="picker-credit"><summary>Data sources and licences</summary>
      ${catalogSource.sources.map(source => `<p><a href="${escape(source.url)}" target="_blank" rel="noreferrer">${escape(source.name)}</a> · <a href="${escape(source.licenseUrl)}" target="_blank" rel="noreferrer">${escape(source.license)}</a></p>`).join('')}
      <p>Club and squad records were selected and normalised for lineup building.</p>
    </details>`;
  const work = root.querySelector('.picker-work');
  const status = root.querySelector('.picker-status');
  const results = root.querySelector('.picker-results');
  const detail = root.querySelector('.picker-detail');
  const field = name => work.querySelector(`[name="${name}"]`);

  function alive(id) {
    return root.isConnected && id === requestId;
  }

  function busy(message) {
    status.textContent = message;
    return ++requestId;
  }

  function fail(error, id) {
    if (alive(id)) status.textContent = error?.message ?? 'Football data is temporarily unavailable.';
  }

  function row(team) {
    const suffix = team.provider ? team.country : [team.league, team.season].filter(Boolean).join(' · ');
    return `<button type="button" class="team-result" data-team-id="${escape(team.id)}">
      <span class="team-monogram">${escape(team.shortName || team.name.slice(0,3).toUpperCase())}</span>
      <span><strong>${escape(team.name)}</strong><small>${escape(suffix)}</small></span>
      ${team.hasSquad ? '<span class="squad-tag">Squad</span>' : ''}</button>`;
  }

  function visibleTeams() {
    const league = field('league')?.value ?? '';
    const query = field('teamSearch')?.value.trim() ?? '';
    if (mode === 'catalog') return searchTeams(query, league);
    const term = normalize(query);
    return networkTeams.filter(team => normalize(team.name + ' ' + team.shortName).includes(term));
  }

  function showResults() {
    const teams = visibleTeams();
    results.innerHTML = teams.slice(0,100).map(row).join('');
    const message = mode === 'provider' && !field('league')?.value ? 'Choose a competition to see its teams.'
      : teams.length ? `${teams.length > 100 ? 'First 100 of ' : ''}${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`
      : 'No teams found.';
    status.textContent = message;
  }

  function showCatalog() {
    work.innerHTML = `
      <label>Competition<select class="input" name="league">${option('','All competitions')}${local.map(league => option(league.id,leagueLabel(league))).join('')}</select></label>
      <label>Find a team<input class="input" type="search" name="teamSearch" placeholder="Club or country" autocomplete="off"></label>
      <p class="picker-credit">Dated seasons from ${escape(catalogSource.name)}. Squad badges mark teams with player data.</p>`;
    showResults();
  }

  function showConnect() {
    work.innerHTML = `<form class="provider-form">
      <p>Use your API-Football account to browse its competitions, current squads and recent fixture lineups. Availability depends on your plan and the competition.</p>
      <label>API-Football key<input class="input" type="password" name="apiKey" autocomplete="off" required></label>
      <p class="picker-credit">Your key is used for this tab and sent directly to API-Football. <a href="${providerDashboard}" target="_blank" rel="noreferrer">Get a key</a> · <a href="${providerDocs}" target="_blank" rel="noreferrer">Provider docs</a></p>
      <button type="submit" class="button button-accent">Connect and load leagues</button>
    </form>`;
  }

  function showProvider() {
    work.innerHTML = `<div class="provider-fields">
      <label>Filter leagues<input class="input" name="leagueSearch" type="search" placeholder="Country or competition"></label>
      <label>Competition<select class="input" name="league" aria-label="Competition"></select></label>
      <label>Season<select class="input" name="season" aria-label="Season" disabled>${option('','Choose a competition')}</select></label>
      <label>Find a team<input class="input" name="teamSearch" type="search" placeholder="Search this competition"></label>
    </div><div class="picker-credit">Data by API-Football. ${button('Disconnect','data-picker-action="disconnect"')}</div>`;
    filterLeagues();
    showResults();
  }

  function filterLeagues() {
    const select = field('league');
    const value = select.value;
    const query = normalize(field('leagueSearch').value.trim());
    const filtered = networkLeagues.filter(league => normalize(leagueLabel(league)).includes(query));
    select.innerHTML = option('','Choose a competition') + filtered.map(league => option(league.id,leagueLabel(league))).join('');
    if (filtered.some(league => league.id === value)) select.value = value;
    else if (value) clearLeague();
  }

  function clearLeague() {
    const season = field('season');
    season.innerHTML = option('','Choose a competition');
    season.disabled = true;
    networkTeams = [];
    chosen = null;
    detail.innerHTML = '';
    ++requestId;
    showResults();
  }

  function selectLeague() {
    const league = networkLeagues.find(item => item.id === field('league').value);
    if (!league) return clearLeague();
    const season = field('season');
    season.innerHTML = option('','Choose season') + league.seasons.map(year => option(year,year)).join('');
    season.disabled = !league.seasons.length;
    if (league.seasons.length) season.value = league.seasons[0];
    return loadTeams();
  }

  async function loadTeams() {
    networkTeams = [];
    chosen = null;
    results.innerHTML = '';
    detail.innerHTML = '';
    const league = field('league').value;
    const season = field('season').value;
    if (!league || !season) return showResults();
    const id = busy('Loading teams…');
    try {
      const teams = await getProviderTeams(league,season);
      if (!alive(id)) return;
      networkTeams = teams;
      showResults();
    } catch (error) { fail(error,id); }
  }

  function showClub(team, squad, loading = false, error = '') {
    const season = squad?.season ? ` · ${escape(squad.season)}` : '';
    const caption = loading ? 'Loading squad…' : error ? escape(error)
      : squad?.players.length ? `${squad.players.length} players${season}`
      : 'Club identity is available. Add players manually or connect API-Football for squad data.';
    detail.innerHTML = `<h3>${escape(team.name)}</h3><p>${caption}</p>
      ${squad?.players.length ? `<div class="squad-preview">${squad.players.map(player =>
        `<span>${player.number || '–'} · ${escape(player.name)}</span>`).join('')}</div>` : ''}
      <div class="dialog-actions">
        ${team.provider ? button('Recent fixtures', 'data-picker-action="fixtures"') : ''}
        ${button(squad?.players.length ? `Load ${side} squad` : `Use as ${side} team`, `data-picker-action="apply"${loading ? ' disabled' : ''}`, true)}
      </div>`;
  }

  async function selectTeam(id) {
    const team = visibleTeams().find(item => String(item.id) === id);
    if (!team) return;
    chosen = { team, squad:team.provider ? null : getCatalogSquad(team.id) };
    showClub(team, chosen.squad, team.provider);
    detail.scrollIntoView({block:'nearest'});
    const run = ++requestId;
    if (!team.provider) return;
    try {
      const players = await getProviderSquad(team.id);
      if (!alive(run)) return;
      chosen.squad = {players};
      showClub(team,chosen.squad);
    } catch (error) {
      if (alive(run)) showClub(team,null,false,error?.message ?? 'Could not load the squad.');
    }
  }

  async function fixtures() {
    if (!chosen?.team.provider) return;
    const id = busy('Loading recent fixtures…');
    try {
      const data = await getProviderFixtures(chosen.team.id,field('league').value,field('season').value);
      if (!alive(id)) return;
      activeFixtures = new Map(data.map(match => [match.id, match]));
      detail.innerHTML = `<h3>Recent fixtures</h3><div class="fixture-list">${data.map(match => {
        const date = new Date(match.date);
        const label = `${match.home.name} v ${match.away.name}`;
        return `<button type="button" class="team-result" data-fixture-id="${escape(match.id)}"><span><strong>${escape(label)}</strong>
          <small>${Number.isFinite(+date) ? escape(dateFormat.format(date)) : ''}</small></span></button>`;
      }).join('')}</div>`;
      status.textContent = data.length ? 'Select a fixture to load both starting XIs.' : 'No recent fixtures available.';
    } catch (error) { fail(error,id); }
  }

  async function selectFixture(fixture) {
    const id = busy('Loading both lineups…');
    try {
      const lineups = await getProviderLineups(fixture);
      if (!alive(id)) return;
      if (lineups.length < 2 || lineups.some(item => item.starter.length === 0)) {
        status.textContent = 'Starting XIs are unavailable for this fixture.';
        return;
      }
      const match = activeFixtures.get(fixture);
      if (!match) return;
      const sides = [match.home, match.away].map(team => lineups.find(item => item.team.id === team.id));
      if (sides.some(item => !item)) {
        status.textContent = 'Lineup data could not be matched to both teams.';
        return;
      }
      onFixture(sides);
    } catch (error) { fail(error,id); }
  }

  async function showMode(next) {
    const id = busy('');
    chosen = null;
    networkTeams = [];
    mode = next;
    root.querySelectorAll('[data-mode]').forEach(control => {
      const active = control.dataset.mode === mode;
      control.classList.toggle('selected',active);
      control.setAttribute('aria-pressed',String(active));
    });
    detail.innerHTML = '';
    results.innerHTML = '';
    work.innerHTML = '';
    if (mode === 'catalog') return showCatalog();
    if (!hasProvider()) return showConnect();
    status.textContent = 'Loading competitions…';
    try {
      networkLeagues = await getProviderLeagues();
      if (alive(id)) showProvider();
    } catch (error) { fail(error,id); }
  }

  root.addEventListener('click',event => {
    const control = event.target.closest('button');
    if (!control) return;
    if (control.dataset.mode && control.dataset.mode !== mode) void showMode(control.dataset.mode);
    if (control.dataset.teamId) void selectTeam(control.dataset.teamId);
    if (control.dataset.fixtureId) void selectFixture(control.dataset.fixtureId);
    if (control.dataset.pickerAction === 'apply' && chosen) onApply(chosen.team,chosen.squad);
    if (control.dataset.pickerAction === 'fixtures') void fixtures();
    if (control.dataset.pickerAction === 'disconnect') {
      disconnectProvider();
      void showMode('provider');
    }
  });
  root.addEventListener('submit',async event => {
    event.preventDefault();
    const field = event.target.elements.apiKey;
    const submit = event.target.querySelector('[type=submit]');
    if (!field || !submit) return;
    const key = field.value;
    field.value = '';
    submit.disabled = true;
    const id = busy('Connecting to API-Football…');
    try {
      networkLeagues = await connectProvider(key);
      if (alive(id)) showProvider();
    } catch (error) {
      fail(error,id);
      if (alive(id)) submit.disabled = false;
    }
  });
  root.addEventListener('input',event => {
    if (event.target.name === 'leagueSearch') filterLeagues();
    if (event.target.name === 'teamSearch') showResults();
  });
  root.addEventListener('change',event => {
    if (event.target.name === 'season') void loadTeams();
    if (event.target.name === 'league') {
      if (mode === 'provider') void selectLeague();
      else {
        chosen = null;
        detail.innerHTML = '';
        showResults();
      }
    }
  });

  void showMode('catalog');
}
