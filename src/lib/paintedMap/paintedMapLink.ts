/**
 * A link to a painted map (punch list #345, PR 4): the app's side of the rules in
 * `supabase/functions/_shared/paintedMapLink.ts`, one source for the function and the app. Pure.
 */
import type { PaintedLine, PaintedPlace } from './paintedMap'
import type { SharedLine, SharedPaintedMap } from '../../../supabase/functions/_shared/paintedMapLink'

export {
  PAINTED_MAP_LINK_ALPHABET,
  PAINTED_MAP_LINK_CODE_LENGTH,
  PAINTED_MAP_LINK_DAYS,
  PAINTED_MAP_LINKS_OPEN_MAX,
  PAINTED_MAP_LINK_WORDS,
  mintPaintedMapLinkCode,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  sharedMapIsEmpty,
  sharedPaintedMap,
} from '../../../supabase/functions/_shared/paintedMapLink'
export type { SharedLine, SharedPaintedMap, SharedPlace } from '../../../supabase/functions/_shared/paintedMapLink'

/** The address a link opens at. The page lives at `/way/<code>`. */
export function paintedMapLinkUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/way/${code}`
}

/** A shared line as the map draws it: the same shape a saved line has, with no id and nobody's name. */
export function sharedLineForCanvas(line: SharedLine, index: number): Pick<PaintedLine, 'id' | 'how' | 'points' | 'poorParts'> {
  return { id: `shared-${index}`, how: line.how, points: line.points.map(([lat, lng]) => ({ lat, lng })), poorParts: line.poorParts.map(([a, b]) => [a, b] as const) }
}

/** A shared map's places as the map draws them, each with the number the painter gave it. */
export function sharedPlacesForCanvas(shared: SharedPaintedMap): Array<PaintedPlace & { number: number }> {
  return shared.places.map((p) => ({ id: p.id, mapId: '', name: p.name, words: p.words, lat: p.lat, lng: p.lng, accuracyM: null, photoPath: null, setBy: null, setAt: '', number: p.number }))
}

/** What the share sheet says a reader sees, and does not. Said beside the link, before it goes anywhere. */
export const PAINTED_MAP_SHARE_WORDS = {
  open: 'Anyone who has the link can open the map. No sign-in.',
  see: 'They see the name, the lines, and the places with their words and photos.',
  notSee: 'They do not see who painted it, when, or anything else about the job.',
  copy: 'A link can be ended. A copy cannot be taken back.',
} as const

/** One link of a map as the sheet reads it from the table: when it was made, when it ends, how often it was opened. */
export type PaintedMapLinkRow = { id: string; made_at: string; expires_at: string; ended_at: string | null; open_count: number }

/** `Opened 3 times`, `Opened once`, `Not opened yet`. */
export function linkOpenedWords(count: number): string {
  if (count <= 0) return 'Not opened yet'
  return count === 1 ? 'Opened once' : `Opened ${count.toLocaleString('en-US')} times`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** `Feb 11` from the day the function hands back (`2027-02-11`), or null when it is not a day. No clock is read. */
export function linkDayWords(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  const day = Number(m[3])
  return month && day >= 1 && day <= 31 ? `${month} ${day}` : null
}

/** `The link ends by itself on Feb 11.` */
export function linkEndsWords(ymd: string | null | undefined): string | null {
  const day = linkDayWords(ymd)
  return day ? `The link ends by itself on ${day}.` : null
}

