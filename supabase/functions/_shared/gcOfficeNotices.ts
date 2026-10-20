/**
 * gc-office-notices' pure half (GC mode, Owner Billing's O10b): the office's notices about a GC job, in words. The
 * database says what is due (`get_gc_office_notices_due()`, O10a, migration 20261010060000) and keeps each one sent
 * (`gc_office_notices`); this holds what the function, the Settings block and Bill the customer agree on: the switch
 * and its day, the hour, each kind's email type and words, and the frames. Dependency-free but for the customer frame,
 * so the app's tests import it straight from here. The plan: to-dos/gc-mode/mockups/owner-billing-o10.md on branch
 * spike/gc-mode. O12b adds the customer's notice 3 days before a bill is due (`get_gc_customer_due_notices()`, O12a,
 * migration 20261010130000; mockups/owner-billing-o12.md), behind its own switch.
 */
import { buildGcCustomerEmail, GC_CUSTOMER_EMAIL_FROM_NAME } from './gcCustomerEmails.ts'

/** The switch: `'false'`, or the ISO day it went on. */
export const GC_OFFICE_NOTICES_SETTING_KEY = 'gc_office_notices_on_v1'

/** The office hour, 0 to 23, from which the morning's notices may go out. */
export const GC_OFFICE_NOTICES_HOUR = 8

export const GC_OFFICE_NOTICE_KINDS = ['bill_day', 'certify_reminder', 'certify_late'] as const
export type GcOfficeNoticeKind = (typeof GC_OFFICE_NOTICE_KINDS)[number]

/** The email type each kind stamps on `email_send_log` (the email catalog's ids). */
export const GC_OFFICE_NOTICE_EMAIL_TYPE: Record<GcOfficeNoticeKind, string> = {
  bill_day: 'gc_office_notice',
  certify_reminder: 'gc_certify_reminder',
  certify_late: 'gc_office_notice',
}

/** The architect's reminder keeps a sent copy on the billing job (docs/SENT_COPIES.md); ours are staff mail, never filed. */
export const GC_CERTIFY_REMINDER_FILED_AS = 'gc_certify_reminder'

/** The customer's notice's switch (O12): `'false'`, or the ISO day it went on. Read by `gcOfficeNoticesSince` too. */
export const GC_CUSTOMER_DUE_NOTICES_SETTING_KEY = 'gc_customer_due_notices_on_v1'

/** The customer's notice's email type, its test's, and its sent copy (docs/SENT_COPIES.md, under Bills). */
export const GC_CUSTOMER_DUE_NOTICE_EMAIL_TYPE = 'gc_customer_due_notice'
export const GC_CUSTOMER_DUE_NOTICE_TEST_EMAIL_TYPE = 'gc_customer_due_notice_test'
export const GC_CUSTOMER_DUE_NOTICE_FILED_AS = 'bill_gc_due_soon'

/**
 * The switch's day: the ISO date it went on, or null for off. Only a real calendar day is on, so 'false', 'true', a
 * word or a day that never was all read off. Only pay applications sent on or after it get notices.
 */
export function gcOfficeNoticesSince(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null
}

/** A trade we paid that still owes its unconditional waiver: the draws, and whether its final one is among them. */
export interface GcOfficeNoticeWaiver {
  company: string
  draws: number[]
  final: boolean
}

/** One notice as `get_gc_office_notices_due()` gives it. */
export interface GcOfficeNotice {
  kind: GcOfficeNoticeKind
  projectId: string
  project: string
  billingJobId: string | null
  /** bill_day: the bill day it is about. */
  billDay?: string
  /** bill_day: the next pay application's number; the other two: the pay application's. */
  number: number
  payAppId?: string
  final?: boolean
  /** What the pay application asked. */
  due?: number
  sentOn?: string
  waiversOwed?: GcOfficeNoticeWaiver[]
  /** certify_late: the architect's name, or null with none on the job. */
  architect?: string | null
  /** certify_late: the day the architect was reminded, or null. */
  remindedOn?: string | null
  /** One of ours (`userId`, with the address) or the architect (`customerId`; the function finds the address). */
  to: { userId?: string; customerId?: string; name: string | null; email?: string | null }
  /** certify_reminder: the project manager the architect replies to. */
  replyTo?: { name: string | null; email: string | null } | null
}

export interface GcOfficeNoticesPayload {
  today: string
  billDay: string
  notices: GcOfficeNotice[]
}

/** Which notices Preview and the test read (O12b): the customer's when the body asks for them, else the office's. */
export function gcNoticesAsked(body: Record<string, unknown> | null | undefined): 'office' | 'customer' {
  return body?.notices === 'customer' ? 'customer' : 'office'
}

/** One customer's notice as `get_gc_customer_due_notices()` gives it (O12a). */
export interface GcCustomerDueNotice {
  kind: 'pay_soon'
  projectId: string
  project: string
  billingJobId: string | null
  payAppId: string
  number: number
  final: boolean
  /** What the architect certified, and the day. */
  certified: number
  certifiedOn: string
  /** What is still open of it. */
  open: number
  /** The due day it names, and whether that day is their own promise. */
  dueOn: string
  promised: boolean
  to: { customerId: string; name: string | null }
  /** The project manager when a real account, else the company's owner: who replies, and who signs. */
  replyTo: { name: string | null; email: string | null } | null
}

export interface GcCustomerDueNoticesPayload {
  today: string
  since: string | null
  notices: GcCustomerDueNotice[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 25". */
export function noticeDay(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`
}

/** "$288,879", with cents only when there are some. */
export function noticeDollars(n: number): string {
  const whole = Math.round(n * 100) % 100 === 0
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`
}

/** "draw 1", "draws 1 and 2", "the final draw", "draw 1 and the final draw" (the window's owedDrawWords). */
export function waiverDrawWords(w: Pick<GcOfficeNoticeWaiver, 'draws' | 'final'>): string {
  const parts: string[] = []
  const d = w.draws
  if (d.length === 1) parts.push(`draw ${d[0]}`)
  else if (d.length > 1) parts.push(`draws ${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`)
  if (w.final) parts.push('the final draw')
  return parts.join(' and ')
}

/** Bill the customer for the job. */
export function billTheCustomerUrl(origin: string, projectId: string): string {
  return `${origin.replace(/\/$/, '')}/gc?bill=${encodeURIComponent(projectId)}`
}

/** "Pay application 3", or "Our final pay application". */
function payAppName(n: Pick<GcOfficeNotice, 'number' | 'final'>): string {
  return n.final ? 'Our final pay application' : `Pay application ${n.number}`
}

/**
 * A notice's subject and lines, one paragraph a line. `url` opens Bill the customer for ours. `wouldRemind`: Preview
 * only reads, so no reminder was ever recorded; the late notice then says the architect would be reminded, never that
 * they have no email (O12b, the lead's fix).
 */
export function officeNoticeWords(n: GcOfficeNotice, url: string, opts: { wouldRemind?: boolean } = {}): { subject: string; lines: string[] } {
  if (n.kind === 'bill_day') {
    const day = noticeDay(n.billDay)
    return {
      subject: `Bill day for ${n.project} is ${day}`,
      lines: [
        `Bill day for ${n.project} is ${day}. Pay application ${n.number} is ready to draft in Bill the customer.`,
        ...(n.waiversOwed ?? []).map((w) => `${w.company} still owes its unconditional waiver on ${waiverDrawWords(w)}.`),
        `Open Bill the customer: ${url}`,
      ],
    }
  }
  if (n.kind === 'certify_reminder') {
    const what = n.final ? `our final pay application for ${n.project}` : `pay application ${n.number} for ${n.project}`
    return {
      subject: `${payAppName(n)} for ${n.project} waits on your certificate`,
      lines: [
        'Hello,',
        `We sent you ${what} on ${noticeDay(n.sentOn)}, for ${noticeDollars(n.due ?? 0)}, to certify.`,
        'We have not had your certificate yet.',
        'Reply here if anything on it needs a change.',
      ],
    }
  }
  const who = n.architect?.trim() || 'the architect'
  return {
    subject: `${payAppName(n)} for ${n.project} still waits on the architect`,
    lines: [
      `${payAppName(n)} for ${n.project} went to ${who} on ${noticeDay(n.sentOn)} and still waits on their certificate.`,
      n.remindedOn
        ? `We reminded them on ${noticeDay(n.remindedOn)}.`
        : opts.wouldRemind
          ? 'They would be reminded first.'
          : n.architect
          ? 'They have no email on file, so they were not reminded.'
          : 'The job has no architect on file, so no one was reminded.',
      `Open Bill the customer: ${url}`,
    ],
  }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "[TEST] " before the subject of a test copy. */
export function testSubject(subject: string): string {
  return `[TEST] ${subject}`
}

/**
 * The email itself. The architect's reminder wears the customer frame (Click Construction, signed by the project
 * manager); ours are plain staff mail, the press to Bill the customer a link.
 */
export function buildOfficeNoticeEmail(
  n: GcOfficeNotice,
  url: string,
  signer: string | null,
  opts: { wouldRemind?: boolean } = {},
): { subject: string; text: string; html: string } {
  const words = officeNoticeWords(n, url, opts)
  if (n.kind === 'certify_reminder') {
    return buildGcCustomerEmail({ subject: words.subject, lines: words.lines, signer: (signer ?? '').trim() || GC_CUSTOMER_EMAIL_FROM_NAME, gc: GC_CUSTOMER_EMAIL_FROM_NAME, portalUrl: null })
  }
  const text = [...words.lines.flatMap((l) => [l, '']), 'GC projects'].join('\n')
  const p = (l: string) => {
    if (l.startsWith('Open Bill the customer: ')) return `<p style="margin:0 0 12px"><a href="${esc(url)}" style="color:#1d4ed8">Open Bill the customer</a></p>`
    return `<p style="margin:0 0 12px">${esc(l)}</p>`
  }
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(words.subject)}</title></head>` +
    `<body style="margin:0;padding:16px;font-family:-apple-system, 'Segoe UI', Roboto, sans-serif;font-size:15px;line-height:1.5;color:#111827;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto">${words.lines.map(p).join('')}<p style="margin:0;color:#6b7280;font-size:13px">GC projects</p></div>` +
    `</body></html>`
  return { subject: words.subject, text, html }
}

/**
 * The customer's notice in words (O12): when the bill is due, who certified it and for what, and what is still open.
 * `architect`: the job's architect by name, else "The architect".
 */
export function customerDueWords(n: GcCustomerDueNotice, architect: string | null): { subject: string; lines: string[] } {
  const name = payAppName(n)
  const day = noticeDay(n.dueOn)
  const who = (architect ?? '').trim() || 'The architect'
  return {
    subject: `${name} for ${n.project} is due ${day}`,
    lines: [
      'Hello,',
      `${name} for ${n.project} is due on ${day}${n.promised ? ', the day you gave us' : ''}.`,
      `${who} certified it for ${noticeDollars(n.certified)} on ${noticeDay(n.certifiedOn)}.`,
      `${noticeDollars(n.open)} is still open.`,
      'If it is already on its way, thank you.',
      'Reply here if anything on it needs a change.',
    ],
  }
}

/**
 * The customer's notice as it goes: the customer frame (Click Construction, signed by the project manager), the bill's
 * portal line when a link is on, and the card line by the certified email's offer rule (`gcEmailCardFee`).
 */
export function buildCustomerDueEmail(
  n: GcCustomerDueNotice,
  opts: { architect: string | null; portalUrl: string | null; cardFee: number | null },
): { subject: string; text: string; html: string } {
  const words = customerDueWords(n, opts.architect)
  return buildGcCustomerEmail({
    subject: words.subject,
    lines: words.lines,
    signer: (n.replyTo?.name ?? '').trim() || GC_CUSTOMER_EMAIL_FROM_NAME,
    gc: GC_CUSTOMER_EMAIL_FROM_NAME,
    portalUrl: opts.portalUrl,
    cardFee: opts.cardFee,
  })
}
