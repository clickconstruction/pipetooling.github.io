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
  notWhoItWentTo: { status: 409, words: 'A reminder goes to the person it was sent to. Take it off their page to send it to someone else.' },
  notAGc: { status: 409, words: 'That customer is not the GC on any job with us.' },
  notTheirJob: { status: 409, words: 'That job is not one of theirs. Pick a job they are the GC on.' },
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

/**
 * A reminder, or word that it changed, goes to the person the send went to: the address on the send's own live row.
 * Two people at one company can share a name, so a name never picks who. A first send may pick anyone on the record,
 * and so may a send with no live row or with a row that kept no address.
 */
export function resendGoesToWhoItWentTo(why: DocumentBuilderSendWhy, wentTo: string | null | undefined, asked: string): boolean {
  if (why === 'first') return true
  const was = (wentTo ?? '').trim().toLowerCase()
  return was === '' || was === asked.trim().toLowerCase()
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

/**
 * Whether a job's sheet went out on a usual someone checked. The read mark names one revision of the usual. A job's
 * sheet is published on one revision of the usual, and stays on it until the job is published again. So the question
 * is asked of the revision the sheet went out on, never of the usual's newest: a newer usual that was checked does
 * not check an older sheet, and a newer usual nobody checked does not uncheck a sheet that went out on the checked
 * one. The screen's warning and the function's refusal both ask here.
 */
export function sheetWentOutChecked(readRevision: number | null | undefined, sheetUsualRevision: number | null | undefined): boolean {
  return typeof sheetUsualRevision === 'number' && sheetUsualRevision >= 1 && readRevision === sheetUsualRevision
}

/**
 * Why a job's sheet goes only with the box *Send it anyway*, or an empty string once the revision of the usual it went
 * out on is checked. A sheet behind the usual names its revision, since the mark on the bar speaks of the newest. A
 * job with no sheet published yet is asked of the usual's newest, the one it would go out on.
 */
export function sheetUnreadWords(input: { readRevision: number | null; sheetUsualRevision: number | null; usualRevision: number }): string {
  const on = typeof input.sheetUsualRevision === 'number' && input.sheetUsualRevision >= 1 ? input.sheetUsualRevision : input.usualRevision
  if (sheetWentOutChecked(input.readRevision, on)) return ''
  if (on >= 1 && on < input.usualRevision) return `Your insurance agent has not checked revision ${on} of your usual sheet. This job's sheet went out on that revision.`
  return 'Your insurance agent has not checked your usual sheet.'
}

/** The kind a sent sheet's email is filed as under Sent copies. */
export const SHEET_SEND_SENT_KIND = 'insurance_sheet_email'

/**
 * The jobs a filed copy is about. Sent copies knows a job as a row of `jobs_ledger`, and the Document builder's
 * papers are about a GC project. A project that bills through a job (`gc_projects.billing_job_id`) files under it,
 * and a builder sent about one of a customer's jobs files under that one. A project with no such job files under
 * none, and its copy is found by its title, which names it.
 */
export function sentCopyJobIds(jobId: string | null | undefined): string[] {
  const id = (jobId ?? '').trim()
  return id ? [id] : []
}

/** A job's sheet as a trade's own page reads it. */
export type TradePageSheet = {
  sheetId: string
  projectId: string
  /** The job's name. */
  job: string
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

// ---------------------------------------------------------------------------------------------------------------
// A builder to a GC (step 9): the same send, pointed at a customer who is the GC on our jobs, with the job it is about.
// ---------------------------------------------------------------------------------------------------------------

export type BuilderSendRequest = {
  builderKey: string
  customerId: string
  /** The job it is about. Null means all their jobs with us. */
  aboutJobId: string | null
  contactEmail: string
  note: string
  why: DocumentBuilderSendWhy
  anyway: boolean
  test: boolean
}

/** Which send an ask is, told by who it names: a customer for a builder, a trade partner for a job's sheet. */
export function sendAskKind(body: unknown): 'sheet' | 'builder' {
  return typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).customerId === 'string' ? 'builder' : 'sheet'
}

/** A builder's send as the function is asked for it, or null when the ask is not whole. */
export function parseBuilderSend(body: unknown): BuilderSendRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const builderKey = text(b.builderKey)
  const customerId = text(b.customerId).toLowerCase()
  const about = b.aboutJobId == null || b.aboutJobId === '' ? null : text(b.aboutJobId).toLowerCase()
  const contactEmail = text(b.contactEmail).toLowerCase()
  const note = text(b.note)
  const why = b.why
  if (!KEY_RE.test(builderKey) || !UUID_RE.test(customerId) || !EMAIL_RE.test(contactEmail)) return null
  if (about !== null && !UUID_RE.test(about)) return null
  if (note.length > DOCUMENT_BUILDER_SEND_NOTE_MAX) return null
  if (why !== 'first' && why !== 'again' && why !== 'changed') return null
  return { builderKey, customerId, aboutJobId: about, contactEmail, note, why, anyway: b.anyway === true, test: b.test === true }
}

/** A job as a GC's own page names it (`portalMergedBills.ts` `jobLabel`): the name, then its number. */
export function gcJobLabel(job: { job_name: string | null; hcp_number: string | null; click_number: string | null }): string {
  const n = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  const name = (job.job_name ?? '').trim()
  if (n && name) return `${name} · Job ${n}`
  return name || (n ? `Job ${n}` : 'Job')
}

/** A customer's own page, by its link: `<origin>/portal?t=<token>`. */
export function customerPageUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/portal?t=${encodeURIComponent(token)}`
}

/**
 * Which of a customer's links is the page a GC opens: the view made for the jobs they are the GC on, else the whole
 * account's. A link that shows only their own jobs is not it. `state` is none when no such link was ever made, and off
 * when every one was turned off.
 */
export function gcPageLink(links: ReadonlyArray<{ audience: string; token: string | null; revoked_at: string | null }>): { state: 'on'; token: string } | { state: 'none' } | { state: 'off' } {
  const theirs = links.filter((l) => l.audience === 'gc' || l.audience === 'all')
  const on = theirs.filter((l) => !l.revoked_at && !!l.token)
  const token = (on.find((l) => l.audience === 'gc') ?? on.find((l) => l.audience === 'all'))?.token
  if (token) return { state: 'on', token }
  return theirs.length === 0 ? { state: 'none' } : { state: 'off' }
}

/** The note a send to a GC starts on. A person types over it. */
export const BUILDER_SEND_NOTE = 'Here is how we bind the people we bring onto your jobs. Tell me what you would change.'

/**
 * The email that tells a GC a builder is on their page: its subject and its lines, under the greeting and the press to
 * their page. `aboutJob` is the job it sits under there, or null when it is about all their jobs.
 */
export function builderSendEmail(input: { company: string; aboutJob: string | null; note: string; why: DocumentBuilderSendWhy }): { subject: string; lines: string[] } {
  const company = input.company.trim() || 'us'
  const subject = input.why === 'changed' ? 'We changed the secrecy builder you looked at' : input.why === 'again' ? `A reminder: secrecy on your jobs with ${company}` : `Secrecy on your jobs with ${company}`
  const lines: string[] = []
  if (input.note.trim()) lines.push(input.note.trim())
  const job = (input.aboutJob ?? '').trim()
  if (input.why === 'changed') lines.push('It has changed since you opened it. The new one is on your page.')
  else lines.push(job ? `It is on your page, under ${job}.` : 'It is on your page.')
  lines.push('You can look. Nothing is sent from it.')
  return { subject, lines }
}

/** The kind a sent builder's email is filed as under Sent copies. */
export const BUILDER_SEND_SENT_KIND = 'secrecy_builder_email'

/** A builder a GC was sent, as their own page reads it. */
export type CustomerPageBuilder = {
  sendId: string
  builderKey: string
  /** The job it is about, and that job's label on their page. Both null when it is about all their jobs. */
  aboutJobId: string | null
  aboutJob: string | null
  revision: number
  /** The builder as published. Never a draft. */
  contents: unknown
  /** The day they last opened it, in the office's zone. Null until they do. */
  openedOn: string | null
  /** True when they have opened this revision. */
  opened: boolean
  /** True when they opened an older revision and this one is newer. */
  changed: boolean
}

