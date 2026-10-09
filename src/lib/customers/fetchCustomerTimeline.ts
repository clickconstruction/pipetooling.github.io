/**
 * Customer timeline — the reads (punch list #97). Everything the timeline draws comes from
 * existing tables under existing RLS, the way the Customer profile window reads them:
 *
 * 1. the customer, and every job where they pay (`customer_id`) or are the GC (`gc_customer_id`),
 *    newest first, at most `CUSTOMER_TIMELINE_JOB_CAP`;
 * 2. per batch of jobs, in parallel: bills, payments, status moves, notes, crew hours, field
 *    reports, test reports, supply tickets, promises and lien papers; the GC statements by
 *    customer;
 * 3. then the Mercury deposits the payments were matched to, the note and report authors, and
 *    the report templates.
 *
 * Each part fails soft: a part RLS hides, or a read that errors, comes back empty and is named
 * in `missing`, so the window can say what it could not read instead of drawing a wrong story.
 * Bills or payments missing make the money wrong; the window says so above the tiles.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { jobReportPercent, jobReportPreviewLine } from '../jobReportsTimeline'
import type {
  CustomerTimelineInput,
  TimelineClockInput,
  TimelineInvoiceInput,
  TimelineJobInput,
  TimelineLienFilingInput,
  TimelineNoteInput,
  TimelinePaymentInput,
  TimelinePromiseInput,
  TimelineReportInput,
  TimelineStatementInput,
  TimelineStatusEventInput,
  TimelineSupplyTicketInput,
  TimelineTestReportInput,
} from './customerTimeline'

export const CUSTOMER_TIMELINE_JOB_CAP = 200
/** Rows per part per batch of jobs; a part that reaches it is named in `capped`. */
export const CUSTOMER_TIMELINE_ROW_CAP = 1000
const IN_CHUNK = 80

export type CustomerTimelineLoad = {
  input: CustomerTimelineInput
  /** Parts that could not be read, in words: "notes", "crew hours". */
  missing: string[]
  /** Parts that reached the row cap: the oldest rows of that part may be missing. */
  capped: string[]
  /** More jobs than the cap: the oldest are left out. */
  jobCapHit: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

type PartResult<T> = { rows: T[]; failed: boolean; capped: boolean }

/** One part, read in batches of ids; never throws. */
async function readPart<T>(
  label: string,
  ids: readonly string[],
  run: (batch: string[]) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<PartResult<T>> {
  if (ids.length === 0) return { rows: [], failed: false, capped: false }
  try {
    const results = await Promise.all(
      chunks(ids, IN_CHUNK).map((batch) =>
        withSupabaseRetry(async () => (await run(batch)) as { data: T[] | null; error: null }, `customer timeline: ${label}`),
      ),
    )
    const rows = results.flatMap((r) => (r ?? []) as T[])
    const capped = results.some((r) => ((r ?? []) as T[]).length >= CUSTOMER_TIMELINE_ROW_CAP)
    return { rows, failed: false, capped }
  } catch {
    return { rows: [], failed: true, capped: false }
  }
}

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  revenue: number | string | null
  payments_made: number | string | null
  created_at: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  collections_at: string | null
  collections_note: string | null
  uncollectible_at: string | null
  uncollectible_reason: string | null
}

export async function fetchCustomerTimeline(customerId: string): Promise<CustomerTimelineLoad> {
  if (!UUID_RE.test(customerId)) throw new Error('Not a customer id')
  const [customerRow, jobRows] = await Promise.all([
    withSupabaseRetry(
      async () => await supabase.from('customers').select('id, name, created_at, date_met').eq('id', customerId).single(),
      'customer timeline: customer',
    ),
    withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select(
            'id, hcp_number, click_number, job_name, job_address, status, revenue, payments_made, created_at, customer_id, customer_name, gc_customer_id, collections_at, collections_note, uncollectible_at, uncollectible_reason',
          )
          .or(`customer_id.eq.${customerId},gc_customer_id.eq.${customerId}`)
          .order('created_at', { ascending: false })
          .limit(CUSTOMER_TIMELINE_JOB_CAP + 1),
      'customer timeline: jobs',
    ),
  ])
  const customer = customerRow as unknown as { id: string; name: string | null; created_at: string | null; date_met: string | null } | null
  if (!customer) throw new Error('Customer not found')
  const allJobs = (jobRows ?? []) as unknown as JobRow[]
  const jobCapHit = allJobs.length > CUSTOMER_TIMELINE_JOB_CAP
  const jobsRaw = allJobs.slice(0, CUSTOMER_TIMELINE_JOB_CAP)
  const ids = jobsRaw.map((j) => j.id)

  const jobs: TimelineJobInput[] = jobsRaw.map((j) => ({
    id: j.id,
    hcpNumber: j.hcp_number,
    clickNumber: j.click_number,
    jobName: j.job_name,
    jobAddress: j.job_address,
    status: j.status,
    revenue: num(j.revenue),
    paymentsMade: num(j.payments_made),
    createdAt: j.created_at,
    customerId: j.customer_id,
    customerName: j.customer_name,
    gcCustomerId: j.gc_customer_id,
    collectionsAt: j.collections_at,
    collectionsNote: j.collections_note,
    uncollectibleAt: j.uncollectible_at,
    uncollectibleReason: j.uncollectible_reason,
  }))

  type InvoiceRow = { id: string; job_id: string; status: string | null; amount: number | string | null; sequence_order: number | null; billed_at: string | null; sent_to_customer_at: string | null; external_send_channel: string | null }
  type PaymentRow = { id: string; job_id: string; invoice_id: string | null; amount: number | string | null; paid_on: string | null; payment_type: string | null; reference_number: string | null; mercury_transaction_id: string | null }
  type EventRow = { job_id: string; from_status: string | null; to_status: string | null; changed_at: string }
  type NoteRow = { id: string; job_id: string; body: string | null; created_at: string; author_user_id: string | null }
  type ClockRow = { id: string; job_ledger_id: string; user_id: string | null; work_date: string | null; clocked_in_at: string | null; clocked_out_at: string | null; notes: string | null; users: { name: string | null } | { name: string | null }[] | null }
  type ReportRow = { id: string; job_ledger_id: string; template_id: string | null; created_at: string; created_by_user_id: string | null; field_values: unknown }
  type TestRow = { id: string; job_id: string; test_date: string | null; created_at: string; test_type: string | null; result: string | null; system: string | null }
  type AllocRow = { invoice_id: string; job_id: string; pct: number | string | null; supply_house_invoices: { id: string; invoice_number: string | null; invoice_date: string | null; amount: number | string | null; supply_houses: { name: string | null } | { name: string | null }[] | null } | null }
  type PromiseRow = { id: string; job_id: string; created_at: string; promised_date: string; note: string | null; said_by: string | null }
  type FilingRow = { id: string; job_id: string; kind: string | null; created_at: string; amount: number | string | null; sends: unknown }
  type StatementRow = { id: string; sent_at: string; sent_by_name: string | null; job_count: number | null; total: number | string | null }

  const [invoices, payments, events, notes, clock, reports, tests, allocs, promises, filings, statements] = await Promise.all([
    readPart<InvoiceRow>('bills', ids, (b) =>
      supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at, sent_to_customer_at, external_send_channel').in('job_id', b).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<PaymentRow>('payments', ids, (b) =>
      supabase.from('jobs_ledger_payments').select('id, job_id, invoice_id, amount, paid_on, payment_type, reference_number, mercury_transaction_id').in('job_id', b).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<EventRow>('status moves', ids, (b) =>
      supabase.from('job_status_events').select('job_id, from_status, to_status, changed_at').in('job_id', b).order('changed_at', { ascending: true }).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<NoteRow>('notes', ids, (b) =>
      supabase.from('jobs_ledger_thread_notes').select('id, job_id, body, created_at, author_user_id').in('job_id', b).order('created_at', { ascending: false }).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<ClockRow>('crew hours', ids, (b) =>
      supabase
        .from('clock_sessions')
        .select('id, job_ledger_id, user_id, work_date, clocked_in_at, clocked_out_at, notes, users!clock_sessions_user_id_fkey(name)')
        .in('job_ledger_id', b)
        .is('revoked_at', null)
        .is('rejected_at', null)
        .order('clocked_in_at', { ascending: false })
        .limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<ReportRow>('field reports', ids, (b) =>
      supabase.from('reports').select('id, job_ledger_id, template_id, created_at, created_by_user_id, field_values').in('job_ledger_id', b).order('created_at', { ascending: false }).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<TestRow>('test reports', ids, (b) =>
      supabase.from('job_test_reports').select('id, job_id, test_date, created_at, test_type, result, system').in('job_id', b).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<AllocRow>('supply tickets', ids, (b) =>
      supabase
        .from('supply_house_invoice_job_allocations')
        .select('invoice_id, job_id, pct, supply_house_invoices(id, invoice_number, invoice_date, amount, supply_houses(name))')
        .in('job_id', b)
        .limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<PromiseRow>('promises', ids, (b) =>
      supabase.from('job_payment_promises').select('id, job_id, created_at, promised_date, note, said_by').in('job_id', b).is('voided_at', null).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<FilingRow>('lien papers', ids, (b) =>
      supabase.from('job_lien_filings').select('id, job_id, kind, created_at, amount, sends').in('job_id', b).is('voided_at', null).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
    readPart<StatementRow>('GC statements', [customerId], () =>
      supabase.from('gc_statement_emails').select('id, sent_at, sent_by_name, job_count, total').eq('gc_customer_id', customerId).order('sent_at', { ascending: false }).limit(CUSTOMER_TIMELINE_ROW_CAP),
    ),
  ])

  const mercuryIds = [...new Set(payments.rows.map((p) => p.mercury_transaction_id).filter((id): id is string => !!id))]
  const userIds = [
    ...new Set([...notes.rows.map((n) => n.author_user_id), ...reports.rows.map((r) => r.created_by_user_id)].filter((id): id is string => !!id)),
  ]
  const templateIds = [...new Set(reports.rows.map((r) => r.template_id).filter((id): id is string => !!id))]
  type MercuryRow = { id: string; posted_at: string | null; counterparty_name: string | null }
  type UserRow = { id: string; name: string | null; role: string | null }
  type TemplateRow = { id: string; name: string | null }
  const gcIds = [...new Set(jobsRaw.map((j) => j.gc_customer_id).filter((id): id is string => !!id && id !== customerId))]
  type GcRow = { id: string; name: string | null }
  const [mercury, users, templates, gcs] = await Promise.all([
    readPart<MercuryRow>('deposits', mercuryIds, (b) => supabase.from('mercury_transactions').select('id, posted_at, counterparty_name').in('id', b)),
    readPart<UserRow>('note authors', userIds, (b) => supabase.from('users').select('id, name, role').in('id', b)),
    readPart<TemplateRow>('report names', templateIds, (b) => supabase.from('report_templates').select('id, name').in('id', b)),
    readPart<GcRow>('GC names', gcIds, (b) => supabase.from('customers').select('id, name').in('id', b)),
  ])
  const gcNameById = new Map(gcs.rows.map((g) => [g.id, g.name]))
  for (const j of jobs) {
    if (j.gcCustomerId) j.gcName = j.gcCustomerId === customerId ? (customer.name ?? null) : (gcNameById.get(j.gcCustomerId) ?? null)
  }
  const depositById = new Map(mercury.rows.map((m) => [m.id, m]))
  const userById = new Map(users.rows.map((u) => [u.id, u]))
  const templateById = new Map(templates.rows.map((t) => [t.id, t]))

  const input: CustomerTimelineInput = {
    customer: { id: customer.id, name: customer.name ?? '', createdAt: customer.created_at ?? null, dateMet: customer.date_met ?? null },
    jobs,
    invoices: invoices.rows.map(
      (i): TimelineInvoiceInput => ({
        id: i.id,
        jobId: i.job_id,
        status: i.status,
        amount: num(i.amount),
        sequenceOrder: i.sequence_order ?? null,
        billedAt: i.billed_at,
        sentToCustomerAt: i.sent_to_customer_at,
        channel: i.external_send_channel,
      }),
    ),
    payments: payments.rows.map((p): TimelinePaymentInput => {
      const deposit = p.mercury_transaction_id ? depositById.get(p.mercury_transaction_id) : undefined
      return {
        id: p.id,
        jobId: p.job_id,
        invoiceId: p.invoice_id,
        amount: num(p.amount),
        paidOn: p.paid_on,
        paymentType: p.payment_type,
        referenceNumber: p.reference_number,
        depositPostedAt: deposit?.posted_at ?? null,
        depositFrom: str(deposit?.counterparty_name),
      }
    }),
    statusEvents: events.rows.map((e): TimelineStatusEventInput => ({ jobId: e.job_id, fromStatus: e.from_status, toStatus: e.to_status, changedAt: e.changed_at })),
    notes: notes.rows.map((n): TimelineNoteInput => {
      const author = n.author_user_id ? userById.get(n.author_user_id) : undefined
      return { id: n.id, jobId: n.job_id, body: n.body ?? '', createdAt: n.created_at, authorName: author?.name ?? null, authorRole: author?.role ?? null }
    }),
    clockSessions: clock.rows.map(
      (c): TimelineClockInput => ({
        id: c.id,
        jobId: c.job_ledger_id,
        userName: one(c.users)?.name ?? null,
        workDate: c.work_date,
        clockedInAt: c.clocked_in_at,
        clockedOutAt: c.clocked_out_at,
        notes: c.notes,
      }),
    ),
    reports: reports.rows.map((r): TimelineReportInput => {
      const values = r.field_values && typeof r.field_values === 'object' && !Array.isArray(r.field_values) ? (r.field_values as Record<string, string>) : null
      return {
        id: r.id,
        jobId: r.job_ledger_id,
        createdAt: r.created_at,
        templateName: r.template_id ? (templateById.get(r.template_id)?.name ?? null) : null,
        authorName: r.created_by_user_id ? (userById.get(r.created_by_user_id)?.name ?? null) : null,
        preview: jobReportPreviewLine(values),
        percent: jobReportPercent(values),
      }
    }),
    testReports: tests.rows.map(
      (t): TimelineTestReportInput => ({ id: t.id, jobId: t.job_id, testDate: t.test_date, createdAt: t.created_at, testType: t.test_type, result: t.result, system: t.system }),
    ),
    supplyTickets: allocs.rows.flatMap((a): TimelineSupplyTicketInput[] => {
      const inv = a.supply_house_invoices
      if (!inv) return []
      const pct = num(a.pct) ?? 100
      const amount = Math.round(((num(inv.amount) ?? 0) * pct) / 100 * 100) / 100
      return [{ id: `${a.invoice_id}:${a.job_id}`, jobId: a.job_id, invoiceDate: inv.invoice_date, amount, supplyHouse: one(inv.supply_houses)?.name ?? null, invoiceNumber: inv.invoice_number }]
    }),
    promises: promises.rows.map(
      (p): TimelinePromiseInput => ({ id: p.id, jobId: p.job_id, createdAt: p.created_at, promisedDate: p.promised_date, note: p.note, saidBy: p.said_by }),
    ),
    statements: statements.rows.map(
      (s): TimelineStatementInput => ({ id: s.id, sentAt: s.sent_at, sentByName: s.sent_by_name, jobCount: s.job_count, total: num(s.total) }),
    ),
    lienFilings: filings.rows.map(
      (f): TimelineLienFilingInput => ({
        id: f.id,
        jobId: f.job_id,
        kind: f.kind,
        createdAt: f.created_at,
        amount: num(f.amount),
        sends: Array.isArray(f.sends)
          ? (f.sends as Array<Record<string, unknown>>).map((s) => ({ method: str(s.method), recipient: str(s.recipient), sentOn: str(s.sent_on) }))
          : [],
      }),
    ),
  }

  const parts: Array<[string, PartResult<unknown>]> = [
    ['bills', invoices],
    ['payments', payments],
    ['deposits', mercury],
    ['status moves', events],
    ['notes', notes],
    ['note authors', users],
    ['crew hours', clock],
    ['field reports', reports],
    ['report names', templates],
    ['GC names', gcs],
    ['test reports', tests],
    ['supply tickets', allocs],
    ['promises', promises],
    ['lien papers', filings],
    ['GC statements', statements],
  ]
  return {
    input,
    missing: parts.filter(([, p]) => p.failed).map(([label]) => label),
    capped: parts.filter(([, p]) => p.capped).map(([label]) => label),
    jobCapHit,
  }
}

/** The words the window shows over a load that is missing parts ('' when nothing is). */
export function customerTimelineMissingWords(load: Pick<CustomerTimelineLoad, 'missing' | 'capped' | 'jobCapHit'>): string {
  const parts: string[] = []
  if (load.missing.length > 0) parts.push(`Could not read ${load.missing.join(', ')}.`)
  if (load.capped.length > 0) parts.push(`Only the newest ${CUSTOMER_TIMELINE_ROW_CAP} rows of ${load.capped.join(', ')} are shown.`)
  if (load.jobCapHit) parts.push(`Only the newest ${CUSTOMER_TIMELINE_JOB_CAP} jobs are shown.`)
  return parts.join(' ')
}

