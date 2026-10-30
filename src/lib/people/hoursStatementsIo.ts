/**
 * The reads and the one write over `hours_statements` (punch list #212, PR 2): the statements on a job or on a person,
 * and Save, which mints the record id per job and keeps the window's read as the snapshot the paper prints again
 * from. The table is read through its own name until the generated types catch up (`chore(types)` after the push);
 * the rows are typed here by hand. Every call is RLS-bound through `withSupabaseRetry`: the payroll roles see every
 * row, an assistant the hours-only ones (`can_touch_hours_statement`).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { HoursStatementInput, HoursStatementStatedDay } from './hoursStatement'
import { nextHoursStatementRecordId, type HoursStatementState } from './hoursStatementRecord'

/** The window's read as it stood when the row was saved: enough to print the paper again exactly. */
export type HoursStatementSnapshot = {
  input: HoursStatementInput
  worker: { name: string; standing: string; company?: string | null }
  job: { number: string; name: string; customer: string | null; site: string; isOfficeJob: boolean }
  approvedBy: string | null
  preparedBy: string
  /** `October 29, 2026`. */
  preparedOn: string
  /** When the rows were read, e.g. `October 29, 2026 6:12 pm`. */
  asOf: string
}

export type HoursStatementRecordRow = {
  id: string
  record_id: string
  job_ledger_id: string
  person_id: string | null
  user_id: string
  labor_company: string | null
  period_start: string
  period_end: string
  with_pay: boolean
  kind: 'clock' | 'sheet' | 'schedule'
  stated_days: HoursStatementStatedDay[]
  gap_from: string | null
  gap_to: string | null
  snapshot: HoursStatementSnapshot | null
  prepared_by: string | null
  prepared_at: string
  contract_document_id: string | null
  matter_document_id: string | null
  state: HoursStatementState
  created_at: string
  updated_at: string
  worker: { name: string | null } | null
  prepared_by_user: { name: string | null } | null
  job: { hcp_number: string | null; click_number: string | null; job_name: string | null } | null
}

const TABLE = 'hours_statements' as never
const COLUMNS =
  'id, record_id, job_ledger_id, person_id, user_id, labor_company, period_start, period_end, with_pay, kind, stated_days, gap_from, gap_to, snapshot, prepared_by, prepared_at, contract_document_id, matter_document_id, state, created_at, updated_at, worker:users!hours_statements_user_id_fkey(name), prepared_by_user:users!hours_statements_prepared_by_fkey(name), job:jobs_ledger!hours_statements_job_ledger_id_fkey(hcp_number, click_number, job_name)'

/** Every statement on the job, newest first. */
export async function listHoursStatementsForJob(jobId: string): Promise<HoursStatementRecordRow[]> {
  const rows = await withSupabaseRetry(() => supabase.from(TABLE).select(COLUMNS).eq('job_ledger_id', jobId).order('prepared_at', { ascending: false }), 'read the hours statements on the job')
  return (rows ?? []) as unknown as HoursStatementRecordRow[]
}

/** Every statement for the person (by their login), newest first. */
export async function listHoursStatementsForUser(userId: string): Promise<HoursStatementRecordRow[]> {
  const rows = await withSupabaseRetry(() => supabase.from(TABLE).select(COLUMNS).eq('user_id', userId).order('prepared_at', { ascending: false }), 'read the person’s hours statements')
  return (rows ?? []) as unknown as HoursStatementRecordRow[]
}

export type HoursStatementSave = {
  /** The row to update, or null to make one. */
  id: string | null
  jobId: string
  /** The job's number as the papers print it; the record id is minted from it. */
  jobNumber: string
  userId: string
  personId: string | null
  laborCompany: string | null
  periodStart: string
  periodEnd: string
  withPay: boolean
  kind: 'clock' | 'sheet' | 'schedule'
  statedDays: HoursStatementStatedDay[]
  gap: { from: string; to: string } | null
  snapshot: HoursStatementSnapshot
  state: HoursStatementState
  preparedBy: string | null
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e != null && (e as { code?: unknown }).code === '23505'
}

/**
 * Save a statement: a new row takes the job's next record id (one past the highest on the job; a race on the unique
 * key reads again and takes the next), an existing one keeps its id and takes the new read, switches and state.
 */
export async function saveHoursStatement(args: HoursStatementSave): Promise<HoursStatementRecordRow> {
  const now = new Date().toISOString()
  const body = {
    job_ledger_id: args.jobId,
    person_id: args.personId,
    user_id: args.userId,
    labor_company: args.laborCompany,
    period_start: args.periodStart,
    period_end: args.periodEnd,
    with_pay: args.withPay,
    kind: args.kind,
    stated_days: args.statedDays,
    gap_from: args.gap?.from ?? null,
    gap_to: args.gap?.to ?? null,
    snapshot: args.snapshot,
    state: args.state,
    updated_at: now,
  }
  if (args.id) {
    const row = await withSupabaseRetry(() => supabase.from(TABLE).update(body as never).eq('id', args.id as string).select(COLUMNS).single(), 'save the hours statement')
    return row as unknown as HoursStatementRecordRow
  }
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = (await withSupabaseRetry(() => supabase.from(TABLE).select('record_id').eq('job_ledger_id', args.jobId), 'read the job’s statement ids')) as unknown as Array<{ record_id: string }> | null
    const recordId = nextHoursStatementRecordId(args.jobNumber, (existing ?? []).map((r) => r.record_id))
    try {
      const row = await withSupabaseRetry(
        () => supabase.from(TABLE).insert({ ...body, record_id: recordId, prepared_by: args.preparedBy, prepared_at: now } as never).select(COLUMNS).single(),
        'save the hours statement',
      )
      return row as unknown as HoursStatementRecordRow
    } catch (e: unknown) {
      lastError = e
      if (!isUniqueViolation(e)) throw e
    }
  }
  throw lastError
}
