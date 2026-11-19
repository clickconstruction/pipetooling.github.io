import { describe, expect, it } from 'vitest'
import { percentCountRowPayload } from './percentRowIo'

describe('the count row a new Percent row is', () => {
  const base = { bidId: 'bid-1', bidVersionId: 'v-1', name: '  Connections ', kind: 'fitting' as const, sequenceOrder: 9 }

  it('is one row, counted as 1, last on its version, with its kind and its rule', () => {
    expect(percentCountRowPayload({ ...base, rule: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } } })).toEqual({
      bid_id: 'bid-1',
      bid_version_id: 'v-1',
      fixture: 'Connections',
      count: 1,
      unit: 'ea',
      sequence_order: 9,
      kind: 'fitting',
      percent_rule: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } },
    })
  })

  it('names no rule column when the row has none, so a database without it still takes the row', () => {
    const payload = percentCountRowPayload({ ...base, bidVersionId: null, rule: null })
    expect(payload).not.toHaveProperty('percent_rule')
    expect(payload).toMatchObject({ bid_version_id: null, fixture: 'Connections', count: 1 })
  })

  it('keeps a rule by tag as a tag', () => {
    expect(percentCountRowPayload({ ...base, rule: { pct: 12.5, basis: 'cost', source: { tag: 'water' } } }).percent_rule).toEqual({ pct: 12.5, basis: 'cost', source: { tag: 'water' } })
  })
})
