import { describe, expect, it } from 'vitest'
import { isFootageLaborRow, isFootageRow, laborEstimateCompleteness, revenuePerFieldHourWords, summarizeBidLabor } from './bidLaborSummary'
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

const row = (id: string, fixture: string, count: number, hrs: [number, number, number], is_fixed = false, extra: Partial<CostEstimateLaborRow> = {}): CostEstimateLaborRow =>
  ({ id, cost_estimate_id: 'ce', fixture, count, rough_in_hrs_per_unit: hrs[0], top_out_hrs_per_unit: hrs[1], trim_set_hrs_per_unit: hrs[2], is_fixed, kind: is_fixed ? 'task' : 'fixture', unit: 'each', source: null, source_note: null, sequence_order: 0, created_at: null, ...extra }) as CostEstimateLaborRow

// B375 SPACEX, a slice: 10 toilets, 6 lavs, 719.46 ft of ½" water at 4 h per 100 ft (entered as 0.04/ft), one fixed sawcut.
const rows = [
  row('wc', 'WC 1&2', 10, [1, 1, 1]),
  row('lav', 'LAV2', 6, [0.5, 0.5, 0.5]),
  row('w12', 'ft of 1/2IN WATER', 719.46, [0.025, 0.015, 0]),
  row('saw', 'SAWCUTTING', 1, [6, 0, 0], true),
  row('wha', 'WHA-500', 1, [0, 0, 0]),
]

describe('isFootageRow', () => {
  it('reads footage rows by their words', () => {
    expect(isFootageRow('ft of 3/4IN WATER')).toBe(true)
    expect(isFootageRow('feet of 12thhn')).toBe(true)
    expect(isFootageRow('LF 2" waste')).toBe(true)
    expect(isFootageRow('WC 1&2')).toBe(false)
    expect(isFootageRow('Left-hand tub')).toBe(false)
  })
  it('a row priced per 100 ft is footage whatever its words say', () => {
    expect(isFootageLaborRow({ fixture: '½" water', unit: 'per_100ft' })).toBe(true)
    expect(isFootageLaborRow({ fixture: 'ft of 2IN WASTE', unit: 'each' })).toBe(true)
    expect(isFootageLaborRow({ fixture: 'Toilet' })).toBe(false)
  })
})

describe('summarizeBidLabor', () => {
  it('sums the stages, turns hours into crew-days, dollars at the rate and revenue per field hour against the bid', () => {
    const s = summarizeBidLabor({ rows, ratePerHour: 35.76, bidValue: 249_715.66 })
    // toilets 30 · lavs 9 · water 719.46 × 0.04 = 28.78 · sawcut 6 (fixed) = 73.78
    expect(s.rough).toBeCloseTo(10 + 3 + 17.99 + 6, 1)
    expect(s.top).toBeCloseTo(10 + 3 + 10.79, 1)
    expect(s.trim).toBeCloseTo(10 + 3, 1)
    expect(s.total).toBeCloseTo(73.78, 1)
    expect(s.crewDays).toBeCloseTo(73.78 / 16, 2)
    expect(s.laborUsd).toBeCloseTo(73.78 * 35.76, 0)
    expect(s.revenuePerFieldHour).toBeCloseTo(249_715.66 / 73.78, 0)
    expect(s.footageHoursShare).toBeCloseTo(28.78 / 73.78, 2)
    expect(s.rowCount).toBe(5)
    expect(s.rowsWithHours).toBe(4)
  })
  it('leaves dollars and the ratio null without a rate or a bid value', () => {
    const s = summarizeBidLabor({ rows, ratePerHour: null, bidValue: null })
    expect(s.laborUsd).toBeNull()
    expect(s.revenuePerFieldHour).toBeNull()
    expect(revenuePerFieldHourWords(s)).toBe('set a bid value to compare')
    expect(revenuePerFieldHourWords(summarizeBidLabor({ rows: [], ratePerHour: null, bidValue: 100 }))).toBe('add hours to compare')
    expect(revenuePerFieldHourWords(summarizeBidLabor({ rows, ratePerHour: null, bidValue: 100 }))).toBe('bid value ÷ 74 h')
  })
})

describe('laborEstimateCompleteness', () => {
  it('usable at 90 % of rows with hours and a rate; the pills say what is missing', () => {
    const c = laborEstimateCompleteness({ rows, rateSet: true, materialsSource: 'takeoff' })
    expect(c.hoursRows).toBe(4)
    expect(c.totalRows).toBe(5)
    expect(c.usable).toBe(false)
    expect(c.pills.map((p) => p.text)).toEqual(['hours on 4 of 5 rows', '1 row needs hours ↓', 'rate set', 'materials from takeoff'])
    expect(c.pills[0]!.tone).toBe('warn')
    const full = laborEstimateCompleteness({ rows: rows.slice(0, 4), rateSet: true, materialsSource: 'none' })
    expect(full.usable).toBe(true)
    expect(full.pills.map((p) => p.text)).toEqual(['hours on 4 of 4 rows', 'rate set', 'no materials yet'])
    const noRate = laborEstimateCompleteness({ rows: rows.slice(0, 4), rateSet: false, materialsSource: 'takeoff' })
    expect(noRate.usable).toBe(false)
    expect(noRate.pills.some((p) => p.text === 'no labor rate' && p.tone === 'warn')).toBe(true)
  })
  it('no rows: not usable, one muted pill', () => {
    const c = laborEstimateCompleteness({ rows: [], rateSet: false, materialsSource: 'none' })
    expect(c.usable).toBe(false)
    expect(c.pills[0]).toEqual({ tone: 'muted', text: 'no rows yet' })
  })
})

describe('sub lines and per-100-ft rows (v2.3291)', () => {
  const withSub = [...rows, row('sub', 'Ramirez excavation', 1, [0, 0, 0], false, { kind: 'sub' })]
  it('a sub line is answered without hours: it leaves the count and adds a muted pill', () => {
    const c = laborEstimateCompleteness({ rows: withSub, rateSet: true, materialsSource: 'takeoff' })
    expect(c.totalRows).toBe(5)
    expect(c.subRows).toBe(1)
    expect(c.pills.map((p) => p.text)).toEqual(['hours on 4 of 5 rows', '1 row needs hours ↓', '1 sub line', 'rate set', 'materials from takeoff'])
    expect(summarizeBidLabor({ rows: withSub, ratePerHour: 35.76, bidValue: null }).total).toBeCloseTo(73.78, 1)
  })
  it('a per-100-ft row counts its hours ÷ 100 and lands in the footage share', () => {
    const per100 = [row('wc', 'WC 1&2', 10, [1, 1, 1]), row('w2', '2" waste', 729.5, [4, 0, 0], false, { unit: 'per_100ft' })]
    const s = summarizeBidLabor({ rows: per100, ratePerHour: null, bidValue: null })
    expect(s.total).toBeCloseTo(30 + 29.18, 2)
    expect(s.footageHoursShare).toBeCloseTo(29.18 / 59.18, 3)
  })
})
