import type { Match } from "@/types";
import { getRankedCompletedFingerprints, getMatchesByIds } from "./store";

// Cache ukończonych meczów rankingowych (z rzutami) w IndexedDB.
// Pełne dane to kilka MB, a ukończone mecze prawie się nie zmieniają — co wejście
// pobieramy tylko lekką listę odcisków (id + completed_at + scores) i dociągamy
// mecze nowe lub zmienione (np. po przeliczeniu doubli w /dev).

const DB_NAME = "osmiornica-cache";
const STORE = "rankedMatches";

interface Entry {
  id: string;
  fingerprint: string;
  match: Match;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(db: IDBDatabase): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Entry[]);
    req.onerror = () => reject(req.error);
  });
}

function writeChanges(db: IDBDatabase, put: Entry[], remove: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const e of put) store.put(e);
    for (const id of remove) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Ukończone mecze rankingowe z pełną historią rzutów, od najnowszych. */
export async function getRankedCompletedMatches(): Promise<Match[]> {
  const list = await getRankedCompletedFingerprints();
  if (!list) return [];

  let db: IDBDatabase | null = null;
  let cached = new Map<string, Entry>();
  try {
    db = await openDb();
    cached = new Map((await readAll(db)).map((e) => [e.id, e]));
  } catch {
    // Brak IndexedDB (np. tryb prywatny) — pobieramy wszystko bez cache
  }

  const missing = list.filter((l) => cached.get(l.id)?.fingerprint !== l.fingerprint);
  const fetched = missing.length > 0 ? await getMatchesByIds(missing.map((m) => m.id)) : [];
  if (!fetched) return [];

  const fresh = new Map(fetched.map((m) => [m.id, m]));
  const put: Entry[] = missing
    .filter((l) => fresh.has(l.id))
    .map((l) => ({ id: l.id, fingerprint: l.fingerprint, match: fresh.get(l.id)! }));
  const listed = new Set(list.map((l) => l.id));
  const remove = [...cached.keys()].filter((id) => !listed.has(id));

  if (db && (put.length > 0 || remove.length > 0)) {
    try {
      await writeChanges(db, put, remove);
    } catch (e) {
      console.error("matchCache write error:", e);
    }
  }
  db?.close();

  return list
    .map((l) => fresh.get(l.id) ?? cached.get(l.id)?.match)
    .filter((m): m is Match => !!m);
}
