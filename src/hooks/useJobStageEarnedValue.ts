import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stageEarnedValue, type BidStage, type StageEarnedValue, type StageLine } from '../lib/bids/stageEarnedValue'

export type JobStageEarnedValueState = { loading: boolean; failed: boolean; ev: StageEarnedValue | null }

/**
 * Earned value by stage for one linked job (Burn against the bid, piece 2, v2.5046), read when its
 * Bid vs actual row is opened: the bid's hours by stage (`bid_estimate_breakdown`) and the job's
 * staged billing lines with their crew progress (`list_job_stage_progress`), through the kernel
 * against the hours recorded. Fail-soft: a read the caller may not make says so instead of breaking.
 */
export function useJobStageEarnedValue(enabled: boolean, jobId: string, bidId: string, recordedHours: number): JobStageEarnedValueState {
  // Loading from the first render when enabled, so the row never flashes "no hours" before the read.
  const [state, setState] = useState<{ loading: boolean; failed: boolean; hours: Partial<Record<BidStage, number>> | null; lines: StageLine[] }>(() => ({ loading: enabled, failed: false, hours: null, lines: [] }))

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, failed: false }))
    void (async () => {
      try {
        const [breakdown, progress] = await Promise.all([supabase.rpc('bid_estimate_breakdown', { p_bid_id: bidId }), supabase.rpc('list_job_stage_progress', { p_job_id: jobId })])
        if (cancelled) return
        if (breakdown.error || progress.error) {
          setState({ loading: false, failed: true, hours: null, lines: [] })
          return
        }
        const byStage = ((breakdown.data ?? null) as { labor_hours_by_stage?: Partial<Record<BidStage, number>> } | null)?.labor_hours_by_stage ?? null
        const lines = ((progress.data ?? []) as Array<{ name: string | null; weight_pct: number | string | null; progress_pct: number | null }>).map((r) => ({
          name: (r.name ?? '').trim() || 'Untitled line',
          weightPct: Number(r.weight_pct) || 0,
          progressPct: r.progress_pct,
        }))
        setState({ loading: false, failed: false, hours: byStage, lines })
      } catch {
        if (!cancelled) setState({ loading: false, failed: true, hours: null, lines: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, jobId, bidId])

  const ready = enabled && !state.loading && !state.failed
  return { loading: state.loading, failed: state.failed, ev: ready ? stageEarnedValue({ bidHoursByStage: state.hours, lines: state.lines, recordedHours }) : null }
}
