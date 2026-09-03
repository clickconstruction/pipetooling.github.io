import { describe, expect, it } from 'vitest'
import { buildCashForecast, upcomingFridays } from './cashForecast'

describe('buildCashForecast', () => {
  it('steps down on bills, up on receipts, drains daily, and finds the lowest point', () => {
    const f = buildCashForecast({
      todayYmd: '2026-09-03',
      daysAhead: 5,
      cashTodayUsd: 10_000,
      floorUsd: 5_000,
      dailyDrainUsd: 100,
      events: [
        { ymd: '2026-09-05', usd: 6_000, label: 'supply', kind: 'bill' },
        { ymd: '2026-09-07', usd: 8_000, label: 'draw', kind: 'receipt' },
        { ymd: '2026-09-01', usd: 500, label: 'overdue', kind: 'bill' }, // past → first forecast day
        { ymd: '2026-10-01', usd: 999, label: 'beyond window', kind: 'bill' },
      ],
    })
    expect(f.days.map((d) => d.cashUsd)).toEqual([9_400, 3_300, 3_200, 11_100, 11_000])
    expect(f.lowest).toEqual({ ymd: '2026-09-06', offset: 3, cashUsd: 3_200 })
    expect(f.clearsFloor).toBe(false)
    expect(f.daysUnderFloor).toBe(2)
    expect(f.totalBillsUsd).toBe(6_500)
    expect(f.totalReceiptsUsd).toBe(8_000)
    expect(f.endUsd).toBe(11_000)
  })

  it('clears the floor when nothing dips under it', () => {
    const f = buildCashForecast({ todayYmd: '2026-09-03', daysAhead: 3, cashTodayUsd: 1_000, floorUsd: 500, events: [] })
    expect(f.clearsFloor).toBe(true)
    expect(f.lowest.cashUsd).toBe(1_000)
  })
})

describe('upcomingFridays', () => {
  it('lists the Fridays after today within the window', () => {
    // 2026-09-03 is a Thursday.
    expect(upcomingFridays('2026-09-03', 15)).toEqual(['2026-09-04', '2026-09-11', '2026-09-18'])
  })
})
