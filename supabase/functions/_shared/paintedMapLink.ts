/**
 * A link to a painted map (punch list #345, PR 4): the pure rules the `painted-map-link` function and the page at
 * `/way/<code>` share. A link opens one painted map with no sign-in: its name, its lines and its places with their
 * words and photos. This file holds the link's code, how long a link lives, when it is open, and what the page is told.
 *
 * What the page is never told: who painted the map, when, the job, the customer, a price, or any other thing in the
 * app. `sharedPaintedMap` is the one place that decides, and it copies named fields, so a column added to a table later
 * is not on the page until somebody puts it here.
 *
 * No imports, so the app's tests import it as the function does (`src/lib/paintedMap/paintedMapLink.ts` re-exports it).
 */

// ---------------------------------------------------------------------------------------------------------------------
// The link's code: ten letters from the estimate link's alphabet (no look-alikes), kept only as its SHA-256.

export const PAINTED_MAP_LINK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const PAINTED_MAP_LINK_CODE_LENGTH = 10
const PAINTED_MAP_LINK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/

/** The code as typed or tapped, lower-cased, or null when it is not ten letters of the alphabet. */
export function paintedMapLinkCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toLowerCase()
  return PAINTED_MAP_LINK_CODE_RE.test(code) ? code : null
}

/**
 * Ten letters from random bytes with no letter likelier than another: 31 letters go into 248 eight times, so a byte
 * at or past 248 is thrown away, as `share_estimate_link` does. `randomBytes` is the platform's own source.
 */
export function mintPaintedMapLinkCode(randomBytes: (n: number) => Uint8Array): string {
  let out = ''
  let guard = 0
  while (out.length < PAINTED_MAP_LINK_CODE_LENGTH) {
    if (++guard > 64) throw new Error('painted map link: the random source gave no usable bytes')
    for (const b of randomBytes(32)) {
      if (b >= 248) continue
      out += PAINTED_MAP_LINK_ALPHABET[b % PAINTED_MAP_LINK_ALPHABET.length]
      if (out.length === PAINTED_MAP_LINK_CODE_LENGTH) break
    }
  }
  return out
}

/** Lower-case hex of a digest, for the code's SHA-256. */
export function paintedMapHexOf(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

// ---------------------------------------------------------------------------------------------------------------------
// How long a link lives.

/** A way in is used for months, not days: a link ends by itself after this many days. */
export const PAINTED_MAP_LINK_DAYS = 90
/** A map may have this many links open at once. Past it, an old one is ended before a new one is made. */
export const PAINTED_MAP_LINKS_OPEN_MAX = 20

/** When a link made now ends by itself. */
export function paintedMapLinkExpiry(nowIso: string): string {
  return new Date(Date.parse(nowIso) + PAINTED_MAP_LINK_DAYS * 24 * 60 * 60_000).toISOString()
}

/** Is the link open? Not once somebody ended it, and not once its day has come. */
export function paintedMapLinkOpen(link: { expires_at: string; ended_at: string | null }, nowIso: string): boolean {
  if (link.ended_at) return false
  return Date.parse(link.expires_at) > Date.parse(nowIso)
}

// ---------------------------------------------------------------------------------------------------------------------
// What a person reads.

export const PAINTED_MAP_LINK_WORDS = {
  /** A wrong code, an ended link and an expired one all read the same, so a guess learns nothing. */
  gone: 'This map is no longer shared. Ask whoever sent it for a new link.',
  locked: 'Too many wrong links from this connection in the last hour. Wait an hour, then open your link again.',
  failed: 'That did not go through. Try again.',
  notYours: 'Only whoever painted a map, or the office, may share it.',
  training: 'This is a training account, so no link was made.',
  empty: 'This map has nothing on it yet. Draw a line or add a place first.',
  tooMany: 'This map has too many links open. End one first.',
} as const

// ---------------------------------------------------------------------------------------------------------------------
// What the page is told.

export type SharedLine = {
  how: 'walked' | 'driven' | 'drawn'
  /** `[latitude, longitude]` pairs. */
  points: Array<[number, number]>
  /** The stretches the phone was not sure of, as `[from, to]` indexes into the points. */
  poorParts: Array<[number, number]>
  fixedByHand: boolean
  lengthM: number
  marginM: number | null
  measuredFt: number | null
  measuredHow: 'wheel' | 'tape' | 'other' | null
}
export type SharedPlace = {
  /** The place's id, to ask for its photo. It names nothing else. */
  id: string
  /** The number on its dot: the order the places were set in. */
  number: number
  name: string
  words: string
  lat: number
  lng: number
  /** There is a photo to ask for. */
  photo: boolean
}
export type SharedPaintedMap = { name: string; words: string; lines: SharedLine[]; places: SharedPlace[] }

type MapRowIn = { name?: unknown; words?: unknown }
type LineRowIn = { how?: unknown; points?: unknown; poor_parts?: unknown; fixed_by_hand?: unknown; length_m?: unknown; margin_m?: unknown; measured_ft?: unknown; measured_how?: unknown; made_at?: unknown }
type PlaceRowIn = { id?: unknown; name?: unknown; words?: unknown; lat?: unknown; lng?: unknown; photo_path?: unknown; set_at?: unknown }

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const onGlobe = (lat: number | null, lng: number | null): boolean => lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)

function pairs(v: unknown): Array<[number, number]> {
  if (!Array.isArray(v)) return []
  const out: Array<[number, number]> = []
  for (const p of v) {
    if (!Array.isArray(p) || p.length < 2) continue
    const lat = num(p[0])
    const lng = num(p[1])
    if (onGlobe(lat, lng)) out.push([lat as number, lng as number])
  }
  return out
}

function parts(v: unknown, pointCount: number): Array<[number, number]> {
  if (!Array.isArray(v)) return []
  const out: Array<[number, number]> = []
  for (const p of v) {
    if (!Array.isArray(p) || p.length < 2) continue
    const from = p[0]
    const to = p[1]
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to >= pointCount || to <= from) continue
    out.push([from, to])
  }
  return out
}

/**
 * A map as the page is told it, from the rows the function read. Named fields only: no id of the map, no job, no
 * development, nobody's name and no day. A place's own id stays, since the page asks for its photo by it. A line that
 * cannot be drawn and a place off the globe are left out.
 */
export function sharedPaintedMap(map: MapRowIn, lineRows: ReadonlyArray<LineRowIn>, placeRows: ReadonlyArray<PlaceRowIn>): SharedPaintedMap {
  const lines: SharedLine[] = []
  for (const row of [...lineRows].sort((a, b) => String(a.made_at ?? '').localeCompare(String(b.made_at ?? '')))) {
    const points = pairs(row.points)
    if (points.length < 2) continue
    const how = row.how === 'walked' || row.how === 'driven' || row.how === 'drawn' ? row.how : null
    if (!how) continue
    const measuredFt = num(row.measured_ft)
    const measuredHow = row.measured_how === 'wheel' || row.measured_how === 'tape' || row.measured_how === 'other' ? row.measured_how : null
    const measured = measuredFt != null && measuredFt > 0 && measuredHow != null
    const margin = num(row.margin_m)
    lines.push({
      how,
      points,
      poorParts: parts(row.poor_parts, points.length),
      fixedByHand: row.fixed_by_hand === true,
      lengthM: Math.max(0, num(row.length_m) ?? 0),
      marginM: margin != null && margin >= 0 ? margin : null,
      measuredFt: measured ? measuredFt : null,
      measuredHow: measured ? measuredHow : null,
    })
  }
  const places: SharedPlace[] = []
  const ordered = [...placeRows].sort((a, b) => String(a.set_at ?? '').localeCompare(String(b.set_at ?? '')) || String(a.id ?? '').localeCompare(String(b.id ?? '')))
  let number = 0
  for (const row of ordered) {
    // The number is the place's own, set or not drawable: a dot's number must match the one the painter sees.
    number += 1
    const lat = num(row.lat)
    const lng = num(row.lng)
    if (typeof row.id !== 'string' || !onGlobe(lat, lng)) continue
    places.push({ id: row.id, number, name: text(row.name, 80) || 'A place', words: text(row.words, 200), lat: lat as number, lng: lng as number, photo: typeof row.photo_path === 'string' && row.photo_path.length > 0 })
  }
  return { name: text(map.name, 80) || 'A painted map', words: text(map.words, 200), lines, places }
}

/** A map with nothing to show is not worth a link. */
export const sharedMapIsEmpty = (shared: SharedPaintedMap): boolean => shared.lines.length === 0 && shared.places.length === 0
