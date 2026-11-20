/**
 * The Document builder's send (punch list #404, steps 5 and 9): what the edge function and the app both keep. A send
 * is an email to one person at a trade partner, or at a customer who is the GC on our jobs, with one press to the
 * page they already open. No imports, so the app's tests import it as the function does
 * (`src/lib/documentBuilder/sendWords.ts` re-exports it).
 *
 * Every word here is a placeholder in plain words, written for this file.
 */

export type DocumentBuilderSendWhy = 'first' | 'again' | 'changed'
export const DOCUMENT_BUILDER_SEND_WHYS: readonly DocumentBuilderSendWhy[] = ['first', 'again', 'changed']

/** Why a send is refused, each with its status and its words. */
export const DOCUMENT_BUILDER_SEND_REFUSALS = {
  badRequest: { status: 400, words: 'That send is missing something. Open the box again.' },
  notYours: { status: 403, words: 'Only a dev sends from the Document builder for now.' },
  training: { status: 403, words: 'A training account and a twin send nothing.' },
  notFound: { status: 404, words: 'That is no longer there. Read the page again.' },
  notPublished: { status: 409, words: 'Publish it first. Then it can be sent.' },
  unread: { status: 409, words: 'Nobody has marked this revision as read. Tick Send it anyway to send it.' },
  notOnJob: { status: 409, words: 'That company is not on this job.' },
  noSuchContact: { status: 409, words: 'That person is not on the company record. Pick someone who is.' },
  pageOff: { status: 409, words: 'Their page was turned off. A send never turns a page back on.' },
  noEmail: { status: 409, words: 'Email is not set up yet, so nothing was sent.' },
  sendFailed: { status: 502, words: 'The email did not go. Nothing was recorded. Try again.' },
  linkOff: { status: 404, words: 'This link is no longer open.' },
  failed: { status: 500, words: 'Something went wrong. Try again in a moment.' },
} as const
export type DocumentBuilderSendRefusal = keyof typeof DOCUMENT_BUILDER_SEND_REFUSALS

export const DOCUMENT_BUILDER_SEND_NOTE_MAX = 2000

export type SheetSendRequest = {
  builderKey: string
  sheetId: string
  companyId: string
  contactEmail: string
  note: string
  why: DocumentBuilderSendWhy
  anyway: boolean
  test: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^[a-z][a-z0-9-]{0,39}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A sheet's send as the function is asked for it, or null when the ask is not whole. */
export function parseSheetSend(body: unknown): SheetSendRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const builderKey = text(b.builderKey)
  const sheetId = text(b.sheetId).toLowerCase()
  const companyId = text(b.companyId).toLowerCase()
  const contactEmail = text(b.contactEmail).toLowerCase()
  const note = text(b.note)
  const why = b.why
  if (!KEY_RE.test(builderKey) || !UUID_RE.test(sheetId) || !UUID_RE.test(companyId) || !EMAIL_RE.test(contactEmail)) return null
  if (note.length > DOCUMENT_BUILDER_SEND_NOTE_MAX) return null
  if (why !== 'first' && why !== 'again' && why !== 'changed') return null
  return { builderKey, sheetId, companyId, contactEmail, note, why, anyway: b.anyway === true, test: b.test === true }
}

/** The note a send to a trade starts on. A person types over it. */
export const SHEET_SEND_NOTE = 'Here is what your certificate must show on this job. Hand it to your insurance agent.'

/**
 * The email that carries a job's sheet to a trade: its subject and its lines, under the trade email's own greeting and
 * its press to their page. `sheetUrl` is the sheet's own link, for their insurance agent, when the sheet has one.
 */
export function sheetSendEmail(input: { job: string; note: string; why: DocumentBuilderSendWhy; sheetUrl: string | null }): { subject: string; lines: string[] } {
  const job = input.job.trim() || 'your job with us'
  const subject = input.why === 'changed' ? `The insurance requirements for ${job} changed` : input.why === 'again' ? `A reminder: insurance requirements for ${job}` : `Insurance requirements for ${job}`
  const lines: string[] = []
  if (input.note.trim()) lines.push(input.note.trim())
  if (input.why === 'changed') lines.push(`The insurance requirements for ${job} changed since you opened them. The new sheet is on your page.`)
  else lines.push(`The sheet says what your certificate of insurance must show on ${job}. It is on your page.`)
  if (input.sheetUrl) lines.push(`Your insurance agent can open the sheet with this link. It needs no login: ${input.sheetUrl}`)
  lines.push('Send us the certificate from your page. You can also reply to this email with it.')
  return { subject, lines }
}

/** The key of the message row a send leaves on the company's thread: one a send and a time it went. */
export function sheetSendMessageKey(sendId: string, timesSent: number): string {
  return `builder-send:${sendId}:${timesSent}`
}

/** The kind a sent sheet's email is filed as under Sent copies. */
export const SHEET_SEND_SENT_KIND = 'insurance_sheet_email'

/** A job's sheet as a trade's own page reads it. */
export type TradePageSheet = {
  sheetId: string
  projectId: string
  revision: number
  /** The page as published. */
  sheet: unknown
  /** The sheet's own link code, to hand to an insurance agent. Null when the link is off. */
  linkCode: string | null
  /** True when they have opened this revision. */
  opened: boolean
  /** True when they opened an older revision and this one is newer. */
  changed: boolean
}
