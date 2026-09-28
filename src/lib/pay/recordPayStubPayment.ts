/** Record payment on a pay report: what is left on the stub, what a typed amount applies, and what spills over. */

import type { PersonOffsetInitialDraft } from '../../components/pay/PersonOffsetFormModal'
import {
  stubNetPay,
  sumPayStubAdditionalAmounts,
  sumPayStubDeductionAmounts,
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
} from '../payStubDeductions'
import {
  PAY_STUB_PAY_FULLY_TOLERANCE,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../payStubPayments'

/** The three child-row maps `loadPayStubs` keeps per stub id. */
export type PayStubLineMaps = {
  paymentsByStubId: Record<string, PayStubPaymentRow[]>
  deductionsByStubId: Record<string, PayStubDeductionRow[]>
  additionalByStubId: Record<string, PayStubAdditionalLineRow[]>
}

export type PayStubBalance = {
  /** gross − Less + Additional, never negative. */
  netPay: number
  paidSoFar: number
  /** netPay − paidSoFar, never negative. */
  remaining: number
}

export function payStubBalance(stub: { id: string; gross_pay: number }, maps: PayStubLineMaps): PayStubBalance {
  const paidSoFar = sumPayStubPaymentAmounts(maps.paymentsByStubId[stub.id])
  const netPay = stubNetPay(
    stub.gross_pay,
    sumPayStubDeductionAmounts(maps.deductionsByStubId[stub.id]),
    sumPayStubAdditionalAmounts(maps.additionalByStubId[stub.id]),
  )
  return { netPay, paidSoFar, remaining: remainingPayStubBalance(netPay, paidSoFar) }
}

/** The Amount paid box as a number: commas dropped, `NaN` when it is not one. */
export function parsePayStubPaymentAmount(amountText: string): number {
  return parseFloat(amountText.trim().replace(/,/g, ''))
}

/** What the Amount paid box opens with: the remaining balance, or blank when nothing is left. */
export function payStubPaymentAmountDefault(remaining: number): string {
  return remaining > 0 ? remaining.toFixed(2) : ''
}

/** How far a typed amount runs past the remaining balance (whole cents), or `null` when it does not. */
export function payStubPaymentExcess(amountText: string, remaining: number): number | null {
  const typed = parsePayStubPaymentAmount(amountText)
  if (!Number.isFinite(typed) || typed <= remaining + PAY_STUB_PAY_FULLY_TOLERANCE) return null
  return Math.round((typed - remaining) * 100) / 100
}

export const PAY_STUB_PAYMENT_INVALID_AMOUNT_MESSAGE = 'Enter a valid payment amount greater than zero.'
export const PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE = 'No remaining balance to apply this payment to.'

export type PayStubPaymentPlan = { ok: true; applied: number } | { ok: false; error: string }

/** Confirm's gate: a typed amount is applied up to the remaining balance, never past it. */
export function planPayStubPayment(amountText: string, remaining: number): PayStubPaymentPlan {
  const amount = parsePayStubPaymentAmount(amountText)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: PAY_STUB_PAYMENT_INVALID_AMOUNT_MESSAGE }
  if (remaining <= PAY_STUB_PAY_FULLY_TOLERANCE) return { ok: false, error: PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE }
  const applied = Math.round(Math.min(amount, remaining) * 100) / 100
  if (applied <= 0) return { ok: false, error: PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE }
  return { ok: true, applied }
}

/** The Add offset draft behind "Record employee credit…": the excess as the amount, the memo and the pay period as the description. */
export function employeeCreditDraftFromPayment(input: {
  stub: { person_name: string; period_start: string; period_end: string }
  amountText: string
  remaining: number
  memo: string
  paidDateYmd: string
  todayYmd: string
}): PersonOffsetInitialDraft {
  const excess = payStubPaymentExcess(input.amountText, input.remaining)
  const periodLine = `Pay period ${input.stub.period_start} – ${input.stub.period_end}`
  return {
    personName: input.stub.person_name,
    type: 'employee_credit',
    amount: excess === null ? '' : excess.toFixed(2),
    description: [input.memo.trim(), periodLine].filter(Boolean).join(' · '),
    occurredDate: input.paidDateYmd.trim() || input.todayYmd,
  }
}
