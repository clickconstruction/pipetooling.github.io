import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const SELECT = 'id, user_id, created_at, users!jobs_ledger_team_members_user_id_fkey(name)'

export type JobTeamMemberRow = {
  id: string
  user_id: string
  created_at: string | null
  users: { name: string | null } | null
}

/** Current crew/team-member rows for a job (oldest-first, cap 101). */
export async function fetchJobTeamMembersForJobLedger(
  jobId: string,
): Promise<{ data: JobTeamMemberRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger_team_members')
          .select(SELECT)
          .eq('job_id', jobId)
          .order('created_at', { ascending: true })
          .limit(101),
      'fetchJobTeamMembersForJobLedger',
    )
    return { data: (data ?? []) as JobTeamMemberRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
