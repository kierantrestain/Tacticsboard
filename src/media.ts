export async function mediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("fixture-media", 3);
    let blocked=false;
    r.onupgradeneeded = () => {
      for (const name of ["assets", "meta", "projects", "checkpoints", "staging", "resources"])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name);
    };
    r.onsuccess = () => {if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};
    r.onblocked = () => {blocked=true;reject(Error("Close older studio tabs and retry the storage upgrade. Your existing episodes are retained."));};
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
    t.onabort = t.onerror = () => {
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
