/**
 * Bid tab paste capture (v2.2296): parse a GC's written tab — the block of
 * per-bidder amounts a proposals email lists under each project — into
 * structured entries, and derive the four bids.bid_tab_* summary values
 * (v2.2081) from them so every existing tab consumer keeps working unchanged.
 *
 * Sibling of `bidTabCapture.ts` (the phone-call summary capture). Pure module
 * — no React, no Supabase.
 */

/** One rung of the tab, as parsed or as stored in bid_tab_entries. */
export type BidTabEntryDraft = {
  amount: number
  /** The bidder's alternate price when the tab shows one ("$42,977 (alternate $100,672)"). */
  alternateAmount: number | null
  /** Bidder name when the line carries one; most tab lines are anonymous amounts. */
  bidderName: string | null
  isOurs: boolean
}

import type { BidTabValues } from '../bidTabCapture'

/** Lines that mark OUR amount in a GC's email — Click Plumbing's tabs say "Click". */
const OURS_PATTERN = /\bclick\b/i

const MONEY_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)/g

function moneyToNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export type BidTabPasteResult = {
  entries: BidTabEntryDraft[]
  /** Non-empty lines that contained no parseable amount (headers, sign-offs). */
  skippedLines: string[]
}

/**
 * Parse pasted tab text line by line. Rules, matched to how GC emails read:
 * - An amount needs a `$` prefix, or the whole line must be one bare number
 *   ("39,400") — this keeps "Take 5" from becoming a $5 bid.
 * - The line's first amount is the bid; "(alternate $X)" attaches X to it.
 * - Whatever text remains after stripping amounts/punctuation is the bidder
 *   name; a line matching OURS_PATTERN is auto-flagged ours (first match only).
 */
export function parseBidTabPaste(text: string): BidTabPasteResult {
  const entries: BidTabEntryDraft[] = []
  const skippedLines: string[] = []
  let oursSeen = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const amounts: number[] = []
    MONEY_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = MONEY_RE.exec(line)) != null) {
      const n = moneyToNumber(m[1]!)
      if (n != null) amounts.push(n)
    }
    if (amounts.length === 0) {
      // Whole line is one bare number → an amount without its $.
      const bare = /^\d[\d,]*(?:\.\d+)?$/.test(line) ? moneyToNumber(line) : null
      if (bare != null) {
        entries.push({ amount: bare, alternateAmount: null, bidderName: null, isOurs: false })
      } else {
        skippedLines.push(line)
      }
      continue
    }
    const amount = amounts[0]!
    // "(alternate $X)" / "alt $X" attaches the SECOND amount as the alternate.
    const alternateAmount = /\balt(ernate)?\b/i.test(line) && amounts.length > 1 ? amounts[1]! : null
    const name = line
      .replace(MONEY_RE, ' ')
      .replace(/\(\s*alt(ernate)?\s*\)/gi, ' ')
      .replace(/\balt(ernate)?\b/gi, ' ')
      .replace(/[()\-–—:·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const isOurs = !oursSeen && OURS_PATTERN.test(line)
    if (isOurs) oursSeen = true
    entries.push({
      amount,
      alternateAmount,
      bidderName: name || null,
      isOurs,
    })
  }
  return { entries, skippedLines }
}

/** Entries sorted low → high (stable on ties), the order every display uses. */
export function sortTabEntries(entries: readonly BidTabEntryDraft[]): BidTabEntryDraft[] {
  return [...entries].sort((a, b) => a.amount - b.amount)
}

/**
 * The v2.2081 summary the full tab implies: low, high, bidder count, and our
 * 1-based rank from the low when an entry is flagged ours. This is what a
 * paste save writes into bids.bid_tab_* — analytics never look further.
 */
export function deriveTabSummaryFromEntries(entries: readonly BidTabEntryDraft[]): BidTabValues {
  if (entries.length === 0) return { low: null, high: null, rankFromLow: null, bidderCount: null }
  const sorted = sortTabEntries(entries)
  const oursIdx = sorted.findIndex((e) => e.isOurs)
  return {
    low: sorted[0]!.amount,
    high: sorted[sorted.length - 1]!.amount,
    rankFromLow: oursIdx >= 0 ? oursIdx + 1 : null,
    bidderCount: entries.length,
  }
}

/** Mark exactly one entry ours (by index in the GIVEN array); everything else cleared. */
export function markEntryOurs(entries: readonly BidTabEntryDraft[], index: number): BidTabEntryDraft[] {
  return entries.map((e, i) => ({ ...e, isOurs: i === index }))
}

export type BidTabLadderRung = BidTabEntryDraft & {
  /** 1-based position from the low. */
  rank: number
  /** Bar width 0–100, proportional to the highest amount. */
  widthPct: number
  /** Dollars above the rung below it; null on the low rung. */
  gapBelow: number | null
}

/** Display rows for the ladder: sorted, ranked, bar-scaled, gap-annotated. */
export function buildTabLadder(entries: readonly BidTabEntryDraft[]): BidTabLadderRung[] {
  const sorted = sortTabEntries(entries)
  const max = sorted.length > 0 ? sorted[sorted.length - 1]!.amount : 0
  return sorted.map((e, i) => ({
    ...e,
    rank: i + 1,
    widthPct: max > 0 ? Math.max(2, Math.round((e.amount / max) * 100)) : 0,
    gapBelow: i > 0 ? e.amount - sorted[i - 1]!.amount : null,
  }))
}
