/**
 * GC mode, the real build, Owner Billing's O2a: interest on the customer's late bills, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingInterest.ts`). O6b-1 made decision 7 the rule: interest runs from the
 * day after a bill falls due by the contract, and a promise never moves it.
 */
import { addDays } from './building'
import { appCertified, ownerPayAppsSent } from './ownerBilling'
import type { GcProject, GcState, OwnerPayAppSent } from './types'

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
