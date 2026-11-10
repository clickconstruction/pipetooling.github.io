import { describe, expect, it } from 'vitest'
import { monthChoices } from './inKindMonthChoices'

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
  it('never offers more than is left, or the same amount twice', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 375.4 })).toEqual(['suggested:375.4:bank', 'none:0', 'other:0'])
  })
  it('offers only no credit and another amount when nothing is left', () => {
    expect(keys({ monthlyAmount: 1500, monthlyDue: 3000, bankPaid: 1500, left: 0 })).toEqual(['none:0', 'other:0'])
  })
})
