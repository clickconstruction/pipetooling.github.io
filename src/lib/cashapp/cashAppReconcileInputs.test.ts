import { describe, expect, it } from 'vitest'
import { buildAgentSummary, countLanes, firstReportStarts, laneForMatchResult, personNameOptions, recordedPaymentsForMatch } from './cashAppReconcileInputs'

const stubs = [
  { id: 's1', person_name: 'Paige', period_start: '2026-03-01' },
  { id: 's2', person_name: 'Paige ', period_start: '2026-02-22' },
  { id: 's3', person_name: 'Darren', period_start: '2026-04-05' },
]

describe('recordedPaymentsForMatch', () => {
  it('flattens payments with their person and a calendar day, skipping orphans', () => {
    const out = recordedPaymentsForMatch(stubs, {
      s1: [{ id: 'p1', pay_stub_id: 's1', amount: 500, paid_at: '2026-03-08T15:00:00+00:00', memo: 'cashapp' }],
      zz: [{ id: 'p9', pay_stub_id: 'zz', amount: 1, paid_at: '2026-03-08', memo: null }],
    })
    expect(out).toEqual([{ id: 'p1', personName: 'Paige', amount: 500, paidAt: '2026-03-08', memo: 'cashapp' }])
  })
})

describe('firstReportStarts', () => {
  it('finds each person\'s earliest report and the company floor', () => {
    expect(firstReportStarts(stubs)).toEqual({ byPerson: { Paige: '2026-02-22', Darren: '2026-04-05' }, earliest: '2026-02-22' })
    expect(firstReportStarts([])).toEqual({ byPerson: {}, earliest: null })
  })
})

describe('laneForMatchResult', () => {
  it('files matched → recorded with the rule, before → before_records, expense → expense, else review', () => {
    expect(laneForMatchResult({ txId: 't', outcome: 'matched', rule: 'split', paymentIds: ['a', 'b'], personName: 'X' })).toEqual({ lane: 'recorded', matchRule: 'split', paymentId: 'a' })
    expect(laneForMatchResult({ txId: 't', outcome: 'before_records', personName: 'X', firstReportStart: '2026-03-01', noteKind: 'pay' })).toMatchObject({ lane: 'before_records' })
    expect(laneForMatchResult({ txId: 't', outcome: 'unmatched', personName: 'X', noteKind: 'expense' })).toMatchObject({ lane: 'expense' })
    expect(laneForMatchResult({ txId: 't', outcome: 'unmatched', personName: 'X', noteKind: 'advance' })).toMatchObject({ lane: 'review' })
    expect(laneForMatchResult({ txId: 't', outcome: 'unmatched', personName: null, noteKind: 'pay' })).toMatchObject({ lane: 'review' })
  })
})

describe('personNameOptions', () => {
  it('unions pay config, reports and users, drops test accounts, sorts', () => {
    expect(personNameOptions({ users: [{ name: 'Kyle' }, { name: 'test' }, { name: 'Twin Estimator 1' }, { name: null }], payConfigNames: ['Paige'], stubs })).toEqual(['Darren', 'Kyle', 'Paige'])
  })
})

describe('countLanes + buildAgentSummary', () => {
  it('counts by lane on absolute amounts and renders the agent text', () => {
    const counts = countLanes([
      { lane: 'recorded', amount: -500 },
      { lane: 'review', amount: -300 },
      { lane: 'review', amount: -200 },
    ])
    expect(counts.recorded).toEqual({ count: 1, amount: 500 })
    expect(counts.review).toEqual({ count: 2, amount: 500 })
    const text = buildAgentSummary({
      counts,
      review: [
        { id: '#D-2', occurredDate: '2026-09-02', personName: 'Darren', counterparty: 'Darren Phelps', amount: -200, note: 'Week' },
        { id: '#D-1', occurredDate: '2026-09-01', personName: 'Darren', counterparty: 'Darren Phelps', amount: -300, note: '' },
      ],
      unknownNames: [{ counterparty: 'Cale Yarbrough', count: 2, total: 2908.97 }],
      latestImportDate: '2026-09-11',
    })
    expect(text).toContain('export through 2026-09-11')
    expect(text).toContain('Recorded: 1 · $500.00')
    expect(text).toContain('Cale Yarbrough · 2 payments · $2,908.97')
    expect(text).toContain('Darren · 2 · $500.00')
    expect(text.indexOf('#D-1 · 2026-09-01')).toBeLessThan(text.indexOf('#D-2 · 2026-09-02 · $200.00 · "Week"'))
  })
})
