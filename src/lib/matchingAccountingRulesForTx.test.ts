import { describe, it, expect } from 'vitest'
import { matchingAccountingRulesForTx, type AccountingRuleForMatch } from './accountingLabelRuleMatch'

const rules: AccountingRuleForMatch[] = [
  { id: 'r2', name: 'Shell fuel', label_id: 'lFuel', enabled: true, sort_order: 20, criteria: { v: 1, counterparty: { op: 'contains', value: 'shell' } } },
  { id: 'r1', name: 'Big debits', label_id: 'lBig', enabled: true, sort_order: 10, criteria: { v: 1, amount: { min: -100000, max: -100 } } },
  { id: 'r3', name: 'Disabled', label_id: 'lX', enabled: false, sort_order: 5, criteria: { v: 1, counterparty: { op: 'contains', value: 'shell' } } },
  { id: 'r4', name: 'No clauses', label_id: 'lY', enabled: true, sort_order: 1, criteria: { v: 1 } },
]

describe('matchingAccountingRulesForTx', () => {
  it('returns matches in engine order (sort_order, id) and flags the first', () => {
    const tx = { amount: -250, counterparty_name: 'Shell Oil', raw: {} }
    const out = matchingAccountingRulesForTx(tx, rules)
    // r1 (sort 10, amount -250 in [-100000,-100]) then r2 (sort 20, counterparty contains shell)
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(out[0]).toMatchObject({ id: 'r1', isFirstMatch: true })
    expect(out[1]).toMatchObject({ id: 'r2', isFirstMatch: false })
  })

  it('skips disabled rules and rules with no substantive clauses', () => {
    const tx = { amount: -5, counterparty_name: 'Shell', raw: {} }
    const out = matchingAccountingRulesForTx(tx, rules)
    // amount -5 not in [-100000,-100]; r3 disabled; r4 no clauses → only r2 (counterparty)
    expect(out.map((r) => r.id)).toEqual(['r2'])
    expect(out[0]?.isFirstMatch).toBe(true)
  })

  it('returns empty when nothing matches', () => {
    const tx = { amount: -5, counterparty_name: 'Home Depot', raw: {} }
    expect(matchingAccountingRulesForTx(tx, rules)).toEqual([])
  })
})
