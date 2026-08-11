/**
 * Card-level aging presentation for the dashboard AR / AP / Not Billed Out
 * cards (v2.1562): turns the drill-down modals' `financeAgingBuckets` (same
 * kernel, same 0–14 / 15–30 / 30d+ bands) into the thin stacked aging bar and
 * the lead "at-risk" line each card shows. The uncolored remainder of the bar
 * is fresh or undated money — colored segments are aged dollars only, so the
 * card and its modal's aging strip always agree.
 */
import type { FinanceAgingBuckets, FinanceAgingTone } from './dashboardFinanceModalRows'

export type FinanceCardBarSegment = { tone: FinanceAgingTone; pct: number }

/** Stacked-bar segments as percentages of the card total (skips empty bands). */
export function financeCardBarSegments(
  buckets: FinanceAgingBuckets,
  total: number,
): FinanceCardBarSegment[] {
  if (!(total > 0)) return []
  const segments: FinanceCardBarSegment[] = []
  for (const tone of ['ok', 'warn', 'late'] as const) {
    const bandTotal = buckets[tone].total
    if (bandTotal > 0) segments.push({ tone, pct: Math.min(100, (bandTotal / total) * 100) })
  }
  return segments
}

export type FinanceCardRisk = { tone: 'late' | 'warn'; amount: number } | { tone: 'none' }

/** The card's lead risk figure: 30d+ money first, else 15–30d money, else nothing aged. */
export function financeCardRisk(buckets: FinanceAgingBuckets): FinanceCardRisk {
  if (buckets.late.total > 0) return { tone: 'late', amount: buckets.late.total }
  if (buckets.warn.total > 0) return { tone: 'warn', amount: buckets.warn.total }
  return { tone: 'none' }
}
