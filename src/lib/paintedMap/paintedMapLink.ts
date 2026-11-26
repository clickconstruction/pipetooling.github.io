/**
 * A link to a painted map (punch list #345, PR 4): the app's side of the rules in
 * `supabase/functions/_shared/paintedMapLink.ts`, one source for the function and the app. Pure.
 */
import type { PaintedLine, PaintedPlace } from './paintedMap'
import { paintedPlaceKindFrom } from './paintedPlaceKind'
import { isRoughFix } from './paintedTrack'
import { areaAcrossWords } from './preciseLocation'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { SharedLine, SharedPaintedMap } from '../../../supabase/functions/_shared/paintedMapLink'

export {
  PAINTED_MAP_LINK_ALPHABET,
  PAINTED_MAP_LINK_CODE_LENGTH,
  PAINTED_MAP_LINK_DAYS,
  PAINTED_MAP_LINKS_OPEN_MAX,
  PAINTED_MAP_LINK_WORDS,
  PAINTED_MAP_VISITOR_NAME_MAX,
  PAINTED_MAP_VISIT_POINT_GAP_MS,
  mintPaintedMapLinkCode,
  paintedMapClip,
  paintedMapDeviceId,
  paintedMapDeviceWords,
  paintedMapVisitPoint,
  paintedMapVisitPointColumns,
  paintedMapVisitorName,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  paintedMapLinkReopenable,
  sharedMapIsEmpty,
  sharedPaintedMap,
} from '../../../supabase/functions/_shared/paintedMapLink'
export type { PaintedMapVisitPoint, SharedLine, SharedPaintedMap, SharedPlace } from '../../../supabase/functions/_shared/paintedMapLink'

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
  return shared.places.map((p) => ({ id: p.id, mapId: '', name: p.name, words: p.words, lat: p.lat, lng: p.lng, accuracyM: null, photoPath: null, kind: paintedPlaceKindFrom(p.kind), setBy: null, setAt: '', number: p.number }))
}

/** What the share sheet says a reader sees, and does not. Said beside the link, before it goes anywhere. */
export const PAINTED_MAP_SHARE_WORDS = {
  open: 'Anyone who has the link can open the map. No sign-in.',
  see: 'They see the name, the lines, and the places with their words and photos.',
  notSee: 'They do not see who painted it, when, or anything else about the job.',
  copy: 'A link can be ended. A copy cannot be taken back.',
  /** Since v2.7415: what a reader is asked, said to whoever is about to send the link. */
  asks: 'They give their name first. We keep the name, the phone or computer and the time.',
  whoHead: 'Who opened it',
  seeWhere: 'See that place',
  signedIn: 'signed in',
} as const

/** One visit to a map's link as the sheet reads it from the table. Read by the office and the map's painter alone. */
export type PaintedMapVisitRow = {
  id: string
  visitor_name: string
  user_id: string | null
  device_words: string
  last_opened_at: string
  open_count: number
  first_lat: number | null
  first_lng: number | null
  first_located_at: string | null
  /** How sure the phone was of the first point, in metres. Left out by a reader of rows older than v2.8105. */
  first_accuracy_m?: number | null
  last_lat: number | null
  last_lng: number | null
  last_located_at: string | null
  last_accuracy_m?: number | null
}

/**
 * One visit in words. `whereUrl` opens the place the reader showed in a map app, when they showed one. It is null
 * when their phone gave only an area: an area's middle is nobody's place, so the office is handed no pin on it.
 */
export type PaintedMapVisitLine = { id: string; name: string; teammate: boolean; detail: string; where: string | null; whereUrl: string | null }

type VisitPoint = { lat: number; lng: number; at: string; accuracyM: number | null }

/**
 * The point a visit's line speaks of (v2.8105, punch list #402). A reader's phone can hand back only the area it is
 * in, and the page sends that as it is, with its margin. So the line takes the latest point that is a spot, then
 * the first one when that is a spot, and only when neither is does it speak of an area: the latest one.
 */
export function visitPoint(row: PaintedMapVisitRow): VisitPoint | null {
  const latest = row.last_lat != null && row.last_lng != null && row.last_located_at ? { lat: row.last_lat, lng: row.last_lng, at: row.last_located_at, accuracyM: row.last_accuracy_m ?? null } : null
  const first = row.first_lat != null && row.first_lng != null && row.first_located_at ? { lat: row.first_lat, lng: row.first_lng, at: row.first_located_at, accuracyM: row.first_accuracy_m ?? null } : null
  const spot = [latest, first].find((p) => p && !isRoughFix(p.accuracyM))
  return spot ?? latest ?? first
}

/**
 * `Dana Reyes` · `iPhone · Safari · opened Nov 15, 3:02 PM · 2 times` · `Showed where they were, Nov 15, 3:05 PM.`
 * The place is the latest one kept that is a spot (`visitPoint`). A reader whose phone gave only an area reads
 * `Showed only the area they were in, 4 miles across, Nov 15, 3:05 PM.` and has no place to open. `whenOf` says a
 * moment in the app's words.
 */
export function visitLine(row: PaintedMapVisitRow, whenOf: (iso: string) => string | null): PaintedMapVisitLine {
  const opened = whenOf(row.last_opened_at)
  const detail = [row.device_words.trim() || null, opened ? `opened ${opened}` : null, row.open_count > 1 ? `${row.open_count.toLocaleString('en-US')} times` : null].filter(Boolean).join(' · ')
  const point = visitPoint(row)
  const shown = point ? whenOf(point.at) : null
  const across = point ? areaAcrossWords(point.accuracyM) : null
  return {
    id: row.id,
    name: row.visitor_name,
    teammate: !!row.user_id,
    detail,
    where: point ? `${across ? `Showed only the area they were in, ${across}` : 'Showed where they were'}${shown ? `, ${shown}` : ''}.` : null,
    whereUrl: point && !across ? `https://www.google.com/maps/search/?api=1&query=${point.lat.toFixed(6)},${point.lng.toFixed(6)}` : null,
  }
}

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

/**
 * `Nov 15` for the day a link was made, on the company's calendar (Central). The row's `made_at` is a moment in UTC,
 * so a link made in the evening would read as the next day if the date were cut from it.
 */
export function linkMadeDayWords(madeAt: string | null | undefined): string | null {
  return madeAt ? linkDayWords(calendarYmdInAppTzFromIso(madeAt)) : null
}

/** `The link ends by itself on Feb 11.` */
export function linkEndsWords(ymd: string | null | undefined): string | null {
  const day = linkDayWords(ymd)
  return day ? `The link ends by itself on ${day}.` : null
}

