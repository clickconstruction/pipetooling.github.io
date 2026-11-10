import { describe, expect, it } from 'vitest'
import { inKindMonths, type InKindLine } from './inKindLedger'
import { monthChoices, monthNotOver, nextCreditMonth } from './inKindMonthChoices'

const keys = (a: Parameters<typeof monthChoices>[0]) => monthChoices(a).map((c) => `${c.key}:${c.amount}${c.fromBank ? ':bank' : ''}`)

describe('monthChoices', () => {
  it('leads with what the bank says when half the rent was paid', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 9375.4 })).toEqual(['suggested:1500:bank', 'whole:3000', 'none:0', 'other:0'])
    expect(monthChoices({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 9375.4 })[0]?.why).toBe('We paid $1,500.00 of the $3,000.00 bill.')
  })
  it('leads with the whole bill when nothing left the bank', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 0, left: 9375.4 })).toEqual(['suggested:3000:bank', 'usual:1500', 'none:0', 'other:0'])
  })
  it('leads with no credit when the whole bill was paid', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 3000, left: 9375.4 })).toEqual(['none:0:bank', 'usual:1500', 'whole:3000', 'other:0'])
  })
  it('offers the usual credit when the bank was not read', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: null, left: 9375.4 })).toEqual(['suggested:1500', 'whole:3000', 'none:0', 'other:0'])
    expect(keys({ monthlyAmount: 500, monthlyDue: null, bankPaid: null, left: 9000 })).toEqual(['suggested:500', 'none:0', 'other:0'])
  })
  it('leads with the usual credit in a month that is not over and has nothing at the bank yet', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 0, left: 9375.4, early: true })).toEqual(['suggested:1500', 'whole:3000', 'none:0', 'other:0'])
    const early = monthChoices({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 0, left: 9375.4, early: true })
    expect(early[0]?.why).toBe('The usual credit.')
    expect(early[1]?.why).toBe('We pay nothing this month.')
  })
  it('still leads with the bank in a month that is not over once money has left', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 9375.4, early: true })).toEqual(['suggested:1500:bank', 'whole:3000', 'none:0', 'other:0'])
  })
  it('never offers more than is left, or the same amount twice', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 375.4 })).toEqual(['suggested:375.4:bank', 'none:0', 'other:0'])
  })
  it('offers only no credit and another amount when nothing is left', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 0 })).toEqual(['none:0', 'other:0'])
  })
})

describe('a month entered early', () => {
  it('knows a month that is not over from one that is', () => {
    expect(monthNotOver('2026-11-01', '2026-11-10')).toBe(true)
    expect(monthNotOver('2026-12-01', '2026-11-10')).toBe(true)
    expect(monthNotOver('2026-10-01', '2026-11-10')).toBe(false)
  })
  it('counts the next credit from this month, or the one after once this month has its line', () => {
    const rent = { monthly_amount: 1500, monthly_due: 3000, starts_on: '2026-05-01', ended_at: null }
    const may = { id: 'may', arrangement_id: 'a1', given_on: '2026-05-20', amount: 3000, memo: 'May', cost_job_id: null, for_month: '2026-05-01', removed_at: null } as unknown as InKindLine
    expect(nextCreditMonth(inKindMonths(rent, [], '2026-05-20'), '2026-05-20')).toBe('2026-05-01')
    expect(nextCreditMonth(inKindMonths(rent, [may], '2026-05-20'), '2026-05-20')).toBe('2026-06-01')
    expect(nextCreditMonth([], '2026-05-20')).toBe('2026-05-01')
  })
})
