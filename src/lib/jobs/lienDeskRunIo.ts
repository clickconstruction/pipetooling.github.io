import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { filingDocFooter, filingDocPdfBlob, filingPdfFilename } from '../jobsDocuments/lienFilingDocuments'
import { markLienDeskItemSent } from './lienDeskIo'
import { runCoverNoteBlocks, runFilingPayload, runNoticeBlocks, type RunNotice, type RunSendRecord } from './lienDeskRun'
import { buildDemandLetterPacket, mergePdfBlobs } from '../jobsDocuments/demandLetterPacket'
import { buildPhysicalInvoicePdfBlob } from '../physicalInvoicePdf'
import { noticeInvoiceExhibitInputs, type NoticeInvoiceDoc } from './noticeInvoiceEnclosure'

/**
 * Recording the run: for every notice, email the courtesy copies that asked
 * for it (the resend id becomes the tracking), insert the `job_lien_filings`
 * row naming every month, and mark the desk item sent. One notice failing
 * never stops the others; the caller gets both lists.
 */

async function emailNoticePdf(n: RunNotice, recipientKey: 'owner' | 'original_contractor', toEmail: string, invoiceDocs: readonly NoticeInvoiceDoc[]): Promise<string> {
  const r = n.recipients.find((x) => x.key === recipientKey)!
  const form = await filingDocPdfBlob(runNoticeBlocks(n, r), { footer: filingDocFooter('notice_53_056') })
  // The run's cover letter (v2.3482) rides in front of the owner's copy, as the printed packet prints it.
  const notice = recipientKey === 'owner' && n.coverLetter ? await mergePdfBlobs([await filingDocPdfBlob(runCoverNoteBlocks(n)), form]) : form
  // The unpaid invoices ride behind the notice, stamped INVOICE (v2.3437, § 53.056(a-3)).
  const blob = invoiceDocs.length > 0 ? (await buildDemandLetterPacket(notice, await noticeInvoiceExhibitInputs(invoiceDocs, buildPhysicalInvoicePdfBlob))).blob : notice
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  const { data, error } = await supabase.functions.invoke('send-lien-filing-email', {
    body: { job_id: n.jobId, to_email: toEmail, recipient_label: recipientKey, pdf_base64: btoa(binary), pdf_filename: filingPdfFilename('notice_53_056', n.jobNumber) },
  })
  if (error || (data as { error?: string } | null)?.error) throw new Error((data as { error?: string } | null)?.error || 'email failed')
  return ((data as { resend_email_id?: string | null } | null)?.resend_email_id ?? '') || 'sent'
}

export type RunRecordResult = { recorded: string[]; failed: { itemId: string; label: string; reason: string }[] }

export async function recordLienDeskRun(
  notices: ReadonlyArray<RunNotice>,
  opts: { userId: string | null; todayYmd: string; invoiceDocsByJob?: Readonly<Record<string, readonly NoticeInvoiceDoc[]>> },
): Promise<RunRecordResult> {
  const result: RunRecordResult = { recorded: [], failed: [] }
  for (const n of notices) {
    try {
      const sends: RunSendRecord[] = []
      for (const r of n.recipients) {
        let tracking = r.tracking.trim()
        if (r.method === 'email') {
          if (!r.email) throw new Error(`${r.label}: no email on file`)
          const id = await emailNoticePdf(n, r.key, r.email, opts.invoiceDocsByJob?.[n.jobId] ?? [])
          tracking = `resend:${id} → ${r.email}`
        }
        sends.push({ recipient: r.key, method: r.method, tracking, sent_on: opts.todayYmd })
      }
      const filing = await withSupabaseRetry<{ id: string }>(
        () => supabase.from('job_lien_filings').insert(runFilingPayload(n, sends, opts.userId) as never).select('id').single(),
        'lien desk run: record notice',
      )
      await markLienDeskItemSent(n.itemId, filing.id)
      result.recorded.push(n.itemId)
    } catch (e) {
      result.failed.push({ itemId: n.itemId, label: n.label, reason: e instanceof Error && e.message ? e.message : 'could not record' })
    }
  }
  return result
}
