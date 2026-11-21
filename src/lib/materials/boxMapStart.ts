/**
 * Where the box map opens, and what a sheet does when it has nowhere to open (punch list #402). Pure.
 *
 * The map opens on a pin, else on the job's address, else where it was flown, else on a painted line. With none of
 * those it draws an empty frame that says to press **Use my location**. That press can come back with only an area,
 * with a refusal or with nothing. An area is not a spot (`isRoughFix`), so the map is never opened on its middle.
 * The sheet then opens the map wide to be dragged, as a task's place sheet does, on the same wide start. The pin
 * press stays dead until the ring has been dragged off that start, which is nobody's place.
 *
 * No map code here, so the tally bundle stays light.
 */
import { isRoughFix } from '../paintedMap/paintedTrack'
import { TASK_PLACE_WIDE_START, TASK_PLACE_WIDE_ZOOM, isTaskPlaceWideStart } from '../tasks/taskPlace'
import type { LatLng, MyFix } from './myLocation'

type Spot = { lat: number; lng: number }
type PaintedStart = { lines: ReadonlyArray<{ points: ReadonlyArray<Spot> }>; places: ReadonlyArray<Spot> }

export type OnSiteMapStartInput = {
  pins: ReadonlyArray<Spot & { id: string }>
  /** The pin to open on; it wins over the first pin. */
  focusId?: string | null
  /** The job's address, placed. */
  center: LatLng | null
  /** Where the map was flown before it was ever drawn. */
  flyTo?: LatLng | null
  /** The job's painted maps: with no pin and no address, a painted line still says where the job is. */
  painted?: ReadonlyArray<PaintedStart> | null
}

/** Where the box map opens, and whether that is on a pin, which opens closer. Null is the empty frame. */
export function onSiteMapStart({ pins, focusId, center, flyTo, painted }: OnSiteMapStartInput): { at: LatLng; onPin: boolean } | null {
  const first = pins.find((p) => p.id === focusId) ?? pins[0] ?? null
  if (first) return { at: { lat: first.lat, lng: first.lng }, onPin: true }
  const at = center ?? flyTo ?? painted?.[0]?.lines[0]?.points[0] ?? painted?.[0]?.places[0] ?? null
  return at ? { at: { lat: at.lat, lng: at.lng }, onPin: false } : null
}

/** What Use my location does with a reading: an area never moves the map and is never kept for a pin's margin. */
export function boxMapReading(fix: MyFix): { kind: 'spot'; fly: MyFix } | { kind: 'area'; roughM: number } {
  return isRoughFix(fix.accuracyM) ? { kind: 'area', roughM: fix.accuracyM as number } : { kind: 'spot', fly: { ...fix } }
}

export type BoxMapOpening = {
  /** The map had nowhere to open and no spot to fly to, so it is opened wide to be dragged. */
  wide: boolean
  /** What the sheet hands the map as its centre. */
  center: LatLng | null
  /** And as its opening zoom; the map's own when it is not wide. */
  startZoom: number | undefined
}

/**
 * What a sheet hands the map. `openWide` is set by a Use my location that got an area, a refusal or nothing. It
 * opens the map wide only when the map would draw its empty frame: a map with a pin, an address, a painted line or a
 * spot to fly to opens there.
 */
export function boxMapOpening(input: Omit<OnSiteMapStartInput, 'flyTo'> & { fly: LatLng | null; openWide: boolean }): BoxMapOpening {
  const wide = input.openWide && !input.fly && onSiteMapStart({ ...input, flyTo: null }) == null
  return { wide, center: wide ? TASK_PLACE_WIDE_START : input.center, startZoom: wide ? TASK_PLACE_WIDE_ZOOM : undefined }
}

/** The pin press is live once the ring is somewhere a person chose: the wide view's own centre is nobody's place. */
export function boxPinReady(ring: LatLng | null, wide: boolean): boolean {
  return ring != null && !(wide && isTaskPlaceWideStart(ring))
}
