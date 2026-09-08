import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type JobAccountFlagGaps = {
  /** Jobs with a job-account packet on file that still carry unpaid, unflagged supplier invoices. */
  unflaggedJobs: number
  /** Allocated unpaid dollars on those unflagged invoices. */
  unflaggedTotal: number
  /** Unpaid invoices flagged "On job account" on jobs never shared from the app. */
  noPacketInvoices: number
  noPacketTotal: number
}

/**
 * Job-account flag gaps for the Needs You card (follow-up to v2.2669). All
 * gating lives in count_job_account_flag_gaps() — a caller who can't work the
 * queue gets the zero row, so there is no role logic here. Null while
 * loading / disabled / zero-everywhere (no item); the RPC is not in the
 * generated types yet, hence the established `(supabase as any).rpc` cast.
 * Refetches on window focus like the neighbouring dashboard nudges.
 */
export function useJobAccountFlagGapsNudge(enabled: boolean): { gaps: JobAccountFlagGaps | null } {
  const [gaps, setGaps] = useState<JobAccountFlagGaps | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setGaps(null)
      return
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = (supabase as any).rpc.bind(supabase)
      const rows = await withSupabaseRetry(async () => await rpc('count_job_account_flag_gaps'), 'count job account flag gaps')
      const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined
      const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0)
      const next: JobAccountFlagGaps = {
        unflaggedJobs: num(row?.unflagged_jobs),
        unflaggedTotal: num(row?.unflagged_total),
        noPacketInvoices: num(row?.no_packet_invoices),
        noPacketTotal: num(row?.no_packet_total),
      }
      setGaps(next.unflaggedJobs > 0 || next.noPacketInvoices > 0 ? next : null)
    } catch {
      setGaps(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { gaps }
}
