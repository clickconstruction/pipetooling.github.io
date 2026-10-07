/**
 * GC mode, the real build, Owner Billing's O2a: interest on the customer's late bills, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingInterest.ts`).
 */
import { appCertified, ownerExpectPaidOn, ownerPayAppsSent } from './ownerBilling'
import type { GcProject, GcState, OwnerPayAppSent } from './types'

/** The rate the office starts from, a month. Ours to change to what the contract says. */
export const OWNER_INTEREST_DEFAULT_PCT = 1.5

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/** The first day the bill was due: their first promise or the day we expected it, whichever came first. */
export function ownerInterestFrom(state: GcState, project: GcProject, app: OwnerPayAppSent): string | null {
  const days = [app.promises?.[0]?.by ?? null, ownerExpectPaidOn(state, project, app)].filter((d): d is string => d !== null).sort()
  return days[0] ?? null
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
