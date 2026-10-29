/**
 * Materials on site (punch list #209), the spike's stand-in for the photo bucket: the shrunk bytes kept
 * in this browser's IndexedDB under the note's id, so the box screen and the office panel can draw a
 * thumbnail and a kept-on-phone shot can be sent later. Browser io. When the tables land, the bucket
 * holds the bytes until the sweep files them in Drive, and this store keeps only what waits for signal.
 */

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
