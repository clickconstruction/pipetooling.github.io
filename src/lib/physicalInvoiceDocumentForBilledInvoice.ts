import type { JobWithDetails } from '../types/jobWithDetails'
import type { Database } from '../types/database'
import { buildPhysicalInvoiceDocument, type PhysicalInvoiceDocument } from './physicalInvoiceDocument'
import { jobBillingContextFromJob } from './jobBillingContext'
import { buildPhysicalInvoiceDetailFromJob, jobContextForPhysicalDoc } from './physicalInvoiceJobContext'

type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']

function todayIsoLocalYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdFromDbDateish(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return null
}

/**
 * Reconstructs the PipeTooling physical-invoice PDF model from a billed ledger row + job snapshot.
 * Not necessarily identical to the original Stripe PDF or the exact PDF first emailed for physical sends.
 */
export function buildPhysicalInvoiceDocumentForBilledInvoice(
  job: JobWithDetails,
  inv: JobsLedgerInvoiceRow,
): PhysicalInvoiceDocument | null {
  const billingCtx = jobBillingContextFromJob(job)
  const jobCtx = jobContextForPhysicalDoc(billingCtx, job)
  const sentYmd = ymdFromDbDateish(inv.sent_to_customer_at)
  const billedYmd = ymdFromDbDateish(inv.billed_at)
  const invoiceDateYmd = sentYmd ?? billedYmd ?? todayIsoLocalYmd()
  const dueYmd = ymdFromDbDateish(inv.estimated_bill_date) ?? invoiceDateYmd
  const lineMemo = (inv.stripe_invoice_memo ?? '').trim()

  return buildPhysicalInvoiceDocument({
    job: jobCtx,
    amountDollars: Number(inv.amount),
    lineDescription: lineMemo,
    physicalLineOnBillRaw: '',
    memo: (inv.external_send_note ?? '').trim(),
    footer: inv.stripe_invoice_footer ?? undefined,
    invoiceDateYmd,
    dueDateYmd: dueYmd,
    detailFromJob: buildPhysicalInvoiceDetailFromJob(job, 'invoice', inv.id),
  })
}
