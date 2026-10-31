/**
 * Draft Payroll's "N sessions still waiting for approval" line: the one read behind it. Since
 * punch list #217 (people-docs-1) the read also keeps each session's `user_id`, so the window can
 * put an amber dot on the rows whose sessions wait instead of a count no row answers for.
 */

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

export type PendingApprovals = {
  count: number
  /** Sessions still waiting, by the login user they belong to; a session with no user is counted but placed nowhere. */
  byUserId: Readonly<Record<string, number>>
}

/** The same sessions, each with its `user_id`, so the count can land on the rows it belongs to. Throws what `withSupabaseRetry` throws. */
export async function fetchPendingApprovals(supabase: SupabaseClient, periodStart: string, periodEnd: string): Promise<PendingApprovals> {
  const rows = await withSupabaseRetry(
    async () => {
      const result = await supabase
        .from('clock_sessions')
        .select('user_id')
        .is('approved_at', null)
        .is('rejected_at', null)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
      if (result.error) return { data: null as Array<{ user_id: string | null }> | null, error: result.error }
      return { data: (result.data ?? []) as Array<{ user_id: string | null }>, error: null }
    },
    'draft payroll pending approvals',
  )
  return pendingApprovalsFromRows(rows ?? [])
}

/** Pure: the count and the per-user tally from the rows read. */
export function pendingApprovalsFromRows(rows: ReadonlyArray<{ user_id: string | null }>): PendingApprovals {
  const byUserId: Record<string, number> = {}
  for (const r of rows) {
    if (!r.user_id) continue
    byUserId[r.user_id] = (byUserId[r.user_id] ?? 0) + 1
  }
  return { count: rows.length, byUserId }
}
