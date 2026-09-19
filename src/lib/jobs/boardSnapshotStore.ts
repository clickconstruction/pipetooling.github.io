import { parseBoardSnapshot, type BoardSnapshot } from './boardSnapshot'

/**
 * IndexedDB adapter for the remembered Pipeline board (v2.3610). One database, one store,
 * keyed by the board key. Every call is best-effort: no IndexedDB (private windows, old
 * WebViews), a blocked open or a quota error resolves to `null` / `undefined` and the board
 * loads as it always did. Nothing here throws.
 */

const DB_NAME = 'pipetooling-board'
const DB_VERSION = 1
const STORE = 'boards'

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB != null
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(undefined)
  })
}

export async function readBoardSnapshot(key: string): Promise<BoardSnapshot | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const tx = db.transaction(STORE, 'readonly')
    const raw = await requestToPromise(tx.objectStore(STORE).get(key))
    return parseBoardSnapshot(raw)
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function writeBoardSnapshot(snapshot: BoardSnapshot): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(snapshot, snapshot.key)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // quota, a structured-clone refusal, a closing db — the next load simply has no snapshot
  } finally {
    db.close()
  }
}

/** Sign-out and an account switch drop every remembered board on the device. */
export async function clearBoardSnapshots(): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // nothing to drop, or nowhere to drop it from
  } finally {
    db.close()
  }
}
