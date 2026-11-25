/**
 * Deleting a by-hand record of a test bill (punch list #443, row 4): the fresh read and the delete. The rule is
 * `byHandRecordDelete.ts`.
 *
 * Both run as the signed-in person. The table's own policy lets a dev delete and nobody else
 * (`sent_documents_delete_dev`), so a delete by any other role reaches no row and is said as a refusal.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BY_HAND_RECORD_BILL_TABLE, BY_HAND_RECORD_KIND, byHandRowDeleteProblem, type ByHandRecordRow } from './byHandRecordDelete'

/**
 * The record as the database holds it now, with the bill it names and that bill's job. Null when the record is not
 * there. A bill or a job that does not read is left null, which the rule takes as a real bill. Throws when a read fails.
 */
export async function readByHandRecordRow(id: string): Promise<ByHandRecordRow | null> {
  const copies = await withSupabaseRetry(() => supabase.from('sent_documents').select('id, kind, copy_path, source_table, source_id').eq('id', id).limit(1), 'read the record')
  const copy = copies?.[0]
  if (!copy) return null
  const row: ByHandRecordRow = { kind: copy.kind, copyPath: copy.copy_path, sourceTable: copy.source_table, bill: null, job: null }
  if (copy.source_table !== BY_HAND_RECORD_BILL_TABLE || !copy.source_id) return row
  const billId = copy.source_id
  const bills = await withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, stripe_mode').eq('id', billId).limit(1), 'read the bill')
  const bill = bills?.[0]
  if (!bill) return row
  row.bill = { id: bill.id, stripeMode: bill.stripe_mode }
  const jobId = bill.job_id
  if (!jobId) return row
  const jobs = await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, job_name, customer_name').eq('id', jobId).limit(1), 'read the job')
  const job = jobs?.[0]
  if (job) row.job = { job_name: job.job_name, customer_name: job.customer_name }
  return row
}

/**
 * Delete one by-hand record. The row is read again here, with its bill and its job, and a record that fails the
 * rule is refused with its reason. The delete names only a by-hand row with no copy, and a delete that reaches no
 * row is said. The delete is sent once: a second send after a lost answer would find no row and call a record that
 * went still there.
 */
export async function deleteByHandRecord(id: string): Promise<void> {
  const problem = byHandRowDeleteProblem(await readByHandRecordRow(id))
  if (problem) throw new Error(problem)
  const gone = await withSupabaseRetry(() => supabase.from('sent_documents').delete().eq('id', id).eq('kind', BY_HAND_RECORD_KIND).is('copy_path', null).select('id'), 'delete the record', { maxRetries: 0 })
  if (!gone || gone.length === 0) throw new Error('The record was not deleted. You may not have leave to delete it.')
}
