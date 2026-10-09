import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadJobChargesTimelineInputs, type JobChargesTimelineInputs, type JobChargesTimelineJob } from './useJobChargesTimelineInputs'

/** How many linked jobs load at once: each is the Costs tab's own few reads. */
export const BID_VS_ACTUAL_BURN_CONCURRENCY = 4

export type BidVsActualBurnInputsState = {
  loading: boolean
  /** Each linked job's cost events once loaded; 'error' when its read failed. Absent while waiting. */
  inputsByJob: Map<string, JobChargesTimelineInputs | 'error'>
}

const EMPTY: BidVsActualBurnInputsState = { loading: false, inputsByJob: new Map() }

/**
 * Bid vs actual's dollar burn (Burn against the bid, piece 2, v2.5046): each linked job's cost
 * events, loaded exactly as its Costs tab loads them (`loadJobChargesTimelineInputs`, team labor
 * included), a few at a time, the rows filling in as they arrive. Runs only while the lens is open
 * and only for the roles that read wages (`enabled`). Fail-soft per job: one failed read marks that
 * row and leaves the others.
 */
export function useBidVsActualBurnInputs(enabled: boolean, jobIds: ReadonlyArray<string>): BidVsActualBurnInputsState {
  const [state, setState] = useState<BidVsActualBurnInputsState>(EMPTY)
  const key = [...new Set(jobIds)].sort().join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (!enabled || ids.length === 0) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    setState({ loading: true, inputsByJob: new Map() })
    const put = (id: string, v: JobChargesTimelineInputs | 'error') => {
      if (!cancelled) setState((s) => ({ ...s, inputsByJob: new Map(s.inputsByJob).set(id, v) }))
    }
    void (async () => {
      const { data, error } = await supabase
        .from('jobs_ledger')
        .select('id, revenue, pct_complete, invoices:jobs_ledger_invoices(status, amount), materials:jobs_ledger_materials(amount, created_at, description)')
        .in('id', ids)
      if (cancelled) return
      const rows = (error ? [] : (data ?? [])) as Array<{
        id: string
        revenue: number | null
        pct_complete: number | null
        invoices: Array<{ status: string | null; amount: number | null }> | null
        materials: Array<{ amount: number | null; created_at: string | null; description: string | null }> | null
      }>
      const jobs: JobChargesTimelineJob[] = rows.map((r) => ({ id: r.id, revenue: r.revenue, pct_complete: r.pct_complete, invoices: r.invoices ?? [], materials: r.materials ?? [], payments: [] }))
      const found = new Set(jobs.map((j) => j.id))
      for (const id of ids) if (!found.has(id)) put(id, 'error')
      let next = 0
      const worker = async () => {
        while (!cancelled && next < jobs.length) {
          const job = jobs[next++]!
          try {
            put(job.id, await loadJobChargesTimelineInputs(job, true))
          } catch {
            put(job.id, 'error')
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(BID_VS_ACTUAL_BURN_CONCURRENCY, jobs.length) }, worker))
      if (!cancelled) setState((s) => ({ ...s, loading: false }))
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, key])

  return state
}
