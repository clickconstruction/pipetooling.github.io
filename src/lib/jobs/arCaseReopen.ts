/**
 * Reopening a closed case (punch list #443, row 5): the take-back of **Close it as settled** and **Close it as not
 * coming** on Accounts Receivable.
 *
 * A closed case leaves **Came back** and no screen listed it again, so a case closed by mistake stood closed for
 * good. Three functions reopen one (`reopen_ar_return_case`, `reopen_ar_stripe_case`,
 * `reopen_ar_unbanked_check_case`). This is the rule for the press that calls them. Pure: the fresh read and the
 * call are `arCaseReopenIo.ts`, the list and the press `components/jobs/ar/ArClosedCases.tsx`.
 *
 * - The list and the press are drawn for the office: a dev, a master, an assistant and a controller, the four
 *   roles the three functions let in. It was a dev alone on a test job's case until the owner's answer of
 *   2026-11-25, *Wider*.
 * - Only a case the office closed by hand is listed and reopened: *settled another way* or *not coming*. A case
 *   closed because a new check replaced it, or by Stripe's own answer, stays, and is counted, not listed. The
 *   returned-check function reopened any closed case and cleared its replacement until v2.8615 (migration
 *   20261126020832), so this rule was the one that held it to the two reasons; since then the database holds the
 *   same rule, and this one refuses before the call with its reason.
 * - The list grows for good, so it shows the cases closed in the last 90 days and folds the older ones.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly, ymdDaysBetween } from '../../utils/dateUtils'
import type { ArReturnCaseRow } from './arReturnCase'

/** The roles the three reopen functions let in. */
export const AR_CASE_REOPEN_ROLES: ReadonlyArray<string> = ['dev', 'master_technician', 'assistant', 'controller']

/** Who is offered the list of closed cases: the office. Every other role sees nothing. */
export function arCaseReopenDrawn(role: string | null | undefined): boolean {
  return AR_CASE_REOPEN_ROLES.includes(role ?? '')
}

/** The reasons the office closes a case with by hand, the only ones a reopen undoes. */
export const AR_CASE_REOPEN_REASONS: ReadonlyArray<string> = ['settled_other_way', 'not_coming']

/** What of a case the rule reads. */
export type ArCaseReopenRow = Pick<ArReturnCaseRow, 'mercury_transaction_id' | 'source' | 'closed_at' | 'closed_reason' | 'live_payments' | 'last_job' | 'recorded_payment' | 'stripe_case'>

/** Every job a case names, once each, with its name: the jobs its payments are on, the last job it was on, the payment typed by hand, Stripe's bill. */
export function arCaseJobs(row: Pick<ArReturnCaseRow, 'live_payments' | 'last_job' | 'recorded_payment' | 'stripe_case'>): Array<{ job_id: string; job_name: string | null }> {
  const seen = new Map<string, { job_id: string; job_name: string | null }>()
  for (const ref of [...(row.live_payments ?? []), row.last_job, row.recorded_payment, row.stripe_case]) {
    if (ref && typeof ref.job_id === 'string' && ref.job_id && !seen.has(ref.job_id)) seen.set(ref.job_id, { job_id: ref.job_id, job_name: ref.job_name ?? null })
  }
  return [...seen.values()]
}

/** Why this case cannot be reopened; '' when it can. Null is a case that is no longer there. */
export function arCaseReopenProblem(row: ArCaseReopenRow | null | undefined): string {
  if (!row) return 'The case is not there any more. Read the page again.'
  if (!row.closed_at) return 'This case is open already.'
  if (!AR_CASE_REOPEN_REASONS.includes(row.closed_reason ?? '')) return 'Only a case closed as settled another way or as not coming can be reopened.'
  return ''
}

/** The function that reopens a case, and its one argument, by where the case lives. */
export function arCaseReopenCall(row: Pick<ArReturnCaseRow, 'mercury_transaction_id' | 'source'>): { fn: 'reopen_ar_return_case' | 'reopen_ar_stripe_case' | 'reopen_ar_unbanked_check_case'; args: Record<string, string> } {
  if (row.source === 'unbanked') return { fn: 'reopen_ar_unbanked_check_case', args: { p_case_id: row.mercury_transaction_id } }
  if (row.source === 'stripe_dispute' || row.source === 'stripe_debit') return { fn: 'reopen_ar_stripe_case', args: { p_case_id: row.mercury_transaction_id } }
  return { fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: row.mercury_transaction_id } }
}

/** How far back the list shows before it folds the rest, in days. */
export const AR_CLOSED_CASES_RECENT_DAYS = 90

/** One closed case as the office's list draws it. */
export interface ArClosedCaseLine {
  id: string
  /** Who the money was from; *No name on record* when the case holds none. */
  payer: string
  amount: number | null
  /** *Closed as not coming on Mon, Nov 23.*, with the note the office typed after it. */
  closedWords: string
  /** The jobs it names, by name; '' when it names none. */
  jobWords: string
  /** Closed more than 90 days ago, so the list folds it until **Show older** is pressed. */
  older: boolean
}

const REASON_WORDS: Readonly<Record<string, string>> = { settled_other_way: 'settled another way', not_coming: 'not coming' }

const amountOf = (v: number | string | null | undefined): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * The closed cases a reopen undoes, newest closed first, and how many closed cases were left out because they
 * were closed another way. A case closed more than 90 days before `todayYmd` is marked `older`.
 */
export function arClosedCases(all: ReadonlyArray<ArReturnCaseRow>, todayYmd: string): { lines: ArClosedCaseLine[]; others: number } {
  const closed = all.filter((r) => !!r.closed_at)
  const listed = closed.filter((r) => arCaseReopenProblem(r) === '').sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
  const lines = listed.map((r): ArClosedCaseLine => {
    const ymd = r.closed_at && Number.isFinite(Date.parse(r.closed_at)) ? calendarYmdInAppTzFromIso(r.closed_at) : ''
    const reason = REASON_WORDS[r.closed_reason ?? ''] ?? ''
    const note = (r.closed_note ?? '').trim()
    const age = ymd ? ymdDaysBetween(ymd, todayYmd) : null
    return {
      id: r.mercury_transaction_id,
      payer: (r.counterparty_name ?? '').trim() || 'No name on record',
      amount: amountOf(r.amount),
      closedWords: [`Closed${reason ? ` as ${reason}` : ''}${ymd ? ` on ${formatWorkDateYmdWeekdayShortFriendly(ymd)}` : ''}.`, note].filter(Boolean).join(' '),
      jobWords: arCaseJobs(r)
        .map((j) => (j.job_name ?? '').trim())
        .filter(Boolean)
        .join(', '),
      older: age != null && age > AR_CLOSED_CASES_RECENT_DAYS,
    }
  })
  return { lines, others: closed.length - listed.length }
}

/**
 * The lines the list draws now. The older ones stay folded until **Show older** is pressed. When every case is
 * an older one, all of them are drawn, since a fold with nothing above it would hide the whole list.
 */
export function arClosedCasesShown(lines: ReadonlyArray<ArClosedCaseLine>, showOlder: boolean): { shown: ArClosedCaseLine[]; folded: number } {
  const recent = lines.filter((l) => !l.older)
  if (showOlder || recent.length === 0) return { shown: [...lines], folded: 0 }
  return { shown: recent, folded: lines.length - recent.length }
}

/** The press that draws the folded ones, with its count. */
export function arClosedOlderLabel(folded: number): string {
  return folded === 1 ? 'Show 1 older case' : `Show ${folded} older cases`
}

/** The line under the list that says what it leaves out, and why. '' when it leaves nothing out. */
export function arClosedOthersWords(others: number): string {
  if (others <= 0) return ''
  return `${others === 1 ? '1 closed case is' : `${others} closed cases are`} not listed. A case closed by a new payment or by Stripe’s answer stays closed.`
}

/** The confirm window's words. The button names the act. */
export function arCaseReopenConfirm(line: Pick<ArClosedCaseLine, 'payer'>): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Reopen the case of ${line.payer}?`,
    message: 'The case goes back under Came back, for everyone who opens Accounts Receivable. It stands open there until someone closes it again. Its closing reason and note are cleared.',
    confirmLabel: 'Reopen the case',
  }
}

/** What the toast says once it is open again. */
export const AR_CASE_REOPENED = 'The case is open again. It is under Came back.'
