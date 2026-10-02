/**
 * Bids → Pricing: the estimated-margin slice of "Bids like this" (Workbench iteration 3; bid
 * tabs v2.2085; the fitted scale and the plain verdict v2.4418) — region P2 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. Margins here are estimates: a past bid's
 * value against its stored cost estimate, no clocked labor.
 *
 * The slice shows only with three or more past bids that were won or lost on price and carry
 * a usable cost estimate. The scale fits what it draws, in tens.
 */
import { countTabsMatchedOrBeaten, marginPctToMatchTabLow } from '../bidTabCapture'
import type { BidPricingHistoryRow } from '../../types/database-functions'

/** The scale never runs past these, whatever it has to draw. */
export const MARGIN_HISTORY_SCALE_FLOOR = -20
export const MARGIN_HISTORY_SCALE_CEILING = 100
/** The scale is never narrower than this many points. */
export const MARGIN_HISTORY_SCALE_MIN_SPAN = 30
/** Fewer won + lost-on-price bids than this and the slice stays away. */
export const MARGIN_HISTORY_MIN_BIDS = 3
/** Fewer dots than this and the slice says its evidence is thin. */
export const MARGIN_HISTORY_THIN_BELOW = 10
/** Half a point of tolerance wherever a margin is compared with a past bid's. */
const TOLERANCE = 0.5

export type MarginHistoryBid = BidPricingHistoryRow & { /** Estimated margin, a fraction. */ m: number }
export type MarginHistoryTabMark = { label: string; matchPct: number; customerId: string | null }
export type MarginHistoryTone = 'good' | 'warn' | 'neutral'
export type MarginHistoryVerdict = {
  /** The few words on the folded line, after the margin itself: "above your one win". */
  chip: string
  /** The full sentences under the scale. */
  sentence: string
  tone: MarginHistoryTone
}
export type MarginHistoryScale = { min: number; max: number; ticks: number[] }

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
  /** Fitted to every dot, every tab mark and the current margin. */
  scale: MarginHistoryScale
  /** Every past bid won or lost on price, with a usable cost estimate or not. */
  decidedOnNumber: number
  /** True while the dots are too few to lean on. */
  thin: boolean
}

/** A past bid's estimated margin as a fraction; null when it has no value to divide by. */
export function marginOfHistoryRow(h: Pick<BidPricingHistoryRow, 'bid_value' | 'est_cost'>): number | null {
  return h.bid_value > 0 ? (h.bid_value - h.est_cost) / h.bid_value : null
}

/**
 * A loss on price: the structured category when one is recorded (any surface's tapped reason
 * counts). The free-text regex is the fallback for a loss with no category, from before
 * categories existed — a recorded category is never overruled by a word in the note.
 */
export function isPriceLoss(h: Pick<BidPricingHistoryRow, 'outcome' | 'loss_category' | 'loss_reason'>): boolean {
  if (h.outcome !== 'lost') return false
  const category = h.loss_category ?? null
  return category ? category === 'price' : /price/i.test(h.loss_reason ?? '')
}

/**
 * The scale that fits a set of margins (percent): padded two points, snapped out to tens, held
 * inside −20…100 and never narrower than thirty points. Ticks every ten, every twenty once the
 * scale is wider than sixty.
 */
export function marginHistoryScale(pcts: readonly number[]): MarginHistoryScale {
  const clamp = (v: number) => Math.min(MARGIN_HISTORY_SCALE_CEILING, Math.max(MARGIN_HISTORY_SCALE_FLOOR, v))
  const usable = pcts.filter((p) => Number.isFinite(p)).map(clamp)
  let min = usable.length ? Math.floor((Math.min(...usable) - 2) / 10) * 10 : 20
  let max = usable.length ? Math.ceil((Math.max(...usable) + 2) / 10) * 10 : 50
  min = clamp(min)
  max = clamp(max)
  while (max - min < MARGIN_HISTORY_SCALE_MIN_SPAN) {
    if (max < MARGIN_HISTORY_SCALE_CEILING) max += 10
    if (max - min < MARGIN_HISTORY_SCALE_MIN_SPAN && min > MARGIN_HISTORY_SCALE_FLOOR) min -= 10
  }
  const step = max - min > 60 ? 20 : 10
  const ticks: number[] = []
  for (let t = min; t <= max; t += step) ticks.push(t)
  return { min, max, ticks }
}

/** Where a margin sits on a fitted scale, as a CSS `left`; a mark outside it draws at the nearer end. */
export function marginHistoryScaleLeft(mPct: number, scale: Pick<MarginHistoryScale, 'min' | 'max'>): string {
  const clamped = Math.min(scale.max, Math.max(scale.min, mPct))
  return `${((clamped - scale.min) / (scale.max - scale.min)) * 100}%`
}

const bidsWord = (n: number) => `${n} bid${n === 1 ? '' : 's'}`

/** "at 84%" for one margin, "at 79–95%" for a spread. */
function atRange(pcts: readonly number[]): string {
  const lo = Math.round(Math.min(...pcts))
  const hi = Math.round(Math.max(...pcts))
  return lo === hi ? `at ${lo}%` : `at ${lo}–${hi}%`
}

/**
 * Where the current margin stands against the wins and the price losses (half a point of
 * tolerance): above every win, below every win, or among them. It never calls a margin below
 * every win a "winning range".
 */
export function marginHistoryVerdict(currentMargin: number | null, won: readonly MarginHistoryBid[], lostPrice: readonly MarginHistoryBid[]): MarginHistoryVerdict | null {
  if (currentMargin == null) return null
  const cur = currentMargin * 100
  const c = Math.round(cur)
  const wins = won.map((h) => h.m * 100)
  const losses = lostPrice.map((h) => h.m * 100)
  if (wins.length === 0 && losses.length === 0) return null
  const lossesAtOrBelow = losses.filter((l) => l <= cur + TOLERANCE).length
  const lossTail = lossesAtOrBelow > 0 ? ` ${bidsWord(lossesAtOrBelow)} lost on price at or below it.` : ' No bid lost on price this low.'

  if (wins.length === 0) {
    const minLoss = Math.min(...losses)
    if (cur >= minLoss - TOLERANCE) {
      return { chip: 'where bids lost on price', sentence: `No win has a usable cost estimate. ${bidsWord(lossesAtOrBelow)} lost on price at or below ${c}%.`, tone: 'warn' }
    }
    return { chip: 'below every price loss', sentence: `No win has a usable cost estimate. Every price loss was above ${c}% (lowest ${Math.round(minLoss)}%).`, tone: 'neutral' }
  }

  const one = wins.length === 1
  const maxWon = Math.max(...wins)
  const minWon = Math.min(...wins)
  if (cur > maxWon + TOLERANCE) {
    const lossPart = losses.length > 0 ? ` ${bidsWord(losses.length)} lost on price ${atRange(losses)}.` : ''
    return {
      chip: one ? 'above your one win' : `above all ${wins.length} wins`,
      sentence: `${c}% is above ${one ? `your one win (${Math.round(maxWon)}%)` : `every win (highest ${Math.round(maxWon)}%)`}.${lossPart}`,
      tone: 'warn',
    }
  }
  if (cur < minWon - TOLERANCE) {
    return {
      chip: one ? 'below your one win' : `below all ${wins.length} wins`,
      sentence: `${c}% is below ${one ? `your one win (${Math.round(minWon)}%)` : `every win (lowest ${Math.round(minWon)}%)`}.${lossTail}`,
      tone: lossesAtOrBelow > 0 ? 'warn' : 'neutral',
    }
  }
  if (one) {
    return { chip: 'level with your one win', sentence: `${c}% is level with your one win.${lossTail}`, tone: lossesAtOrBelow > 0 ? 'warn' : 'good' }
  }
  const winsAtOrAbove = wins.filter((w) => w >= cur - TOLERANCE).length
  return {
    chip: lossesAtOrBelow > 0 ? 'wins and price losses here' : 'in your winning range',
    sentence: `${winsAtOrAbove} of ${wins.length} wins were priced at ${c}% or higher.${lossTail}`,
    tone: lossesAtOrBelow > 0 ? 'warn' : 'good',
  }
}

/**
 * Everything the margin slice draws, or null when it stays away: no history, or fewer than
 * three past bids won or lost on price with a usable cost estimate. The bid on screen and bids
 * with no cost estimate never count; a margin outside −20 %…95 % is a barely-filled estimate
 * and is left out.
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
  const others = history.filter((h) => h.bid_id !== currentBidId)
  const usable = others
    .filter((h) => h.est_cost > 0)
    .map((h) => ({ ...h, m: marginOfHistoryRow(h) }))
    .filter((h): h is MarginHistoryBid => h.m != null && h.m > -0.2 && h.m < 0.95)
  const won = usable.filter((h) => h.outcome === 'won')
  const lostPrice = usable.filter(isPriceLoss)
  // Recorded bid tabs (v2.2085) → "the margin that would have matched that tab's low".
  const tabMarks: MarginHistoryTabMark[] = []
  for (const h of others) {
    if (h.est_cost <= 0) continue
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
    scale: marginHistoryScale([
      ...won.map((h) => h.m * 100),
      ...lostPrice.map((h) => h.m * 100),
      ...tabMarks.map((t) => t.matchPct),
      ...(currentMargin != null ? [currentMargin * 100] : []),
    ]),
    decidedOnNumber: others.filter((h) => h.outcome === 'won' || isPriceLoss(h)).length,
    thin: won.length + lostPrice.length < MARGIN_HISTORY_THIN_BELOW,
  }
}
