import { lienFilingAttachmentName, lienFilingEmailHtml } from '../../../supabase/functions/_shared/lienFilingEmail'
import { filingPdfFilename } from '../jobsDocuments/lienFilingDocuments'
import { runCourtesyEmailWords, type RunNotice, type RunRecipient } from './lienDeskRun'
import type { RunEnvelope } from './runEnvelopes'

/**
 * The courtesy email, previewed (v2.5073, the owner's ask of 2026-10-09): the run window's
 * *Preview the email ›* opens, in a new tab, each email an envelope's courtesy tick sends when the
 * run is recorded, as the original contractor gets it. Nothing is sent. Pure: the words come from
 * the send's own builders (`runCourtesyEmailWords`, `lienFilingEmailHtml`,
 * `lienFilingAttachmentName`), and the window hands in the PDFs it built with the send's
 * `buildRunNoticePdf`, so the preview is the email.
 */

export type RunCourtesyEmail = {
  notice: RunNotice
  recipient: RunRecipient
  to: string
  subject: string
  text: string
  /** The body as `send-lien-filing-email` sends it. */
  html: string
  /** The attachment's name as the email carries it. */
  filename: string
}

/**
 * The courtesy emails an envelope's tick sends (punch list #87 B): one per original contractor's
 * copy inside with an email on file, in packet order, never an owner's, and none for an envelope
 * that goes by email, which is the email. Listed ticked or not: the preview shows what the tick sends.
 */
export function runCourtesyEmails(env: Pick<RunEnvelope, 'method' | 'contents'>): RunCourtesyEmail[] {
  if (env.method === 'email') return []
  return env.contents
    .filter((c) => c.recipient.key === 'original_contractor' && c.recipient.email.trim() !== '')
    .map(({ notice, recipient }) => {
      const words = runCourtesyEmailWords(notice, recipient.method)
      return {
        notice,
        recipient,
        to: recipient.email.trim(),
        subject: words.subject,
        text: words.text,
        html: lienFilingEmailHtml(words.text),
        filename: lienFilingAttachmentName(filingPdfFilename(notice.kind, notice.jobNumber)),
      }
    })
}

/** One attachment as the window built it: its object URL and size, or why it could not be built. */
export type RunCourtesyAttachment = { url: string; bytes: number } | { error: string }

/** `412 KB`, `1.2 MB`: the size a mail app shows beside an attachment. */
export function courtesyFileSizeWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The strip above the emails: nothing has been sent, and whether the tick will send them. */
export function courtesyPreviewStripWords(emails: ReadonlyArray<Pick<RunCourtesyEmail, 'to'>>, ticked: boolean): string {
  const many = emails.length > 1
  const to = [...new Set(emails.map((e) => e.to))].join(', ')
  if (!ticked) return `Preview — nothing has been sent. Courtesy PDF is not ticked, so ${many ? `these ${emails.length} emails` : 'this email'} will not go. Tick it in the run window to send ${many ? 'them' : 'it'}.`
  return `Preview — nothing has been sent. ${many ? `These ${emails.length} emails go` : 'This email goes'} to ${to} when you record the run${many ? ', one per notice' : ''}, while Courtesy PDF stays ticked.`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f3f4f6;color:#111827;font:14px/1.5 -apple-system,"Segoe UI",system-ui,sans-serif;padding:20px 16px 48px}
.wrap{max-width:780px;margin:0 auto}
.strip{padding:9px 13px;border-radius:8px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:13px;margin:0 0 14px}
.strip.off{background:#f9fafb;border-color:#d1d5db;color:#374151}
.count{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:18px 0 6px}
.mail{background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.head{padding:14px 18px 10px;border-bottom:1px solid #e5e7eb}
.subject{font-size:17px;font-weight:600;line-height:1.3;margin:0 0 8px}
.meta{display:grid;grid-template-columns:56px minmax(0,1fr);gap:2px 10px;margin:0;font-size:13px}
.meta dt{color:#6b7280}
.meta dd{margin:0;color:#374151;overflow-wrap:anywhere}
.body{padding:16px 18px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#111}
.body p{margin:0}
.att{margin:0 18px 16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.att-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 10px;background:#f9fafb;font-size:13px}
.badge{flex:none;border-radius:4px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 6px}
.att-name{font-weight:600;overflow-wrap:anywhere}
.att-size{color:#6b7280}
.att-row a{margin-left:auto;color:#2563eb;font-weight:600;text-decoration:none}
.att-row a:hover{text-decoration:underline}
.att-error{color:#b91c1c}
iframe.pdf{display:block;width:100%;height:78vh;border:0;background:#525659}
`

/**
 * The tab's page: the strip, then each email as a mail app shows it — the subject, From, To, when it
 * goes, the body as sent, and the PDF attached, shown in the page with a door to open it alone.
 * Every value is escaped; the body is the send's own HTML.
 */
export function runCourtesyPreviewHtml(
  emails: ReadonlyArray<RunCourtesyEmail>,
  opts: { from: string; ticked: boolean; attachments: ReadonlyArray<RunCourtesyAttachment | undefined> },
): string {
  const many = emails.length > 1
  const title = many ? `Email preview — ${emails.length} courtesy emails` : `Email preview — ${emails[0]?.subject ?? 'courtesy email'}`
  const mails = emails.map((e, i) => {
    const a = opts.attachments[i]
    const att =
      a && 'url' in a
        ? `<div class="att-row"><span class="badge">PDF</span><span class="att-name">${esc(e.filename)}</span><span class="att-size">${esc(courtesyFileSizeWords(a.bytes))}</span><a href="${esc(a.url)}" target="_blank" rel="noopener" data-courtesy-preview-open>Open it in its own tab ›</a></div><iframe class="pdf" src="${esc(a.url)}" title="${esc(e.filename)}"></iframe>`
        : `<div class="att-row"><span class="badge">PDF</span><span class="att-name">${esc(e.filename)}</span><span class="att-error">The PDF could not be built here${a && 'error' in a && a.error ? `: ${esc(a.error)}` : ''}.</span></div>`
    return `${many ? `<div class="count">Email ${i + 1} of ${emails.length}</div>` : ''}<article class="mail" data-courtesy-preview-email="${i + 1}"><header class="head"><h1 class="subject">${esc(e.subject)}</h1><dl class="meta"><dt>From</dt><dd>${esc(opts.from)}</dd><dt>To</dt><dd>${esc(e.to)}</dd><dt>Sent</dt><dd>when the run is recorded</dd></dl></header><div class="body" data-courtesy-preview-body>${e.html}</div><div class="att">${att}</div></article>`
  })
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body><div class="wrap"><div class="strip${opts.ticked ? '' : ' off'}" data-courtesy-preview-strip>${esc(courtesyPreviewStripWords(emails, opts.ticked))}</div>${mails.join('')}</div></body></html>`
}
