/**
 * Bid tab capture (v2.2081): parse and validate the numbers a GC reads off a
 * bid tab — low bid, high bid, our rank counting from the bottom, and an
 * optional bidder count — then derive the learnable insight (% over the low,
 * position label, sanity flags) and the `bids` patch + history note a save
 * writes. Rank counts from the LOW bid because that's how tabs get read on
 * the phone: #1 = we were the low bid.
 *
 * Sibling of `bidLossCategories.ts` / `bidPendingChase.ts` (Followup-tab
 * kernels). Pure module — no React, no Supabase.
 */

/** The four captured numbers; null = not shared / not entered. */
export type BidTabValues = {
  low: number | null
  high: number | null
  rankFromLow: number | null
  bidderCount: number | null
}

export const EMPTY_BID_TAB_VALUES: BidTabValues = { low: null, high: null, rankFromLow: null, bidderCount: null }

/** Structural row shape — matches the bids columns from 20260822062831_bid_tab_capture. */
export type BidTabRow = {
  bid_tab_low: number | null
  bid_tab_high: number | null
  bid_tab_rank_from_low: number | null
  bid_tab_bidder_count: number | null
}

export function bidTabValuesFromRow(row: Partial<BidTabRow>): BidTabValues {
  return {
    low: row.bid_tab_low ?? null,
    high: row.bid_tab_high ?? null,
    rankFromLow: row.bid_tab_rank_from_low ?? null,
    bidderCount: row.bid_tab_bidder_count ?? null,
  }
}

export function hasAnyBidTabValue(v: BidTabValues): boolean {
  return v.low != null || v.high != null || v.rankFromLow != null || v.bidderCount != null
}

/**
 * Parse a money amount as spoken on a call: "230k", "1.2m", "$230,000",
 * "230000". Returns null for blank or unparseable text and for non-positive
 * amounts (a $0 low bid is a typo, not data).
 */
export function parseTabMoney(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, '')
  if (!t) return null
  const m = /^(\d+(?:\.\d+)?)([km]?)$/.exec(t)
  if (!m) return null
  const base = parseFloat(m[1]!)
  if (!Number.isFinite(base) || base <= 0) return null
  const mult = m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1
  return base * mult
}

/** Parse a small positive whole number ("2", " 6 "); null for blank/garbage/zero. */
export function parseTabCount(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  return n >= 1 ? n : null
}

export type BidTabParseResult = {
  values: BidTabValues
  /** Human-readable problems; empty = save away. */
  errors: string[]
}

/**
 * Parse the four capture fields together and cross-check them. Blank fields
 * are fine (partial tabs are worth keeping); non-blank text that doesn't
 * parse, or numbers that contradict each other, are errors.
 */
export function parseBidTabCapture(input: {
  lowText: string
  highText: string
  rankText: string
  countText: string
}): BidTabParseResult {
  const errors: string[] = []
  const low = parseTabMoney(input.lowText)
  if (input.lowText.trim() && low == null) errors.push('Low bid isn’t a number — try "230k" or "230,000".')
  const high = parseTabMoney(input.highText)
  if (input.highText.trim() && high == null) errors.push('High bid isn’t a number — try "310k" or "310,000".')
  const rankFromLow = parseTabCount(input.rankText)
  if (input.rankText.trim() && rankFromLow == null) errors.push('"We were #" needs a whole number (1 = we were the low bid).')
  const bidderCount = parseTabCount(input.countText)
  if (input.countText.trim() && bidderCount == null) errors.push('Bid count needs a whole number.')

  if (low != null && high != null && low > high) errors.push('Low bid is higher than the high bid — swap them?')
  if (rankFromLow != null && bidderCount != null && rankFromLow > bidderCount)
    errors.push(`#${rankFromLow} from the bottom doesn’t fit on a tab of ${bidderCount} bids.`)

  return { values: { low, high, rankFromLow, bidderCount }, errors }
}

function pct(over: number, base: number): string {
  const p = (over / base) * 100
  const rounded = p >= 10 ? Math.round(p) : Math.round(p * 10) / 10
  return `${rounded}%`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** "#2 of 6 from the bottom" / "#2 from the bottom" / null when no rank. */
export function bidTabPositionLabel(v: BidTabValues): string | null {
  if (v.rankFromLow == null) return null
  return v.bidderCount != null
    ? `#${v.rankFromLow} of ${v.bidderCount} from the bottom`
    : `#${v.rankFromLow} from the bottom`
}

export type BidTabInsight = {
  line: string
  /** 'warn' when the numbers look inconsistent with our own bid value. */
  tone: 'ok' | 'warn'
}

/**
 * The live line under the capture fields: what the numbers mean for THIS bid,
 * derived from our own `bid_value`. Null until there's something to say.
 */
export function deriveBidTabInsight(v: BidTabValues, ourValue: number): BidTabInsight | null {
  const parts: string[] = []
  let tone: BidTabInsight['tone'] = 'ok'
  const position = bidTabPositionLabel(v)

  if (v.low != null && ourValue > 0) {
    if (v.rankFromLow === 1 || ourValue <= v.low) {
      parts.push(`Our ${money(ourValue)} was the low bid — if we lost, price wasn’t the reason`)
    } else {
      parts.push(`Our ${money(ourValue)} was ${pct(ourValue - v.low, v.low)} over the low`)
    }
    if (v.high != null && ourValue > v.high) {
      // Our bid is on the tab, so a reported high below it can't be right.
      tone = 'warn'
      parts.push(`but that’s above the high bid — double-check the numbers`)
    }
  } else if (v.low != null && v.high != null) {
    parts.push(`Tab ran ${money(v.low)} to ${money(v.high)}`)
  }
  if (position) parts.push(position)
  if (parts.length === 0) return null
  return { line: parts.join(' — '), tone }
}

/** One-line summary for the bid card; null when nothing is recorded. */
export function bidTabSummary(v: BidTabValues, ourValue: number): string | null {
  if (!hasAnyBidTabValue(v)) return null
  const parts: string[] = []
  if (v.low != null) parts.push(`low ${money(v.low)}`)
  if (v.high != null) parts.push(`high ${money(v.high)}`)
  const position = bidTabPositionLabel(v)
  if (position) parts.push(`we were ${position}`)
  if (v.low != null && ourValue > 0 && ourValue > v.low && v.rankFromLow !== 1) {
    parts.push(`${pct(ourValue - v.low, v.low)} over the low`)
  } else if (v.low != null && ourValue > 0 && (v.rankFromLow === 1 || ourValue <= v.low)) {
    parts.push('we were the low bid')
  }
  return parts.join(' · ')
}

/** The submission-entry note line a bid-tab save writes into the bid's history. */
export function bidTabNoteLine(v: BidTabValues, ourValue: number): string {
  const summary = bidTabSummary(v, ourValue)
  return summary ? `Bid tab recorded — ${summary}` : 'Bid tab received'
}

/** The `bids` update patch for one save (explicit nulls so edits can clear a field). */
export function buildBidTabPatch(v: BidTabValues): BidTabRow {
  return {
    bid_tab_low: v.low,
    bid_tab_high: v.high,
    bid_tab_rank_from_low: v.rankFromLow,
    bid_tab_bidder_count: v.bidderCount,
  }
}

/**
 * Where our bid sits between low and high as a 0–100 position for the range
 * strip; null without both ends (or a degenerate range). Clamped so a bid
 * outside the shared range still renders at an end instead of escaping.
 */
export function bidTabRangePosition(v: BidTabValues, ourValue: number): number | null {
  if (v.low == null || v.high == null || ourValue <= 0) return null
  if (v.high <= v.low) return null
  const p = ((ourValue - v.low) / (v.high - v.low)) * 100
  return Math.max(0, Math.min(100, p))
}
