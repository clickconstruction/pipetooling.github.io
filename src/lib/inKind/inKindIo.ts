/**
 * One place for work paid in kind (punch list #301): the reads and the writes.
 *
 * Reads go through RLS (the office reads a deal, its lines and their payments). A line is written only by the
 * database functions; each answers `{ok, …}` or `{error}`, and an `{error}` is thrown here with its own words so the
 * screen shows the reason.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isInKindPaymentType } from '../jobs/inKindPayment'
import { parseInKindAddResult, type InKindAddResult, type InKindArrangement, type InKindJob, type InKindLine, type InKindPayment } from './inKindLedger'

export interface InKindBill {
  id: string
  job_id: string
  amount: number | null
  status: string | null
  billed_at: string | null
  stripe_invoice_id: string | null
}

export interface InKindLedgerJob extends InKindJob {
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  created_at: string | null
  in_kind_arrangement_id: string | null
  invoices: InKindBill[]
}

/** A job a line can be counted on, as the ledger names it. */
export interface InKindCostJob {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
}

export interface InKindLedgerData {
  arrangement: InKindArrangement
  jobs: InKindLedgerJob[]
  /** Every line, taken back or not, newest first. */
  lines: InKindLine[]
  /** In kind payments on the deal's jobs, by a line or by hand. */
  payments: InKindPayment[]
  /** The jobs its lines count on, by id. */
  costJobs: Map<string, InKindCostJob>
}

const ARRANGEMENT_COLS = 'id, customer_id, partner_name, what_given, note, monthly_amount, monthly_due, bank_payee, starts_on, ended_at'
const JOB_COLS = 'id, hcp_number, click_number, job_name, status, revenue, payments_made, created_at, in_kind_arrangement_id'
const BILL_COLS = 'id, job_id, amount, status, billed_at, stripe_invoice_id'

type LineRow = InKindLine & { payments: Array<{ payment_id: string }> | null }

const n = (v: unknown): number | null => (v == null ? null : Number(v))

function toArrangement(r: Record<string, unknown>): InKindArrangement {
  return {
    id: String(r.id),
    customer_id: (r.customer_id as string | null) ?? null,
    partner_name: String(r.partner_name ?? ''),
    what_given: String(r.what_given ?? ''),
    note: String(r.note ?? ''),
    monthly_amount: n(r.monthly_amount),
    monthly_due: n(r.monthly_due),
    bank_payee: String(r.bank_payee ?? ''),
    starts_on: (r.starts_on as string | null) ?? null,
    ended_at: (r.ended_at as string | null) ?? null,
  }
}

/** The deals with their jobs, lines and payments, for a list of deal rows already read. */
async function assemble(arrangements: InKindArrangement[]): Promise<InKindLedgerData[]> {
  if (arrangements.length === 0) return []
  const ids = arrangements.map((a) => a.id)
  const [jobRows, lineRows] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('jobs_ledger').select(`${JOB_COLS}, invoices:jobs_ledger_invoices(${BILL_COLS})`).in('in_kind_arrangement_id', ids).order('created_at', { ascending: true }),
      'read the jobs the arrangement pays',
    ),
    withSupabaseRetry(
      () =>
        supabase
          .from('in_kind_lines')
          .select('id, arrangement_id, given_on, amount, memo, cost_job_id, for_month, removed_at, payments:in_kind_line_payments(payment_id)')
          .in('arrangement_id', ids)
          .order('given_on', { ascending: false })
          .order('created_at', { ascending: false }),
      'read what was given in kind',
    ),
  ])
  const jobs = ((jobRows ?? []) as unknown as Array<InKindLedgerJob & { invoices: InKindBill[] | null }>).map((j) => ({ ...j, invoices: j.invoices ?? [] }))
  const lines = (lineRows ?? []) as unknown as LineRow[]
  const lineByPayment = new Map<string, string>()
  for (const l of lines) for (const p of l.payments ?? []) lineByPayment.set(p.payment_id, l.id)

  const jobIds = jobs.map((j) => j.id)
  const costJobIds = [...new Set(lines.map((l) => l.cost_job_id).filter((x): x is string => Boolean(x)))]
  const [payRows, costRows] = await Promise.all([
    jobIds.length
      ? withSupabaseRetry(
          () => supabase.from('jobs_ledger_payments').select('id, job_id, invoice_id, amount, paid_on, note, payment_type').in('job_id', jobIds).order('paid_on', { ascending: false }),
          'read the In kind payments',
        )
      : Promise.resolve([]),
    costJobIds.length
      ? withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', costJobIds), 'read the jobs the lines count on')
      : Promise.resolve([]),
  ])
  const payments = ((payRows ?? []) as Array<{ id: string; job_id: string; invoice_id: string | null; amount: number | null; paid_on: string | null; note: string | null; payment_type: string | null }>)
    .filter((p) => isInKindPaymentType(p.payment_type))
    .map<InKindPayment & { arrangementJob: string }>((p) => ({
      id: p.id,
      job_id: p.job_id,
      invoice_id: p.invoice_id,
      amount: Number(p.amount ?? 0),
      paid_on: p.paid_on,
      note: p.note,
      line_id: lineByPayment.get(p.id) ?? null,
      arrangementJob: p.job_id,
    }))
  const costJobs = new Map<string, InKindCostJob>()
  for (const j of jobs) costJobs.set(j.id, { id: j.id, hcp_number: j.hcp_number, click_number: j.click_number, job_name: j.job_name })
  for (const j of (costRows ?? []) as InKindCostJob[]) costJobs.set(j.id, j)

  return arrangements.map((arrangement) => {
    const myJobs = jobs.filter((j) => j.in_kind_arrangement_id === arrangement.id)
    const myJobIds = new Set(myJobs.map((j) => j.id))
    return {
      arrangement,
      jobs: myJobs,
      lines: lines.filter((l) => l.arrangement_id === arrangement.id).map(({ payments: _p, ...l }) => ({ ...l, amount: Number(l.amount ?? 0) })),
      payments: payments.filter((p) => myJobIds.has(p.job_id)).map(({ arrangementJob: _a, ...p }) => p),
      costJobs,
    }
  })
}

/** A customer's deals, the open ones first. Empty for a customer with none. */
export async function loadCustomerInKind(customerId: string): Promise<InKindLedgerData[]> {
  const rows = await withSupabaseRetry(
    () => supabase.from('in_kind_arrangements').select(ARRANGEMENT_COLS).eq('customer_id', customerId).order('created_at', { ascending: true }),
    'read what this customer pays in kind',
  )
  const arrangements = ((rows ?? []) as unknown as Record<string, unknown>[]).map(toArrangement)
  const all = await assemble(arrangements)
  return all.sort((a, b) => Number(Boolean(a.arrangement.ended_at)) - Number(Boolean(b.arrangement.ended_at)))
}

/** One deal, read again after a write. Null when it is gone. */
export async function loadInKindArrangement(arrangementId: string): Promise<InKindLedgerData | null> {
  const rows = await withSupabaseRetry(() => supabase.from('in_kind_arrangements').select(ARRANGEMENT_COLS).eq('id', arrangementId), 'read the in kind arrangement')
  const all = await assemble(((rows ?? []) as unknown as Record<string, unknown>[]).map(toArrangement))
  return all[0] ?? null
}

/** The customer's jobs a deal could pay: theirs, or ones they are the GC on. Newest first. */
export async function loadInKindCandidateJobs(customerId: string): Promise<InKindLedgerJob[]> {
  const rows = await withSupabaseRetry(
    () =>
      supabase
        .from('jobs_ledger')
        .select(`${JOB_COLS}, invoices:jobs_ledger_invoices(${BILL_COLS})`)
        .or(`customer_id.eq.${customerId},gc_customer_id.eq.${customerId}`)
        .order('created_at', { ascending: false })
        .limit(500),
    'read this customer’s jobs',
  )
  return ((rows ?? []) as unknown as Array<InKindLedgerJob & { invoices: InKindBill[] | null }>).map((j) => ({ ...j, invoices: j.invoices ?? [] }))
}

// ---------- writes ----------

function answer(data: unknown, error: { message: string } | null): Record<string, unknown> {
  if (error) throw error
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (typeof o.error === 'string' && o.error) throw new Error(o.error)
  return o
}

export interface InKindTermsInput {
  customer_id: string
  what_given: string
  note: string
  monthly_amount: number | null
  monthly_due: number | null
  bank_payee: string
  starts_on: string | null
}

/** Makes a deal (no id) or changes one, then sets its jobs. Returns the deal's id. */
export async function saveInKindTerms(args: { id: string | null; terms: InKindTermsInput; jobIds: string[]; userId: string }): Promise<string> {
  const { terms } = args
  const row = {
    what_given: terms.what_given.trim(),
    note: terms.note.trim(),
    monthly_amount: terms.monthly_amount,
    monthly_due: terms.monthly_amount == null ? null : terms.monthly_due,
    bank_payee: terms.monthly_amount == null ? '' : terms.bank_payee.trim(),
    starts_on: terms.monthly_amount == null ? null : terms.starts_on,
  }
  let id = args.id
  if (id) {
    const { error } = await supabase.from('in_kind_arrangements').update(row).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase
      .from('in_kind_arrangements')
      .insert({ ...row, customer_id: terms.customer_id, created_by: args.userId })
      .select('id')
      .single()
    if (error) throw error
    id = String((data as { id: string }).id)
  }
  const res = await supabase.rpc('in_kind_arrangement_set_jobs', { p_arrangement_id: id, p_job_ids: args.jobIds })
  answer(res.data, res.error)
  return id
}

export interface InKindLineInput {
  arrangementId: string
  givenOn: string
  amount: number
  memo: string
  costJobId: string | null
  forMonth: string | null
}

/** Where a line would go (`dryRun`), or the line itself. */
export async function addInKindLine(input: InKindLineInput, dryRun: boolean): Promise<InKindAddResult> {
  const res = await supabase.rpc('in_kind_line_add', {
    p_arrangement_id: input.arrangementId,
    p_given_on: input.givenOn,
    p_amount: input.amount,
    p_memo: input.memo,
    p_cost_job_id: input.costJobId ?? undefined,
    p_for_month: input.forMonth ?? undefined,
    p_dry_run: dryRun,
  })
  return parseInKindAddResult(answer(res.data, res.error))
}

export async function removeInKindLine(lineId: string): Promise<void> {
  const res = await supabase.rpc('in_kind_line_remove', { p_line_id: lineId })
  answer(res.data, res.error)
}

/** A job id counts the line on that job; null counts it as overhead. */
export async function setInKindLineCost(lineId: string, costJobId: string | null): Promise<void> {
  const res = await supabase.rpc('in_kind_line_set_cost', { p_line_id: lineId, p_cost_job_id: costJobId as string })
  answer(res.data, res.error)
}

/** Ends a deal: it takes no more lines and its jobs' bills read as ordinary bills again. */
export async function endInKindArrangement(arrangementId: string): Promise<void> {
  const { error } = await supabase.from('in_kind_arrangements').update({ ended_at: new Date().toISOString() }).eq('id', arrangementId)
  if (error) throw error
}

/** Removes a deal made by mistake. The database keeps one that has a line standing on it. */
export async function deleteInKindArrangement(arrangementId: string): Promise<boolean> {
  const { data, error } = await supabase.from('in_kind_arrangements').delete().eq('id', arrangementId).select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** Jobs to count a line on, found by number, name or address. */
export async function searchInKindCostJobs(text: string): Promise<Array<InKindCostJob & { job_address: string | null }>> {
  const q = text.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase.rpc('search_jobs_ledger', { search_text: q })
  if (error) throw error
  return ((data ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null }>).slice(0, 12).map((r) => ({
    id: r.id,
    hcp_number: r.hcp_number,
    click_number: r.click_number,
    job_name: r.job_name,
    job_address: r.job_address,
  }))
}
