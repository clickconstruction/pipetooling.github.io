/**
 * Bills and estimates in a message (punch list #127): the read behind `papers.ts`. One customer's jobs, their bills and
 * payments (what `computeBillTruth` needs), and their estimates once sent, under the reader's own policies: the office
 * reads them all, anyone else what their policies give. A read that fails gives no papers, so the box stays as it was:
 * a line about money then waits for its blanks, as it did before.
 */
import { supabase } from '../supabase'
import { billPapers, estimatePapers, type Paper, type PaperEstimateRow, type PaperInvoiceRow, type PaperJobRow, type PaperPaymentRow } from './papers'

export interface PapersIo {
  /** One customer's bills (open, then paid) and estimates (sent, then approved). */
  load(customerId: string): Promise<Paper[]>
}

const JOB_COLUMNS = 'id, status, revenue, payments_made, collections_at, uncollectible_at, job_name, hcp_number, click_number, billing_only'
const INVOICE_COLUMNS = 'id, job_id, status, amount, sequence_order, billed_at, stripe_invoice_id'
const PAYMENT_COLUMNS = 'invoice_id, job_id, amount, paid_on, sequence_order'
const ESTIMATE_COLUMNS = 'id, estimate_number, title, total_cents, status, sent_at, job_ledger_id'

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
        const [invoicesRes, paymentsRes] = await Promise.all([
          db.from('jobs_ledger_invoices').select(INVOICE_COLUMNS).in('job_id', ids),
          db.from('jobs_ledger_payments').select(PAYMENT_COLUMNS).in('job_id', ids),
        ])
        // Without the payments an open amount would read too high, so no bill is offered rather than a wrong one.
        const bills =
          invoicesRes.error || paymentsRes.error
            ? []
            : billPapers({
                jobs,
                invoices: (invoicesRes.data ?? []) as unknown as PaperInvoiceRow[],
                payments: (paymentsRes.data ?? []) as unknown as PaperPaymentRow[],
              })
        return [...bills, ...estimatePapers(estimates)]
      } catch {
        return []
      }
    },
  }
}
