import { parseKeptRead, type KeptRead } from './keptRead'

/**
 * IndexedDB adapter for the kept read (#183 PR 2, v2.6031; the shape of the Pipeline's
 * `boardSnapshotStore.ts`, v2.3610, which it retires). One database, one store, keyed by the kept
 * read's key. Every call is best-effort: no IndexedDB (private windows, old WebViews), a blocked
 * open or a quota error resolves to `null` / `undefined` and the page loads as it always did.
 * Nothing here throws.
 */

export const KEPT_READ_DB_NAME = 'pipetooling-kept'
const DB_VERSION = 1
export const KEPT_READ_STORE_NAME = 'pages'
/** The Pipeline's database before this one; dropped the first time the store is cleared on a device. */
const RETIRED_BOARD_DB_NAME = 'pipetooling-board'

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
      const req = indexedDB.open(KEPT_READ_DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(KEPT_READ_STORE_NAME)) db.createObjectStore(KEPT_READ_STORE_NAME)
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

function settled(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}

/** The read kept under `key`, when one is there and in shape; `rowIsValid` is the page's own check on each row. */
export async function readKeptRead(key: string, rowIsValid?: (row: unknown) => boolean): Promise<KeptRead | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const tx = db.transaction(KEPT_READ_STORE_NAME, 'readonly')
    const raw = await requestToPromise(tx.objectStore(KEPT_READ_STORE_NAME).get(key))
    return parseKeptRead(raw, rowIsValid)
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function writeKeptRead(kept: KeptRead): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(KEPT_READ_STORE_NAME, 'readwrite')
    tx.objectStore(KEPT_READ_STORE_NAME).put(kept, kept.key)
    await settled(tx)
  } catch {
    // quota, a structured-clone refusal, a closing db — the next load simply has nothing kept
  } finally {
    db.close()
  }
}

/** Sign-out and an account switch drop every kept read on the device, and the retired board database with them. */
export async function clearKeptReads(): Promise<void> {
  if (!hasIndexedDb()) return
  try {
    indexedDB.deleteDatabase(RETIRED_BOARD_DB_NAME)
  } catch {
    // nothing retired here
  }
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(KEPT_READ_STORE_NAME, 'readwrite')
    tx.objectStore(KEPT_READ_STORE_NAME).clear()
    await settled(tx)
  } catch {
    // nothing to drop, or nowhere to drop it from
  } finally {
    db.close()
  }
}
