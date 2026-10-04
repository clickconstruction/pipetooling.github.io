import { supabase } from './supabase'
import type { Database } from '../types/database'
import {
  type PayApplicationRow,
  type PayApplicationWrite,
  type SavedPayApplication,
  savedPayApplicationFromRow,
  sortPayApplications,
} from './aiaPayApplications'

/**
 * Reads and writes behind the AIA window's saved applications (`job_pay_applications`, v2.4490).
 * Who saved a row and when are stamped by the database.
 */

type PayApplicationInsert = Database['public']['Tables']['job_pay_applications']['Insert']

const BASE_COLS =
  'id, job_id, application_number, period_to, application_date, fields, contract_sum_to_date, total_completed_and_stored, retainage_pct, retainage_held, total_earned_less_retainage, current_payment_due, files, updated_at'
// `carry_reason` came with a later migration (v2.4494). A database that does not have it yet
// answers 42703 (undefined column); the read and the write then go again without it, so the
// window works on either side of the push.
const COLS = `${BASE_COLS}, carry_reason`
const UNDEFINED_COLUMN = '42703'

/** The number is already taken on this job (the table's unique rule). */
export class PayApplicationNumberTaken extends Error {
  constructor(public readonly applicationNumber: number) {
    super(`Application ${applicationNumber} is already saved on this job.`)
    this.name = 'PayApplicationNumberTaken'
  }
}

/** The job's saved applications in number order. A read that fails (the table not there yet) is no applications. */
export async function loadPayApplications(jobId: string): Promise<SavedPayApplication[]> {
  const read = (cols: string) => supabase.from('job_pay_applications').select(cols).eq('job_id', jobId).order('application_number').limit(500)
  let { data, error } = await read(COLS)
  if (error?.code === UNDEFINED_COLUMN) ({ data, error } = await read(BASE_COLS))
  if (error) return []
  return sortPayApplications(((data ?? []) as unknown as PayApplicationRow[]).map(savedPayApplicationFromRow))
}

/**
 * Save one application: a new row, or the row already open (`id`), which may change its number.
 * Throws `PayApplicationNumberTaken` when another row on the job holds the number.
 */
export async function savePayApplication(write: PayApplicationWrite, id: string | null): Promise<SavedPayApplication> {
  const send = (payload: PayApplicationWrite, cols: string) => {
    // The form (`fields`) and the kept links (`files`) are plain JSON; the kernel types them as its own shapes.
    const row = payload as unknown as PayApplicationInsert
    const table = supabase.from('job_pay_applications')
    return id ? table.update(row).eq('id', id).select(cols).single() : table.insert(row).select(cols).single()
  }
  let { data, error } = await send(write, COLS)
  if (error?.code === UNDEFINED_COLUMN) {
    const { carry_reason: _reason, ...withoutReason } = write
    ;({ data, error } = await send(withoutReason, BASE_COLS))
  }
  if (error) {
    if (error.code === '23505') throw new PayApplicationNumberTaken(write.application_number)
    throw error
  }
  return savedPayApplicationFromRow(data as unknown as PayApplicationRow)
}

export async function deletePayApplication(id: string): Promise<void> {
  const { error } = await supabase.from('job_pay_applications').delete().eq('id', id)
  if (error) throw error
}
