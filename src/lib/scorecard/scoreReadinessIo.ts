/**
 * The Bid Board's read for the *Can't be scored* chip (team scorecard, punch list #360, PR 2): the
 * labor rows of the bids that carry a priced margin, counted the way `bid_estimate_breakdown` counts
 * them. Two reads for the whole board, not one call per row. A bid with no cost estimate reads as a
 * Labor tab with no rows, which is what it is.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { laborCompleteness, pricedLaborOf, type LaborCompleteness, type ReadinessLaborRow } from './scoreReadiness'

type EstimateRow = { id: string; bid_id: string; labor_rate: number | null }
type LaborRow = ReadinessLaborRow & { cost_estimate_id: string }

export async function loadLaborCompleteness(bidIds: readonly string[]): Promise<Map<string, LaborCompleteness>> {
  const out = new Map<string, LaborCompleteness>()
  if (bidIds.length === 0) return out
  const estimates = await fetchAllRowsChunkedIn<EstimateRow, string>(
    [...bidIds],
    async (chunk, from, to) => {
      const { data, error } = await supabase.from('cost_estimates').select('id, bid_id, labor_rate').in('bid_id', chunk).order('id').range(from, to)
      return { data: data as EstimateRow[] | null, error }
    },
    'score readiness estimates',
  )
  const rows = await fetchAllRowsChunkedIn<LaborRow, string>(
    estimates.map((e) => e.id),
    async (chunk, from, to) => {
      const { data, error } = await supabase
        .from('cost_estimate_labor_rows')
        .select('cost_estimate_id, kind, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit')
        .in('cost_estimate_id', chunk)
        .order('id')
        .range(from, to)
      return { data: data as LaborRow[] | null, error }
    },
    'score readiness labor rows',
  )
  const byEstimate = new Map<string, LaborRow[]>()
  for (const r of rows) {
    const list = byEstimate.get(r.cost_estimate_id)
    if (list) list.push(r)
    else byEstimate.set(r.cost_estimate_id, [r])
  }
  const estimateByBid = new Map(estimates.map((e) => [e.bid_id, e]))
  for (const bidId of bidIds) {
    const e = estimateByBid.get(bidId)
    out.set(bidId, laborCompleteness(e ? (byEstimate.get(e.id) ?? []) : [], e?.labor_rate ?? null))
  }
  return out
}

export type PricedLabor = { rowsTotal: number; rowsWithHours: number }

/**
 * The labor count kept with each bid's priced margin (`bids.priced_labor_rows_*`, v2.7370), by bid id: only the bids
 * whose stamp carries one. Its own read, failing soft to none, so a database that does not have the columns yet (the
 * client reaches prod before the push) leaves every bid judged as before instead of failing the read beside it.
 */
export async function loadPricedLabor(bidIds: readonly string[]): Promise<Map<string, PricedLabor>> {
  const out = new Map<string, PricedLabor>()
  if (bidIds.length === 0) return out
  try {
    const rows = await fetchAllRowsChunkedIn<{ id: string; priced_labor_rows_total: number | null; priced_labor_rows_with_hours: number | null }, string>(
      [...bidIds],
      async (chunk, from, to) => {
        const { data, error } = await supabase.from('bids').select('id, priced_labor_rows_total, priced_labor_rows_with_hours' as never).in('id', chunk).order('id').range(from, to)
        return { data: data as unknown as Array<{ id: string; priced_labor_rows_total: number | null; priced_labor_rows_with_hours: number | null }> | null, error }
      },
      'score readiness priced labor',
    )
    for (const r of rows) {
      const kept = pricedLaborOf(r)
      if (kept) out.set(r.id, kept)
    }
  } catch {
    /* judged by the Labor tab as it stands */
  }
  return out
}
