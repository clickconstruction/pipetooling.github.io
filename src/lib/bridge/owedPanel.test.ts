import { describe, expect, it } from 'vitest'
import { buildOwedPanel } from './owedPanel'

describe('buildOwedPanel', () => {
  it('buckets owed to you by age and owed by you by due week, and walks the balance', () => {
    const p = buildOwedPanel({
      todayYmd: '2026-10-10',
      cashUsd: 390,
      ar: {
        total: 332_000,
        count: 5,
        items: [
          { amount: 86_000, dateYmd: '2026-10-01' },
          { amount: 104_000, dateYmd: '2026-08-25' },
          { amount: 71_000, dateYmd: '2026-07-25' },
          { amount: 38_000, dateYmd: '2026-06-01' },
          { amount: 33_000, dateYmd: null },
        ],
      },
      arCollections: { total: 17_500, count: 4 },
      ap: { total: 251_000, supplyTotal: 118_000, payrollTotal: 48_000, subLaborTotal: 63_000, upcomingTotal: 22_000 },
      unbilled: { total: 233_000, count: 15 },
      bills: [
        { ymd: '2026-10-10', usd: 17_090, label: 'supply' },
        { ymd: '2026-10-16', usd: 7448, label: 'payroll' },
        { ymd: '2026-10-23', usd: 54_100, label: 'sub labor' },
        { ymd: '2026-11-20', usd: 11_266, label: 'supply' },
      ],
      noContractJobs: 6,
      noPctJobs: 36,
      pendingClosedHours: 585,
      unattributedNoncard: 1151,
      dayLabel: (y) => y,
    })
    expect(p.aging.map((b) => [b.label, b.usd, b.count])).toEqual([
      ['current', 86_000, 1],
      ['31–60 days', 104_000, 1],
      ['61–90 days', 71_000, 1],
      ['90+ days', 38_000, 1],
      ['no date', 33_000, 1],
    ])
    expect(p.due.map((b) => [b.label, b.usd])).toEqual([
      ['this week', 24_538],
      ['next week', 54_100],
      ['weeks 3–4', 0],
      ['later', 11_266],
    ])
    expect(p.lateLine).toBe('Late: $213k on 3 invoices; the oldest $38.0k is past 90 days. Due from you in two weeks: $78.6k, against $390 in the bank.')
    expect(p.waterfall.map((b) => [b.label, b.usd])).toEqual([
      ['cash', 390],
      ['owed to you', 332_000],
      ['supply bills', -118_000],
      ['payroll owed', -70_000],
      ['sub labor', -63_000],
      ['net position', 81_390],
      ['not yet billed', 233_000],
      ['once billed', 314_390],
    ])
    expect(p.netLine).toBe('Net position: cash $390 + owed to you $332k − owed by you $251k = +$81.4k. With the finished work billed it would be +$314k.')
    expect(p.sources.map((s) => s.tone)).toEqual(['amber', 'amber', 'amber', 'amber', 'amber', 'amber'])
    expect(p.sources[2]!.risk).toBe('6 open jobs have no contract price, so finished work there reads $0; 36 have no %')
    expect(p.closing).toBe('The gap between +$81.4k and +$314k is Bill’s pile. The gap between +$81.4k and $390 in the bank is Collect’s.')
  })
})
