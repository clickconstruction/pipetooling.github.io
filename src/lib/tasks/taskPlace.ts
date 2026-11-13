/**
 * A task's place (punch list #328): a named point on the map, "Pump house". A task is often at a spot
 * on a large property, where the street address covers everything and says nothing, so the task as
 * written (`checklist_items`) can carry one optional place. This file is the place's rules and its
 * words. Pure: no map, no network, no clock, no browser.
 *
 * The rules the screens lean on:
 * - A place is whole or absent. A point with one number, or off the globe, is no place.
 * - The word a person reads is *place*, and the mark on a map is a *dot*. Never *pin* (Pin Mode pins
 *   a page) and never *location* (in this app that is where a person is).
 * - The app asks a phone where it is only on a press. What comes back says how sure it is, and a
 *   reading too wide to trust is not taken quietly (`isPoorTaskPlaceFix`).
 * - Feet under a fifth of a mile, miles past it. A crew thinks in feet across a yard.
 */
import { haversineMeters } from '../jobTravelEstimate'

export type TaskPlacePoint = { lat: number; lng: number }

export type TaskPlace = TaskPlacePoint & {
  name: string
  /** The phone's margin in metres when the place was set from where the giver stood; null when the map was dragged. */
  accuracyM: number | null
  setBy: string | null
  setAt: string | null
}

/** The place as `checklist_items` holds it. Every column is null on a task with no place. */
export type TaskPlaceColumns = {
  place_name: string | null
  place_lat: number | null
  place_lng: number | null
  place_accuracy_m: number | null
  place_set_by: string | null
  place_set_at: string | null
}

/** The select list for a read that wants the place. */
export const TASK_PLACE_SELECT = 'place_name,place_lat,place_lng,place_accuracy_m,place_set_by,place_set_at'

/** What a place with no name is called. A name is asked for, never required. */
export const TASK_PLACE_UNNAMED = 'A place'
export const TASK_PLACE_NAME_MAX = 40

const FEET_PER_METER = 3.28084
const FEET_PER_MILE = 5280
/** Past this a reading is not taken without a look: about 150 ft. A yard gate and the next gate can be closer. */
export const TASK_PLACE_POOR_FIX_METERS = 46
/** Closer than this the doer is there: about 30 ft, inside what a phone can tell apart outdoors. */
export const TASK_PLACE_HERE_METERS = 9

/** A real point: two finite numbers on the globe, and not the 0,0 a broken reading gives. */
export function isTaskPlacePoint(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  return !(lat === 0 && lng === 0)
}

/** One line, trimmed, inner spaces collapsed, cut at the cap. */
export function cleanTaskPlaceName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, TASK_PLACE_NAME_MAX).trim()
}

/** The place a row carries, or null when the row has none or half of one. */
export function taskPlaceFromRow(row: Partial<TaskPlaceColumns> | null | undefined): TaskPlace | null {
  if (!row || !isTaskPlacePoint(row.place_lat, row.place_lng)) return null
  const accuracy = row.place_accuracy_m
  return {
    name: cleanTaskPlaceName(row.place_name) || TASK_PLACE_UNNAMED,
    lat: row.place_lat as number,
    lng: row.place_lng as number,
    accuracyM: typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    setBy: row.place_set_by ?? null,
    setAt: row.place_set_at ?? null,
  }
}

/**
 * The columns to write. A place writes all six, and no place writes six nulls, so a save can never
 * leave a name behind without its point (the table's check would refuse it).
 */
export function taskPlaceColumns(
  place: (TaskPlacePoint & { name?: string | null; accuracyM?: number | null }) | null,
  by: string | null,
  nowIso: string,
): TaskPlaceColumns {
  if (!place || !isTaskPlacePoint(place.lat, place.lng)) {
    return { place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_by: null, place_set_at: null }
  }
  const accuracy = place.accuracyM
  return {
    place_name: cleanTaskPlaceName(place.name) || null,
    place_lat: place.lat,
    place_lng: place.lng,
    place_accuracy_m: typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
    place_set_by: by,
    place_set_at: nowIso,
  }
}

/** Two places are the same press when they share a name and sit within a few yards. */
function sameTaskPlace(a: TaskPlace, b: TaskPlace): boolean {
  return a.name.toLowerCase() === b.name.toLowerCase() && haversineMeters(a, b) <= TASK_PLACE_HERE_METERS
}

/**
 * The places to offer as chips: the ones tasks already carry, newest first, one chip a name. A name
 * used at two different points keeps the newer point, since that is where the giver last said it is.
 * A place nobody named is not offered: a chip that reads "A place" tells the giver nothing.
 */
export function recentTaskPlaces(rows: ReadonlyArray<Partial<TaskPlaceColumns>>, limit = 8): TaskPlace[] {
  const places = rows
    .map((r) => taskPlaceFromRow(r))
    .filter((p): p is TaskPlace => p !== null && p.name !== TASK_PLACE_UNNAMED)
    .sort((a, b) => (b.setAt ?? '').localeCompare(a.setAt ?? ''))
  const out: TaskPlace[] = []
  const names = new Set<string>()
  if (limit <= 0) return out
  for (const p of places) {
    const key = p.name.toLowerCase()
    if (names.has(key)) continue
    names.add(key)
    out.push(p)
    if (out.length >= limit) break
  }
  return out
}

/** The chip a task's own place lights: the offered place it matches, if any. */
export function matchingTaskPlace(place: TaskPlace | null, offered: ReadonlyArray<TaskPlace>): TaskPlace | null {
  if (!place) return null
  return offered.find((o) => sameTaskPlace(o, place)) ?? null
}

/** The place as the giver is setting it: not yet saved, so no setter and no day. */
export type TaskPlaceDraft = TaskPlacePoint & { name: string; accuracyM: number | null }

/** A saved place back into the giver's hands, for the Edit window. */
export function taskPlaceDraft(place: TaskPlace | null): TaskPlaceDraft | null {
  return place ? { lat: place.lat, lng: place.lng, name: place.name === TASK_PLACE_UNNAMED ? '' : place.name, accuracyM: place.accuracyM } : null
}

/** Has the giver changed the place? Compared as written, so opening and closing the sheet on the same ring is no change. */
export function taskPlaceDraftChanged(a: TaskPlaceDraft | null, b: TaskPlaceDraft | null): boolean {
  if (!a || !b) return a !== b
  return a.lat !== b.lat || a.lng !== b.lng || cleanTaskPlaceName(a.name) !== cleanTaskPlaceName(b.name) || a.accuracyM !== b.accuracyM
}

/** A drag past this takes the ring off the phone's reading: about 10 ft, more than a map settles by on its own. */
export const TASK_PLACE_DRAG_METERS = 3

/**
 * The margin to keep when the sheet closes. The phone's reading has one and a hand has none, so the
 * margin stays only while the ring still sits on the reading. Drag the ring and the place is the
 * giver's own call.
 */
export function taskPlaceSheetAccuracy(fix: (TaskPlacePoint & { accuracyM: number | null }) | null, ring: TaskPlacePoint): number | null {
  if (!fix || fix.accuracyM == null) return null
  return haversineMeters(fix, ring) <= TASK_PLACE_DRAG_METERS ? fix.accuracyM : null
}

/**
 * Where the sheet's map opens: on the place being moved, else on the last place anyone set, else on
 * the office. A task is almost never tied to a job (2 of 151 when this was built), so the job's
 * address is not on the list.
 */
export function taskPlaceSheetStart(current: TaskPlacePoint | null, offered: ReadonlyArray<TaskPlacePoint>, office: TaskPlacePoint | null): TaskPlacePoint | null {
  const pick = current ?? offered[0] ?? office
  return pick && isTaskPlacePoint(pick.lat, pick.lng) ? { lat: pick.lat, lng: pick.lng } : null
}

/**
 * How long the sheet waits for somewhere to open before it opens wide: the office's address is one
 * settings read away, and a giver who was refused a reading must still get a map to drag.
 */
export const TASK_PLACE_START_WAIT_MS = 2500
/** The zoom of that wide view: the country, so any spot is a few pinches away. */
export const TASK_PLACE_WIDE_ZOOM = 4
/** Its centre: the middle of the lower 48. Nobody's place, only somewhere to start a drag. */
export const TASK_PLACE_WIDE_START: TaskPlacePoint = { lat: 39.5, lng: -98.35 }

/** The ring still sits where the wide view opened: nobody chose that point, so it is not a place to use yet. */
export function isTaskPlaceWideStart(ring: TaskPlacePoint | null): boolean {
  return ring != null && haversineMeters(ring, TASK_PLACE_WIDE_START) <= TASK_PLACE_DRAG_METERS
}

/** `250 ft`, `0.3 mi`, `12 mi`. Feet to the nearest ten under a fifth of a mile, then miles. */
export function taskPlaceDistanceWords(meters: number): string {
  const feet = Math.max(0, meters) * FEET_PER_METER
  if (feet < FEET_PER_MILE / 5) return `${Math.max(10, Math.round(feet / 10) * 10).toLocaleString('en-US')} ft`
  const miles = feet / FEET_PER_MILE
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles).toLocaleString('en-US')} mi`
}

const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const
export type TaskPlaceDirection = (typeof DIRECTIONS)[number]

/** Which way the place lies from where the person stands, to the nearest of eight. */
export function taskPlaceDirection(from: TaskPlacePoint, to: TaskPlacePoint): TaskPlaceDirection {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLng = rad(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(rad(to.lat))
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLng)
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return DIRECTIONS[Math.round(bearing / 45) % 8]!
}

/** `within 20 ft`, or null when the reading gave no margin. Rounded up, so the words never claim more than the phone did. */
export function taskPlaceAccuracyWords(accuracyM: number | null | undefined): string | null {
  if (typeof accuracyM !== 'number' || !Number.isFinite(accuracyM) || accuracyM < 0) return null
  const feet = accuracyM * FEET_PER_METER
  const step = feet < 100 ? 5 : 10
  return `within ${Math.max(step, Math.ceil(feet / step) * step).toLocaleString('en-US')} ft`
}

/** A reading too wide to take without a look. No margin at all is not poor: a dragged map has none. */
export function isPoorTaskPlaceFix(accuracyM: number | null | undefined): boolean {
  return typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > TASK_PLACE_POOR_FIX_METERS
}

/** The sheet's line after Use where I am: what the phone found and how sure it is, or what to do about a wide guess. */
export function taskPlaceFixWords(accuracyM: number | null | undefined): { poor: boolean; words: string } {
  const sure = taskPlaceAccuracyWords(accuracyM)
  if (isPoorTaskPlaceFix(accuracyM)) return { poor: true, words: `Your phone is only sure ${sure}. Drag the map until the ring is on the spot.` }
  return { poor: false, words: sure ? `Found you. Your phone is sure ${sure}.` : 'Found you.' }
}

/**
 * The answer to How far am I?: `250 ft north-east of you.` and, when the phone gave a margin, how sure
 * it is. Inside the margin a phone can tell apart, the answer is that the person is there.
 */
export function taskPlaceHowFarWords(from: TaskPlacePoint & { accuracyM?: number | null }, place: TaskPlacePoint): { lead: string; sure: string | null } {
  const meters = haversineMeters(from, place)
  const sure = taskPlaceAccuracyWords(from.accuracyM)
  const tail = sure ? `Your phone is sure ${sure}.` : null
  if (meters <= TASK_PLACE_HERE_METERS) return { lead: 'You are at the place.', sure: tail }
  return { lead: `${taskPlaceDistanceWords(meters)} ${taskPlaceDirection(from, place)} of you.`, sure: tail }
}

/** Why the phone gave no reading, as `requestMyFix` reports it. */
export type TaskPlaceNoFix = 'none' | 'refused' | 'failed'

/**
 * What the doer reads when How far am I? gets no answer. A refusal costs one thing, the distance:
 * the map and Directions never needed the phone's own reading, and the words say so.
 */
export function taskPlaceNoFixWords(why: TaskPlaceNoFix): string {
  if (why === 'refused') return 'Location is off for this app. The map and Directions still work. To see how far you are, allow location in the phone’s settings.'
  if (why === 'none') return 'This device gives no location. The map and Directions still work.'
  return 'Could not find you. Try again in the open, or use Directions.'
}

/** What the card says where its map should be when the tiles did not come. */
export const TASK_PLACE_NO_MAP_WORDS = 'The map did not load. There is no signal here.'
/** Where a doer's reading goes: nowhere. Said beside the press that asks for it. */
export const TASK_PLACE_PRIVACY_WORDS = 'Your location stays on this phone.'

/**
 * Who set the place and when, so a place that has gone stale can be judged: a machine moves, a
 * gate is rebuilt. The caller hands in the name and the day already in the app's words.
 */
export function taskPlacedByWords(byName: string | null | undefined, dayWords: string | null | undefined): string | null {
  const by = (byName ?? '').trim()
  const day = (dayWords ?? '').trim()
  if (by && day) return `Placed by ${by} on ${day}.`
  if (by) return `Placed by ${by}.`
  if (day) return `Placed on ${day}.`
  return null
}

export type TaskPlaceDot = TaskPlacePoint & {
  /** The task's id, or the first task's when several share the dot. */
  id: string
  /** The number the dot and its card wear: the task's place in the list among tasks that have a place. */
  number: number
  name: string
  overdue: boolean
}

/**
 * The dots for a list of tasks, in the list's order, and the count of tasks that have no place.
 * Every task with a place gets its own number, so a card can wear it. Nothing is dropped: a task
 * with no place is counted, and the caller says so under the map.
 */
export function taskPlaceDots<T extends { id: string; place: TaskPlace | null; overdue?: boolean }>(
  tasks: ReadonlyArray<T>,
): { dots: TaskPlaceDot[]; numberById: Map<string, number>; withoutPlace: number } {
  const dots: TaskPlaceDot[] = []
  const numberById = new Map<string, number>()
  let withoutPlace = 0
  for (const t of tasks) {
    if (!t.place) {
      withoutPlace += 1
      continue
    }
    const number = dots.length + 1
    numberById.set(t.id, number)
    dots.push({ id: t.id, number, lat: t.place.lat, lng: t.place.lng, name: t.place.name, overdue: t.overdue === true })
  }
  return { dots, numberById, withoutPlace }
}

/** One mark on the map: a place, and every task on the list that is at it. */
export type TaskPlaceDotGroup = TaskPlacePoint & {
  /** The first task's id: the mark's own id on the canvas. */
  id: string
  name: string
  taskIds: string[]
  numbers: number[]
  /** What the disc reads: the task's number, or the first with a plus when several tasks share the place. */
  label: string
  /** Red when any task at the place is overdue. */
  overdue: boolean
}

/**
 * Tasks at one place share one dot. Places repeat by design, since a place used before is one press
 * away, so three tasks at the pump house are the usual case and three discs on one point would hide
 * two of them. The dot wears the first task's number and a plus, and a press lists them all.
 */
export function taskPlaceDotGroups(dots: ReadonlyArray<TaskPlaceDot>): TaskPlaceDotGroup[] {
  const groups: TaskPlaceDotGroup[] = []
  for (const d of dots) {
    const home = groups.find((g) => haversineMeters(g, d) <= TASK_PLACE_HERE_METERS)
    if (home) {
      home.taskIds.push(d.id)
      home.numbers.push(d.number)
      home.overdue = home.overdue || d.overdue
      home.label = `${home.numbers[0]}+`
      continue
    }
    groups.push({ id: d.id, lat: d.lat, lng: d.lng, name: d.name, taskIds: [d.id], numbers: [d.number], label: String(d.number), overdue: d.overdue })
  }
  return groups
}

/** Past this spread the dots are across town, and streets say more than a view from above: one mile. */
export const TASK_PLACES_SATELLITE_METERS = 1609

/** The view the map opens in: from above while every dot sits on one property, streets once they spread. */
export function taskPlacesDefaultLayer(dots: ReadonlyArray<TaskPlacePoint>): 'satellite' | 'streets' {
  const first = dots[0]
  if (!first) return 'streets'
  return dots.every((d) => haversineMeters(first, d) <= TASK_PLACES_SATELLITE_METERS) ? 'satellite' : 'streets'
}

/** The folded map's line: how many places it is hiding. */
export function taskPlacesCountWords(places: number): string {
  return places === 1 ? '1 place' : `${places.toLocaleString('en-US')} places`
}

/** The distance on a task's line once the person asked where they are: `250 ft north-east`, or `here`. */
export function taskPlaceFarShort(from: TaskPlacePoint, place: TaskPlacePoint): string {
  const meters = haversineMeters(from, place)
  if (meters <= TASK_PLACE_HERE_METERS) return 'here'
  return `${taskPlaceDistanceWords(meters)} ${taskPlaceDirection(from, place)}`
}

/** The line under the map for the tasks it cannot show, or null when every task is on it. */
export function tasksWithoutPlaceWords(withoutPlace: number, withPlace: number): string | null {
  if (withoutPlace <= 0) return null
  const more = withPlace > 0 ? 'more ' : ''
  return withoutPlace === 1
    ? `1 ${more}task has no place. It is in the list below.`
    : `${withoutPlace.toLocaleString('en-US')} ${more}tasks have no place. They are in the list below.`
}
