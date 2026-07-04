import { describe, expect, it } from 'vitest'
import { buildTallyPayrollRuleFlagsToInsert, type TallyPayrollRuleMatchTx } from './tallyPayrollRules'

function tx(id: string, counterparty: string, amount = -1000): TallyPayrollRuleMatchTx {
  return { mercury_transaction_id: id, amount, counterparty_name: counterparty, raw: null }
}

const payrollRule = {
  id: 'r1',
  enabled: true,
  sort_order: 0,
  criteria: { v: 1, counterparty: { op: 'contains', value: 'gusto' } } as unknown as import('../types/database').Json,
}

describe('buildTallyPayrollRuleFlagsToInsert', () => {
  it('flags matching, undecided, split-free transactions', () => {
    const res = buildTallyPayrollRuleFlagsToInsert({
      txs: [tx('t1', 'Gusto Payroll'), tx('t2', 'Home Depot')],
      rules: [payrollRule],
      decidedTxIds: new Set(),
      txIdsWithJobSplits: new Set(),
    })
    expect(res.toFlag).toEqual([{ mercury_transaction_id: 't1', rule_id: 'r1' }])
    expect(res.blockedByJobSplits).toEqual([])
  })

  it('skips transactions that already have a flag decision (manual override wins)', () => {
    const res = buildTallyPayrollRuleFlagsToInsert({
      txs: [tx('t1', 'Gusto Payroll')],
      rules: [payrollRule],
      decidedTxIds: new Set(['t1']),
      txIdsWithJobSplits: new Set(),
    })
    expect(res.toFlag).toEqual([])
  })

  it('routes matched-but-split transactions to blockedByJobSplits instead of flagging', () => {
    const res = buildTallyPayrollRuleFlagsToInsert({
      txs: [tx('t1', 'Gusto Payroll')],
      rules: [payrollRule],
      decidedTxIds: new Set(),
      txIdsWithJobSplits: new Set(['t1']),
    })
    expect(res.toFlag).toEqual([])
    expect(res.blockedByJobSplits).toEqual(['t1'])
  })

  it('ignores disabled rules and empty-criteria rules; first enabled match wins', () => {
    const disabled = { ...payrollRule, id: 'r0', enabled: false }
    const empty = { id: 'r2', enabled: true, sort_order: -1, criteria: { v: 1 } as unknown as import('../types/database').Json }
    const res = buildTallyPayrollRuleFlagsToInsert({
      txs: [tx('t1', 'Gusto Payroll')],
      rules: [disabled, empty, payrollRule],
      decidedTxIds: new Set(),
      txIdsWithJobSplits: new Set(),
    })
    expect(res.toFlag).toEqual([{ mercury_transaction_id: 't1', rule_id: 'r1' }])
  })
})
