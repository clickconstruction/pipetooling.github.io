/** Draft Payroll's "N sessions still waiting for approval" line: the one read behind it. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'

/** A period Draft Payroll can count for: both ends set the right way round. */
export function draftPayrollPeriodIsValid(periodStart: string, periodEnd: string): boolean {
  return periodStart <= periodEnd
}

/** Clock sessions in the period neither approved nor rejected. Throws what `withSupabaseRetry` throws. */
export async function fetchPendingApprovalCount(supabase: SupabaseClient, periodStart: string, periodEnd: string): Promise<number> {
  const count = await withSupabaseRetry(
    async () => {
      const result = await supabase
        .from('clock_sessions')
        .select('*', { count: 'exact', head: true })
        .is('approved_at', null)
        .is('rejected_at', null)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
      if (result.error) return { data: null as number | null, error: result.error }
      return { data: result.count ?? 0, error: null }
    },
    'draft payroll pending approvals count',
  )
  return count ?? 0
}
