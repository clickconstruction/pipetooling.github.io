/**
 * The saved Statements of charges (punch list #254, PR 2): the rows on a job, and the save that mints the record id
 * (one past the highest on the job; a race on the unique key reads again). Through a cast until the types catch up.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { nextChargeStatementRecordId, type ChargeStatementSnapshot, type ChargeStatementState } from './statementOfCharges'

const TABLE = 'job_charge_statements' as never
const COLUMNS = 'id, record_id, job_ledger_id, period_start, period_end, snapshot, labor_usd, materials_usd, charges_usd, premium_usd, state, prepared_by, prepared_at, created_at, updated_at, prepared_by_user:users!job_charge_statements_prepared_by_fkey(name)'

export type ChargeStatementRow = {
  id: string
  record_id: string
  job_ledger_id: string
  period_start: string
  period_end: string
  snapshot: ChargeStatementSnapshot | null
  labor_usd: number | null
  materials_usd: number | null
  charges_usd: number | null
  premium_usd: number | null
  state: ChargeStatementState
  prepared_by: string | null
  prepared_at: string
  created_at: string
  updated_at: string
  prepared_by_user: { name: string | null } | null
}

export async function listChargeStatementsForJob(jobId: string): Promise<ChargeStatementRow[]> {
  const rows = await withSupabaseRetry(() => supabase.from(TABLE).select(COLUMNS).eq('job_ledger_id', jobId).order('prepared_at', { ascending: false }), 'read the statements of charges on the job')
  return (rows ?? []) as unknown as ChargeStatementRow[]
}

export type ChargeStatementSave = {
  id: string | null
  jobId: string
  jobNumber: string
  snapshot: ChargeStatementSnapshot
  figures: { laborUsd: number; materialsUsd: number; chargesUsd: number; premiumUsd: number }
  state: ChargeStatementState
  preparedBy: string | null
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e != null && (e as { code?: unknown }).code === '23505'
}

export async function saveChargeStatement(args: ChargeStatementSave): Promise<ChargeStatementRow> {
  const now = new Date().toISOString()
  const body = {
    job_ledger_id: args.jobId,
    period_start: args.snapshot.period.start,
    period_end: args.snapshot.period.end,
    snapshot: args.snapshot,
    labor_usd: args.figures.laborUsd,
    materials_usd: args.figures.materialsUsd,
    charges_usd: args.figures.chargesUsd,
    premium_usd: args.figures.premiumUsd,
    state: args.state,
    updated_at: now,
  }
  if (args.id) {
    const row = await withSupabaseRetry(() => supabase.from(TABLE).update(body as never).eq('id', args.id as string).select(COLUMNS).single(), 'save the statement of charges')
    return row as unknown as ChargeStatementRow
  }
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = (await withSupabaseRetry(() => supabase.from(TABLE).select('record_id').eq('job_ledger_id', args.jobId), 'read the job’s statement ids')) as unknown as Array<{ record_id: string }> | null
    const recordId = nextChargeStatementRecordId(args.jobNumber, (existing ?? []).map((r) => r.record_id))
    try {
      const row = await withSupabaseRetry(() => supabase.from(TABLE).insert({ ...body, record_id: recordId, prepared_by: args.preparedBy, prepared_at: now } as never).select(COLUMNS).single(), 'save the statement of charges')
      return row as unknown as ChargeStatementRow
    } catch (e: unknown) {
      lastError = e
      if (!isUniqueViolation(e)) throw e
    }
  }
  throw lastError
}
