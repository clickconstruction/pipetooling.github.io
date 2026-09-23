import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { filingDocFooter, filingDocPdfBlob, filingPdfFilename, type FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'
import { markLienDeskItemSent } from './lienDeskIo'
import { clearOneShotLienClaimCorrection } from './lienClaimCorrectionIo'
import { runCoverNoteBlocks, runFilingPayload, runNoticeBlocks, type RunNotice, type RunSendRecord } from './lienDeskRun'
import { combinedFilingPayloads, type CombinedRunNotice } from './lienNoticeCombine'
import { buildDemandLetterPacket, mergePdfBlobs } from '../jobsDocuments/demandLetterPacket'
import { buildPhysicalInvoicePdfBlob } from '../physicalInvoicePdf'
import { noticeInvoiceExhibitInputs, type NoticeInvoiceDoc } from './noticeInvoiceEnclosure'

/**
 * Recording the run: for every notice, email the courtesy copies that asked
 * for it (the resend id becomes the tracking), insert the `job_lien_filings`
 * row naming every month, and mark the desk item sent. One notice failing
 * never stops the others; the caller gets both lists.
 */

async function emailNoticePdf(n: RunNotice, recipientKey: 'owner' | 'original_contractor', toEmail: string, invoiceDocs: readonly NoticeInvoiceDoc[], payBlocks: readonly FilingDocBlock[] = []): Promise<string> {
  const r = n.recipients.find((x) => x.key === recipientKey)!
  const form = await filingDocPdfBlob(runNoticeBlocks(n, r), { footer: filingDocFooter(n.kind) })
  // The run's cover letter (v2.3482) rides in front of the owner's copy, as the printed packet prints it;
  // the pay page (v2.3758) rides behind the form, in front of the invoices it points at.
  const parts: Blob[] = []
  if (recipientKey === 'owner' && n.coverLetter) parts.push(await filingDocPdfBlob(runCoverNoteBlocks(n)))
  parts.push(form)
  if (payBlocks.length > 0) parts.push(await filingDocPdfBlob([...payBlocks], { footer: filingDocFooter(n.kind) }))
  const notice = parts.length > 1 ? await mergePdfBlobs(parts) : form
  // The unpaid invoices ride behind the notice, stamped INVOICE (v2.3437, § 53.056(a-3)).
  const blob = invoiceDocs.length > 0 ? (await buildDemandLetterPacket(notice, await noticeInvoiceExhibitInputs(invoiceDocs, buildPhysicalInvoicePdfBlob))).blob : notice
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  const { data, error } = await supabase.functions.invoke('send-lien-filing-email', {
    body: { job_id: n.jobId, to_email: toEmail, recipient_label: recipientKey, pdf_base64: btoa(binary), pdf_filename: filingPdfFilename(n.kind, n.jobNumber) },
  })
  if (error || (data as { error?: string } | null)?.error) throw new Error((data as { error?: string } | null)?.error || 'email failed')
  return ((data as { resend_email_id?: string | null } | null)?.resend_email_id ?? '') || 'sent'
}

export type RunRecordResult = { recorded: string[]; failed: { itemId: string; label: string; reason: string }[] }

export async function recordLienDeskRun(
  notices: ReadonlyArray<CombinedRunNotice>,
  opts: {
    userId: string | null
    todayYmd: string
    invoiceDocsByJob?: Readonly<Record<string, readonly NoticeInvoiceDoc[]>>
    /** The pay page's blocks per job and copy (v2.3758), merged behind the emailed form. */
    payBlocksByJob?: Readonly<Record<string, Partial<Record<'owner' | 'original_contractor', readonly FilingDocBlock[]>>>>
    /** The saved copy (v2.3763): a Drive link to the paper as sent, with a note. */
    document?: { url?: string | null; note?: string | null }
  },
): Promise<RunRecordResult> {
  const result: RunRecordResult = { recorded: [], failed: [] }
  for (const n of notices) {
    try {
      const sends: RunSendRecord[] = []
      for (const r of n.recipients) {
        let tracking = r.tracking.trim()
        if (r.method === 'email') {
          if (!r.email) throw new Error(`${r.label}: no email on file`)
          const id = await emailNoticePdf(n, r.key, r.email, opts.invoiceDocsByJob?.[n.jobId] ?? [], opts.payBlocksByJob?.[n.jobId]?.[r.key] ?? [])
          tracking = `resend:${id} → ${r.email}`
        }
        sends.push({ recipient: r.key, method: r.method, tracking, sent_on: opts.todayYmd })
      }
      if (n.parts && n.parts.length > 1) {
        // One notice for the jobs at a property (#35 PR 3): one filing per job on one packet, each item sent.
        const packetId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const rows = await withSupabaseRetry<{ id: string; job_id: string }[]>(
          () => supabase.from('job_lien_filings').insert(combinedFilingPayloads(n, sends, { userId: opts.userId, packetId, document: opts.document ?? {} }) as never).select('id, job_id'),
          'lien desk run: record combined notice',
        )
        const filingByJob = new Map((rows ?? []).map((r) => [r.job_id, r.id]))
        for (const part of n.parts) {
          const filingId = filingByJob.get(part.jobId)
          if (filingId) await markLienDeskItemSent(part.itemId, filingId)
          await clearOneShotLienClaimCorrection(part.jobId).catch(() => undefined)
          result.recorded.push(part.itemId)
        }
        continue
      }
      const filing = await withSupabaseRetry<{ id: string }>(
        () => supabase.from('job_lien_filings').insert(runFilingPayload(n, sends, opts.userId, opts.document ?? {}) as never).select('id').single(),
        'lien desk run: record notice',
      )
      await markLienDeskItemSent(n.itemId, filing.id)
      // A claim corrected for this notice only (v2.3682) is done now; a carried one stays for the next.
      await clearOneShotLienClaimCorrection(n.jobId).catch(() => undefined)
      result.recorded.push(n.itemId)
    } catch (e) {
      result.failed.push({ itemId: n.itemId, label: n.label, reason: e instanceof Error && e.message ? e.message : 'could not record' })
    }
  }
  return result
}
