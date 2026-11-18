/**
 * The way to a place (punch list #372, step 4): a place on a site, the laydown yard or Level 2, can carry one painted
 * map (#345) that is the way to it (`job_places.painted_map_id`, v2.7580). Where is it? on a box draws a straight
 * line, which knows no fence or gate. A painted way does, because a person drew it, and one way painted once serves
 * every box that stands in the place. Pure: the words and the small rules. The write is `placeWayIo.ts`.
 */
import { PAINTED_MAP_NAME_MAX } from '../paintedMap/paintedMap'

export const PLACE_WAY_PAINT_PRESS = '＋ Paint the way here'
export const PLACE_WAY_OPEN_PRESS = 'Open the way'
export const PLACE_WAY_TAKE_OFF_PRESS = 'Take the way off'

/** What a new way is called: `The way to Level 2`, cut to a painted map's name. */
export function placeWayName(placeName: string): string {
  const name = placeName.trim().replace(/\s+/g, ' ')
  return `The way to ${name}`.slice(0, PAINTED_MAP_NAME_MAX).trim()
}

/** The sheet's sentence for a box whose place has a way. */
export function placeWaySentence(placeName: string): string {
  return `The way to ${placeName.trim()} is painted.`
}

/** A way was painted and saved onto the place. */
export function placeWaySavedWords(placeName: string): string {
  return `The way to ${placeName.trim()} is saved. A person who looks for a box there can open it.`
}

/** The painting window closed with nothing saved. */
export function placeWayNothingWords(placeName: string): string {
  return `Nothing was painted, so ${placeName.trim()} has no way yet.`
}

/** The map was saved, and putting it on the place failed. */
export function placeWayNotSetWords(placeName: string, reason: string): string {
  return `The map is saved, but it did not go onto ${placeName.trim()}: ${reason}`
}

export function placeWayTakenOffWords(placeName: string): string {
  return `${placeName.trim()} has no way now. The map itself is kept.`
}

/** No painted map window is listening (a page outside the app's frame). */
export const PLACE_WAY_NO_WINDOW_WORDS = 'The painting window did not open here. Open the job’s materials from the app and try again.'

/** A saved map with something on it: a line or a place. A map closed before its first save does not exist. */
export function paintedWayWasSaved(whole: { lines: ReadonlyArray<unknown>; places: ReadonlyArray<unknown> } | null | undefined): boolean {
  return !!whole && (whole.lines.length > 0 || whole.places.length > 0)
}
