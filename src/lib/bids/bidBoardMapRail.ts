/**
 * The rail beside the Bid Board map (v2.3206): what the map knows but doesn't
 * say. Three distance buckets from the office (count · value · due soon) that
 * double as pin filters, the unsent-and-due pins nearest first, and the
 * pinned total. Everything here is read off the pins the card already has —
 * no new reads.
 *
 * Miles: a bid's own Distance to Office when it has one (routed miles, the
 * number the estimator sees), else the straight line from the office anchor —
 * the same yardstick as the 25 / 50 mile rings.
 *
 * Pure module — no React, no Supabase.
 */
import { milesBetween, type BidBoardMapPin } from './bidBoardMap'

export type DistanceBucketKey = 'near' | 'mid' | 'far'

export const DISTANCE_BUCKETS: ReadonlyArray<{ key: DistanceBucketKey; label: string; maxMiles: number }> = [
  { key: 'near', label: '≤ 25 mi', maxMiles: 25 },
  { key: 'mid', label: '25–50 mi', maxMiles: 50 },
  { key: 'far', label: '50 mi +', maxMiles: Number.POSITIVE_INFINITY },
]

export type DistanceBucketVisibility = Record<DistanceBucketKey, boolean>
export const DEFAULT_DISTANCE_BUCKETS: DistanceBucketVisibility = { near: true, mid: true, far: true }

export type MapAnchor = { lat: number; lng: number } | null

/** The bid's routed miles when recorded, else the straight line from the office; null without either. */
export function pinMilesFromOffice(pin: Pick<BidBoardMapPin, 'distanceMiles' | 'lat' | 'lng'>, anchor: MapAnchor): number | null {
  if (pin.distanceMiles != null && Number.isFinite(pin.distanceMiles)) return pin.distanceMiles
  if (!anchor) return null
  return milesBetween(anchor, pin)
}

export function distanceBucketFor(miles: number | null): DistanceBucketKey | null {
  if (miles == null || !Number.isFinite(miles)) return null
  for (const b of DISTANCE_BUCKETS) if (miles <= b.maxMiles) return b.key
  return 'far'
}

/** Pins whose bucket is switched on; a pin with no miles at all is never filtered out. */
export function pinsInBuckets(pins: readonly BidBoardMapPin[], anchor: MapAnchor, on: DistanceBucketVisibility): BidBoardMapPin[] {
  return pins.filter((p) => {
    const b = distanceBucketFor(pinMilesFromOffice(p, anchor))
    return b == null || on[b]
  })
}

export function bidValueDollars(pin: Pick<BidBoardMapPin, 'row'>): number {
  const v = Number((pin.row as { bid_value?: number | string | null }).bid_value)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** `$9.1M` · `$820k` · `$4.5k` · `$0`. */
export function formatMoneyCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return `$${Math.round(n)}`
}

export interface DistanceBucketStat {
  key: DistanceBucketKey
  label: string
  count: number
  valueDollars: number
  valueLabel: string
  /** Unsent pins in the bucket wearing a due ring (due soon or overdue). */
  dueSoon: number
}

export interface DueRow {
  pin: BidBoardMapPin
  miles: number | null
  milesLabel: string
}

export interface BidBoardMapRailModel {
  buckets: DistanceBucketStat[]
  /** Unsent pins with a due date: ringed ones first, then nearest first; capped. */
  due: DueRow[]
  dueMore: number
  pinnedCount: number
  pinnedValueLabel: string
}

export const RAIL_DUE_ROWS = 5

export function bidBoardMapRail(pins: readonly BidBoardMapPin[], anchor: MapAnchor, opts: { dueRows?: number } = {}): BidBoardMapRailModel {
  const stats = new Map<DistanceBucketKey, DistanceBucketStat>(
    DISTANCE_BUCKETS.map((b) => [b.key, { key: b.key, label: b.label, count: 0, valueDollars: 0, valueLabel: '$0', dueSoon: 0 }]),
  )
  let total = 0
  const due: DueRow[] = []
  for (const p of pins) {
    const miles = pinMilesFromOffice(p, anchor)
    const value = bidValueDollars(p)
    total += value
    const key = distanceBucketFor(miles)
    if (key) {
      const s = stats.get(key)!
      s.count += 1
      s.valueDollars += value
      if (p.section === 'unsent' && p.dueTone) s.dueSoon += 1
    }
    if (p.section === 'unsent' && p.dueLabel) {
      due.push({ pin: p, miles, milesLabel: miles == null ? '— mi' : `${Math.round(miles)} mi` })
    }
  }
  for (const s of stats.values()) s.valueLabel = formatMoneyCompact(s.valueDollars)
  const rank = (d: DueRow) => (d.pin.dueTone === 'overdue' ? 0 : d.pin.dueTone === 'soon' ? 1 : 2)
  due.sort((a, b) => rank(a) - rank(b) || (a.miles ?? Number.POSITIVE_INFINITY) - (b.miles ?? Number.POSITIVE_INFINITY) || a.pin.label.localeCompare(b.pin.label))
  const cap = opts.dueRows ?? RAIL_DUE_ROWS
  return {
    buckets: DISTANCE_BUCKETS.map((b) => stats.get(b.key)!),
    due: due.slice(0, cap),
    dueMore: Math.max(0, due.length - cap),
    pinnedCount: pins.length,
    pinnedValueLabel: formatMoneyCompact(total),
  }
}

/** `3 due soon` · `1 overdue` — the bucket's second line, empty when none. */
export function bucketDueLine(s: Pick<DistanceBucketStat, 'dueSoon'>): string | null {
  return s.dueSoon > 0 ? `${s.dueSoon} due soon` : null
}
