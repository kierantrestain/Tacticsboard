export async function mediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("fixture-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("assets");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveMedia(id: string, file: Blob) {
  const db = await mediaDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction("assets", "readwrite");
    t.objectStore("assets").put(file, id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}
export async function getMedia(id: string): Promise<Blob | null> {
  const db = await mediaDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("assets", "readonly"),
      r = t.objectStore("assets").get(id);
    r.onsuccess = () => {
      db.close();
      resolve(r.result || null);
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
