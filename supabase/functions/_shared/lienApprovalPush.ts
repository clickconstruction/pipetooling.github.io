// The words of the push (or the email) a leader gets when the office sends a lien notice for his
// approval (v2.4872). Shared by notify-lien-approval and the client's test, so the two say the same
// thing. One line: the job, the money, the mail-by day. The tap lands on the job in the desk's
// Awaiting approval pile. Pure: no env reads, no network.

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
