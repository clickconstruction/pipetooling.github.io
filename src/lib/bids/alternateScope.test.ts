import { describe, expect, it } from 'vitest'
import { laborHoursByAlternate, partitionByAlternate, sumByAlternate } from './alternateScope'

const rows = [
  { id: 'a', fixture: 'WC', count: 4, group_tag: 'Restroom A', cost: 1312 },
  { id: 'b', fixture: 'ft of 2" PVC', count: 112, group_tag: 'Restroom A', cost: 1904 },
  { id: 'c', fixture: 'WH', count: 1, group_tag: null, cost: 1860 },
  { id: 'd', fixture: 'WC', count: 1, group_tag: 'Break room', cost: 328 },
  { id: 'e', fixture: 'ft of 2" PVC', count: 48.5, group_tag: 'break room', cost: 824.5 },
  { id: 'f', fixture: 'LAV', count: 2, group_tag: 'Annex', cost: 0 },
]

describe('alternateScope (v2.4189)', () => {
  it('partitions rows into the base and each alternate, alphabetical, first spelling kept', () => {
    const p = partitionByAlternate(rows, ['Break room', 'Annex'])
    expect(p.base.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(p.alternates.map((a) => [a.label, a.rows.map((r) => r.id)])).toEqual([['Annex', ['f']], ['Break room', ['d', 'e']]])
  })

  it('sums a per-row value into base / alternates / total; null without an alternate that holds a row', () => {
    const s = sumByAlternate(rows, ['Break room'], (r) => r.cost)!
    expect(s.base).toBe(5076)
    expect(s.alternates).toEqual([{ label: 'Break room', value: 1152.5 }])
    expect(s.total).toBe(6228.5)
    expect(sumByAlternate(rows, [], (r) => r.cost)).toBeNull()
    expect(sumByAlternate(rows, ['Nowhere'], (r) => r.cost)).toBeNull()
  })

  it('splits a labor row keyed by fixture name in the ratio of the scoped counts; fixed rows stay in the base', () => {
    const laborRows = [
      { fixture: 'WC', count: 5, is_fixed: false, kind: 'fixture', unit: 'each', rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1.5 },     // 22.5 h over WC ×5
      { fixture: 'ft of 2" PVC', count: 160.5, is_fixed: false, kind: 'fixture', unit: 'per_100ft', rough_in_hrs_per_unit: 12, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 }, // 19.26 h
      { fixture: 'WH', count: 1, is_fixed: false, kind: 'fixture', unit: 'each', rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 2, trim_set_hrs_per_unit: 2.5 },      // 5.5 h
      { fixture: 'Site visit', count: 1, is_fixed: true, kind: 'task', unit: 'each', rough_in_hrs_per_unit: 3, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 },    // 3 h fixed → base
    ] as const
    const s = laborHoursByAlternate({ laborRows: laborRows as unknown as Parameters<typeof laborHoursByAlternate>[0]['laborRows'], countRows: rows, alternateTags: ['Break room'] })!
    // WC: 22.5 × 1/5 = 4.5 to the alternate; PVC: 19.26 × 48.5/160.5 = 5.82 to the alternate.
    expect(s.alternates[0]!.label).toBe('Break room')
    expect(s.alternates[0]!.value).toBeCloseTo(4.5 + 5.82, 2)
    expect(s.base).toBeCloseTo(18 + 13.44 + 5.5 + 3, 2)
    expect(s.total).toBeCloseTo(22.5 + 19.26 + 5.5 + 3, 2)
    expect(laborHoursByAlternate({ laborRows: laborRows as never, countRows: rows, alternateTags: [] })).toBeNull()
  })
})
