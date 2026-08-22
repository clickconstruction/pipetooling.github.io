/**
 * "Why we lose on price" Learn panel (v2.2085): turn the recorded bid tabs on
 * lost bids (v2.2081 capture) into the compare-and-learn rollup — median %
 * over the low, the delta and rank distributions, the quarterly trend, and
 * the per-GC table sorted by opportunity (closest first).
 *
 * Sibling of `bidTabCapture.ts` / `bidLossCategories.ts` (Followup-tab
 * kernels). Pure module — no React, no Supabase; callers pass `nowIso` so
 * tests stay deterministic.
 */

import type { BidTabValues } from './bidTabCapture'

/** One lost bid as the Learn panel sees it (already estimator-scoped by the lens). */
export type BidLossLearnRow = {
  id: string
  builderKey: string
  builderName: string
  /** Our own bid value. */
  value: number
  /** `bids.bid_date_sent` (YYYY-MM-DD) — the time axis; null = undated. */
  sentIso: string | null
  tab: BidTabValues
}

export type BidLossLearnWindowKey = 'all' | '12' | '6'

export const BID_LOSS_LEARN_WINDOWS: readonly { key: BidLossLearnWindowKey; label: string; months: number | null }[] = [
  { key: 'all', label: 'All time', months: null },
  { key: '12', label: 'Last 12 mo', months: 12 },
  { key: '6', label: 'Last 6 mo', months: 6 },
]

/** % our value sits over the tab low; null when not meaningfully "over". */
export function overLowPct(value: number, low: number | null): number | null {
  if (low == null || low <= 0 || value <= low) return null
  return ((value - low) / low) * 100
}

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** "7.4%"-style display: whole numbers at ≥10, one decimal below. */
export function formatLearnPct(p: number): string {
  const rounded = p >= 10 ? Math.round(p) : Math.round(p * 10) / 10
  return `${rounded}%`
}

export type LearnBucket = { label: string; count: number }

const DELTA_BUCKETS: readonly { label: string; min: number; max: number }[] = [
  { label: '0–5%', min: 0, max: 5 },
  { label: '5–10%', min: 5, max: 10 },
  { label: '10–20%', min: 10, max: 20 },
  { label: '20%+', min: 20, max: Infinity },
]

export type LearnReadKey = 'razor' | 'close' | 'mid' | 'far'

export const LEARN_READ_LABELS: Record<LearnReadKey, string> = {
  razor: 'razor thin — one sharpen away',
  close: 'close — worth sharpening',
  mid: 'mid-pack',
  far: 'far off — check the cost base',
}

export function learnReadKey(medianPct: number): LearnReadKey {
  if (medianPct < 4) return 'razor'
  if (medianPct < 8) return 'close'
  if (medianPct < 12) return 'mid'
  return 'far'
}

export type LearnGcRow = {
  builderKey: string
  builderName: string
  tabs: number
  /** Median % over the low; null when every tab had us at/below the low. */
  medianPct: number | null
  /** Median rank from the bottom; null when no ranks recorded. */
  usualRank: number | null
  /** Our dollars on this GC's tabbed lost bids. */
  dollars: number
  read: LearnReadKey | null
}

export type LearnQuarter = { label: string; medianPct: number; count: number }

export type BidLossLearnStats = {
  /** Lost bids with a recorded tab low, inside the window. */
  tabbedCount: number
  /** All lost bids inside the window (the coverage denominator). */
  lostCount: number
  medianPct: number | null
  p25: number | null
  p75: number | null
  /** Lost bids where we were AT or BELOW the low (rank 1 or value ≤ low) — price wasn't the reason. */
  lowBidLossCount: number
  deltaBuckets: LearnBucket[]
  /** Rank-from-the-bottom distribution; '#1' appears only when it happened. */
  rankBuckets: LearnBucket[]
  /** Chronological, up to the last 6 quarters that have data. */
  quarters: LearnQuarter[]
  /** Sorted closest-first (null medians last). */
  gcRows: LearnGcRow[]
}

function quarterLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return '?'
  const q = Math.floor((Number(m[2]) - 1) / 3) + 1
  return `Q${q} '${m[1]!.slice(2)}`
}

function quarterSortKey(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return '0000-0'
  return `${m[1]}-${Math.floor((Number(m[2]) - 1) / 3) + 1}`
}

function withinWindow(sentIso: string | null, months: number | null, nowIso: string): boolean {
  if (months == null) return true
  if (!sentIso) return false
  const cutoff = new Date(nowIso)
  cutoff.setMonth(cutoff.getMonth() - months)
  return sentIso >= cutoff.toISOString().slice(0, 10)
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}

export function buildBidLossLearnStats(
  rows: readonly BidLossLearnRow[],
  windowKey: BidLossLearnWindowKey,
  nowIso: string,
): BidLossLearnStats {
  const months = BID_LOSS_LEARN_WINDOWS.find((w) => w.key === windowKey)?.months ?? null
  const scoped = rows.filter((r) => withinWindow(r.sentIso, months, nowIso))
  const tabbed = scoped.filter((r) => r.tab.low != null && r.tab.low > 0)

  const deltas: number[] = []
  let lowBidLossCount = 0
  for (const r of tabbed) {
    const d = overLowPct(r.value, r.tab.low)
    if (d != null) deltas.push(d)
    else if (r.tab.rankFromLow === 1 || (r.value > 0 && r.tab.low != null && r.value <= r.tab.low)) lowBidLossCount += 1
  }
  const sortedDeltas = [...deltas].sort((a, b) => a - b)

  const deltaBuckets = DELTA_BUCKETS.map((b) => ({
    label: b.label,
    count: deltas.filter((d) => d >= b.min && d < b.max).length,
  }))

  const ranks = tabbed.map((r) => r.tab.rankFromLow).filter((n): n is number => n != null && n >= 1)
  const rankBuckets: LearnBucket[] = []
  const rank1 = ranks.filter((n) => n === 1).length
  if (rank1 > 0) rankBuckets.push({ label: '#1', count: rank1 })
  rankBuckets.push(
    { label: '#2', count: ranks.filter((n) => n === 2).length },
    { label: '#3', count: ranks.filter((n) => n === 3).length },
    { label: '#4', count: ranks.filter((n) => n === 4).length },
    { label: '#5+', count: ranks.filter((n) => n >= 5).length },
  )

  const byQuarter = new Map<string, { label: string; deltas: number[] }>()
  for (const r of tabbed) {
    if (!r.sentIso) continue
    const d = overLowPct(r.value, r.tab.low)
    if (d == null) continue
    const key = quarterSortKey(r.sentIso)
    let q = byQuarter.get(key)
    if (!q) {
      q = { label: quarterLabel(r.sentIso), deltas: [] }
      byQuarter.set(key, q)
    }
    q.deltas.push(d)
  }
  const quarters = [...byQuarter.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([, q]) => ({ label: q.label, medianPct: median(q.deltas)!, count: q.deltas.length }))

  const byGc = new Map<string, { name: string; deltas: number[]; ranks: number[]; dollars: number; tabs: number }>()
  for (const r of tabbed) {
    let g = byGc.get(r.builderKey)
    if (!g) {
      g = { name: r.builderName, deltas: [], ranks: [], dollars: 0, tabs: 0 }
      byGc.set(r.builderKey, g)
    }
    g.tabs += 1
    g.dollars += Number.isFinite(r.value) ? r.value : 0
    const d = overLowPct(r.value, r.tab.low)
    if (d != null) g.deltas.push(d)
    if (r.tab.rankFromLow != null && r.tab.rankFromLow >= 1) g.ranks.push(r.tab.rankFromLow)
  }
  const gcRows: LearnGcRow[] = [...byGc.entries()]
    .map(([builderKey, g]) => {
      const m = median(g.deltas)
      const usual = median(g.ranks)
      return {
        builderKey,
        builderName: g.name,
        tabs: g.tabs,
        medianPct: m,
        usualRank: usual != null ? Math.round(usual) : null,
        dollars: g.dollars,
        read: m != null ? learnReadKey(m) : null,
      }
    })
    .sort((a, b) => {
      if (a.medianPct == null && b.medianPct == null) return b.dollars - a.dollars
      if (a.medianPct == null) return 1
      if (b.medianPct == null) return -1
      return a.medianPct - b.medianPct
    })

  return {
    tabbedCount: tabbed.length,
    lostCount: scoped.length,
    medianPct: median(deltas),
    p25: percentile(sortedDeltas, 0.25),
    p75: percentile(sortedDeltas, 0.75),
    lowBidLossCount,
    deltaBuckets,
    rankBuckets,
    quarters,
    gcRows,
  }
}
