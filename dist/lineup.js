import { formations, makeLineup } from './data.js';

const roleFor = label => label === 'GK' ? 'GK'
  : /^(?:LB|RB|LCB|RCB|CB|LWB|RWB)$/.test(label) ? 'DF'
  : /^(?:LW|RW|LS|RS|ST)$/.test(label) ? 'FW' : 'MF';
const playerRole = player => player.role || player.position || '';
const key = player => String(player.id ?? player.name);

function fromGrid(players, team) {
  if (players.length !== 11 || players.some(player => !/^\d{1,2}:\d{1,2}$/.test(player.grid))) return null;
  const rows = new Map();
  for (const player of players) {
    const [depth, column] = player.grid.split(':').map(Number);
    if (depth < 1 || column < 1) return null;
    if (!rows.has(depth)) rows.set(depth, []);
    rows.get(depth).push({ player, column });
  }
  const lines = [...rows.entries()].sort((a,b) => a[0] - b[0]);
  if (lines.length < 3 || lines[0][1].length !== 1 ||
      lines.some(([,line]) => new Set(line.map(item => item.column)).size !== line.length)) return null;
  return lines.flatMap(([,line], row) => {
    const x = 92 + row * (392 / (lines.length - 1));
    return line.sort((a,b) => a.column - b.column).map(({player}, column) => {
      const y = line.length === 1 ? 312.5 : 115 + column * (395 / (line.length - 1));
      return { player, x:team === 'away' ? 1000 - x : x, y:team === 'away' ? 625 - y : y };
    });
  });
}

export function shapeFromRoster(team, formation, starters, bench = [], ordered = false, layout = []) {
  const slots = makeLineup(team,formations.includes(formation) ? formation : undefined);
  const fixedLayout = new Map(layout.map(player => [player.id,player]));
  const remaining = starters.slice();
  const gridded = ordered ? fromGrid(starters,team) : null;
  function fieldPlayer(player, slot, coordinates = slot) {
    return {
      ...slot,
      x:coordinates.x, y:coordinates.y,
      name:player.name.slice(0,100),
      number:player.number ?? 0,
      footballRole:playerRole(player) || roleFor(slot.name),
      ...(typeof player.id === 'string' && /^[1-9]\d{0,11}$/.test(player.id) ? {providerPlayerId:player.id} : {}),
    };
  }

  const xi = gridded ? gridded.map(({player,x,y},index) => fieldPlayer(player,slots[index],{x,y}))
    : slots.flatMap(slot => {
      if (!remaining.length) return [];
      const role = roleFor(slot.name);
      const match = ordered ? 0 : Math.max(0,remaining.findIndex(player => playerRole(player) === role));
      const [player] = remaining.splice(match,1);
      return fieldPlayer(player,slot,fixedLayout.get(slot.id) ?? slot);
    });

  const reserved = new Set(xi.map(player => player.id));
  const replacements = [...remaining, ...bench];
  if (gridded) replacements.splice(0, starters.length);
  const seen = new Set();
  const reserves = replacements.filter(player => {
    const id = key(player);
    if (seen.has(id)) return false;
    seen.add(id);
    return Boolean(player.name);
  }).slice(0,30 - xi.length).map((player,index) => {
    const slot = slots[index % slots.length];
    const id = `${team}-bench-${index + 1}`;
    return {...fieldPlayer(player,{...slot,id}),benched:true};
  }).filter(player => !reserved.has(player.id));

  return [...xi, ...reserves];
}
