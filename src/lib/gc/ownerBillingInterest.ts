/**
 * GC mode, the real build, Owner Billing's O2a: interest on the customer's late bills, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingInterest.ts`). O6b-1 made decision 7 the rule: interest runs from the
 * day after a bill falls due by the contract, and a promise never moves it.
 */
import { addDays } from './building'
import { appCertified, ownerPayAppsSent } from './ownerBilling'
import type { GcProject, GcState, OwnerPayAppSent } from './types'
import { money, shortDate } from './words'

/** The rate the office starts from, a month (the owner's call 3: off on a job until it is typed). Ours to change to what the contract says. */
export const OWNER_INTEREST_DEFAULT_PCT = 1.5

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/**
 * The day a bill falls due by the contract (decision 7, O6b-1): its certificate's day, or the day it went, plus the
 * contract's days to pay. Interest runs from the day after. A promise never moves it, and the customer's usual days
 * (the day we expect the money) never start it. Null: the contract's days to pay are not typed, so no interest yet.
 */
export function ownerInterestFrom(_state: GcState, project: GcProject, app: OwnerPayAppSent): string | null {
  return project.ownerPayDays == null ? null : addDays(app.certifiedOn ?? app.sentOn, project.ownerPayDays)
}

/** The job's interest in Bill the customer's terms (O6b-1): the rate and when it runs, or none. */
export function ownerInterestWords(pctPerMonth: number | null | undefined, payDays: number | null | undefined): string {
  if (pctPerMonth == null) return 'No interest on late bills.'
  return payDays == null
    ? `${pctPerMonth}% a month on a late bill, once the contract's days to pay are typed.`
    : `${pctPerMonth}% a month on a late bill, from the day after it falls due by the contract.`
}

export interface OwnerInterestOnBill {
  app: OwnerPayAppSent
  /** Late from the day after this. */
  from: string
  /** Days it has been late: to today, or to the day it was paid. */
  days: number
  amount: number
}

/**
 * Interest on one bill at `pctPerMonth`: each day after it was due, on what the architect certified
 * less what the owner had paid by then. A month is a twelfth of a year. Nothing while it waits on
 * the architect: the owner pays what is certified.
 */
export function ownerInterestOnBill(state: GcState, project: GcProject, app: OwnerPayAppSent, pctPerMonth: number): OwnerInterestOnBill | null {
  const certified = appCertified(app)
  const from = ownerInterestFrom(state, project, app)
  if (certified === null || from === null || pctPerMonth <= 0) return null
  const end = app.paidOn ?? state.today
  if (end <= from) return null
  const perDay = ((pctPerMonth / 100) * 12) / 365
  const payments = app.payments ?? (app.paidOn ? [{ on: app.paidOn, amount: app.paidAmount ?? certified }] : [])
  let open = certified - payments.filter((p) => p.on <= from).reduce((t, p) => t + p.amount, 0)
  let at = from
  let amount = 0
  for (const p of [...payments].filter((x) => x.on > from && x.on <= end).sort((a, b) => a.on.localeCompare(b.on))) {
    amount += Math.max(0, open) * perDay * (dayNumber(p.on) - dayNumber(at))
    open -= p.amount
    at = p.on
  }
  amount += Math.max(0, open) * perDay * (dayNumber(end) - dayNumber(at))
  return amount > 0.005 ? { app, from, days: dayNumber(end) - dayNumber(from), amount } : null
}

export interface OwnerInterest {
  /** A month, as a percent. Null: we do not charge interest on this job. */
  pctPerMonth: number | null
  /** Each bill with interest on it. */
  bills: OwnerInterestOnBill[]
  /** All the interest built up so far. */
  builtUp: number
  /** What went on interest bills. */
  billed: number
  /** What the owner paid on them. */
  paid: number
  /** Built up and not on an interest bill yet. */
  toBill: number
  /** Billed and not paid. */
  owed: number
}

/** The interest on a job's late bills, and where it stands. */
export function ownerInterest(state: GcState, project: GcProject): OwnerInterest {
  const pct = project.ownerLateInterest?.pctPerMonth ?? null
  const bills = pct === null ? [] : ownerPayAppsSent(project).flatMap((app) => ownerInterestOnBill(state, project, app, pct) ?? [])
  const sentBills = project.ownerBilling?.interestBills ?? []
  const builtUp = bills.reduce((t, b) => t + b.amount, 0)
  const billed = sentBills.reduce((t, b) => t + b.amount, 0)
  const paid = sentBills.filter((b) => b.paidOn !== null).reduce((t, b) => t + b.amount, 0)
  return { pctPerMonth: pct, bills, builtUp, billed, paid, toBill: Math.max(0, builtUp - billed), owed: billed - paid }
}

/** A month of interest, in days: a twelfth of a year, the rate `ownerInterestOnBill` runs at. The rows say 30.4. */
export const INTEREST_MONTH_DAYS = 365 / 12

/**
 * One late bill as the interest bill's rows read it (punch list #217, outside-5): the bill, the day it fell due, the
 * day it was paid or open, the days late, what was open, a month's interest on that, and the interest it came to.
 * The arithmetic is the kernel's own, so a customer can redo each row: monthly × days ÷ 30.4.
 */
export interface InterestRow {
  number: number
  /** "Pay application 2", "The final pay application". */
  bill: string
  /** The day it fell due by the contract. Interest ran from the day after. */
  dueOn: string
  /** The day they paid it. Null while it is open. */
  paidOn: string | null
  /** Days late: to the day it was paid, or to today. */
  days: number
  /** What was open when it fell due. */
  open: number
  /** A month's interest on that: open × the rate. */
  monthly: number
  amount: number
  /** True when nothing was paid while it ran, so the amount is monthly × days ÷ 30.4 and the row shows that sum. */
  straight: boolean
}

function billName(app: { number: number; final?: boolean }): string {
  return app.final ? 'The final pay application' : `Pay application ${app.number}`
}

/** The row for one bill's interest, from the kernel's reading of it. */
export function interestRowOf(bill: OwnerInterestOnBill, pctPerMonth: number): InterestRow {
  const { app, from } = bill
  const certified = appCertified(app) ?? 0
  const end = app.paidOn ?? addDays(from, bill.days)
  const payments = app.payments ?? (app.paidOn ? [{ on: app.paidOn, amount: app.paidAmount ?? certified }] : [])
  const open = Math.max(0, certified - payments.filter((p) => p.on <= from).reduce((t, p) => t + p.amount, 0))
  const straight = !payments.some((p) => p.on > from && p.on <= end && p.on !== app.paidOn)
  return { number: app.number, bill: billName(app), dueOn: from, paidOn: app.paidOn, days: bill.days, open, monthly: (open * pctPerMonth) / 100, amount: bill.amount, straight }
}

/** The rows of a job's interest, oldest bill first: every late bill with interest on it. Empty when the job charges none. */
export function interestRows(state: GcState, project: GcProject): InterestRow[] {
  const interest = ownerInterest(state, project)
  return interest.pctPerMonth === null ? [] : interest.bills.map((b) => interestRowOf(b, interest.pctPerMonth as number))
}

/**
 * A row with nothing paid while it ran, from its facts alone: `open` from the day after `dueOn` to the day it was paid
 * or to today, at `pctPerMonth`. The samples write their made-up bills with it, so their rows foot as a real one's.
 */
export function straightInterestRow(input: { number: number; final?: boolean; dueOn: string; paidOn: string | null; open: number; pctPerMonth: number; today: string }): InterestRow {
  const end = input.paidOn ?? input.today
  const days = Math.max(0, dayNumber(end) - dayNumber(input.dueOn))
  const monthly = (input.open * input.pctPerMonth) / 100
  return { number: input.number, bill: billName(input), dueOn: input.dueOn, paidOn: input.paidOn, days, open: input.open, monthly, amount: (monthly * days) / INTEREST_MONTH_DAYS, straight: true }
}

/** The rows' interest added up. */
export function interestRowsTotal(rows: readonly InterestRow[]): number {
  return rows.reduce((t, r) => t + r.amount, 0)
}

/** The head of the rows' table, on the email and the reminder alike. */
export const INTEREST_TABLE_HEAD: readonly string[] = ['Bill', 'Due', 'Paid', 'Days late', 'Open', 'Interest']

/**
 * One row's cells under that head. The interest cell shows the sum a customer can redo (a month's interest × the days
 * ÷ 30.4) when nothing was paid while it ran, else the figure alone, and `interestRowNotes` says why.
 */
export function interestRowCells(row: InterestRow): string[] {
  const sum = row.straight ? `${money(row.monthly)} × ${row.days}⁄30.4 = ${money(row.amount)}` : money(row.amount)
  return [row.bill, shortDate(row.dueOn), row.paidOn ? shortDate(row.paidOn) : 'open', String(row.days), money(row.open), sum]
}

/** The sum row under the rows: the interest to today. */
export function interestSumCells(rows: readonly InterestRow[]): string[] {
  return ['Interest to today', '', '', '', '', money(interestRowsTotal(rows))]
}

/** A line for each bill paid in parts, whose interest ran on what stayed open each day. */
export function interestRowNotes(rows: readonly InterestRow[]): string[] {
  return rows.filter((r) => !r.straight).map((r) => `${r.bill} was paid in parts. Its interest ran on what stayed open each day.`)
}

/** How a month is counted, under the table. */
export const INTEREST_MONTH_LINE = 'A month counts as 30.4 days, a twelfth of a year.'
