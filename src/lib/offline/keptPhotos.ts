import type { CounterTicketPayload, FieldReportPayload, JobPhotosPayload, KeptShot, KeptTaskPhoto, KeptTicketPage, OutboxPress, TaskPhotoPayload } from './outbox'
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

/** The photos riding with a press: a field report's, a job photos press's (punch list #244), a task photo press's (punch list #273) or a counter ticket's pages (punch list #295); none for any other kind. */
export function keptPhotosOf(press: OutboxPress): KeptShot[] {
  if (press.kind === 'field-report') return (press.payload as FieldReportPayload).photos ?? []
  if (press.kind === 'job-photos') return (press.payload as JobPhotosPayload).photos ?? []
  if (press.kind === 'task-photo') return (press.payload as TaskPhotoPayload).photos ?? []
  if (press.kind === 'counter-ticket') return (press.payload as CounterTicketPayload).photos ?? []
  return []
}

/** The ones still on the phone: the replay sends them before the report. */
export function unsentKeptPhotos(press: OutboxPress): KeptShot[] {
  return keptPhotosOf(press).filter((p) => !p.sent)
}

/** The press with one photo's `sent` flag set, or with a photo whose bytes are gone taken off. */
export function withPhoto(press: OutboxPress, id: string, change: { sent: true } | { lost: true }): OutboxPress {
  const photos = keptPhotosOf(press)
  const next = 'lost' in change ? photos.filter((p) => p.id !== id) : photos.map((p) => (p.id === id ? { ...p, sent: true } : p))
  return { ...press, payload: { ...(press.payload as FieldReportPayload | JobPhotosPayload | TaskPhotoPayload | CounterTicketPayload), photos: next } } as OutboxPress
}

export type SendKeptPhoto = (input: { id: string; jobId: string; blob: Blob; byUserId: string; byName: string; takenAt: string; originalBytes: number; width: number; height: number }) => Promise<unknown>

/** A task card's shot (punch list #273): the same row `sendTaskPhoto` writes live, under the kept id. */
export type SendKeptTaskPhoto = (input: Omit<KeptTaskPhoto, 'sent' | 'bytes'> & { instanceId: string; blob: Blob; byUserId: string }) => Promise<unknown>

/** A counter ticket (punch list #295): its row first, since a page joins only a ticket that is there, then each page. */
export type SendKeptTicketRow = (press: OutboxPress) => Promise<unknown>
export type SendKeptTicketPage = (input: { ticketId: string; uploaderId: string; page: Omit<KeptTicketPage, 'sent' | 'bytes' | 'byName'> & { blob: Blob } }) => Promise<unknown>

export interface SendKeptIo {
  bytes?: KeptPhotosStore
  send?: SendKeptPhoto
  sendTask?: SendKeptTaskPhoto
  sendTicketRow?: SendKeptTicketRow
  sendTicketPage?: SendKeptTicketPage
}

/** The ticket's row as `sendTicketRow` takes it, from the kept press. */
export function ticketDraftOf(press: OutboxPress): { id: string; takenBy: string; takenByName: string; takenAt: string; takenAtFrom: 'press' | 'photo' | 'none'; source: 'camera' | 'file' | 'office'; jobId: string | null; alsoJobIds: string[]; noOneJob: boolean; poEntryId: string | null; total: number | null; note: string } {
  const p = press.payload as CounterTicketPayload
  return {
    id: p.ticketId,
    takenBy: press.userId,
    takenByName: p.byName,
    takenAt: p.takenAt,
    takenAtFrom: p.takenAtFrom,
    source: p.source,
    jobId: p.jobId,
    alsoJobIds: p.alsoJobIds ?? [],
    noOneJob: p.noOneJob === true,
    poEntryId: p.poEntryId,
    total: p.total,
    note: p.note ?? '',
  }
}

/**
 * Send a kept report's photos that are still on the phone, in order, each marked `sent` on the press as it lands so
 * a later try never sends it twice; a photo whose bytes are gone (a page reload on a device with no database) is
 * taken off the press and the report still goes. The first send that fails stops here with its error: the replay
 * counts the press's try and the rest wait, as a failed press does.
 */
export async function sendKeptPhotos(press: OutboxPress, store: OutboxStateStore, io: SendKeptIo = {}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const bytes = io.bytes ?? keptPhotos
  const task = press.kind === 'task-photo'
  const ticket = press.kind === 'counter-ticket'
  // What the shot belongs to: a task photo's card (punch list #273), a ticket's own id (punch list #295), else the job of a report or a job photos press.
  const owner = task ? (press.payload as TaskPhotoPayload).instanceId : ticket ? (press.payload as CounterTicketPayload).ticketId : (press.payload as FieldReportPayload | JobPhotosPayload).jobLedgerId
  let current = press
  if (ticket && owner && unsentKeptPhotos(press).length > 0) {
    // The ticket's row goes first: a page joins only a ticket that is there. The same write on every try.
    try {
      const sendRow = io.sendTicketRow ?? (async (p: OutboxPress) => (await import('../tickets/ticketsIo')).sendTicketRow(ticketDraftOf(p)))
      await sendRow(press)
    } catch (error) {
      return { ok: false, error }
    }
  }
  for (const photo of unsentKeptPhotos(press)) {
    if (!owner) {
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
      const facts = { id: photo.id, blob, byUserId: press.userId, byName: photo.byName, takenAt: photo.takenAt, originalBytes: photo.originalBytes, width: photo.width, height: photo.height }
      if (ticket) {
        // A ticket's page goes to the counter-tickets bucket and its own row (punch list #295), under the kept id.
        const t = photo as KeptTicketPage
        const sendPage =
          io.sendTicketPage ??
          (async (a: Parameters<SendKeptTicketPage>[0]) => (await import('../tickets/ticketsIo')).sendTicketPage({ id: a.ticketId, uploaderId: a.uploaderId }, { ...a.page, mime: a.page.mime }))
        await sendPage({ ticketId: owner, uploaderId: press.userId, page: { id: t.id, pageNo: t.pageNo, mime: t.mime, blob, originalBytes: t.originalBytes, width: t.width, height: t.height, takenAt: t.takenAt } })
      } else if (task) {
        // A task card's shot goes to the task-photos bucket and its own row (punch list #273), the line it proves on the row.
        const t = photo as KeptTaskPhoto
        const sendTask = io.sendTask ?? (await import('../photos/taskPhotosIo')).sendTaskPhoto
        await sendTask({ ...facts, instanceId: owner, kind: t.kind, percentAt: t.percentAt, criterionId: t.criterionId, lineBody: t.lineBody })
      } else {
        // A job photo goes to its own bucket and table (punch list #244); a report's as before.
        const send = io.send ?? (press.kind === 'job-photos' ? (await import('../photos/jobPhotoNotesIo')).sendJobPhotoNote : (await import('../photos/reportPhotosIo')).sendReportPhoto)
        await send({ ...facts, jobId: owner })
      }
    } catch (error) {
      return { ok: false, error }
    }
    current = withPhoto(current, photo.id, { sent: true })
    store.put(current)
    void bytes.drop([photo.id])
  }
  return { ok: true }
}
