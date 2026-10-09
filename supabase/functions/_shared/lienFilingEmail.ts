/**
 * The lien paper's email as it is sent (v2.5073): the HTML body and the attachment's file
 * name. `send-lien-filing-email` sends with them, and the run window's courtesy-email preview
 * (`src/lib/jobs/lienRunCourtesyPreview.ts`) draws with them, so the preview is the send.
 * Dependency-free, so the browser imports it too.
 */

/**
 * Where a reply to a lien email goes (v2.5092, the owner's call of 2026-10-09: replies to customer
 * email land in the office inbox, docs/runbooks/CLICKPLUMBING_SENDER.md). The sender is a no-reply
 * address, so without it a GC's answer to a courtesy copy, a notice or a demand reached no one.
 */
export const LIEN_FILING_REPLY_TO = 'office@clickplumbing.com'

/** The email's HTML: the plain text in one paragraph, `<` and `>` escaped, each line break a `<br/>`. */
export function lienFilingEmailHtml(textPlain: string): string {
  return `<p>${textPlain.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`
}

/** The attachment's name as the email carries it: anything but a letter, a digit, `.`, `_` or `-` becomes `_`. */
export function lienFilingAttachmentName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}
