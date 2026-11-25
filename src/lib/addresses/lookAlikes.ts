/**
 * Addresses that look alike (punch list #439, piece 2). Addresses already on file stay as they were typed, so some
 * places are written two ways. This kernel pairs them up for a person to answer once: **Same place** or **Not the
 * same**. It never decides by itself, and an answer changes no job's address.
 *
 * A pair is one of three kinds:
 *  - written alike, at the same spot on the map: a typo, a unit, a missing space;
 *  - written alike, where the map says apart or has no point: worth a look, the map may be wrong;
 *  - different words at the same spot: neighbours, or one place written two ways.
 *
 * The answers also say which addresses are one place for everything after this piece (`samePlaceKeys`): a paper
 * that names a site, the hold on a send.
 *
 * Pure: no React, no supabase.
 */
import { ADDRESS_STREET_WORDS } from '../developments/notInIt'
import type { AddressOnFile } from './addressesOnFile'
import { val } from '../valuesInPlace'

export type MapPoint = { lat: number; lng: number }

/** One kept answer. `keyA` is the smaller key, so a pair has one row whichever way it was asked. */
export type PlaceAnswer = { keyA: string; keyB: string; same: boolean; byName: string; at: string }

export type LookAlikeGroup = 'alikeSameSpot' | 'alikeApart' | 'sameSpot'

export type LookAlikePair = {
  id: string
  /** The address with more jobs and bids, the one a person knows. On a tie, the smaller key. */
  a: AddressOnFile
  b: AddressOnFile
  group: LookAlikeGroup
  /** How far apart the map puts them. Null when either has no point. */
  meters: number | null
  answer: PlaceAnswer | null
}

export type LookAlikes = {
  /** Every pair, the ones still to answer first, the likeliest first within a group. */
  pairs: LookAlikePair[]
  /** Addresses with no house number, the busiest first. Words alone cannot match these. */
  noNumber: AddressOnFile[]
  toLook: number
  answered: number
  byGroup: Record<LookAlikeGroup, number>
}

/** A map point two addresses share when they are one building. */
export const SAME_SPOT_ALIKE_METERS = 75
/** Tighter for addresses written differently: next door is not the same place. */
export const SAME_SPOT_DIFFERENT_METERS = 40
/** A point this many addresses share is a town or a road, not a building. */
export const PILE_OF_ADDRESSES = 4

export const LOOK_ALIKE_GROUPS: readonly LookAlikeGroup[] = ['alikeSameSpot', 'alikeApart', 'sameSpot']

export const LOOK_ALIKE_WORDS = {
  door: 'Addresses that look alike…',
  title: 'Addresses that look alike',
  lead: 'Jobs whose addresses may be one place written two ways. New pairs show here as jobs are added.',
  groups: {
    alikeSameSpot: 'Written alike, same spot on the map',
    alikeApart: 'Written alike, the map says apart',
    sameSpot: 'Different words, same spot',
  } satisfies Record<LookAlikeGroup, string>,
  noNumber: 'No street number',
  same: 'Same place',
  notSame: 'Not the same',
  undo: 'Undo',
  foot: 'Same place records the match and changes no address.',
  nothing: 'Nothing waiting. Every pair that looks alike is answered.',
} as const

/** The two keys of a pair in their one order. */
export function pairKeys(one: string, other: string): { keyA: string; keyB: string } {
  return one <= other ? { keyA: one, keyB: other } : { keyA: other, keyB: one }
}

/** A pair's id: its two keys in order. A cleaned key holds letters, digits and spaces, so the bar is safe. */
export function pairId(one: string, other: string): string {
  const { keyA, keyB } = pairKeys(one, other)
  return `${keyA}|${keyB}`
}

const houseAndRest = (key: string): { house: string; rest: string } | null => {
  const m = /^(\d+[a-z]?)\s+(.+)$/.exec(key)
  return m ? { house: m[1] ?? '', rest: m[2] ?? '' } : null
}

/** The street an address is on: its words up to the first street word, four at most. A unit comes after it. */
function streetOf(rest: string): string {
  const out: string[] = []
  for (const word of rest.split(' ')) {
    out.push(word)
    if ((ADDRESS_STREET_WORDS.has(word) && out.length > 1) || out.length >= 4) break
  }
  return out.join(' ')
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min((d[i - 1]?.[j] ?? 0) + 1, (d[i]?.[j - 1] ?? 0) + 1, (d[i - 1]?.[j - 1] ?? 0) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, (d[i - 2]?.[j - 2] ?? 0) + 1)
      const row = d[i]
      if (row) row[j] = best
    }
  }
  return d[rows - 1]?.[cols - 1] ?? 0
}

/**
 * Two cleaned keys are written alike when they share a house number and a street: the same street words, the
 * same with a space moved, or a letter or two apart. A unit, a suite or a building after the street does not
 * matter here, since that is exactly what a person is asked about.
 */
export function writtenAlike(keyA: string, keyB: string): boolean {
  if (keyA === keyB) return false
  const a = houseAndRest(keyA)
  const b = houseAndRest(keyB)
  if (!a || !b || a.house !== b.house) return false
  const sa = streetOf(a.rest)
  const sb = streetOf(b.rest)
  if (sa.replace(/\s/g, '') === sb.replace(/\s/g, '')) return true
  const longer = Math.max(sa.length, sb.length)
  if (longer < 6) return false
  const digits = (s: string) => s.replace(/\D/g, '')
  if (digits(sa) !== digits(sb)) return false
  const distance = editDistance(sa, sb)
  return distance <= 2 && distance * 4 <= longer
}

/** Metres between two map points. */
export function metersBetween(a: MapPoint, b: MapPoint): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The key the map keeps a point under: the address as written, lower case, one space between words. */
export const mapPointKey = (address: string): string => address.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Every pair that looks alike, grouped, with its answer when it has one, and the addresses with no house number.
 * `points` is the map's own cache, a point under each address as written. A point that four or more addresses
 * share is left out: it is a town's or a road's centre, and it would pair every address there with every other.
 */
export function lookAlikes(list: ReadonlyArray<AddressOnFile>, points: ReadonlyMap<string, MapPoint>, answers: ReadonlyArray<PlaceAnswer>): LookAlikes {
  const pointOf = new Map<string, MapPoint>()
  for (const entry of list) {
    for (const spelling of entry.spellings) {
      const p = points.get(mapPointKey(spelling))
      if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        pointOf.set(entry.key, p)
        break
      }
    }
  }
  const sharers = new Map<string, number>()
  const spot = (p: MapPoint) => `${p.lat},${p.lng}`
  for (const p of pointOf.values()) sharers.set(spot(p), (sharers.get(spot(p)) ?? 0) + 1)
  for (const [key, p] of [...pointOf]) if ((sharers.get(spot(p)) ?? 0) >= PILE_OF_ADDRESSES) pointOf.delete(key)

  const answerOf = new Map<string, PlaceAnswer>()
  for (const a of answers) answerOf.set(pairId(a.keyA, a.keyB), a)

  const found = new Map<string, LookAlikePair>()
  const add = (a: AddressOnFile, b: AddressOnFile, group: LookAlikeGroup, meters: number | null) => {
    const id = pairId(a.key, b.key)
    if (found.has(id)) return
    // The busier address is the one a person knows, so it leads and the other is read against it.
    const busier = a.jobs + a.bids !== b.jobs + b.bids ? (a.jobs + a.bids > b.jobs + b.bids ? a : b) : a.key <= b.key ? a : b
    const first = busier
    const second = first === a ? b : a
    found.set(id, { id, a: first, b: second, group, meters: meters == null ? null : Math.round(meters), answer: answerOf.get(id) ?? null })
  }

  // Written alike: only addresses with the same house number can be, so look within each number.
  const byHouse = new Map<string, AddressOnFile[]>()
  const noNumber: AddressOnFile[] = []
  for (const entry of list) {
    const parts = houseAndRest(entry.key)
    if (!parts) {
      noNumber.push(entry)
      continue
    }
    const bucket = byHouse.get(parts.house)
    if (bucket) bucket.push(entry)
    else byHouse.set(parts.house, [entry])
  }
  for (const bucket of byHouse.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]
        const b = bucket[j]
        if (!a || !b || !writtenAlike(a.key, b.key)) continue
        const pa = pointOf.get(a.key)
        const pb = pointOf.get(b.key)
        const meters = pa && pb ? metersBetween(pa, pb) : null
        add(a, b, meters != null && meters <= SAME_SPOT_ALIKE_METERS ? 'alikeSameSpot' : 'alikeApart', meters)
      }
    }
  }

  // Different words at one spot: look in each cell of about a hundred metres, and the cells beside it.
  const CELL = 0.001
  const cells = new Map<string, AddressOnFile[]>()
  const cellOf = (p: MapPoint): [number, number] => [Math.floor(p.lat / CELL), Math.floor(p.lng / CELL)]
  for (const entry of list) {
    const p = pointOf.get(entry.key)
    if (!p) continue
    const [x, y] = cellOf(p)
    const k = `${x},${y}`
    const cell = cells.get(k)
    if (cell) cell.push(entry)
    else cells.set(k, [entry])
  }
  for (const entry of list) {
    const p = pointOf.get(entry.key)
    if (!p) continue
    const [x, y] = cellOf(p)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${x + dx},${y + dy}`) ?? []) {
          if (other.key <= entry.key) continue
          const q = pointOf.get(other.key)
          if (!q) continue
          const meters = metersBetween(p, q)
          if (meters <= SAME_SPOT_DIFFERENT_METERS) add(entry, other, 'sameSpot', meters)
        }
      }
    }
  }

  const used = (e: AddressOnFile) => e.jobs + e.bids
  const pairs = [...found.values()].sort(
    (p, q) =>
      Number(p.answer != null) - Number(q.answer != null) ||
      LOOK_ALIKE_GROUPS.indexOf(p.group) - LOOK_ALIKE_GROUPS.indexOf(q.group) ||
      (p.meters ?? Number.MAX_SAFE_INTEGER) - (q.meters ?? Number.MAX_SAFE_INTEGER) ||
      used(q.a) + used(q.b) - (used(p.a) + used(p.b)) ||
      p.id.localeCompare(q.id),
  )
  const byGroup: Record<LookAlikeGroup, number> = { alikeSameSpot: 0, alikeApart: 0, sameSpot: 0 }
  let toLook = 0
  for (const p of pairs) {
    if (p.answer) continue
    toLook += 1
    byGroup[p.group] += 1
  }
  noNumber.sort((a, b) => used(b) - used(a) || a.address.localeCompare(b.address))
  return { pairs, noNumber, toLook, answered: pairs.length - toLook, byGroup }
}

/**
 * The keys that are one place with `key`, itself included, by the answers kept: **Same place** joins two keys,
 * and a place joined to a second is joined to everything the second is joined to. **Not the same** joins nothing.
 */
export function samePlaceKeys(key: string, answers: ReadonlyArray<PlaceAnswer>): Set<string> {
  const next = new Map<string, string[]>()
  const link = (from: string, to: string) => {
    const have = next.get(from)
    if (have) have.push(to)
    else next.set(from, [to])
  }
  for (const a of answers) {
    if (!a.same) continue
    link(a.keyA, a.keyB)
    link(a.keyB, a.keyA)
  }
  const seen = new Set<string>([key])
  const queue = [key]
  while (queue.length > 0) {
    const at = queue.pop()
    if (at == null) break
    for (const to of next.get(at) ?? []) {
      if (seen.has(to)) continue
      seen.add(to)
      queue.push(to)
    }
  }
  return seen
}

/** The line over the tabs: `5 pairs to look at. 1 answered.`, its counts marked as values. */
export function lookAlikeCountsSentence(found: Pick<LookAlikes, 'toLook' | 'answered'>): string {
  return `${val('count', String(found.toLook))} ${found.toLook === 1 ? 'pair' : 'pairs'} to look at. ${val('count', String(found.answered))} answered.`
}

/** How far apart, as a row says it: `same spot`, `4 m apart`, `1.2 km apart`, or nothing when the map has no point. */
export function apartWords(meters: number | null): string {
  if (meters == null) return ''
  if (meters < 1) return 'same spot'
  if (meters < 1000) return `${Math.round(meters)} m apart`
  return `${(meters / 1000).toFixed(1)} km apart`
}

/** The tab for a group, with how many are still to answer: `Written alike, same spot on the map · 26`. */
export function groupTabWords(group: LookAlikeGroup, count: number): string {
  return `${LOOK_ALIKE_WORDS.groups[group]} · ${count}`
}

/** The answered line on a row: `Same place · Cora Sample, Nov 24`. */
export function answeredWords(answer: PlaceAnswer, day: string): string {
  const who = [answer.byName.trim(), day].filter(Boolean).join(', ')
  return `${answer.same ? LOOK_ALIKE_WORDS.same : LOOK_ALIKE_WORDS.notSame}${who ? ` · ${who}` : ''}`
}
