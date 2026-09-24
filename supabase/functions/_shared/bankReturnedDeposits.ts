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

export type MercuryBankReturn = { reason: string }

export const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** What the bank said — null unless the deposit posted, then failed. */
export function mercuryBankReturn(tx: {
  status: string | null | undefined
  posted_at: string | null | undefined
  amount: number | string | null | undefined
  failureReason?: string | null | undefined
}): MercuryBankReturn | null {
  if (asText(tx.status) !== 'failed') return null
  if (!tx.posted_at) return null
  if (!((Number(tx.amount) || 0) > 0)) return null
  return { reason: asText(tx.failureReason) }
}

export type BankReturnedJobRow = { id: string; hcp_number: string | null; job_name: string | null; customer_name?: string | null }

/** "J878 Take 5 – Seguin" */
export function jobLabelForBankReturn(j: BankReturnedJobRow | null | undefined): string {
  const n = asText(j?.hcp_number)
  const name = asText(j?.job_name) || asText(j?.customer_name)
  return [n ? `J${n}` : null, name].filter(Boolean).join(' ') || 'a job'
}

// ---- The notice (v2.3804) --------------------------------------------------------

export type BankReturnNoticeJob = {
  jobId: string
  /** "J878 Take 5 – Seguin" */
  jobLabel: string
  /** The recorded payment's amount on this job (a deposit can be split across jobs). */
  amount: number
}

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
}

const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** "$13,680" — cents only when there are any. */
const moneyShort = (n: number): string => (Math.round(Math.abs(n) * 100) % 100 === 0 ? `$${Math.round(Math.abs(n)).toLocaleString('en-US')}` : money(n))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(ymd: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${Number(m[3])}` : null
}

/** The one path the Dashboard's card also opens (v2.3795): Edit Job on ③ Payments received. */
export function bankReturnPaymentsPath(jobId: string): string {
  return `/jobs?tab=stages&edit=${encodeURIComponent(jobId)}&editFocus=payments`
}

function possessive(name: string): string {
  const n = name.trim()
  if (!n) return "A customer's"
  return /s$/i.test(n) ? `${n}'` : `${n}'s`
}

/** "Southern Post's check for $13,680 on J878 Take 5 – Seguin came back: Insufficient funds." */
export function bankReturnNoticeLine(input: Pick<BankReturnNoticeInput, 'counterparty' | 'amount' | 'reason' | 'jobs'>): string {
  const where =
    input.jobs.length === 1 && input.jobs[0]
      ? ` on ${input.jobs[0].jobLabel}`
      : input.jobs.length > 1
        ? ` across ${input.jobs.length} jobs`
        : ''
  const reason = asText(input.reason)
  return `${possessive(input.counterparty)} check for ${moneyShort(input.amount)}${where} came back${reason ? `: ${reason}` : ''}.`
}

export function bankReturnNoticeSubject(input: BankReturnNoticeInput): string {
  const reason = asText(input.reason)
  const first = input.jobs[0]
  const where = input.jobs.length === 1 && first ? first.jobLabel : input.jobs.length > 1 ? `${input.jobs.length} jobs` : 'a job'
  return `Check returned · ${moneyShort(input.amount)} · ${where}${reason ? ` · ${reason}` : ''}`
}

export function buildBankReturnNoticeEmail(input: BankReturnNoticeInput): { subject: string; text: string; html: string } {
  const origin = input.appOrigin.replace(/\/$/, '')
  const line = bankReturnNoticeLine(input)
  const posted = shortDate(input.postedYmd)
  const when = posted ? `The bank took it ${posted} and has now sent it back. ` : ''
  const still = `${when}The job still counts it as paid — on the Pipeline, in its balance and on any lien notice — until someone takes it off.`
  const step = 'Open the job → ③ Payments received → Unlink and remove.'
  const jobLines = input.jobs.map((j) => `${j.jobLabel} · ${money(j.amount)} · ${origin}${bankReturnPaymentsPath(j.jobId)}`)
  const text = [line, '', still, '', step, ...jobLines, '', 'Nothing is taken off on its own — the button is the record of who decided.'].join('\n')
  const html = [
    `<p style="font-size:16px;margin:0 0 12px"><strong>${escapeHtml(line)}</strong></p>`,
    `<p style="margin:0 0 12px">${escapeHtml(still)}</p>`,
    `<p style="margin:0 0 6px">${escapeHtml(step)}</p>`,
    '<ul style="margin:0 0 12px;padding-left:20px">',
    ...input.jobs.map(
      (j) =>
        `<li><a href="${escapeHtml(`${origin}${bankReturnPaymentsPath(j.jobId)}`)}">${escapeHtml(j.jobLabel)}</a> · ${escapeHtml(money(j.amount))}</li>`,
    ),
    '</ul>',
    '<p style="color:#666;font-size:13px;margin:0">Nothing is taken off on its own — the button is the record of who decided.</p>',
  ].join('\n')
  return { subject: bankReturnNoticeSubject(input), text, html }
}

export function buildBankReturnNoticePush(input: BankReturnNoticeInput, transactionId: string): { title: string; body: string; url: string; tag: string } {
  const reason = asText(input.reason)
  const first = input.jobs[0]
  const where = input.jobs.length === 1 && first ? first.jobLabel : input.jobs.length > 1 ? `${input.jobs.length} jobs` : 'a job'
  return {
    title: `Check returned · ${moneyShort(input.amount)}`,
    body: `${input.counterparty.trim() || 'A customer'} on ${where}${reason ? `: ${reason}` : ''}. Open the job → Unlink and remove.`,
    url: first ? bankReturnPaymentsPath(first.jobId) : '/jobs?tab=stages',
    tag: `bank-return-${transactionId}`,
  }
}
