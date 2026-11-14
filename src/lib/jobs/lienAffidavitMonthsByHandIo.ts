import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienAffidavitMonthsCleaned, parseLienAffidavitMonthsByHand, type LienAffidavitMonthsByHand } from './lienAffidavitMonthsByHand'

/**
 * `job_lien_affidavit_months` (v2.7270): the months a job's affidavit swears, set by hand. The table name is cast
 * until the generated types carry it (the migration lands with this client, and the types follow the push).
 */
const table = () => supabase.from('job_lien_affidavit_months' as never)

/** The rows for many jobs, by job: the desk's read. Throws when the read fails; the desk's hook catches and reads none. */
export async function readLienAffidavitMonthsByHand(jobIds: ReadonlyArray<string>): Promise<Record<string, LienAffidavitMonthsByHand>> {
  if (jobIds.length === 0) return {}
  const rows = await withSupabaseRetry(() => table().select('*').in('job_id', [...jobIds]), 'lien desk: the months set by hand')
  const out: Record<string, LienAffidavitMonthsByHand> = {}
  for (const raw of ((rows ?? []) as unknown[])) {
    const m = parseLienAffidavitMonthsByHand(raw)
    if (m) out[m.jobId] = m
  }
  return out
}

/** One job's row, for the Lien window: null when none is set. Throws when the read fails, so the window can say so. */
export async function readLienAffidavitMonthsByHandForJob(jobId: string): Promise<LienAffidavitMonthsByHand | null> {
  const row = await withSupabaseRetry(() => table().select('*').eq('job_id', jobId).maybeSingle(), 'lien window: the months set by hand')
  return parseLienAffidavitMonthsByHand(row)
}

/** Set or change the job's months — one row per job. */
export async function saveLienAffidavitMonthsByHand(input: { jobId: string; months: ReadonlyArray<string>; reason: string; userId: string | null; userName: string }): Promise<void> {
  const now = new Date().toISOString()
  await withSupabaseRetry(
    () => table().upsert({ job_id: input.jobId, months: lienAffidavitMonthsCleaned(input.months), reason: input.reason.trim(), set_by: input.userId, set_by_name: input.userName.trim(), set_at: now, updated_at: now } as never, { onConflict: 'job_id' }),
    'lien desk: set the months by hand',
  )
}

/** Back to the record's months — the office's to do. */
export async function clearLienAffidavitMonthsByHand(jobId: string): Promise<void> {
  await withSupabaseRetry(() => table().delete().eq('job_id', jobId), 'lien desk: clear the months set by hand')
}
