/**
 * Messages, cut 3: an email from the reply box, read and built here so `messages-email` and the What customers see
 * sample read one builder. The words are the office's, put together in the app by `src/lib/messages/compose.ts`
 * (`emailDraft`): the body as written, its greeting on the first line when the person kept the box's pre-typed one, and
 * the signature from the sender's account. Since v2.6038 (punch list #207 PR 1, Wendi's finding on the email's look) the
 * email is plain: no letterhead bar, no card, no footer, nothing of ours after the signature (`buildPlainMessagesEmail`;
 * the mock-up's shape A). The company's name stays on the From (`letterheadFor`: the plumbing company on a Pipeline
 * job, Click Construction on any other). A client built before that still sends a `greeting` and a `footer`; both are
 * drawn when given, so a stale tab's email keeps its greeting. Dependency-free, so the app and its tests read it too.
 */
import { GC_CUSTOMER_EMAIL_FROM_NAME } from './gcCustomerEmails.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'

/** The sent copy's kind and the send log's type: `sent_documents.kind`, never changed once rows exist. */
export const MESSAGES_EMAIL_KIND = 'messages_email'

export const MESSAGES_EMAIL_SUBJECT_MAX = 200
export const MESSAGES_EMAIL_BODY_MAX = 10_000
const LINE_MAX = 400
/** The name, the title with the company, the cell, the two lines of their own, and one to spare. */
const SIGNATURE_LINES_MAX = 6

/** The `messages` column a job's id goes in, as the thread's job keys name them. */
export type MessagesEmailColumn = 'bid_id' | 'project_id' | 'jobs_ledger_id'

const COLUMNS: ReadonlySet<string> = new Set<MessagesEmailColumn>(['bid_id', 'project_id', 'jobs_ledger_id'])

/** The email's words, as `compose.emailDraft` puts them together. */
export interface MessagesEmailWords {
  subject: string
  /** As typed, the greeting on its first line when the person kept it. */
  body: string
  signature: string[]
  /** A greeting of the app's, from a client built before v2.6038; drawn before the body when given. */
  greeting?: string
  /** A footer of the app's, from a client built before v2.6038; drawn after the signature when given. */
  footer?: string
}

/** What the reply box sends: the person, the address (one of their `contact_channels`), the job, and the words. */
export interface MessagesEmailBody extends MessagesEmailWords {
  contactId: string
  channelId: string
  tie: { jobId: string; column: MessagesEmailColumn } | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The request, checked. Null when a piece is missing or too long: the person and the address as ids, a subject and a
 * body with words in them, a signature of a few short lines, and a job as an id with its column or none.
 */
export function parseMessagesEmailBody(json: unknown): MessagesEmailBody | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const o = json as Record<string, unknown>
  const id = (v: unknown) => (typeof v === 'string' && UUID.test(v.trim()) ? v.trim() : null)
  const words = (v: unknown, max: number, required: boolean): string | null => {
    if (typeof v !== 'string') return required ? null : ''
    const t = v.trim()
    if (t.length > max || (required && !t)) return null
    return t
  }
  const contactId = id(o.contactId)
  const channelId = id(o.channelId)
  const subject = words(o.subject, MESSAGES_EMAIL_SUBJECT_MAX, true)
  const body = words(o.body, MESSAGES_EMAIL_BODY_MAX, true)
  const greeting = words(o.greeting, LINE_MAX, false)
  const footer = words(o.footer, LINE_MAX, false)
  const signatureRaw = Array.isArray(o.signature) ? o.signature : []
  const signature = signatureRaw.map((l) => words(l, LINE_MAX, true))
  if (!contactId || !channelId || subject === null || body === null || greeting === null || footer === null) return null
  if (signature.length > SIGNATURE_LINES_MAX || signature.some((l) => l === null)) return null
  let tie: MessagesEmailBody['tie'] = null
  if (o.tie !== null && o.tie !== undefined) {
    const t = typeof o.tie === 'object' && !Array.isArray(o.tie) ? (o.tie as Record<string, unknown>) : null
    const jobId = t ? id(t.jobId) : null
    const column = t && typeof t.column === 'string' && COLUMNS.has(t.column) ? (t.column as MessagesEmailColumn) : null
    if (!jobId || !column) return null
    tie = { jobId, column }
  }
  return { contactId, channelId, tie, subject, greeting, body, signature: signature as string[], footer }
}

/** Our name on the From, and on the signature's company line: the plumbing company on a Pipeline job, Click Construction on any other. */
export function letterheadFor(column: MessagesEmailColumn | null): string {
  return column === 'jobs_ledger_id' ? PORTAL_COMPANY.name : GC_CUSTOMER_EMAIL_FROM_NAME
}

/** A line under the words for a file that went as a link (cut 7e, `messagesEmailFiles.emailLinkLines`). */
export interface MessagesEmailLink {
  text: string
  url: string
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)

// Single quotes inside the stack: the stack sits in a double-quoted style attribute, which a double quote would end early.
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#111827'
const MUTED = '#6b7280'

/**
 * The email they read, plain (v2.6038, the mock-up's shape A): the words as typed, the files that went as links a line
 * each under them (cut 7e), then the signature, its first line in ink and the rest small and grey, and nothing after
 * it. No bar, no card, no colour: it reads like an email a person wrote, because it is one. The papers the app sends
 * (an estimate, a bill, a contract, a lien notice) keep their letterhead; a reply from the box is a person's. A stale
 * client's `greeting` goes before the body and its `footer` after the signature, small and grey, when given.
 */
export function buildPlainMessagesEmail(words: MessagesEmailWords, links: readonly MessagesEmailLink[] = []): { subject: string; text: string; html: string } {
  const subject = words.subject.trim()
  const greeting = (words.greeting ?? '').trim()
  const body = words.body.trim()
  const footer = (words.footer ?? '').trim()
  const shown = links.filter((l) => /^https:\/\/\S+$/.test(l.url) && l.text.trim())
  const signature = words.signature.map((l) => l.trim()).filter(Boolean)
  const text = [greeting, body, shown.map((l) => `${l.text.trim()}: ${l.url}`).join('\n'), signature.join('\n'), footer].filter(Boolean).join('\n\n')
  const p = (s: string) => `<p style="margin:0 0 12px">${escHtml(s).replace(/\n/g, '<br>')}</p>`
  const linksHtml = shown.length
    ? `<p style="margin:0 0 12px">${shown
        .map((l) => `${escHtml(l.text.trim())}: <a href="${escHtml(l.url)}" style="color:inherit">${escHtml(l.url.replace(/^https:\/\//, ''))}</a>`)
        .join('<br>')}</p>`
    : ''
  const signatureHtml = signature.length
    ? `<p style="margin:18px 0 0;line-height:1.35">${signature
        .map((l, i) => (i === 0 ? escHtml(l) : `<span style="color:${MUTED};font-size:13px">${escHtml(l)}</span>`))
        .join('<br>')}</p>`
    : ''
  const footerHtml = footer ? `<p style="margin:12px 0 0;color:${MUTED};font-size:13px">${escHtml(footer)}</p>` : ''
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto;padding:16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK}">` +
    (greeting ? p(greeting) : '') +
    p(body) +
    linksHtml +
    signatureHtml +
    footerHtml +
    `</div></body></html>`
  return { subject, text, html }
}
