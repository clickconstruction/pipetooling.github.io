import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BidVsActualBudgetInput, BidVsActualJobInput } from '../lib/bids/bidVsActual'
import { loadBidPricedMargins } from '../lib/bids/pricedMarginIo'
import type { BidPricedMargin } from '../lib/bids/pricedMargin'

/**
 * The Bid vs actual lens's data (Bids → Bid Costs, v2.3342): every job linked
 * to a bid (`jobs_ledger.bid_id`), its budget snapshot (`job_budgets`), the
 * recorded field hours per job (`get_man_hours_by_job`, the Stages board's
 * RPC) and a minimal row for any linked bid the tab's own list does not carry
 * (another trade's bid, say). Fail-soft: a table or RPC a role cannot read
 * comes back empty and the lens says "not costed" / "0 h" rather than
 * breaking. The kernel (`bidVsActual.ts`) does the reading. Since v2.5043 it
 * also reads each linked bid's priced-margin stamp (`bids.priced_*`), fail-soft
 * to none. Since v2.5046 it reads the whole `job_budgets` row, so each job's burn
 * resolves its budget as its Costs tab does.
 */
export type BidVsActualMinimalBid = { id: string; bid_number: string | null; project_name: string | null }

export type BidVsActualState = {
  loading: boolean
  loaded: boolean
  jobs: BidVsActualJobInput[]
  budgets: BidVsActualBudgetInput[]
  hoursByJob: Map<string, number>
  bidsById: Map<string, BidVsActualMinimalBid>
  /** v2.5043 · each linked bid's priced margin, by bid id. */
  pricedByBid: Map<string, BidPricedMargin>
}

const EMPTY: BidVsActualState = { loading: false, loaded: false, jobs: [], budgets: [], hoursByJob: new Map(), bidsById: new Map(), pricedByBid: new Map() }

export function useBidVsActual(enabled: boolean, gen = 0): BidVsActualState {
  const [state, setState] = useState<BidVsActualState>(EMPTY)

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    void (async () => {
      try {
        const { data: linked } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, revenue, status, pct_complete, bid_id').not('bid_id', 'is', null).limit(2000)
        const jobs = (linked ?? []) as BidVsActualJobInput[]
        if (cancelled) return
        const jobIds = jobs.map((j) => j.id)
        const bidIds = [...new Set(jobs.map((j) => j.bid_id).filter((x): x is string => !!x))]
        const [budgetsRes, hoursRes, bidsRes, pricedByBid] = await Promise.all([
          jobIds.length ? supabase.from('job_budgets').select('*').in('job_id', jobIds) : Promise.resolve({ data: [], error: null }),
          supabase.rpc('get_man_hours_by_job'),
          bidIds.length ? supabase.from('bids').select('id, bid_number, project_name').in('id', bidIds) : Promise.resolve({ data: [], error: null }),
          loadBidPricedMargins(bidIds),
        ])
        if (cancelled) return
        const hoursByJob = new Map<string, number>()
        for (const r of ((hoursRes.error ? [] : hoursRes.data) ?? []) as Array<{ job_id: string; man_hours: number | string | null }>) hoursByJob.set(r.job_id, (hoursByJob.get(r.job_id) ?? 0) + (Number(r.man_hours) || 0))
        const bidsById = new Map<string, BidVsActualMinimalBid>()
        for (const b of ((bidsRes.error ? [] : bidsRes.data) ?? []) as BidVsActualMinimalBid[]) bidsById.set(b.id, b)
        setState({ loading: false, loaded: true, jobs, budgets: ((budgetsRes.error ? [] : budgetsRes.data) ?? []) as BidVsActualBudgetInput[], hoursByJob, bidsById, pricedByBid })
      } catch {
        if (!cancelled) setState({ ...EMPTY, loaded: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, gen])

  return state
}
