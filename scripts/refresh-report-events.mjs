import { readFile, readdir, writeFile } from 'node:fs/promises';
import { normaliseReportEvent } from '../lib/match-events.js';
const root = new URL('../', import.meta.url), dir = new URL('public/data/reports/', root);
const season = JSON.parse(await readFile(new URL('public/data/season.json', root), 'utf8'));
const fixtures = new Map(season.fixtures.map(m => [m.id, m]));
const paths = (await readdir(dir)).filter(p => p.endsWith('.json'));
let index = 0, refreshed = 0, failed = 0, locations = 0;
// Store concise event facts for offline preparation, rather than republishing the full commentary.
function factualEntry(entry) {
  const event = normaliseReportEvent(entry, true), text = entry.text || '', type = event.type || '';
  if (!/shot|goal|corner|free kick|foul|card/i.test(type) && !/^(Attempt |Goal!|Own goal|Corner,|Foul by)|hits the (?:bar|post)/i.test(text)) return null;
  const actor = event.participants?.[0]?.name;
  if (!actor) return null;
  const assist = text.match(/Assisted by ([^.]+?)(?: with | following | after |\.|$)/i)?.[1];
  const label = /^Goal!/i.test(text) ? 'Goal' : /^Own goal/i.test(text) ? 'Own Goal' : /^Attempt saved/i.test(text) ? 'Attempt saved' : /^Attempt blocked/i.test(text) ? 'Attempt blocked' : /^Attempt missed/i.test(text) ? 'Attempt missed' : /hits the (?:bar|post)/i.test(text) ? 'Woodwork' : type;
  event.text = `${label}. ${actor}${event.teamName ? ` (${event.teamName})` : ''}.${assist ? ` Assisted by ${assist}.` : ''}`;
  if (label === 'Own Goal') event.text = `Own goal by ${actor}.`;
  return event;
}
async function worker() {
  while (index < paths.length) {
    const file = paths[index++], id = file.slice(0, -5), match = fixtures.get(id);
    if (!match) continue;
    try {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${match.league}/summary?event=${id}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const raw = await response.json(), path = new URL(file, dir), report = JSON.parse(await readFile(path, 'utf8'));
      if (String(raw.header?.id) !== id) throw Error('Mismatched event');
      report.events = (raw.keyEvents || []).filter(e => e.text).map(e => normaliseReportEvent(e));
      report.eventEvidenceVersion = 1;
      report.replayEvents = (raw.commentary || []).map(factualEntry).filter(Boolean);
      locations += report.replayEvents.filter(e => e.position).length;
      await writeFile(path, JSON.stringify(report));
      refreshed++;
    } catch (e) { failed++; console.error(`${id}: retained prior report (${e.message})`); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`Refreshed event evidence in ${refreshed} reports; ${locations} located actions; ${failed} saved reports retained.`);
