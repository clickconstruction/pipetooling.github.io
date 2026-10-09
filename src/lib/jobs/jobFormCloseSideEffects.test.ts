import { describe, expect, it } from 'vitest'
import { closeDateMetBackfillNeeded, closeDemoteToBilledNeeded } from './jobFormCloseSideEffects'
import { jobFormRiderFeesDollars } from './jobFormMoneyTotals'

describe('closeDateMetBackfillNeeded', () => {
  const customers = [
    { id: 'c-blank', date_met: null },
    { id: 'c-set', date_met: '2026-01-05' },
  ]

  it('is true when a date is typed and the customer’s row has none', () => {
    expect(closeDateMetBackfillNeeded({ customerId: 'c-blank', dateMet: '2026-09-01', customers })).toBe(true)
  })

  it('is false when the customer already has one, no date is typed, or there is no customer', () => {
    expect(closeDateMetBackfillNeeded({ customerId: 'c-set', dateMet: '2026-09-01', customers })).toBe(false)
    expect(closeDateMetBackfillNeeded({ customerId: 'c-blank', dateMet: '   ', customers })).toBe(false)
    expect(closeDateMetBackfillNeeded({ customerId: null, dateMet: '2026-09-01', customers })).toBe(false)
  })

  it('is false for a customer the form’s cache does not hold', () => {
    expect(closeDateMetBackfillNeeded({ customerId: 'c-missing', dateMet: '2026-09-01', customers })).toBe(false)
  })
})

describe('closeDemoteToBilledNeeded', () => {
  const fixtures = [{ name: 'Rough-in', count: 1, line_unit_price: 1_000 }]

  it('a Paid job with a balance due again moves back to Billed', () => {
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars: 0, payments: [{ amount: 600 }] })).toBe(true)
  })

  it('the rider fees count toward what is due', () => {
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars: 0, payments: [{ amount: 1_000 }] })).toBe(false)
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars: 75, payments: [{ amount: 1_000 }] })).toBe(true)
  })

  it('a returned check fee still owed keeps the job from reading Paid (v2.5091)', () => {
    const bill = { id: 'b1', amount: 1_030, fee_lines: [{ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount: 30, case_id: 'tx-sp' }] }
    const riderFeesDollars = jobFormRiderFeesDollars(0, [bill])
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars, payments: [{ amount: 1_000 }] })).toBe(true)
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars, payments: [{ amount: 1_030 }] })).toBe(false)
  })

  it('a cent of slack is not a balance', () => {
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars: 0, payments: [{ amount: 999.99 }] })).toBe(false)
    expect(closeDemoteToBilledNeeded({ status: 'paid', fixtures, riderFeesDollars: 0, payments: [{ amount: 999.98 }] })).toBe(true)
  })

  it('reads the status however it is cased, and only a Paid job moves', () => {
    expect(closeDemoteToBilledNeeded({ status: ' Paid ', fixtures, riderFeesDollars: 0, payments: [] })).toBe(true)
    for (const status of ['billed', 'working', 'ready_to_bill', null, undefined, '']) {
      expect(closeDemoteToBilledNeeded({ status, fixtures, riderFeesDollars: 0, payments: [] })).toBe(false)
    }
  })
})
