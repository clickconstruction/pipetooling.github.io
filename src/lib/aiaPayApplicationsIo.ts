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
const COLS_WITH_NAME = `${COLS_WITH_LINES}, name`
// The history (v2.4710) reads who saved the row and when: the stamps the table has always
// carried, with the users' names through the two foreign keys. A database where the embed
// cannot be followed answers PGRST200; the read then goes again without it.
const COLS_WITH_STAMPS = `${COLS_WITH_NAME}, created_at, created_by, updated_by, created_by_user:users!job_pay_applications_created_by_fkey(name), updated_by_user:users!job_pay_applications_updated_by_fkey(name)`
// Delete marks the row (v2.4715): `deleted_at` / `deleted_by`, read with the name behind it. The
// live list reads the rows that are not marked; without the column the read goes again unfiltered.
const COLS = `${COLS_WITH_STAMPS}, deleted_at, deleted_by, deleted_by_user:users!job_pay_applications_deleted_by_fkey(name)`
const COLUMN_SETS = [COLS, COLS_WITH_STAMPS, COLS_WITH_NAME, COLS_WITH_LINES, COLS_WITH_REASON, BASE_COLS] as const
const hasDeleted = (cols: string): boolean => cols.includes('deleted_at')
const isUnknownColumn = (code: string | undefined): boolean => code === '42703' || code === 'PGRST204' || code === 'PGRST200'

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

/** The job's live applications in number order. A read that fails (the table not there yet) is no applications. */
export async function loadPayApplications(jobId: string): Promise<SavedPayApplication[]> {
  const read = (cols: string) => {
    const q = supabase.from('job_pay_applications').select(cols).eq('job_id', jobId)
    return (hasDeleted(cols) ? q.is('deleted_at', null) : q).order('application_number').limit(500)
  }
  for (const cols of COLUMN_SETS) {
    const { data, error } = await read(cols)
    if (error && isUnknownColumn(error.code)) continue
    if (error) return []
    return sortPayApplications(((data ?? []) as unknown as PayApplicationRow[]).map(savedPayApplicationFromRow))
  }
  return []
}

/** The applications taken off the job (v2.4715), in number order; none on a database without the mark. */
export async function loadDeletedPayApplications(jobId: string): Promise<SavedPayApplication[]> {
  const { data, error } = await supabase.from('job_pay_applications').select(COLS).eq('job_id', jobId).not('deleted_at', 'is', null).order('application_number').limit(500)
  if (error) return []
  return sortPayApplications(((data ?? []) as unknown as PayApplicationRow[]).map(savedPayApplicationFromRow))
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
    [write, COLS_WITH_STAMPS],
    [write, COLS_WITH_NAME],
    [withLines, COLS_WITH_LINES],
    [carry_reason === undefined ? base : { ...base, carry_reason }, COLS_WITH_REASON],
    [base, BASE_COLS],
  ]
  for (const [i, [payload, cols]] of attempts.entries()) {
    if (i > 3 && needsLines) throw new PayApplicationLinesNotReady()
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

/**
 * Take an application off the job: mark the row (`deleted_at`, stamped on the server), so the
 * history still lists it. On a database without the mark the row is removed, as before.
 */
export async function deletePayApplication(id: string): Promise<void> {
  const marked = await supabase.from('job_pay_applications').update({ deleted_at: new Date().toISOString() } as never).eq('id', id)
  if (!marked.error) return
  if (!isUnknownColumn(marked.error.code)) throw marked.error
  const { error } = await supabase.from('job_pay_applications').delete().eq('id', id)
  if (error) throw error
}

/**
 * Put a deleted application back on the job (#92): clear the mark; the stamp trigger clears who
 * made it and leaves the saved stamps alone. Throws `PayApplicationNumberTaken` when a live
 * application now holds its number (the live-number index refuses the restore).
 */
export async function restorePayApplication(app: Pick<SavedPayApplication, 'id' | 'applicationNumber'>): Promise<void> {
  const { error } = await supabase.from('job_pay_applications').update({ deleted_at: null } as never).eq('id', app.id)
  if (!error) return
  if (error.code === '23505') throw new PayApplicationNumberTaken(app.applicationNumber)
  throw error
}
