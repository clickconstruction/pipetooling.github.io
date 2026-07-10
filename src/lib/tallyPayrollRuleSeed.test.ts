import { describe, expect, it } from 'vitest'
import { buildPayrollRuleSeedFromTransaction } from './tallyPayrollRuleSeed'
import { matchAccountingLabelRuleCriteria, type AccountingLabelRuleCriteriaV1 } from './accountingLabelRuleMatch'

describe('buildPayrollRuleSeedFromTransaction', () => {
  it('seeds counterparty-contains with a suggested name', () => {
    expect(buildPayrollRuleSeedFromTransaction({ counterparty_name: 'Gusto', raw: null })).toEqual({
      name: 'Gusto - payroll',
      counterpartyOp: 'contains',
      counterpartyValue: 'Gusto',
    })
  })

  it('seeds BOTH counterparty and description when the transaction has both, naming from the description', () => {
    expect(
      buildPayrollRuleSeedFromTransaction({
        counterparty_name: 'Cash App',
        raw: { bankDescription: 'CASH APP*ISAIAH WHITES' },
      }),
    ).toEqual({
      name: 'CASH APP*ISAIAH WHITES - payroll',
      counterpartyOp: 'contains',
      counterpartyValue: 'Cash App',
      bankOp: 'contains',
      bankValue: 'CASH APP*ISAIAH WHITES',
    })
  })

  it('trims counterparty whitespace', () => {
    const seed = buildPayrollRuleSeedFromTransaction({ counterparty_name: '  Gusto Inc  ', raw: null })
    expect(seed).toEqual({ name: 'Gusto Inc - payroll', counterpartyOp: 'contains', counterpartyValue: 'Gusto Inc' })
  })

  it('falls back to bank description when counterparty is missing or blank', () => {
    for (const cp of [null, '', '   ']) {
      const seed = buildPayrollRuleSeedFromTransaction({
        counterparty_name: cp,
        raw: { bankDescription: 'GUSTO PAY 123456' },
      })
      expect(seed).toEqual({
        name: 'GUSTO PAY 123456 - payroll',
        bankOp: 'contains',
        bankValue: 'GUSTO PAY 123456',
      })
    }
  })

  it('truncates long names but keeps the full match value', () => {
    const long = 'X'.repeat(80)
    const seed = buildPayrollRuleSeedFromTransaction({ counterparty_name: long, raw: null })
    expect(seed!.counterpartyValue).toBe(long)
    expect(seed!.name.length).toBeLessThanOrEqual(60 + ' - payroll'.length)
    expect(seed!.name.endsWith('… - payroll')).toBe(true)
  })

  it('returns null when neither counterparty nor bank description exists', () => {
    expect(buildPayrollRuleSeedFromTransaction({ counterparty_name: null, raw: null })).toBeNull()
    expect(buildPayrollRuleSeedFromTransaction({ counterparty_name: ' ', raw: { other: 1 } })).toBeNull()
  })

  it('round-trips: the seeded criteria always match the originating transaction', () => {
    const txs = [
      { amount: -4210.55, counterparty_name: 'Gusto', raw: { bankDescription: 'GUSTO PAY 88' } },
      { amount: -120, counterparty_name: null, raw: { bankDescription: 'PAYCHEX EIB' } },
    ]
    for (const tx of txs) {
      const seed = buildPayrollRuleSeedFromTransaction(tx)!
      const criteria: AccountingLabelRuleCriteriaV1 = { v: 1 }
      if (seed.counterpartyValue) criteria.counterparty = { op: seed.counterpartyOp!, value: seed.counterpartyValue }
      if (seed.bankValue) criteria.bankDescription = { op: seed.bankOp!, value: seed.bankValue }
      expect(matchAccountingLabelRuleCriteria(tx, criteria)).toBe(true)
    }
  })
})
