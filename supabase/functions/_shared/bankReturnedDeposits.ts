/**
 * Bank-returned deposits — the one rule and the office's notice (punch list #40).
 *
 * Mercury syncs a returned check as `status = 'failed'` with the bank's reason in
 * `raw.reasonForFailure`. A deposit is a bank return only when it POSTED and later
 * went failed, and was money in (prod, 2026-09-23: 6 of 17 failed check deposits;
 * the other 11 never posted — a processing failure, the check re-deposited — and 13
 * failed internal transfers are account shuffles). v2.3795 reads the rule on the
 * Dashboard and in Accounts Receivable; v2.3804 has `mercury-webhook` tell the
 * office the moment a returned deposit is still linked to a recorded payment.
 *
 * Pure: no Deno, no Supabase. `src/lib/jobs/bankReturnedDeposits.ts` re-exports the
 * rule; vitest covers this file from `src/lib/jobs/bankReturnNotice.test.ts`.
 */

import { todayYmdInAppTz } from './appTimeZone.ts'

export type MercuryBankReturn = { reason: string }

export const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * v2.4320: the bank's own return reasons. A check deposit can come back with no
 * posting date — Peter Garza's $2,700, Jul 2025, "Insufficient funds" — and the
 * posted-then-failed rule never saw it. Mercury's processing failure ("There was an
 * issue with this transaction") is not on the list: that check never reached the
 * bank and is usually deposited again (a "rejected" case, opened only when a
 * recorded payment matches it). The same phrases live in SQL
 * (`mercury_bank_return_reason`, 20261001230000) — bankReturnedDeposits.test.ts
 * reads the migration to keep the two lists equal.
 */
export const BANK_RETURN_REASON_PHRASES = [
  'insufficient funds',
  'not sufficient funds',
  'stop payment',
  'payment stopped',
  'refer to maker',
  'account closed',
  'closed account',
  'uncollected funds',
  'unable to locate',
  'frozen',
  'blocked account',
] as const

/** True when Mercury's failure words are a bank's return reason (case-insensitive). */
export function isBankReturnReason(reason: string | null | undefined): boolean {
  const r = asText(reason).toLowerCase()
  return r !== '' && BANK_RETURN_REASON_PHRASES.some((p) => r.includes(p))
}

/**
 * What the bank said — null unless the bank sent the deposit back: money in that
 * went `failed` after it posted, or a check deposit that failed with a bank's
 * return reason before it posted (v2.4320).
 */
export function mercuryBankReturn(tx: {
  status: string | null | undefined
  posted_at: string | null | undefined
  amount: number | string | null | undefined
  failureReason?: string | null | undefined
  /** Mercury's kind — only a `checkDeposit` counts without a posting date. */
  kind?: string | null | undefined
}): MercuryBankReturn | null {
  if (asText(tx.status) !== 'failed') return null
  if (!((Number(tx.amount) || 0) > 0)) return null
  if (tx.posted_at) return { reason: asText(tx.failureReason) }
  if (asText(tx.kind) === 'checkDeposit' && isBankReturnReason(tx.failureReason)) return { reason: asText(tx.failureReason) }
  return null
}

export type BankReturnedJobRow = { id: string; hcp_number: string | null; job_name: string | null; customer_name?: string | null }

/** "J878 Take 5 – Seguin" */
export function jobLabelForBankReturn(j: BankReturnedJobRow | null | undefined): string {
  const n = asText(j?.hcp_number)
  const name = asText(j?.job_name) || asText(j?.customer_name)
  return [n ? `J${n}` : null, name].filter(Boolean).join(' ') || 'a job'
}

// ---- The notice (v2.3804; one per case since v2.4320) -----------------------------

export type BankReturnNoticeJob = {
  jobId: string
  /** "J878 Take 5 – Seguin" */
  jobLabel: string
  /** The recorded payment's amount on this job (a deposit can be split across jobs). */
  amount: number
}

/**
 * Where the check sits when the office is told (v2.4320):
 *   on_jobs       a payment still carries it, so jobs count it as paid
 *   off_job       it was on a job and someone took it off before the bank sent it back
 *   never_on_job  nobody ever applied it
 *   rejected      Mercury could not take it in (it never posted) and a payment
 *                 recorded by hand matches it, so a job reads paid with no money
 */
export type ArReturnCaseSituation = 'on_jobs' | 'off_job' | 'never_on_job' | 'rejected'

export type BankReturnNoticeInput = {
  /** Who the deposit came from — Mercury's counterparty, or "A" when it has none. */
  counterparty: string
  /** The deposit's amount. */
  amount: number
  /** The bank's words — "Insufficient funds", "Stop payment", "" when Mercury gave none. */
  reason: string
  /** YYYY-MM-DD the deposit posted, when known. */
  postedYmd: string | null
  /** Biggest first; the push and the first link open the first one. */
  jobs: BankReturnNoticeJob[]
  /** https://clicktooling.com — no trailing slash. */
  appOrigin: string
  /** Default: on_jobs when `jobs` has any, else never_on_job. */
  situation?: ArReturnCaseSituation
  /** off_job: the job it was on last, and the day it came off. */
  lastJob?: { jobId: string; jobLabel: string; offYmd: string | null } | null
  /** rejected: the payment recorded by hand that matches it. */
  recorded?: { jobId: string; jobLabel: string; amount: number; paidYmd: string | null } | null
  /** rejected: the day Mercury refused it. */
  failedYmd?: string | null
}

const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** "$13,680" — cents only when there are any. */
const moneyShort = (n: number): string => (Math.round(Math.abs(n) * 100) % 100 === 0 ? `$${Math.round(Math.abs(n)).toLocaleString('en-US')}` : money(n))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${Number(m[3])}` : null
}

/** The one path the Dashboard's card also opens (v2.3795): Edit Job on ③ Payments received. */
export function bankReturnPaymentsPath(jobId: string): string {
  return `/jobs?tab=stages&edit=${encodeURIComponent(jobId)}&editFocus=payments`
}

/** Accounts Receivable, where a case off every job is worked. */
export const AR_RETURN_CASES_PATH = '/accounts-receivable'

function possessive(name: string): string {
  const n = name.trim()
  if (!n) return "A customer's"
  return /s$/i.test(n) ? `${n}'` : `${n}'s`
}

function situationOf(input: BankReturnNoticeInput): ArReturnCaseSituation {
  return input.situation ?? (input.jobs.length > 0 ? 'on_jobs' : 'never_on_job')
}

/** "J878" out of "J878 Take 5 – Seguin" — the short name a second sentence uses. */
function jobShort(label: string): string {
  const m = /^(J\S+)/.exec(label.trim())
  return m ? m[1]! : label.trim()
}

/** The headline: "The bank sent back Southern Post's $13,680 check." */
export function bankReturnNoticeLine(input: Pick<BankReturnNoticeInput, 'counterparty' | 'amount' | 'reason' | 'jobs' | 'situation' | 'failedYmd'>): string {
  const who = possessive(input.counterparty)
  if (input.situation === 'rejected') {
    const day = shortDate(input.failedYmd)
    return `Mercury could not take in ${who} ${moneyShort(input.amount)} check${day ? ` on ${day}` : ''}.`
  }
  return `The bank sent back ${who} ${moneyShort(input.amount)} check.`
}

/** The sentences under the headline, in order. Plain words: one idea each, no dashes. */
export function bankReturnNoticeSentences(input: BankReturnNoticeInput): string[] {
  const reason = asText(input.reason)
  const payer = input.counterparty.trim() || 'the customer'
  const out: string[] = []
  const situation = situationOf(input)
  if (situation === 'rejected') {
    out.push('It never posted.')
    const rec = input.recorded
    if (rec) {
      const paid = shortDate(rec.paidYmd)
      out.push(`${rec.jobLabel} still reads paid.`)
      out.push(`${moneyShort(rec.amount)} was recorded there${paid ? ` on ${paid}` : ''} with no deposit.`)
    }
    out.push('Find the check and deposit it again.')
    return out
  }
  if (reason) out.push(`The reason is ${reason}.`)
  const posted = shortDate(input.postedYmd)
  if (posted) out.push(`The bank took it ${posted}.`)
  if (situation === 'on_jobs') {
    const first = input.jobs[0]
    out.push(input.jobs.length === 1 && first ? `It is still counted as paid on ${first.jobLabel}.` : `It is still counted as paid on ${input.jobs.length} jobs.`)
    out.push(input.jobs.length === 1 ? 'Take it off the job. In Edit Job, press Unlink and remove on that payment.' : 'Take it off each job. In Edit Job, press Unlink and remove on each payment.')
  } else if (situation === 'off_job') {
    const last = input.lastJob
    if (last) {
      const off = shortDate(last.offYmd)
      out.push('It is on no job now.')
      out.push(`It was on ${last.jobLabel}${off ? ` until ${off}` : ''}.`)
      out.push(`${jobShort(last.jobLabel)} owes the money again. Ask ${payer} for a new check.`)
    } else {
      out.push(`It is on no job now. Ask ${payer} for a new check.`)
    }
  } else if (input.recorded) {
    const paid = shortDate(input.recorded.paidYmd)
    out.push('No deposit was ever linked to a job.')
    out.push(`${input.recorded.jobLabel} still reads paid.`)
    out.push(`${moneyShort(input.recorded.amount)} was recorded there${paid ? ` on ${paid}` : ''} with no deposit.`)
    out.push(`Ask ${payer} for a new check.`)
  } else {
    out.push('It was never on a job.')
    out.push(`Ask ${payer} for a new check, or close it in Accounts Receivable.`)
  }
  return out
}

export function bankReturnNoticeSubject(input: BankReturnNoticeInput): string {
  const who = input.counterparty.trim() || 'A customer'
  return situationOf(input) === 'rejected'
    ? `A check never reached the bank · ${who} · ${moneyShort(input.amount)}`
    : `A check came back · ${who} · ${moneyShort(input.amount)}`
}

/** Where the notice's button goes: the job's payments while a job still carries it, else Accounts Receivable. */
export function bankReturnNoticeLinks(input: BankReturnNoticeInput): Array<{ label: string; path: string }> {
  const situation = situationOf(input)
  if (situation === 'on_jobs') return input.jobs.map((j) => ({ label: `${j.jobLabel} · ${money(j.amount)}`, path: bankReturnPaymentsPath(j.jobId) }))
  if ((situation === 'rejected' || situation === 'never_on_job') && input.recorded) return [{ label: `Open ${input.recorded.jobLabel}`, path: bankReturnPaymentsPath(input.recorded.jobId) }]
  return [{ label: 'Open it in Accounts Receivable', path: AR_RETURN_CASES_PATH }]
}

const NOTICE_FOOT = 'Nothing comes off a job on its own. A person presses the button, and that is the record.'

export function buildBankReturnNoticeEmail(input: BankReturnNoticeInput): { subject: string; text: string; html: string } {
  const origin = input.appOrigin.replace(/\/$/, '')
  const line = bankReturnNoticeLine({ ...input, situation: situationOf(input) })
  const sentences = bankReturnNoticeSentences(input)
  const links = bankReturnNoticeLinks(input)
  const text = [line, '', ...sentences, '', ...links.map((l) => `${l.label} · ${origin}${l.path}`), '', NOTICE_FOOT].join('\n')
  const html = [
    `<p style="font-size:16px;margin:0 0 12px"><strong>${escapeHtml(line)}</strong></p>`,
    ...sentences.map((t) => `<p style="margin:0 0 8px">${escapeHtml(t)}</p>`),
    '<ul style="margin:8px 0 12px;padding-left:20px">',
    ...links.map((l) => `<li><a href="${escapeHtml(`${origin}${l.path}`)}">${escapeHtml(l.label)}</a></li>`),
    '</ul>',
    `<p style="color:#666;font-size:13px;margin:0">${escapeHtml(NOTICE_FOOT)}</p>`,
  ].join('\n')
  return { subject: bankReturnNoticeSubject(input), text, html }
}

export function buildBankReturnNoticePush(input: BankReturnNoticeInput, transactionId: string): { title: string; body: string; url: string; tag: string } {
  const reason = asText(input.reason)
  const who = input.counterparty.trim() || 'A customer'
  const situation = situationOf(input)
  const first = input.jobs[0]
  let body: string
  if (situation === 'rejected') body = input.recorded ? `${who}. ${input.recorded.jobLabel} still reads paid.` : `${who}. It never posted.`
  else if (situation === 'on_jobs') body = `${who}${reason ? ` · ${reason}` : ''}. Still counted as paid on ${input.jobs.length === 1 && first ? first.jobLabel : `${input.jobs.length} jobs`}.`
  else if (situation === 'off_job') body = `${who}${reason ? ` · ${reason}` : ''}. It is on no job now.`
  else body = `${who}${reason ? ` · ${reason}` : ''}. It was never on a job.`
  const links = bankReturnNoticeLinks(input)
  return {
    title: `${situation === 'rejected' ? 'A check never reached the bank' : 'A check came back'} · ${moneyShort(input.amount)}`,
    body,
    url: links[0]?.path ?? AR_RETURN_CASES_PATH,
    tag: `bank-return-${transactionId}`,
  }
}

// ---- A case, as list_ar_return_cases returns it (v2.4320) ---------------------------

export type ArReturnCaseJobRef = {
  job_id: string
  job_number: string | null
  job_name: string | null
  job_revenue?: number | string | null
  job_payments_made?: number | string | null
}

export type ArReturnCaseRow = {
  mercury_transaction_id: string
  counterparty_name: string | null
  amount: number | string | null
  kind: string | null
  posted_at: string | null
  failed_at: string | null
  bank_reason: string | null
  /** bank · hand · rejected */
  source: string | null
  opened_at: string | null
  closed_at: string | null
  closed_reason: string | null
  closed_note: string | null
  closed_by: string | null
  replaced_by_mercury_transaction_id: string | null
  notified_at: string | null
  live_payments: Array<
    ArReturnCaseJobRef & {
      payment_id: string
      amount: number | string | null
      invoice_id: string | null
      invoice_sequence_order?: number | null
      invoice_status?: string | null
      invoice_amount?: number | string | null
      stripe_bill?: boolean | null
      stripe_credit_note?: boolean | null
      job_status?: string | null
    }
  > | null
  last_job: (ArReturnCaseJobRef & { removed_at: string | null; removed_by: string | null }) | null
  recorded_payment: (ArReturnCaseJobRef & { payment_id: string; amount: number | string | null; paid_on: string | null }) | null
  /** The newest They said… on a job it touched, made after it came back. */
  promise?: { job_id: string; promised_date: string | null; said_by: string | null; created_at: string | null } | null
}

/** The company-calendar day of an ISO time — Sep 30 9:19 PM CT is Sep 30, not Oct 1. */
export function appCalendarYmd(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return todayYmdInAppTz(d)
}

export function arReturnCaseJobLabel(j: ArReturnCaseJobRef): string {
  return jobLabelForBankReturn({ id: j.job_id, hcp_number: j.job_number, job_name: j.job_name })
}

/** Where the check sits now: on a job, off its last job, on none, or never reached the bank. */
export function arReturnCaseSituation(row: Pick<ArReturnCaseRow, 'source' | 'live_payments' | 'last_job'>): ArReturnCaseSituation {
  if (asText(row.source) === 'rejected') return 'rejected'
  if ((row.live_payments ?? []).length > 0) return 'on_jobs'
  if (row.last_job) return 'off_job'
  return 'never_on_job'
}

/** One case → the notice's input: the jobs it is on, biggest first; the job it left; the payment it matches. */
export function noticeInputFromCase(row: ArReturnCaseRow, appOrigin: string): BankReturnNoticeInput {
  const byJob = new Map<string, BankReturnNoticeJob>()
  for (const p of row.live_payments ?? []) {
    const prev = byJob.get(p.job_id)
    const amt = Math.abs(Number(p.amount) || 0)
    if (prev) prev.amount += amt
    else byJob.set(p.job_id, { jobId: p.job_id, jobLabel: arReturnCaseJobLabel(p), amount: amt })
  }
  const jobs = [...byJob.values()].sort((a, b) => b.amount - a.amount || a.jobLabel.localeCompare(b.jobLabel))
  const rec = row.recorded_payment
  return {
    counterparty: (row.counterparty_name ?? '').trim(),
    amount: Math.abs(Number(row.amount) || 0),
    reason: asText(row.bank_reason),
    postedYmd: appCalendarYmd(row.posted_at),
    jobs,
    appOrigin,
    situation: arReturnCaseSituation(row),
    lastJob: row.last_job ? { jobId: row.last_job.job_id, jobLabel: arReturnCaseJobLabel(row.last_job), offYmd: appCalendarYmd(row.last_job.removed_at) } : null,
    recorded: rec ? { jobId: rec.job_id, jobLabel: arReturnCaseJobLabel(rec), amount: Math.abs(Number(rec.amount) || 0), paidYmd: rec.paid_on ? String(rec.paid_on).slice(0, 10) : null } : null,
    failedYmd: appCalendarYmd(row.failed_at),
  }
}
