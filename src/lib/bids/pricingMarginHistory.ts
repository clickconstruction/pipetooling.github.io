/**
 * Bids → Pricing: "This number vs your history" (Workbench iteration 3; bid tabs v2.2085) —
 * the pure half of the history block in region P2 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. Margins here are estimates: a past bid's
 * value against its stored cost estimate, no clocked labor.
 *
 * The block shows only with three or more past bids that were won or lost on price. The scale
 * runs 20 %–65 %; a mark outside it draws at the nearer end.
 */
import { countTabsMatchedOrBeaten, marginPctToMatchTabLow } from '../bidTabCapture'
import type { BidPricingHistoryRow } from '../../types/database-functions'

export const MARGIN_HISTORY_SCALE_MIN = 20
export const MARGIN_HISTORY_SCALE_MAX = 65
/** Fewer won + lost-on-price bids than this and the block stays away. */
export const MARGIN_HISTORY_MIN_BIDS = 3

export type MarginHistoryBid = BidPricingHistoryRow & { /** Estimated margin, a fraction. */ m: number }
export type MarginHistoryTabMark = { label: string; matchPct: number; customerId: string | null }
export type MarginHistoryVerdict = { text: string; color: string }

export type PricingMarginHistoryView = {
  won: MarginHistoryBid[]
  lostPrice: MarginHistoryBid[]
  /** Recorded bid tabs as "the margin that would have matched that tab's low". */
  tabMarks: MarginHistoryTabMark[]
  verdict: MarginHistoryVerdict | null
  /** How many recorded tab lows the current margin would have matched or beaten; null with no tabs or no margin. */
  tabsMatched: number | null
  /** This GC's own tabs, once there are two: the range of margins that matched their lows. */
  gcTabs: { count: number; lowPct: number; highPct: number } | null
}

/** A past bid's estimated margin as a fraction; null when it has no value to divide by. */
export function marginOfHistoryRow(h: Pick<BidPricingHistoryRow, 'bid_value' | 'est_cost'>): number | null {
  return h.bid_value > 0 ? (h.bid_value - h.est_cost) / h.bid_value : null
}

/** Where a margin sits on the 20–65 scale, as a CSS `left`. */
export function marginHistoryScaleLeft(mPct: number): string {
  const clamped = Math.min(MARGIN_HISTORY_SCALE_MAX, Math.max(MARGIN_HISTORY_SCALE_MIN, mPct))
  return `${((clamped - MARGIN_HISTORY_SCALE_MIN) / (MARGIN_HISTORY_SCALE_MAX - MARGIN_HISTORY_SCALE_MIN)) * 100}%`
}

/** Where the current margin stands against the wins and the price losses at or below it (half a point of tolerance). */
export function marginHistoryVerdict(currentMargin: number | null, won: readonly MarginHistoryBid[], lostPrice: readonly MarginHistoryBid[]): MarginHistoryVerdict | null {
  if (currentMargin == null) return null
  const curPct = currentMargin * 100
  const wonAtOrBelow = won.filter((h) => h.m * 100 <= curPct + 0.5).length
  const lossesAtOrBelow = lostPrice.filter((h) => h.m * 100 <= curPct + 0.5).length
  const maxWon = won.length ? Math.max(...won.map((h) => h.m * 100)) : null
  if (maxWon != null && curPct <= maxWon && lossesAtOrBelow === 0) {
    return { text: `In your winning range — ${wonAtOrBelow} of ${won.length} wins priced at or below ${Math.round(curPct)}% (estimated margins).`, color: 'var(--text-green-600)' }
  }
  if (maxWon != null && curPct <= maxWon) {
    return { text: `Mixed territory — wins exist here, but ${lossesAtOrBelow} price-loss${lossesAtOrBelow !== 1 ? 'es' : ''} sit at or below ${Math.round(curPct)}%.`, color: 'var(--text-amber-700)' }
  }
  if (maxWon != null) {
    return { text: `Above every recorded win (max ${Math.round(maxWon)}%) — ${lostPrice.length} bid${lostPrice.length !== 1 ? 's' : ''} lost on price in this range.`, color: 'var(--text-red-700)' }
  }
  return null
}

/**
 * Everything the block draws, or null when it stays away: no history, or fewer than three
 * past bids won or lost on price. The bid on screen and bids with no cost estimate never
 * count; a margin outside −20 %…95 % is a barely-filled estimate and is left out.
 */
export function pricingMarginHistoryView(args: {
  history: readonly BidPricingHistoryRow[] | null
  currentBidId: string | null | undefined
  /** The Workbench's effective margin, a fraction. */
  currentMargin: number | null
  /** The bid's GC — its own tabs get a line once there are two. */
  gcCustomerId: string | null
}): PricingMarginHistoryView | null {
  const { history, currentBidId, currentMargin, gcCustomerId } = args
  if (!history || history.length === 0) return null
  const usable = history
    .filter((h) => h.bid_id !== currentBidId && h.est_cost > 0)
    .map((h) => ({ ...h, m: marginOfHistoryRow(h) }))
    .filter((h): h is MarginHistoryBid => h.m != null && h.m > -0.2 && h.m < 0.95)
  const won = usable.filter((h) => h.outcome === 'won')
  // Structured category first (any surface's tapped reason counts); the
  // free-text regex stays as the pre-category-era fallback.
  const lostPrice = usable.filter((h) => h.outcome === 'lost' && ((h.loss_category ?? null) === 'price' || /price/i.test(h.loss_reason ?? '')))
  // Recorded bid tabs (v2.2085) → "the margin that would have matched that tab's low".
  const tabMarks: MarginHistoryTabMark[] = []
  for (const h of history) {
    if (h.bid_id === currentBidId || h.est_cost <= 0) continue
    const matchPct = marginPctToMatchTabLow(h.bid_tab_low ?? null, h.est_cost)
    // Same sanity band as the win/loss dots — a barely-filled cost estimate
    // would otherwise pin a meaningless mark to the scale's edge.
    if (matchPct != null && matchPct > -20 && matchPct < 95) tabMarks.push({ label: h.project_name ?? '—', matchPct, customerId: h.customer_id ?? null })
  }
  if (won.length + lostPrice.length < MARGIN_HISTORY_MIN_BIDS) return null

  const hasTabsLine = tabMarks.length > 0 && currentMargin != null
  const gcOwn = hasTabsLine && gcCustomerId ? tabMarks.filter((t) => t.customerId === gcCustomerId) : []
  const gcPcts = gcOwn.map((t) => Math.round(t.matchPct)).sort((a, b) => a - b)
  return {
    won,
    lostPrice,
    tabMarks,
    verdict: marginHistoryVerdict(currentMargin, won, lostPrice),
    tabsMatched: hasTabsLine ? countTabsMatchedOrBeaten(currentMargin * 100, tabMarks.map((t) => t.matchPct)) : null,
    gcTabs: gcPcts.length >= 2 ? { count: gcPcts.length, lowPct: gcPcts[0]!, highPct: gcPcts[gcPcts.length - 1]! } : null,
  }
}
