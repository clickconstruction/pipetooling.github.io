/**
 * Bills and estimates in a message (punch list #127): the read behind `papers.ts`. One customer's jobs, their bills and
 * payments (what `computeBillTruth` needs), and their estimates once sent, under the reader's own policies: the office
 * reads them all, anyone else what their policies give. A read that fails gives no papers, so the box stays as it was:
 * a line about money then waits for its blanks, as it did before.
 */
import { APP_ORIGIN } from '../appOrigin'
import { jobContractLinkOnRow } from '../jobs/jobContractLifecycle'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { supabase } from '../supabase'
import { billPapers, estimatePapers, warrantyPapers, type Paper, type PaperEstimateRow, type PaperInvoiceRow, type PaperJobRow, type PaperPaymentRow, type PaperWarrantyRow } from './papers'

export interface PapersIo {
  /** One customer's bills (open, then paid), estimates (sent, then approved) and warranties (out to sign, then signed). */
  load(customerId: string): Promise<Paper[]>
}

const JOB_COLUMNS = 'id, status, revenue, payments_made, collections_at, uncollectible_at, job_name, hcp_number, click_number, billing_only'
const INVOICE_COLUMNS = 'id, job_id, status, amount, sequence_order, billed_at, stripe_invoice_id'
const PAYMENT_COLUMNS = 'invoice_id, job_id, amount, paid_on, sequence_order'
const ESTIMATE_COLUMNS = 'id, estimate_number, title, total_cents, status, sent_at, job_ledger_id'
/** The warranty in place of a contract (2026-11-02): the Contract Desk's row, its durable link read off the row as the window's doors read it. */
const WARRANTY_COLUMNS = 'id, job_id, kind, status, sent_at, signed_at, voided_at, public_token, public_token_expires_at'

type WarrantyRowRead = { id: string; job_id: string; kind: string | null; status: string | null; sent_at: string | null; signed_at: string | null; voided_at: string | null; public_token: string | null; public_token_expires_at: string | null }

/** The warranties on the customer's jobs as papers, their link off the row; a read the role cannot make (a tech) gives none. */
export function warrantyRowsOf(rows: readonly WarrantyRowRead[], jobs: readonly PaperJobRow[], origin: string = APP_ORIGIN, nowMs: number = Date.now()): PaperWarrantyRow[] {
  return rows
    .filter((w) => w.kind === 'warranty')
    .map((w) => {
      const job = jobs.find((j) => j.id === w.job_id)
      return {
        id: w.id,
        job_id: w.job_id,
        status: w.status,
        sent_at: w.sent_at,
        signed_at: w.signed_at,
        voided_at: w.voided_at,
        job: job?.job_name ?? null,
        number: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : null,
        url: jobContractLinkOnRow({ status: w.status ?? '', voided_at: w.voided_at, public_token: w.public_token, public_token_expires_at: w.public_token_expires_at }, origin, nowMs),
      }
    })
}

export function supabasePapersIo(client: unknown = supabase): PapersIo {
  const db = client as typeof supabase
  return {
    async load(customerId) {
      try {
        const [jobsRes, estimatesRes] = await Promise.all([
          db.from('jobs_ledger').select(JOB_COLUMNS).eq('customer_id', customerId),
          db.from('estimates').select(ESTIMATE_COLUMNS).eq('customer_id', customerId).in('status', ['sent', 'customer_accepted']),
        ])
        const jobs = (jobsRes.error ? [] : (jobsRes.data ?? [])) as unknown as PaperJobRow[]
        const estimates = (estimatesRes.error ? [] : (estimatesRes.data ?? [])) as unknown as PaperEstimateRow[]
        const ids = jobs.map((j) => j.id)
        if (!ids.length) return estimatePapers(estimates)
        const [invoicesRes, paymentsRes, warrantiesRes] = await Promise.all([
          db.from('jobs_ledger_invoices').select(INVOICE_COLUMNS).in('job_id', ids),
          db.from('jobs_ledger_payments').select(PAYMENT_COLUMNS).in('job_id', ids),
          db.from('job_contracts').select(WARRANTY_COLUMNS).in('job_id', ids).eq('kind', 'warranty'),
        ])
        const warranties = warrantiesRes.error ? [] : warrantyPapers(warrantyRowsOf((warrantiesRes.data ?? []) as unknown as WarrantyRowRead[], jobs))
        // Without the payments an open amount would read too high, so no bill is offered rather than a wrong one.
        const bills =
          invoicesRes.error || paymentsRes.error
            ? []
            : billPapers({
                jobs,
                invoices: (invoicesRes.data ?? []) as unknown as PaperInvoiceRow[],
                payments: (paymentsRes.data ?? []) as unknown as PaperPaymentRow[],
              })
        return [...bills, ...estimatePapers(estimates), ...warranties]
      } catch {
        return []
      }
    },
  }
}
