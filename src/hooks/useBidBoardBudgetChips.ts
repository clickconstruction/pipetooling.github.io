import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bidEstimateStatus, bidMatchValue, isWonOutcome, valueMatchForBid, type BidBoardBudgetChip, type BidBoardValueMatch } from '../lib/bids/bidBoardBudgetChips'

/**
 * The Bid Board's won-row chips (v2.3302): for every won bid on the board, the
 * unlinked job whose price equals the bid's value, and the state of the bid's
 * cost estimate. Two reads for the whole board — jobs by the won values (jobs
 * the board's roles can see; a job already carrying a bid is never offered)
 * and the cost estimates with their labor rows — never one per row. Fail-soft.
 */
type BidLike = { id: string; outcome: string | null; bid_value: number | string | null; agreed_value: number | string | null }

export function useBidBoardBudgetChips(bids: ReadonlyArray<BidLike>, enabled: boolean, gen = 0): ReadonlyMap<string, BidBoardBudgetChip> {
  const won = useMemo(() => bids.filter((b) => isWonOutcome(b.outcome)), [bids])
  const key = useMemo(() => (enabled ? won.map((b) => `${b.id}:${bidMatchValue(b) ?? ''}`).sort().join(',') : ''), [won, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, BidBoardBudgetChip>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const ids = won.map((b) => b.id)
      const values = [...new Set(won.map(bidMatchValue).filter((v): v is number => v != null))]
      const [jobsRes, estRes] = await Promise.all([
        values.length ? supabase.from('jobs_ledger').select('id, hcp_number, revenue, bid_id').in('revenue', values).is('bid_id', null).limit(500) : Promise.resolve({ data: [] as unknown[], error: null }),
        supabase.from('cost_estimates').select('bid_id, labor_rate, cost_estimate_labor_rows(count, is_fixed, kind, unit, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit)').in('bid_id', ids),
      ])
      if (cancelled) return
      const unlinked: BidBoardValueMatch[] = ((jobsRes.data ?? []) as Array<{ id: string; hcp_number: string | null; revenue: number | string | null }>).map((j) => ({ jobId: j.id, hcpNumber: j.hcp_number, revenue: Number(j.revenue) || 0 }))
      const estByBid = new Map<string, { labor_rate: number | string | null; rows: Array<{ count: number; is_fixed: boolean; kind?: string; unit?: string; rough_in_hrs_per_unit: number; top_out_hrs_per_unit: number; trim_set_hrs_per_unit: number }> }>()
      for (const e of (estRes.data ?? []) as Array<{ bid_id: string; labor_rate: number | string | null; cost_estimate_labor_rows: Array<{ count: number; is_fixed: boolean; kind?: string; unit?: string; rough_in_hrs_per_unit: number; top_out_hrs_per_unit: number; trim_set_hrs_per_unit: number }> | null }>) {
        estByBid.set(e.bid_id, { labor_rate: e.labor_rate, rows: e.cost_estimate_labor_rows ?? [] })
      }
      const next = new Map<string, BidBoardBudgetChip>()
      for (const b of won) next.set(b.id, { valueMatch: valueMatchForBid(b, unlinked), estimate: bidEstimateStatus(estByBid.get(b.id) ?? null) })
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
    // `gen` re-runs the read after a link lands (the board's job index bumps the same way).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gen])

  return map
}
