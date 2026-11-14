const storageKey = 'touchline-library-folders-v1';
const maxFolders = 40;
const maxNameLength = 60;

const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
const validName = value => typeof value === 'string' && value.trim() && value.length <= maxNameLength;
const normalize = value => value.trim().normalize('NFC').toLowerCase();

export function readLibraryFolders(storage) {
  try {
    const data = JSON.parse((storage ?? globalThis.localStorage).getItem(storageKey));
    if (!data || !Array.isArray(data.folders) || !Array.isArray(data.locations)) {
      return {folders:[],locations:new Map()};
    }
    const ids = new Set();
    const names = new Set();
    const folders = data.folders.filter(folder => {
      if (!folder || !validId(folder.id) || !validName(folder.name)) return false;
      const name = normalize(folder.name);
      if (ids.has(folder.id) || names.has(name) || ids.size >= maxFolders) return false;
      ids.add(folder.id);
      names.add(name);
      return true;
    });
    const locations = new Map(data.locations.filter(entry =>
      Array.isArray(entry) && entry.length === 2 && validId(entry[0]) && ids.has(entry[1])));
    return {folders, locations};
  } catch {
    return {folders:[],locations:new Map()};
  }
}

function updateLibraryFolders(edit,storage) {
  const state = readLibraryFolders(storage);
  const result = edit(state);
  try {
    (storage ?? globalThis.localStorage).setItem(storageKey, JSON.stringify({folders:state.folders,locations:[...state.locations]}));
  } catch {
    throw new Error('Could not save your folders on this device.');
  }
  return result;
}

function checkName(raw,folders,exclude) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!validName(name)) throw new Error('Enter a folder name of 1–60 characters.');
  if (folders.some(folder => folder.id !== exclude && normalize(folder.name) === normalize(name))) {
    throw new Error('A folder already has that name.');
  }
  return name;
}

export function createLibraryFolder(name,storage) {
  return updateLibraryFolders(state => {
    if (state.folders.length >= maxFolders) throw new Error('This library has reached 40 folders.');
    const label = checkName(name,state.folders);
    const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    state.folders.push({id,name:label});
    return id;
  },storage);
}

export function renameLibraryFolder(id,name,storage) {
  return updateLibraryFolders(state => {
    const folder = state.folders.find(item => item.id === id);
    if (!folder) throw new Error('That folder is no longer available.');
    folder.name = checkName(name,state.folders,id);
  },storage);
}

export function deleteLibraryFolder(id,storage) {
  return updateLibraryFolders(state => {
    state.folders = state.folders.filter(folder => folder.id !== id);
    for (const [tactic,folder] of state.locations) {
      if (folder === id) state.locations.delete(tactic);
    }
  },storage);
}

export function moveLibraryTactic(tactic,folder,activeTactics,storage) {
  return updateLibraryFolders(state => {
    if (!validId(tactic) || !activeTactics.includes(tactic)) throw new Error('That tactic is no longer available.');
    if (folder && !state.folders.some(item => item.id === folder)) throw new Error('That folder is no longer available.');
    const known = new Set(activeTactics);
    for (const id of state.locations.keys()) {
      if (!known.has(id)) state.locations.delete(id);
    }
    if (folder) state.locations.set(tactic,folder);
    else state.locations.delete(tactic);
  },storage);
}
