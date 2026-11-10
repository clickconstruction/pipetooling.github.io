/**
 * One place for work paid in kind (punch list #301, v2.6827): the reading of a deal.
 *
 * A deal (`in_kind_arrangements`) pays some of a customer's jobs with something other than money. What was given is
 * a ledger of lines (`in_kind_lines`): an amount, a date and a memo, counted as overhead unless the line is put on a
 * job. A deal with a monthly amount also has months, and each month is settled by one line (an amount of zero is "no
 * credit this month"). This file is the arithmetic and the words; the database functions do the writing
 * (`in_kind_line_add`, `in_kind_line_remove`, `in_kind_line_set_cost`, `in_kind_arrangement_set_jobs`).
 *
 * Money is truth from the bills: what a deal has paid is the In kind payments on its jobs, and what is left is those
 * jobs' open balances. A payment typed by hand before the deal was recorded counts the same as one a line wrote.
 */

const CENT = 0.005

export interface InKindArrangement {
  id: string
  customer_id: string | null
  partner_name: string
  what_given: string
  note: string
  /** The usual credit a month; null is a deal that takes a line as things are given. */
  monthly_amount: number | null
  /** The whole monthly bill the credit comes off (the rent); null when the bank says nothing about it. */
  monthly_due: number | null
  bank_payee: string
  /** The first month the app expects a line for, as YYYY-MM-01. */
  starts_on: string | null
  ended_at: string | null
}

export interface InKindLine {
  id: string
  arrangement_id: string
  /** YYYY-MM-DD */
  given_on: string
  amount: number
  memo: string
  /** The job it counts on as material; null is overhead. */
  cost_job_id: string | null
  /** YYYY-MM-01 on a monthly deal's scheduled line. */
  for_month: string | null
  removed_at: string | null
}

/** A job a deal pays, as the ledger needs it. */
export interface InKindJob {
  id: string
  status: string | null
  revenue: number | null
  payments_made: number | null
}

/** An In kind payment on one of the deal's jobs. `line_id` is null for one typed by hand. */
export interface InKindPayment {
  id: string
  job_id: string
  invoice_id: string | null
  amount: number
  paid_on: string | null
  note: string | null
  line_id: string | null
}

export const money2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100

export function isMonthlyArrangement(a: Pick<InKindArrangement, 'monthly_amount' | 'starts_on'>): boolean {
  return a.monthly_amount != null && a.monthly_amount > 0 && Boolean(a.starts_on)
}

/** A job's bill that a deal pays reads as scheduled, never late. */
export function jobIsScheduledInKind(job: { in_kind_arrangement_id?: string | null } | null | undefined): boolean {
  return Boolean(job?.in_kind_arrangement_id)
}

export const liveLines = <T extends Pick<InKindLine, 'removed_at'>>(lines: readonly T[]): T[] => lines.filter((l) => !l.removed_at)

export interface InKindTotals {
  /** What the deal's jobs came to. */
  work: number
  jobCount: number
  /** In kind payments on those jobs, by a line or by hand. */
  paidInKind: number
  /** Still open on the bills of those jobs: the jobs that are billed. */
  left: number
  openJobCount: number
  /** What the deal's jobs that are not billed yet come to: work on no bill, so nothing a line can pay. */
  unbilled: number
  unbilledJobCount: number
  /** What the live lines say was given. */
  given: number
  /** Given, but on no bill yet: the partner is ahead of our work by this much. */
  ahead: number
  /** In kind payments on the deal's jobs that no line wrote (typed by hand before the ledger). */
  byHand: number
  byHandCount: number
  /** Live lines counted as overhead and on a job. */
  asOverhead: number
  onJobs: number
}

export function inKindTotals(jobs: readonly InKindJob[], lines: readonly InKindLine[], payments: readonly InKindPayment[]): InKindTotals {
  let work = 0
  let left = 0
  let openJobCount = 0
  let unbilled = 0
  let unbilledJobCount = 0
  for (const j of jobs) {
    const rev = Number(j.revenue ?? 0)
    work += rev
    const open = Math.max(0, rev - Number(j.payments_made ?? 0))
    if (open <= CENT || j.status === 'paid') continue
    // Only a billed job has a bill a line can pay. A job still working is counted apart, so nothing calls it a bill.
    if (j.status === 'billed') {
      left += open
      openJobCount += 1
    } else {
      unbilled += open
      unbilledJobCount += 1
    }
  }
  const live = liveLines(lines)
  const liveIds = new Set(live.map((l) => l.id))
  let paidInKind = 0
  let byLine = 0
  let byHand = 0
  let byHandCount = 0
  for (const p of payments) {
    const amt = Number(p.amount ?? 0)
    paidInKind += amt
    if (p.line_id && liveIds.has(p.line_id)) byLine += amt
    else {
      byHand += amt
      byHandCount += 1
    }
  }
  let given = 0
  let asOverhead = 0
  let onJobs = 0
  for (const l of live) {
    given += l.amount
    if (l.cost_job_id) onJobs += l.amount
    else asOverhead += l.amount
  }
  return {
    work: money2(work),
    jobCount: jobs.length,
    paidInKind: money2(paidInKind),
    left: money2(left),
    openJobCount,
    unbilled: money2(unbilled),
    unbilledJobCount,
    given: money2(given),
    ahead: money2(Math.max(0, given - byLine)),
    byHand: money2(byHand),
    byHandCount,
    asOverhead: money2(asOverhead),
    onJobs: money2(onJobs),
  }
}

/** How much of a line is on bills, and how much stands on none. */
export function lineStanding(line: InKindLine, payments: readonly InKindPayment[]): { onBills: number; onNoBill: number } {
  const onBills = money2(payments.filter((p) => p.line_id === line.id).reduce((s, p) => s + Number(p.amount ?? 0), 0))
  return { onBills, onNoBill: money2(Math.max(0, line.amount - onBills)) }
}

// ---------- months ----------

/** YYYY-MM-01 of a YYYY-MM-DD day. */
export const monthOf = (ymd: string): string => `${ymd.slice(0, 7)}-01`

export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${String(yy).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}-01`
}

/** The last day of a month, as YYYY-MM-DD. */
export function lastDayOfMonth(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month.slice(0, 8)}${String(d).padStart(2, '0')}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "November" for 2026-11-01. */
export const monthName = (month: string): string => MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month
/** "November 2026". */
export const monthYear = (month: string): string => `${monthName(month)} ${month.slice(0, 4)}`
/** "Nov 2026". */
export const monthYearShort = (month: string): string => `${monthName(month).slice(0, 3)} ${month.slice(0, 4)}`

export type InKindMonthState =
  /** A line with an amount settles it. */
  | 'entered'
  /** A line of zero settles it: the whole monthly bill was paid. */
  | 'no_credit'
  /** No line, and the month is over or its bill has left the bank. */
  | 'due'
  /** This month, with no line yet and nothing at the bank to go on. */
  | 'waiting'

export interface InKindMonth {
  /** YYYY-MM-01 */
  month: string
  state: InKindMonthState
  line: InKindLine | null
  /** What left the bank for this month, when the bank was read; null when it was not. */
  bankPaid: number | null
}

/**
 * The months of a monthly deal, from its first month through the current one, newest first. `bankPaidByMonth` is what
 * left the bank to the deal's payee each month (positive dollars); leave a month out when the bank was not read.
 */
export function inKindMonths(
  a: Pick<InKindArrangement, 'monthly_amount' | 'starts_on' | 'ended_at'>,
  lines: readonly InKindLine[],
  todayYmd: string,
  bankPaidByMonth?: ReadonlyMap<string, number>,
): InKindMonth[] {
  if (!isMonthlyArrangement(a) || !a.starts_on) return []
  const thisMonth = monthOf(todayYmd)
  const byMonth = new Map<string, InKindLine>()
  for (const l of liveLines(lines)) if (l.for_month) byMonth.set(l.for_month, l)
  const out: InKindMonth[] = []
  for (let m = a.starts_on, guard = 0; m <= thisMonth && guard < 600; m = addMonths(m, 1), guard += 1) {
    const line = byMonth.get(m) ?? null
    const bankPaid = bankPaidByMonth?.has(m) ? money2(bankPaidByMonth.get(m) ?? 0) : null
    let state: InKindMonthState
    if (line) state = line.amount > CENT ? 'entered' : 'no_credit'
    else if (a.ended_at) state = 'waiting'
    else if (m < thisMonth) state = 'due'
    else state = bankPaid != null && bankPaid > CENT ? 'due' : 'waiting'
    out.push({ month: m, state, line, bankPaid })
  }
  return out.reverse()
}

/** The months with no line that someone should enter, oldest first. */
export const dueMonths = (months: readonly InKindMonth[]): InKindMonth[] => months.filter((m) => m.state === 'due').reverse()

export interface InKindSuggestion {
  amount: number
  /** Why this amount, in the window's words. */
  why: 'bank_part' | 'bank_none' | 'bank_all' | 'usual'
}

/**
 * The credit to suggest for a month. With the whole monthly bill known and the bank read, it is that bill less what
 * left the bank: the usual credit when the rest was paid, all of it when nothing was, none when the whole bill was.
 * Otherwise the usual credit. Never more than is left to pay.
 */
export function suggestedCredit(
  a: Pick<InKindArrangement, 'monthly_amount' | 'monthly_due'>,
  bankPaid: number | null,
  left: number,
): InKindSuggestion {
  const usual = Number(a.monthly_amount ?? 0)
  const cap = (n: number) => money2(Math.max(0, Math.min(n, left)))
  if (a.monthly_due != null && a.monthly_due > 0 && bankPaid != null) {
    const paid = Math.max(0, bankPaid)
    if (paid <= CENT) return { amount: cap(a.monthly_due), why: 'bank_none' }
    if (paid >= a.monthly_due - CENT) return { amount: 0, why: 'bank_all' }
    return { amount: cap(a.monthly_due - paid), why: 'bank_part' }
  }
  return { amount: cap(usual), why: 'usual' }
}

/**
 * The month the last credit falls in, when every month from `fromMonth` on takes the usual credit. Null when nothing
 * is left or the deal has no monthly amount.
 */
export function lastCreditMonth(left: number, monthlyAmount: number | null, fromMonth: string): { month: string; months: number } | null {
  if (!monthlyAmount || monthlyAmount <= 0 || left <= CENT) return null
  const months = Math.ceil((left - CENT) / monthlyAmount)
  return { month: addMonths(fromMonth, months - 1), months }
}

// ---------- what the add verb answers ----------

export interface InKindPlacedBill {
  job_id: string
  invoice_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  amount: number
  left_after: number
  pays_off: boolean
}

export interface InKindHeldBill {
  job_id: string
  invoice_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  open: number
  why: 'stripe'
}

export interface InKindAddResult {
  ok: boolean
  error: string | null
  lineId: string | null
  applied: InKindPlacedBill[]
  held: InKindHeldBill[]
  /** What found no open bill. */
  unapplied: number
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? money2(n) : 0
}
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : [])

/** Reads `in_kind_line_add`'s answer (a dry run or a real one). */
export function parseInKindAddResult(raw: unknown): InKindAddResult {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const error = str(o.error)
  return {
    ok: o.ok === true && !error,
    error,
    lineId: str(o.line_id),
    applied: rows(o.applied).map((x) => ({
      job_id: String(x.job_id ?? ''),
      invoice_id: str(x.invoice_id),
      hcp_number: str(x.hcp_number),
      click_number: str(x.click_number),
      job_name: str(x.job_name),
      amount: num(x.amount),
      left_after: num(x.left_after),
      pays_off: x.pays_off === true,
    })),
    held: rows(o.held).map((x) => ({
      job_id: String(x.job_id ?? ''),
      invoice_id: str(x.invoice_id),
      hcp_number: str(x.hcp_number),
      click_number: str(x.click_number),
      job_name: str(x.job_name),
      open: num(x.open),
      why: 'stripe' as const,
    })),
    unapplied: num(o.unapplied),
  }
}

/** A bill on Stripe is told by its own window, so a line passes it over. The reason, for the list of what was held. */
export const IN_KIND_HELD_STRIPE = 'This bill is on Stripe. Record its payment from the bill itself, so Stripe is told.'

/** The memo the app writes for a month's line. */
export const monthMemo = (whatGiven: string, month: string): string => `${whatGiven.trim() || 'In kind'}, ${monthYear(month)}`
/** The memo for a month settled with no credit. */
export const noCreditMemo = (month: string): string => `No credit, ${monthYear(month)}. The whole bill was paid.`
