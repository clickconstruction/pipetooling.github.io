/**
 * A buried line with its length (punch list #413, step 6): a place that says what is buried is
 * tied to a line walked or drawn along it, so the place carries a length and the line draws in the
 * color a locator paints for it.
 *
 * The line is painted on a map of its own on the job, named for the place, since a job's list of
 * places holds places only. The painting window takes the screen, so what happens when it closes
 * is done here and not in the window that asked: the new map is read, its first line is tied to
 * the place, and the list opens again on that place.
 */
import { openPaintedMap, paintPaintedMap, paintedMapsChanged } from './paintedMapDoor'
import { loadPaintedMap, savePaintedPlace } from './paintedMapIo'
import type { PaintedPlace } from './paintedMap'

/** The presses on a buried place with no line yet, and the words of a place that has one. */
export const PLACE_LINE_WORDS = {
  walk: '＋ Walk this line',
  draw: '＋ Draw this line',
  open: 'Open the line',
  takeOff: 'Take the line off',
} as const

/** An id for a map not yet saved, as the start sheet makes one. */
const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** The first line of a map just painted is tied to the place. Nothing happens for a map closed with no line saved. */
export async function tiePlaceToNewLine(placeId: string, mapId: string): Promise<boolean> {
  const res = await loadPaintedMap(mapId)
  const line = res.ok ? (res.value?.lines[0] ?? null) : null
  if (!line) return false
  const tied = await savePaintedPlace(placeId, { lineId: line.id })
  if (!tied.ok) return false
  paintedMapsChanged()
  return true
}

/**
 * Paints the line of a buried place: a new painted map on the place's job, named for the place,
 * that opens walking or drawing. When it closes, its line is tied to the place and the list the
 * person came from opens again on that place. `false` when no map window is listening.
 */
export function paintLineForPlace(input: { place: Pick<PaintedPlace, 'id' | 'name' | 'lat' | 'lng'>; listId: string; jobId: string; jobLabel?: string | null; address?: string | null; first: 'walk' | 'line' }): boolean {
  const mapId = newId()
  const { place, listId, jobId, jobLabel = null, address = null, first } = input
  return paintPaintedMap({ id: mapId, name: place.name, words: '', home: { jobId, developmentId: null, label: jobLabel, address, center: { lat: place.lat, lng: place.lng } }, first }, () => {
    void tiePlaceToNewLine(place.id, mapId).then(() => {
      openPaintedMap(listId, address, undefined, undefined, place.id)
    })
  })
}
