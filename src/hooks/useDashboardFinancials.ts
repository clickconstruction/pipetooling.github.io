import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadDashboardFinancials, type DashboardFinancials } from '../lib/dashboardFinancialsLoad'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'

// The reads live in `lib/dashboardFinancialsLoad.ts` with the client passed in (v2.5880), so the Bridge's weekly
// sheet can make them as the service role on the edge; this hook binds the app's client, reads the ZZ test job ids
// once per user and keeps the state.
export type { DashboardApBill, DashboardFinancials } from '../lib/dashboardFinancialsLoad'

/**
 * Data for the Dashboard "Financials" one-pager (AR / AP / Not billed). Fetches once per mount
 * for privileged roles; all math lives in the pure dashboardFinancials kernel so the cards match
 * Jobs Stages / Supply Houses / the Payroll ledger.
 */
export function useDashboardFinancials(
  enabled: boolean,
  refreshKey?: number,
  /**
   * Assistants can't read pay_stubs/people_pay_config since the pay lockdown (v2.660) —
   * they get org-level aggregates from get_dashboard_payroll_totals instead of per-person rows.
   */
  viewerRole?: string | null,
  /** The signed-in user: the shared ZZ test job ids are kept per user (punch list #61, review on #5241). */
  viewerUserId?: string | null,
): {
  data: DashboardFinancials | null
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<DashboardFinancials | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** ZZ test jobs (punch list #61, v2.5120): every role but a dev who shows them reads AR and Unbilled without them. */
  const hideZz = useZzTestJobsHidden(viewerRole)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        // ZZ test jobs leave before anything reads them: their bills are then never billed ids, so
        // their payments and unlinked money are never read either (by their names and the shared ids).
        const zzTestJobIds = hideZz ? await loadZzTestJobIds(viewerUserId) : null
        if (cancelled) return
        const next = await loadDashboardFinancials(supabase, { assistantAggregates: viewerRole === 'assistant', zzTestJobIds })
        if (!cancelled) setData(next)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load financials')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey, viewerRole, viewerUserId, hideZz])

  return { data, loading, error }
}
