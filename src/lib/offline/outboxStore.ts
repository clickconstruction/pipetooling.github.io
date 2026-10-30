import { parseOutboxPress, type OutboxPress } from './outbox'

/**
 * IndexedDB adapter for the outbox (punch list #163 PR 2): one database, one store, keyed by
 * the press's id, the shape of `keptReadStore.ts`. Every call is best-effort: no IndexedDB (a
 * private window, an old WebView), a blocked open or a quota error resolves quietly, and the
 * queue then lives in memory for the page's life (`outboxState.ts`). Nothing here throws.
 */

export const OUTBOX_DB_NAME = 'pipetooling-outbox'
const DB_VERSION = 1
export const OUTBOX_STORE_NAME = 'presses'

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
      const req = indexedDB.open(OUTBOX_DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) db.createObjectStore(OUTBOX_STORE_NAME)
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

/** Every press the device kept, in shape; a press off the shape is dropped. */
export async function readAllPresses(): Promise<OutboxPress[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const tx = db.transaction(OUTBOX_STORE_NAME, 'readonly')
    const raw = await requestToPromise(tx.objectStore(OUTBOX_STORE_NAME).getAll())
    const out: OutboxPress[] = []
    for (const r of raw ?? []) {
      const p = parseOutboxPress(r)
      if (p) out.push(p)
    }
    return out
  } catch {
    return []
  } finally {
    db.close()
  }
}

export async function writePress(press: OutboxPress): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(OUTBOX_STORE_NAME, 'readwrite')
    tx.objectStore(OUTBOX_STORE_NAME).put(press, press.id)
    await settled(tx)
  } catch {
    // quota, a structured-clone refusal, a closing db: the press stays in memory for the page's life
  } finally {
    db.close()
  }
}

export async function deletePress(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(OUTBOX_STORE_NAME, 'readwrite')
    tx.objectStore(OUTBOX_STORE_NAME).delete(id)
    await settled(tx)
  } catch {
    // nothing to drop, or nowhere to drop it from
  } finally {
    db.close()
  }
}

/** Sign-out and an account switch drop every press on the device: a press is never sent as someone else. */
export async function clearOutbox(): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(OUTBOX_STORE_NAME, 'readwrite')
    tx.objectStore(OUTBOX_STORE_NAME).clear()
    await settled(tx)
  } catch {
    // nothing kept
  } finally {
    db.close()
  }
}
