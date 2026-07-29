import { describe, expect, it } from 'vitest'
import {
  SEGMENT_GENERATOR_PRESETS,
  segmentGeneratorAllocatedPct,
  segmentGeneratorDollarsByRowId,
  segmentGeneratorPayload,
  type SegmentGeneratorRow,
} from './segmentGenerator'

const row = (id: string, name: string, pct: number | null): SegmentGeneratorRow => ({ id, name, pct })

describe('segmentGeneratorAllocatedPct', () => {
  it('sums entered percentages, nulls as 0', () => {
    expect(segmentGeneratorAllocatedPct([row('a', 'x', 30), row('b', 'y', null), row('c', 'z', 40)])).toBe(70)
  })
})

describe('segmentGeneratorDollarsByRowId', () => {
  it('splits exactly at 100% with the last row absorbing the rounding remainder', () => {
    // 100.01 / 3 rows at 33.33/33.33/33.34
    const rows = [row('a', 'A', 33.33), row('b', 'B', 33.33), row('c', 'C', 33.34)]
    const d = segmentGeneratorDollarsByRowId(100.01, rows)
    const sum = Math.round(((d.a ?? 0) + (d.b ?? 0) + (d.c ?? 0)) * 100)
    expect(sum).toBe(10001)
  })

  it('commercial preset on $10,000 gives 3000/3000/3000/1000', () => {
    const preset = SEGMENT_GENERATOR_PRESETS[0]!
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
})

describe('segmentGeneratorPayload', () => {
  it('emits only named dollar-bearing rows, in order, as count-1 lines', () => {
    const rows = [row('a', 'Rough In', 40), row('b', '  ', 40), row('c', 'Trim Set', 20), row('d', 'Zero', 0)]
    const payload = segmentGeneratorPayload(1000, rows)
    expect(payload.map((p) => p.name)).toEqual(['Rough In', 'Trim Set'])
    expect(payload.map((p) => p.line_unit_price)).toEqual([400, 200])
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
