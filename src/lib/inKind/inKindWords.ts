/**
 * One place for work paid in kind (punch list #301): the words on its screens.
 *
 * Every sentence a person reads on the card, the ledger and the windows is made here, so a test can hold them to the
 * plain words (`src/lib/plainWords.ts`): one idea a sentence, the control's exact name, no glue.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import {
  isMonthlyArrangement,
  money2,
  monthName,
  monthYear,
  type InKindAddResult,
  type InKindArrangement,
  type InKindHeldBill,
  type InKindMonthState,
  type InKindSuggestion,
  type InKindPlacedBill,
  type InKindTotals,
} from './inKindLedger'
import type { InKindLedgerJob } from './inKindIo'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
/** $1,500.00 */
export const usd = (n: number): string => USD.format(money2(n))

export const IN_KIND_CARD_TITLE = 'Pays in kind'
export const IN_KIND_OPEN_LEDGER = 'Open the ledger'
export const IN_KIND_ADD_LINE = 'Add a line'
export const IN_KIND_CHANGE_TERMS = 'Change the terms'
export const IN_KIND_SET_UP = 'Set up paying in kind'
export const IN_KIND_AMOUNT_LABEL = 'Amount'
export const IN_KIND_DATE_LABEL = 'Date'
export const IN_KIND_MEMO_LABEL = 'What was given instead of money'
export const IN_KIND_MEMO_PLACEHOLDER = 'e.g. 6 yards of concrete, the yard pad behind the shop'
export const IN_KIND_COUNTS_LABEL = 'Counts as'
export const IN_KIND_OVERHEAD = 'Overhead'
export const IN_KIND_OVERHEAD_WHY = 'A cost of the company, on no job.'
export const IN_KIND_A_JOB = 'A job'
export const IN_KIND_A_JOB_WHY = 'Pick the job. It counts as that job’s material.'
export const IN_KIND_WINDOW_NOTE = 'In kind pays the bills down. It is never counted as money in the bank.'

type JobNameLike = { hcp_number?: string | null; click_number?: string | null; job_name?: string | null }

/** The job's number as the app shows it, else its name. */
export function jobLabel(j: JobNameLike): string {
  return effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || 'A job'
}

/** "1101 Shop restroom rough-in" for a list row. */
export function jobLine(j: JobNameLike): string {
  const n = effectiveJobLedgerNumber(j.hcp_number, j.click_number)
  const name = (j.job_name ?? '').trim()
  return [n, name].filter(Boolean).join(' ') || 'A job'
}

const trimEnd = (s: string): string => s.trim().replace(/[.\s]+$/, '')

/** The deal in a sentence or two, for the card and the top of the ledger. */
export function termsSentence(a: Pick<InKindArrangement, 'what_given' | 'monthly_amount' | 'monthly_due' | 'starts_on'>): string {
  const what = trimEnd(a.what_given) || 'In kind'
  if (!isMonthlyArrangement(a) || !a.starts_on || a.monthly_amount == null) return `${what}. A line is added when something is given.`
  const base = `${what}. ${usd(a.monthly_amount)} a month since ${monthYear(a.starts_on)}.`
  if (a.monthly_due != null && a.monthly_due > a.monthly_amount) return `${base} A month with nothing paid credits ${usd(a.monthly_due)}.`
  return base
}

/** The line under a deal's name: what kind of deal it is. */
export function kindWords(a: Pick<InKindArrangement, 'monthly_amount' | 'starts_on' | 'ended_at'>): string {
  if (a.ended_at) return 'Ended'
  return isMonthlyArrangement(a) ? 'Every month' : 'As it comes'
}

/** "12 jobs" / "1 job" */
export const jobsWord = (n: number): string => `${n} ${n === 1 ? 'job' : 'jobs'}`
export const billsWord = (n: number): string => `${n} ${n === 1 ? 'bill' : 'bills'}`
export const linesWord = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`

/** Under "Still to come": nothing chased, or nothing left. */
export function leftWords(t: Pick<InKindTotals, 'left' | 'openJobCount'>): string {
  if (t.left <= 0.005) return 'Nothing is left on its bills.'
  return `On ${billsWord(t.openJobCount)}. Scheduled in kind, not late.`
}

/** The deal's jobs that are not billed yet: work a line cannot pay until it is on a bill. */
export function unbilledWords(t: Pick<InKindTotals, 'unbilled' | 'unbilledJobCount'>): string | null {
  if (t.unbilled <= 0.005) return null
  return `${usd(t.unbilled)} more is on ${jobsWord(t.unbilledJobCount)} not billed yet.`
}

/** What the partner gave ahead of our work, when a line stands on no bill. */
export function aheadWords(ahead: number): string | null {
  if (ahead <= 0.005) return null
  return `${usd(ahead)} was given ahead of our work. It is on no bill yet.`
}

/** The payments on the deal's jobs that no line wrote. */
export function byHandWords(t: Pick<InKindTotals, 'byHand' | 'byHandCount'>): string | null {
  if (t.byHandCount === 0) return null
  const n = t.byHandCount
  return `${n} In kind ${n === 1 ? 'payment was' : 'payments were'} typed on the bills by hand, ${usd(t.byHand)} in all. ${n === 1 ? 'It counts' : 'They count'} as paid.`
}

/** Under a bill in "Where it goes". */
export function placedWords(p: Pick<InKindPlacedBill, 'pays_off' | 'left_after'>): string {
  return p.pays_off ? 'Pays this bill off.' : `${usd(p.left_after)} is left on it after.`
}

/** A bill the line passed over because it is on Stripe. */
export function heldWords(h: InKindHeldBill): string {
  return `${jobLabel(h)} is on Stripe, so this line passes it over. Record its payment from the bill itself.`
}

/** What found no open bill. */
export function unappliedWords(unapplied: number, applied: number): string | null {
  if (unapplied <= 0.005) return null
  if (applied <= 0.005) return `No bill of this arrangement is open. The ${usd(unapplied)} stays on the line as given ahead of our work.`
  return `${usd(unapplied)} finds no open bill. It stays on the line as given ahead of our work.`
}

/** The press that saves a line. It says what it does and the amount. */
export const addLinePress = (amount: number): string => (amount > 0.005 ? `Add the line for ${usd(amount)}` : 'Add the line')

/** The toast after a line is saved. */
export function addedWords(r: InKindAddResult, amount: number): string {
  const paidOff = r.applied.filter((a) => a.pays_off)
  const head = `The line for ${usd(amount)} is added.`
  if (paidOff.length === 1) return `${head} ${jobLabel(paidOff[0]!)} is Paid.`
  if (paidOff.length > 1) return `${head} ${paidOff.length} bills are Paid.`
  if (r.applied.length === 0) return `${head} It is on no bill yet.`
  return head
}

/** The confirm window before a line is taken back. */
export function takeBackWords(amount: number, payments: number): { title: string; body: string; confirmLabel: string } {
  return {
    title: 'Take this line back?',
    body:
      payments > 0
        ? `Its ${payments === 1 ? 'payment leaves its bill' : `${payments} payments leave their bills`}, and ${payments === 1 ? 'that bill reads' : 'those bills read'} as open again. The line stays in the ledger, crossed out.`
        : 'It is on no bill. The line stays in the ledger, crossed out.',
    confirmLabel: `Take back ${usd(amount)}`,
  }
}

/** What a line counts as, for its chip. */
export function countsAsWords(costJob: JobNameLike | null | undefined, hasCostJob: boolean): string {
  if (!hasCostJob) return IN_KIND_OVERHEAD
  return costJob ? jobLine(costJob) : 'A job'
}

/** "1,596.00" or "885" as dollars; NaN when it is not a number. */
export function parseAmount(raw: string): number {
  const t = raw.replace(/[$,\s]/g, '')
  if (!t || !/^\d*\.?\d{0,2}$/.test(t)) return Number.NaN
  return Number(t)
}

/** "Nov 4, 2026" from a YYYY-MM-DD day. */
export function dayWords(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** What a job reads as in the list of jobs a deal could pay. */
export function candidateJobWords(j: Pick<InKindLedgerJob, 'status' | 'revenue' | 'payments_made' | 'in_kind_arrangement_id'>, thisArrangementId: string | null): { words: string; locked: boolean } {
  if (j.in_kind_arrangement_id && j.in_kind_arrangement_id !== thisArrangementId) return { words: 'Paid by another arrangement.', locked: true }
  const open = Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
  if (j.status === 'paid') return { words: 'Paid.', locked: false }
  if (j.status === 'billed') return { words: open > 0.005 ? `${usd(open)} open.` : 'Billed, nothing open.', locked: false }
  return { words: 'Not billed yet.', locked: false }
}

/** Under a line in the ledger: the bills it went to, or why it is on none. */
export function lineWentWords(amount: number, went: ReadonlyArray<{ label: string; amount: number }>, onNoBill: number): string {
  if (went.length === 0) return amount > 0.005 ? 'It is on no bill yet.' : 'The whole bill was paid, so this month has no credit.'
  const head = `Went to ${went.map((w) => `${w.label} ${usd(w.amount)}`).join(', ')}.`
  return onNoBill > 0.005 ? `${head} ${usd(onNoBill)} of it is on no bill.` : head
}

// ---------- a monthly deal's months (PR 3) ----------

/** "Nov 3" from a YYYY-MM-DD day. */
export function dayShort(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** What the bank said about a month, in a sentence. `bankPaid` is null when the bank was not read. */
export function bankSaysWords(bankPaid: number | null, lastBankDay: string | null): string | null {
  if (bankPaid == null) return null
  if (bankPaid <= 0.005) return 'Nothing left the bank that month.'
  return lastBankDay ? `${usd(bankPaid)} left the bank on ${dayShort(lastBankDay)}.` : `${usd(bankPaid)} left the bank that month.`
}

/** The amber line on the card and the ledger for months with no line. */
export function dueStripWords(dueMonthsOldestFirst: readonly string[], bankPaid: number | null, lastBankDay: string | null): string {
  const first = dueMonthsOldestFirst[0]
  if (!first) return ''
  const n = dueMonthsOldestFirst.length
  const head = n === 1 ? `${monthName(first)}’s credit is not entered.` : `${n} months of credit are not entered. ${monthName(first)} is the oldest.`
  const bank = bankSaysWords(bankPaid, lastBankDay)
  return bank ? `${head} ${bank}` : head
}

/** The press that opens a month. */
export const monthOpenPress = (month: string): string => `Enter ${monthName(month)}’s credit`

/** The quiet press on a month that is not due yet. */
export const monthEarlyPress = 'Enter it early'

/** The strip in the window of a month entered before it is over. */
export const monthEarlyWords = (month: string): string =>
  `${monthName(month)} is not over. Enter it now if the amount is settled. If it changes, take the line back and enter it again.`

/** The press that saves a month. It names the month and the amount, or says the month has none. */
export const monthSavePress = (month: string, amount: number): string => (amount > 0.005 ? `Record ${monthName(month)}’s credit of ${usd(amount)}` : `Settle ${monthName(month)} with no credit`)

/** Why the suggested amount is what it is. */
export function suggestionWhyWords(why: InKindSuggestion['why'], bankPaid: number | null, monthlyDue: number | null): string {
  if (why === 'bank_part' && bankPaid != null && monthlyDue != null) return `We paid ${usd(bankPaid)} of the ${usd(monthlyDue)} bill.`
  if (why === 'bank_none') return 'We paid nothing that month.'
  if (why === 'bank_all') return 'We paid the whole bill.'
  return 'The usual credit.'
}

/** The toast after a month is saved. */
export function monthSavedWords(month: string, amount: number, r: InKindAddResult): string {
  if (amount <= 0.005) return `${monthName(month)} is settled with no credit.`
  const paidOff = r.applied.filter((a) => a.pays_off)
  const head = `${monthName(month)}’s credit of ${usd(amount)} is recorded.`
  if (paidOff.length === 1) return `${head} ${jobLabel(paidOff[0]!)} is Paid.`
  if (paidOff.length > 1) return `${head} ${paidOff.length} bills are Paid.`
  return head
}

/** A month's row in the ledger, by its state. */
export function monthStateWords(state: InKindMonthState, amount: number): string {
  if (state === 'entered') return usd(amount)
  if (state === 'no_credit') return 'No credit, the whole bill was paid.'
  if (state === 'due') return 'Not entered.'
  return 'Not due yet.'
}

/** The Needs you line for months with no credit entered. */
export function needsYouInKindWords(due: ReadonlyArray<{ partner: string; month: string }>): { title: string; detail: string } {
  const n = due.length
  const first = due[0]
  if (!first) return { title: '', detail: '' }
  const partners = [...new Set(due.map((d) => d.partner))]
  if (n === 1) return { title: `${monthName(first.month)}’s in kind credit is not entered`, detail: first.partner }
  return {
    title: `${n} months of in kind credit are not entered`,
    detail: partners.length === 1 ? `${first.partner}, from ${monthName(first.month)}` : `${partners.length} customers, the oldest is ${first.partner}`,
  }
}
