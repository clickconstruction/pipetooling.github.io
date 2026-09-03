import { describe, expect, it } from 'vitest'
import { buildOverheadPoolTrend } from './overheadPoolTrend'

const labor = (rows: Array<[string, number, number]>) =>
  rows.map(([work_date, officeLaborUsd, bidLaborUsd]) => ({ work_date, officeLaborUsd, bidLaborUsd }))

describe('buildOverheadPoolTrend', () => {
  it('zero-fills every calendar day and sums the three components', () => {
    const t = buildOverheadPoolTrend({
      laborDays: labor([['2026-09-01', 100, 20]]),
      partsUsdByDay: new Map([['2026-09-03', 50]]),
      startYmd: '2026-09-01',
      endYmd: '2026-09-03',
    })
    expect(t.days.map((d) => d.ymd)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(t.days[0]).toMatchObject({ officeLaborUsd: 100, bidLaborUsd: 20, officePartsUsd: 0, totalUsd: 120 })
    expect(t.days[1]).toMatchObject({ officeLaborUsd: 0, bidLaborUsd: 0, officePartsUsd: 0, totalUsd: 0 })
    expect(t.days[2]).toMatchObject({ officePartsUsd: 50, totalUsd: 50 })
    expect(t.totals).toEqual({ officeLaborUsd: 100, bidLaborUsd: 20, officePartsUsd: 50, totalUsd: 170 })
  })

  it('trailing 7-day average uses fewer days at the window start', () => {
    const rows: Array<[string, number, number]> = []
    for (let i = 1; i <= 9; i++) rows.push([`2026-09-0${i}`, 70, 0])
    const t = buildOverheadPoolTrend({
      laborDays: labor(rows),
      partsUsdByDay: new Map([['2026-09-01', 700]]),
      startYmd: '2026-09-01',
      endYmd: '2026-09-09',
    })
    expect(t.days[0]?.trailing7AvgUsd).toBe(770) // just itself
    expect(t.days[1]?.trailing7AvgUsd).toBe(420) // (770 + 70) / 2
    expect(t.days[6]?.trailing7AvgUsd).toBe(170) // (770 + 6×70) / 7
    expect(t.days[8]?.trailing7AvgUsd).toBe(70) // the 700 has aged out
  })

  it('reads up / down / flat against the prior compare span, with a flat band', () => {
    const build = (recentDaily: number, priorDaily: number) => {
      const rows: Array<[string, number, number]> = []
      for (let i = 0; i < 20; i++) rows.push([`2026-08-${String(10 + i).padStart(2, '0')}`, i < 10 ? priorDaily : recentDaily, 0])
      return buildOverheadPoolTrend({
        laborDays: labor(rows),
        partsUsdByDay: new Map(),
        startYmd: '2026-08-10',
        endYmd: '2026-08-29',
        compareDays: 10,
      })
    }
    const up = build(150, 100)
    expect(up.recentAvgDailyUsd).toBe(150)
    expect(up.priorAvgDailyUsd).toBe(100)
    expect(up.deltaPct).toBeCloseTo(0.5)
    expect(up.direction).toBe('up')
    expect(build(60, 100).direction).toBe('down')
    expect(build(103, 100).direction).toBe('flat')
    expect(build(103, 100).deltaPct).toBeCloseTo(0.03)
  })

  it('has no verdict when the prior span carried no cost', () => {
    const t = buildOverheadPoolTrend({
      laborDays: labor([['2026-09-02', 500, 0]]),
      partsUsdByDay: new Map(),
      startYmd: '2026-08-04',
      endYmd: '2026-09-02',
      compareDays: 15,
    })
    expect(t.priorAvgDailyUsd).toBe(0)
    expect(t.deltaPct).toBeNull()
    expect(t.direction).toBe('flat')
  })

  it('tolerates an inverted or empty window', () => {
    const t = buildOverheadPoolTrend({ laborDays: [], partsUsdByDay: new Map(), startYmd: '2026-09-05', endYmd: '2026-09-01' })
    expect(t.days).toEqual([])
    expect(t.totals.totalUsd).toBe(0)
    expect(t.deltaPct).toBeNull()
  })
})
