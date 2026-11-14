import { getProviderMatchDetails } from './provider.js';

const display = new Map([['Goal','Goal'],['Card','Card'],['Subst','Substitution'],['Var','VAR']]);
const relevantStats = ['Ball Possession','Total Shots','Shots on Goal','Corner Kicks','Fouls','Yellow Cards','Red Cards','Total passes','Passes %','expected_goals'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);

function timeLabel(time) {
  const minute = Number.isFinite(time?.elapsed) ? time.elapsed : 0;
  return `${minute}${time?.extra > 0 ? '+' + time.extra : ''}′`;
}

function displayScore(value) {
  return value == null ? '–' : escape(value);
}

export function mountMatchStory(root, fixture, {onReplay}) {
  root.innerHTML = '<p role="status">Loading events and match statistics…</p>';
  getProviderMatchDetails(fixture.id).then(({events,statistics}) => {
    if (!root.isConnected) return;
    const supported = (events ?? []).filter(event => display.has(event.type));
    const substitutions = supported.filter(event => event.type === 'Subst');
    const teams = [fixture.home,fixture.away];
    const rows = teams.map(team => new Map((statistics ?? []).find(value => String(value.team?.id) === team.id)
      ?.statistics?.map(item => [item.type,item.value]) ?? []));
    const stats = relevantStats.filter(name => rows.some(row => row.get(name) != null));
    root.innerHTML = `<div class="match-story-header"><strong>${escape(fixture.home.name)}</strong><span>v</span><strong>${escape(fixture.away.name)}</strong></div>
      ${stats.length ? `<table class="match-story-stats"><thead><tr><th scope="col">${escape(fixture.home.name)}</th><th scope="col">Match statistics</th><th scope="col">${escape(fixture.away.name)}</th></tr></thead>
        <tbody>${stats.map(name => `<tr><td>${displayScore(rows[0].get(name))}</td><th scope="row">${name === 'expected_goals' ? 'xG' : escape(name)}</th><td>${displayScore(rows[1].get(name))}</td></tr>`).join('')}</tbody></table>`
      : '<p>No match statistics are available.</p>'}
      <h3>Match events</h3>
      ${supported.length ? `<ol class="match-story-events">${supported.map(event => `<li>
          <time>${timeLabel(event.time)}</time><div><strong>${escape(display.get(event.type))} · ${escape(event.team?.name)}</strong>
           <small>${escape(event.player?.name)}${event.type === 'Subst' && event.assist?.name ? ' → ' + escape(event.assist.name) : ''} · ${escape(event.detail)}</small></div></li>`).join('')}</ol>`
       : '<p>No recorded match events are available.</p>'}
      ${substitutions.length ? '<button class="button button-accent" type="button" data-replay>Build substitution board</button>' : ''}
      <p class="map-source">Match events and team totals by API-Football.</p>`;
    root.querySelector('[data-replay]')?.addEventListener('click',() => onReplay(substitutions));
  }).catch(error => {
    if (root.isConnected) root.textContent = error.message || 'Match data could not be loaded.';
  });
}

export function substitutionStages(start, fixture, events) {
  const scene = structuredClone(start);
  const stages = [];
  let previous;
  for (const event of events) {
    const side = String(event.team?.id) === fixture.home.id ? 'home' : String(event.team?.id) === fixture.away.id ? 'away' : null;
    if (!side || !event.player?.id || !event.assist?.id) continue;
    const first = scene.players.find(player => player.team === side && player.providerPlayerId === String(event.player.id));
    const second = scene.players.find(player => player.team === side && player.providerPlayerId === String(event.assist.id));
    if (!first || !second || Boolean(first.benched) === Boolean(second.benched)) continue;
    const [from,to] = first.benched ? [second,first] : [first,second];
    Object.assign(to,{x:from.x,y:from.y,benched:false});
    from.benched = true;
    const time = timeLabel(event.time);
    const note = `${side === 'home' ? fixture.home.name : fixture.away.name}: ${to.name} replaces ${from.name}.`;
    if (previous?.time === time) {
      previous.notes += '\n' + note;
      previous.scene = structuredClone(scene);
    } else {
      previous = {time,title:`${time} Substitution`,notes:note,scene:structuredClone(scene)};
      stages.push(previous);
    }
  }
  return stages;
}
