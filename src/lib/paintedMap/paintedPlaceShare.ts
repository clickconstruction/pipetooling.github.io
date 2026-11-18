/**
 * One place, sent to someone (punch list #393). The owner, 2026-11-18: *a user can hit share and
 * then immediately take that link into text and text it to someone so someone else can identify a
 * location*. A painted map's own Share is the sheet of #394. This is one place alone.
 *
 * Pure: the words of the text, the link in it and which press a device gets.
 *
 * The rules the screens lean on:
 * - The link is a plain point in a map app, not a link into this app. Whoever gets it needs no
 *   sign-in and gives no name, and it shows them that one spot and nothing else of the map. So
 *   anyone who can see a place may send it, where a map's link is its maker's and the office's.
 * - On a phone the press is a link that opens the phone's own Messages with the words written and
 *   nobody picked. The sender picks who gets it. At a desk there is no Messages to open, so the
 *   press copies the same words.
 * - The words lead with the kind when the name does not say it, since a text draws no mark.
 */
import { smsHref } from '../gc/followUpSheet'
import { placeSaysWords } from './paintedPlaceKind'

export const PLACE_SHARE_WORDS = {
  /** On a phone. */
  text: 'Text this place…',
  /** At a desk. */
  copy: 'Copy this place',
  copied: 'Copied. Paste it into a text or an email.',
  wouldNotCopy: 'This browser would not copy it. Open the map on a phone and press Text this place….',
} as const

type Point = { lat: number; lng: number }
const onGlobe = (p: Point): boolean => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180

/**
 * A link that opens a map app on the spot itself, with a dot on it. Google Maps' own search form,
 * which needs no key, opens the Maps app on a phone that has it and the web page on one that has
 * not. Six places of a degree is about four inches. Null for a point that is not on the globe.
 */
export function placePointUrl(point: Point): string | null {
  if (!onGlobe(point)) return null
  return `https://www.google.com/maps/search/?api=1&query=${point.lat.toFixed(6)},${point.lng.toFixed(6)}`
}

/**
 * The words of the text: what the place is, the word left for whoever comes next, and the link.
 *   Truck gate. Close it behind you.
 *   https://www.google.com/maps/search/?api=1&query=29.500000,-98.200000
 * Null when the place has no point to link to.
 */
export function placeShareWords(place: Point & { name: string; words?: string | null; kind?: string | null }): string | null {
  const url = placePointUrl(place)
  if (!url) return null
  const says = placeSaysWords({ name: place.name, kind: place.kind })
  const words = (place.words ?? '').trim()
  const lead = /[.!?]$/.test(says) ? says : `${says}.`
  return `${words ? `${lead} ${words}` : lead}\n${url}`
}

/** The address that opens the phone's own Messages with those words written and nobody picked. */
export function placeTextHref(place: Point & { name: string; words?: string | null; kind?: string | null }): string | null {
  const words = placeShareWords(place)
  return words ? smsHref('', words) : null
}

/** Which press a device gets: a text from a phone, a copy from a desk. */
export function placeShareWay(device: { phone: boolean }): 'text' | 'copy' {
  return device.phone ? 'text' : 'copy'
}
