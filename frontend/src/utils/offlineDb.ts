const DB_NAME = 'werket-offline';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorkspaceOffline(data: { id: string; [key: string]: any }) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('IndexedDB save failed, falling back to localStorage', e);
  }
}

export async function loadWorkspaceOffline(id: string): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (e) {
    console.warn('IndexedDB load failed', e);
    return null;
  }
}

export async function saveFileOffline(file: { id: string; name: string; text: string; folder: string; lang: string; updated: number }) {
  await saveWorkspaceOffline({ id: `file-${file.id}`, name: file.name, text: file.text, folder: file.folder, lang: file.lang, updated: file.updated });
}

export async function loadAllFilesOffline(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = (request.result || []).filter((r: any) => r.id?.startsWith('file-'));
        db.close();
        resolve(results);
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (e) {
    console.warn('IndexedDB loadAll failed', e);
    return [];
  }
}
