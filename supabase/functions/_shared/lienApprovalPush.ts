// The words of the push (or the email) a leader gets when the office sends a lien notice for his
// approval (v2.4872). Shared by notify-lien-approval and the client's test, so the two say the same
// thing. One line: the job, the money, the mail-by day. The tap lands on the job in the desk's
// Awaiting approval pile. Pure: no env reads, no network.
import { todayYmdInAppTz } from './appTimeZone.ts'

/**
 * The day he signed, YYYY-MM-DD in the app's zone, from the row's `signed_at` (v2.6006): a stored instant's day is
 * its Central day, never its first ten characters, which are the UTC day — tomorrow for a signature after 7 PM
 * Central (docs/TIME_AND_ZONES.md). Null when the value is not an instant.
 */
export function signedYmdOf(signedAt: string | null | undefined): string | null {
  const ms = Date.parse(signedAt ?? '')
  return Number.isFinite(ms) ? todayYmdInAppTz(new Date(ms)) : null
}

export type LienApprovalPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The GC the money is owed by; null when unknown. */
  gcName: string | null
  /** The day the notice must be in the mail, YYYY-MM-DD; null when the client did not say. */
  dueYmd: string | null
  /** Today in the app's time zone, YYYY-MM-DD. */
  todayYmd: string
  /** Who sent it for approval; null when the item has no drafter. */
  senderName: string | null
}

export type LienApprovalPush = { title: string; body: string; url: string; tag: string; subject: string; emailText: string }

/** The door that exists: the desk, narrowed to what waits on him, opened on this job (v2.4586 / v2.4854). */
export function lienApprovalUrl(jobId: string): string {
  return `/jobs?tab=stages&liendesk=1&liendeskPile=awaiting&liendeskJob=${encodeURIComponent(jobId)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 15" from "2026-10-15"; null when the day is not a date. */
export function shortDay(ymd: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return null
  return `${month} ${Number(m[3])}`
}

/** Whole days from today to the day; null when either is not a date. */
export function daysUntil(ymd: string | null, todayYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null
  return Math.round((Date.UTC(+ymd!.slice(0, 4), +ymd!.slice(5, 7) - 1, +ymd!.slice(8, 10)) - Date.UTC(+todayYmd.slice(0, 4), +todayYmd.slice(5, 7) - 1, +todayYmd.slice(8, 10))) / 86_400_000)
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function lienApprovalPush(input: LienApprovalPushInput): LienApprovalPush {
  const first = (input.senderName ?? '').trim().split(/\s+/)[0] || null
  const owed = input.claim != null && input.claim > 0 ? `${money(input.claim)}${input.gcName ? ` owed by ${input.gcName}` : ''}` : null
  const day = shortDay(input.dueYmd)
  const days = daysUntil(input.dueYmd, input.todayYmd)
  const mailBy = day ? `mail by ${day}${days != null && days >= 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}` : null
  const body = [input.jobLabel, owed, mailBy].filter(Boolean).join(' · ')
  const title = 'Approve a lien notice'
  const lines = [
    `${first ?? 'The office'} sent a lien notice for your approval.`,
    '',
    input.jobLabel,
    owed ? (owed.endsWith('.') ? owed : `${owed}.`) : null,
    day ? `Mail by ${day}${days != null && days >= 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} from now` : ''}.` : null,
    '',
    'Open the Lien desk to approve it or hold it.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienApprovalUrl(input.jobId), tag: `lien-approval-${input.jobId}`, subject: `Approve a lien notice · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienPenRecordedPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The day the office says he signed, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Who wrote it down; null when unknown. */
  recorderName: string | null
  /** How the office knows: watched, told, or page. */
  how: string | null
}

/** The door that exists: the desk opened on this job in the Ready pile, where Yes, I signed it ▸ sits (the pen train, PR 3). */
export function lienPenRecordedUrl(jobId: string): string {
  return `/jobs?tab=stages&liendesk=1&liendeskPile=ready&liendeskJob=${encodeURIComponent(jobId)}`
}

/**
 * The words the leader gets when the office writes down his pen signature (the pen train, PR 3):
 * one line, the job, the money, the day, who wrote it down. The tap lands on the notice, where
 * Yes, I signed it ▸ and Not what I signed sit. Nothing waits on his answer.
 */
export function lienPenRecordedPush(input: LienPenRecordedPushInput): LienApprovalPush {
  const first = (input.recorderName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'The office'
  const owed = input.claim != null && input.claim > 0 ? money(input.claim) : null
  const day = shortDay(input.signedYmd)
  const howWords = input.how === 'watched' ? `${who} watched you sign` : input.how === 'page' ? `${who} has the signed page` : `${who} says you told them`
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, howWords].filter(Boolean).join(' · ')
  const title = `${who} recorded your pen signature`
  const lines = [
    `${who} recorded that you signed a lien notice with a pen.`,
    '',
    input.jobLabel,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    `${howWords}.`,
    '',
    'Open the Lien desk and press Yes, I signed it, or Not what I signed. Nothing waits on your answer.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienPenRecordedUrl(input.jobId), tag: `lien-pen-${input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienCodeUsedPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The day the code signed it, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Whose screen the code was typed on; null when unknown. */
  deviceName: string | null
}

/**
 * The words the leader gets when his signing code signs a notice on someone else's screen
 * (v2.5791, punch list #150): one line, the job, the money, the day, whose screen. The tap lands on
 * the notice in Ready, where Yes, it was me ▸ and Not me sit. Nothing waits on his answer; a code
 * that was not his is cleared there and changed under Settings, Your account.
 */
export function lienCodeUsedPush(input: LienCodeUsedPushInput): LienApprovalPush {
  const first = (input.deviceName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'the office'
  const owed = input.claim != null && input.claim > 0 ? money(input.claim) : null
  const day = shortDay(input.signedYmd)
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, `on ${who}’s screen`].filter(Boolean).join(' · ')
  const title = 'Your signing code signed a lien notice'
  const lines = [
    `Your signing code was typed on ${who}’s screen to sign a lien notice.`,
    '',
    input.jobLabel,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    '',
    'Open the Lien desk and press Yes, it was me, or Not me. Nothing waits on your answer.',
    'If that was not you, change your code under Settings, Your account.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienPenRecordedUrl(input.jobId), tag: `lien-code-${input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienWaiverCodeUsedPushInput = {
  /** "878 · Take 5 Seguin"; a bid's waiver, "Bid 482 · Take 5 Seguin" (v2.5958) */
  jobLabel: string
  jobId: string
  /** v2.5958: the waiver was made on this bid (Bids → Lien Release), not a job; the tap lands on the bid's tab. */
  bidId?: string | null
  /** The waiver's amount, dollars; null when the row has none. */
  amount: number | null
  /** "Conditional Waiver and Release on Final Payment" — the form's title; null when unknown. */
  formTitle: string | null
  /** The day the code signed it, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Whose screen the code was typed on; null when unknown. */
  deviceName: string | null
}

/**
 * The words the leader gets when his signing code signs a lien WAIVER on someone else's screen
 * (v2.5924): one line, the job, the money, the day, whose screen. The tap lands on the Pipeline,
 * where the job's Release of Lien window holds the signed waiver under Already on this job. A code
 * that was not his is changed under Settings, Your account; the office can void the waiver.
 * A bid's waiver (v2.5958) lands on that bid's Lien Release tab, under Already on this bid.
 */
export function lienWaiverCodeUsedPush(input: LienWaiverCodeUsedPushInput): LienApprovalPush {
  const first = (input.deviceName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'the office'
  const owed = input.amount != null && input.amount > 0 ? money(input.amount) : null
  const day = shortDay(input.signedYmd)
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, `on ${who}’s screen`].filter(Boolean).join(' · ')
  const title = 'Your signing code signed a lien waiver'
  const lines = [
    `Your signing code was typed on ${who}’s screen to sign a release of lien.`,
    '',
    input.jobLabel,
    input.formTitle ? `${input.formTitle}.` : null,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    '',
    input.bidId
      ? 'The signed waiver sits on the bid, in the Lien Release tab under Already on this bid.'
      : 'The signed waiver sits on the job, in the Release of Lien window under Already on this job.',
    'If that was not you, change your code under Settings, Your account, and have the office void the waiver.',
  ].filter((l) => l !== null) as string[]
  const url = input.bidId ? `/bids?tab=lien-release&bidId=${encodeURIComponent(input.bidId)}` : '/jobs?tab=stages'
  return { title, body, url, tag: `lien-waiver-code-${input.bidId ?? input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}
