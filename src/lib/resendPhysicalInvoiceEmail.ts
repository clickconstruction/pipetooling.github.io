/**
 * Re-email a BILLED invoice's ClickTooling PDF (v2.2605) — the Who-owes-what
 * cards' "Email again" for physically-billed bills. Rebuilds the document the
 * way the PDF tail does (`buildPhysicalInvoiceDocumentForBilledInvoice`) and
 * calls `send-physical-invoice-email` with `resend: true`: the function skips
 * the Ready-to-Bill gate and records nothing on the row — the bill keeps its
 * first-send evidence, and the send lands in the shared email log.
 */
import { supabase } from './supabase'
import { fetchJobWithDetailsById } from './fetchJobWithDetailsById'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from './physicalInvoiceDocumentForBilledInvoice'
import { buildPhysicalInvoicePdfBlob, physicalInvoicePdfFilename, physicalInvoicePdfToBase64 } from './physicalInvoicePdf'
import { buildPhysicalInvoiceEmailBodies, physicalInvoiceEmailSubject } from './physicalInvoiceDocument'
import { readEdgeFunctionErrorBody } from './readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../utils/errorHandling'

const MAX_PDF_BASE64_CHARS = 5_500_000

export type ResendPhysicalInvoiceEmailResult = { ok: true; sentTo: string } | { ok: false; message: string }

/** The address the resend targets: the invoice's bill-to override, else the job customer email (the send function accepts either). */
export function physicalResendRecipient(inv: { bill_to_email: string | null }, job: { customer_email: string | null }): string {
  return (inv.bill_to_email ?? '').trim() || (job.customer_email ?? '').trim()
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

    const recipient = physicalResendRecipient(inv, job)
    if (!recipient) return { ok: false, message: 'Job has no customer email; add it on Edit Job.' }

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
    return { ok: false, message: e instanceof Error ? e.message : 'Re-send invoice email failed' }
  }
}
