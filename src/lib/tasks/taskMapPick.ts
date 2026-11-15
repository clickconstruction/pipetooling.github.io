/**
 * The giver's side of a painted map on a task (punch list #345, "A map on a task", step 7). Pure.
 *
 * A task window keeps one map for the task. It gets there one of two ways:
 *
 *  - **With the place:** a place chip that has a way in, or **＋ Add the way in** on Where is it?.
 *    That map is the way to that place, so it leaves when the place leaves or changes.
 *  - **By itself:** the **Map** press in the Where row. That map is the giver's own pick, with or
 *    without a place, and it stays until the giver takes it off.
 *
 * Either way it is one column on the task, `painted_map_id`, and whoever reads the task reads the
 * map (`20261115063000_task_painted_maps.sql`).
 */
import { PAINTED_MAP_UNNAMED, mapSummaryWords, type PaintedLine, type PaintedPlace } from '../paintedMap/paintedMap'
import { TASK_PLACE_WAY_NEAR_METERS, mapNearMeters, wayNearWords } from './taskPlaceWay'
import { taskPlaceDistanceWords, type TaskPlace, type TaskPlaceDraft, type TaskPlacePoint } from './taskPlace'

/** The map a task window holds for the task. */
export type TaskMapDraft = {
  id: string
  /** Null until it is read: a task opened for an edit knows the id first. */
  name: string | null
  /** It came with the place, as that place's way in. It leaves when the place leaves or changes. */
  withPlace?: boolean
}

/** The map a saved task carries, for the Edit window: the place's way in, or the task's own map with no place. */
export function taskMapDraftFromSaved(place: Pick<TaskPlace, 'mapId'> | null, mapIdAlone: string | null | undefined): TaskMapDraft | null {
  if (place) return place.mapId ? { id: place.mapId, name: null, withPlace: true } : null
  return mapIdAlone ? { id: mapIdAlone, name: null } : null
}

/**
 * The task's map after the giver set, moved or removed the place.
 *
 *  - A place that brings a way in makes that the task's map.
 *  - A place with none, or no place, takes away a map that came with the old place.
 *  - A map the giver picked by itself is left alone.
 */
export function taskMapAfterPlace(map: TaskMapDraft | null, next: TaskPlaceDraft | null): TaskMapDraft | null {
  if (next?.mapId) return { id: next.mapId, name: next.mapName ?? (map?.id === next.mapId ? map.name : null), withPlace: true }
  return map?.withPlace ? null : map
}

/**
 * The place as the Where row's chips and the Where is it? sheet see it. It carries the map only
 * when the map is that place's way in, so a chip wears the paint's stroke for a way in and not for
 * a map the giver picked by itself.
 */
export function taskPlaceForRow(place: TaskPlaceDraft | null, map: TaskMapDraft | null): TaskPlaceDraft | null {
  if (!place) return null
  const { mapId: _mapId, mapName: _mapName, ...bare } = place
  return map?.withPlace ? { ...bare, mapId: map.id, mapName: map.name } : bare
}

/** The column a save writes for the task's map. */
export function taskMapColumn(map: TaskMapDraft | null): { painted_map_id: string | null } {
  return { painted_map_id: map?.id?.trim() || null }
}

/** Has the giver changed the task's map? */
export function taskMapChanged(a: TaskMapDraft | null, b: TaskMapDraft | null): boolean {
  return (a?.id ?? null) !== (b?.id ?? null)
}

type WholeMap = {
  map: { id: string; name: string; createdAt: string }
  lines: ReadonlyArray<Pick<PaintedLine, 'points' | 'lengthM' | 'measuredFt'>>
  places: ReadonlyArray<Pick<PaintedPlace, 'lat' | 'lng'>>
}

/** A painted map as *A map for this task* offers it. */
export type TaskMapOffer = {
  id: string
  name: string
  /** `about 830 ft · 3 places` */
  summary: string
  /** `J523 · Mission Flats`, `On no job yet`. Null when nobody said. */
  where: string | null
  /** With a place on the task: `Reaches this place`, `Comes within 120 ft`, `2.4 mi from the place`. Null with no place. */
  near: string | null
}

/** How many maps the list offers. Past it the giver searches by name. */
export const TASK_MAP_OFFER_MAX = 30

/** How near a map comes to the task's place, in words. Past a mile it is a distance and not a way in. */
export function taskMapNearWords(nearM: number): string {
  return nearM <= TASK_PLACE_WAY_NEAR_METERS ? wayNearWords(nearM) : `${taskPlaceDistanceWords(nearM)} from the place`
}

/**
 * The maps to offer for a task. With a place on the task, the maps nearest the place come first.
 * With none, the newest. A map with nothing on it is not offered: it shows nothing to the person
 * who gets the task. `find` narrows by name.
 */
export function mapsForTask(
  place: TaskPlacePoint | null,
  wholes: ReadonlyArray<WholeMap>,
  whereOf: (mapId: string) => string | null = () => null,
  find = '',
  max: number = TASK_MAP_OFFER_MAX,
): TaskMapOffer[] {
  const needle = find.trim().toLowerCase()
  const rows: Array<TaskMapOffer & { nearM: number | null; madeAt: string }> = []
  for (const whole of wholes) {
    if (whole.lines.length === 0 && whole.places.length === 0) continue
    const name = whole.map.name.trim() || PAINTED_MAP_UNNAMED
    const where = whereOf(whole.map.id)
    if (needle && !name.toLowerCase().includes(needle) && !(where ?? '').toLowerCase().includes(needle)) continue
    const nearM = place ? mapNearMeters(place, whole) : null
    rows.push({ id: whole.map.id, name, summary: mapSummaryWords(whole.lines, whole.places.length), where, near: nearM == null ? null : taskMapNearWords(nearM), nearM, madeAt: whole.map.createdAt })
  }
  rows.sort((a, b) => {
    if (place && a.nearM != null && b.nearM != null && a.nearM !== b.nearM) return a.nearM - b.nearM
    return b.madeAt.localeCompare(a.madeAt) || a.name.localeCompare(b.name)
  })
  return rows.slice(0, Math.max(0, max)).map(({ nearM: _nearM, madeAt: _madeAt, ...offer }) => offer)
}

/** One line of an offer under its name: `about 830 ft · 3 places · J523 · Mission Flats · Comes within 120 ft`. */
export function taskMapOfferWords(offer: Pick<TaskMapOffer, 'summary' | 'where' | 'near'>): string {
  return [offer.summary, offer.where, offer.near].filter(Boolean).join(' · ')
}

/** The bar's sentence with a map on the task: its first sentence ends `, with a map.` */
export function sentenceWithMap(sentence: string, hasMap: boolean): string {
  if (!hasMap) return sentence
  const end = sentence.indexOf('.')
  return end < 0 ? sentence : `${sentence.slice(0, end)}, with a map.${sentence.slice(end + 1)}`
}

export const TASK_MAP_PICK_WORDS = {
  /** The press in the Where row. */
  press: 'Map',
  pressAria: 'Add a map to this task',
  pressTitle: 'A painted map for this task: a trench, a route, the way in. The person sees it on the task.',
  head: 'A map for this task',
  pickHead: 'Pick one that is painted',
  find: 'Find a map by name',
  reading: 'Reading the painted maps…',
  /** No map at all. It names the two doors that paint one. */
  none: 'No painted map yet. Paint one from a job’s address, or search Paint a map, then pick it here.',
  noneFound: 'No painted map has that name.',
  failed: 'The painted maps could not be read.',
  /** Under the picked map: who it opens to. */
  opens: 'Whoever gets the task can open this map.',
  remove: 'Take the map off this task',
  change: 'Pick another map',
  /** The lit press's title, before the name. */
  onTask: 'The map on this task',
} as const
