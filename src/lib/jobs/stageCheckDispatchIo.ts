/**
 * Send a stage check to Dispatch (punch list #245): the reads and the write behind the sheet's press. The job's number,
 * name and address come off `jobs_ledger` under the reader's own policy, so a crew member on the job's team reads them and
 * a role that reads less gets a context card with less on it, never a refusal. The open requests on the job's checks are
 * read back by the two columns of migration `20261102113000`, so the row can wear *With Dispatch*; a read that fails, as
 * before the push, draws no chip. Each open request carries Dispatch's newest thread note, which the sender may read on
 * their own request, so the row draws the reply under the chip (PR 2b). The send goes through `sendAsk`'s path, the
 * row, the refresh and the push, so Dispatch hears it as they hear every request. A settle on the sheet that closed the
 * request (the self-close of migration `20261104170000`) pushes the sender the closing note through the request's own
 * close push, unless they settled it themselves. The rules are `stageCheckDispatch.ts`; the sheet takes this io so its
 * tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { sendAsk } from '../developments/askWrites'
import { notifyDispatchRequestClosure } from '../dispatchRequestClosure'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { withDispatchCounts } from './stageChecklistMarks'
import { STAGE_CHECK_ACTION, type OpenStageCheck, type StageCheckJob, type StageCheckReply, type StageCheckRow } from './stageCheckDispatch'

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

type OpenRow = { id: string; fixture_id: string | null; checklist_question_id: string | null; title: string; created_at: string; priority: string | null; from_user_id: string | null }
type NoteRow = { request_id: string; body: string; created_at: string; author: { name: string | null } | { name: string | null }[] | null }

/** Dispatch's newest note on each request, newest first off the read; a read that fails leaves every thread bare. */
async function loadNewestReplies(ids: readonly string[]): Promise<Map<string, StageCheckReply>> {
  const out = new Map<string, StageCheckReply>()
  if (ids.length === 0) return out
  try {
    const result = await db
      .from('dispatch_request_notes')
      .select('request_id, body, created_at, author:users!dispatch_request_notes_author_user_id_fkey(name)')
      .in('request_id', [...ids])
      .order('created_at', { ascending: false })
    checkSupabaseError(result, "read Dispatch's replies")
    for (const n of (result.data ?? []) as NoteRow[]) {
      if (out.has(n.request_id)) continue
      const author = Array.isArray(n.author) ? (n.author[0] ?? null) : n.author
      out.set(n.request_id, { body: n.body, by: author?.name ?? null, at: n.created_at })
    }
  } catch {
    // The chip stands without the reply.
  }
  return out
}

/** The open stage checks on this job, as the sender or Dispatch reads them, each with Dispatch's newest word; none when the read fails. */
export async function loadOpenStageChecks(jobId: string): Promise<OpenStageCheck[]> {
  try {
    const result = await db
      .from('dispatch_requests')
      .select('id, fixture_id, checklist_question_id, title, created_at, priority, from_user_id')
      .eq('job_ledger_id', jobId)
      .eq('pending_action', STAGE_CHECK_ACTION)
      .eq('status', 'open')
    checkSupabaseError(result, 'read the checks with Dispatch')
    const rows = ((result.data ?? []) as OpenRow[]).filter((r) => r.fixture_id && r.checklist_question_id)
    const replies = await loadNewestReplies(rows.map((r) => r.id))
    return rows.map((r) => ({
      id: r.id,
      fixtureId: r.fixture_id as string,
      questionId: r.checklist_question_id as string,
      title: r.title,
      createdAt: r.created_at,
      priority: r.priority,
      fromUserId: r.from_user_id,
      reply: replies.get(r.id) ?? null,
    }))
  } catch {
    return []
  }
}

/**
 * A request the sheet's settle just closed (the self-close trigger wrote the note): the sender hears it through the
 * request's own close push, which reads the row's closing note, unless they settled it themselves. Never throws.
 */
export async function pushSettledStageCheck(request: OpenStageCheck, who: { userId: string | null }): Promise<void> {
  if (!request.fromUserId || !who.userId || request.fromUserId === who.userId) return
  await notifyDispatchRequestClosure({ request: { id: request.id, from_user_id: request.fromUserId, title: request.title }, note: null, mode: 'closed', userId: who.userId, role: null })
}

/**
 * The open requests on the board's jobs, counted by stage (PR 3): the flag on the Pipeline's mark. Chunked as the
 * answers are; throws on a refused read, and the board's read fails it soft so the marks still draw.
 */
export async function loadOpenStageCheckCounts(jobIds: string[]): Promise<ReadonlyMap<string, number>> {
  const rows = await fetchAllRowsChunkedIn<{ fixture_id: string | null }, string>(
    jobIds,
    (chunk, from, to) => db.from('dispatch_requests').select('fixture_id').in('job_ledger_id', chunk).eq('pending_action', STAGE_CHECK_ACTION).eq('status', 'open').order('id').range(from, to),
    'stageCheckDispatch.openCounts',
  )
  return withDispatchCounts(rows)
}

/** The row in, the inbox refreshed, the push sent. Throws with the database's reason when the row is refused. */
export async function sendStageCheck(row: StageCheckRow): Promise<{ id: string; pushed: boolean; pushError: string | null }> {
  return sendAsk('dispatch', row)
}

export interface StageCheckDispatchIo {
  job: (jobId: string) => Promise<StageCheckJob>
  open: (jobId: string) => Promise<OpenStageCheck[]>
  send: (row: StageCheckRow) => Promise<{ id: string; pushed: boolean; pushError: string | null }>
  /** The sender's push once a settle on the sheet closed their request (PR 2b); a fake io may leave it out. */
  settled?: (request: OpenStageCheck, who: { userId: string | null }) => Promise<void>
}

export function supabaseStageCheckDispatchIo(): StageCheckDispatchIo {
  return { job: loadStageCheckJob, open: loadOpenStageChecks, send: sendStageCheck, settled: pushSettledStageCheck }
}
