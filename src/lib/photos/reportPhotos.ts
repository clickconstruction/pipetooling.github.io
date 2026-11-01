/**
 * Phone first, the camera-first report (punch list #189, PR 5b): a photo taken for a field report, from the shutter
 * to the job's Drive folder. On the phone a shot is a tile: shrinking, then sending to the `report-photos` bucket,
 * then sent, with the stage it shows picked under it; Save ties the sent ones to the report. On the report card a
 * row reads where it is: in Drive, or not in Drive yet with the reason. The words and the shapes are pure; the reads
 * and writes are `reportPhotosIo.ts`.
 */
import { saveWords } from '../reports/stagePct'

/** Where a shot stands on the form. */
export type ReportPhotoTileStatus = 'shrinking' | 'sending' | 'sent' | 'failed'

/** A shot on the form, from the shutter to Save. */
export type ReportPhotoTile = {
  id: string
  status: ReportPhotoTileStatus
  /** An object URL of the shrunk shot (the original while it shrinks), for the thumbnail. */
  previewUrl: string
  /** The shot as the camera handed it over. */
  originalBytes: number
  /** After the shrink; 0 while it shrinks. */
  bytes: number
  width: number
  height: number
  longEdge: number
  shrunk: boolean
  /** The stage it shows: the line's fixture id and name, or null until picked (a one-stage job never asks). */
  fixtureId: string | null
  stageName: string | null
  /** The checklist question it answers (punch list #189, PR 6): the question's id and words, or null for a plain photo. */
  questionId: string | null
  questionWords: string | null
  /** Where it waits in the bucket once sent. */
  storagePath: string | null
  takenAt: string
  /** Why it did not send, for the tile's Retry. */
  failWhy: string | null
}

/** A row of `report_photos` as the card reads it. */
export type ReportPhotoRow = {
  id: string
  job_id: string
  report_id: string | null
  fixture_id: string | null
  stage_name: string
  caption: string
  by_name: string
  taken_at: string
  bytes: number
  original_bytes: number
  storage_path: string | null
  drive_file_id: string | null
  filed_at: string | null
  fail_why: string | null
}

export const REPORT_PHOTOS_BUCKET = 'report-photos'

export const REPORT_PHOTO_WORDS = {
  take: 'Take a photo',
  another: 'Take another',
  add: 'Add a photo',
  shows: 'This photo shows',
  which: 'Which stage?',
  shrinking: 'Shrinking…',
  sending: 'Sending…',
  sent: 'Sent',
  retry: 'Retry',
  remove: 'Remove',
  inDrive: 'in Drive',
  notYet: 'not in Drive yet',
  whatGotDone: 'What got done?',
  optional: 'optional',
  whatIsNext: 'What is next',
  otherTypes: 'Walk, Note or EOD instead',
  cameraOnStage: 'Take a photo of this stage',
  /** The desk's New report form on a project or a bid (punch list #229): a report photo is keyed to a ledger job. */
  onJobOnly: 'Photos go on a job’s report. A report on a project or a bid takes none yet.',
} as const

/** Where the shot sits in the bucket until the sweep files it: `<job_id>/<photo_id>.jpg`, the gate's shape. */
export function reportPhotoPath(jobId: string, photoId: string): string {
  return `${jobId}/${photoId}.jpg`
}

/** The longest piece of a question that goes into a photo's caption, cut on a word (the sheet's `PHOTO_QUESTION_MAX`). */
const CAPTION_QUESTION_MAX = 60

/**
 * What the file is named by, after the day and the sender: the stage and the checklist question it answers (PR 6:
 * *Rough In · Did the water test hold*), else the stage it shows, else the first words of What got done, else
 * *Report photo*.
 */
export function reportPhotoCaption(input: { stageName: string | null; whatGotDone: string; questionWords?: string | null }): string {
  const stage = (input.stageName ?? '').trim()
  const question = (input.questionWords ?? '').trim().replace(/[?!.]+$/, '')
  if (question) {
    const cut = question.length <= CAPTION_QUESTION_MAX ? question : (() => {
      const head = question.slice(0, CAPTION_QUESTION_MAX + 1)
      const space = head.lastIndexOf(' ')
      return (space > 0 ? head.slice(0, space) : question.slice(0, CAPTION_QUESTION_MAX)).replace(/[.\s?!,]+$/, '')
    })()
    return stage ? `${stage} · ${cut}` : cut
  }
  if (stage) return stage
  const words = input.whatGotDone.trim().split(/\s+/).filter(Boolean).slice(0, 6).join(' ')
  return words || 'Report photo'
}

/** The tiles that ride with the report: sent, never one still shrinking, sending or failed. */
export function sentTiles(tiles: ReadonlyArray<ReportPhotoTile>): ReportPhotoTile[] {
  return tiles.filter((t) => t.status === 'sent')
}

/** True while a shot is still on its way: Save waits for it (the queue of #163 takes this over in PR 7). */
export function photosInFlight(tiles: ReadonlyArray<ReportPhotoTile>): boolean {
  return tiles.some((t) => t.status === 'shrinking' || t.status === 'sending')
}

/** The tiles on a stage's row. */
export function tilesOnStage(tiles: ReadonlyArray<ReportPhotoTile>, fixtureId: string): ReportPhotoTile[] {
  return tiles.filter((t) => t.fixtureId === fixtureId)
}

/** A new tile that still needs its stage, when the job has stages to pick from. */
export function tileNeedsStage(tile: ReportPhotoTile, stageCount: number): boolean {
  return stageCount >= 2 && tile.fixtureId == null
}

/**
 * The Save press's words on the phone's form: the job's number and the photos riding with it. A shot still on its
 * way reads *Sending 1 photo…* and the press waits. `jobPct` is null for a report type that files no percent, whose
 * Save names none (`saveWords`).
 */
export function reportSaveWords(input: { jobPct: number | null; tiles: ReadonlyArray<ReportPhotoTile>; saving: boolean }): string {
  if (input.saving) return 'Saving…'
  const inFlight = input.tiles.filter((t) => t.status === 'shrinking' || t.status === 'sending').length
  if (inFlight > 0) return inFlight === 1 ? 'Sending 1 photo…' : `Sending ${inFlight} photos…`
  return saveWords({ jobPct: input.jobPct, photos: sentTiles(input.tiles).length })
}

/** The line over the tiles: *New photo · 4.2 MB → 310 KB · saved to the job's folder*. */
export function newPhotoLine(input: { shrinkWords: string; jobHasFolder: boolean | null }): string {
  const where = input.jobHasFolder === false ? 'kept until the job has a Drive folder' : "goes to the job's Drive folder"
  return `New photo · ${input.shrinkWords} · ${where}`
}

/** Where a saved report's photo is, for its card. */
export function cardPhotoWords(row: Pick<ReportPhotoRow, 'drive_file_id' | 'fail_why' | 'storage_path'>): { text: string; tone: 'filed' | 'waiting' | 'held' } {
  if (row.drive_file_id) return { text: REPORT_PHOTO_WORDS.inDrive, tone: 'filed' }
  if (row.fail_why) return { text: `${REPORT_PHOTO_WORDS.notYet} · ${row.fail_why}`, tone: 'held' }
  return { text: REPORT_PHOTO_WORDS.notYet, tone: 'waiting' }
}

/** The Drive file's page. */
export function driveFileUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`
}

/** A tile's id: the row's id and the bucket object's name. */
export function newPhotoId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * The photos' clause on the report's Stage progress line, so the office reads them beside the moves: *2 photos on
 * Rough In and Top Out*, *1 photo on Rough In*, *1 photo* with no stage, and after it how many answer a checklist
 * question (PR 6: *2 photos on Rough In, 1 answers a checklist question*). Empty with none.
 */
export function photosSentence(tiles: ReadonlyArray<Pick<ReportPhotoTile, 'stageName'> & { questionId?: string | null }>): string {
  if (tiles.length === 0) return ''
  const count = tiles.length === 1 ? '1 photo' : `${tiles.length} photos`
  const stages: string[] = []
  for (const t of tiles) {
    const name = (t.stageName ?? '').trim()
    if (name && !stages.includes(name)) stages.push(name)
  }
  const answers = tiles.filter((t) => Boolean(t.questionId)).length
  const answersWords = answers === 0 ? '' : answers === 1 ? '1 answers a checklist question' : `${answers} answer checklist questions`
  const names = stages.length === 0 ? '' : stages.length === 1 ? stages[0]! : `${stages.slice(0, -1).join(', ')} and ${stages[stages.length - 1]!}`
  const head = names ? `${count} on ${names}` : count
  return answersWords ? `${head}, ${answersWords}` : head
}

/** "1 photo", "3 photos", "" for none. */
export function photoCountWords(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? '1 photo' : `${n} photos`
}
