// Минимальная обёртка над IndexedDB: проект и картинки отдельными записями.

const DB_NAME = "tma-builder";
const DB_VERSION = 1;
export const STORE_PROJECTS = "projects";
export const STORE_IMAGES = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB недоступна"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS);
      if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbGet = <T>(store: string, key: string) => tx<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbSet = (store: string, key: string, value: unknown) =>
  tx<IDBValidKey>(store, "readwrite", (s) => s.put(value, key)).then(() => undefined);
export const idbDel = (store: string, key: string) =>
  tx<undefined>(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
export const idbKeys = (store: string) => tx<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys());
