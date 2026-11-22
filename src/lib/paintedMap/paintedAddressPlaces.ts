/**
 * Places kept at this address (punch list #413, step 4): a job reads the list of places an earlier
 * job at the same customer address kept. The next tech at a house is on a different job, and the
 * cleanout is where it was.
 *
 * Pure: which lists, in what order, and what a line says of one. No network, no map, no React.
 *
 * The rules the screens lean on:
 * - A list stays on the job that made it, which keeps who set each place and when. This job reads
 *   it and does not own it: a new place is written to this job's own list.
 * - Only a job's list of places follows the address. A painted map of the way in stays its own
 *   job's.
 * - The job that kept a list is named when the reader may read that job. A helper may not read the
 *   ledger, so the line then says the month alone.
 * - Each list's places keep the letters they wear on their own list, and each list is drawn under
 *   a line of its own, so a letter is never taken for another list's.
 */
import { jobListPlaces, type JobPlace } from './paintedJobList'
import type { PaintedMap, PaintedPlace } from './paintedMap'

export const ADDRESS_PLACES_WORDS = {
  /** The line's name, where a job's own list reads Places on this job. */
  name: 'Kept at this address',
  /** Over the lists on a sheet that shows the maps alone. */
  heading: 'Kept at this address by an earlier job',
  /** Under the rows: whose they are. */
  kept: 'An earlier job at this address kept these. A new place goes on this job.',
} as const

/** The most rows a job's window draws for one list before it says how many more there are. */
export const PLACE_ROWS_MAX = 4

/** A list of places an earlier job at this address kept, as this job reads it. */
export type AddressList = {
  map: PaintedMap
  /** Its places, each with the letter it wears on its own list. */
  places: JobPlace[]
  /** The job that kept it, in words, when the reader may read that job. */
  jobLabel: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Nov 2026` from a stamp: a list's month, not its minute. Read in UTC so every reader says the same month. Empty for a stamp that is not one. */
export function listMonthWords(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '')
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** `from Sewer line replacement, Nov 2026`, or `kept Nov 2026` when the job cannot be named. */
export function addressListFromWords(list: { createdAt: string; jobLabel: string | null }): string {
  const month = listMonthWords(list.createdAt)
  const job = (list.jobLabel ?? '').trim()
  if (job) return month ? `from ${job}, ${month}` : `from ${job}`
  return month ? `kept ${month}` : 'kept by an earlier job'
}

/** `3 places · from Sewer line replacement, Nov 2026`: the right end of a list's line. */
export function addressListLineWords(list: { places: ReadonlyArray<unknown>; map: { createdAt: string }; jobLabel: string | null }): string {
  const n = list.places.length
  return `${n} place${n === 1 ? '' : 's'} · ${addressListFromWords({ createdAt: list.map.createdAt, jobLabel: list.jobLabel })}`
}

/**
 * The lists this job reads from earlier jobs at its address, the oldest first. A map that is not
 * a job's list, a list of this job itself and a list with no place on it are left out.
 */
export function addressListsOf(wholes: ReadonlyArray<{ map: PaintedMap; places: ReadonlyArray<PaintedPlace> }>, jobId: string, jobLabels: ReadonlyMap<string, string>): AddressList[] {
  return wholes
    .filter((w) => w.map.jobList === true && !!w.map.jobId && w.map.jobId !== jobId && w.places.length > 0)
    .slice()
    .sort((a, b) => a.map.createdAt.localeCompare(b.map.createdAt) || a.map.id.localeCompare(b.map.id))
    .map((w) => ({ map: w.map, places: jobListPlaces([w]), jobLabel: (w.map.jobId && jobLabels.get(w.map.jobId)) || null }))
}

/** The rows a job's window draws for a list, and how many it leaves for the list's own window. */
export function placeRowsShown<T>(places: ReadonlyArray<T>, max: number = PLACE_ROWS_MAX): { shown: T[]; more: number } {
  if (places.length <= max) return { shown: [...places], more: 0 }
  return { shown: places.slice(0, max), more: places.length - max }
}

/** `＋ 3 more ›`: the press under a list's rows that opens the rest. */
export function placeRowsMoreWords(more: number): string {
  return `＋ ${more} more ›`
}
