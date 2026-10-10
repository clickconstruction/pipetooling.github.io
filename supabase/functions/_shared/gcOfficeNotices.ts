/**
 * gc-office-notices' pure half (GC mode, Owner Billing's O10b): the office's notices about a GC job, in words. The
 * database says what is due (`get_gc_office_notices_due()`, O10a, migration 20261010060000) and keeps each one sent
 * (`gc_office_notices`); this holds what the function, the Settings block and Bill the customer agree on: the switch
 * and its day, the hour, each kind's email type and words, and the frames. Dependency-free but for the customer frame,
 * so the app's tests import it straight from here. The plan: to-dos/gc-mode/mockups/owner-billing-o10.md on branch
 * spike/gc-mode.
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

/** A notice's subject and lines, one paragraph a line. `url` opens Bill the customer for ours. */
export function officeNoticeWords(n: GcOfficeNotice, url: string): { subject: string; lines: string[] } {
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
export function buildOfficeNoticeEmail(n: GcOfficeNotice, url: string, signer: string | null): { subject: string; text: string; html: string } {
  const words = officeNoticeWords(n, url)
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
