/**
 * The reads and writes behind a bid's photos (punch list #306, PR 3). The bytes go to the private `bid-photos` bucket
 * as `<bid_id>/<photo_id>.jpg` and a row in `bid_photos` follows; the press writes each shot's name and `added_at`; a
 * window closed without the press discards its rows and objects. The window's read is the `bid-photos` function's
 * `list` (where the photos go, why they are held, the rows, after it adopts what the Drive folder holds); when the
 * function does not answer, the rows are read straight from the table so the photos still show, with the reason.
 * A filed photo's thumbnail and bytes stream through the function; one still in the bucket shows by a signed URL.
 * Browser io, not pure.
 */
import { supabase } from '../supabase'
import { errorKindOf, formatErrorMessage } from '../../utils/errorHandling'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { PhotoSendError, type SendShotInput, type ShotIo } from '../photos/jobPhotoNotesIo'
import { makeBytesQueue, type BytesQueue } from '../photos/photoBytesQueue'
import { BID_PHOTOS_BUCKET, type BidPhotoFolderState } from './bidPhotos'
import { bidPhotoStoragePath, type BidPhotoAddWrite, type BidPhotoRow } from './bidPhotoWindow'

const FN = 'bid-photos'
const ROW_COLUMNS = 'id, name, by_name, by_user_id, taken_at, added_at, bytes, storage_path, drive_file_id, filed_at, fail_why'

/** The bytes to the bucket, then the row; the bytes are taken back when the row refuses. `jobId` carries the bid's id. */
export async function sendBidPhoto(input: SendShotInput): Promise<{ storagePath: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new PhotoSendError('This device has no signal.', 'network')
  const storagePath = bidPhotoStoragePath(input.jobId, input.id)
  const { error } = await supabase.storage.from(BID_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: true })
  if (error) throw new PhotoSendError(formatErrorMessage(error, 'The photo did not send.'), errorKindOf(error))
  const { error: rowError } = await supabase.from('bid_photos').upsert(
    {
      id: input.id,
      bid_id: input.jobId,
      by_user_id: input.byUserId,
      by_name: input.byName,
      taken_at: input.takenAt,
      bytes: input.blob.size,
      original_bytes: input.originalBytes,
      width: input.width,
      height: input.height,
      storage_path: storagePath,
    },
    { onConflict: 'id' },
  )
  if (rowError) {
    await supabase.storage.from(BID_PHOTOS_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new PhotoSendError(formatErrorMessage(rowError, 'The photo did not send.'), errorKindOf(rowError))
  }
  return { storagePath }
}

/** A window closed without the press: its sent shots leave the bucket and the table. Best-effort. */
export async function discardBidPhotos(photos: ReadonlyArray<{ id: string; storagePath: string | null }>): Promise<void> {
  const paths = photos.map((p) => p.storagePath).filter((p): p is string => Boolean(p))
  if (paths.length) await supabase.storage.from(BID_PHOTOS_BUCKET).remove(paths).catch(() => undefined)
  const ids = photos.map((p) => p.id)
  if (ids.length) await supabase.from('bid_photos').delete().in('id', ids).is('added_at', null)
}

export const bidPhotoShotIo: ShotIo = { send: sendBidPhoto, discard: discardBidPhotos }

/**
 * The press: each sent shot takes its name and `added_at`, one update a row. It keeps going past a row that refuses
 * and names it: `failedIds` are the shots that did not add, so the window keeps their tiles.
 */
export async function addBidPhotos(writes: ReadonlyArray<BidPhotoAddWrite>): Promise<{ added: number; failed: string[]; failedIds: string[] }> {
  let added = 0
  const failed: string[] = []
  const failedIds: string[] = []
  const addedAt = new Date().toISOString()
  for (const w of writes) {
    const { data, error } = await supabase.from('bid_photos').update({ name: w.name, added_at: addedAt }).eq('id', w.id).select('id')
    if (error || ((data ?? []) as unknown[]).length === 0) {
      failed.push(error ? formatErrorMessage(error, 'A photo did not add.') : 'A photo did not add.')
      failedIds.push(w.id)
    } else added += 1
  }
  return { added, failed, failedIds }
}

/** What the window reads for a bid: the folder's state (null when the function did not answer) and the photos. */
export interface BidPhotosRead {
  folder: BidPhotoFolderState | null
  /** Why the Drive side did not answer, when it did not; the rows then come straight from the table. */
  driveWhy: string | null
  photos: BidPhotoRow[]
  /** A signed URL for each photo still in the bucket, by its id. */
  previews: Record<string, string>
  /** How many pictures in the Drive folder this read took on as rows; the board's count is stale by that many. */
  adopted: number
}

async function previewsFor(rows: readonly BidPhotoRow[]): Promise<Record<string, string>> {
  const waiting = rows.filter((r) => !r.drive_file_id && r.storage_path)
  if (waiting.length === 0) return {}
  const out: Record<string, string> = {}
  try {
    const { data } = await supabase.storage.from(BID_PHOTOS_BUCKET).createSignedUrls(
      waiting.map((r) => r.storage_path as string),
      3600,
    )
    for (const r of waiting) {
      const hit = (data ?? []).find((d) => d.path === r.storage_path)
      if (hit?.signedUrl) out[r.id] = hit.signedUrl
    }
  } catch {
    /* a photo without its preview draws the grey square */
  }
  return out
}

async function rowsFromTable(bidId: string): Promise<BidPhotoRow[]> {
  const { data, error } = await supabase.from('bid_photos').select(ROW_COLUMNS).eq('bid_id', bidId).not('added_at', 'is', null).is('removed_at', null).order('taken_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data ?? []) as BidPhotoRow[]
}

/** The bid's photos and where they go. Throws only when neither the function nor the table reads. */
export async function loadBidPhotos(bidId: string): Promise<BidPhotosRead> {
  let folder: BidPhotoFolderState | null = null
  let driveWhy: string | null = null
  let photos: BidPhotoRow[] | null = null
  let adopted = 0
  try {
    const r = (await supabase.functions.invoke(FN, { body: { action: 'list', bid_id: bidId } })) as FnResult
    const problem = await fnProblem(r, 'Drive did not answer.')
    if (problem) driveWhy = problem
    else {
      const d = (r.data ?? {}) as { folder?: BidPhotoFolderState; photos?: BidPhotoRow[]; adopted?: number }
      folder = d.folder ?? null
      photos = Array.isArray(d.photos) ? d.photos : []
      adopted = Number(d.adopted ?? 0) || 0
    }
  } catch (e) {
    driveWhy = formatErrorMessage(e, 'Drive did not answer.')
  }
  if (photos == null) photos = await rowsFromTable(bidId)
  return { folder, driveWhy, photos, previews: await previewsFor(photos), adopted }
}

let thumbQueue: BytesQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 300 })
let fullQueue: BytesQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6 })

/** Forget every kept picture, with a sleep of the test's own when given. */
export function resetBidPhotoBytes(sleep?: (ms: number) => Promise<void>): void {
  thumbQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 300, sleep })
  fullQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6, sleep })
}

/**
 * A filed photo's thumbnail or full picture as an object URL, or null when the function refuses. A plain fetch under
 * the caller's sign-in, as `jobPhotosIo` does it: `functions.invoke` reads an image answer as text. The caller revokes
 * its own URL; the bytes stay kept in the queue.
 */
async function photoBytes(bidId: string, fileId: string, action: 'thumb' | 'full'): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return null
  const queue = action === 'thumb' ? thumbQueue : fullQueue
  const bytes = await queue.get(`${action}:${bidId}:${fileId}`, async () => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, bid_id: bidId, file_id: fileId }),
    })
    const retryAfter = Number(res.headers?.get?.('Retry-After') ?? '')
    return { status: res.status, blob: res.ok ? await res.blob() : null, retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : null }
  })
  return bytes ? URL.createObjectURL(bytes) : null
}

/** The reads and writes the window makes; a test hands its own. */
export interface BidPhotosWindowIo {
  load: (bidId: string) => Promise<BidPhotosRead>
  shots: ShotIo
  add: typeof addBidPhotos
  /** An object URL for a filed photo's thumbnail, or null; the caller revokes it. */
  thumb: (bidId: string, fileId: string) => Promise<string | null>
  full: (bidId: string, fileId: string) => Promise<string | null>
}

export function supabaseBidPhotosWindowIo(): BidPhotosWindowIo {
  return { load: loadBidPhotos, shots: bidPhotoShotIo, add: addBidPhotos, thumb: (b, f) => photoBytes(b, f, 'thumb'), full: (b, f) => photoBytes(b, f, 'full') }
}

/**
 * How many photos each bid has, for the Bid Board's photos icon: the added photos that stand, counted from one paged
 * read a chunk of bids, never one read a row. A bid with none is left out of the map.
 */
export async function loadBidPhotoCounts(bidIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const PAGE = 1000
  for (let i = 0; i < bidIds.length; i += 100) {
    const ids = bidIds.slice(i, i + 100)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('bid_photos').select('bid_id').in('bid_id', ids).not('added_at', 'is', null).is('removed_at', null).order('id', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as { bid_id: string }[]
      for (const r of rows) counts.set(r.bid_id, (counts.get(r.bid_id) ?? 0) + 1)
      if (rows.length < PAGE) break
    }
  }
  return counts
}
