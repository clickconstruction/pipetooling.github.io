/**
 * Bids → Pricing: "Bids like this" (v2.4418) — the pure half of the record block in region P2
 * of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. It asks what happened to decided bids
 * like the one on screen, from what every decided bid has: a price, an outcome, a loss reason
 * and a GC. The estimated-margin slice (`pricingMarginHistory`) is the third fact, and the
 * only one that needs a cost estimate.
 *
 * "This size" is half to double the price on the Workbench. A bid whose GC lost the project
 * was never ours to win, so it is counted apart from the bids decided on our number.
 */
import { BID_LOSS_CATEGORIES } from '../bidLossCategories'
import { isPriceLoss, pricingMarginHistoryView, type MarginHistoryTone, type PricingMarginHistoryView } from './pricingMarginHistory'
import type { BidPricingHistoryRow } from '../../types/database-functions'

/** A past bid is "this size" from the price ÷ this to the price × this. */
export const LIKE_THIS_SIZE_FACTOR = 2
/** The named list stops here; the rest is a count. */
export const LIKE_THIS_LIST_MAX = 6
/** A GC's name is cut to this many characters on the folded line. */
export const LIKE_THIS_GC_NAME_MAX = 28

export type LikeThisTone = MarginHistoryTone | 'bad'
export type LikeThisChip = { text: string; tone: LikeThisTone }

export type LikeThisTally = {
  total: number
  won: number
  lostPrice: number
  /** Lost because the GC lost the project. */
  gcLost: number
  /** Every other loss: another sub, the project died, no answer, never finished, no reason. */
  other: number
  /** What `other` is made of, largest first. */
  otherReasons: { label: string; count: number }[]
}

export type LikeThisRow = {
  bidId: string
  name: string
  value: number
  outcome: 'won' | 'lostPrice'
  /** "low bid $112,000 · we were 2.0× the low"; null with no recorded tab. */
  tabNote: string | null
}

export type BidsLikeThisView = {
  size: {
    low: number
    high: number
    tally: LikeThisTally
    /** Won or lost on price, closest in size first, at most `LIKE_THIS_LIST_MAX`. */
    rows: LikeThisRow[]
    /** Won or lost on price beyond the list. */
    moreRows: number
    chip: LikeThisChip
  } | null
  gc: { tally: LikeThisTally; chip: LikeThisChip; sentence: string | null } | null
  margin: (PricingMarginHistoryView & { chip: LikeThisChip | null }) | null
}

/** $950, $115k, $1.2M — the size band's ends. */
export function formatCompactDollars(n: number): string {
  const v = Math.abs(n)
  if (v >= 999_500) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

const wholeDollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** How our number stood against a recorded tab's low; null with no tab. */
export function tabLowNote(bidValue: number, tabLow: number | null | undefined): string | null {
  if (tabLow == null || tabLow <= 0 || bidValue <= 0) return null
  const ratio = bidValue / tabLow
  const head = `low bid ${wholeDollars(tabLow)}`
  if (ratio <= 1.005) return `${head} · we were the low`
  if (ratio < 2) return `${head} · we were ${Math.round((ratio - 1) * 100)}% over`
  return `${head} · we were ${ratio.toFixed(1)}× the low`
}

/** Outcomes of a set of decided bids: won, lost on price, the GC lost the project, the rest. */
export function tallyDecidedBids(rows: readonly BidPricingHistoryRow[]): LikeThisTally {
  const tally: LikeThisTally = { total: rows.length, won: 0, lostPrice: 0, gcLost: 0, other: 0, otherReasons: [] }
  const reasons = new Map<string, number>()
  for (const h of rows) {
    if (h.outcome === 'won') tally.won += 1
    else if (isPriceLoss(h)) tally.lostPrice += 1
    else if (h.loss_category === 'gc_lost') tally.gcLost += 1
    else {
      tally.other += 1
      const label = BID_LOSS_CATEGORIES.find((c) => c.key === h.loss_category)?.label ?? 'No reason recorded'
      reasons.set(label, (reasons.get(label) ?? 0) + 1)
    }
  }
  tally.otherReasons = [...reasons.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return tally
}

/** "1 won, 5 lost on price, 10 the GC lost the project, 1 other" — the parts that are not zero. */
export function tallyParts(t: LikeThisTally): string[] {
  const parts: string[] = []
  if (t.won > 0) parts.push(`${t.won} won`)
  if (t.lostPrice > 0) parts.push(`${t.lostPrice} lost on price`)
  if (t.gcLost > 0) parts.push(`${t.gcLost} the GC lost the project`)
  if (t.other > 0) parts.push(`${t.other} other`)
  return parts
}

function sizeChip(t: LikeThisTally): LikeThisChip {
  if (t.won + t.lostPrice === 0) return { text: `This size · ${t.total} decided, none on price`, tone: 'neutral' }
  const tone: LikeThisTone = t.lostPrice > t.won ? 'bad' : t.won > t.lostPrice ? 'good' : 'neutral'
  return { text: `This size · ${t.won} won · ${t.lostPrice} lost on price`, tone }
}

/**
 * Everything the block draws, or null when it stays away: no decided bid this size, none for
 * this GC and no margin to place among the past ones. The bid on screen never counts.
 */
export function bidsLikeThisView(args: {
  history: readonly BidPricingHistoryRow[] | null
  currentBidId: string | null | undefined
  /** The Workbench's effective revenue — previews included. */
  currentPrice: number | null
  /** The Workbench's effective margin, a fraction. */
  currentMargin: number | null
  gcCustomerId: string | null
  /**
   * The GC's name as the bid shows it. The chip says the name, not "This GC": a bid filed under
   * a catch-all customer (a plan room, say) then reads as that bucket, not as one builder.
   */
  gcName?: string | null
}): BidsLikeThisView | null {
  const { history, currentBidId, currentPrice, currentMargin, gcCustomerId } = args
  const gcName = args.gcName?.trim() || null
  const gcShort = gcName ? (gcName.length > LIKE_THIS_GC_NAME_MAX ? `${gcName.slice(0, LIKE_THIS_GC_NAME_MAX - 1).trimEnd()}…` : gcName) : 'This GC'
  if (!history || history.length === 0) return null
  const others = history.filter((h) => h.bid_id !== currentBidId && h.bid_value > 0)

  let size: BidsLikeThisView['size'] = null
  if (currentPrice != null && currentPrice > 0) {
    const low = currentPrice / LIKE_THIS_SIZE_FACTOR
    const high = currentPrice * LIKE_THIS_SIZE_FACTOR
    const inBand = others.filter((h) => h.bid_value >= low && h.bid_value <= high)
    if (inBand.length > 0) {
      const tally = tallyDecidedBids(inBand)
      const onNumber = inBand
        .filter((h) => h.outcome === 'won' || isPriceLoss(h))
        .sort((a, b) => Math.abs(Math.log(a.bid_value / currentPrice)) - Math.abs(Math.log(b.bid_value / currentPrice)))
      size = {
        low,
        high,
        tally,
        rows: onNumber.slice(0, LIKE_THIS_LIST_MAX).map((h) => ({
          bidId: h.bid_id,
          name: h.project_name?.trim() || '—',
          value: h.bid_value,
          outcome: h.outcome === 'won' ? 'won' : 'lostPrice',
          tabNote: tabLowNote(h.bid_value, h.bid_tab_low),
        })),
        moreRows: Math.max(0, onNumber.length - LIKE_THIS_LIST_MAX),
        chip: sizeChip(tally),
      }
    }
  }

  const marginView = pricingMarginHistoryView({ history, currentBidId, currentMargin, gcCustomerId })
  const margin: BidsLikeThisView['margin'] = marginView
    ? {
        ...marginView,
        chip: marginView.verdict && currentMargin != null ? { text: `${Math.round(currentMargin * 100)}% · ${marginView.verdict.chip}`, tone: marginView.verdict.tone } : null,
      }
    : null

  let gc: BidsLikeThisView['gc'] = null
  if (gcCustomerId) {
    const tally = tallyDecidedBids(others.filter((h) => (h.customer_id ?? null) === gcCustomerId))
    if (tally.total > 0) {
      gc = {
        tally,
        chip: { text: `${gcShort} · ${tally.won} won of ${tally.total}`, tone: 'neutral' },
        sentence: `With ${gcName ?? 'this GC'}: ${tally.total} decided bid${tally.total === 1 ? '' : 's'}. ${tallyParts(tally).join(', ')}.`,
      }
    } else if (size || margin?.chip) {
      // A first decided bid is a fact worth a chip only beside one of the other two chips.
      gc = { tally, chip: { text: `${gcShort} · no decided bids yet`, tone: 'neutral' }, sentence: null }
    }
  }

  // No chip, no block: a bid with no price yet has nothing to be compared with (v2.4425).
  if (!size && !gc && !margin?.chip) return null
  return { size, gc, margin }
}
