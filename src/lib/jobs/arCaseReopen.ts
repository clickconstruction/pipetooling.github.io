/**
 * Reopening a closed case (punch list #443, row 5): the take-back of **Close it as settled** and **Close it as not
 * coming** on Accounts Receivable.
 *
 * A closed case leaves **Came back** and no screen listed it again, so a test case a walk closed stood closed for
 * good. Three functions that reopen one have been in the database with no caller (`reopen_ar_return_case`,
 * `reopen_ar_stripe_case`, `reopen_ar_unbanked_check_case`). This is the rule for the press that calls them. Pure:
 * the fresh read and the call are `arCaseReopenIo.ts`, the list and the press `components/jobs/ar/ArClosedTestCases.tsx`.
 *
 * - The list and the press are drawn for a dev and for nobody else.
 * - Only a case on a test job is listed and reopened: it names a job, and every job it names is a ZZ test job
 *   (`isZzTestJob`). A case that names no job cannot be told from a real one, so it stays closed.
 * - Only a case the office closed by hand reopens: *settled another way* or *not coming*. A case closed because a
 *   new check replaced it, or by Stripe's own answer, stays. The returned-check function would reopen any closed
 *   case and clear its replacement, so this rule is the one that holds it to the two reasons.
 *
 * The functions already let the office in. Drawing this for the office on any case is the owner's call, not made.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import type { ArReturnCaseRow } from './arReturnCase'

/** Who is offered the list of closed test cases: a dev. Every other role sees nothing new. */
export function arCaseReopenDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
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

/** True when the case names at least one job and every job it names is a ZZ test job. */
export function arCaseIsOnTestJobs(row: Pick<ArReturnCaseRow, 'live_payments' | 'last_job' | 'recorded_payment' | 'stripe_case'>): boolean {
  const jobs = arCaseJobs(row)
  return jobs.length > 0 && jobs.every((j) => isZzTestJob({ job_name: j.job_name }))
}

/** Why this case cannot be reopened; '' when it can. Null is a case that is no longer there. */
export function arCaseReopenProblem(row: ArCaseReopenRow | null | undefined): string {
  if (!row) return 'The case is not there any more. Read the page again.'
  if (!row.closed_at) return 'This case is open already.'
  const jobs = arCaseJobs(row)
  if (jobs.length === 0) return 'This case names no job, so it cannot be told from a real one. It stays closed.'
  if (!jobs.every((j) => isZzTestJob({ job_name: j.job_name }))) return 'Only a case on a test job can be reopened. This one names a real job.'
  if (!AR_CASE_REOPEN_REASONS.includes(row.closed_reason ?? '')) return 'Only a case closed as settled another way or as not coming can be reopened.'
  return ''
}

/** The function that reopens a case, and its one argument, by where the case lives. */
export function arCaseReopenCall(row: Pick<ArReturnCaseRow, 'mercury_transaction_id' | 'source'>): { fn: 'reopen_ar_return_case' | 'reopen_ar_stripe_case' | 'reopen_ar_unbanked_check_case'; args: Record<string, string> } {
  if (row.source === 'unbanked') return { fn: 'reopen_ar_unbanked_check_case', args: { p_case_id: row.mercury_transaction_id } }
  if (row.source === 'stripe_dispute' || row.source === 'stripe_debit') return { fn: 'reopen_ar_stripe_case', args: { p_case_id: row.mercury_transaction_id } }
  return { fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: row.mercury_transaction_id } }
}

/** One closed test case as the dev's list draws it. */
export interface ArClosedTestCaseLine {
  id: string
  /** Who the money was from; *No name on record* when the case holds none. */
  payer: string
  amount: number | null
  /** *Closed as not coming on Mon, Nov 23.*, with the note the office typed after it. */
  closedWords: string
  /** The jobs it names, by name. */
  jobWords: string
  /** Why it cannot be reopened; '' when it can. */
  problem: string
}

const REASON_WORDS: Readonly<Record<string, string>> = { settled_other_way: 'settled another way', not_coming: 'not coming', replaced: 'replaced by a new payment' }

const amountOf = (v: number | string | null | undefined): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * The closed cases on test jobs, newest closed first, for the dev's list, and how many closed cases were left out
 * because they are on a real job or name none. A test case closed for a reason a reopen does not undo is listed
 * with why it stays.
 */
export function arClosedTestCases(all: ReadonlyArray<ArReturnCaseRow>): { lines: ArClosedTestCaseLine[]; others: number } {
  const closed = all.filter((r) => !!r.closed_at)
  const test = closed.filter(arCaseIsOnTestJobs).sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
  const lines = test.map((r): ArClosedTestCaseLine => {
    const ymd = r.closed_at && Number.isFinite(Date.parse(r.closed_at)) ? calendarYmdInAppTzFromIso(r.closed_at) : ''
    const reason = REASON_WORDS[r.closed_reason ?? ''] ?? ''
    const note = (r.closed_note ?? '').trim()
    return {
      id: r.mercury_transaction_id,
      payer: (r.counterparty_name ?? '').trim() || 'No name on record',
      amount: amountOf(r.amount),
      closedWords: [`Closed${reason ? ` as ${reason}` : ''}${ymd ? ` on ${formatWorkDateYmdWeekdayShortFriendly(ymd)}` : ''}.`, note].filter(Boolean).join(' '),
      jobWords: arCaseJobs(r)
        .map((j) => (j.job_name ?? '').trim())
        .filter(Boolean)
        .join(', '),
      problem: arCaseReopenProblem(r),
    }
  })
  return { lines, others: closed.length - test.length }
}

/** The line under the list that says what it leaves out, and why. '' when it leaves nothing out. */
export function arClosedOthersWords(others: number): string {
  if (others <= 0) return ''
  return `${others === 1 ? '1 closed case is' : `${others} closed cases are`} not listed. Only a case on a test job can be reopened here.`
}

/** The confirm window's words. The button names the act. */
export function arCaseReopenConfirm(line: Pick<ArClosedTestCaseLine, 'payer'>): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Reopen the case of ${line.payer}?`,
    message: 'The case goes back under Came back, for everyone who opens Accounts Receivable. Its closing reason and note are cleared.',
    confirmLabel: 'Reopen the case',
  }
}

/** What the toast says once it is open again. */
export const AR_CASE_REOPENED = 'The case is open again. It is under Came back.'
