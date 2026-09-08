import { describe, expect, it } from 'vitest'
import {
  CHANGE_ORDER_ROW,
  SEGMENT_GENERATOR_PRESETS,
  segmentGeneratorAllocatedPct,
  segmentGeneratorDollarsByRowId,
  segmentGeneratorPayload,
  segmentGeneratorTotals,
  type SegmentGeneratorRow,
} from './segmentGenerator'

const row = (id: string, name: string, pct: number | null): SegmentGeneratorRow => ({ id, name, pct, kind: 'order', amount: null })
const own = (id: string, name: string, amount: number | null, kind: 'any' | null = 'any'): SegmentGeneratorRow => ({ id, name, pct: null, kind, amount })

describe('segmentGeneratorAllocatedPct', () => {
  it('sums entered percentages on Order rows, nulls as 0; Any / plain rows never count', () => {
    expect(segmentGeneratorAllocatedPct([row('a', 'x', 30), row('b', 'y', null), row('c', 'z', 40), own('d', 'co', 500)])).toBe(70)
  })
})

describe('segmentGeneratorDollarsByRowId', () => {
  it('splits exactly at 100% with the last Order row absorbing the rounding remainder', () => {
    // 100.01 / 3 rows at 33.33/33.33/33.34
    const rows = [row('a', 'A', 33.33), row('b', 'B', 33.33), row('c', 'C', 33.34)]
    const d = segmentGeneratorDollarsByRowId(100.01, rows)
    const sum = Math.round(((d.a ?? 0) + (d.b ?? 0) + (d.c ?? 0)) * 100)
    expect(sum).toBe(10001)
  })

  it('commercial preset on $10,000 gives 3000/3000/3000/1000, every row in order', () => {
    const preset = SEGMENT_GENERATOR_PRESETS[0]!
    expect(preset.rows.every((r) => r.kind === 'order')).toBe(true)
    expect(preset.hint).toBe('4 in order')
    const rows = preset.rows.map((r, i) => row(String(i), r.name, r.pct))
    const d = segmentGeneratorDollarsByRowId(10000, rows)
    expect(Object.values(d)).toEqual([3000, 3000, 3000, 1000])
  })

  it('does not force the total when under-allocated', () => {
    const d = segmentGeneratorDollarsByRowId(1000, [row('a', 'A', 40), row('b', 'B', 40)])
    expect(d.a).toBe(400)
    expect(d.b).toBe(400)
  })

  it('zero/negative totals produce zero dollars', () => {
    const d = segmentGeneratorDollarsByRowId(0, [row('a', 'A', 50)])
    expect(d.a).toBe(0)
  })

  it('an Any or plain row carries its own amount, outside the split, and the remainder still lands on an Order row', () => {
    const rows = [row('a', 'A', 50), own('co', 'Relocate water heater', 1850), row('b', 'B', 50), own('p', 'Permit', 600, null)]
    const d = segmentGeneratorDollarsByRowId(100.01, rows)
    expect(d.co).toBe(1850)
    expect(d.p).toBe(600)
    expect(Math.round(((d.a ?? 0) + (d.b ?? 0)) * 100)).toBe(10001)
  })
})

describe('segmentGeneratorTotals', () => {
  it('reads the allocation line and the summary counts', () => {
    const rows = [...SEGMENT_GENERATOR_PRESETS[0]!.rows.map((r, i) => row(String(i), r.name, r.pct)), own('co', 'Relocate water heater', 1850), own('p', 'Permit & misc', 600, null), own('blank', '', null)]
    expect(segmentGeneratorTotals(41550, rows)).toEqual({ inOrderDollars: 41550, outsideDollars: 2450, jobTotalDollars: 44000, orderCount: 4, anyCount: 1, plainCount: 1 })
  })

  it('the change-order preset row is Any time with no price yet', () => {
    expect(CHANGE_ORDER_ROW).toEqual({ name: 'Change order', pct: null, kind: 'any', amount: null })
  })
})

describe('segmentGeneratorPayload', () => {
  it('emits only named dollar-bearing rows, in order, as count-1 lines carrying their kind', () => {
    const rows = [row('a', 'Rough In', 40), row('b', '  ', 40), row('c', 'Trim Set', 20), row('d', 'Zero', 0), own('co', 'Hose bib', 420), own('p', 'Permit', 600, null), own('empty', 'No price', null)]
    const payload = segmentGeneratorPayload(1000, rows)
    expect(payload.map((p) => [p.name, p.line_unit_price, p.stage_kind])).toEqual([
      ['Rough In', 400, 'order'],
      ['Trim Set', 200, 'order'],
      ['Hose bib', 420, 'any'],
      ['Permit', 600, null],
    ])
    expect(payload.every((p) => p.count === 1 && p.invoice_id === null)).toBe(true)
  })

  it('residential preset totals back to the input', () => {
    const preset = SEGMENT_GENERATOR_PRESETS[1]!
    const rows = preset.rows.map((r, i) => row(String(i), r.name, r.pct))
    const payload = segmentGeneratorPayload(999.99, rows)
    const sum = Math.round(payload.reduce((s, p) => s + p.line_unit_price, 0) * 100)
    expect(sum).toBe(99999)
  })
})
