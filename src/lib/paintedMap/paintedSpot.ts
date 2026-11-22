/**
 * Photo of a spot (punch list #413, step 1b): a place on a job, started from a photo. One press on
 * a job opens the camera, and the place sheet then opens with the photo in it and the dot where
 * the person stood. The crew's hands are on a camera, not on a map, so the photo comes first.
 *
 * Pure: what a reading is worth and where the dot starts. No camera, no phone, no map, no React.
 *
 * The rules the screens lean on:
 * - The phone is read once, when the press is made, and not again. A photo that waits for a signal
 *   keeps the reading of the moment it was taken.
 * - A reading belongs to a photo only while the photo is fresh. A photo taken hours ago and picked
 *   from the phone's library never takes the spot where the person stands now.
 * - A rough reading moves no dot, as on the place sheet's own press (`readingMovesDot`). The dot
 *   then starts on the job's address, and the sheet says why.
 * - A phone hands a web page no spot from inside a photo (the card's *What a phone gives a web
 *   page*), so nothing here reads one.
 */
import type { MyFix, MyFixFailure } from '../materials/myLocation'
import { taskPlaceAccuracyWords } from '../tasks/taskPlace'
import { readingMovesDot } from './paintedPlaceDot'

/** The words of the press, in one spot: they are Taunya's to change (the card's call 3). */
export const SPOT_WORDS = {
  press: 'Photo of a spot',
  /** Under the press on a phone. */
  hint: 'The camera opens. The dot is put where you stand.',
  /** While the phone shrinks the photo and the window opens. */
  opening: 'Opening the photo…',
  /** The press on a photo that is being added anyway: the Job photos window, a report. */
  keep: '＋ Keep this spot on the job',
  /** The same press under a small tile, where the long words do not fit. */
  keepShort: 'Keep this spot',
  keptShort: '✓ Kept',
  openingShort: 'Opening…',
  /** That press once its place is saved. */
  kept: '✓ Kept on this job',
  /** The map's window could not be reached from this screen. */
  noDoor: 'The map could not open from this screen. Open the job and press Photo of a spot.',
} as const

/** What the phone said when the press was made: a reading, or why none came. */
export type SpotReading = { ok: true; fix: MyFix } | { ok: false; why: MyFixFailure }

/**
 * The camera's photo and the phone's reading of the same moment, handed from the press to the
 * place sheet. The reading may still be on its way when the photo is back, so it is a promise.
 */
export type PaintedSpot = { file: File; reading: Promise<SpotReading>; /** When the photo was taken, as the file says. Null when it does not say. */ takenMs: number | null; /** Called once when the place this photo began is saved, so the press that began it can say so. */ onKept?: () => void }

/** A photo this old is not of where the person stands: five minutes covers a slow camera and a second try. */
export const SPOT_FRESH_MS = 5 * 60_000

/**
 * The photo was taken just now, so the phone's reading is the photo's own. A file that does not
 * say when it was made is taken for fresh: a camera's own file always says, and a press that opened
 * the camera is the common case. A time ahead of the clock by more than the same margin is not
 * trusted either way and reads as not fresh.
 */
export function spotPhotoIsFresh(takenMs: number | null | undefined, nowMs: number): boolean {
  if (takenMs == null || !Number.isFinite(takenMs) || takenMs <= 0) return true
  return Math.abs(nowMs - takenMs) <= SPOT_FRESH_MS
}

/** `12 minutes ago`, `6 hours ago`, `3 days ago`: how old a photo is, in the largest whole unit. */
export function spotAgoWords(takenMs: number, nowMs: number): string {
  const minutes = Math.max(1, Math.round((nowMs - takenMs) / 60_000))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The sheet's line for a photo that is not fresh. */
export function spotStaleWords(takenMs: number, nowMs: number): string {
  if (takenMs > nowMs) return 'This photo’s time is ahead of this phone’s clock. The dot was not put where you stand. Drag it onto the spot.'
  return `This photo was taken ${spotAgoWords(takenMs, nowMs)}. You are not there now, so the dot was not put where you stand. Drag it onto the spot.`
}

/**
 * Where the dot starts for a spot:
 * - `here`: on the reading, with its margin.
 * - `rough`: the phone gave an area. The dot starts on the job's address, and the sheet shows the way to the switch.
 * - `none`: no reading came. The dot starts on the job's address, and the sheet says why.
 * - `stale`: the photo is not of where the person stands now. The reading is not used at all.
 */
export type SpotStart = { kind: 'here'; fix: MyFix } | { kind: 'rough'; accuracyM: number } | { kind: 'none'; why: MyFixFailure } | { kind: 'stale' }

export function spotStart(reading: SpotReading, fresh: boolean): SpotStart {
  if (!fresh) return { kind: 'stale' }
  if (!reading.ok) return { kind: 'none', why: reading.why }
  if (!readingMovesDot(reading.fix.accuracyM)) return { kind: 'rough', accuracyM: reading.fix.accuracyM ?? 0 }
  return { kind: 'here', fix: reading.fix }
}

/**
 * Where the phone was when a photo was taken (punch list #413, step 3), as a job photo's and a
 * report photo's row keeps it. The same reading and the same rules as a spot: only a fresh photo
 * takes one, and a rough reading is kept by nobody.
 */
export type TakenPoint = { lat: number; lng: number; accuracyM: number | null }

/** How long a photo's send waits for the phone's reading before it goes without one. A photo is never held for a point. */
export const TAKEN_POINT_WAIT_MS = 2500

/** The point a photo keeps, or null: no reading in time, a rough one, none at all, or a photo that is not of this moment. */
export function takenPointOf(reading: SpotReading | null | undefined, fresh: boolean): TakenPoint | null {
  if (!reading) return null
  const start = spotStart(reading, fresh)
  if (start.kind !== 'here') return null
  const margin = start.fix.accuracyM
  return { lat: start.fix.lat, lng: start.fix.lng, accuracyM: margin != null && Number.isFinite(margin) && margin >= 0 ? Math.round(margin) : null }
}

/** The row's three columns for a point, or none of them: a photo with no point writes no column at all. */
export function takenPointColumns(point: TakenPoint | null | undefined): { taken_lat?: number; taken_lng?: number; taken_accuracy_m?: number | null } {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return {}
  return { taken_lat: point.lat, taken_lng: point.lng, taken_accuracy_m: point.accuracyM }
}

/** A stored row's point, or null when the row has none or half of one. */
export function takenPointFromRow(row: { taken_lat?: number | null; taken_lng?: number | null; taken_accuracy_m?: number | null } | null | undefined): TakenPoint | null {
  if (!row || typeof row.taken_lat !== 'number' || typeof row.taken_lng !== 'number') return null
  if (!Number.isFinite(row.taken_lat) || !Number.isFinite(row.taken_lng)) return null
  return { lat: row.taken_lat, lng: row.taken_lng, accuracyM: typeof row.taken_accuracy_m === 'number' && row.taken_accuracy_m >= 0 ? row.taken_accuracy_m : null }
}

/** `Taken here · the phone was sure within 20 ft`: the press on an opened photo. Without the margin when the phone gave none. */
export function takenPointWords(point: TakenPoint): string {
  const sure = taskPlaceAccuracyWords(point.accuracyM)
  return sure ? `Taken here · the phone was sure ${sure}` : 'Taken here'
}
