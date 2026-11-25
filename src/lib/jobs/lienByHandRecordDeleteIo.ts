/**
 * Deleting a by-hand notice record (punch list #443, row 1): the fresh reads and the delete. The rule is
 * `lienByHandRecordDelete.ts`.
 *
 * All of it runs as the signed-in person. The table's own policy lets a dev delete and nobody else
 * (`job_lien_filings_delete_dev`), so a delete by any other role reaches no row and is said as a refusal.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { LIEN_BY_HAND_NOTICE_KIND, lienByHandDeleteProblem, lienByHandTiesProblem, type LienByHandJob, type LienByHandRecord, type LienRecordTies } from './lienByHandRecordDelete'

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

/**
 * Delete one voided by-hand notice record. The record and its job are read again here, then what points at it, and
 * a record that fails either rule is refused with its reason. The delete names only a voided by-hand notice, is sent
 * once, and says so when it reaches no row.
 */
export async function deleteLienByHandRecord(id: string): Promise<void> {
  const { record, job } = await readLienByHandRecord(id)
  const fixed = lienByHandDeleteProblem(record, job)
  if (fixed) throw new Error(fixed)
  const tied = lienByHandTiesProblem(await readLienRecordTies(id))
  if (tied) throw new Error(tied)
  const gone = await withSupabaseRetry(
    () => supabase.from('job_lien_filings').delete().eq('id', id).eq('kind', LIEN_BY_HAND_NOTICE_KIND).eq('by_hand', true).not('voided_at', 'is', null).select('id'),
    'delete the record',
    { maxRetries: 0 },
  )
  if (!gone || gone.length === 0) throw new Error('The record was not deleted. You may not have leave to delete it.')
}
