/**
 * Send more…, beside the press that sends one place (v2.7844). The owner, 2026-11-18, on keeping a
 * texted place a plain point in a map app: *Keep the plain pin, but now that you've said that maybe
 * we should prompt the user to offer them the option to share more*.
 *
 * It is an offer and not a prompt. **Text this place…** stays one press. **Send more…** sits
 * beside it and opens a short sheet of up to three ways. A question before every send would cost a
 * press on the path he asked to be immediate.
 *
 * Pure: which ways a sheet offers, their words, and the words of a text that carries several places.
 *
 * The rules the screens lean on:
 * - **This place with its photo.** A text link carries a spot and no picture. The phone's own share
 *   sheet carries both, so this way is drawn only where a place has a photo and the device's share
 *   sheet takes a file. Whoever gets it signs in to nothing.
 * - **Every place of the set.** The places a row stands with, each as the same words and plain map
 *   link one place sends, in one text. Drawn from two places up. Anyone who can see them may send
 *   them, as with one.
 * - **The whole map.** The door to the map's own Share sheet (#394). It is drawn only for a place
 *   that is the map's own, to whoever may share that map. A place kept on the job is not on
 *   another map's link, so a row of *On this job* never offers that map.
 * - A sheet with no way to offer is not offered: the press is not drawn.
 */
import { smsHref } from '../gc/followUpSheet'
import { placeShareWords } from './paintedPlaceShare'

/** The ways a sheet may offer, in the order they are drawn. */
export type SendMoreWay = 'photo' | 'all' | 'map'

/** Which places a row stands with: the job's kept places, or the places of the map it is on. */
export type SendMoreSet = 'job' | 'map'

export const SEND_MORE_WORDS = {
  press: 'Send more…',
  title: 'Send more',
  close: 'Close',
  /** Under a place with a photo, beside the press that sends the spot. */
  textNoPhoto: 'A text carries the spot, not the photo.',
  copyNoPhoto: 'A copy carries the spot, not the photo.',
  photo: 'This place with its photo',
  photoSub: 'Nobody signs in',
  photoGetting: 'Getting the photo…',
  photoGone: 'The photo would not load. Close this and open it again.',
  photoRefused: 'This phone would not open its share sheet. Text the place by itself.',
  map: 'The whole map',
  mapSub: 'With its lines and photos. They give their name first.',
  /** A job's own list of places is a map with no line on it. */
  list: 'The whole list',
  listSub: 'With its photos. They give their name first.',
  copied: 'Copied. Paste it into a text or an email.',
  wouldNotCopy: 'This browser would not copy it. Open the map on a phone and press Send more….',
} as const

export type SendMoreInput = {
  /** The place has a photo. */
  hasPhoto: boolean
  /** The device's own share sheet takes a photo (`canSharePhoto`). */
  canShareFiles: boolean
  /** How many places of the row's set have a spot to send, this one among them. */
  setCount: number
  /** The place is the map's own, and whoever is looking may share that map. */
  mayShareMap: boolean
}

/** The ways this sheet offers. An empty list means the press is not drawn. */
export function sendMoreWays(input: SendMoreInput): SendMoreWay[] {
  const ways: SendMoreWay[] = []
  if (input.hasPhoto && input.canShareFiles) ways.push('photo')
  if (input.setCount >= 2) ways.push('all')
  if (input.mayShareMap) ways.push('map')
  return ways
}

/** `Both places on this job` · `All 3 places on this map`. */
export function allPlacesName(count: number, set: SendMoreSet): string {
  const where = set === 'job' ? 'on this job' : 'on this map'
  return count === 2 ? `Both places ${where}` : `All ${count.toLocaleString('en-US')} places ${where}`
}

/** Under that name: what the press does on this device. */
export function allPlacesSub(count: number, device: { phone: boolean }): string {
  const pins = `${count.toLocaleString('en-US')} map pins`
  return device.phone ? `${pins} in one text` : `Copies ${pins}`
}

/** The whole map's name and the line under it. A job's list is named as a list. */
export function wholeMapWords(list: boolean): { name: string; sub: string } {
  return list ? { name: SEND_MORE_WORDS.list, sub: SEND_MORE_WORDS.listSub } : { name: SEND_MORE_WORDS.map, sub: SEND_MORE_WORDS.mapSub }
}

/** What a place with a photo says beside its press, by the press the device gets. */
export function noPhotoWords(way: 'text' | 'copy'): string {
  return way === 'text' ? SEND_MORE_WORDS.textNoPhoto : SEND_MORE_WORDS.copyNoPhoto
}

type Sendable = { lat: number; lng: number; name: string; words?: string | null; kind?: string | null }

/** The places of a set that have a spot to send, in the order given. */
export function sendablePlaces<P extends Sendable>(places: ReadonlyArray<P>): P[] {
  return places.filter((p) => placeShareWords(p) !== null)
}

/**
 * The words of a text that carries several places: each as one place sends it, a blank line
 * between them, in the order of the list. Null when no place has a spot.
 */
export function placesShareWords(places: ReadonlyArray<Sendable>): string | null {
  const each = places.map((p) => placeShareWords(p)).filter((w): w is string => w !== null)
  return each.length > 0 ? each.join('\n\n') : null
}

/** The address that opens the phone's own Messages with those words written and nobody picked. */
export function placesTextHref(places: ReadonlyArray<Sendable>): string | null {
  const words = placesShareWords(places)
  return words ? smsHref('', words) : null
}

/** The name the photo's file goes out under: the place in words, safe for a file, as a JPEG. */
export function placePhotoFileName(says: string): string {
  const stem = says
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `${stem || 'place'}.jpg`
}
