import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { CLOCK_SESSION_LIST_SELECT } from '../clockSessionSelect'
import type { ClockSessionRow } from '../../types/clockSessions'

/** Hard cap on one queue load — a stall of a few hundred rows is the realistic worst case (Aug 2026: 152). */
export const PENDING_APPROVALS_FETCH_CAP = 2000

/**
 * Every closed clock session still waiting on approval, oldest first, with no
 * week window — the approvals queue's one read. Caller RLS applies: pay roles
 * see the company, a team lead sees their members.
 */
export async function fetchAllPendingClockSessions(): Promise<ClockSessionRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      supabase
        .from('clock_sessions')
        .select(CLOCK_SESSION_LIST_SELECT)
        .not('clocked_out_at', 'is', null)
        .is('approved_at', null)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .order('work_date', { ascending: true })
        .order('clocked_in_at', { ascending: true })
        .limit(PENDING_APPROVALS_FETCH_CAP),
    'load all pending clock sessions',
  )
  return (data ?? []) as unknown as ClockSessionRow[]
}
