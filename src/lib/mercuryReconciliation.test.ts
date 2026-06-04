import { describe, expect, it } from 'vitest'
import {
  classifyCurrent,
  classifyMonth,
  monthBalanceInfoOff,
  summarizeAccount,
  summarizeResult,
  formatSignedUsd,
  type ReconAccount,
  type ReconCurrent,
  type ReconMonth,
} from './mercuryReconciliation'

function month(over: Partial<ReconMonth> = {}): ReconMonth {
  return {
    period: '2026-05',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    statementCount: 10,
    presentCount: 10,
    missingCount: 0,
    missingValue: 0,
    missingSample: [],
    endingBalance: 1000,
    prevEndingBalance: 900,
    statementNet: 100,
    statementTxSum: 100,
    ...over,
  }
}

function current(over: Partial<ReconCurrent> = {}): ReconCurrent {
  return {
    mercuryCurrentBalance: 1000,
    availableBalance: 1000,
    latestStatementEnd: '2026-05-31',
    expectedCurrent: 1000,
    delta: 0,
    ...over,
  }
}

describe('classifyMonth', () => {
  it('ok when every statement txn is present', () => {
    expect(classifyMonth(month())).toBe('ok')
  })
  it('missing when any statement txn is absent from the books', () => {
    expect(classifyMonth(month({ presentCount: 8, missingCount: 2 }))).toBe('missing')
  })
  it('stays ok when all present even if the balance delta differs (boundary timing)', () => {
    expect(classifyMonth(month({ statementNet: 100, statementTxSum: 75 }))).toBe('ok')
  })
})

describe('monthBalanceInfoOff', () => {
  it('flags a statement whose listed txns do not sum to its balance change', () => {
    expect(monthBalanceInfoOff(month({ statementNet: 100, statementTxSum: 75 }))).toBe(true)
  })
  it('ignores tiny float noise within epsilon', () => {
    expect(monthBalanceInfoOff(month({ statementNet: 100, statementTxSum: 100.004 }))).toBe(false)
  })
  it('false when there is no prior statement (statementNet null)', () => {
    expect(monthBalanceInfoOff(month({ statementNet: null, statementTxSum: 12345 }))).toBe(false)
  })
})

describe('classifyCurrent', () => {
  it('ok when live balance matches expected', () => {
    expect(classifyCurrent(current({ delta: 0 }))).toBe('ok')
  })
  it('drift when delta exceeds epsilon', () => {
    expect(classifyCurrent(current({ delta: -42.5 }))).toBe('drift')
  })
  it('unknown when there is no anchor', () => {
    expect(classifyCurrent(current({ expectedCurrent: null, delta: null }))).toBe('unknown')
  })
})

describe('summarizeAccount', () => {
  function acct(over: Partial<ReconAccount> = {}): ReconAccount {
    return {
      id: 'a1',
      name: 'Checking',
      currentBalance: 1000,
      availableBalance: 1000,
      months: [month()],
      current: current(),
      ...over,
    }
  }

  it('ok when every month and the current period reconcile', () => {
    expect(summarizeAccount(acct()).status).toBe('ok')
  })
  it('flags attention + totals when a month has missing txns', () => {
    const s = summarizeAccount(acct({ months: [month(), month({ missingCount: 3, missingValue: -150 })] }))
    expect(s.status).toBe('attention')
    expect(s.totalMissing).toBe(3)
    expect(s.totalMissingValue).toBe(-150)
    expect(s.monthsWithIssues).toBe(1)
  })
  it('does NOT flag attention on current-period drift alone (informational)', () => {
    const s = summarizeAccount(acct({ current: current({ delta: 99 }) }))
    expect(s.status).toBe('ok')
    expect(s.currentStatus).toBe('drift')
    expect(s.totalMissing).toBe(0)
  })
  it('ok with no months', () => {
    expect(summarizeAccount(acct({ months: [] })).status).toBe('ok')
  })
})

describe('summarizeResult', () => {
  it('counts accounts needing attention and total missing', () => {
    const clean: ReconAccount = { id: 'a', name: 'A', currentBalance: 0, availableBalance: 0, months: [month()], current: current() }
    const dirty: ReconAccount = { id: 'b', name: 'B', currentBalance: 0, availableBalance: 0, months: [month({ missingCount: 2 })], current: current() }
    const r = summarizeResult({ ok: true, generatedAt: '', monthsBack: 6, accounts: [clean, dirty] })
    expect(r.accountsWithIssues).toBe(1)
    expect(r.totalMissing).toBe(2)
  })
})

describe('formatSignedUsd', () => {
  it('formats positive and negative with two decimals', () => {
    expect(formatSignedUsd(1234.5)).toBe('$1,234.50')
    expect(formatSignedUsd(-96.1)).toBe('-$96.10')
    expect(formatSignedUsd(0)).toBe('$0.00')
  })
})
