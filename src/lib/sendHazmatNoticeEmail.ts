import { supabase } from './supabase'
import { hazmatIncidentRowToDraft, type JobHazmatIncidentRow } from './hazmatIncidents'
import type { HazmatNoticeJobInfo } from './jobsDocuments/hazmatFeeNotice'
import {
  buildHazmatFeeNoticePdfBlob,
  hazmatNoticePdfFilename,
} from './jobsDocuments/hazmatFeeNoticePdf'
import { physicalInvoicePdfToBase64 } from './physicalInvoicePdf'

/**
 * Email the Biohazard Remediation Fee Notice PDF to the customer via the
 * `send-hazmat-notice-email` edge function — the Stripe companion channel
 * (Stripe invoices can't carry attachments) and the Riders-strip re-send.
 * Server re-validates: incident visible under RLS, belongs to the job, and
 * the recipient matches the job's customer email.
 */
export async function sendHazmatNoticeEmailToCustomer(args: {
  jobId: string
  incident: JobHazmatIncidentRow
  jobInfo: HazmatNoticeJobInfo
  customerEmail: string
  /** e.g. "Stripe invoice for job 857" — woven into the email body when present. */
  invoiceReference?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    const token = auth.session?.access_token
    if (!token) return { ok: false, error: 'Not signed in' }

    const blob = await buildHazmatFeeNoticePdfBlob(args.jobInfo, hazmatIncidentRowToDraft(args.incident))
    const pdfBase64 = await physicalInvoicePdfToBase64(blob)
    if (pdfBase64.length > 5_500_000) {
      return { ok: false, error: 'Notice PDF is too large to email' }
    }

    const ref = args.invoiceReference?.trim()
    const text =
      `Please find the Biohazard Remediation Fee Notice for job ${args.jobInfo.jobNumber} attached as a PDF.` +
      (ref ? ` It documents the biohazard remediation fee on the ${ref}.` : '') +
      ' The notice includes the incident summary, photographic evidence, technician statements, and the contractual basis for the fee.'

    const { data, error } = await supabase.functions.invoke('send-hazmat-notice-email', {
      body: {
        job_id: args.jobId,
        incident_id: args.incident.id,
        customer_email: args.customerEmail.trim(),
        subject: `Biohazard Remediation Fee Notice — Job ${args.jobInfo.jobNumber}`,
        pdf_base64: pdfBase64,
        pdf_filename: hazmatNoticePdfFilename(args.jobInfo),
        email_text: text,
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) return { ok: false, error: error.message || 'Notice email failed' }
    const resp = data as { success?: boolean; error?: string } | null
    if (resp && typeof resp.error === 'string' && resp.error.length > 0) {
      return { ok: false, error: resp.error }
    }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Notice email failed' }
  }
}
