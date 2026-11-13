import { describe, expect, it } from 'vitest'
import {
  isSubPayMethod,
  parseSubPaymentAmount,
  planSubPayment,
  subPayMethodLabel,
  subPayMethodRefField,
  subPayMethodWords,
  subPayMethodWrite,
  subPaymentAfterWords,
  subPaymentAmountDefault,
  subPaymentSummaryWords,
  subSheetMoney,
  SUB_PAY_METHOD_OPTIONS,
  SUB_PAY_METHODS,
} from './subPaymentWindow'

describe('what is left on a sheet', () => {
  it('counts every part payment and every back-charge', () => {
    expect(subSheetMoney(6000, [])).toEqual({ total: 6000, paid: 0, backcharged: 0, remaining: 6000 })
    expect(subSheetMoney(6000, [{ amount: 1500 }])).toMatchObject({ paid: 1500, remaining: 4500 })
    expect(subSheetMoney(6000, [{ amount: 1500 }, { amount: 3000 }])).toMatchObject({ paid: 4500, remaining: 1500 })
    expect(subSheetMoney(6000, [{ amount: 1500 }, { amount: 3000 }, { amount: 1500 }])).toMatchObject({ paid: 6000, remaining: 0 })
    // A back-charge is a row below zero and takes off what is owed.
    expect(subSheetMoney(1500, [{ amount: 500 }, { amount: 850 }, { amount: -150 }])).toEqual({ total: 1500, paid: 1350, backcharged: 150, remaining: 0 })
  })

  it('keeps cents exact through a run of parts, and never reads below zero', () => {
    expect(subSheetMoney(0.3, [{ amount: 0.1 }, { amount: 0.2 }]).remaining).toBe(0)
    expect(subSheetMoney(100.1, [{ amount: 33.37 }, { amount: 33.37 }, { amount: '33.36' }]).remaining).toBe(0)
    expect(subSheetMoney(1000, [{ amount: 333.33 }, { amount: 333.33 }]).remaining).toBe(333.34)
    expect(subSheetMoney(100, [{ amount: 120 }]).remaining).toBe(0)
    expect(subSheetMoney(100, null).remaining).toBe(100)
    expect(subSheetMoney(100, [{ amount: 'x' }]).remaining).toBe(100)
  })

  it('the amount box opens on what is left, blank when nothing is', () => {
    expect(subPaymentAmountDefault(4200)).toBe('4200.00')
    expect(subPaymentAmountDefault(333.335)).toBe('333.34')
    expect(subPaymentAmountDefault(0)).toBe('')
    expect(subPaymentAmountDefault(0.004)).toBe('')
  })
})

describe('the amount as typed', () => {
  it('reads dollars with commas and a dollar sign', () => {
    expect(parseSubPaymentAmount('1,500.00')).toBe(1500)
    expect(parseSubPaymentAmount(' $2,400 ')).toBe(2400)
    expect(parseSubPaymentAmount('.5')).toBe(0.5)
    expect(parseSubPaymentAmount('12.')).toBe(12)
  })

  it('is not a number when it is not one', () => {
    for (const bad of ['', 'abc', '1.2.3', '-50', '12abc', '1e3']) expect(Number.isNaN(parseSubPaymentAmount(bad))).toBe(true)
  })
})

describe('planSubPayment', () => {
  it('records a part payment whole and says what stays due', () => {
    const plan = planSubPayment('1500', 6000)
    expect(plan).toEqual({ ok: true, amount: 1500, leaves: 4500, settles: false })
    expect(subPaymentAfterWords(plan)).toBe('A part payment. $4,500.00 stays due on the sheet.')
  })

  it('the last part settles the sheet', () => {
    const plan = planSubPayment('1,500.00', 1500)
    expect(plan).toEqual({ ok: true, amount: 1500, leaves: 0, settles: true })
    expect(subPaymentAfterWords(plan)).toBe('This pays the sheet in full.')
    // What is left after two thirds, to the cent.
    expect(planSubPayment('333.34', subSheetMoney(1000, [{ amount: 333.33 }, { amount: 333.33 }]).remaining)).toMatchObject({ ok: true, settles: true })
  })

  it('rounds a typed amount to the cent', () => {
    expect(planSubPayment('10.005', 100)).toMatchObject({ ok: true, amount: 10.01 })
    expect(planSubPayment('10.004', 100)).toMatchObject({ ok: true, amount: 10 })
  })

  it('refuses an amount past what is left, and says by how much', () => {
    const plan = planSubPayment('4300', 4200)
    expect(plan).toEqual({ ok: false, reason: 'over', over: 100, error: '$4,300.00 is $100.00 more than the $4,200.00 left on this sheet. Record up to $4,200.00 here.' })
    expect(subPaymentAfterWords(plan)).toBe('')
    // One cent over is over; the same cent is not.
    expect(planSubPayment('4200.01', 4200)).toMatchObject({ ok: false, reason: 'over', over: 0.01 })
    expect(planSubPayment('4200.00', 4200)).toMatchObject({ ok: true, settles: true })
  })

  it('refuses a blank, a zero, a word and a sheet with nothing left, each with its reason', () => {
    expect(planSubPayment('  ', 100)).toMatchObject({ ok: false, reason: 'blank', error: 'Type the amount that was paid.' })
    expect(planSubPayment('0', 100)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(planSubPayment('0.004', 100)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(planSubPayment('lots', 100)).toMatchObject({ ok: false, reason: 'invalid', error: 'Type an amount above zero, in dollars and cents.' })
    expect(planSubPayment('50', 0)).toMatchObject({ ok: false, reason: 'nothing_left', error: 'This sheet has nothing left to pay.' })
  })
})

describe('how it was sent', () => {
  it('a check and Zelle lead, and every method has its words', () => {
    expect(SUB_PAY_METHODS.slice(0, 2)).toEqual(['check', 'zelle'])
    expect(SUB_PAY_METHOD_OPTIONS.map((o) => o.label)).toEqual(['Check', 'Zelle', 'Mercury', 'Cash App', 'Apple Pay', 'Cash', 'Client direct', 'Other'])
    expect(isSubPayMethod('check')).toBe(true)
    expect(isSubPayMethod('cheque')).toBe(false)
    expect(subPayMethodLabel('nope')).toBe('')
    expect(subPayMethodLabel(null)).toBe('')
  })

  it('a check, Cash App, Zelle and Mercury open a box for their number; the rest do not', () => {
    expect(subPayMethodRefField('check')?.label).toBe('Check number (optional)')
    expect(subPayMethodRefField('cashapp')?.label).toBe('Cash App transaction id (optional)')
    expect(subPayMethodRefField('zelle')?.label).toBe('Confirmation number (optional)')
    expect(subPayMethodRefField('mercury')?.label).toBe('Confirmation number (optional)')
    for (const m of ['apple_pay', 'cash', 'client_direct', 'other'] as const) expect(subPayMethodRefField(m)).toBeNull()
    expect(subPayMethodRefField(null)).toBeNull()
  })

  it('stores the pick and its number trimmed, and drops a number with nowhere to go', () => {
    expect(subPayMethodWrite('check', ' 1187 ')).toEqual({ method: 'check', method_ref: '1187' })
    expect(subPayMethodWrite('zelle', '')).toEqual({ method: 'zelle', method_ref: null })
    expect(subPayMethodWrite('cash', '1187')).toEqual({ method: 'cash', method_ref: null })
    expect(subPayMethodWrite(null, '1187')).toEqual({ method: null, method_ref: null })
  })

  it('a row says its method in a few words', () => {
    expect(subPayMethodWords({ method: 'check', method_ref: '1187' })).toBe('Check 1187')
    expect(subPayMethodWords({ method: 'zelle', method_ref: null })).toBe('Zelle')
    expect(subPayMethodWords({ method: null, method_ref: '1187' })).toBe('')
    expect(subPayMethodWords({})).toBe('')
  })
})

describe('the window line', () => {
  it('names the sub, the job and the three sums', () => {
    expect(subPaymentSummaryWords({ contractor: 'Sub Sam', hcp: 'HCP-77', totalCost: 500, paid: 100, outstanding: 400 })).toBe('Sub Sam · HCP-77 · Total $500.00 · Paid $100.00 · Remaining $400.00')
    expect(subPaymentSummaryWords({ contractor: 'Sub Sam', hcp: '', totalCost: 500, paid: 520, outstanding: -20 })).toBe('Sub Sam · Total $500.00 · Paid $520.00 · Remaining $0.00')
  })
})
