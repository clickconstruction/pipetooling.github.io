/**
 * The way to a task's place (punch list #345, step 5). Pure.
 *
 * A task's place is a dot (#328). A painted map is the way to it: which gate, which side of the
 * building, the drive that is on no map. A task's place carries the map that leads to it, and
 * whoever reads the task reads the map (`20261115063000_task_painted_maps.sql`).
 *
 *  - `waysNearPlace`: the painted maps to offer the giver, the ones that come nearest the place.
 *  - `taskPlaceWayWords`: what the task's card says about the way.
 *  - `taskPlaceWayStart`: where Directions goes when a way is painted, the line's first point.
 */
import { haversineMeters } from '../jobTravelEstimate'
import { nearestOnLine } from '../paintedMap/paintedLine'
import { PAINTED_MAP_UNNAMED, aboutLengthWords, mapLengthMeters, mapStart, mapSummaryWords, type PaintedLine, type PaintedPlace } from '../paintedMap/paintedMap'
import { TASK_PLACE_HERE_METERS, taskPlaceDistanceWords, type TaskPlacePoint } from './taskPlace'

/** A map further than this from the place is not its way in: a mile, the reach of a large site. */
export const TASK_PLACE_WAY_NEAR_METERS = 1609
/** How many maps the sheet offers. More than a handful near one place is a list nobody reads. */
export const TASK_PLACE_WAY_OFFER_MAX = 6

type WholeMap = { map: { id: string; name: string }; lines: ReadonlyArray<Pick<PaintedLine, 'points' | 'lengthM' | 'measuredFt'>>; places: ReadonlyArray<Pick<PaintedPlace, 'lat' | 'lng'>> }

/** A painted map as the sheet offers it. */
export type TaskPlaceWayOffer = {
  id: string
  name: string
  /** `about 830 ft · 3 places` */
  summary: string
  /** How near the map comes to the place, in metres. */
  nearM: number
  /** `Reaches this place`, `Comes within 120 ft` */
  near: string
}

/** How near a map comes to a point: the nearest spot on any of its lines, or its nearest place. Null for an empty map. */
export function mapNearMeters(point: TaskPlacePoint, whole: Pick<WholeMap, 'lines' | 'places'>): number | null {
  let best: number | null = null
  const take = (m: number) => {
    if (Number.isFinite(m) && (best == null || m < best)) best = m
  }
  for (const line of whole.lines) {
    const hit = nearestOnLine(line.points, point)
    if (hit) take(hit.distanceM)
    else if (line.points[0]) take(haversineMeters(point, line.points[0]))
  }
  for (const place of whole.places) take(haversineMeters(point, place))
  return best
}

/** `Reaches this place` inside what a phone can tell apart, else `Comes within 120 ft`. */
export function wayNearWords(nearM: number): string {
  return nearM <= TASK_PLACE_HERE_METERS ? 'Reaches this place' : `Comes within ${taskPlaceDistanceWords(nearM)}`
}

/**
 * The maps to offer for a place: the ones that come within a mile of it, nearest first, a name
 * breaking a tie. A map with nothing on it is not a way anywhere and is left out.
 */
export function waysNearPlace(place: TaskPlacePoint, wholes: ReadonlyArray<WholeMap>, withinM: number = TASK_PLACE_WAY_NEAR_METERS, max: number = TASK_PLACE_WAY_OFFER_MAX): TaskPlaceWayOffer[] {
  const out: TaskPlaceWayOffer[] = []
  for (const whole of wholes) {
    const nearM = mapNearMeters(place, whole)
    if (nearM == null || nearM > withinM) continue
    out.push({ id: whole.map.id, name: whole.map.name.trim() || PAINTED_MAP_UNNAMED, summary: mapSummaryWords(whole.lines, whole.places.length), nearM, near: wayNearWords(nearM) })
  }
  out.sort((a, b) => a.nearM - b.nearM || a.name.localeCompare(b.name))
  return out.slice(0, Math.max(0, max))
}

/** What the task's card says about the way: `The way in is painted: The way in for deliveries, about 830 ft.` */
export function taskPlaceWayWords(mapName: string | null | undefined, lines: ReadonlyArray<Pick<PaintedLine, 'lengthM' | 'measuredFt'>>): string {
  const name = (mapName ?? '').trim() || PAINTED_MAP_UNNAMED
  return lines.length > 0 ? `The way in is painted: ${name}, ${aboutLengthWords(mapLengthMeters(lines))}.` : `The way in is painted: ${name}.`
}

/** Where Directions goes when a way is painted: the line's first point. A maps app routes to a gate, and the line leads on from there. */
export function taskPlaceWayStart(lines: ReadonlyArray<Pick<PaintedLine, 'points' | 'madeAt'>>, places: ReadonlyArray<PaintedPlace>): TaskPlacePoint | null {
  return mapStart(lines, places)
}

export const TASK_PLACE_WAY_WORDS = {
  /** The press in the Where is it? sheet, before a way is picked. */
  add: 'Add the way in',
  /** The list's head. */
  head: 'Which painted map leads here?',
  reading: 'Reading the painted maps…',
  /** No map comes near. It names the two doors that paint one. */
  none: 'No painted map comes within a mile of this spot. Paint one from a job’s address, or search Paint a map, then pick it here.',
  failed: 'The painted maps could not be read.',
  remove: 'No way in',
  /** Under the picked map: who it opens to. */
  opens: 'Whoever gets the task can open this map.',
  open: 'Open the map',
  directionsToStart: 'Directions to the start',
} as const
