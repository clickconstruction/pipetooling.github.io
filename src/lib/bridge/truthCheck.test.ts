import { describe, expect, it } from 'vitest'
import { buildNetPositionHistory } from './netPosition'
import { buildTruthCheck, truthCheckVerdictText } from './truthCheck'

const m = (rows: Array<[string, number]>) => new Map(rows)
const empty = new Map<string, number>()

const base = {
  windowStart: '2026-09-01',
  todayYmd: '2026-09-05',
  earnedByDay: empty,
  directByDay: empty,
  overheadByDay: empty,
  bankFlowByDay: empty,
  invoicesSentByDay: empty,
  paymentsReceivedByDay: empty,
  supplyDatedByDay: empty,
  supplyPaidByDay: empty,
  pendingClosedHours: 0,
  pendingClosedSessions: 0,
  fieldLaborUsd: 0,
  fieldHoursWindow: 0,
  assumedHalfEarnedUsd: 0,
  assumedHalfJobs: 0,
  noContractJobs: 0,
  unattributedNoncard: null,
  unlinkedCard: null,
}

describe('buildTruthCheck', () => {
  it('reconciles to the exact net position change the chart draws, over the same days', () => {
    const flows = {
      bankFlowByDay: m([['2026-09-01', 999], ['2026-09-02', -4000], ['2026-09-04', 12_000]]),
      invoicesSentByDay: m([['2026-09-03', 20_000]]),
      paymentsReceivedByDay: m([['2026-09-04', 12_000]]),
      supplyDatedByDay: m([['2026-09-02', 3000]]),
      supplyPaidByDay: m([['2026-09-05', 1000]]),
    }
    const history = buildNetPositionHistory({ todayYmd: '2026-09-05', daysBack: 4, cashTodayUsd: 50_000, arTodayUsd: 30_000, apTodayUsd: 10_000, ...flows })
    const chartDelta = history[history.length - 1]!.netUsd - history[0]!.netUsd
    const t = buildTruthCheck({ ...base, ...flows, earnedByDay: m([['2026-09-03', 25_000]]), directByDay: m([['2026-09-02', 6000]]), overheadByDay: m([['2026-09-04', 1000]]) })
    expect(t.net.deltaUsd).toBe(chartDelta)
    // The 999 on the window's first day is outside the chart's moving days, like the chart itself.
    expect(t.net.bankFlowUsd).toBe(8000)
    expect(t.days).toBe(4)
  })

  it('splits the gap exactly into billing lag + costs the paper does not see', () => {
    const t = buildTruthCheck({
      ...base,
      earnedByDay: m([['2026-09-02', 100_000]]),
      directByDay: m([['2026-09-02', 40_000]]),
      overheadByDay: m([['2026-09-03', 10_000]]),
      invoicesSentByDay: m([['2026-09-03', 30_000]]),
      paymentsReceivedByDay: m([['2026-09-04', 20_000]]),
      bankFlowByDay: m([['2026-09-04', 20_000], ['2026-09-05', -65_000]]),
      supplyDatedByDay: m([['2026-09-02', 8000]]),
      supplyPaidByDay: m([['2026-09-05', 5000]]),
    })
    expect(t.paper.profitUsd).toBe(50_000)
    // netCosts = 20k − (−45k) + 8k − 5k = 68k; delta = 30k − 68k = −38k
    expect(t.net.costsUsd).toBe(68_000)
    expect(t.net.deltaUsd).toBe(-38_000)
    expect(t.gapUsd).toBe(88_000)
    expect(t.billingLagUsd).toBe(70_000)
    expect(t.costGapUsd).toBe(18_000)
    expect(t.billingLagUsd + t.costGapUsd).toBe(t.gapUsd)
    expect(t.costGapShare).toBeCloseTo(0.36)
    expect(t.verdict).toBe('costs_disagree')
    expect(truthCheckVerdictText(t)).toContain('Costs disagree by $18.0k (36%)')
  })

  it('reads billing lag when costs agree and the profit sits in unbilled work', () => {
    const t = buildTruthCheck({
      ...base,
      earnedByDay: m([['2026-09-02', 100_000]]),
      directByDay: m([['2026-09-02', 45_000]]),
      overheadByDay: m([['2026-09-03', 5000]]),
      invoicesSentByDay: m([['2026-09-03', 40_000]]),
      bankFlowByDay: m([['2026-09-05', -52_000]]),
    })
    expect(t.paper.profitUsd).toBe(50_000)
    expect(t.costGapUsd).toBe(2000)
    expect(t.billingLagUsd).toBe(60_000)
    expect(t.verdict).toBe('billing_lag')
    expect(truthCheckVerdictText(t)).toContain('$60.0k earned but not invoiced')
  })

  it('agrees when both sides tell the same story', () => {
    const t = buildTruthCheck({
      ...base,
      earnedByDay: m([['2026-09-02', 100_000]]),
      directByDay: m([['2026-09-02', 45_000]]),
      overheadByDay: m([['2026-09-03', 5000]]),
      invoicesSentByDay: m([['2026-09-03', 98_000]]),
      bankFlowByDay: m([['2026-09-05', -49_000]]),
    })
    expect(t.verdict).toBe('agree')
    expect(truthCheckVerdictText(t)).toContain('steer by the profit rate')
  })

  it('calls a window with almost no costs too thin to judge', () => {
    const t = buildTruthCheck({ ...base, earnedByDay: m([['2026-09-02', 2000]]), directByDay: m([['2026-09-02', 500]]) })
    expect(t.verdict).toBe('thin')
    expect(t.costGapShare).toBe(1)
  })

  it('sizes the signals from what the loader knows and leaves the rest as counts', () => {
    const t = buildTruthCheck({
      ...base,
      earnedByDay: m([['2026-09-02', 100_000]]),
      directByDay: m([['2026-09-02', 45_000]]),
      overheadByDay: m([['2026-09-03', 5000]]),
      pendingClosedHours: 186,
      pendingClosedSessions: 39,
      fieldLaborUsd: 51_400,
      fieldHoursWindow: 2000,
      assumedHalfEarnedUsd: 12_345,
      assumedHalfJobs: 9,
      noContractJobs: 6,
      unattributedNoncard: 1139,
      unlinkedCard: 128,
    })
    expect(t.signals.map((s) => s.key)).toEqual(['unapproved_hours', 'unsorted_transfers', 'unlinked_card', 'assumed_half', 'no_contract'])
    const hours = t.signals[0]!
    expect(hours.usd).toBeCloseTo(186 * 25.7)
    expect(hours.detail).toContain('39 sessions')
    expect(t.signals[1]!.label).toBe('1,139 bank transfers unsorted')
    expect(t.signals[1]!.usd).toBeNull()
    expect(t.signals[3]!.usd).toBe(12_345)
    expect(t.signals[4]!.label).toBe('6 worked jobs with no contract $')
  })

  it('reports no signals on clean inputs and estimates no wage without approved hours', () => {
    const clean = buildTruthCheck({ ...base, earnedByDay: m([['2026-09-02', 10_000]]), directByDay: m([['2026-09-02', 6000]]) })
    expect(clean.signals).toEqual([])
    const noWage = buildTruthCheck({ ...base, pendingClosedHours: 10, pendingClosedSessions: 2 })
    expect(noWage.signals[0]).toMatchObject({ key: 'unapproved_hours', usd: null, count: 2 })
  })
})
