/**
 * Dashboard "lost bids need a reason" nudge — why-we-lost train PR 4 (v2.1800).
 *
 * Threshold-gated: the banner only appears once the caller's uncategorized
 * lost-bid queue reaches LOST_BID_NUDGE_MIN_COUNT, so one stray lost bid never
 * summons a banner. Counts by `loss_category` (the Why we lost lens queue
 * rule) — legacy free-text `loss_reason` alone does NOT clear a bid here,
 * because the lens still lists it as unexplained.
 *
 * Pure module — no React, no Supabase.
 */

import { isBidLossCategoryKey } from './bidLossCategories'

export const LOST_BID_NUDGE_MIN_COUNT = 5

export type LostBidNudge = {
  count: number
  /** Total bid value of the uncategorized lost bids. */
  value: number
}

export function buildLostBidNudge(
  rows: ReadonlyArray<{ loss_category: string | null; bid_value: number | null }>,
  minCount: number = LOST_BID_NUDGE_MIN_COUNT,
): LostBidNudge | null {
  let count = 0
  let value = 0
  for (const r of rows) {
    if (isBidLossCategoryKey(r.loss_category)) continue
    count += 1
    const v = Number(r.bid_value)
    if (Number.isFinite(v)) value += v
  }
  // A zero-count nudge is never meaningful, whatever the threshold.
  return count > 0 && count >= minCount ? { count, value } : null
}

/** Compact dollar label for the banner: $5.8M / $713k / $940. */
export function formatLostBidNudgeValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}
