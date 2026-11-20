/**
 * Re-email a BILLED invoice's ClickTooling PDF (v2.2605) — the Who-owes-what
 * cards' "Email again" for physically-billed bills. Rebuilds the document the
 * way the PDF tail does (`buildPhysicalInvoiceDocumentForBilledInvoice`) and
 * calls `send-physical-invoice-email` with `resend: true`: the function skips
 * the Ready-to-Bill gate and records nothing on the row — the bill keeps its
 * first-send evidence, and the send lands in the shared email log.
 *
 * It goes to whoever the bill went to (v2.7959, `paperBillResendRecipient`): the typed recipient, the GC's billing
 * email on a bill to the GC, else the job's customer email. `readPaperBillResendRecipient` is the same answer for
 * the confirm window, read before the press.
 */
import { supabase } from './supabase'
import { fetchJobWithDetailsById } from './fetchJobWithDetailsById'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from './physicalInvoiceDocumentForBilledInvoice'
import { buildPhysicalInvoicePdfBlob, physicalInvoicePdfFilename, physicalInvoicePdfToBase64 } from './physicalInvoicePdf'
import { buildPhysicalInvoiceEmailBodies, physicalInvoiceEmailSubject } from './physicalInvoiceDocument'
import { readEdgeFunctionErrorBody } from './readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../utils/errorHandling'
import { effectiveInvoiceParty, type InvoicePartyFields, type JobPartyFields } from './jobs/billToParty'
import { paperBillNoAddressWords, paperBillResendRecipient, type GcBillingRow, type PaperBillRecipient } from './jobs/paperBillResend'

const MAX_PDF_BASE64_CHARS = 5_500_000

export type ResendPhysicalInvoiceEmailResult = { ok: true; sentTo: string } | { ok: false; message: string }

/** The GC's billing address, read only when the bill went to the GC: the job carries the GC's id and name alone. */
async function recipientFor(job: JobPartyFields & { customer_email?: string | null }, inv: InvoicePartyFields): Promise<PaperBillRecipient> {
  let gc: GcBillingRow | null = null
  const gcId = (job.gc_customer_id ?? '').trim()
  if (gcId && effectiveInvoiceParty(job, inv) === 'gc') {
    const { data, error } = await supabase.from('customers').select('id, billing_email, contact_info').eq('id', gcId).maybeSingle()
    if (error) throw error
    gc = data
  }
  return paperBillResendRecipient(job, inv, gc)
}

export type PaperBillRecipientRead = { ok: true; recipient: PaperBillRecipient } | { ok: false; message: string }

/** Who a paper bill would be emailed again to, for the confirm window. Three small reads, nothing written. */
export async function readPaperBillResendRecipient(invoiceRef: { id: string; job_id: string }): Promise<PaperBillRecipientRead> {
  try {
    const { data: inv, error: invErr } = await supabase.from('jobs_ledger_invoices').select('id, bill_to_email, bill_to_party').eq('id', invoiceRef.id).maybeSingle()
    if (invErr) throw invErr
    if (!inv) return { ok: false, message: 'Invoice not found on this job.' }
    const { data: job, error: jobErr } = await supabase
      .from('jobs_ledger')
      .select('id, customer_id, gc_customer_id, bill_to_party, customer_email')
      .eq('id', invoiceRef.job_id)
      .maybeSingle()
    if (jobErr) throw jobErr
    if (!job) return { ok: false, message: 'Job not found or not visible.' }
    const recipient = await recipientFor(job, inv)
    return recipient.email ? { ok: true, recipient } : { ok: false, message: paperBillNoAddressWords(recipient.party) }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Could not read who this bill went to') }
  }
}

export async function resendPhysicalInvoiceEmailForBilledInvoice(invoiceRef: {
  id: string
  job_id: string
}): Promise<ResendPhysicalInvoiceEmailResult> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    const token = auth.session?.access_token
    if (!token) return { ok: false, message: 'Not signed in' }

    const job = await fetchJobWithDetailsById(invoiceRef.job_id)
    if (!job) return { ok: false, message: 'Job not found or not visible.' }
    const inv = job.invoices.find((i) => i.id === invoiceRef.id)
    if (!inv) return { ok: false, message: 'Invoice not found on this job.' }
    if (inv.status !== 'billed') return { ok: false, message: 'Only a billed invoice can be re-emailed.' }

    const target = await recipientFor(job, inv)
    if (!target.email) return { ok: false, message: paperBillNoAddressWords(target.party) }
    const recipient = target.email

    const doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    if (!doc) return { ok: false, message: 'This bill has no invoice document to render.' }

    const pdfBase64 = await physicalInvoicePdfToBase64(await buildPhysicalInvoicePdfBlob(doc))
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) return { ok: false, message: 'Generated PDF is too large to email' }

    const { text, html } = buildPhysicalInvoiceEmailBodies(doc)
    const { data: raw, error: fnErr } = await supabase.functions.invoke('send-physical-invoice-email', {
      body: {
        resend: true,
        jobs_ledger_invoice_id: inv.id,
        job_id: job.id,
        amount_dollars: Number(inv.amount),
        customer_email: recipient,
        subject: physicalInvoiceEmailSubject(doc),
        pdf_base64: pdfBase64,
        pdf_filename: physicalInvoicePdfFilename(job.hcp_number, ''),
        email_text: text,
        email_html: html,
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (fnErr) {
      const detail = await readEdgeFunctionErrorBody(fnErr)
      return { ok: false, message: detail ?? formatErrorMessage(fnErr, 'Re-send invoice email failed') }
    }
    const resp = raw as { success?: boolean; error?: string } | null
    if (resp && typeof resp.error === 'string' && resp.error.length > 0) return { ok: false, message: resp.error }
    return { ok: true, sentTo: recipient }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Re-send invoice email failed') }
  }
}
