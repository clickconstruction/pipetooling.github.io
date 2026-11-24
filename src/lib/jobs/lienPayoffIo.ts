/**
 * The reads behind the Lien desk's Payoffs (punch list #435, piece 1): every live filed affidavit and release of
 * record, then the jobs they sit on with their sent bills and payments. The desk's own lists drop a job once it is
 * paid to zero, so a paid lien still on record is read here, from the filings and not from those lists.
 *
 * Four small reads, the last three in chunks of the filings' jobs. The rule is `lienPayoff.ts`.
 *
 * Since piece 3 it also reads the other billed jobs of the same customers, so money open at a liened place on a
 * job with no lien is shown, and each job's sent bills that still owe, for the check pane (`lienPayoffCheck.ts`).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienBilledOpen, type LienClaimInvoice } from './lienBilledOpen'
import { lienPayoffBills, type LienPayoffAffidavit, type LienPayoffBill, type LienPayoffFacts, type LienPayoffJob, type LienPayoffPayment, type LienPayoffRelease } from './lienPayoff'

type FilingRow = LienPayoffAffidavit & LienPayoffRelease & { kind: string }
type JobRow = Omit<LienPayoffJob, 'customer_name'> & { status: string | null; revenue: number | null; payments_made: number | null }
type PaymentRow = LienPayoffPayment & { job_id: string; invoice_id: string | null }
type InvoiceRow = LienClaimInvoice & { stripe_invoice_id: string | null }

const CHUNK = 100
const chunks = <T,>(list: T[]): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}

/** Everything `lienPayoffPlaces` reads, as of `todayYmd`. Throws when a read fails, so the screen can say why. */
export async function readLienPayoffFacts(todayYmd: string): Promise<LienPayoffFacts> {
  const filings = ((await withSupabaseRetry(
    () => supabase.from('job_lien_filings').select('id, job_id, kind, amount, county, recording_number, filed_at, created_at, fields').in('kind', ['affidavit', 'release_of_record']).is('voided_at', null),
    'lien payoffs: filings',
  )) ?? []) as FilingRow[]
  const affidavits = filings.filter((f) => f.kind === 'affidavit' && f.filed_at)
  const jobIds = [...new Set(affidavits.map((a) => a.job_id))]
  const releases = filings.filter((f) => f.kind === 'release_of_record' && jobIds.includes(f.job_id))
  if (jobIds.length === 0) return { affidavits: [], releases: [], jobs: [], openByJob: {}, paymentsByJob: {}, todayYmd }

  const JOB_COLUMNS = 'id, hcp_number, click_number, job_name, job_address, customer_id, status, revenue, payments_made'
  const jobs: JobRow[] = []
  for (const ids of chunks(jobIds)) {
    jobs.push(...(((await withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).in('id', ids), 'lien payoffs: jobs')) ?? []) as JobRow[]))
  }
  const customerIds = [...new Set(jobs.map((j) => j.customer_id).filter((v): v is string => Boolean(v)))]
  // The same customers' other billed jobs (piece 3): the ones at a liened place are money open there with no lien.
  const others: JobRow[] = []
  for (const ids of chunks(customerIds)) {
    const rows = ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).in('customer_id', ids).eq('status', 'billed'), 'lien payoffs: other jobs')) ?? []) as JobRow[]
    others.push(...rows.filter((j) => !jobIds.includes(j.id)))
  }
  const allJobs = [...jobs, ...others]

  const invoices: InvoiceRow[] = []
  const payments: PaymentRow[] = []
  for (const ids of chunks(allJobs.map((j) => j.id))) {
    const [i, p] = await Promise.all([
      withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at, stripe_invoice_id').in('job_id', ids), 'lien payoffs: bills'),
      withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on, payment_type, reference_number').in('job_id', ids), 'lien payoffs: payments'),
    ])
    invoices.push(...((i ?? []) as InvoiceRow[]))
    payments.push(...((p ?? []) as PaymentRow[]))
  }

  const nameById = new Map<string, string>()
  for (const ids of chunks(customerIds)) {
    const rows = (await withSupabaseRetry(() => supabase.from('customers').select('id, name').in('id', ids), 'lien payoffs: customers')) ?? []
    for (const c of rows as Array<{ id: string; name: string | null }>) nameById.set(c.id, c.name ?? '')
  }

  const openByJob: Record<string, number> = {}
  const billsByJob: Record<string, LienPayoffBill[]> = {}
  const paymentsByJob: Record<string, PaymentRow[]> = {}
  for (const p of payments) (paymentsByJob[p.job_id] ??= []).push(p)
  for (const j of allJobs) {
    const bills = invoices.filter((i) => i.job_id === j.id)
    const paid = (paymentsByJob[j.id] ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: Number(p.amount) || 0 }))
    openByJob[j.id] = lienBilledOpen({ id: j.id, status: j.status, revenue: j.revenue, payments_made: j.payments_made } as Parameters<typeof lienBilledOpen>[0], bills, paid)
    billsByJob[j.id] = lienPayoffBills(j.id, bills, paid, j.revenue)
  }
  const named = (j: JobRow): LienPayoffJob => ({ id: j.id, hcp_number: j.hcp_number, click_number: j.click_number, job_name: j.job_name, job_address: j.job_address, customer_id: j.customer_id, customer_name: j.customer_id ? (nameById.get(j.customer_id) ?? null) : null })
  return { affidavits, releases, jobs: jobs.map(named), otherJobs: others.map(named), openByJob, billsByJob, paymentsByJob, todayYmd }
}
