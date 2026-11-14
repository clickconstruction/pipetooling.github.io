import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { LIEN_MONTH_CHECK_CLEAR, lienMonthCheckPatch } from './lienMonthCheck'

/**
 * The stand-in lien month's check on the job (v2.7280, `jobs_ledger.lien_month_checked_*`): the office confirms the
 * month, or changes the note. The patch is cast until the generated types carry the columns (the migration lands
 * with this client, and the types follow the push). Written under the job row's own policies, as the last day of
 * work is.
 */

/** Confirm the month, or change who said so: one update on the job. */
export async function saveLienMonthCheck(input: { jobId: string; month: string; note: string; userId: string | null; userName: string }): Promise<void> {
  const patch = lienMonthCheckPatch({ month: input.month, note: input.note, userId: input.userId, userName: input.userName, nowIso: new Date().toISOString() })
  await withSupabaseRetry(() => supabase.from('jobs_ledger').update(patch as never).eq('id', input.jobId), 'lien desk: confirm the month')
}

/** Take the check back: the question returns on every surface. */
export async function clearLienMonthCheck(jobId: string): Promise<void> {
  await withSupabaseRetry(() => supabase.from('jobs_ledger').update(LIEN_MONTH_CHECK_CLEAR as never).eq('id', jobId), 'lien desk: clear the month check')
}
