/**
 * The rail beside the Pipeline map (v2.3397): what the map knows but doesn't
 * say. Three distance buckets from the office (count · dollars still to
 * collect · how many jobs to ask) that double as pin filters, the
 * ask-for-money list — longest waiting first, then nearest — and the pinned
 * total. Everything here is read off the pins the card already has: no new
 * reads. A job an in kind deal pays (punch list #301) keeps its pin and its
 * place in a bucket's count, but its money is not to collect and it is never
 * on the ask list; the rail counts it apart and says one line.
 *
 * The bid map's rail lists nearest first because distance decides where you
 * drive. On the Pipeline the question is which invoice is oldest, so a 46-day
 * bill eight miles out comes before a 22-day bill next door. Miles are the
 * straight line from the office anchor — the same yardstick as the rings.
 *
 * Pure module — no React, no Supabase.
 */
import { milesBetween } from '../bids/bidBoardMap'
import { DISTANCE_BUCKETS, distanceBucketFor, formatMoneyCompact, type DistanceBucketKey, type DistanceBucketVisibility, type MapAnchor } from '../bids/bidBoardMapRail'
import type { JobsMapPin } from './jobsMap'
import { formatCurrencyNoCents } from './jobFormatting'
import { noInKindApart, type InKindApart } from '../inKind/inKindApart'

export { DEFAULT_DISTANCE_BUCKETS, DISTANCE_BUCKETS, type DistanceBucketKey, type DistanceBucketVisibility, type MapAnchor } from '../bids/bidBoardMapRail'

/** A bill this old reads amber on the rail. */
export const JOBS_MAP_LATE_DAYS = 30

/** Straight-line miles from the office; null without an anchor. */
export function jobsMapPinMiles(pin: Pick<JobsMapPin, 'lat' | 'lng'>, anchor: MapAnchor): number | null {
  if (!anchor) return null
  return milesBetween(anchor, pin)
}

/** Pins whose bucket is switched on; a pin with no miles at all is never filtered out. */
export function jobsMapPinsInBuckets(pins: readonly JobsMapPin[], anchor: MapAnchor, on: DistanceBucketVisibility): JobsMapPin[] {
  return pins.filter((p) => {
    const b = distanceBucketFor(jobsMapPinMiles(p, anchor))
    return b == null || on[b]
  })
}

/** A pin that belongs on the ask list: billed or ready to bill, not a bill the office gave up on, and not one an in kind deal pays. */
export function jobsMapPinAsks(pin: Pick<JobsMapPin, 'section'> & { uncollectible?: boolean; inKind?: boolean }): boolean {
  return !pin.uncollectible && !pin.inKind && (pin.section === 'billed' || pin.section === 'readyToBill')
}

export type JobsMapAskTone = 'collections' | 'late' | 'billed' | 'ready'

/** `Billed 46 d` (red in Collections, amber past 30 days) · `Billed` (no date) · `Ready to bill`. */
export function jobsMapAskLabel(pin: Pick<JobsMapPin, 'section' | 'inCollections' | 'billedAgeDays'>): { text: string; tone: JobsMapAskTone } {
  if (pin.section === 'readyToBill') return { text: 'Ready to bill', tone: 'ready' }
  const text = pin.billedAgeDays != null ? `Billed ${pin.billedAgeDays} d` : 'Billed'
  if (pin.inCollections) return { text, tone: 'collections' }
  if (pin.billedAgeDays != null && pin.billedAgeDays >= JOBS_MAP_LATE_DAYS) return { text, tone: 'late' }
  return { text, tone: 'billed' }
}

export interface JobsMapBucketStat {
  key: DistanceBucketKey
  label: string
  count: number
  toCollectDollars: number
  toCollectLabel: string
  /** Billed + ready-to-bill pins in the bucket. */
  toAsk: number
}

export interface JobsMapAskRow {
  pin: JobsMapPin
  miles: number | null
  milesLabel: string
  label: string
  tone: JobsMapAskTone
}

export interface JobsMapRailModel {
  buckets: JobsMapBucketStat[]
  /** Billed and ready-to-bill pins: longest waiting first, then nearest; capped. */
  ask: JobsMapAskRow[]
  askMore: number
  pinnedCount: number
  toCollectDollars: number
  toCollectLabel: string
  /** Pinned jobs an in kind deal pays (punch list #301): in no bucket's dollars, on no ask list, counted here. */
  inKind: InKindApart
}

/** The rail's line on the jobs it left out of *to collect*: `$13,858 on 8 jobs is scheduled in kind, not money to collect`. Null with none. */
export function jobsMapInKindLine(inKind: InKindApart): string | null {
  if (inKind.count <= 0) return null
  return `$${formatCurrencyNoCents(inKind.dollars)} on ${inKind.count} ${inKind.count === 1 ? 'job' : 'jobs'} is scheduled in kind, not money to collect`
}

export const RAIL_ASK_ROWS = 5

/** `12 to ask for` / `1 to ask for` — the bucket's second figure. */
export function bucketAskLine(s: Pick<JobsMapBucketStat, 'toAsk'>): string | null {
  return s.toAsk > 0 ? `${s.toAsk} to ask` : null
}

export function jobsMapRail(pins: readonly JobsMapPin[], anchor: MapAnchor, opts: { askRows?: number } = {}): JobsMapRailModel {
  const stats = new Map<DistanceBucketKey, JobsMapBucketStat>(
    DISTANCE_BUCKETS.map((b) => [b.key, { key: b.key, label: b.label, count: 0, toCollectDollars: 0, toCollectLabel: '$0', toAsk: 0 }]),
  )
  let total = 0
  const inKind = noInKindApart()
  const ask: JobsMapAskRow[] = []
  for (const p of pins) {
    const miles = jobsMapPinMiles(p, anchor)
    total += p.owedDollars
    if ((p.inKindDollars ?? 0) > 0) {
      inKind.count += 1
      inKind.dollars += p.inKindDollars ?? 0
    }
    const key = distanceBucketFor(miles)
    if (key) {
      const s = stats.get(key)!
      s.count += 1
      s.toCollectDollars += p.owedDollars
      if (jobsMapPinAsks(p)) s.toAsk += 1
    }
    if (jobsMapPinAsks(p)) {
      const { text, tone } = jobsMapAskLabel(p)
      ask.push({ pin: p, miles, milesLabel: miles == null ? '— mi' : `${Math.round(miles)} mi`, label: text, tone })
    }
  }
  for (const s of stats.values()) s.toCollectLabel = formatMoneyCompact(s.toCollectDollars)
  // Longest waiting first (a bill with no date sorts after every dated one), then nearest, then the label.
  const age = (r: JobsMapAskRow) => r.pin.billedAgeDays ?? -1
  ask.sort((a, b) => age(b) - age(a) || (a.miles ?? Number.POSITIVE_INFINITY) - (b.miles ?? Number.POSITIVE_INFINITY) || a.pin.label.localeCompare(b.pin.label))
  const cap = opts.askRows ?? RAIL_ASK_ROWS
  return {
    buckets: DISTANCE_BUCKETS.map((b) => stats.get(b.key)!),
    ask: ask.slice(0, cap),
    askMore: Math.max(0, ask.length - cap),
    pinnedCount: pins.length,
    toCollectDollars: total,
    toCollectLabel: formatMoneyCompact(total),
    inKind: { count: inKind.count, dollars: Math.round(inKind.dollars * 100) / 100 },
  }
}
