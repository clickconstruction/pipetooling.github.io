import { describe, expect, it } from 'vitest'
import {
  buildOverheadPoolDayIndex,
  overheadPartsCounterparty,
  overheadPoolCounterpartyNote,
  overheadPoolDominantCategory,
  overheadPoolPersonNote,
  overheadPoolTypicalLabel,
} from './overheadPoolDayLines'
import { buildOverheadPoolTrend } from './overheadPoolTrend'
import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'
import type { OverheadPoolLaborInput } from './overheadPoolDayLines'

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const ymds = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
const labor: OverheadPoolLaborInput[] = [
  { workDate: '2026-09-01', userName: 'Taunya', bucket: 'office', hours: 8, laborUsd: 208, sessionId: 's1', clockedInAt: '2026-09-01T13:00:00Z', clockedOutAt: '2026-09-01T21:00:00Z', approved: true },
  { workDate: '2026-09-01', userName: 'Wendi', bucket: 'bid', hours: 3, laborUsd: 96, sessionId: 's2', bidId: 'b1', approved: false },
  { workDate: '2026-09-02', userName: 'Taunya', bucket: 'office', hours: 11, laborUsd: 286, sessionId: 's3' },
  { workDate: '2026-09-02', userName: 'Taunya', bucket: 'office', hours: 0, laborUsd: 0, sessionId: 's-zero' }, // zero hours: dropped
  { workDate: '2026-09-04', userName: 'Wendi', bucket: 'office', hours: 6, laborUsd: 192, sessionId: 's4' },
]
const part = (over: Partial<OverheadPartsDetailLine>): OverheadPartsDetailLine => ({ source: 'mercury', amountUsd: 0, label: '', sortKey: 'k', mercuryDebitCardId: null, mercuryTransactionId: null, ...over })
const parts = [
  { workDate: '2026-09-01', line: part({ source: 'supply', amountUsd: 1180.55, label: 'Ferguson · #4471', sortKey: 'supply:1' }) },
  { workDate: '2026-09-03', line: part({ source: 'supply', amountUsd: 133.77, label: 'Ferguson · #4490', sortKey: 'supply:2' }) },
  { workDate: '2026-09-03', line: part({ source: 'mercury', amountUsd: 62.1, label: 'Shell', sortKey: 'm:1', mercuryTransactionId: 'tx-shell', mercuryDebitCardId: 'card-w' }) },
  { workDate: '2026-09-03', line: part({ source: 'mercury', amountUsd: 2000, label: 'Transfer to Savings', sortKey: 'm:2', mercuryTransactionId: 'tx-transfer' }) },
  { workDate: '2026-09-05', line: part({ source: 'tally', amountUsd: 40, label: 'Lav — 1/2" copper', sortKey: 'tally:1' }) },
]
const bucketByTxId = new Map<string, 'internal_transfer' | 'fuel_gas'>([
  ['tx-transfer', 'internal_transfer'],
  ['tx-shell', 'fuel_gas'],
])

describe('buildOverheadPoolDayIndex', () => {
  const index = buildOverheadPoolDayIndex({ labor, parts, bucketByTxId, ymds })

  it('files every line under its day and category, drops zero-hour sessions, and marks internal transfers not counted', () => {
    const d1 = index.byYmd.get('2026-09-01')!
    expect(d1.office.map((l) => l.userName)).toEqual(['Taunya'])
    expect(d1.bid[0]).toMatchObject({ userName: 'Wendi', awaitingApproval: true, bidId: 'b1' })
    expect(d1.parts[0]).toMatchObject({ source: 'supply', counterparty: 'Ferguson', counted: true })
    expect(d1.sums).toEqual({ office: 208, bid: 96, parts: 1180.55, total: 1484.55 })
    const d2 = index.byYmd.get('2026-09-02')!
    expect(d2.office).toHaveLength(1)
    const d3 = index.byYmd.get('2026-09-03')!
    expect(d3.parts.map((p) => [p.counterparty, p.counted])).toEqual([
      ['Ferguson', true],
      ['Shell', true],
      ['Transfer to Savings', false],
    ])
    expect(d3.sums.parts).toBeCloseTo(195.87, 6)
    expect(d3.excludedPartsUsd).toBe(2000)
    expect(d3.parts.find((p) => p.counterparty === 'Shell')!.bucket).toBe('fuel_gas')
    expect(index.ymds).toEqual(ymds)
    expect(index.byYmd.get('2026-09-04')!.sums.total).toBe(192)
  })

  it('sums agree with the trend kernel on the same inputs', () => {
    const laborDays = [
      { work_date: '2026-09-01', officeLaborUsd: 208, bidLaborUsd: 96 },
      { work_date: '2026-09-02', officeLaborUsd: 286, bidLaborUsd: 0 },
      { work_date: '2026-09-04', officeLaborUsd: 192, bidLaborUsd: 0 },
    ]
    const partsUsdByDay = new Map<string, number>()
    for (const d of index.byYmd.values()) if (d.sums.parts > 0) partsUsdByDay.set(d.ymd, d.sums.parts)
    const trend = buildOverheadPoolTrend({ laborDays, partsUsdByDay, startYmd: '2026-09-01', endYmd: '2026-09-05' })
    for (const td of trend.days) expect(index.byYmd.get(td.ymd)!.sums.total).toBeCloseTo(td.totalUsd, 6)
    expect(index.poolUsd).toBeCloseTo(trend.totals.totalUsd, 6)
  })

  it('knows a typical day, how often a counterparty and a person show up, and the biggest lines', () => {
    // Day totals with anything: 1484.55, 286, 195.87, 192, 40 → median 195.87.
    expect(index.typicalDayUsd).toBeCloseTo(195.87, 6)
    expect(index.typicalByCategory.office).toBe(208) // 208, 286, 192 → 208
    expect(index.counterparty.get('Ferguson')).toEqual({ count: 2, totalUsd: 1314.32, maxUsd: 1180.55 })
    expect(index.counterparty.has('Transfer to Savings')).toBe(false)
    expect(index.person.get('Taunya')).toEqual({ days: 2, hours: 19, maxHours: 11 })
    expect(index.biggest.map((b) => [b.category, b.amountUsd])).toEqual([
      ['parts', 1180.55],
      ['office', 286],
      ['office', 208],
      ['office', 192],
      ['parts', 133.77],
    ])
    expect(index.biggest.some((b) => b.line.kind === 'parts' && !b.line.counted)).toBe(false)
  })

  it('notes read the way the panel shows them', () => {
    const d1 = index.byYmd.get('2026-09-01')!
    expect(overheadPoolCounterpartyNote(index, d1.parts[0]!, money)).toBe('2× in 90 days · $1,314 total · the largest')
    const d3 = index.byYmd.get('2026-09-03')!
    expect(overheadPoolCounterpartyNote(index, d3.parts.find((p) => p.counterparty === 'Shell')!, money)).toBe('only time in 90 days')
    expect(overheadPoolCounterpartyNote(index, d3.parts.find((p) => !p.counted)!, money)).toBeNull()
    expect(overheadPoolPersonNote(index, index.byYmd.get('2026-09-02')!.office[0]!)).toBe('2 days · 9.5 h typical · the longest')
    expect(overheadPoolPersonNote(index, d1.bid[0]!)).toBe('2 days · 4.5 h typical') // Wendi: 3 h bid on 9/1 + 6 h office on 9/4 — stats span buckets
    expect(overheadPoolTypicalLabel(1484.55, 195.87)).toBe('7.6× a typical day')
    expect(overheadPoolTypicalLabel(2500, 195.87)).toBe('13× a typical day')
    expect(overheadPoolTypicalLabel(0, 195.87)).toBeNull()
    expect(overheadPoolTypicalLabel(100, 0)).toBeNull()
    expect(overheadPoolDominantCategory(d1)).toBe('parts')
    expect(overheadPoolDominantCategory(index.byYmd.get('2026-09-04')!)).toBe('office')
    expect(overheadPoolDominantCategory({ ymd: 'x', office: [], bid: [], parts: [], sums: { office: 0, bid: 0, parts: 0, total: 0 }, excludedPartsUsd: 0 })).toBeNull()
  })

  it('keys counterparties by name, not invoice number', () => {
    expect(overheadPartsCounterparty({ source: 'supply', label: 'Ferguson · #4471' })).toBe('Ferguson')
    expect(overheadPartsCounterparty({ source: 'supply', label: '' })).toBe('Supply invoice')
    expect(overheadPartsCounterparty({ source: 'mercury', label: ' Home Depot ' })).toBe('Home Depot')
    expect(overheadPartsCounterparty({ source: 'tally', label: 'Lav — 1/2" copper' })).toBe('Lav — 1/2" copper')
  })

  it('a day outside the given window still gets a row, and an empty window still builds', () => {
    const idx = buildOverheadPoolDayIndex({ labor: [{ workDate: '2026-08-01', userName: 'A', bucket: 'office', hours: 1, laborUsd: 10 }], parts: [], bucketByTxId: new Map(), ymds: ['2026-09-01'] })
    expect(idx.ymds).toEqual(['2026-08-01', '2026-09-01'])
    const empty = buildOverheadPoolDayIndex({ labor: [], parts: [], bucketByTxId: new Map(), ymds: [] })
    expect(empty.typicalDayUsd).toBe(0)
    expect(empty.biggest).toEqual([])
  })
})
