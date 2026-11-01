import type { FieldReportPayload, KeptReportPhoto, OutboxPress } from './outbox'
import type { OutboxStateStore } from './outboxState'
import { KEPT_PHOTOS_STORE_NAME, openOutboxDb } from './outboxStore'

/**
 * A kept report's photos (punch list #229, PR 6; #189's PR 7). A shot shrunk with no signal waits on the phone: its
 * bytes here, in the outbox's own database under the photo's id, and its facts on the press (`KeptReportPhoto` in
 * the field report's payload). When the signal returns the replay sends each unsent photo's bytes and row first,
 * with the same id every try so a resend counts once, then lands the report, and `afterLanding` ties the photos to
 * it and drops the bytes. A device with no IndexedDB (a private window) keeps the bytes in memory for the page's
 * life, as the outbox keeps its presses. Nothing here throws.
 */

export interface KeptPhotosStore {
  /** Keep the shrunk bytes; false when nowhere can hold them (then the tile fails with Retry, as before). */
  keep(id: string, blob: Blob, now?: number): Promise<boolean>
  read(id: string): Promise<Blob | null>
  drop(ids: ReadonlyArray<string>): Promise<void>
  /** Drop bytes kept before `before`: a press dropped by a person, or lost to a prune, leaves no bytes behind for good. */
  sweep(before: number): Promise<void>
}

/** A kept shot is swept after this long: the queue's own presses need a person well before it. */
export const KEPT_PHOTO_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface KeptRow {
  id: string
  blob: Blob
  keptAt: number
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

export function createKeptPhotos(io: { open?: () => Promise<IDBDatabase | null> } = {}): KeptPhotosStore {
  const open = io.open ?? openOutboxDb
  /** Where the bytes live when the device has no database. */
  const memory = new Map<string, KeptRow>()
  return {
    async keep(id, blob, now = Date.now()) {
      const row: KeptRow = { id, blob, keptAt: now }
      const db = await open().catch(() => null)
      if (!db) {
        memory.set(id, row)
        return true
      }
      try {
        const tx = db.transaction(KEPT_PHOTOS_STORE_NAME, 'readwrite')
        tx.objectStore(KEPT_PHOTOS_STORE_NAME).put(row, id)
        await settled(tx)
        return true
      } catch {
        // quota, a structured-clone refusal: nowhere to keep it
        return false
      } finally {
        db.close()
      }
    },
    async read(id) {
      const db = await open().catch(() => null)
      if (!db) return memory.get(id)?.blob ?? null
      try {
        const tx = db.transaction(KEPT_PHOTOS_STORE_NAME, 'readonly')
        const row = (await requestToPromise(tx.objectStore(KEPT_PHOTOS_STORE_NAME).get(id))) as KeptRow | undefined
        return row?.blob instanceof Blob ? row.blob : null
      } catch {
        return null
      } finally {
        db.close()
      }
    },
    async drop(ids) {
      if (ids.length === 0) return
      const db = await open().catch(() => null)
      if (!db) {
        for (const id of ids) memory.delete(id)
        return
      }
      try {
        const tx = db.transaction(KEPT_PHOTOS_STORE_NAME, 'readwrite')
        for (const id of ids) tx.objectStore(KEPT_PHOTOS_STORE_NAME).delete(id)
        await settled(tx)
      } catch {
        // nothing to drop, or nowhere to drop it from
      } finally {
        db.close()
      }
    },
    async sweep(before) {
      const db = await open().catch(() => null)
      if (!db) {
        for (const [id, row] of memory) if (row.keptAt < before) memory.delete(id)
        return
      }
      try {
        const tx = db.transaction(KEPT_PHOTOS_STORE_NAME, 'readwrite')
        const store = tx.objectStore(KEPT_PHOTOS_STORE_NAME)
        const rows = ((await requestToPromise(store.getAll())) ?? []) as KeptRow[]
        for (const row of rows) if (typeof row.keptAt === 'number' && row.keptAt < before) store.delete(row.id)
        await settled(tx)
      } catch {
        // left for the next sweep
      } finally {
        db.close()
      }
    },
  }
}

/** The app's one store of kept bytes. */
export const keptPhotos: KeptPhotosStore = createKeptPhotos()

/** The photos riding with a press: none for a press that is not a field report. */
export function keptPhotosOf(press: OutboxPress): KeptReportPhoto[] {
  if (press.kind !== 'field-report') return []
  return (press.payload as FieldReportPayload).photos ?? []
}

/** The ones still on the phone: the replay sends them before the report. */
export function unsentKeptPhotos(press: OutboxPress): KeptReportPhoto[] {
  return keptPhotosOf(press).filter((p) => !p.sent)
}

/** The press with one photo's `sent` flag set, or with a photo whose bytes are gone taken off. */
export function withPhoto(press: OutboxPress, id: string, change: { sent: true } | { lost: true }): OutboxPress {
  const photos = keptPhotosOf(press)
  const next = 'lost' in change ? photos.filter((p) => p.id !== id) : photos.map((p) => (p.id === id ? { ...p, sent: true } : p))
  return { ...press, payload: { ...(press.payload as FieldReportPayload), photos: next } }
}

export type SendKeptPhoto = (input: { id: string; jobId: string; blob: Blob; byUserId: string; byName: string; takenAt: string; originalBytes: number; width: number; height: number }) => Promise<unknown>

export interface SendKeptIo {
  bytes?: KeptPhotosStore
  send?: SendKeptPhoto
}

/**
 * Send a kept report's photos that are still on the phone, in order, each marked `sent` on the press as it lands so
 * a later try never sends it twice; a photo whose bytes are gone (a page reload on a device with no database) is
 * taken off the press and the report still goes. The first send that fails stops here with its error: the replay
 * counts the press's try and the rest wait, as a failed press does.
 */
export async function sendKeptPhotos(press: OutboxPress, store: OutboxStateStore, io: SendKeptIo = {}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const bytes = io.bytes ?? keptPhotos
  const jobId = (press.payload as FieldReportPayload).jobLedgerId
  let current = press
  for (const photo of unsentKeptPhotos(press)) {
    if (!jobId) {
      current = withPhoto(current, photo.id, { lost: true })
      store.put(current)
      continue
    }
    const blob = await bytes.read(photo.id)
    if (!blob) {
      current = withPhoto(current, photo.id, { lost: true })
      store.put(current)
      continue
    }
    try {
      const send = io.send ?? (await import('../photos/reportPhotosIo')).sendReportPhoto
      await send({ id: photo.id, jobId, blob, byUserId: press.userId, byName: photo.byName, takenAt: photo.takenAt, originalBytes: photo.originalBytes, width: photo.width, height: photo.height })
    } catch (error) {
      return { ok: false, error }
    }
    current = withPhoto(current, photo.id, { sent: true })
    store.put(current)
    void bytes.drop([photo.id])
  }
  return { ok: true }
}
