/**
 * Materials on site (punch list #209): a shot's shrunk bytes kept in this browser's IndexedDB under the note's id, so
 * a shot with no signal is not lost, the phone that took it can draw it and a kept shot can be sent later. The store
 * keeps only what waits: once the sweep has filed a shot in the job's Drive folder the folder holds the picture and
 * this phone's copy goes (`dropFiledPhotoBlobs`, and `readBoxPhotoBytes` for a shot it is asked to draw). Until that
 * rule a phone kept every shot it ever took. Browser io.
 */
import { boxPhotoIsFiled, phoneCopiesToDrop } from './boxPhotoSource'
import type { PhotoNote } from './photo'

const DB = 'pt.onSite.photos'
const STORE = 'blobs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('The phone could not open its photo store.'))
  })
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = act(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('The phone could not keep the photo.'))
    tx.oncomplete = () => db.close()
  }))
}

export function putPhotoBlob(id: string, blob: Blob): Promise<void> {
  return run('readwrite', (s) => s.put(blob, id)).then(() => undefined)
}

export function getPhotoBlob(id: string): Promise<Blob | null> {
  return run<Blob | undefined>('readonly', (s) => s.get(id)).then((b) => b ?? null)
}

export function deletePhotoBlob(id: string): Promise<void> {
  return run('readwrite', (s) => s.delete(id)).then(() => undefined)
}

/**
 * This phone's copies of the shots the sweep has filed, deleted in one pass over one connection: the ids the store
 * holds are listed, and only an id matched to a filed row with a Drive id goes (`phoneCopiesToDrop`). An id none of
 * these rows names stays, and so does a shot that still waits, whose bytes may be the only copy. Answers how many
 * went. Best effort and never throws: a phone with no store, a shut store or a failed delete answers 0 and the next
 * read of the job tries again.
 */
export async function dropFiledPhotoBlobs(photos: ReadonlyArray<Pick<PhotoNote, 'id' | 'driveFileId' | 'status'>>): Promise<number> {
  if (typeof indexedDB === 'undefined' || !photos.some(boxPhotoIsFiled)) return 0
  let db: IDBDatabase
  try {
    db = await open()
  } catch {
    return 0
  }
  try {
    const held = await new Promise<string[]>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys()
      req.onsuccess = () => resolve(req.result.filter((k): k is string => typeof k === 'string'))
      req.onerror = () => reject(req.error ?? new Error('The phone could not read its photo store.'))
    })
    const drop = phoneCopiesToDrop(held, photos)
    if (drop.length === 0) return 0
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of drop) store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('The phone could not clear its photo store.'))
      tx.onabort = () => reject(tx.error ?? new Error('The phone could not clear its photo store.'))
    })
    return drop.length
  } catch {
    return 0
  } finally {
    db.close()
  }
}
