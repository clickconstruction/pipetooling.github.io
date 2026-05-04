import { describe, expect, it } from 'vitest'
import {
  accountingRuleEffectiveClauseCount,
  defaultAccountingLabelRuleCriteriaV1,
  matchAccountingLabelRuleCriteria,
  parseAccountingLabelRuleCriteria,
  type AccountingLabelRuleCriteriaV1,
  type AccountingLabelRuleMatchTx,
} from './accountingLabelRuleMatch'

function tx(partial: Partial<AccountingLabelRuleMatchTx>): AccountingLabelRuleMatchTx {
  return {
    amount: 0,
    counterparty_name: null,
    raw: null,
    ...partial,
  }
}

describe('parseAccountingLabelRuleCriteria', () => {
  it('parses v1 with amount bounds', () => {
    const c = parseAccountingLabelRuleCriteria({ v: 1, amount: { min: 10, max: 100 } })
    expect(c).toEqual({ v: 1, amount: { min: 10, max: 100 } })
  })

  it('rejects wrong version', () => {
    expect(parseAccountingLabelRuleCriteria({ v: 2 })).toBe(null)
  })

  it('rejects bad amount types', () => {
    expect(parseAccountingLabelRuleCriteria({ v: 1, amount: { min: 'x' } })).toBe(null)
  })
})

describe('accountingRuleEffectiveClauseCount', () => {
  it('counts only substantive clauses', () => {
    const empty: AccountingLabelRuleCriteriaV1 = { v: 1, counterparty: { op: 'contains', value: '  ' } }
    expect(accountingRuleEffectiveClauseCount(empty)).toBe(0)
    expect(
      accountingRuleEffectiveClauseCount({
        v: 1,
        counterparty: { op: 'equals', value: 'Acme' },
        amount: { min: 1 },
      }),
    ).toBe(2)
  })
})

describe('matchAccountingLabelRuleCriteria', () => {
  it('returns false when no substantive clauses', () => {
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 50 }), { v: 1 })).toBe(false)
    expect(
      matchAccountingLabelRuleCriteria(tx({ amount: 50 }), defaultAccountingLabelRuleCriteriaV1()),
    ).toBe(false)
  })

  it('matches amount inclusive bounds', () => {
    const c: AccountingLabelRuleCriteriaV1 = { v: 1, amount: { min: 10, max: 20 } }
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 10 }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 20 }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 9.99 }), c)).toBe(false)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 20.01 }), c)).toBe(false)
  })

  it('normalizes amount bounds when min/max fields are swapped (negatives)', () => {
    const c: AccountingLabelRuleCriteriaV1 = { v: 1, amount: { min: -20, max: -120 } }
    expect(matchAccountingLabelRuleCriteria(tx({ amount: -37.32 }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: -121 }), c)).toBe(false)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: -10 }), c)).toBe(false)
  })

  it('normalizes amount bounds when min/max fields are swapped (positives)', () => {
    const c: AccountingLabelRuleCriteriaV1 = { v: 1, amount: { min: 100, max: 10 } }
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 50 }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 9 }), c)).toBe(false)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 101 }), c)).toBe(false)
  })

  it('counterparty contains is case-insensitive', () => {
    const c: AccountingLabelRuleCriteriaV1 = {
      v: 1,
      counterparty: { op: 'contains', value: 'HOme DEpot' },
    }
    expect(matchAccountingLabelRuleCriteria(tx({ counterparty_name: 'THE HOME DEPOT #12' }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ counterparty_name: 'Lowes' }), c)).toBe(false)
  })

  it('counterparty equals handles null as empty', () => {
    const c: AccountingLabelRuleCriteriaV1 = { v: 1, counterparty: { op: 'equals', value: '' } }
    expect(accountingRuleEffectiveClauseCount(c)).toBe(0)
  })

  it('bankDescription uses raw bankDescription', () => {
    const c: AccountingLabelRuleCriteriaV1 = {
      v: 1,
      bankDescription: { op: 'contains', value: 'stripe' },
    }
    expect(
      matchAccountingLabelRuleCriteria(
        tx({ raw: { bankDescription: 'Payout from STRIPE' } }),
        c,
      ),
    ).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ raw: null }), c)).toBe(false)
  })

  it('requires all substantive clauses to match', () => {
    const c: AccountingLabelRuleCriteriaV1 = {
      v: 1,
      amount: { min: 0 },
      counterparty: { op: 'contains', value: 'a' },
    }
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 5, counterparty_name: 'Acme' }), c)).toBe(true)
    expect(matchAccountingLabelRuleCriteria(tx({ amount: 5, counterparty_name: 'Other' }), c)).toBe(false)
  })

  it('unicode counterparty', () => {
    const c: AccountingLabelRuleCriteriaV1 = {
      v: 1,
      counterparty: { op: 'contains', value: 'über' },
    }
    expect(matchAccountingLabelRuleCriteria(tx({ counterparty_name: 'Shop Über Alles' }), c)).toBe(true)
  })
})
