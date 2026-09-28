import { describe, expect, it } from 'vitest'
import type { PayStubAdditionalLineRow, PayStubDeductionRow } from '../payStubDeductions'
import type { PayStubPaymentRow } from '../payStubPayments'
import {
  employeeCreditDraftFromPayment,
  parsePayStubPaymentAmount,
  PAY_STUB_PAYMENT_INVALID_AMOUNT_MESSAGE,
  PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE,
  payStubBalance,
  payStubPaymentAmountDefault,
  payStubPaymentExcess,
  planPayStubPayment,
  type PayStubLineMaps,
} from './recordPayStubPayment'

function payment(amount: number): PayStubPaymentRow {
  return { id: `p${amount}`, pay_stub_id: 's1', amount, paid_at: '2026-09-25', memo: null, created_at: null, created_by: null }
}

function deduction(amount: number): PayStubDeductionRow {
  return { id: `d${amount}`, pay_stub_id: 's1', amount, source: 'manual', person_offset_id: null, description: 'Less', created_at: null, created_by: null }
}

function additional(lineTotal: number): PayStubAdditionalLineRow {
  return { id: `a${lineTotal}`, pay_stub_id: 's1', description: 'Bonus', quantity: 1, rate: lineTotal, line_total: lineTotal, created_at: null, created_by: null }
}

function maps(overrides: Partial<PayStubLineMaps> = {}): PayStubLineMaps {
  return { paymentsByStubId: {}, deductionsByStubId: {}, additionalByStubId: {}, ...overrides }
}

const stub = { id: 's1', gross_pay: 1000, person_name: 'Alex Rivera', period_start: '2026-09-14', period_end: '2026-09-20' }

describe('payStubBalance', () => {
  it('is the gross when the stub has no lines and no payments', () => {
    expect(payStubBalance(stub, maps())).toEqual({ netPay: 1000, paidSoFar: 0, remaining: 1000 })
  })

  it('takes Less off, adds Additional, then takes the payments off', () => {
    const m = maps({
      deductionsByStubId: { s1: [deduction(150.25)] },
      additionalByStubId: { s1: [additional(50)] },
      paymentsByStubId: { s1: [payment(300), payment(99.75)] },
    })
    expect(payStubBalance(stub, m)).toEqual({ netPay: 899.75, paidSoFar: 399.75, remaining: 500 })
  })

  it('reads only the stub it is asked about', () => {
    const m = maps({ paymentsByStubId: { other: [payment(400)] }, deductionsByStubId: { other: [deduction(100)] } })
    expect(payStubBalance(stub, m).remaining).toBe(1000)
  })

  it('never goes below zero, on net pay or on what is left', () => {
    expect(payStubBalance(stub, maps({ deductionsByStubId: { s1: [deduction(1200)] } }))).toEqual({ netPay: 0, paidSoFar: 0, remaining: 0 })
    expect(payStubBalance(stub, maps({ paymentsByStubId: { s1: [payment(1100)] } })).remaining).toBe(0)
  })
})

describe('parsePayStubPaymentAmount', () => {
  it('drops commas and outer spaces', () => {
    expect(parsePayStubPaymentAmount(' 1,234.50 ')).toBe(1234.5)
  })

  it('is NaN for a blank or a word', () => {
    expect(parsePayStubPaymentAmount('')).toBeNaN()
    expect(parsePayStubPaymentAmount('abc')).toBeNaN()
  })
})

describe('payStubPaymentAmountDefault', () => {
  it('is the remaining balance to the cent', () => {
    expect(payStubPaymentAmountDefault(500)).toBe('500.00')
    expect(payStubPaymentAmountDefault(0.1)).toBe('0.10')
  })

  it('is blank when nothing is left', () => {
    expect(payStubPaymentAmountDefault(0)).toBe('')
  })
})

describe('payStubPaymentExcess', () => {
  it('is what runs past the remaining balance, in whole cents', () => {
    expect(payStubPaymentExcess('600', 500)).toBe(100)
    expect(payStubPaymentExcess('1,000.10', 500.05)).toBe(500.05)
  })

  it('is null at the balance, under it, and within the one-cent tolerance', () => {
    expect(payStubPaymentExcess('500', 500)).toBeNull()
    expect(payStubPaymentExcess('200', 500)).toBeNull()
    expect(payStubPaymentExcess('500.01', 500)).toBeNull()
  })

  it('is null when the box holds no number', () => {
    expect(payStubPaymentExcess('', 500)).toBeNull()
    expect(payStubPaymentExcess('abc', 500)).toBeNull()
  })
})

describe('planPayStubPayment', () => {
  it('applies the typed amount when it fits', () => {
    expect(planPayStubPayment('200.555', 500)).toEqual({ ok: true, applied: 200.56 })
    expect(planPayStubPayment('500', 500)).toEqual({ ok: true, applied: 500 })
  })

  it('applies no more than the remaining balance', () => {
    expect(planPayStubPayment('750', 500)).toEqual({ ok: true, applied: 500 })
  })

  it('refuses a blank, a word, zero and a negative', () => {
    for (const text of ['', 'abc', '0', '-20']) {
      expect(planPayStubPayment(text, 500)).toEqual({ ok: false, error: PAY_STUB_PAYMENT_INVALID_AMOUNT_MESSAGE })
    }
  })

  it('refuses when the stub is paid, or a cent from paid', () => {
    expect(planPayStubPayment('100', 0)).toEqual({ ok: false, error: PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE })
    expect(planPayStubPayment('100', 0.01)).toEqual({ ok: false, error: PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE })
  })

  it('refuses an amount that rounds to nothing', () => {
    expect(planPayStubPayment('0.004', 500)).toEqual({ ok: false, error: PAY_STUB_PAYMENT_NO_BALANCE_MESSAGE })
  })
})

describe('employeeCreditDraftFromPayment', () => {
  const base = { stub, remaining: 500, memo: '', paidDateYmd: '2026-09-25', todayYmd: '2026-09-27' }

  it('carries the excess as the amount and the pay period as the description', () => {
    expect(employeeCreditDraftFromPayment({ ...base, amountText: '650' })).toEqual({
      personName: 'Alex Rivera',
      type: 'employee_credit',
      amount: '150.00',
      description: 'Pay period 2026-09-14 – 2026-09-20',
      occurredDate: '2026-09-25',
    })
  })

  it('puts the memo ahead of the pay period', () => {
    const draft = employeeCreditDraftFromPayment({ ...base, amountText: '650', memo: '  Check 1042 ' })
    expect(draft.description).toBe('Check 1042 · Pay period 2026-09-14 – 2026-09-20')
  })

  it('leaves the amount blank when nothing spills over', () => {
    expect(employeeCreditDraftFromPayment({ ...base, amountText: '500' }).amount).toBe('')
    expect(employeeCreditDraftFromPayment({ ...base, amountText: '' }).amount).toBe('')
  })

  it('falls back to today when the paid date is blank', () => {
    expect(employeeCreditDraftFromPayment({ ...base, amountText: '650', paidDateYmd: ' ' }).occurredDate).toBe('2026-09-27')
  })
})
