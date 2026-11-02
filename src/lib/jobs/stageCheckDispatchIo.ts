/**
 * Send a stage check to Dispatch (punch list #245): the reads and the write behind the sheet's press. The job's number,
 * name and address come off `jobs_ledger` under the reader's own policy, so a crew member on the job's team reads them and
 * a role that reads less gets a context card with less on it, never a refusal. The open requests on the job's checks are
 * read back by the two columns of migration `20261102113000`, so the row can wear *With Dispatch*; a read that fails, as
 * before the push, draws no chip. The send goes through `sendAsk`'s path, the row, the refresh and the push, so Dispatch
 * hears it as they hear every request. The rules are `stageCheckDispatch.ts`; the sheet takes this io so its tests run
 * over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { sendAsk } from '../developments/askWrites'
import { STAGE_CHECK_ACTION, type OpenStageCheck, type StageCheckJob, type StageCheckRow } from './stageCheckDispatch'

// The two columns are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

/** The job as the ledger names it; the id alone when the read is refused. */
export async function loadStageCheckJob(jobId: string): Promise<StageCheckJob> {
  try {
    const { data } = await db.from('jobs_ledger').select('hcp_number, job_name, job_address').eq('id', jobId).maybeSingle()
    const row = (data ?? null) as { hcp_number: string | null; job_name: string | null; job_address: string | null } | null
    return { id: jobId, hcpNumber: row?.hcp_number ?? null, name: row?.job_name ?? null, address: row?.job_address ?? null }
  } catch {
    return { id: jobId }
  }
}

type OpenRow = { id: string; fixture_id: string | null; checklist_question_id: string | null; title: string; created_at: string; priority: string | null }

/** The open stage checks on this job, as the sender or Dispatch reads them; none when the read fails. */
export async function loadOpenStageChecks(jobId: string): Promise<OpenStageCheck[]> {
  try {
    const result = await db
      .from('dispatch_requests')
      .select('id, fixture_id, checklist_question_id, title, created_at, priority')
      .eq('job_ledger_id', jobId)
      .eq('pending_action', STAGE_CHECK_ACTION)
      .eq('status', 'open')
    checkSupabaseError(result, 'read the checks with Dispatch')
    return ((result.data ?? []) as OpenRow[])
      .filter((r) => r.fixture_id && r.checklist_question_id)
      .map((r) => ({ id: r.id, fixtureId: r.fixture_id as string, questionId: r.checklist_question_id as string, title: r.title, createdAt: r.created_at, priority: r.priority }))
  } catch {
    return []
  }
}

/** The row in, the inbox refreshed, the push sent. Throws with the database's reason when the row is refused. */
export async function sendStageCheck(row: StageCheckRow): Promise<{ id: string; pushed: boolean; pushError: string | null }> {
  return sendAsk('dispatch', row)
}

export interface StageCheckDispatchIo {
  job: (jobId: string) => Promise<StageCheckJob>
  open: (jobId: string) => Promise<OpenStageCheck[]>
  send: (row: StageCheckRow) => Promise<{ id: string; pushed: boolean; pushError: string | null }>
}

export function supabaseStageCheckDispatchIo(): StageCheckDispatchIo {
  return { job: loadStageCheckJob, open: loadOpenStageChecks, send: sendStageCheck }
}
