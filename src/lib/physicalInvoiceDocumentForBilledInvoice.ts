import type { JobWithDetails } from '../types/jobWithDetails'
import type { Database } from '../types/database'
import { buildPhysicalInvoiceDocument, type PhysicalInvoiceDocument } from './physicalInvoiceDocument'
import { jobBillingContextFromJob } from './jobBillingContext'
import { buildPhysicalInvoiceDetailFromJob, jobContextForPhysicalDoc } from './physicalInvoiceJobContext'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { billFeeLines } from './jobs/arReturnCaseFee'
import { billedInvoiceBillTo } from './jobs/billedInvoiceBillTo'

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
 * Reconstructs the ClickTooling physical-invoice PDF model from a billed ledger row + job snapshot.
 * Not necessarily identical to the original Stripe PDF or the exact PDF first emailed for physical sends.
 * Its Bill to follows the bill, not the job's customer (`billedInvoiceBillTo`, v2.7956), for every reader: the lien
 * notice's enclosure, the lien claim's bills, the GC's unpaid-invoice print, the Lien window, the Documents window,
 * the opened PDF and the bill emailed again.
 */
export function buildPhysicalInvoiceDocumentForBilledInvoice(
  job: JobWithDetails,
  inv: JobsLedgerInvoiceRow,
): PhysicalInvoiceDocument | null {
  const billingCtx = jobBillingContextFromJob(job)
  // Bill to is whoever the bill went to (v2.7956): the GC on a GC-billed job, the typed recipient on a bill to someone else.
  const jobCtx = billedInvoiceBillTo(jobContextForPhysicalDoc(billingCtx, job), job, inv)
  // Instants: their day in APP_CALENDAR_TZ, not their UTC date (a bill sent at 8 pm would print tomorrow).
  const sentYmd = calendarYmdInAppTzFromIso(inv.sent_to_customer_at ?? '') || null
  const billedYmd = calendarYmdInAppTzFromIso(inv.billed_at ?? '') || null
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
    // A fee put on the bill after it went out (v2.5033, a returned check's): its own row, inside the amount.
    hazmatFeeLines: billFeeLines(inv),
  })
}
