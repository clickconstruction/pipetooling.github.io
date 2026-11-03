/**
 * A site's photos as History lines (punch list #247, PR 2; the owner, 2026-11-02: *seeing them in line is useful if
 * we base it on their metadata*). The metadata is on the `uploaded_photos` row: `taken_at` is the when, the job is
 * the About, who uploaded is the by, the stage and the caption are the words. Photos that belong together are one
 * line: the same piece, the same person, within one hour of the batch's newest shot — *Photos · JP629 Lot 14 · 4
 * photos · Rough-in · Malachi*, drawn with up to four thumbnails and a *+ N* tile past four. One photo is one line
 * with one thumbnail. Pure; the rows come from the page's `useSitePhotos`, the same rows the Photos look draws.
 */
import type { ChangeAbout, ChangeLine } from './whatChanged'
import { timeWords, whoWords, type UploadedPhotoRow } from '../photos/uploadedPhotos'

/** Photos on one piece by one person fold into one line while each is within this long of the batch's newest. */
export const PHOTO_BATCH_MS = 60 * 60_000

/** A line draws this many tiles: thumbnails, or three and a *+ N* tile past four. */
export const LINE_TILES = 4

export type PhotoLineLabels = {
  job: (id: string) => ChangeAbout | null
  bid: (id: string) => ChangeAbout | null
  siteName: string
}

/** Who the row counts as, for the fold: the user when known, else the name as kept. */
function personKey(row: UploadedPhotoRow): string {
  return row.by_user_id ?? `name:${row.by_name.trim().toLowerCase()}`
}

/** Up to three distinct captions, quoted, that say more than the stage does. */
export function captionWordsOf(rows: ReadonlyArray<UploadedPhotoRow>, stage: string): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    const c = r.caption.trim()
    if (!c || c.toLowerCase() === stage.toLowerCase() || seen.has(c.toLowerCase())) continue
    seen.add(c.toLowerCase())
    out.push(c)
    if (out.length === 3) break
  }
  return out.length ? `“${out.join(', ')}”` : ''
}

/** The time at the line's end: one time, or *7:42–8:15 AM* across a batch. */
export function photoTimeRange(rows: ReadonlyArray<UploadedPhotoRow>): string {
  if (!rows.length) return ''
  const newest = rows[0]!.taken_at
  const oldest = rows[rows.length - 1]!.taken_at
  const a = timeWords(oldest)
  const b = timeWords(newest)
  if (!a || !b || a === b) return b || a
  // The same AM/PM is said once: *7:42–8:15 AM*; across noon both are kept: *11:50 AM–12:10 PM*.
  const [aT, aP] = a.split(' ')
  const [bT, bP] = b.split(' ')
  return aP === bP ? `${aT}–${bT} ${bP}` : `${a}–${b}`
}

/**
 * The lines: the rows newest first, each joining the open batch of its piece and person while it is within the hour
 * of that batch's newest shot, else opening a batch of its own. Each batch is one line at its newest shot's time, the
 * rows kept on it newest first for the thumbnails and the viewer.
 */
export function foldPhotoBatches(rows: ReadonlyArray<UploadedPhotoRow>, labels: PhotoLineLabels): ChangeLine[] {
  const sorted = [...rows].sort((a, b) => b.taken_at.localeCompare(a.taken_at) || b.id.localeCompare(a.id))
  const open = new Map<string, { rows: UploadedPhotoRow[]; newestMs: number }>()
  const batches: UploadedPhotoRow[][] = []
  for (const r of sorted) {
    const key = `${r.job_id ?? r.bid_id ?? 'site'}|${personKey(r)}`
    const ms = Date.parse(r.taken_at)
    const b = open.get(key)
    if (b && Number.isFinite(ms) && b.newestMs - ms <= PHOTO_BATCH_MS) {
      b.rows.push(r)
      continue
    }
    const made = { rows: [r], newestMs: Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY }
    open.set(key, made)
    batches.push(made.rows)
  }
  return batches.map((batch) => photoLine(batch, labels))
}

/** One batch as a line. */
export function photoLine(batch: UploadedPhotoRow[], labels: PhotoLineLabels): ChangeLine {
  const first = batch[0]!
  const about: ChangeAbout =
    (first.job_id ? labels.job(first.job_id) : null) ??
    (first.bid_id ? labels.bid(first.bid_id) : null) ??
    (first.job_id ? { kind: 'job', id: first.job_id, label: 'a job no longer here' } : first.bid_id ? { kind: 'bid', id: first.bid_id, label: 'a bid no longer here' } : { kind: 'site', id: null, label: labels.siteName })
  const n = batch.length
  const stage = first.stage_name.trim()
  const detail = [`${n} ${n === 1 ? 'photo' : 'photos'}`, stage, captionWordsOf(batch, stage)].filter(Boolean).join(' · ')
  const by = whoWords(first)
  const searchText = [...new Set(batch.flatMap((r) => [r.caption.trim(), r.stage_name.trim(), r.by_name.trim()]).filter(Boolean))].join(' ')
  return {
    id: `photos:${first.source}:${first.id}`,
    at: first.taken_at,
    kind: 'photos',
    verb: n === 1 ? 'Photo' : 'Photos',
    about,
    detail,
    by,
    waitingDays: null,
    withTime: true,
    timeRange: photoTimeRange(batch),
    photos: batch,
    searchText,
  }
}

export type LineTile = { kind: 'photo'; row: UploadedPhotoRow; index: number } | { kind: 'more'; count: number }

/** A line's tiles: every photo while they fit, else three and a *+ N* tile. */
export function lineTiles(photos: ReadonlyArray<UploadedPhotoRow>, tiles = LINE_TILES): LineTile[] {
  if (photos.length <= tiles) return photos.map((row, index) => ({ kind: 'photo', row, index }))
  const shown = photos.slice(0, tiles - 1)
  return [...shown.map((row, index): LineTile => ({ kind: 'photo', row, index })), { kind: 'more', count: photos.length - shown.length }]
}
