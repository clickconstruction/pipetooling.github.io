/**
 * The history behind the Pipeline map's As of (v2.3398): every job (light
 * columns), every status move, every bill that went out and every payment,
 * read once and cached for the session. Nothing loads until the As-of toggle
 * is on. Everything is paged past PostgREST's 1,000-row cap; runs under the
 * caller's RLS (the Pipeline is office-only).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllRows } from '../supabasePaging'
import type { JobsMapBillRow, JobsMapHistory, JobsMapHistoryJob, JobsMapPaymentRow, JobsMapStatusMove } from './jobsMapAsOf'

const CACHE_TTL_MS = 5 * 60_000

let cached: { at: number; promise: Promise<JobsMapHistory> } | null = null

export function resetJobsMapHistoryCacheForTests(): void {
  cached = null
}

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  created_at: string
  collections_at: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  bill_to_party: string | null
  gc_customer: { name: string | null } | { name: string | null }[] | null
}
type MoveRow = { job_id: string; from_status: string | null; to_status: string; changed_at: string }
type BillRow = { id: string; job_id: string; amount: number | null; billed_at: string | null; estimated_bill_date: string | null }
type PaymentRow = { invoice_id: string | null; amount: number | null; paid_on: string | null; created_at: string }

const ymdOf = (iso: string | null | undefined): string | null => {
  const t = (iso ?? '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const ymd = calendarYmdInAppTzFromIso(t)
  return ymd || null
}

function page<T>(build: (from: number, to: number) => PromiseLike<unknown>, label: string): Promise<T[]> {
  return fetchAllRows<T>(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => build(from, to) as PromiseLike<SupabaseClientResult<T[]>>, label)) as unknown as T[] | null,
      error: null,
    }),
    label,
  )
}

async function read(): Promise<JobsMapHistory> {
  const [jobRows, moveRows, billRows, paymentRows] = await Promise.all([
    page<JobRow>(
      (from, to) =>
        supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address, status, created_at, collections_at, customer_id, customer_name, gc_customer_id, bill_to_party, gc_customer:gc_customer_id(name)')
          .order('id')
          .range(from, to),
      'jobs map history jobs',
    ),
    page<MoveRow>(
      (from, to) => supabase.from('job_status_events').select('job_id, from_status, to_status, changed_at').order('changed_at').order('id').range(from, to),
      'jobs map history moves',
    ),
    page<BillRow>(
      (from, to) =>
        supabase
          .from('jobs_ledger_invoices')
          .select('id, job_id, amount, billed_at, estimated_bill_date')
          .in('status', ['billed', 'paid'])
          .or('stripe_mode.is.null,stripe_mode.neq.test')
          .order('id')
          .range(from, to),
      'jobs map history bills',
    ),
    page<PaymentRow>(
      (from, to) => supabase.from('jobs_ledger_payments').select('invoice_id, amount, paid_on, created_at').order('id').range(from, to),
      'jobs map history payments',
    ),
  ])

  const jobs: JobsMapHistoryJob[] = jobRows.map((r) => {
    const gc = Array.isArray(r.gc_customer) ? (r.gc_customer[0] ?? null) : r.gc_customer
    return {
      id: r.id,
      hcp_number: r.hcp_number,
      click_number: r.click_number,
      job_name: r.job_name,
      job_address: r.job_address,
      status: r.status,
      created_ymd: ymdOf(r.created_at) ?? '0000-00-00',
      collections_ymd: ymdOf(r.collections_at),
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      gc_customer_id: r.gc_customer_id,
      gc_name: gc?.name ?? null,
      bill_to_party: r.bill_to_party,
    }
  })
  const moves: JobsMapStatusMove[] = []
  for (const m of moveRows) {
    const ymd = ymdOf(m.changed_at)
    if (ymd) moves.push({ job_id: m.job_id, from_status: m.from_status, to_status: m.to_status, ymd })
  }
  const bills: JobsMapBillRow[] = []
  for (const b of billRows) {
    // The Billed section's own reference: the hand-set bill date, else the day the bill went out.
    const ymd = ymdOf(b.estimated_bill_date) ?? ymdOf(b.billed_at)
    if (ymd) bills.push({ invoice_id: b.id, job_id: b.job_id, amount: Number(b.amount ?? 0), billed_ymd: ymd })
  }
  const payments: JobsMapPaymentRow[] = []
  for (const p of paymentRows) {
    const ymd = ymdOf(p.paid_on) ?? ymdOf(p.created_at)
    if (ymd) payments.push({ invoice_id: p.invoice_id, amount: Number(p.amount ?? 0), paid_ymd: ymd })
  }
  return { jobs, moves, bills, payments, loadedAt: Date.now() }
}

/** The whole history, cached for five minutes; a failed read is not cached. */
export function loadJobsMapHistory(): Promise<JobsMapHistory> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.promise
  const promise = read().catch((e: unknown) => {
    if (cached?.promise === promise) cached = null
    throw e
  })
  cached = { at: now, promise }
  return promise
}
