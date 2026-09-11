import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * One job's budget (Burn against the bid, PR 2 — v2.3299): the `job_budgets`
 * row, the ranked bid candidates while there is none, and the linked bid's
 * live breakdown when the job is linked but nothing was snapshotted yet. The
 * four writes go through the PR 1 RPCs (the server decides who may link —
 * SECURITY INVOKER over the caller's jobs_ledger access). Reloads after
 * every write so the card and Burn read the same row.
 */

export type JobBudgetRow = Database['public']['Tables']['job_budgets']['Row']

export type SuggestedBid = {
  bid_id: string
  bid_number: string | null
  project_name: string | null
  bid_value: number | null
  agreed_value: number | null
  outcome: string | null
  customer_name: string | null
  rank: number
  reason: string
  has_estimate: boolean
  estimate_hours: number
  linked_jobs: number
}

/** `bid_estimate_breakdown` as jsonb. */
export type BidEstimateBreakdown = {
  bid_id: string
  bid_number: string | null
  project_name: string | null
  bid_value: number | null
  agreed_value: number | null
  bid_version_id?: string | null
  has_estimate: boolean
  labor_hours: number
  labor_rate: number | null
  labor_usd: number
  materials_usd: number
  subs_usd: number
  other_usd: number
  total_direct_usd: number
  completeness: { rows_total: number; rows_with_hours: number; rate_set: boolean; materials_source: string; usable: boolean }
}

export type JobBudgetState = {
  loading: boolean
  busy: boolean
  error: string | null
  row: JobBudgetRow | null
  candidates: SuggestedBid[]
  /** The linked bid's live breakdown when the job carries a bid_id but no snapshot (or to compare against the snapshot). */
  linkedBreakdown: BidEstimateBreakdown | null
  reload: () => Promise<void>
  linkAndSnapshot: (bidId: string) => Promise<boolean>
  setTyped: (args: { laborHours: number; laborRate: number | null; materialsUsd: number; subsUsd: number; otherUsd?: number; note?: string | null }) => Promise<boolean>
  clear: () => Promise<boolean>
}

export function useJobBudget(jobId: string | null, linkedBidId: string | null, enabled: boolean): JobBudgetState {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<JobBudgetRow | null>(null)
  const [candidates, setCandidates] = useState<SuggestedBid[]>([])
  const [linkedBreakdown, setLinkedBreakdown] = useState<BidEstimateBreakdown | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !jobId) {
      setRow(null)
      setCandidates([])
      setLinkedBreakdown(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: budget, error: bErr } = await supabase.from('job_budgets').select('*').eq('job_id', jobId).maybeSingle()
      if (bErr) throw bErr
      const r = (budget as JobBudgetRow | null) ?? null
      setRow(r)
      const bidToRead = r?.bid_id ?? linkedBidId
      if (bidToRead) {
        const { data: bd, error: bdErr } = await supabase.rpc('bid_estimate_breakdown', { p_bid_id: bidToRead })
        if (bdErr) throw bdErr
        setLinkedBreakdown((bd as unknown as BidEstimateBreakdown | null) ?? null)
      } else setLinkedBreakdown(null)
      if (!r && !linkedBidId) {
        const { data: sug, error: sErr } = await supabase.rpc('suggest_bids_for_job', { p_job_id: jobId })
        if (sErr) throw sErr
        setCandidates(((sug ?? []) as unknown as SuggestedBid[]).map((c) => ({ ...c, bid_value: c.bid_value != null ? Number(c.bid_value) : null, agreed_value: c.agreed_value != null ? Number(c.agreed_value) : null, estimate_hours: Number(c.estimate_hours) || 0 })))
      } else setCandidates([])
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not load the job budget'))
    } finally {
      setLoading(false)
    }
  }, [enabled, jobId, linkedBidId])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(
    async (fn: () => Promise<{ error: { message: string } | null }>, fallback: string): Promise<boolean> => {
      if (!jobId) return false
      setBusy(true)
      setError(null)
      try {
        const { error: err } = await fn()
        if (err) throw err
        await reload()
        return true
      } catch (e) {
        setError(formatErrorMessage(e, fallback))
        return false
      } finally {
        setBusy(false)
      }
    },
    [jobId, reload],
  )

  const linkAndSnapshot = useCallback((bidId: string) => run(() => supabase.rpc('snapshot_job_budget_from_bid', { p_job_id: jobId!, p_bid_id: bidId }), 'Could not link the bid'), [run, jobId])
  const setTyped = useCallback(
    (args: { laborHours: number; laborRate: number | null; materialsUsd: number; subsUsd: number; otherUsd?: number; note?: string | null }) =>
      run(
        () =>
          supabase.rpc('set_typed_job_budget', {
            p_job_id: jobId!,
            p_labor_hours: args.laborHours,
            p_labor_rate: args.laborRate ?? 0,
            p_materials_usd: args.materialsUsd,
            p_subs_usd: args.subsUsd,
            p_other_usd: args.otherUsd ?? 0,
            p_note: args.note ?? undefined,
          }),
        'Could not save the budget',
      ),
    [run, jobId],
  )
  const clear = useCallback(() => run(() => supabase.rpc('clear_job_budget', { p_job_id: jobId! }), 'Could not clear the budget'), [run, jobId])

  return { loading, busy, error, row, candidates, linkedBreakdown, reload, linkAndSnapshot, setTyped, clear }
}
