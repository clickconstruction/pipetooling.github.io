import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Bill desk (punch list #192, v2.5930): the reads the Bridge does not
 * already make, read once when the desk first opens. The window's bills with
 * who sent them, plus every bill on the pile's jobs (the "on <day>" of a
 * part-bill); every ready-to-bill status change on those jobs, so the ready
 * day is the job's own record and not an owner call; the job labels the page
 * does not carry (the ready-to-bill jobs and the window's billed jobs); and
 * the senders' names. Read-only, nothing new on the server. `billDesk.ts`
 * does the crossing.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../../ledgerDisplayPrefixes'
import { invoiceBilledYmd } from '../billedDay'
import type { BillDeskInvoiceRow } from './billDesk'

export type BillDeskReads = {
  /** Job id → "1024 · Lawver install", for every job the desk touches. */
  labels: Map<string, string>
  /** Job id → the company days of its ready-to-bill status changes, oldest first. */
  readyDaysByJob: Map<string, string[]>
  /** The window's bills and every bill on the pile's jobs, each once. */
  invoices: BillDeskInvoiceRow[]
}

type InvoiceRow = { id: string; job_id: string; amount: number | null; billed_at: string | null; sent_to_customer_at: string | null; sent_by_user_id: string | null; status: string }
type EventRow = { job_id: string; to_status: string; changed_at: string }
type LabelRow = { id: string; job_name: string | null; hcp_number: string | null; click_number: string | null }
type UserRow = { id: string; name: string | null }

const INVOICE_COLS = 'id, job_id, amount, billed_at, sent_to_customer_at, sent_by_user_id, status'
/** The same bills the Bridge's billed-per-week counts: a Stripe test-mode bill is not a bill. */
const LIVE_BILLS = 'stripe_mode.is.null,stripe_mode.neq.test'

export async function loadBillDeskReads(db: SupabaseClient<Database>, args: { sinceYmd: string; pileJobIds: ReadonlyArray<string> }): Promise<BillDeskReads> {
  const pileIds = [...new Set(args.pileJobIds)]
  const sinceIso = `${args.sinceYmd}T00:00:00Z`
  const [windowRows, pileRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () => db.from('jobs_ledger_invoices').select(INVOICE_COLS).or(`sent_to_customer_at.gte.${sinceIso},billed_at.gte.${sinceIso}`).or(LIVE_BILLS).order('id').range(from, to),
          'bill desk window bills',
        )) as InvoiceRow[] | null,
        error: null,
      }),
      'bill desk window bills',
    ),
    pileIds.length
      ? fetchAllRowsChunkedIn<InvoiceRow, string>(
          pileIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('jobs_ledger_invoices').select(INVOICE_COLS).in('job_id', chunk).not('billed_at', 'is', null).or(LIVE_BILLS).order('id').range(from, to), 'bill desk pile bills')) as InvoiceRow[] | null,
            error: null,
          }),
          'bill desk pile bills',
        )
      : Promise.resolve([] as InvoiceRow[]),
  ])
  const rowById = new Map<string, InvoiceRow>()
  for (const r of [...windowRows, ...pileRows]) rowById.set(r.id, r)
  const jobIds = [...new Set([...pileIds, ...[...rowById.values()].map((r) => r.job_id)])]
  const senderIds = [...new Set([...rowById.values()].map((r) => r.sent_by_user_id).filter((id): id is string => !!id))]

  const [eventRows, labelRows, userRows] = await Promise.all([
    jobIds.length
      ? fetchAllRowsChunkedIn<EventRow, string>(
          jobIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('job_status_events').select('job_id, to_status, changed_at').in('job_id', chunk).eq('to_status', 'ready_to_bill').order('id').range(from, to), 'bill desk ready days')) as EventRow[] | null,
            error: null,
          }),
          'bill desk ready days',
        )
      : Promise.resolve([] as EventRow[]),
    jobIds.length
      ? fetchAllRowsChunkedIn<LabelRow, string>(
          jobIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, job_name, hcp_number, click_number').in('id', chunk).order('id').range(from, to), 'bill desk job labels')) as LabelRow[] | null,
            error: null,
          }),
          'bill desk job labels',
        )
      : Promise.resolve([] as LabelRow[]),
    senderIds.length
      ? fetchAllRowsChunkedIn<UserRow, string>(
          senderIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('users').select('id, name').in('id', chunk).order('id').range(from, to), 'bill desk senders')) as UserRow[] | null,
            error: null,
          }),
          'bill desk senders',
        )
      : Promise.resolve([] as UserRow[]),
  ])

  const readyDaysByJob = new Map<string, string[]>()
  for (const e of eventRows) {
    const ymd = calendarYmdInAppTzFromIso(e.changed_at)
    if (!ymd) continue
    const list = readyDaysByJob.get(e.job_id) ?? []
    list.push(ymd)
    readyDaysByJob.set(e.job_id, list)
  }
  for (const list of readyDaysByJob.values()) list.sort()

  const labels = new Map<string, string>()
  for (const r of labelRows) {
    const number = effectiveJobLedgerNumber(r.hcp_number, r.click_number)
    const name = (r.job_name ?? '').trim()
    labels.set(r.id, [number, name].filter(Boolean).join(' · ') || 'Job with no name')
  }

  const nameById = new Map<string, string>()
  for (const u of userRows) if (u.name?.trim()) nameById.set(u.id, u.name.trim())

  const invoices: BillDeskInvoiceRow[] = []
  for (const r of rowById.values()) {
    invoices.push({
      id: r.id,
      jobId: r.job_id,
      usd: Number(r.amount ?? 0),
      billedYmd: invoiceBilledYmd(r),
      sentFromHere: !!r.sent_to_customer_at,
      sentByName: r.sent_by_user_id ? (nameById.get(r.sent_by_user_id) ?? null) : null,
      status: r.status,
    })
  }
  return { labels, readyDaysByJob, invoices }
}
