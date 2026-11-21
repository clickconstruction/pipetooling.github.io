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
import { readingMovesDot } from './paintedPlaceDot'

/** The words of the press, in one spot: they are Taunya's to change (the card's call 3). */
export const SPOT_WORDS = {
  press: 'Photo of a spot',
  /** Under the press on a phone. */
  hint: 'The camera opens. The dot is put where you stand.',
  /** While the phone shrinks the photo and the window opens. */
  opening: 'Opening the photo…',
} as const

/** What the phone said when the press was made: a reading, or why none came. */
export type SpotReading = { ok: true; fix: MyFix } | { ok: false; why: MyFixFailure }

/**
 * The camera's photo and the phone's reading of the same moment, handed from the press to the
 * place sheet. The reading may still be on its way when the photo is back, so it is a promise.
 */
export type PaintedSpot = { file: File; reading: Promise<SpotReading>; /** When the photo was taken, as the file says. Null when it does not say. */ takenMs: number | null }

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
