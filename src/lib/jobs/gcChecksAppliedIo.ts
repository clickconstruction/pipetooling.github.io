/**
 * Reads for "Where the checks went" (v2.4046): one GC's jobs with their bills
 * and payments, the payment-move ledger for those jobs, and the Mercury
 * deposits the payments were matched to. The kernel (`gcChecksApplied.ts`)
 * does the rest. Deposits are best-effort: a reader without banking access
 * gets no deposit dates and no unapplied remainders, never an error.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { ChecksDepositIn, ChecksEventIn, ChecksJobIn } from './gcChecksApplied'

export type GcChecksInputs = { jobs: ChecksJobIn[]; events: ChecksEventIn[]; deposits: ChecksDepositIn[] }

const JOBS_SELECT =
  'id, hcp_number, click_number, job_name, job_address, customer_id, gc_customer_id, bill_to_party, lien_retainage_held, revenue, ' +
  'invoices:jobs_ledger_invoices(id, job_id, sequence_order, amount, status, billed_at, bill_to_party, bill_to_email), ' +
  'payments:jobs_ledger_payments(id, job_id, invoice_id, amount, paid_on, sent_on, payment_type, reference_number, mercury_transaction_id, sequence_order, created_at)'

type RawJob = Omit<ChecksJobIn, 'invoices' | 'payments'> & { invoices: ChecksJobIn['invoices'] | null; payments: ChecksJobIn['payments'] | null }

/** The jobs this GC pays on: where it is the GC, or where it is the customer outright. */
export async function fetchGcChecksInputs(gcId: string): Promise<GcChecksInputs> {
  const rawJobs = await withSupabaseRetry(
    () => supabase.from('jobs_ledger').select(JOBS_SELECT).or(`gc_customer_id.eq.${gcId},customer_id.eq.${gcId}`),
    'where the checks went: jobs',
  )
  const jobs: ChecksJobIn[] = ((rawJobs ?? []) as unknown as RawJob[]).map((j) => ({ ...j, invoices: j.invoices ?? [], payments: j.payments ?? [] }))
  const jobIds = jobs.map((j) => j.id)
  if (jobIds.length === 0) return { jobs, events: [], deposits: [] }

  const idList = `(${jobIds.join(',')})`
  const events = await withSupabaseRetry(
    () =>
      supabase
        .from('jobs_ledger_payment_events')
        .select('id, kind, payment_id, from_job_id, to_job_id, amount, created_at')
        .or(`from_job_id.in.${idList},to_job_id.in.${idList}`)
        .order('created_at', { ascending: true }),
    'where the checks went: moves',
  )

  const depositIds = [...new Set(jobs.flatMap((j) => j.payments.map((p) => (p.mercury_transaction_id ?? '').trim())).filter(Boolean))]
  const deposits = depositIds.length > 0 ? await fetchDeposits(depositIds) : []
  return { jobs, events: (events ?? []) as ChecksEventIn[], deposits }
}

async function fetchDeposits(ids: string[]): Promise<ChecksDepositIn[]> {
  try {
    const [rows, linked] = await Promise.all([
      withSupabaseRetry(() => supabase.from('mercury_transactions').select('id, amount, posted_at').in('id', ids), 'where the checks went: deposits'),
      withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('mercury_transaction_id, amount').in('mercury_transaction_id', ids), 'where the checks went: applied'),
    ])
    const applied = new Map<string, number>()
    for (const p of (linked ?? []) as Array<{ mercury_transaction_id: string | null; amount: number | null }>) {
      if (!p.mercury_transaction_id) continue
      applied.set(p.mercury_transaction_id, (applied.get(p.mercury_transaction_id) ?? 0) + Number(p.amount ?? 0))
    }
    return ((rows ?? []) as Array<{ id: string; amount: number | null; posted_at: string | null }>).map((d) => ({
      id: d.id,
      posted_at: d.posted_at,
      amount: Number(d.amount ?? 0),
      applied: Math.round((applied.get(d.id) ?? 0) * 100) / 100,
    }))
  } catch {
    return []
  }
}
