/**
 * Money in's deposits: the one rule for which bank deposits are a customer paying us, which typed-in payment
 * carries each, and which sit on no bill yet. Pure.
 *
 * Lifted out of `moneyInWeek.ts` and `moneyInWeekLoad.ts` (punch list #422) so two screens read it and cannot
 * drift: the Dashboard's Money in bar, whose chip reads *Landed · not applied yet*, and Bills sent's By day paid,
 * which names the same deposits under their day and never adds them. `moneyInWeek.ts` re-exports what it used to
 * hold, so its callers are unchanged. The reads are `moneyInDepositsLoad.ts`.
 *
 * A deposit on no bill is a posted customer deposit with money not yet applied, that no typed-in payment
 * carries (`depositOnNoBill`). A deposit a typed-in payment carries is that payment reaching the bank: its money
 * is already on a job.
 */
import { bankCheckFacts } from './jobs/checkCleared'
import { isCheckPayment } from './jobs/checkClearing'
import { AR_UNBANKED_CHECK_DAYS } from '../../supabase/functions/_shared/bankReturnedDeposits'
import { isInKindPaymentType } from '../../supabase/functions/_shared/inKindPayment'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../utils/dateUtils'

/** Dollars two amounts may differ by and still be the same money. */
export const MATCH_TOLERANCE_USD = 1
/** A payment typed in up to this many days before a deposit can be that deposit. */
export const MATCH_LOOKBACK_DAYS = 30
/** A check typed in more than this many days ago without reaching the bank leaves the drawer for Accounts Receivable's cases. */
export const DRAWER_DAYS = AR_UNBANKED_CHECK_DAYS

/** A recorded payment no deposit carries yet (`list_unlinked_payments_for_bank_payments`). */
export type MoneyInUnlinkedPayment = {
  paymentId: string
  jobId: string | null
  usd: number
  paidOnYmd: string | null
  paymentType: string | null
  referenceNumber: string | null
  payerName: string
}

export type MoneyInDeposit = {
  mercuryTransactionId: string
  /** Pending: the amount. Posted: what is still not applied to a bill. */
  usd: number
  kind: string | null
  counterpartyName: string | null
  state: 'pending' | 'posted'
  /** Pending: the day it was made. Posted: the day it posted. */
  dayYmd: string | null
  /** A pending check: the day the bank names for it to clear, when the bank names one (punch list #437, piece 2). */
  bankDayYmd?: string | null
  /** A pending check: the number the bank read off it, as the bank holds it. */
  checkNumber?: string | null
}

/** Mercury kinds that are never a customer paying us. */
const NOT_CUSTOMER_KINDS = new Set([
  'internalTransfer',
  'treasuryTransfer',
  'debitCardTransaction',
  'creditCardTransaction',
  'creditCardCredit',
  'outgoingPayment',
  'wireFee',
  'cardInternationalTransactionFee',
])

/** The org's Accounts Receivable deposit filter (`app_settings` bank_payments_sorting_config_v1). */
export type MoneyInDepositFilter = {
  kinds: ReadonlyArray<string>
  excludeCounterpartyContains: ReadonlyArray<string>
  excludeNoteContains: ReadonlyArray<string>
}

/**
 * A Mercury row that is a customer paying us, by the same filter the Accounts
 * Receivable window lists deposits with — and never a Stripe payout, which the
 * payout chip already carries.
 */
export function isCustomerDeposit(tx: { usd: number; kind: string | null; counterpartyName: string | null; note?: string | null }, filter: MoneyInDepositFilter | null): boolean {
  if (!(tx.usd > 0)) return false
  const kind = tx.kind ?? ''
  if (NOT_CUSTOMER_KINDS.has(kind)) return false
  const counterparty = (tx.counterpartyName ?? '').toLowerCase()
  if (counterparty.includes('stripe')) return false
  if (filter) {
    if (filter.kinds.length > 0 && !filter.kinds.includes(kind)) return false
    if (filter.excludeCounterpartyContains.some((p) => p.trim() !== '' && counterparty.includes(p.trim().toLowerCase()))) return false
    const note = (tx.note ?? '').toLowerCase()
    if (filter.excludeNoteContains.some((p) => p.trim() !== '' && note.includes(p.trim().toLowerCase()))) return false
  }
  return true
}

// ---------- The rows as they are read ----------

/** A pending deposit, a row of `mercury_transactions`. */
export type MoneyInPendingDepositRow = { id: string; amount: number | string | null; kind: string | null; created_at: string | null; counterparty_name: string | null; note: string | null; /** The number the bank read off a check (`raw.checkNumber`). */ check_number?: string | null; /** The day the bank names for a check to clear (`raw.estimatedDeliveryDate`). */ bank_day?: string | null }
/** A posted deposit as Accounts Receivable's own list answers it (`list_mercury_transactions_for_bank_payments`). */
export type MoneyInPostedDepositRow = {
  mercury_transaction_id: string
  amount: number | string | null
  posted_at: string | null
  counterparty_name: string | null
  note: string | null
  kind: string | null
  remaining_available: number | string | null
  returned: boolean | null
}
/** A typed-in payment no deposit carries, a row of `list_unlinked_payments_for_bank_payments`. */
export type MoneyInUnlinkedRow = { payment_id: string; job_id: string | null; amount: number | string | null; paid_on: string | null; payment_type: string | null; reference_number: string | null; job_name: string | null }

const num = (v: number | string | null | undefined): number => Number(v) || 0
const ymdOf = (iso: string | null): string | null => (iso ? calendarYmdInAppTzFromIso(iso) : null)

/**
 * The customer deposits among the rows read: every pending one, and each posted one that did not come back and
 * still holds money not applied to a bill. A posted deposit's amount is that money, not the whole deposit.
 */
export function moneyInDepositsFromRows(pending: ReadonlyArray<MoneyInPendingDepositRow>, posted: ReadonlyArray<MoneyInPostedDepositRow>, filter: MoneyInDepositFilter | null): MoneyInDeposit[] {
  return [
    ...pending
      .filter((t) => isCustomerDeposit({ usd: num(t.amount), kind: t.kind, counterpartyName: t.counterparty_name, note: t.note }, filter))
      .map((t): MoneyInDeposit => {
        const bank = bankCheckFacts(t)
        return { mercuryTransactionId: t.id, usd: num(t.amount), kind: t.kind, counterpartyName: t.counterparty_name, state: 'pending', dayYmd: ymdOf(t.created_at), bankDayYmd: bank.bankDayYmd, checkNumber: bank.checkNumber || null }
      }),
    ...posted
      .filter((t) => !t.returned && num(t.remaining_available) > 0.005 && isCustomerDeposit({ usd: num(t.amount), kind: t.kind, counterpartyName: t.counterparty_name, note: t.note }, filter))
      .map((t): MoneyInDeposit => ({ mercuryTransactionId: t.mercury_transaction_id, usd: num(t.remaining_available), kind: t.kind, counterpartyName: t.counterparty_name, state: 'posted', dayYmd: ymdOf(t.posted_at) })),
  ]
}

/** The typed-in payments no deposit carries, with the payer each screen names them by. */
export function moneyInUnlinkedFromRows(rows: ReadonlyArray<MoneyInUnlinkedRow>, payerName: (row: MoneyInUnlinkedRow) => string): MoneyInUnlinkedPayment[] {
  return rows.map((u) => ({ paymentId: u.payment_id, jobId: u.job_id, usd: num(u.amount), paidOnYmd: (u.paid_on ?? '').slice(0, 10) || null, paymentType: u.payment_type, referenceNumber: u.reference_number, payerName: payerName(u) }))
}

/** The payments still carrying money that came back, on one open return case: they never carry a deposit. */
export function returnCaseLivePaymentIds(row: { live_payments?: ReadonlyArray<{ payment_id: string }> | null; recorded_payment?: { payment_id: string } | null }): string[] {
  return [...(row.live_payments ?? []).map((p) => p.payment_id), ...(row.recorded_payment ? [row.recorded_payment.payment_id] : [])]
}

/** Every payment the open return cases still carry. A check the bank never saw (*unbanked*) is no return of money. */
export function returnedPaymentIdsOfCases(rows: ReadonlyArray<{ source?: string | null; live_payments?: ReadonlyArray<{ payment_id: string }> | null; recorded_payment?: { payment_id: string } | null }>): Set<string> {
  return new Set(rows.filter((r) => r.source !== 'unbanked').flatMap(returnCaseLivePaymentIds))
}

/** The first day posted deposits are read from: a deposit can only be a drawer check typed in up to three days after it. */
export function moneyInDepositsSince(todayYmd: string): string {
  return ymdAddDays(todayYmd, -(DRAWER_DAYS + 4))
}

/**
 * The first day to ask the bank's posted deposits from: the day asked for, or the day the org's Accounts
 * Receivable list starts (`startDateYmd` of its deposit filter) when that is later. Accounts Receivable lists no
 * deposit from before its start, so no screen names one: the deposits from before the office began matching in
 * the app are not money waiting on a bill. A start date that is missing or is no day leaves the asked day.
 */
export function moneyInDepositsReadFrom(sinceYmd: string, orgStartYmd: string | null | undefined): string {
  const start = (orgStartYmd ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && start > sinceYmd ? start : sinceYmd
}

// ---------- Deposits meet the payments that carry them ----------

/** A deposit, the day it counts on, and the typed-in payment that carries it, if one does. */
export type MoneyInDepositMatch = { deposit: MoneyInDeposit; dayYmd: string; payment: MoneyInUnlinkedPayment | null }

/**
 * Each customer deposit against the typed-in payments no deposit carries yet, oldest deposit first. A deposit
 * takes one payment of the same amount (within `MATCH_TOLERANCE_USD`), typed in from `MATCH_LOOKBACK_DAYS` before
 * its day to three days after: that is the check in the drawer reaching the bank. A check deposit takes a check
 * first, then the nearest amount, then the newest. A payment carries one deposit only.
 *
 * An in-kind payment is no money and a payment on an open return case carries money that came back: neither
 * carries a deposit. `unlinked` is the payments left to match, cleaned of both.
 */
export function matchMoneyInDeposits(input: {
  deposits: ReadonlyArray<MoneyInDeposit>
  unlinked: ReadonlyArray<MoneyInUnlinkedPayment>
  returnedPaymentIds?: ReadonlySet<string>
  todayYmd: string
}): { matches: MoneyInDepositMatch[]; unlinked: MoneyInUnlinkedPayment[]; usedPaymentIds: Set<string> } {
  const unlinked = input.unlinked.filter((u) => !isInKindPaymentType(u.paymentType) && u.usd > 0 && !input.returnedPaymentIds?.has(u.paymentId))
  const usedPaymentIds = new Set<string>()
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= MATCH_TOLERANCE_USD

  const paymentFor = (d: MoneyInDeposit, dDay: string): MoneyInUnlinkedPayment | null => {
    const from = ymdAddDays(dDay, -MATCH_LOOKBACK_DAYS)
    const to = ymdAddDays(dDay, 3)
    const checkDeposit = d.kind === 'checkDeposit'
    const candidates = unlinked.filter((u) => !usedPaymentIds.has(u.paymentId) && near(u.usd, d.usd) && (u.paidOnYmd == null || (u.paidOnYmd >= from && u.paidOnYmd <= to)))
    candidates.sort(
      (a, b) =>
        Number(isCheckPayment({ payment_type: b.paymentType }) === checkDeposit) - Number(isCheckPayment({ payment_type: a.paymentType }) === checkDeposit) ||
        Math.abs(a.usd - d.usd) - Math.abs(b.usd - d.usd) ||
        (b.paidOnYmd ?? '').localeCompare(a.paidOnYmd ?? ''),
    )
    return candidates[0] ?? null
  }

  const deposits = input.deposits
    .filter((d) => isCustomerDeposit({ usd: d.usd, kind: d.kind, counterpartyName: d.counterpartyName }, null))
    .sort((a, b) => (a.dayYmd ?? '').localeCompare(b.dayYmd ?? ''))
  const matches: MoneyInDepositMatch[] = []
  for (const d of deposits) {
    const dayYmd = d.dayYmd ?? input.todayYmd
    const payment = paymentFor(d, dayYmd)
    if (payment) usedPaymentIds.add(payment.paymentId)
    matches.push({ deposit: d, dayYmd, payment })
  }
  return { matches, unlinked, usedPaymentIds }
}

/**
 * A deposit that landed and is on no bill yet: posted at the bank, money still not applied, and no typed-in
 * payment carries it. Money in draws it *Landed · not applied yet* (or names the one open bill it can only be,
 * which is a guess and puts it on no bill). By day paid names it under its day and never adds it.
 */
export function depositOnNoBill(match: Pick<MoneyInDepositMatch, 'deposit' | 'payment'>): boolean {
  return match.deposit.state === 'posted' && match.payment == null
}

/** How many deposits landed on a day and are on no bill yet, and the money not applied on them. */
export type DepositsOnNoBill = { deposits: number; usd: number }

/** The deposits on no bill, by the day each posted. A day that has not come holds none. */
export function depositsOnNoBillByDay(matches: ReadonlyArray<MoneyInDepositMatch>, todayYmd: string): Map<string, DepositsOnNoBill> {
  const out = new Map<string, DepositsOnNoBill>()
  for (const m of matches) {
    if (!depositOnNoBill(m) || m.dayYmd > todayYmd) continue
    const day = out.get(m.dayYmd) ?? { deposits: 0, usd: 0 }
    out.set(m.dayYmd, { deposits: day.deposits + 1, usd: Math.round((day.usd + m.deposit.usd) * 100) / 100 })
  }
  return out
}
