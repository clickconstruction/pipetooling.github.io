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
// Three later migrations added columns: `carry_reason` (v2.4494), then `lines` and
// `split_labor_material` (v2.4498), then `name` (v2.4508). A database that does not have one yet
// answers 42703 (a selected column is unknown) or PGRST204 (a written one is). The read then goes
// again with the columns it had before; the write does too, unless that would drop lines it
// cannot keep.
const COLS_WITH_REASON = `${BASE_COLS}, carry_reason`
const COLS_WITH_LINES = `${COLS_WITH_REASON}, lines, split_labor_material`
const COLS = `${COLS_WITH_LINES}, name`
const COLUMN_SETS = [COLS, COLS_WITH_LINES, COLS_WITH_REASON, BASE_COLS] as const
const isUnknownColumn = (code: string | undefined): boolean => code === '42703' || code === 'PGRST204'

/** The database cannot keep this application's lines yet (the lines migration is not applied). */
export class PayApplicationLinesNotReady extends Error {
  constructor() {
    super('The database is being updated to keep more than one line. Try again in a few minutes.')
    this.name = 'PayApplicationLinesNotReady'
  }
}

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
  for (const cols of COLUMN_SETS) {
    const { data, error } = await read(cols)
    if (error && isUnknownColumn(error.code)) continue
    if (error) return []
    return sortPayApplications(((data ?? []) as unknown as PayApplicationRow[]).map(savedPayApplicationFromRow))
  }
  return []
}

/**
 * Save one application: a new row, or the row already open (`id`), which may change its number.
 * Throws `PayApplicationNumberTaken` when another row on the job holds the number, and
 * `PayApplicationLinesNotReady` when the database cannot keep its lines yet.
 */
export async function savePayApplication(write: PayApplicationWrite, id: string | null): Promise<SavedPayApplication> {
  const send = (payload: Record<string, unknown>, cols: string) => {
    // The form (`fields`), the lines and the kept links (`files`) are plain JSON; the kernel types them as its own shapes.
    const row = payload as unknown as PayApplicationInsert
    const table = supabase.from('job_pay_applications')
    return id ? table.update(row).eq('id', id).select(cols).single() : table.insert(row).select(cols).single()
  }
  const { name: _name, ...withLines } = write
  const { lines, split_labor_material, carry_reason, ...base } = withLines
  // One line also lives in `fields`, so an older database keeps it; more than one, or split rows, it cannot.
  const needsLines = (Array.isArray(lines) && lines.length > 1) || split_labor_material === true
  const attempts: Array<[Record<string, unknown>, string]> = [
    [write, COLS],
    [withLines, COLS_WITH_LINES],
    [carry_reason === undefined ? base : { ...base, carry_reason }, COLS_WITH_REASON],
    [base, BASE_COLS],
  ]
  for (const [i, [payload, cols]] of attempts.entries()) {
    if (i > 1 && needsLines) throw new PayApplicationLinesNotReady()
    const { data, error } = await send(payload, cols)
    if (error && isUnknownColumn(error.code) && i < attempts.length - 1) continue
    if (error) {
      if (error.code === '23505') throw new PayApplicationNumberTaken(write.application_number)
      throw error
    }
    return savedPayApplicationFromRow(data as unknown as PayApplicationRow)
  }
  throw new Error('The application could not be saved.')
}

export async function deletePayApplication(id: string): Promise<void> {
  const { error } = await supabase.from('job_pay_applications').delete().eq('id', id)
  if (error) throw error
}
