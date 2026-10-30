import { printAndFile } from '../sent/sentCopiesIo'
import { buildGcStatementReportHtml } from '../jobsDocuments/gcStatementReport'
import { buildGcStatementEmailHtml, buildGcStatementEmailText, gcStatementEmailSubject, type GcStatementReceived } from '../jobsDocuments/gcStatementEmail'
import { copyRichHtmlToClipboard } from '../copyRichHtmlToClipboard'
import { getPhysicalInvoiceIssuerForDocument } from '../physicalInvoiceIssuer'
import type { GcReviewGroup, GcReviewGroupBy } from '../gcReviewRollup'

/**
 * GC Review's shell glue (v2.6096, punch list #178): the print and the copy-for-email the
 * Pipeline tab wired inline since v2.1414, moved here so the statement round's window over the
 * Needs you card (`GcReviewWindow`) and the tab drive the same modal with one set of words.
 * Each host keeps its own toasts; nothing here renders.
 */

/** A print counts as a send (docs/SENT_COPIES.md): the statement is filed on its jobs, and under the GC when it is for one. False when pop-ups are blocked. */
export function printGcReviewGroups(groups: GcReviewGroup[], groupBy: GcReviewGroupBy): boolean {
  const one = groups.length === 1 ? groups[0]! : null
  return printAndFile(buildGcStatementReportHtml(groups, { groupBy }), {
    kind: 'gc_statement_print',
    title: one ? `Statement for ${one.gcName}` : `Statement for ${groups.length} ${groupBy === 'development' ? 'developments' : 'GCs'}`,
    recipientName: one?.gcName ?? '',
    jobIds: groups.flatMap((g) => g.rows.map((r) => r.jobId)),
    customerId: one && groupBy !== 'development' ? one.gcId : null,
  })
}

/**
 * The GC-facing statement as rich HTML and plain text on the clipboard. The subject rides at the
 * top of the copied block so it can be cut into the email's subject field; the table below it is
 * the body. Rich HTML pastes as a real table in Gmail / Outlook / Apple Mail; plain text covers
 * everything else. The payments block rides when the modal has read the GC's checks. Rejects when
 * the copy fails.
 */
export function copyGcReviewGroupForEmail(group: GcReviewGroup, extra?: { portalUrl?: string | null; received?: GcStatementReceived | null }): Promise<void> {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const portalUrl = extra?.portalUrl ?? null
  const subject = gcStatementEmailSubject(group, dateStr)
  const copyOpts = { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl, ...(extra?.received ?? {}) }
  const html = `<p style="margin:0 0 10px;font-size:12px;color:#6b7280"><strong>Subject:</strong> ${subject}</p>` + buildGcStatementEmailHtml(group, copyOpts)
  const text = `Subject: ${subject}\n\n${buildGcStatementEmailText(group, copyOpts)}`
  return copyRichHtmlToClipboard(html, text)
}
