import { describe, expect, it } from 'vitest'
import { buildNetPositionHistory, cashTodayFromAsOf } from './netPosition'

const m = (rows: Array<[string, number]>) => new Map(rows)

describe('cashTodayFromAsOf', () => {
  it('rolls a typed figure forward through the bank flows after the as-of day', () => {
    const flows = m([['2026-09-01', -1000], ['2026-09-02', 5000], ['2026-09-03', -200]])
    expect(cashTodayFromAsOf({ cashAsOfUsd: 10000, asOfYmd: '2026-09-01', todayYmd: '2026-09-03', bankFlowByDay: flows })).toBe(14800)
    expect(cashTodayFromAsOf({ cashAsOfUsd: 10000, asOfYmd: '2026-09-03', todayYmd: '2026-09-03', bankFlowByDay: flows })).toBe(10000)
    expect(cashTodayFromAsOf({ cashAsOfUsd: 10000, asOfYmd: '2026-09-05', todayYmd: '2026-09-03', bankFlowByDay: flows })).toBe(10000)
  })
})

describe('buildNetPositionHistory', () => {
  it('reconstructs cash, AR, and AP backwards from today using dated flows', () => {
    const h = buildNetPositionHistory({
      todayYmd: '2026-09-03',
      daysBack: 2,
      cashTodayUsd: 100_000,
      arTodayUsd: 50_000,
      apTodayUsd: 20_000,
      bankFlowByDay: m([['2026-09-03', -5000], ['2026-09-02', 8000]]),
      invoicesSentByDay: m([['2026-09-03', 12_000]]),
      paymentsReceivedByDay: m([['2026-09-02', 8000]]),
      supplyDatedByDay: m([['2026-09-02', 3000]]),
      supplyPaidByDay: m([['2026-09-03', 5000]]),
    })
    expect(h.map((d) => d.offset)).toEqual([-2, -1, 0])
    expect(h[2]).toMatchObject({ ymd: '2026-09-03', cashUsd: 100_000, arUsd: 50_000, apUsd: 20_000, netUsd: 130_000 })
    // Sep 2 = today minus Sep 3's flows: cash +5000 (undo the payment), AR −12000 (undo the invoice), AP +5000 (undo the supply payment)
    expect(h[1]).toMatchObject({ ymd: '2026-09-02', cashUsd: 105_000, arUsd: 38_000, apUsd: 25_000, netUsd: 118_000 })
    // Sep 1 = Sep 2 minus Sep 2's flows: cash −8000 (undo the deposit), AR +8000 (undo the payment received), AP −3000 (undo the dated invoice)
    expect(h[0]).toMatchObject({ ymd: '2026-09-01', cashUsd: 97_000, arUsd: 46_000, apUsd: 22_000, netUsd: 121_000 })
  })

  it('with no flows the line is flat at today', () => {
    const h = buildNetPositionHistory({ todayYmd: '2026-09-03', daysBack: 3, cashTodayUsd: 1, arTodayUsd: 2, apTodayUsd: 3, bankFlowByDay: new Map(), invoicesSentByDay: new Map(), paymentsReceivedByDay: new Map(), supplyDatedByDay: new Map(), supplyPaidByDay: new Map() })
    expect(h.every((d) => d.netUsd === 0)).toBe(true)
    expect(h).toHaveLength(4)
  })
})
