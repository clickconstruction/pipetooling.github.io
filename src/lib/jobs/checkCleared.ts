/**
 * A check has cleared when the bank says so (punch list #437, piece 1). The owner's rule of 2026-11-24: a check
 * counts toward a lien's release once it clears, and not before.
 *
 * The bank's own row answers it (`mercury_transactions`, a `checkDeposit`). The bank does two things on two days:
 * it posts the deposit, usually within a day or three, and it names a later day, about a week out, as the day the
 * check clears (`raw.estimatedDeliveryDate`). A posted check can still come back until that day. So a check has
 * cleared when the bank posted it AND the bank's day has come. A posted row with no such day waits the app's
 * seven days from its posting (`checkClearing.ts`).
 *
 * A payment finds its deposit by the link Accounts Receivable wrote (`mercury_transaction_id`), else by the
 * check's number: a deposit with the same number, for at least the payment's amount, made within sixty days of
 * the payment's day. A check with no deposit to be found waits seven days from the day typed, as before.
 *
 * A failed deposit is one of two things (`bankReturnedDeposits.ts`): the bank could not read the check, which is
 * usually deposited again, or the paying bank sent it back. Neither has cleared.
 *
 * Every sentence keeps to `plainWords.ts` and marks its values with `val`. Pure; tested beside it. The read is
 * `checkClearedIo.ts`. The readers are Payoffs (`lienPayoff.ts`), the Release of record tab
 * (`lienReleaseOfRecord.ts`) and the check pane (`lienPayoffCheck.ts`).
 */
import type { UserRole } from '../../hooks/useAuth'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../../utils/dateUtils'
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { isBankReturnReason } from './bankReturnedDeposits'
import { formatYmdMonthDay } from './billedExpectedPay'
import { CHECK_CLEAR_DAYS, isCheckPayment } from './checkClearing'

/** How far back the bank's check deposits are read, and how far a payment's day may sit from its deposit. */
export const BANK_CHECK_WINDOW_DAYS = 60

/**
 * Who may act on a check before the bank has cleared it (punch list #437, call 4, the owner's answer of 2026-11-25:
 * *a leader, a controller, or a dev*, and *the same three* for every early press on a held check). One list, read by
 * the release tab's *Release it anyway…*, on a check that has not cleared (v2.8735) and with money still open
 * (v2.8740, `canReleaseAnyway`), and by Payoffs' *The bank
 * confirmed the funds* (`canConfirmFunds`). A leader is the owner's role. The controller is named by itself: the
 * assistant is not one of the three.
 */
export const EARLY_ON_CHECK_ROLES: ReadonlyArray<UserRole> = ['dev', 'master_technician', 'controller']

export function canActBeforeCheckClears(role: UserRole | string | null | undefined): boolean {
  return typeof role === 'string' && (EARLY_ON_CHECK_ROLES as ReadonlyArray<string>).includes(role)
}

/** One check deposit as the bank holds it. Days are in the company's calendar. */
export type BankCheck = {
  id: string
  amount: number
  /** The bank's status: `pending`, `sent` once posted, `failed`, `cancelled`. */
  status: string | null
  /** The day it was deposited. */
  depositedYmd: string
  /** The day the bank posted it, or null. */
  postedYmd: string | null
  /** The day the bank names for the check to clear, or null. */
  bankDayYmd: string | null
  /** The number the bank read off the check. '' when it read none. */
  checkNumber: string
  /** The bank's words when the deposit failed. */
  failureReason: string | null
}

/** The columns `checkClearedIo.ts` reads off the bank's row. */
export const BANK_CHECK_COLUMNS = 'id, amount, status, posted_at, created_at, check_number:raw->>checkNumber, bank_day:raw->>estimatedDeliveryDate, failure_reason:raw->>reasonForFailure'

export type BankCheckRow = { id: string; amount: number | string | null; status: string | null; posted_at: string | null; created_at: string | null; check_number: string | null; bank_day: string | null; failure_reason: string | null }

const rowYmd = (iso: string | null | undefined): string | null => (iso ? calendarYmdInAppTzFromIso(String(iso)) || null : null)

/** The two columns that carry what the bank says of a check, for a read that already has the rest of the row. */
export const BANK_CHECK_FACT_COLUMNS = 'check_number:raw->>checkNumber, bank_day:raw->>estimatedDeliveryDate'

/**
 * What the bank itself says of a check, read off its row (punch list #437, piece 2): the day it posted the deposit,
 * the day it names for the check to clear, the number it read off the check, and its words when the deposit
 * failed. A row that carries none of them answers all four empty. Each instant is read as its day in the
 * company's calendar, never its UTC date. `bankCheckFromRow` and Money in's pending deposits both read these.
 */
export function bankCheckFacts(row: Partial<Pick<BankCheckRow, 'posted_at' | 'check_number' | 'bank_day' | 'failure_reason'>>): Pick<BankCheck, 'postedYmd' | 'bankDayYmd' | 'checkNumber' | 'failureReason'> {
  return {
    postedYmd: rowYmd(row.posted_at),
    bankDayYmd: rowYmd(row.bank_day),
    checkNumber: (row.check_number ?? '').trim(),
    failureReason: (row.failure_reason ?? '').trim() || null,
  }
}

/** The bank's row as a `BankCheck`: each instant read as its day in the company's calendar, never its UTC date. */
export function bankCheckFromRow(row: BankCheckRow): BankCheck {
  return {
    id: row.id,
    amount: Math.round((Number(row.amount) || 0) * 100) / 100,
    status: row.status,
    depositedYmd: rowYmd(row.created_at) ?? '',
    ...bankCheckFacts(row),
  }
}

/**
 * - `at_bank`: deposited, not posted.
 * - `late`: not posted, and the bank's own day has passed.
 * - `posted`: posted, and it can still come back.
 * - `cleared`: posted, and the bank's day has come.
 * - `unread`: the deposit failed and the paying bank gave no reason. The check never reached it.
 * - `came_back`: the paying bank sent it back.
 * - `no_deposit`: a check payment with no deposit to be found. It waits seven days from the day typed.
 * - `not_check`: cash, a card, a transfer. Nothing to wait for.
 */
export type CheckAnswerState = 'not_check' | 'cleared' | 'posted' | 'at_bank' | 'late' | 'unread' | 'came_back' | 'no_deposit'

export type CheckAnswer = {
  state: CheckAnswerState
  /** True once a release may rest on the check. */
  cleared: boolean
  /** The day it clears or cleared, when a day is known. */
  clearsYmd: string | null
  /** The bank's row behind the answer, or null. */
  check: BankCheck | null
}

/** A check's number as two checks are compared: digits and letters only, no leading zeros. *01184* is *1184*. */
export function checkNumberKey(number: string | null | undefined): string {
  return (number ?? '')
    .trim()
    .replace(/^(?:check|cheque|chk|ck)\b\.?\s*/i, '')
    .replace(/[^0-9A-Za-z]/g, '')
    .replace(/^0+/, '')
    .toLowerCase()
}

const cents = (v: number | string | null | undefined): number => Math.round((Number(v) || 0) * 100)
const isYmd = (s: string | null | undefined): s is string => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '')

/** What the bank says about one of its own check deposits, as of `todayYmd`. */
export function bankCheckAnswer(check: BankCheck, todayYmd: string): CheckAnswer {
  const status = (check.status ?? '').trim().toLowerCase()
  if (status === 'failed' || status === 'cancelled') {
    const cameBack = status === 'failed' && (Boolean(check.postedYmd) || isBankReturnReason(check.failureReason))
    return { state: cameBack ? 'came_back' : 'unread', cleared: false, clearsYmd: null, check }
  }
  if (!check.postedYmd) {
    const late = isYmd(check.bankDayYmd) && check.bankDayYmd < todayYmd
    return { state: late ? 'late' : 'at_bank', cleared: false, clearsYmd: check.bankDayYmd, check }
  }
  const named = isYmd(check.bankDayYmd) ? check.bankDayYmd : ymdAddDays(check.postedYmd, CHECK_CLEAR_DAYS)
  const clearsYmd = named > check.postedYmd ? named : check.postedYmd
  const cleared = clearsYmd <= todayYmd
  return { state: cleared ? 'cleared' : 'posted', cleared, clearsYmd, check }
}

/** The newest deposit among several: the last deposited, then the last id, so the pick never flips. */
const newest = (list: BankCheck[]): BankCheck | null => (list.length ? [...list].sort((a, b) => b.depositedYmd.localeCompare(a.depositedYmd) || b.id.localeCompare(a.id))[0]! : null)

/** The bank's deposit of a check a person typed whole: the same number and the same amount to the cent. */
export function bankCheckTyped(typed: { number: string; amount: number | null }, checks: ReadonlyArray<BankCheck>): BankCheck | null {
  const key = checkNumberKey(typed.number)
  if (!key || !(Number(typed.amount) > 0)) return null
  return newest(checks.filter((c) => checkNumberKey(c.checkNumber) === key && cents(c.amount) === cents(typed.amount)))
}

export type CheckClearedPayment = {
  amount: number | string | null
  paid_on: string | null
  payment_type: string | null
  reference_number: string | null
  mercury_transaction_id?: string | null
}

/** The bank's deposit behind a recorded payment: the linked one, else the one its check number names. */
export function bankCheckForPayment(payment: CheckClearedPayment, checks: ReadonlyArray<BankCheck>): BankCheck | null {
  const linked = payment.mercury_transaction_id ? checks.find((c) => c.id === payment.mercury_transaction_id) : null
  if (linked) return linked
  const key = checkNumberKey(payment.reference_number)
  const paidYmd = (payment.paid_on ?? '').slice(0, 10)
  if (!key || !isYmd(paidYmd)) return null
  const from = ymdAddDays(paidYmd, -BANK_CHECK_WINDOW_DAYS)
  const to = ymdAddDays(paidYmd, BANK_CHECK_WINDOW_DAYS)
  return newest(checks.filter((c) => checkNumberKey(c.checkNumber) === key && cents(c.amount) >= cents(payment.amount) && c.depositedYmd >= from && c.depositedYmd <= to))
}

/** Whether a recorded payment has cleared, as of `todayYmd`. Anything but a check has. */
export function paymentCheckAnswer(payment: CheckClearedPayment, checks: ReadonlyArray<BankCheck>, todayYmd: string): CheckAnswer {
  if (!isCheckPayment(payment)) return { state: 'not_check', cleared: true, clearsYmd: null, check: null }
  const check = bankCheckForPayment(payment, checks)
  if (check) return bankCheckAnswer(check, todayYmd)
  const paidYmd = (payment.paid_on ?? '').slice(0, 10)
  const clearsYmd = isYmd(paidYmd) ? ymdAddDays(paidYmd, CHECK_CLEAR_DAYS) : null
  return { state: 'no_deposit', cleared: !clearsYmd || clearsYmd <= todayYmd, clearsYmd, check: null }
}

const day = (ymd: string | null): string => val('day', formatYmdMonthDay(ymd ?? ''))
const upper = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** A check as a sentence names it: *check 1184*, or *the check* when it has no number. */
export function checkName(number: string | null | undefined): string {
  const n = (number ?? '').trim()
  return n ? `check ${n}` : 'the check'
}


export type CheckAnswerWords = {
  /** What the bank says, with its values marked. '' for a check that cleared with no bank row, or no check. */
  say: string
  /** When what waits on the check may go ahead: *until then*, *for the bank*. '' once cleared. */
  wait: string
  tone: 'red' | 'amber' | 'green'
}

/**
 * What the bank says about a check, in one or two sentences. `name` is how the sentence names the check
 * (`checkName`), without marks: it is marked here as a value. With `amount` the check is named with what it is
 * for: *check 01184 for $16,455.50*.
 */
export function checkAnswerWords(answer: CheckAnswer, name: string, amount?: number | null): CheckAnswerWords {
  const forAmount = amount != null && amount > 0 ? ` for ${val('money', moneyWords(amount))}` : ''
  const it = `${val('way', name)}${forAmount}`
  const It = `${val('way', upper(name))}${forAmount}`
  switch (answer.state) {
    case 'not_check':
      return { say: '', wait: '', tone: 'green' }
    case 'cleared':
      return { say: `The bank cleared ${it} on ${day(answer.clearsYmd)}.`, wait: '', tone: 'green' }
    case 'posted':
      return { say: `The bank posted ${it} on ${day(answer.check?.postedYmd ?? null)}. It can still come back until ${day(answer.clearsYmd)}.`, wait: 'until then', tone: 'amber' }
    case 'at_bank':
      return answer.clearsYmd
        ? { say: `${It} is at the bank. The bank says it clears ${day(answer.clearsYmd)}.`, wait: 'until then', tone: 'amber' }
        : { say: `${It} is at the bank. The bank has not posted it.`, wait: 'for the bank', tone: 'amber' }
    case 'late':
      return { say: `The bank named ${day(answer.clearsYmd)} for ${it}. It has not posted it.`, wait: 'for the bank', tone: 'amber' }
    case 'unread':
      return { say: `The bank could not read ${it}. Deposit it again.`, wait: 'for the new deposit', tone: 'amber' }
    case 'came_back': {
      const reason = (answer.check?.failureReason ?? '').trim().replace(/[.\s]+$/, '')
      return { say: reason ? `${It} came back. The bank said ${val('way', reason.toLowerCase())}.` : `${It} came back.`, wait: 'for a payment that holds', tone: 'red' }
    }
    case 'no_deposit':
      return answer.cleared ? { say: '', wait: '', tone: 'green' } : { say: `The bank shows no deposit of ${it}. Without one it counts as cleared ${day(answer.clearsYmd)}.`, wait: 'until then', tone: 'amber' }
  }
}
