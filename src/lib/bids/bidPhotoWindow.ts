/**
 * The Bid Board's photos icon and the window behind it (punch list #306, PR 3): the pure rules. The icon is always in
 * its place in the Links column, grey until the bid has photos and blue with their count after. The window adds
 * photos (a pick or a drop at a desk, the camera on a phone), names where they go, and shows what the bid has. A
 * photo goes to the `bid-photos` bucket with a `bid_photos` row the moment it is picked; the press writes `added_at`,
 * and the photo sweep files it into the bid's project folder under Team only › Photos. The first press on a bid names
 * the folder it makes. The Drive side's rules are `bidPhotos.ts`; the reads and writes are `bidPhotosIo.ts`.
 *
 * With no signal (PR 8) a shot is kept on the phone and counts as ready: the press then goes through the outbox as a
 * `bid-photos` press (`queuedBidPhotos`), and the window says how many of the bid's photos still wait on the phone
 * (`photosOnThisPhone`).
 */
import { countedLabel, pluralNoun } from '../batchWords'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { BidPhotosPayload, KeptBidPhoto, OutboxPress } from '../offline/outbox'
import type { ShotTileBase } from '../photos/shotTiles'
import { bidPhotoPathWords, type BidPhotoFolderState } from './bidPhotos'

/** A bid photo as the window reads it: the `bid-photos` function's row. */
export interface BidPhotoRow {
  id: string
  name: string
  by_name: string
  by_user_id: string | null
  taken_at: string
  added_at: string | null
  bytes: number
  storage_path: string | null
  drive_file_id: string | null
  filed_at: string | null
  fail_why: string | null
}

/** A photo picked in the window, from the pick to the press: the shot tile and the name the person gives it. */
export type BidPhotoTile = ShotTileBase & { name: string }

export const BID_PHOTO_NAME_MAX = 120

const PHOTO_NOUN = ['photo', 'photos'] as const

export const BID_PHOTO_WORDS = {
  title: 'Photos',
  add: 'Add photos',
  take: 'Take a photo',
  pick: 'Pick from this phone',
  pickMore: 'Pick more',
  takeAnother: 'Take another',
  cancel: 'Cancel',
  drop: 'Drop photos here',
  shrinking: 'Making it smaller…',
  sending: 'Sending…',
  sent: 'Ready',
  retry: 'Retry',
  remove: 'Remove',
  nameLabel: 'What is it?',
  optional: 'optional',
  plainName: 'Photo',
  notInDrive: 'Not in Drive yet',
  openFolder: 'Open in Drive ↗',
  reading: 'Reading the photos…',
  trainingWhy: 'A training account can look at a bid’s photos and cannot add one.',
} as const

/** Where a bid's shot waits in the `bid-photos` bucket. */
export function bidPhotoStoragePath(bidId: string, photoId: string): string {
  return `${bidId}/${photoId}.jpg`
}

/** A name as the row keeps it: single spaces, trimmed, the column's length. */
export function bidPhotoNameTrimmed(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, BID_PHOTO_NAME_MAX)
}

/** The photos slot in the Bid Board's Links column: grey with nothing, blue with the count. */
export interface PhotosSlot {
  state: 'grey' | 'blue'
  /** The count beside the icon, or null at zero. */
  count: string | null
  /** The icon's name on hover and to a screen reader. */
  title: string
}

/** The slot for a bid with `count` photos. A count that did not read draws grey and says only what a press does. */
export function photosSlot(count: number | null | undefined): PhotosSlot {
  const n = count != null && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (n <= 0) return { state: 'grey', count: null, title: count == null ? 'Photos' : 'No photos yet · Add photos' }
  return { state: 'blue', count: n > 99 ? '99+' : String(n), title: `${n} ${pluralNoun(PHOTO_NOUN, n)}` }
}

/** A file handed to the window that is not a picture, with the reason it stays out. */
export interface HeldFile {
  name: string
  why: string
}

/** A pick or a drop, split: the pictures go on, a video or any other file is held with its reason. */
export function sortPickedFiles<F extends { name: string; type: string }>(files: readonly F[]): { photos: F[]; held: HeldFile[] } {
  const photos: F[] = []
  const held: HeldFile[] = []
  for (const f of files) {
    const type = (f.type ?? '').toLowerCase()
    const isImage = type.startsWith('image/') || (!type && /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name))
    if (isImage) photos.push(f)
    else if (type.startsWith('video/') || /\.(mov|mp4|m4v|avi|webm)$/i.test(f.name)) held.push({ name: f.name, why: 'A video. Photos only for now.' })
    else held.push({ name: f.name, why: 'Not a picture.' })
  }
  return { photos, held }
}

/** The line that says files were left out, with the first one's name and reason. */
export function heldFilesWords(held: readonly HeldFile[]): string | null {
  if (held.length === 0) return null
  const first = held[0]!
  if (held.length === 1) return `1 file was left out: ${first.name}. ${first.why}`
  return `${held.length} files were left out. The first is ${first.name}. ${first.why}`
}

/** What the device is called in the words about a kept photo: a narrow screen is a phone, any other is a device. */
export function keptPlace(phone: boolean): string {
  return phone ? 'this phone' : 'this device'
}

/** A tile's words under its picture, by where the shot is. */
export function tileStatusWords(tile: Pick<BidPhotoTile, 'status' | 'failWhy'>, phone = true): { text: string; tone: 'quiet' | 'busy' | 'good' | 'warn' } {
  switch (tile.status) {
    case 'shrinking':
      return { text: BID_PHOTO_WORDS.shrinking, tone: 'quiet' }
    case 'sending':
      return { text: BID_PHOTO_WORDS.sending, tone: 'busy' }
    case 'sent':
      return { text: BID_PHOTO_WORDS.sent, tone: 'good' }
    case 'kept':
      return { text: `Kept on ${keptPlace(phone)}.`, tone: 'warn' }
    case 'failed':
      return { text: tile.failWhy || 'The photo did not send.', tone: 'warn' }
  }
}

/** What the press writes for one shot. */
export interface BidPhotoAddWrite {
  id: string
  name: string
}

/** The writes for the shots that are in the bucket with their row. */
export function addWrites(tiles: readonly BidPhotoTile[]): BidPhotoAddWrite[] {
  return tiles.filter((t) => t.status === 'sent').map((t) => ({ id: t.id, name: bidPhotoNameTrimmed(t.name) }))
}

/** A shot the press takes: in the bucket with its row, or kept on the phone with no signal (PR 8). */
export function shotIsReady(tile: Pick<BidPhotoTile, 'status'>): boolean {
  return tile.status === 'sent' || tile.status === 'kept'
}

/** How many shots wait on the phone: with any, the press goes through the outbox. */
export function keptCount(tiles: readonly Pick<BidPhotoTile, 'status'>[]): number {
  return tiles.filter((t) => t.status === 'kept').length
}

/**
 * The ready shots as a kept press carries them (PR 8): a kept one unsent, a sent one with only the landing left, each
 * with its name as the row will keep it.
 */
export function queuedBidPhotos(tiles: readonly BidPhotoTile[], byName: string): KeptBidPhoto[] {
  return tiles.filter(shotIsReady).map((t) => ({
    id: t.id,
    sent: t.status === 'sent',
    name: bidPhotoNameTrimmed(t.name),
    takenAt: t.takenAt,
    bytes: t.bytes,
    originalBytes: t.originalBytes,
    width: t.width,
    height: t.height,
    byName,
  }))
}

/**
 * The line under the tiles while a shot is kept: what the press does with no signal, by the press's own name. Null
 * when none is kept.
 */
export function keptNextWords(input: { tiles: readonly Pick<BidPhotoTile, 'status'>[]; pressLabel: string; phone: boolean }): string | null {
  if (keptCount(input.tiles) === 0) return null
  const one = input.tiles.filter(shotIsReady).length === 1
  return `There is no signal. ${input.pressLabel} keeps ${one ? 'it' : 'them'} on ${keptPlace(input.phone)}. ${one ? 'It goes' : 'They go'} to the bid when the signal is back.`
}

/** The toast after a press that was kept. */
export function queuedWords(count: number, phone: boolean): string {
  return `Kept on ${keptPlace(phone)}. ${count === 1 ? 'The photo goes' : 'The photos go'} to the bid when the signal is back.`
}

/** The bid's photos still on this phone: the shots of its `bid-photos` presses that wait or are in flight. */
export function photosOnThisPhone(presses: readonly OutboxPress[], bidId: string): number {
  let n = 0
  for (const p of presses) {
    if (p.kind !== 'bid-photos' || (p.state !== 'waiting' && p.state !== 'sending')) continue
    const payload = p.payload as BidPhotosPayload
    if (payload.bidId === bidId) n += (payload.photos ?? []).length
  }
  return n
}

/** The window's line for them. Null when none wait. */
export function onThisPhoneWords(count: number, phone: boolean): string | null {
  if (count <= 0) return null
  return count === 1
    ? `1 photo waits on ${keptPlace(phone)}. It goes to the bid when the signal is back.`
    : `${count} photos wait on ${keptPlace(phone)}. They go to the bid when the signal is back.`
}

/** Whether a landed press is this bid's photos: the window reads again, and the board counts again. */
export function landedBidPhotos(detail: { kind?: unknown; result?: unknown } | null | undefined): string | null {
  if (!detail || detail.kind !== 'bid-photos') return null
  const id = detail.result && typeof detail.result === 'object' ? (detail.result as { bid_id?: unknown }).bid_id : null
  return typeof id === 'string' && id ? id : null
}

/** Whether the bid's photo folder exists yet. Null (the folder did not read) counts as made: the press never claims to make what it cannot see. */
export function folderIsMade(folder: Pick<BidPhotoFolderState, 'kind'> | null): boolean {
  return folder == null || folder.kind === 'ready'
}

/**
 * The window's press. *Make the folder and add 3 photos* the first time on a bid, *Add 3 photos* after, counted from
 * the shots that are ready, a shot kept on the phone among them. Dead while nothing is ready, while a shot is still on
 * its way, or while the press runs.
 */
export function addPress(input: { tiles: readonly BidPhotoTile[]; adding: boolean; folder: Pick<BidPhotoFolderState, 'kind'> | null }): { label: string; dead: boolean } {
  const ready = input.tiles.filter(shotIsReady).length
  const inFlight = input.tiles.some((t) => t.status === 'shrinking' || t.status === 'sending')
  const verb = folderIsMade(input.folder) ? 'Add' : 'Make the folder and add'
  if (input.adding) return { label: 'Adding…', dead: true }
  return { label: countedLabel(verb, ready, PHOTO_NOUN), dead: ready === 0 || inFlight }
}

/** The lines that say where the photos go, before the press: what it makes the first time, where they land after. */
export function whereWords(folder: BidPhotoFolderState | null, count: number): { lead: string; path: string } | null {
  if (!folder || !folder.projectName) return null
  const it = count === 1 ? 'the photo' : 'the photos'
  const path = bidPhotoPathWords(folder.projectName)
  if (folder.kind === 'ready') return { lead: `This puts ${it} in the bid’s photo folder:`, path }
  if (folder.kind === 'project') return { lead: `This makes the bid’s photo folder and puts ${it} in it:`, path }
  return { lead: `This bid has no project folder yet. This makes one in the company’s shared Drive, with the photo folder inside, and puts ${it} in it:`, path }
}

/** The toast after the press: what was added, and what was not with the first reason. */
export function addedWords(out: { added: number; failed: readonly string[] }): { text: string; tone: 'success' | 'warning' } {
  const added = out.added > 0 ? `${countedLabel('Added', out.added, PHOTO_NOUN)}.` : ''
  if (out.failed.length === 0) return { text: added || 'Nothing was added.', tone: added ? 'success' : 'warning' }
  const not = out.failed.length === 1 ? '1 did not add' : `${out.failed.length} did not add`
  return { text: `${added ? `${added} ` : ''}${not}: ${out.failed[0]}`, tone: 'warning' }
}

/**
 * A picture the app filed itself is named by its day, its sender and its caption, *2026-11-01 Priya Raman · Gas
 * meter*. Under a tile that name is cut off before the one part that tells photos apart, so it is read as its
 * parts: the caption is the name and the sender is who. Null for any other name.
 */
export function appFiledNameParts(name: string): { sender: string; caption: string } | null {
  const m = /^\d{4}-\d{2}-\d{2} (.+?) · (.+)$/.exec(name.trim())
  return m ? { sender: m[1]!.trim(), caption: m[2]!.trim() } : null
}

/** The words under a photo in the grid: its name or *Photo*, who and the day, and whether Drive holds it yet. */
export function gridTileWords(row: Pick<BidPhotoRow, 'name' | 'by_name' | 'taken_at' | 'filed_at' | 'fail_why'>, todayYmd: string): { name: string; unnamed: boolean; who: string; waiting: string | null } {
  // Only a row with nobody on it is read this way: a photo a person named keeps the name they gave it.
  const parts = row.by_name.trim() ? null : appFiledNameParts(row.name)
  const name = (parts ? parts.caption : row.name).trim()
  return {
    name: name || BID_PHOTO_WORDS.plainName,
    unnamed: !name,
    who: [parts ? parts.sender : row.by_name.trim(), photoDayWords(row.taken_at, todayYmd)].filter(Boolean).join(' · '),
    waiting: row.filed_at ? null : BID_PHOTO_WORDS.notInDrive,
  }
}

/**
 * The line when the Drive side did not answer and the photos came straight from the app. A request that never
 * reached the function says so in plain words; any other reason is the function's own sentence.
 */
export function driveSilentWords(why: string): string {
  const unreached = /failed to send a request|failed to fetch|networkerror|load failed/i.test(why)
  return unreached ? 'Drive could not be reached just now. The bid’s photos still show. Its folder does not.' : `Drive did not answer, so the folder is not shown. ${why}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A photo's day in the company's zone: *today*, *Nov 6*, or *Nov 6, 2025* for another year. */
export function photoDayWords(iso: string, todayYmd: string): string {
  const ymd = calendarYmdInAppTzFromIso(iso)
  if (!ymd) return ''
  if (ymd === todayYmd) return 'today'
  const [y, m, d] = ymd.split('-').map(Number)
  const month = MONTHS[(m ?? 1) - 1] ?? ''
  return y === Number(todayYmd.slice(0, 4)) ? `${month} ${d}` : `${month} ${d}, ${y}`
}

/** The line over the grid: *12 photos*, and how many still wait on Drive. */
export function gridHeadWords(rows: readonly Pick<BidPhotoRow, 'filed_at'>[]): string {
  const waiting = rows.filter((r) => !r.filed_at).length
  const total = `${rows.length} ${pluralNoun(PHOTO_NOUN, rows.length)}`
  return waiting > 0 ? `${total} · ${waiting} not in Drive yet` : total
}

/** The photos as the grid draws them, newest first. */
export function newestFirst<R extends Pick<BidPhotoRow, 'taken_at' | 'id'>>(rows: readonly R[]): R[] {
  return [...rows].sort((a, b) => (a.taken_at < b.taken_at ? 1 : a.taken_at > b.taken_at ? -1 : a.id < b.id ? 1 : -1))
}
