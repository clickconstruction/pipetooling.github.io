/**
 * Places on the Map page (v2.4804, Map page refresh PR 3). Pure.
 *
 * One pin per address, not per record: the records that share an address
 * key fold into a place, the pin wears the count when there are several,
 * and its color is the liveliest record's (a working job over a paid one,
 * an unsent bid over a lost one) with the most urgent ring any record has.
 * The rail reads the same places: the selected place's card, the distance
 * bands from the office (which double as filters), and the places nearest
 * the office. Miles are the straight line from the office anchor, the same
 * yardstick as the 25 / 50 mile rings.
 */
import type { MapCanvasPin } from './mapCanvasTypes'
import { mapPagePinColors, mapPagePinTitle, type MapPagePinSource } from './mapPagePins'
import { MAP_PAGE_CLUSTER_RING_PRIORITY } from './mapPageSections'
import { milesBetween } from '../bids/bidBoardMap'
import { DISTANCE_BUCKETS, distanceBucketFor, type DistanceBucketKey, type DistanceBucketVisibility } from '../bids/bidBoardMapRail'
import type { SubmissionSectionKey } from '../bids/submissionSections'

export type { DistanceBucketKey, DistanceBucketVisibility }
export { DISTANCE_BUCKETS }

export type MapPagePlaceSource = MapPagePinSource & { addressKey: string; addressLabel: string }

export type MapPagePlace<T extends MapPagePlaceSource> = {
  /** The address key — the pin's id on the canvas. */
  key: string
  addressLabel: string
  lat: number
  lng: number
  items: T[]
}

/** Fold the placed records into places by address key, in the order first seen. */
export function mapPagePlaces<T extends MapPagePlaceSource>(entities: readonly T[]): MapPagePlace<T>[] {
  const byKey = new Map<string, MapPagePlace<T>>()
  for (const e of entities) {
    const got = byKey.get(e.addressKey)
    if (got) got.items.push(e)
    else byKey.set(e.addressKey, { key: e.addressKey, addressLabel: e.addressLabel, lat: e.lat, lng: e.lng, items: [e] })
  }
  return [...byKey.values()]
}

/** Lower is livelier: the record whose color the place's pin takes. */
const JOB_RANK: Record<string, number> = { working: 0, waiting: 1, readyToBill: 2, billed: 3, paid: 6 }
const BID_RANK: Record<string, number> = { unsent: 0, pending: 1, won: 2, startedOrComplete: 3, lost: 7 }

export function mapPageRecordRank(e: MapPagePinSource, focusSection?: SubmissionSectionKey): number {
  if (e.kind === 'estimate') return 5
  if (e.kind === 'job') return e.jobSection ? JOB_RANK[e.jobSection] ?? 4 : 4
  const s = focusSection ?? e.bidSection
  return s ? BID_RANK[s] ?? 4 : 4
}

/** The place's leading record — the one the pin is colored for. */
export function mapPagePlaceLead<T extends MapPagePlaceSource>(place: MapPagePlace<T>, focusSection: (e: T) => SubmissionSectionKey | undefined): T {
  let lead = place.items[0]!
  let best = Number.POSITIVE_INFINITY
  for (const e of place.items) {
    const r = mapPageRecordRank(e, e.kind === 'bid' ? focusSection(e) : undefined)
    if (r < best) {
      best = r
      lead = e
    }
  }
  return lead
}

/** The place's ring: the most urgent any record wears (Collections, overdue, due soon), or none. */
export function mapPagePlaceRing<T extends MapPagePlaceSource>(place: MapPagePlace<T>, focusSection: (e: T) => SubmissionSectionKey | undefined): string | null {
  const rings = new Set(place.items.map((e) => mapPagePinColors(e, e.kind === 'bid' ? focusSection(e) : undefined).ringColor).filter((r): r is string => !!r))
  for (const r of MAP_PAGE_CLUSTER_RING_PRIORITY) if (rings.has(r)) return r
  return rings.size ? [...rings][0]! : null
}

/** "99+" past two digits — the badge must fit the disc. */
export function placeBadge(count: number): string | null {
  if (count <= 1) return null
  return count > 99 ? '99+' : String(count)
}

/** "9 records", "1 job", "2 jobs · 1 bid" — by kind, jobs first. */
export function placeCountWords(items: readonly { kind: 'job' | 'bid' | 'estimate' }[]): string {
  const words: string[] = []
  for (const kind of ['job', 'bid', 'estimate'] as const) {
    const n = items.filter((i) => i.kind === kind).length
    if (n > 0) words.push(`${n} ${kind}${n === 1 ? '' : 's'}`)
  }
  return words.join(' · ')
}

export function mapPagePlacePins<T extends MapPagePlaceSource>(
  places: readonly MapPagePlace<T>[],
  opts: { builderFocus: boolean; focusSection: (e: T) => SubmissionSectionKey | undefined },
): MapCanvasPin[] {
  const focus = (e: T) => (opts.builderFocus ? opts.focusSection(e) : undefined)
  return places.map((p) => {
    const lead = mapPagePlaceLead(p, focus)
    const { color } = mapPagePinColors(lead, lead.kind === 'bid' ? focus(lead) : undefined)
    return {
      id: p.key,
      lat: p.lat,
      lng: p.lng,
      color,
      ringColor: mapPagePlaceRing(p, focus),
      label: placeBadge(p.items.length),
      title: p.items.length === 1 ? mapPagePinTitle(lead) : `${p.addressLabel} · ${placeCountWords(p.items)}`,
    }
  })
}

export type MapAnchor = { lat: number; lng: number } | null

export function placeMiles(place: { lat: number; lng: number }, anchor: MapAnchor): number | null {
  return anchor ? milesBetween(anchor, place) : null
}

/** "4 mi", "31 mi" — rounded; null without an office. */
export function placeMilesWords(miles: number | null): string | null {
  if (miles == null) return null
  return `${Math.round(miles).toLocaleString('en-US')} mi`
}

/** The places whose band is on; with no office every place is in. */
export function placesInBands<T extends MapPagePlaceSource>(places: readonly MapPagePlace<T>[], anchor: MapAnchor, on: DistanceBucketVisibility): MapPagePlace<T>[] {
  if (!anchor) return [...places]
  return places.filter((p) => {
    const b = distanceBucketFor(placeMiles(p, anchor))
    return b ? on[b] : true
  })
}

export type MapPageBand = { key: DistanceBucketKey; label: string; places: number; records: number; jobs: number; bids: number }

/** The three bands from the office, counted over the places the chips allow (before the band switches). */
export function mapPageBands<T extends MapPagePlaceSource>(places: readonly MapPagePlace<T>[], anchor: MapAnchor): MapPageBand[] {
  const bands = DISTANCE_BUCKETS.map((b) => ({ key: b.key, label: b.label, places: 0, records: 0, jobs: 0, bids: 0 }))
  if (!anchor) return bands
  for (const p of places) {
    const key = distanceBucketFor(placeMiles(p, anchor))
    const band = bands.find((b) => b.key === key)
    if (!band) continue
    band.places += 1
    band.records += p.items.length
    band.jobs += p.items.filter((i) => i.kind === 'job').length
    band.bids += p.items.filter((i) => i.kind === 'bid').length
  }
  return bands
}

export type NearestRow<T extends MapPagePlaceSource> = { place: MapPagePlace<T>; miles: number | null }

export const MAP_PAGE_NEAREST_ROWS = 12

/** The places nearest the office first (address order without one), capped; `more` is what the cap hid. */
export function mapPageNearest<T extends MapPagePlaceSource>(places: readonly MapPagePlace<T>[], anchor: MapAnchor, cap: number = MAP_PAGE_NEAREST_ROWS): { rows: NearestRow<T>[]; more: number } {
  const rows = places.map((place) => ({ place, miles: placeMiles(place, anchor) }))
  if (anchor) rows.sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity))
  else rows.sort((a, b) => a.place.addressLabel.localeCompare(b.place.addressLabel))
  return { rows: rows.slice(0, cap), more: Math.max(0, rows.length - cap) }
}

/** "612 places · 923 records" */
export function mapPageTotalsLine(places: readonly MapPagePlace<MapPagePlaceSource>[]): string {
  const records = places.reduce((n, p) => n + p.items.length, 0)
  return `${places.length.toLocaleString('en-US')} ${places.length === 1 ? 'place' : 'places'} · ${records.toLocaleString('en-US')} ${records === 1 ? 'record' : 'records'}`
}
