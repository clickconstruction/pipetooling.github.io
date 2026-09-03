import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { SESSION_NOTES_ROW_CAP, type SessionNotesRow, type SessionNotesServerFilter } from './sessionNotesSearch'

/**
 * One fetch for the Pipeline "Session notes" view: non-revoked clock sessions
 * in a date window, newest first, with the person, job, and bid embeds the
 * line needs. Runs under the caller's RLS — a role without pay access only
 * sees the rows it could already read on People → Hours.
 */
const SESSION_NOTES_SELECT =
  'id, user_id, clocked_in_at, clocked_out_at, work_date, notes, origin, salary_segment_index, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name), jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, click_number, job_name, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, service_type_id)'

/** PostgREST `.or()` clause for the coarse text prefilter; null when nothing to filter on. */
export function sessionNotesOrClause(filter: SessionNotesServerFilter | null): string | null {
  if (!filter) return null
  const parts: string[] = []
  if (filter.anchor) parts.push(`notes.ilike.*${filter.anchor}*`)
  if (filter.userIds.length > 0) parts.push(`user_id.in.(${filter.userIds.join(',')})`)
  if (filter.jobIds.length > 0) parts.push(`job_ledger_id.in.(${filter.jobIds.join(',')})`)
  return parts.length > 0 ? parts.join(',') : null
}

export async function fetchSessionNotes(args: {
  /** Inclusive lower bound on work_date; null = no bound. */
  startYmd: string | null
  pinnedJobId?: string | null
  pinnedUserId?: string | null
  serverFilter?: SessionNotesServerFilter | null
  limit?: number
}): Promise<{ rows: SessionNotesRow[]; truncated: boolean; error: string | null }> {
  const limit = args.limit ?? SESSION_NOTES_ROW_CAP
  try {
    const data = await withSupabaseRetry(async () => {
      let q = supabase.from('clock_sessions').select(SESSION_NOTES_SELECT).is('revoked_at', null)
      if (args.startYmd) q = q.gte('work_date', args.startYmd)
      if (args.pinnedJobId) q = q.eq('job_ledger_id', args.pinnedJobId)
      if (args.pinnedUserId) q = q.eq('user_id', args.pinnedUserId)
      const or = sessionNotesOrClause(args.serverFilter ?? null)
      if (or) q = q.or(or)
      return await q.order('clocked_in_at', { ascending: false }).limit(limit + 1)
    }, 'fetchSessionNotes')
    const all = (data ?? []) as SessionNotesRow[]
    return { rows: all.slice(0, limit), truncated: all.length > limit, error: null }
  } catch (e) {
    return { rows: [], truncated: false, error: formatErrorMessage(e) }
  }
}
