import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { LienLeaveOutReason, LienLeftOutPaper, LienLeftOutRow } from './lienLeftOut'

/**
 * The read and the one write behind the run's **Leave out** (punch list #362, step 5). The rule is `lienLeftOut.ts`.
 * The table is `lien_run_left_out` and the write is `set_lien_run_left_out` (migration 20261124093000), which stamps
 * who and when on the server: nothing here writes the table itself.
 */

type Row = { id: string; job_id: string; paper: string; run_day: string; reason: string; note: string | null; left_out_by: string; left_out_at: string; put_back_by: string | null; put_back_at: string | null }

export function lienLeftOutFromRow(r: Row): LienLeftOutRow {
  return { id: r.id, jobId: r.job_id, paper: r.paper as LienLeftOutPaper, runDay: r.run_day, reason: r.reason as LienLeaveOutReason, note: r.note ?? '', leftOutBy: r.left_out_by, leftOutAt: r.left_out_at, putBackBy: r.put_back_by, putBackAt: r.put_back_at }
}

/** Every leave-out that stands (not put back), for every job: a few rows a run. */
export async function readLienLeftOut(): Promise<LienLeftOutRow[]> {
  const data = await withSupabaseRetry(
    () =>
      supabase
        .from('lien_run_left_out' as never)
        .select('id, job_id, paper, run_day, reason, note, left_out_by, left_out_at, put_back_by, put_back_at')
        .is('put_back_at', null)
        .order('left_out_at', { ascending: true }),
    'read the papers left out of the lien run',
  )
  return ((data ?? []) as unknown as Row[]).map(lienLeftOutFromRow)
}

export type LienLeftOutWrite = { jobId: string; paper: LienLeftOutPaper } & ({ leftOut: true; runDay: string; reason: LienLeaveOutReason; note: string } | { leftOut: false })

/** Leave a paper out of a run, or put it back. Throws with the function's own words when it refuses. */
export async function writeLienLeftOut(w: LienLeftOutWrite): Promise<{ changed: boolean }> {
  const args = w.leftOut ? { p_job_id: w.jobId, p_paper: w.paper, p_run_day: w.runDay, p_left_out: true, p_reason: w.reason, p_note: w.note.trim() } : { p_job_id: w.jobId, p_paper: w.paper, p_run_day: null, p_left_out: false }
  const { data, error } = await supabase.rpc('set_lien_run_left_out' as never, args as never)
  if (error) throw error
  const answer = (data ?? null) as { ok?: boolean; changed?: boolean; error?: string } | null
  if (!answer || answer.error || !answer.ok) throw new Error(answer?.error || (w.leftOut ? 'The paper was not left out.' : 'The paper was not put back.'))
  return { changed: Boolean(answer.changed) }
}
