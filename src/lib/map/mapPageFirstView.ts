/**
 * The Map page's first view (v2.4791, Map page refresh PR 1). Pure.
 *
 * The page used to fit the map to every pin, so one job geocoded to the
 * wrong continent opened the map on open ocean. Now the office anchor is the
 * home: the first view frames the office, its 50 mile ring and the pins
 * inside it (the Bid Board map's home fit), and a pin more than
 * `MAP_PAGE_FAR_MILES` from the office is still drawn but never fitted — it
 * is listed under the map instead, by address with its distance and count,
 * because it is either a far job (the company has worked a thousand miles
 * out) or a wrong address, and only a person can say which. With no office
 * anchor nothing is far and everything is fitted.
 */
import { BID_BOARD_MAP_HOME_FIT_MILES, bidBoardMapHomeFitPoints, milesBetween } from '../bids/bidBoardMap'
import type { MapPoint } from './mapPointsBounds'

/** Beyond this many miles from the office a pin is out of every fit: a far job or a wrong address. */
export const MAP_PAGE_FAR_MILES = 300

/** The first view frames the office and this ring, as the Bid Board map does. */
export const MAP_PAGE_HOME_FIT_MILES = BID_BOARD_MAP_HOME_FIT_MILES

export type FarFromOffice<T> = { item: T; miles: number }

export type NearAndFar<T> = { near: T[]; far: FarFromOffice<T>[] }

/** Split pins by distance from the office; with no anchor every pin is near. Far pins come back farthest first. */
export function splitFarFromOffice<T extends MapPoint>(
  pins: readonly T[],
  anchor: MapPoint | null,
  maxMiles: number = MAP_PAGE_FAR_MILES,
): NearAndFar<T> {
  if (!anchor) return { near: [...pins], far: [] }
  const near: T[] = []
  const far: FarFromOffice<T>[] = []
  for (const p of pins) {
    const miles = milesBetween(anchor, p)
    if (miles > maxMiles) far.push({ item: p, miles })
    else near.push(p)
  }
  far.sort((a, b) => b.miles - a.miles)
  return { near, far }
}

/** What the first view frames: the near pins inside the home ring, the office and the ring itself. */
export function mapPageHomeFitPoints(near: readonly MapPoint[], anchor: MapPoint | null): MapPoint[] {
  return bidBoardMapHomeFitPoints(near, anchor, MAP_PAGE_HOME_FIT_MILES)
}

/** What Fit all frames: every near pin and the office. Far pins stay out — they are wrong addresses, not far jobs. */
export function mapPageFitAllPoints(near: readonly MapPoint[], anchor: MapPoint | null): MapPoint[] {
  const pts = near.map((p) => ({ lat: p.lat, lng: p.lng }))
  return anchor ? [...pts, { lat: anchor.lat, lng: anchor.lng }] : pts
}

/** "1,540 mi" */
export function farMilesWords(miles: number): string {
  return `${Math.round(miles).toLocaleString('en-US')} mi`
}

export type FarPlace<T> = { addressKey: string; addressLabel: string; lat: number; lng: number; miles: number; items: T[] }

/** The far pins by address, farthest first — one line per address, not one per record. */
export function farFromOfficePlaces<T extends MapPoint & { addressKey: string; addressLabel: string }>(far: readonly FarFromOffice<T>[]): FarPlace<T>[] {
  const byKey = new Map<string, FarPlace<T>>()
  for (const { item, miles } of far) {
    const got = byKey.get(item.addressKey)
    if (got) got.items.push(item)
    else byKey.set(item.addressKey, { addressKey: item.addressKey, addressLabel: item.addressLabel, lat: item.lat, lng: item.lng, miles, items: [item] })
  }
  return [...byKey.values()].sort((a, b) => b.miles - a.miles)
}

/** "29 jobs", "1 bid", "2 jobs · 1 estimate" — in the order jobs, bids, estimates. */
export function farPlaceCountWords(items: readonly { kind: 'job' | 'bid' | 'estimate' }[]): string {
  const words: string[] = []
  for (const kind of ['job', 'bid', 'estimate'] as const) {
    const n = items.filter((i) => i.kind === kind).length
    if (n > 0) words.push(`${n} ${kind}${n === 1 ? '' : 's'}`)
  }
  return words.join(' · ')
}

/** The line over the far list. Empty when none. */
export function farFromOfficeLine(placeCount: number, maxMiles: number = MAP_PAGE_FAR_MILES): string {
  if (placeCount <= 0) return ''
  const miles = maxMiles.toLocaleString('en-US')
  if (placeCount === 1) return `1 address is more than ${miles} miles from the office. The map draws it but never frames it.`
  return `${placeCount} addresses are more than ${miles} miles from the office. The map draws them but never frames them.`
}
