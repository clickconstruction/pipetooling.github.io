/**
 * A job's Drive photos in the app (punch list #164, PR 5; the owner, 2026-10-24: photos always live in Google Drive).
 * The job window's strip under the address lists the customer's folder through the `job-photos` function and never
 * copies a photo out of it: three thumbnails and a *+ N* tile, *Photos · 15* as the door to the viewer, and on a job
 * with no folder link the dashed card with the door to set it. The rules of the strip are here, pure; the reads are
 * `jobPhotosIo.ts` and the screens `JobPhotosStrip.tsx` and `JobPhotosViewer.tsx`.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

/** One picture in the folder, as the function lists it. */
export interface JobPhoto {
  id: string
  name: string
  mime: string
  bytes: number | null
  /** When Drive last changed it; the sweep's upload, for a photo the app filed. */
  modified: string | null
  /** Which of the job's two photo folders holds it. */
  from: 'pictures' | 'photos'
}

/** Where the job's photos live: Customer Pictures, Team only › Photos, or no folder at all. */
export type JobPhotoFolderKind = 'pictures' | 'photos' | 'none'

export interface JobPhotosRead {
  folder: { kind: JobPhotoFolderKind; url: string | null }
  photos: JobPhoto[]
  capped: boolean
  /** The job's photos still in a bucket on their way to the folder. */
  waiting: number
}

/** The strip shows this many tiles, thumbnails and the *+ N* tile together. */
export const STRIP_TILES = 4

/** The viewer loads this many thumbnails at a time. */
export const VIEWER_PAGE = 24

/** The door's words: *Photos · 15*, or *Photos* while the count is unknown. */
export function photosDoorWords(count: number | null): string {
  return count == null ? 'Photos' : `Photos · ${count}`
}

/** Newest first, by Drive's modified time, the name as the tie-break. */
export function newestFirst(photos: readonly JobPhoto[]): JobPhoto[] {
  return [...photos].sort((a, b) => String(b.modified ?? '').localeCompare(String(a.modified ?? '')) || a.name.localeCompare(b.name))
}

export type StripTile = { kind: 'photo'; photo: JobPhoto } | { kind: 'more'; count: number }

/** The strip's tiles: the newest photos, and a *+ N* tile for the rest once they do not all fit. */
export function stripTiles(photos: readonly JobPhoto[], tiles = STRIP_TILES): StripTile[] {
  const sorted = newestFirst(photos)
  if (sorted.length <= tiles) return sorted.map((photo) => ({ kind: 'photo', photo }))
  const shown = sorted.slice(0, tiles - 1)
  return [...shown.map((photo): StripTile => ({ kind: 'photo', photo })), { kind: 'more', count: sorted.length - shown.length }]
}

/** The day under a tile, in the company's calendar: *Oct 24*; '' when Drive gave no time. */
export function photoDayWords(modified: string | null): string {
  if (!modified || Number.isNaN(Date.parse(modified))) return ''
  return formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(modified))
}

/** The line under the tiles. */
export const FROM_LINE = 'From the customer’s Drive folder. Shown here, never copied out. A photo taken in the app saves to that folder.'

/** The words on a job with no folder link, and the door's label. */
export const NO_FOLDER_WORDS = 'No Drive folder is linked to this job yet.'
export const SET_FOLDER = 'Set the folder'
export const ASK_OFFICE_FOLDER = 'Ask the office to set the job’s Drive folder.'

/** The words on a folder with no picture in it yet. */
export function emptyFolderWords(waiting: number): string {
  if (waiting > 0) return `${waitingWords(waiting)} Nothing is in the folder yet.`
  return 'No photos in the folder yet. A photo taken in the app saves there.'
}

/** *1 photo on its way to the folder.* / *3 photos on their way to the folder.* / '' for none. */
export function waitingWords(waiting: number): string {
  if (waiting <= 0) return ''
  return waiting === 1 ? '1 photo on its way to the folder.' : `${waiting} photos on their way to the folder.`
}

/** The viewer's title. */
export function viewerTitle(count: number): string {
  return count === 1 ? '1 photo' : `${count} photos`
}

/** The words a failed read shows under the label; the strip never hides the window. */
export function readFailedWords(reason: string): string {
  return `The photos did not read. ${reason}`
}

/** Drive's own viewer for one picture, for *Open in Drive*. */
export function drivePhotoUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`
}
