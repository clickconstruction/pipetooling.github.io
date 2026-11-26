/**
 * Deleting a by-hand notice record (punch list #443, row 1): the fresh reads and the delete, and the read and the
 * clear of a test job's stray Activity lines. The rule is `lienByHandRecordDelete.ts`.
 *
 * The reads run as the signed-in person. The delete and the clear are two functions of the database,
 * `delete_test_lien_notice_record` and `delete_test_lien_notice_stray_lines`. Each holds every rule itself: a
 * developer, a ZZ test job, and for a record a voided notice recorded by hand that nothing points at. A signed-in
 * person can only read the job's Activity, so the line goes through the function or not at all. Its refusal is
 * passed on in its own words. Neither function is in the generated types until the types PR after the push, so each
 * is called by name, as the other take-backs call theirs.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { LIEN_NOTICE_ACTIVITY_EVENT, lienByHandDeleteProblem, lienByHandTiesProblem, type LienByHandJob, type LienByHandRecord, type LienNoticeActivityLine, type LienRecordTies } from './lienByHandRecordDelete'

async function count(read: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const result = await read()
  if (result.error) throw result.error
  if (typeof result.count !== 'number') throw new Error('What points at this record could not be read. Nothing was deleted.')
  return result.count
}

/** How many rows point at a record: desk papers, bills, records applied from it, sent copies. Throws when a read fails, so a record is never deleted on no answer. */
export async function readLienRecordTies(id: string): Promise<LienRecordTies> {
  const [deskPapers, bills, appliedFrom, sentCopies] = await Promise.all([
    count(() => supabase.from('job_lien_desk_items').select('id', { count: 'exact' }).eq('sent_filing_id', id).limit(1)),
    count(() => supabase.from('jobs_ledger_invoices').select('id', { count: 'exact' }).eq('lien_offer_filing_id', id).limit(1)),
    count(() => supabase.from('job_lien_filings').select('id', { count: 'exact' }).eq('applied_from', id).limit(1)),
    count(() => supabase.from('sent_documents').select('id', { count: 'exact' }).eq('source_table', 'job_lien_filings').eq('source_id', id).limit(1)),
  ])
  return { deskPapers, bills, appliedFrom, sentCopies }
}

/** How many other records the same paper wrote: the rows that share the record's packet. None for a record with no packet. */
export async function countLienPacketSiblings(record: Pick<LienByHandRecord, 'id' | 'packet_id'>): Promise<number> {
  const packet = record.packet_id
  if (!packet) return 0
  return count(() => supabase.from('job_lien_filings').select('id', { count: 'exact' }).eq('packet_id', packet).neq('id', record.id).limit(1))
}

/** The record as the database holds it now, with its job's names. Null record: it is gone. Throws when a read fails. */
export async function readLienByHandRecord(id: string): Promise<{ record: LienByHandRecord | null; job: LienByHandJob | null }> {
  const rows = await withSupabaseRetry(() => supabase.from('job_lien_filings').select('id, job_id, kind, by_hand, voided_at, packet_id').eq('id', id).limit(1), 'read the record')
  const record = rows?.[0] ?? null
  if (!record) return { record: null, job: null }
  const jobs = await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, job_name, customer_name').eq('id', record.job_id).limit(1), 'read the job')
  const job = jobs?.[0]
  return { record, job: job ? { job_name: job.job_name, customer_name: job.customer_name } : null }
}

/** What a function answered, when it answered `{ ok: true, … }`; null for anything else. */
function okAnswer(answer: unknown): Record<string, unknown> | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null
  const a = answer as Record<string, unknown>
  return a.ok === true ? a : null
}

/**
 * Delete one voided by-hand notice record, with its line on the job's Activity. The record and its job are read
 * again here, then what points at it, and a record that fails either rule is refused with its reason before
 * anything is sent. Then `delete_test_lien_notice_record` is called once. It checks all of it again and takes the
 * record and its line in one transaction, and its refusal is thrown in its own words.
 */
export async function deleteLienByHandRecord(id: string): Promise<void> {
  const { record, job } = await readLienByHandRecord(id)
  const fixed = lienByHandDeleteProblem(record, job)
  if (fixed) throw new Error(fixed)
  const tied = lienByHandTiesProblem(await readLienRecordTies(id))
  if (tied) throw new Error(tied)
  const answer = await withSupabaseRetry(
    () => supabase.rpc('delete_test_lien_notice_record' as never, { p_filing_id: id } as never),
    'delete the record',
    { maxRetries: 0 },
  )
  if (!okAnswer(answer)) throw new Error('The record was not deleted. The database gave no answer.')
}

/** The job's notice lines on its Activity, as the signed-in person may read them. Throws when the read fails. */
export async function readLienNoticeActivityLines(jobId: string): Promise<LienNoticeActivityLine[]> {
  const rows = await withSupabaseRetry(() => supabase.from('job_activity_events').select('id, detail').eq('job_id', jobId).eq('event_type', LIEN_NOTICE_ACTIVITY_EVENT), 'read the job’s notice lines')
  return (rows ?? []).map((row) => ({ id: row.id, detail: row.detail }))
}

/**
 * Clear a test job's stray notice lines: `delete_test_lien_notice_stray_lines`, called once. The function decides
 * which lines are strays and refuses a job that is not a test job. Answers how many lines it cleared, and zero is
 * an answer.
 */
export async function clearLienNoticeStrayLines(jobId: string): Promise<number> {
  const answer = await withSupabaseRetry(
    () => supabase.rpc('delete_test_lien_notice_stray_lines' as never, { p_job_id: jobId } as never),
    'clear the Activity lines',
    { maxRetries: 0 },
  )
  const a = okAnswer(answer)
  if (!a) throw new Error('The Activity lines were not cleared. The database gave no answer.')
  const cleared = Number(a.activity_lines)
  return Number.isFinite(cleared) && cleared > 0 ? Math.floor(cleared) : 0
}
