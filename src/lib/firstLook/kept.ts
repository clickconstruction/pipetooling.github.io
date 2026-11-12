/**
 * What the phone keeps (punch list #319, the spike, v2.6981): a photo or a video picked on the customer's page is saved
 * in the browser's own store before anything is sent, so a lost signal or a closed page loses nothing. The page sends
 * what is kept when the signal is back, and offers it again when the link is opened later.
 *
 * The crew's outbox keeps its photos the same way (`lib/offline/keptPhotos.ts`); that one is tied to a sign-in and a
 * queue of presses, so the public page has this small store of its own.
 *
 * Three ways of keeping, tried in order. The file as the browser handed it, which costs no memory. Its raw bytes,
 * for a browser that will not store a file that way: Safari in a private window refuses one and takes the other,
 * found on the spike's walk in Safari's engine. And memory alone, for a browser with no store at all, where the
 * files live as long as the page and the page says so.
 */
import type { FirstLookKind } from './look'

/** A browser may clear what a page kept after about a week unused, so nothing older is offered. */
export const KEPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type KeptFile = {
  /** The page's own id for the file. */
  id: string
  /** The link it was picked on. */
  code: string
  kind: FirstLookKind
  name: string
  mime: string
  blob: Blob
  keptAt: number
  /** A video's length in seconds, when the phone could say. */
  seconds: number | null
  /** The function's id for it, once an upload address was handed out. */
  fileId: string | null
  /** Where an upload in pieces lives, so the next try picks up. */
  location: string | null
  /** How many times it picked up after a drop. */
  resumed: number
  /** How many times storage turned a piece away. After two the file goes in one request instead. */
  pieceFails: number
  /** When the first try began, for how long it took. */
  startedAt: number | null
}

export type KeptStore = {
  /** False when the browser has no lasting store and the files live only as long as the page. */
  lasting: boolean
  put(file: KeptFile): Promise<void>
  list(code: string): Promise<KeptFile[]>
  patch(id: string, change: Partial<Pick<KeptFile, 'fileId' | 'location' | 'resumed' | 'pieceFails' | 'startedAt' | 'seconds'>>): Promise<void>
  remove(id: string): Promise<void>
  /** Drops what was kept before `before`. */
  sweep(before: number): Promise<void>
}

const DB_NAME = 'first-look-kept'
const STORE = 'files'

function request<T>(req: IDBRequest<T>): Promise<T | undefined> {
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

/** Whether the transaction was kept: a write the browser accepts and then throws away at the commit is a no. */
function committed(tx: IDBTransaction): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
    tx.onabort = () => resolve(false)
  })
}

/** A row as the store holds it: the file itself, or its raw bytes where the browser will not store a file. */
type StoredRow = Omit<KeptFile, 'blob'> & { blob?: Blob; bytes?: ArrayBuffer }

function toKept(row: StoredRow): KeptFile | null {
  const blob = row.blob ?? (row.bytes ? new Blob([row.bytes], { type: row.mime }) : null)
  if (!blob) return null
  const { bytes: _bytes, ...rest } = row
  return { ...rest, pieceFails: rest.pieceFails ?? 0, blob }
}

async function tryPut(db: IDBDatabase, row: StoredRow): Promise<boolean> {
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const done = committed(tx)
    tx.objectStore(STORE).put(row)
    return await done
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('code', 'code', { unique: false })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** The store over memory alone: the fallback, and what the tests drive. */
export function createMemoryKeptStore(): KeptStore {
  const rows = new Map<string, KeptFile>()
  return {
    lasting: false,
    async put(file) {
      rows.set(file.id, file)
    },
    async list(code) {
      return [...rows.values()].filter((r) => r.code === code).sort((a, b) => a.keptAt - b.keptAt)
    },
    async patch(id, change) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...change })
    },
    async remove(id) {
      rows.delete(id)
    },
    async sweep(before) {
      for (const [id, r] of rows) if (r.keptAt < before) rows.delete(id)
    },
  }
}

/**
 * The store the page uses: IndexedDB when the browser has it, memory when it does not. A write that the browser
 * refuses (a full disk, a private window) falls back to memory for that file, so the page still sends it.
 */
export async function openKeptStore(open: () => Promise<IDBDatabase | null> = openDb): Promise<KeptStore> {
  const db = await open()
  const memory = createMemoryKeptStore()
  if (!db) return memory
  const inMemory = new Set<string>()
  return {
    lasting: true,
    async put(file) {
      if (await tryPut(db, file)) return
      try {
        const { blob, ...rest } = file
        if (await tryPut(db, { ...rest, bytes: await blob.arrayBuffer() })) return
      } catch {
        /* the bytes could not be read: memory is what is left */
      }
      inMemory.add(file.id)
      await memory.put(file)
    },
    async list(code) {
      let rows: KeptFile[] = []
      try {
        const tx = db.transaction(STORE, 'readonly')
        const stored = ((await request(tx.objectStore(STORE).index('code').getAll(code))) as StoredRow[] | undefined) ?? []
        rows = stored.map(toKept).filter((r): r is KeptFile => r !== null)
      } catch {
        rows = []
      }
      const extra = await memory.list(code)
      return [...rows.filter((r) => !inMemory.has(r.id)), ...extra].sort((a, b) => a.keptAt - b.keptAt)
    },
    async patch(id, change) {
      if (inMemory.has(id)) return memory.patch(id, change)
      try {
        const tx = db.transaction(STORE, 'readwrite')
        const done = settled(tx)
        const store = tx.objectStore(STORE)
        const row = (await request(store.get(id))) as StoredRow | undefined
        if (row) store.put({ ...row, ...change })
        await done
      } catch {
        /* the upload still goes; only the place to pick up from is lost */
      }
    },
    async remove(id) {
      if (inMemory.has(id)) {
        inMemory.delete(id)
        return memory.remove(id)
      }
      try {
        const tx = db.transaction(STORE, 'readwrite')
        const done = settled(tx)
        tx.objectStore(STORE).delete(id)
        await done
      } catch {
        /* it is swept after a week */
      }
    },
    async sweep(before) {
      await memory.sweep(before)
      try {
        const tx = db.transaction(STORE, 'readwrite')
        const done = settled(tx)
        const store = tx.objectStore(STORE)
        const all = ((await request(store.getAll())) as StoredRow[] | undefined) ?? []
        for (const r of all) if (r.keptAt < before) store.delete(r.id)
        await done
      } catch {
        /* nothing to do */
      }
    },
  }
}
