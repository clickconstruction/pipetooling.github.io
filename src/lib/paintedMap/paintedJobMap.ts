/**
 * A job's map (punch list #413, step 8): everything painted or kept for one job, on one map, on
 * the office's job window. The lines of the job's painted maps, the places of the job's own list
 * and the places an earlier job kept at the same address.
 *
 * Pure: what is drawn and what the line under the map says. No network, no map, no React.
 *
 * The rules the screens lean on:
 * - It is drawn on the old map, as the Map page and Materials on site are, so opening the tab
 *   costs no Google map load.
 * - A place of the job's own list wears its letter. A place an earlier job kept wears its letter
 *   in a dashed ring, as a job's place does on any other map.
 * - A place set on one painted map, such as a gate on the way in, is not drawn here: its number is
 *   that map's own and would be taken for another map's. Its map's line is drawn, and a press on
 *   the list under the map opens it.
 * - A line a buried place runs along is drawn in the color a locator paints for what is buried.
 */
import type { AddressList } from './paintedAddressPlaces'
import { jobListPlaces, jobListsOf, type JobPlace } from './paintedJobList'
import type { PaintedLine, PaintedMap, PaintedPlace } from './paintedMap'
import { placeKindInfo } from './paintedPlaceKind'

export const JOB_MAP_WORDS = {
  tab: 'Map',
  /** A job with nothing painted and nothing kept. */
  none: 'Nothing is on this job’s map yet. Press Photo of a spot under the address to set the first place.',
  /** Under the map. */
  hint: 'Press a dot to open its place.',
  failed: 'The map did not load.',
} as const

type Whole = { map: PaintedMap; lines: ReadonlyArray<PaintedLine>; places: ReadonlyArray<PaintedPlace> }

/** A place as the job's map draws it: its letter, and whether an earlier job kept it. */
export type JobMapPlace = JobPlace & { fromEarlier: boolean }

export type JobMapParts = {
  lines: Array<PaintedLine & { color?: string }>
  places: JobMapPlace[]
  /** How many painted maps, not counting a list of places. */
  mapCount: number
}

/** Everything a job's map draws. */
export function jobMapParts(wholes: ReadonlyArray<Whole>, jobId: string, addressLists: ReadonlyArray<AddressList>): JobMapParts {
  const lists = jobListsOf(wholes.map((w) => w.map), jobId)
  const own = jobListPlaces(lists.map((l) => wholes.find((w) => w.map.id === l.id)!))
  const earlier = addressLists.flatMap((l) => l.places)
  // A line a buried place runs along takes that place's color.
  const colors = new Map<string, string>()
  for (const p of [...own, ...earlier]) {
    const color = p.lineId ? placeKindInfo(p.kind)?.color : undefined
    if (p.lineId && color) colors.set(p.lineId, color)
  }
  const painted = wholes.filter((w) => w.map.jobList !== true)
  return {
    lines: painted.flatMap((w) => w.lines).map((l) => (colors.has(l.id) ? { ...l, color: colors.get(l.id) } : l)),
    places: [...own.map((p) => ({ ...p, fromEarlier: false })), ...earlier.map((p) => ({ ...p, fromEarlier: true }))],
    mapCount: painted.length,
  }
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** `2 painted maps · 4 places on this job · 3 kept at this address`: what the line under the map says. Empty when there is nothing. */
export function jobMapSummaryWords(parts: Pick<JobMapParts, 'places' | 'mapCount'>): string {
  const own = parts.places.filter((p) => !p.fromEarlier).length
  const earlier = parts.places.length - own
  return [parts.mapCount > 0 ? count(parts.mapCount, 'painted map', 'painted maps') : '', own > 0 ? `${count(own, 'place', 'places')} on this job` : '', earlier > 0 ? `${earlier} kept at this address` : ''].filter(Boolean).join(' · ')
}

/** Nothing to draw: no line and no place. */
export function jobMapIsEmpty(parts: Pick<JobMapParts, 'lines' | 'places'>): boolean {
  return parts.lines.length === 0 && parts.places.length === 0
}
