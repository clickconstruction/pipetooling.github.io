/**
 * Messages, cut 3: an email from the reply box, read and framed here so `messages-email` and the What customers see
 * sample read one builder. The words are the office's, put together in the app by `src/lib/messages/compose.ts`
 * (`emailDraft`): the greeting from the name they go by, the body as written, the signature from the sender's account,
 * and the footer with the job. Here they go under our letterhead (`buildGcCustomerEmail`, unframed, so the lines carry
 * their own greeting and sign-off). The letterhead follows the job: a Pipeline job names the plumbing company, any
 * other names Click Construction. Dependency-free, so the app and its tests read it too.
 */
import { buildGcCustomerEmail, GC_CUSTOMER_EMAIL_FROM_NAME } from './gcCustomerEmails.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'

/** The sent copy's kind and the send log's type: `sent_documents.kind`, never changed once rows exist. */
export const MESSAGES_EMAIL_KIND = 'messages_email'

export const MESSAGES_EMAIL_SUBJECT_MAX = 200
export const MESSAGES_EMAIL_BODY_MAX = 10_000
const LINE_MAX = 400
const SIGNATURE_LINES_MAX = 4

/** The `messages` column a job's id goes in, as the thread's job keys name them. */
export type MessagesEmailColumn = 'bid_id' | 'project_id' | 'jobs_ledger_id'

const COLUMNS: ReadonlySet<string> = new Set<MessagesEmailColumn>(['bid_id', 'project_id', 'jobs_ledger_id'])

/** The email's words, as `compose.emailDraft` puts them together. */
export interface MessagesEmailWords {
  subject: string
  greeting: string
  body: string
  signature: string[]
  footer: string
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

/** Our name on the letterhead and the From: the plumbing company on a Pipeline job, Click Construction on any other. */
export function letterheadFor(column: MessagesEmailColumn | null): string {
  return column === 'jobs_ledger_id' ? PORTAL_COMPANY.name : GC_CUSTOMER_EMAIL_FROM_NAME
}

/** The email they read: our letterhead over the greeting, the body, the signature and the footer, each its own paragraph. */
export function buildMessagesEmail(words: MessagesEmailWords, letterhead: string = GC_CUSTOMER_EMAIL_FROM_NAME): { subject: string; text: string; html: string } {
  const lines = [words.greeting, words.body, words.signature.join('\n'), words.footer].map((l) => l.trim()).filter(Boolean)
  return buildGcCustomerEmail({ subject: words.subject.trim(), lines, signer: '', gc: letterhead, framed: false })
}
