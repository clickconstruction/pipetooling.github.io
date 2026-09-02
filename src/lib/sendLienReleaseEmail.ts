/**
 * Email a SIGNED lien release to the job's customer, PDF attached (v2.2621
 * — the "ready to send" lane's primary action). The PDF is the stored
 * signed.pdf when the bucket has it (the exact bytes from signing), else a
 * regeneration from the snapshot with the typed signature + audit line. The
 * edge fn validates the recipient, sends via Resend, and stamps
 * sent_to_customer_at / sent_channel='email' / sent_by on the row.
 */
import { supabase } from './supabase'
import {
  buildLienWaiverPdfBlob,
  lienWaiverPdfFilename,
  type LienWaiverSignature,
} from './jobsDocuments/lienWaiverRelease'
import {
  isLienWaiverFormType,
  lienReleaseFormLabel,
  lienReleaseSnapshotToWaiverFields,
  type JobLienReleaseRow,
} from './jobs/lienReleaseTracking'
import { lienReleaseSignatureAuditLine, lienReleaseStatus } from './jobs/lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './jobs/lienReleaseDocuments'
import { readEdgeFunctionErrorBody } from './readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../utils/errorHandling'
import { resolveEmailWording } from './emailWording'

const MAX_PDF_BASE64_CHARS = 5_500_000

/** The email around the attached release — plain and formal; the PDF is the document. */
export function buildLienReleaseEmailBodies(args: { formLabel: string; projectDescription: string; amountLabel: string }): {
  subject: string
  text: string
  html: string
} {
  const subject = `Release of lien — ${args.projectDescription || 'your project'}`
  const text = [
    `Attached is the signed release of lien (${args.formLabel}, ${args.amountLabel}) for ${args.projectDescription || 'your project'}.`,
    '',
    'The attached PDF is the complete, signed document for your records.',
  ].join('\n')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html =
    `<p>Attached is the signed release of lien (<strong>${esc(args.formLabel)}</strong>, ${esc(args.amountLabel)}) for ${esc(args.projectDescription || 'your project')}.</p>` +
    `<p>The attached PDF is the complete, signed document for your records.</p>`
  return { subject, text, html }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(bin)
}

export type SendLienReleaseEmailResult = { ok: true; sentTo: string } | { ok: false; message: string }

export async function sendLienReleaseEmailToCustomer(
  release: JobLienReleaseRow,
  job: { id: string; customer_email: string | null; hcp_number: string | null; click_number: string | null },
): Promise<SendLienReleaseEmailResult> {
  try {
    if (lienReleaseStatus(release) !== 'signed' || release.voided_at) {
      return { ok: false, message: 'Only a signed release can be emailed.' }
    }
    const recipient = (job.customer_email ?? '').trim()
    if (!recipient) return { ok: false, message: 'Job has no customer email; add it on Edit Job.' }
    const { data: auth } = await supabase.auth.getSession()
    const token = auth.session?.access_token
    if (!token) return { ok: false, message: 'Not signed in' }

    const formType = isLienWaiverFormType(release.form_type) ? release.form_type : 'conditional_progress'
    const fields = lienReleaseSnapshotToWaiverFields(release)

    // Prefer the exact bytes stored at signing; regenerate (typed signature) as fallback.
    let pdfBase64: string | null = null
    if (release.signed_pdf_path) {
      try {
        const { data } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).download(release.signed_pdf_path)
        if (data) pdfBase64 = await blobToBase64(data)
      } catch {
        /* fall through to regeneration */
      }
    }
    if (!pdfBase64) {
      const signature: LienWaiverSignature | null = release.signer_printed_name
        ? {
            mode: 'type',
            printedName: release.signer_printed_name,
            auditLine:
              lienReleaseSignatureAuditLine({
                signed_at: release.signed_at,
                signer_consented_at: release.signer_consented_at,
              }) ?? '',
          }
        : null
      pdfBase64 = await blobToBase64(await buildLienWaiverPdfBlob(formType, fields, signature))
    }
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) return { ok: false, message: 'The signed PDF is too large to email.' }

    const amountLabel = Number(release.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    const formLabel = lienReleaseFormLabel(release.form_type)
    const builtin = buildLienReleaseEmailBodies({
      formLabel,
      projectDescription: fields.projectDescription,
      amountLabel,
    })
    // Dev-saved wording override (Settings → Email templates, v2.2658);
    // built-in copy is the fallback and keeps its richer HTML.
    const wording = await resolveEmailWording(
      'lien_release_to_customer',
      {
        project: fields.projectDescription || 'your project',
        form_label: formLabel,
        amount: amountLabel,
        signer: (release.signer_printed_name ?? '').trim() || fields.signerName,
      },
      { subject: builtin.subject, body: builtin.text },
    )
    const bodies = wording.overridden ? { subject: wording.subject, text: wording.text, html: wording.html } : builtin
    const jobNumber = [job.hcp_number, job.click_number].map((v) => (v ?? '').trim()).find(Boolean) ?? 'job'

    const { data: raw, error: fnErr } = await supabase.functions.invoke('send-lien-release-email', {
      body: {
        release_id: release.id,
        job_id: job.id,
        customer_email: recipient,
        subject: bodies.subject,
        email_text: bodies.text,
        email_html: bodies.html,
        pdf_base64: pdfBase64,
        pdf_filename: lienWaiverPdfFilename(formType, jobNumber),
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (fnErr) {
      const detail = await readEdgeFunctionErrorBody(fnErr)
      return { ok: false, message: detail ?? formatErrorMessage(fnErr, 'Send release email failed') }
    }
    const resp = raw as { success?: boolean; error?: string } | null
    if (resp && typeof resp.error === 'string' && resp.error.length > 0) return { ok: false, message: resp.error }
    return { ok: true, sentTo: recipient }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Send release email failed' }
  }
}
