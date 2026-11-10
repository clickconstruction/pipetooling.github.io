import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildTallyPayrollRuleFlagsToInsert, canEditTallyPayrollRules, type TallyPayrollRuleMatchTx } from './tallyPayrollRules'

function tx(id: string, counterparty: string, amount = -1000): TallyPayrollRuleMatchTx {
  return { mercury_transaction_id: id, amount, counterparty_name: counterparty, raw: null }
}

const payrollRule = {
  id: 'r1',
  enabled: true,
  sort_order: 0,
  criteria: { v: 1, counterparty: { op: 'contains', value: 'gusto' } } as unknown as import('../types/database').Json,
}

describe('canEditTallyPayrollRules', () => {
  it('is the controller and a dev (punch list #188 row 62)', () => {
    for (const role of ['dev', 'controller']) expect(canEditTallyPayrollRules(role), role).toBe(true)
    for (const role of ['master_technician', 'assistant', 'estimator', 'superintendent', 'primary', 'helpers', 'subcontractor', null, undefined]) expect(canEditTallyPayrollRules(role), String(role)).toBe(false)
  })

  it('gates Apply now and the auto-apply with the window that offers them, so the press runs for whoever is shown it', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/JobTally.tsx'), 'utf8')
    expect(page).toContain('const canEditPayrollRules = canEditTallyPayrollRules(role)')
    const apply = page.slice(page.indexOf('const applyPayrollRules = useCallback('), page.indexOf('const tallyTxRowsGlobalFiltered'))
    expect(apply).toContain('if (!canEditPayrollRules) return')
    expect(apply).toContain('if (!canEditPayrollRules || !payrollAutoApply || tallyTxLoading) return')
    expect(apply).not.toMatch(/role [!=]== 'dev'/)
  })
})

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
