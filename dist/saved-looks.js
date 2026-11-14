const key = 'touchline-saved-looks-v1';
const colours = ['home','away'].flatMap(side => ['Color','Trim','Number','Keeper','KeeperNumber'].map(suffix => side + suffix));
const keys = [...colours,'pitchStyle','view','grid','guideMode','labels','markerStyle'];
const valid = (name,value) => {
  if (colours.includes(name)) return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
  if (['grid','labels'].includes(name)) return typeof value === 'boolean';
  return typeof value === 'string' && /^[a-z-]{1,20}$/.test(value);
};
export function captureLook(settings) {
  return Object.fromEntries(keys.filter(name => valid(name,settings[name])).map(name => [name,settings[name]]));
}
export function savedLooks() {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && item.settings)
      .slice(0,24).map(item => ({id:item.id,title:item.title.slice(0,80),settings:captureLook(item.settings)})) : [];
  } catch { return []; }
}
export function applyLook(settings,look) {
  for (const name of keys) delete settings[name];
  Object.assign(settings,look,{view:look.view ?? 'full',labels:look.labels ?? false,grid:look.grid ?? false,
    homeColor:look.homeColor ?? '#253c84',awayColor:look.awayColor ?? '#202020'});
}
export function storeLook(title,settings) {
  const current = savedLooks();
  const existing = current.find(item => item.title.toLowerCase() === title.toLowerCase());
  const item = {id:existing?.id ?? globalThis.crypto.randomUUID(),title,settings:captureLook(settings)};
  try {
    localStorage.setItem(key,JSON.stringify([item,...current.filter(other => other.id !== item.id)].slice(0,24)));
    return true;
  } catch { return false; }
}
export function deleteLook(id) {
  try {
    localStorage.setItem(key,JSON.stringify(savedLooks().filter(item => item.id !== id)));
    return true;
  } catch { return false; }
}
