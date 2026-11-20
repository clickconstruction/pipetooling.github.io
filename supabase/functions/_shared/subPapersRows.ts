/**
 * The rows a person's sub papers are built from, read through whoever is asking (the dev seat's statement of
 * account). `sub-portal` reads the same rows with the service key for a sub's own page; this reader takes a client,
 * so a signed-in caller reads them under their own row security and a refused read is said, never counted as none.
 *
 * Every read is paged: a long history must not stop at the API's row cap, since a payment left off would read as
 * money still open. Ids go in parts so the address stays short.
 *
 * `subPapersRows.test.ts` holds the tables and columns against the ones `sub-portal` reads.
 */
import type { PapersAssigneeRow, PapersCreditRow, PapersItemRow, PapersPaymentRow, PapersPersonRow, PapersRegisterRow, PapersSendingRow, PapersSheetRow, PapersUserRow, SubPortalPapersRows } from './subPortalPapers.ts'

/** A register row with the day its period ended, which *Since the last statement* starts after. */
export type StatementRegisterRow = PapersRegisterRow & { period_to: string | null }
export type SubPapersRowsRead = SubPortalPapersRows & { register: readonly StatementRegisterRow[] }

type Query = {
  select(columns: string): Query
  in(column: string, values: readonly string[]): Query
  eq(column: string, value: string): Query
  order(column: string, opts: { ascending: boolean }): Query
  range(from: number, to: number): PromiseLike<{ data: unknown; error: unknown }>
}
/** As much of a Supabase client as the reads use. */
export type RowsClient = { from(table: string): unknown }

const PAGE = 1000
const IDS_A_READ = 150

export async function readEveryRow<T>(client: RowsClient, table: string, columns: string, order: readonly string[], filter: { column: string; in: readonly string[] } | { column: string; eq: string }): Promise<T[]> {
  const parts: Array<readonly string[] | null> = []
  if ('in' in filter) for (let i = 0; i < filter.in.length; i += IDS_A_READ) parts.push(filter.in.slice(i, i + IDS_A_READ))
  else parts.push(null)
  const out: T[] = []
  for (const part of parts) {
    for (let from = 0; from < 50000; from += PAGE) {
      let q = (client.from(table) as Query).select(columns)
      q = part ? q.in(filter.column, part) : q.eq(filter.column, (filter as { eq: string }).eq)
      for (const column of order) q = q.order(column, { ascending: true })
      const { data, error } = await q.range(from, from + PAGE - 1)
      if (error) throw new Error(`${table}: ${(error as { message?: string }).message ?? 'read refused'}`)
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
  }
  return out
}

export const SHEET_COLUMNS = 'id, assigned_to_name, address, job_number, job_ledger_id, job_date, created_at, labor_rate'
export const ITEM_COLUMNS = 'job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order'
export const PAYMENT_COLUMNS = 'id, job_id, amount, memo, payment_date, created_at, hidden_from_sub, method, method_ref, sending_id'
export const REGISTER_COLUMNS = 'id, kind, number, revision, labor_job_id, sending_id, payment_id, issued_at, replaced_by, voided_at, fingerprint, period_to'

/** Every sheet the person is named on, with all that the papers read about them. What the sub answered is left out: it is no figure. */
export async function readSubPapersRows(client: RowsClient, personId: string): Promise<SubPapersRowsRead> {
  const named = await readEveryRow<PapersAssigneeRow>(client, 'people_labor_job_assignees', 'labor_job_id, person_id', ['labor_job_id', 'person_id'], { column: 'person_id', eq: personId })
  const laborJobIds = [...new Set(named.map((r) => r.labor_job_id))]
  const register = await readEveryRow<StatementRegisterRow>(client, 'sub_papers', REGISTER_COLUMNS, ['id'], { column: 'person_id', eq: personId })
  if (laborJobIds.length === 0) return { personId, sheets: [], items: [], payments: [], assignees: [], people: [], users: [], jobNames: {}, sendings: [], credits: [], register, acks: [] }
  const sheets = await readEveryRow<PapersSheetRow>(client, 'people_labor_jobs', SHEET_COLUMNS, ['id'], { column: 'id', in: laborJobIds })
  const items = await readEveryRow<PapersItemRow>(client, 'people_labor_job_items', ITEM_COLUMNS, ['job_id', 'sequence_order', 'id'], { column: 'job_id', in: laborJobIds })
  const payments = await readEveryRow<PapersPaymentRow>(client, 'people_labor_job_payments', PAYMENT_COLUMNS, ['id'], { column: 'job_id', in: laborJobIds })
  // Everyone named on those sheets: who else is on a sheet decides whether it is this person's alone.
  const assignees = await readEveryRow<PapersAssigneeRow>(client, 'people_labor_job_assignees', 'labor_job_id, person_id', ['labor_job_id', 'person_id'], { column: 'labor_job_id', in: laborJobIds })
  const personIds = [...new Set(assignees.map((a) => a.person_id))]
  const people = personIds.length > 0 ? await readEveryRow<PapersPersonRow>(client, 'people', 'id, name, kind, account_user_id', ['id'], { column: 'id', in: personIds }) : []
  const userIds = [...new Set(people.map((p) => p.account_user_id ?? '').filter(Boolean))]
  const users = userIds.length > 0 ? await readEveryRow<PapersUserRow>(client, 'users', 'id, role', ['id'], { column: 'id', in: userIds }) : []
  const ledgerIds = [...new Set(sheets.map((s) => s.job_ledger_id ?? '').filter(Boolean))]
  const jobNames: Record<string, string> = {}
  if (ledgerIds.length > 0) {
    for (const j of await readEveryRow<{ id: string; job_name: string | null }>(client, 'jobs_ledger', 'id, job_name', ['id'], { column: 'id', in: ledgerIds })) {
      const name = (j.job_name ?? '').trim()
      if (name) jobNames[j.id] = name
    }
  }
  const sendingIds = [...new Set(payments.map((p) => p.sending_id ?? '').filter(Boolean))]
  const sendings = sendingIds.length > 0 ? await readEveryRow<PapersSendingRow>(client, 'sub_payment_sendings', 'id, number', ['id'], { column: 'id', in: sendingIds }) : []
  const paymentIds = payments.map((p) => p.id)
  const credits = paymentIds.length > 0 ? await readEveryRow<PapersCreditRow>(client, 'sub_credit_entries', 'id, payment_id, amount', ['id'], { column: 'payment_id', in: paymentIds }) : []
  return { personId, sheets, items, payments, assignees, people, users, jobNames, sendings, credits, register, acks: [] }
}
