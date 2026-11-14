import { validMediaKeyframes } from './media-keyframes.js';

const database = 'touchline-media-projects';
const media = 'media';
const index = 'project-list';
const version = 1;
const annotationTypes = new Set(['arrow','line','pen','highlight','zone','text','rectangle','oval',
  'spotlight','target','number','cross','measure','path','fov']);
const text = (value, length) => typeof value === 'string' && value.trim().length > 0 && value.length <= length;
const bounded = (value, lower, upper) => Number.isFinite(value) && value >= lower && value <= upper;
const validId = value => typeof value === 'string' && /^[\da-z-]{1,70}$/i.test(value);
let ready;

function openDatabase() {
  if (ready) return ready;
  ready = new Promise((resolve,reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser does not offer project storage.'));
      return;
    }
    const request = indexedDB.open(database,version);
    let abandoned = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(media,{keyPath:'id'});
      db.createObjectStore(index,{keyPath:'id'});
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      abandoned = true;
      reject(new Error('Close the other Touchline tab and try again.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) { db.close(); return; }
      db.onversionchange = () => { db.close(); ready = undefined; };
      db.onclose = () => { ready = undefined; };
      resolve(db);
    };
  }).catch(error => {
    ready = undefined;
    throw error;
  });
  return ready;
}

async function work(mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const transaction = db.transaction([media,index],mode);
    let request;
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error ?? new Error('Project storage was interrupted.'));
    transaction.onerror = event => reject(event.target.error ?? transaction.error ?? new Error('Project storage failed.'));
    try {
      request = callback(transaction.objectStore(media),transaction.objectStore(index));
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function validSummary(value) {
  return value && validId(value.id) && text(value.title,80) && bounded(value.updatedAt,1,9e15) &&
    Number.isInteger(value.clipCount) && bounded(value.clipCount,1,250);
}

function validMark(mark) {
  return mark && annotationTypes.has(mark.type) && typeof mark.color === 'string' && /^#[\da-f]{6}$/i.test(mark.color) &&
    Array.isArray(mark.points) && mark.points.length > 0 && mark.points.length <= 12000 &&
    mark.points.every(point => point && bounded(point.x,0,1920) && bounded(point.y,0,1920)) &&
    bounded(mark.radius,0,1920) && bounded(mark.width,0.001,140) && bounded(mark.scale,0.001,10) &&
    bounded(mark.pixelRatio,0.001,1000) && typeof mark.dashed === 'boolean' &&
    (mark.timing == null || (bounded(mark.timing.start,0,1e7) && bounded(mark.timing.end,mark.timing.start,1e7))) &&
    (!(mark.type === 'number' || mark.type === 'text') || text(mark.text,80)) &&
    validMediaKeyframes(mark.keyframes);
}

function validClip(clip) {
  return clip && (clip.kind === 'image' || clip.kind === 'video') && text(clip.name,255) &&
    clip.file instanceof Blob && clip.file.size > 0 && bounded(clip.time,0,1e7) &&
    Array.isArray(clip.marks) && clip.marks.length <= 3000 && clip.marks.every(validMark);
}

function validProject(project) {
  return validSummary(project) && project.version === version && Array.isArray(project.clips) &&
    project.clips.length === project.clipCount && project.clips.every(validClip) &&
    Number.isInteger(project.activeIndex) && bounded(project.activeIndex,0,project.clips.length-1);
}

export function newMediaProjectId() {
  return globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
}

export async function listMediaProjects() {
  const rows = await work('readonly',(_projects,summaries) => summaries.getAll());
  return rows.filter(validSummary).sort((first,second) => second.updatedAt-first.updatedAt);
}

export async function getMediaProject(id) {
  if (!validId(id)) throw new Error('Choose a saved project.');
  const project = await work('readonly',projects => projects.get(id));
  if (!project) throw new Error('That project is no longer on this device.');
  if (!validProject(project)) throw new Error('The saved project contains invalid media or annotations.');
  return project;
}

export async function saveMediaProject({id = newMediaProjectId(),title,clips,activeIndex}) {
  const summary = {id,title,updatedAt:Date.now(),clipCount:clips?.length};
  const project = {...summary,version,clips,activeIndex};
  if (!validProject(project)) throw new Error('Check the project name and save with valid clips and annotations.');
  await work('readwrite',(projects,summaries) => {
    projects.put(project);
    summaries.put(summary);
  });
  return summary;
}

export async function deleteMediaProject(id) {
  if (!validId(id)) throw new Error('Choose a saved project.');
  await work('readwrite',(projects,summaries) => {
    projects.delete(id);
    summaries.delete(id);
  });
}
