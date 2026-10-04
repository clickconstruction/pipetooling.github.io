import { supabase } from './supabase'
import {
  type PayApplicationRow,
  type PayApplicationWrite,
  type SavedPayApplication,
  savedPayApplicationFromRow,
  sortPayApplications,
} from './aiaPayApplications'

/**
 * Reads and writes behind the AIA window's saved applications (`job_pay_applications`, v2.4490).
 * Who saved a row and when are stamped by the database. The table name is cast until the
 * generated types carry it.
 */

const COLS =
  'id, job_id, application_number, period_to, application_date, fields, contract_sum_to_date, total_completed_and_stored, retainage_pct, retainage_held, total_earned_less_retainage, current_payment_due, updated_at'

/** The number is already taken on this job (the table's unique rule). */
export class PayApplicationNumberTaken extends Error {
  constructor(public readonly applicationNumber: number) {
    super(`Application ${applicationNumber} is already saved on this job.`)
    this.name = 'PayApplicationNumberTaken'
  }
}

/** The job's saved applications in number order. A read that fails (the table not there yet) is no applications. */
export async function loadPayApplications(jobId: string): Promise<SavedPayApplication[]> {
  const { data, error } = await supabase
    .from('job_pay_applications' as never)
    .select(COLS)
    .eq('job_id', jobId)
    .order('application_number')
    .limit(500)
  if (error) return []
  return sortPayApplications(((data ?? []) as unknown as PayApplicationRow[]).map(savedPayApplicationFromRow))
}

/**
 * Save one application: a new row, or the row already open (`id`), which may change its number.
 * Throws `PayApplicationNumberTaken` when another row on the job holds the number.
 */
export async function savePayApplication(write: PayApplicationWrite, id: string | null): Promise<SavedPayApplication> {
  const table = supabase.from('job_pay_applications' as never)
  const query = id
    ? table.update(write as never).eq('id', id).select(COLS).single()
    : table.insert(write as never).select(COLS).single()
  const { data, error } = await query
  if (error) {
    if (error.code === '23505') throw new PayApplicationNumberTaken(write.application_number)
    throw error
  }
  return savedPayApplicationFromRow(data as unknown as PayApplicationRow)
}

export async function deletePayApplication(id: string): Promise<void> {
  const { error } = await supabase.from('job_pay_applications' as never).delete().eq('id', id)
  if (error) throw error
}
