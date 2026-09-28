import { describe, expect, it } from 'vitest'
import {
  balanceColor,
  formatSignedWholeDollars,
  itemsTotalByStep,
  ledgerTotalForSteps,
  moneyAmount,
  sumAmounts,
  workflowMoneyTotals,
} from './workflowMoneyTotals'

describe('moneyAmount', () => {
  it('reads a number as itself and null or undefined as 0', () => {
    expect(moneyAmount(1250.5)).toBe(1250.5)
    expect(moneyAmount(-40)).toBe(-40)
    expect(moneyAmount(0)).toBe(0)
    expect(moneyAmount(null)).toBe(0)
    expect(moneyAmount(undefined)).toBe(0)
  })

  it('agrees with both old formulas on everything the database can send', () => {
    const workflowRule = (a: number | null) => a || 0
    const forecastRule = (a: number | null) => Number(a ?? 0)
    for (const a of [0, 1, -1, 0.1, 42000, -18500.75, null]) {
      expect(moneyAmount(a)).toBe(workflowRule(a))
      expect(moneyAmount(a)).toBe(forecastRule(a))
    }
  })

  it('counts NaN as 0 (the Workflow rule) and a numeric string as its number (the Forecast rule)', () => {
    expect(moneyAmount(Number.NaN)).toBe(0)
    expect(moneyAmount('12.5' as unknown as number)).toBe(12.5)
    expect(moneyAmount('junk' as unknown as number)).toBe(0)
  })
})

describe('sumAmounts', () => {
  it('adds the amounts, nulls as 0, credits as negatives', () => {
    expect(sumAmounts([{ amount: 42000 }, { amount: null }, { amount: -2000 }, { amount: 18500 }])).toBe(58500)
  })

  it('is 0 for no rows', () => {
    expect(sumAmounts([])).toBe(0)
  })
})

describe('itemsTotalByStep', () => {
  it('totals each named step and gives a step without items 0', () => {
    expect(
      itemsTotalByStep(['s1', 's2', 's3'], {
        s1: [{ amount: 100 }, { amount: 250.25 }],
        s2: [],
      }),
    ).toEqual({ s1: 350.25, s2: 0, s3: 0 })
  })

  it('leaves out items filed under a step that is not named', () => {
    expect(itemsTotalByStep(['s1'], { s1: [{ amount: 10 }], gone: [{ amount: 999 }] })).toEqual({ s1: 10 })
  })
})

describe('ledgerTotalForSteps', () => {
  it('sums the named steps only', () => {
    expect(ledgerTotalForSteps(['s1', 's3'], { s1: 100, s2: 5000, s3: 25 })).toBe(125)
  })

  it('counts a step with no total as 0', () => {
    expect(ledgerTotalForSteps(['s1', 's2'], { s1: 100 })).toBe(100)
  })
})

describe('workflowMoneyTotals', () => {
  it('margin is (projections − ledger) ÷ projections, balance is the difference', () => {
    const t = workflowMoneyTotals(100000, 62000)
    expect(t.marginPct).toBeCloseTo(38, 10)
    expect(t.balance).toBe(38000)
    expect(t.hasMoney).toBe(true)
    expect(t.marginPct?.toFixed(1)).toBe('38.0')
  })

  it('overspent: a negative margin and a negative balance', () => {
    const t = workflowMoneyTotals(50000, 60000)
    expect(t.marginPct).toBeCloseTo(-20, 10)
    expect(t.balance).toBe(-10000)
  })

  it('no projections: the margin is null (no division), the balance is what was spent, negative', () => {
    const t = workflowMoneyTotals(0, 1200)
    expect(t.marginPct).toBeNull()
    expect(t.balance).toBe(-1200)
    expect(t.hasMoney).toBe(true)
  })

  it('nothing spent: the margin is 100%', () => {
    expect(workflowMoneyTotals(8000, 0).marginPct).toBe(100)
  })

  it('negative projections still divide — the sign of the margin follows the formula', () => {
    // (−1000 − 500) ÷ −1000 = 150%
    expect(workflowMoneyTotals(-1000, 500).marginPct).toBeCloseTo(150, 10)
  })

  it('both totals 0: no money to show', () => {
    expect(workflowMoneyTotals(0, 0)).toEqual({
      projectionsTotal: 0,
      ledgerTotal: 0,
      marginPct: null,
      balance: 0,
      hasMoney: false,
    })
  })

  it('projections that cancel to 0 hide the margin but keep the column while money was spent', () => {
    const t = workflowMoneyTotals(sumAmounts([{ amount: 500 }, { amount: -500 }]), 75)
    expect(t.marginPct).toBeNull()
    expect(t.hasMoney).toBe(true)
  })
})

describe('formatSignedWholeDollars', () => {
  it('signs and groups a whole-dollar figure', () => {
    expect(formatSignedWholeDollars(1234567)).toBe('+$1,234,567')
    expect(formatSignedWholeDollars(-400)).toBe('-$400')
    expect(formatSignedWholeDollars(0)).toBe('$0')
  })

  it('rounds to the dollar', () => {
    expect(formatSignedWholeDollars(1234.5)).toBe('+$1,235')
    expect(formatSignedWholeDollars(1234.49)).toBe('+$1,234')
    expect(formatSignedWholeDollars(-99.6)).toBe('-$100')
  })

  it('keeps the sign of an amount that rounds to $0', () => {
    expect(formatSignedWholeDollars(0.4)).toBe('+$0')
    expect(formatSignedWholeDollars(-0.4)).toBe('-$0')
  })
})

describe('balanceColor', () => {
  it('green above zero, red below', () => {
    expect(balanceColor(12)).toBe('var(--text-green-700)')
    expect(balanceColor(-12)).toBe('var(--text-red-700)')
  })

  it('muted inside the ±0.004 dead band', () => {
    expect(balanceColor(0)).toBe('var(--text-muted)')
    expect(balanceColor(0.004)).toBe('var(--text-muted)')
    expect(balanceColor(-0.004)).toBe('var(--text-muted)')
    expect(balanceColor(0.1 + 0.2 - 0.3)).toBe('var(--text-muted)')
  })

  it('colors just outside the band', () => {
    expect(balanceColor(0.005)).toBe('var(--text-green-700)')
    expect(balanceColor(-0.005)).toBe('var(--text-red-700)')
  })
})
