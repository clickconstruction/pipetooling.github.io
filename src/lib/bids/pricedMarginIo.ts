import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { parseBidPricedMargin, type BidPricedMargin, type PricedMarginStampInput } from './pricedMargin'

// Untyped until the types regenerate after 20261010010000's push.
const db = supabase as unknown as SupabaseClient

/** The `bids` columns a stamp lives in (v2.5043). */
export const BID_PRICED_MARGIN_COLUMNS = 'id, priced_margin_pct, priced_revenue_usd, priced_cost_usd, priced_uncosted_usd, priced_rate_set, priced_bid_version_id, priced_at'

export type StampBidPricedMarginResult = { ok: true; marginPct: number; pricedAt: string | null } | { ok: false; reason: 'sent' | 'no_revenue' | 'refused' | string }

/**
 * Stamps the margin a bid is priced at (`stamp_bid_priced_margin`). Fail-soft: any error, or a
 * server without the function yet, returns null, and the workbench prices on as before.
 */
export async function stampBidPricedMargin(args: { bidId: string; bidVersionId: string | null; input: PricedMarginStampInput }): Promise<StampBidPricedMarginResult | null> {
  try {
    const { data, error } = await db.rpc('stamp_bid_priced_margin', {
      p_bid_id: args.bidId,
      p_bid_version_id: args.bidVersionId,
      p_revenue_usd: args.input.revenueUsd,
      p_cost_usd: args.input.costUsd,
      p_uncosted_usd: args.input.uncostedUsd,
      p_rate_set: args.input.rateSet,
    })
    if (error || data == null || typeof data !== 'object') return null
    const o = data as { ok?: unknown; reason?: unknown; margin_pct?: unknown; priced_at?: unknown }
    if (o.ok === true) return { ok: true, marginPct: Number(o.margin_pct), pricedAt: typeof o.priced_at === 'string' ? o.priced_at : null }
    return { ok: false, reason: typeof o.reason === 'string' ? o.reason : 'refused' }
  } catch {
    return null
  }
}

/** Each bid's stamp, by bid id. Fail-soft: an error (or the columns not there yet) reads as no stamps. */
export async function loadBidPricedMargins(bidIds: ReadonlyArray<string>): Promise<Map<string, BidPricedMargin>> {
  const out = new Map<string, BidPricedMargin>()
  const ids = [...new Set(bidIds.filter(Boolean))]
  if (ids.length === 0) return out
  try {
    const { data, error } = await db.from('bids').select(BID_PRICED_MARGIN_COLUMNS).in('id', ids)
    if (error) return out
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const m = parseBidPricedMargin(row)
      if (m && typeof row.id === 'string') out.set(row.id, m)
    }
  } catch {
    // no stamps read: every surface says the bid was not priced on the Workbench
  }
  return out
}
