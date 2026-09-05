import { describe, expect, it } from 'vitest'
import { buildJobSummaryScatter } from './jobSummaryScatter'
import type { JobSummaryEnrichedRow } from './jobSummaryLedgerView'

const pt = (id: string, revenueUsd: number, trueMarginPct: number | null, trade: string, hours = 10): JobSummaryEnrichedRow =>
  ({
    row: { job: { id, hcp_number: id, job_name: `Job ${id}`, pct_complete: 100, service_type_id: trade, serviceType: { name: trade } }, subLaborCost: 0, teamLaborCost: 0, partsCost: 0, totalBill: revenueUsd },
    pct: 100,
    pctSource: 'paid-invoices',
    finished: true,
    contractUsd: revenueUsd,
    revenueUsd,
    laborUsd: 0,
    subsUsd: 0,
    partsUsd: 0,
    grossUsd: revenueUsd,
    marginPct: 100,
    hoursInWindow: hours,
    daysInWindow: 1,
    priorHours: 0,
    overheadUsd: 0,
    overheadLines: [],
    trueProfitUsd: trueMarginPct == null ? null : (revenueUsd * trueMarginPct) / 100,
    trueMarginPct,
    revenuePerHourUsd: revenueUsd / hours,
    lastWorkedYmd: null,
    flags: [],
  }) as JobSummaryEnrichedRow

describe('scatter (v2.2826)', () => {
  const rows = [
    pt('a', 1000, 60, 'Plumbing'),
    pt('b', 5000, 20, 'Plumbing'),
    pt('c', 800, 50, 'Electrical'),
    pt('d', 9000, 45, 'Gas'),
    pt('e', 300, 10, 'Electrical'),
    pt('f', 2000, null, 'Plumbing'),
  ]
  it('keeps jobs with a known margin, ranks series by count in fixed hue order, and finds big-and-thin', () => {
    const s = buildJobSummaryScatter(rows, 'trade')
    expect(s.points.length).toBe(5)
    expect(s.skipped).toBe(1)
    // ties on count sort by label, so Electrical takes the first hue
    expect(s.series.map((x) => [x.label, x.count, x.color])).toEqual([
      ['Electrical', 2, '#2563eb'],
      ['Plumbing', 2, '#d97706'],
      ['Gas', 1, '#0891b2'],
    ])
    expect(s.medianRevenueUsd).toBe(1000)
    expect(s.medianMarginPct).toBe(45)
    // above 1000 revenue and under 45% margin → only b; shortfall = 5000 × 25% = 1250
    expect(s.bigThin.map((p) => [p.number, p.shortfallUsd])).toEqual([['b', 1250]])
  })

  it('folds a seventh series into Other', () => {
    const many = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].flatMap((t, i) => Array.from({ length: 8 - i }, (_, k) => pt(`${t}-${k}`, 1000, 40, t)))
    const s = buildJobSummaryScatter(many, 'trade')
    expect(s.series.length).toBe(7)
    expect(s.series[6]).toMatchObject({ key: '__other', label: 'Other', count: 2 })
    expect(s.points.filter((p) => p.seriesKey === '__other').length).toBe(2)
  })
})
