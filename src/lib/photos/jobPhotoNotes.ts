/**
 * Job photos (punch list #244): a photo added to a job with a description, from the Job photos window the Pipeline
 * row's camera icon and the Job Mode card open. A shot is a tile from the shutter to the press: shrinking, sending,
 * sent, or failed with Retry; under it the person types what the photo shows and may pick the stage it shows. The
 * press **Add N photos to the job** writes the words, the stage and `added_at` on each row; the `photo-save` sweep
 * then files each into the job's Drive photo folder named by day, sender and caption. The words and the shapes are
 * pure; the reads and writes are `jobPhotoNotesIo.ts`; the tile state machine is `hooks/useShotTiles.ts`.
 */
import { countedLabel } from '../batchWords'
import type { JobPhoto } from './jobPhotos'
import { cardPhotoWords } from './reportPhotos'
import { sourceChips, sourceWords, type SourcePick, type UploadedPhotoRow } from './uploadedPhotos'

/** Where a shot stands on the window. */
/** `kept` (PR 5): the shot waits on the phone with no signal and goes with the press. */
export type JobPhotoTileStatus = 'shrinking' | 'sending' | 'sent' | 'kept' | 'failed'

/** A shot on the window, from the shutter to Add. */
export type JobPhotoTile = {
  id: string
  status: JobPhotoTileStatus
  /** An object URL of the shrunk shot (the original while it shrinks), for the thumbnail. */
  previewUrl: string
  originalBytes: number
  /** After the shrink; 0 while it shrinks. */
  bytes: number
  width: number
  height: number
  longEdge: number
  shrunk: boolean
  /** The stage it shows, or null until picked (a one-stage job never asks). */
  fixtureId: string | null
  stageName: string | null
  /** What the photo shows, as typed so far. */
  description: string
  /** Where it waits in the bucket once sent. */
  storagePath: string | null
  takenAt: string
  /** Why it did not send, for the tile's Retry. */
  failWhy: string | null
}

/** A row of `job_photo_notes` as the window reads it. */
export type JobPhotoNoteRow = {
  id: string
  job_id: string
  fixture_id: string | null
  stage_name: string
  description: string
  caption: string
  by_user_id: string | null
  by_name: string
  taken_at: string
  added_at: string | null
  bytes: number
  original_bytes: number
  storage_path: string | null
  drive_file_id: string | null
  filed_at: string | null
  fail_why: string | null
}

export const JOB_PHOTO_NOTES_BUCKET = 'job-photo-notes'
/** The longest description the row keeps. */
export const JOB_PHOTO_DESCRIPTION_MAX = 500
/** The longest piece of the description that names the Drive file, cut on a word. */
export const JOB_PHOTO_CAPTION_MAX = 60

export const JOB_PHOTO_WORDS = {
  title: 'Job photos',
  add: 'Add a photo',
  take: 'Take a photo',
  another: 'Add another',
  takeAnother: 'Take another',
  /** Over the description box. */
  what: 'What does this show?',
  optional: 'optional, but these words are how you find it later',
  /** Under the first box when several photos are chosen. */
  useForRest: 'Use these words for the rest',
  noDescription: 'No description',
  shows: 'This photo shows',
  shrinking: 'Shrinking…',
  sending: 'Sending…',
  sent: 'Sent',
  retry: 'Retry',
  remove: 'Remove',
  cancel: 'Cancel',
  /** The caption a photo with no words and no stage is named by. */
  plainCaption: 'Job photo',
  onItsWay: 'on its way to Drive',
  inDrive: 'In Drive',
  /** A shot kept on the phone with no signal (PR 5). */
  kept: 'Kept on the phone. It goes when the signal is back.',
  /** The toast after a press that queued. */
  queued: 'Kept on the phone. The photos go to the job when the signal is back.',
  /** The Documents → Photos chip and the window's source chip. */
  sourceChip: 'Job photos',
  sourceWord: 'Job photo',
} as const

/** Where the shot sits in the bucket until the sweep files it: `<job_id>/<photo_id>.jpg`, the gate's shape. */
export function jobPhotoNotePath(jobId: string, photoId: string): string {
  return `${jobId}/${photoId}.jpg`
}

/** The description as the row keeps it: trimmed, inner runs of blank lines folded, cut at the cap. */
export function descriptionTrimmed(words: string): string {
  return words.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, JOB_PHOTO_DESCRIPTION_MAX)
}

function cutOnWord(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max + 1)
  const space = head.lastIndexOf(' ')
  return (space > 0 ? head.slice(0, space) : text.slice(0, max)).replace(/[.\s?!,;:]+$/, '')
}

/**
 * What the Drive file is named by, after the day and the sender: the description's first line cut on a word at the
 * cap, else the stage it shows, else *Job photo*.
 */
export function jobPhotoCaption(input: { description: string; stageName: string | null }): string {
  const firstLine = descriptionTrimmed(input.description).split('\n')[0]?.trim() ?? ''
  if (firstLine) return cutOnWord(firstLine, JOB_PHOTO_CAPTION_MAX)
  const stage = (input.stageName ?? '').trim()
  return stage || JOB_PHOTO_WORDS.plainCaption
}

/** The tiles the press takes: in the bucket with their row, or kept on the phone to go with the press (PR 5). */
export function readyTiles<T extends Pick<JobPhotoTile, 'status'>>(tiles: ReadonlyArray<T>): T[] {
  return tiles.filter((t) => t.status === 'sent' || t.status === 'kept')
}

/** The tiles kept on the phone: with any, the press goes through the outbox. */
export function keptTiles<T extends Pick<JobPhotoTile, 'status'>>(tiles: ReadonlyArray<T>): T[] {
  return tiles.filter((t) => t.status === 'kept')
}

/** True while a shot is still shrinking or sending: the press waits for it. */
export function tilesInFlight(tiles: ReadonlyArray<Pick<JobPhotoTile, 'status'>>): boolean {
  return tiles.some((t) => t.status === 'shrinking' || t.status === 'sending')
}

/**
 * The press: *Add 2 photos to the job*, from `countedLabel` so the count is in the words; dead while a shot is on its
 * way (*Sending 1 photo…*), while the add runs (*Adding…*), and when nothing is ready (*Add photos*, dead). Never OK.
 */
export function addPress(input: { tiles: ReadonlyArray<Pick<JobPhotoTile, 'status'>>; adding: boolean }): { label: string; dead: boolean } {
  if (input.adding) return { label: 'Adding…', dead: true }
  const inFlight = input.tiles.filter((t) => t.status === 'shrinking' || t.status === 'sending').length
  if (inFlight > 0) return { label: inFlight === 1 ? 'Sending 1 photo…' : `Sending ${inFlight} photos…`, dead: true }
  const ready = readyTiles(input.tiles).length
  if (ready === 0) return { label: countedLabel('Add', 0, 'photo'), dead: true }
  return { label: `${countedLabel('Add', ready, 'photo')} to the job`, dead: false }
}

/** *Use these words for the rest*: every other tile with no words of its own takes this tile's description. */
export function wordsForTheRest<T extends Pick<JobPhotoTile, 'id' | 'description'>>(tiles: ReadonlyArray<T>, fromId: string): T[] {
  const from = tiles.find((t) => t.id === fromId)
  const words = from ? descriptionTrimmed(from.description) : ''
  if (!words) return [...tiles]
  return tiles.map((t) => (t.id === fromId || descriptionTrimmed(t.description) ? t : { ...t, description: words }))
}

/** Whether the quiet press under a box is offered: several tiles, this one has words, another has none. */
export function offersWordsForTheRest(tiles: ReadonlyArray<Pick<JobPhotoTile, 'id' | 'description'>>, tileId: string): boolean {
  if (tiles.length < 2) return false
  const me = tiles.find((t) => t.id === tileId)
  if (!me || !descriptionTrimmed(me.description)) return false
  return tiles.some((t) => t.id !== tileId && !descriptionTrimmed(t.description))
}

/** The line over the tiles: *2 new photos · shrunk to 1600 px · they go to the job's Drive folder*. */
export function newPhotosLine(input: { count: number; longEdge: number; jobHasFolder: boolean | null }): string {
  const head = input.count === 1 ? 'New photo' : `${input.count} new photos`
  const where = input.jobHasFolder === false ? 'the first makes the job’s Drive folder' : input.count === 1 ? 'goes to the job’s Drive folder' : 'they go to the job’s Drive folder'
  return `${head} · shrunk to ${input.longEdge} px · ${where}`
}

/** The words under a tile in the grid: the description's first line, else the stage, else *No description*. */
export function tileWords(row: { description: string; stage_name: string }): { text: string; none: boolean } {
  const first = descriptionTrimmed(row.description).split('\n')[0]?.trim() ?? ''
  if (first) return { text: first, none: false }
  const stage = row.stage_name.trim()
  if (stage) return { text: stage, none: false }
  return { text: JOB_PHOTO_WORDS.noDescription, none: true }
}

/** Where an added photo is, for its tile and the viewer: the report card's own words. */
export function jobPhotoWhereWords(row: Pick<JobPhotoNoteRow, 'drive_file_id' | 'fail_why' | 'storage_path'>): { text: string; tone: 'filed' | 'waiting' | 'held' } {
  return cardPhotoWords(row)
}

/** What the press writes onto one row. */
export interface JobPhotoAddWrite {
  id: string
  description: string
  fixtureId: string | null
  stageName: string | null
  caption: string
}

/** The writes the press makes: one per sent tile, the words trimmed and the caption named. */
export function addWrites(tiles: ReadonlyArray<Pick<JobPhotoTile, 'id' | 'status' | 'description' | 'fixtureId' | 'stageName'>>): JobPhotoAddWrite[] {
  return readyTiles(tiles).map((t) => {
    const description = descriptionTrimmed(t.description)
    return { id: t.id, description, fixtureId: t.fixtureId, stageName: t.stageName, caption: jobPhotoCaption({ description, stageName: t.stageName }) }
  })
}

/** The toast after the press: *2 photos added*, or what did not add with its reason. */
export function addedWords(input: { added: number; failed: ReadonlyArray<string> }): { text: string; tone: 'success' | 'warning' } {
  const n = input.added
  const head = n === 0 ? '' : n === 1 ? '1 photo added to the job' : `${n} photos added to the job`
  if (input.failed.length === 0) return { text: head || 'Nothing added', tone: 'success' }
  const miss = input.failed.length === 1 ? 'one did not' : `${input.failed.length} did not`
  return { text: head ? `${head}, but ${miss}: ${input.failed[0]}` : `The photo did not add: ${input.failed[0]}`, tone: 'warning' }
}

// ---------------------------------------------------------------------------
// The window's grid (PR 3): Drive is the list, our rows are the words.
// ---------------------------------------------------------------------------

/** One tile of the grid: a row of ours, or a file put in the folder by hand (`hand`), drawn from Drive's list alone. */
export type JobPhotoGridItem = { row: UploadedPhotoRow; hand: boolean }

/** The words that stand in for a person on a file put in the folder by hand. */
export const ADDED_IN_DRIVE = 'Added in Drive'

type GridJob = { id: string; hcp_number?: string | null; click_number?: string | null; job_name?: string | null; customer_name?: string | null }

/**
 * The grid: every row of ours on the job (every source, the view's rows), then every picture in the job's Drive photo
 * folders that no row of ours names, as a hand-added tile with the file's name for its words; newest first, a row with
 * no time last. A row still in a bucket has no Drive id and so is never doubled.
 */
export function gridItems(input: { rows: ReadonlyArray<UploadedPhotoRow>; drive: ReadonlyArray<JobPhoto> | null | undefined; job: GridJob }): JobPhotoGridItem[] {
  const known = new Set(input.rows.map((r) => r.drive_file_id).filter((id): id is string => Boolean(id)))
  const items: JobPhotoGridItem[] = input.rows.map((row) => ({ row, hand: false }))
  for (const p of input.drive ?? []) {
    if (known.has(p.id)) continue
    items.push({
      hand: true,
      row: {
        source: 'job',
        id: `drive:${p.id}`,
        job_id: input.job.id,
        bid_id: null,
        project_id: null,
        report_id: null,
        container_id: null,
        question_id: null,
        message_id: null,
        contact_id: null,
        caption: p.name,
        stage_name: '',
        by_user_id: null,
        by_name: ADDED_IN_DRIVE,
        direction: null,
        channel: null,
        taken_at: p.modified ?? '',
        bytes: p.bytes ?? 0,
        original_bytes: 0,
        bucket: '',
        storage_path: null,
        drive_file_id: p.id,
        filed_at: p.modified,
        fail_why: null,
        status: null,
        job_hcp_number: input.job.hcp_number ?? null,
        job_click_number: input.job.click_number ?? null,
        job_name: input.job.job_name ?? null,
        customer_name: input.job.customer_name ?? null,
        bid_number: null,
      },
    })
  }
  const ms = (iso: string) => {
    const n = Date.parse(iso)
    return Number.isFinite(n) ? n : -1
  }
  return items.sort((a, b) => ms(b.row.taken_at) - ms(a.row.taken_at))
}

/** The search box: the words, the person, the stage and the source's word, case blind; fewer than two characters narrows nothing. */
export function gridSearch(items: ReadonlyArray<JobPhotoGridItem>, typed: string): JobPhotoGridItem[] {
  const q = typed.trim().toLowerCase()
  if (q.length < 2) return [...items]
  return items.filter((it) => [it.row.caption, it.row.by_name, it.row.stage_name, it.hand ? ADDED_IN_DRIVE : sourceWords(it.row)].some((w) => w.toLowerCase().includes(q)))
}

/** The source chip filter: a hand-added file counts under Job photos. */
export function gridBySource(items: ReadonlyArray<JobPhotoGridItem>, source: SourcePick): JobPhotoGridItem[] {
  if (source === 'all') return [...items]
  return items.filter((it) => it.row.source === source)
}

/**
 * The chips over the grid, each with its count, only when the job's photos came through more than one door: All, then
 * the sources present in the Documents page's order for this role. One door, no chips.
 */
export function gridChips(items: ReadonlyArray<JobPhotoGridItem>, role: string | null | undefined): Array<{ key: SourcePick; label: string }> {
  const counts = new Map<string, number>()
  for (const it of items) counts.set(it.row.source, (counts.get(it.row.source) ?? 0) + 1)
  if (counts.size < 2) return []
  const out: Array<{ key: SourcePick; label: string }> = [{ key: 'all', label: `All · ${items.length}` }]
  for (const c of sourceChips(role)) {
    if (c.key === 'all') continue
    const n = counts.get(c.key)
    if (n) out.push({ key: c.key, label: `${c.label} · ${n}` })
  }
  return out
}

/** The words under a grid tile: the caption as the view holds it (the description, the stage, the box's words, the file's name). */
export function gridTileWords(item: JobPhotoGridItem): { text: string; none: boolean; who: string } {
  if (item.hand) return { text: item.row.caption || 'A file in Drive', none: true, who: ADDED_IN_DRIVE }
  const w = tileWords({ description: item.row.caption, stage_name: item.row.stage_name })
  const who = [item.row.by_name.trim(), item.row.source === 'job' ? '' : sourceWords(item.row)].filter(Boolean).join(' · ')
  return { ...w, who }
}

/** Whether the search or a chip hides rows, for the empty state's kind. */
export function gridNarrowed(input: { typed: string; source: SourcePick }): boolean {
  return input.source !== 'all' || input.typed.trim().length >= 2
}

/** The line under the grid: the count, the folder and the hand-added note. */
export function gridFootWords(input: { count: number; hand: number; folderKind: 'pictures' | 'photos' | 'none' | null }): string {
  const n = input.count === 1 ? '1 photo' : `${input.count} photos`
  const folder = input.folderKind === 'pictures' ? 'In Drive: Customer Pictures' : input.folderKind === 'photos' ? 'In Drive: Team only › Photos' : ''
  const hand = input.hand > 0 ? `${input.hand === 1 ? '1 was' : `${input.hand} were`} put in the folder by hand and read by file name` : ''
  return [n, folder, hand].filter(Boolean).join(' · ')
}

/** Who may change a photo's words later: the taker, or the office and the estimator (the policy's rule). */
export function canEditJobPhotoWords(input: { role: string | null | undefined; byUserId: string | null; authUserId: string | null }): boolean {
  if (input.authUserId && input.byUserId && input.byUserId === input.authUserId) return true
  const r = input.role
  return r === 'dev' || r === 'master_technician' || r === 'assistant' || r === 'controller' || r === 'estimator'
}

// ---------------------------------------------------------------------------
// The field's doors and the thread (PR 4).
// ---------------------------------------------------------------------------

/**
 * The one line on the job's thread after the press (the author is the thread's own): *Added 2 photos: Cracked flange
 * under the second lav; Water heater serial plate*; a photo with no words is counted and not named; '' with none.
 */
export function threadLineWords(writes: ReadonlyArray<Pick<JobPhotoAddWrite, 'caption' | 'description' | 'stageName'>>): string {
  if (writes.length === 0) return ''
  const head = writes.length === 1 ? 'Added 1 photo' : `Added ${writes.length} photos`
  const named = writes.map((w) => (descriptionTrimmed(w.description) ? w.caption : (w.stageName ?? '').trim())).filter(Boolean)
  return named.length ? `${head}: ${named.join('; ')}` : head
}

/** The Job Mode card's line: *Photos · 14*, *Photos · add the first*, *Photos* while the count is unread. */
export function jobModePhotosLineWords(count: number | null): string {
  if (count == null) return 'Photos'
  return count > 0 ? `Photos · ${count}` : 'Photos · add the first'
}
