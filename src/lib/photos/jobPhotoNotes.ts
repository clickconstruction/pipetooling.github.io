/**
 * Job photos (punch list #244): a photo added to a job with a description, from the Job photos window the Pipeline
 * row's camera icon and the Job Mode card open. A shot is a tile from the shutter to the press: shrinking, sending,
 * sent, or failed with Retry; under it the person types what the photo shows and may pick the stage it shows. The
 * press **Add N photos to the job** writes the words, the stage and `added_at` on each row; the `photo-save` sweep
 * then files each into the job's Drive photo folder named by day, sender and caption. The words and the shapes are
 * pure; the reads and writes are `jobPhotoNotesIo.ts`; the tile state machine is `hooks/useShotTiles.ts`.
 */
import { countedLabel } from '../batchWords'
import { cardPhotoWords } from './reportPhotos'

/** Where a shot stands on the window. */
export type JobPhotoTileStatus = 'shrinking' | 'sending' | 'sent' | 'failed'

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

/** The tiles already in the bucket with their row: only the press is left for them. */
export function readyTiles<T extends Pick<JobPhotoTile, 'status'>>(tiles: ReadonlyArray<T>): T[] {
  return tiles.filter((t) => t.status === 'sent')
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
