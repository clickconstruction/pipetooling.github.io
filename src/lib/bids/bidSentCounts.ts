/**
 * One "sent" count (journey-map Tier-2 #20, cluster C28 — decision 8, 2026-09-06).
 *
 * Five doors used to count the same pile five ways: the Followup lenses counted per-GC
 * packet rows (`gcOutcomeRowsForBid`) while the Bid Board bucketed per bid and the Dashboard
 * card read every trade — 60/59 · 107/101 · 115/114 · 99/96 on the same afternoon. This
 * kernel is the one they all read now. The rules, stated once:
 *
 *   1. **The unit is the BID.** A bid sent to three GCs is one sent bid. GC packets are a
 *      sub-count (`packetsSent`, `packetRows`) for the row detail only — never the headline.
 *   2. **The scope follows the trade pill and is labelled.** `{ kind: 'trade' }` keeps the
 *      bids whose `service_type_id` matches; `{ kind: 'all' }` keeps every trade. Every number
 *      on `/bids` wears the pill's trade name; the company-wide Dashboard card says "all trades".
 *   3. **The pile is `getSubmissionSectionKey`** — the Bid Board's rule — so the pills, the
 *      section headers and the lens headlines can never disagree about which bucket a bid is in.
 *      Bids adopted into another bid's package (`adopted_into_bid_id`) leave every count, as
 *      they leave every list (v2.2133); the Dashboard used to count them.
 *   4. **Package & Send is not a send.** `bid_pricing_package_sends` (a teammate got the
 *      pricing table) is not an input here at all — only `bid_date_sent` (the send-ledger /
 *      bid-room / hand-stamp roll-up, see `bidSentDate.ts`) makes a bid "sent".
 *
 * Pure — no React, no Supabase.
 */

import type { GcPacket } from './gcPackets'
import { getSubmissionSectionKey } from './submissionSections'
import { isBidLossCategoryKey } from '../bidLossCategories'

export type BidSentScope = { kind: 'trade'; tradeId: string; tradeName?: string | null } | { kind: 'all' }

/** The columns the kernel reads — satisfied by `BidWithBuilder` and by the Dashboard's slim select. */
export type BidSentCountsBid = {
  id: string
  outcome: string | null
  bid_date_sent: string | null
  service_type_id?: string | null
  adopted_into_bid_id?: string | null
  working_board_archived_at?: string | null
  loss_category?: string | null
  bid_value?: number | string | null
}

export type BidSentCounts = {
  /** Bids in scope after the adopted-bid exclusion (the denominator every other number sits under). */
  bids: number
  /** Bids with a sent date, whatever happened next. */
  sent: number
  /** No sent date, no outcome, not archived off the working board — the board's Unsent / Working pile. */
  unsent: number
  /** Sent, no answer yet — the board's "Not yet won or lost" / the lenses' "still open". */
  waiting: number
  won: number
  started: number
  lost: number
  /** Lost with no structured reason (`loss_category`) — the Why-we-lost queue / Dashboard card rule. */
  lostNeedingReason: number
  /** Bid value of `lostNeedingReason` bids. */
  lostNeedingReasonValue: number
  /** Sub-count: real GC packets (not "Also sent to" shared letters) carrying a send. Row detail only. */
  packetsSent: number
  /** Sub-count: per-GC rows a lens would draw for the in-scope bids (≥ `bids` once any bid is multi-GC). */
  packetRows: number
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v ?? 0
  return Number.isFinite(n) ? (n as number) : 0
}

/** Rule 2 + rule 3's exclusion: which bids a scope keeps. */
export function bidsInScope<B extends BidSentCountsBid>(bids: ReadonlyArray<B>, scope: BidSentScope): B[] {
  return bids.filter((b) => {
    if (b.adopted_into_bid_id) return false
    if (scope.kind === 'trade') return (b.service_type_id ?? null) === scope.tradeId
    return true
  })
}

export function bidSentCounts(
  bids: ReadonlyArray<BidSentCountsBid>,
  opts: { scope: BidSentScope; packetsByBid?: Record<string, ReadonlyArray<GcPacket>> },
): BidSentCounts {
  const kept = bidsInScope(bids, opts.scope)
  const out: BidSentCounts = {
    bids: kept.length,
    sent: 0,
    unsent: 0,
    waiting: 0,
    won: 0,
    started: 0,
    lost: 0,
    lostNeedingReason: 0,
    lostNeedingReasonValue: 0,
    packetsSent: 0,
    packetRows: 0,
  }
  for (const b of kept) {
    if (b.bid_date_sent) out.sent += 1
    const key = getSubmissionSectionKey(b)
    if (key === 'unsent') {
      if (!b.working_board_archived_at) out.unsent += 1
    } else if (key === 'pending') out.waiting += 1
    else if (key === 'won') out.won += 1
    else if (key === 'startedOrComplete') out.started += 1
    else if (key === 'lost') {
      out.lost += 1
      if (!isBidLossCategoryKey(b.loss_category ?? null)) {
        out.lostNeedingReason += 1
        out.lostNeedingReasonValue += num(b.bid_value)
      }
    }
    const packets = opts.packetsByBid?.[b.id]
    const real = (packets ?? []).filter((p) => !p.sharedLetter)
    out.packetsSent += real.filter((p) => p.sentOn != null).length
    // A lens draws one row per real packet (≥2) or one row for the bid; shared letters ride the bid.
    out.packetRows += real.length >= 2 ? real.length : 1
  }
  return out
}

/** Rule 2's label — the word that sits beside every number: the pill's trade, or "all trades". */
export function scopeLabel(scope: BidSentScope): string {
  if (scope.kind === 'all') return 'all trades'
  const name = (scope.tradeName ?? '').trim()
  return name || 'this trade'
}

/** `"60 lost"` → `"60 lost · Plumbing"` — the number and its scope in one breath. */
export function withScopeLabel(text: string, scope: BidSentScope): string {
  return `${text} · ${scopeLabel(scope)}`
}

/**
 * The lens-header pair: the bid count leads, the packet figure follows and is visibly secondary.
 * "101 bids · 107 GC packets"; collapses to "101 bids" when no bid in the pile is multi-GC (a
 * packet count equal to the bid count says nothing).
 */
export function bidsAndPacketsLabel(bids: number, packets: number, noun: string | { one: string; many: string } = 'bids'): string {
  const forms = typeof noun === 'string' ? { one: noun.replace(/s$/, ''), many: noun } : noun
  const head = `${bids} ${bids === 1 ? forms.one : forms.many}`
  if (packets === bids || packets <= 0) return head
  return `${head} · ${packets} GC packet${packets === 1 ? '' : 's'}`
}

/** Distinct bid ids among per-GC rows — how a lens turns its rows back into the bid count. */
export function distinctBidCount(rows: ReadonlyArray<{ bidId?: string; id?: string }>): number {
  const ids = new Set<string>()
  for (const r of rows) {
    const id = r.bidId ?? r.id
    if (id) ids.add(id)
  }
  return ids.size
}
