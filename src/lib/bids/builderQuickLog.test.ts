import { describe, expect, it } from 'vitest'
import { buildBuilderQuickLogWrites, builderOpenPipelineValue, formatOpenPipelineValue } from './builderQuickLog'

const NOW = '2026-08-04T16:00:00Z'

describe('buildBuilderQuickLogWrites', () => {
  it('builds one customer contact plus an entry per checked bid (last_contact derives via trigger)', () => {
    const w = buildBuilderQuickLogWrites({
      customerId: 'c1',
      checkedBidIds: ['b1', 'b2'],
      method: 'Phone',
      note: 'Spoke with Ravi — decision next week',
      nowIso: NOW,
      userId: 'u1',
    })
    expect(w.customerContact).toEqual({
      customer_id: 'c1',
      contact_date: NOW,
      details: 'Spoke with Ravi — decision next week',
      contact_method: 'Phone',
      created_by: 'u1',
    })
    expect(w.bidEntries).toHaveLength(2)
    expect(w.bidEntries[0]).toMatchObject({ bid_id: 'b1', contact_method: 'Phone', occurred_at: NOW, created_by: 'u1' })
  })

  it('defaults an empty note to "<method> follow-up" and dedupes bid ids', () => {
    const w = buildBuilderQuickLogWrites({ customerId: 'c1', checkedBidIds: ['b1', 'b1'], method: 'Text', note: '   ', nowIso: NOW, userId: 'u1' })
    expect(w.customerContact?.details).toBe('Text follow-up')
    expect(w.bidEntries).toHaveLength(1)
  })

  it('bids-only mode: no customer_contacts row, bids still get notes', () => {
    const w = buildBuilderQuickLogWrites({ customerId: 'c1', checkedBidIds: ['b1', 'b2'], method: 'Phone', note: 'GC says waiting on landlord', nowIso: NOW, userId: 'u1', includeBuilderLog: false })
    expect(w.customerContact).toBeNull()
    expect(w.bidEntries.map((e) => e.bid_id)).toEqual(['b1', 'b2'])
    expect(w.bidEntries[0]!.notes).toBe('GC says waiting on landlord')
  })

  it('works with zero checked bids — the call still logs against the builder', () => {
    const w = buildBuilderQuickLogWrites({ customerId: 'c1', checkedBidIds: [], method: 'Email', note: 'left VM', nowIso: NOW, userId: 'u1' })
    expect(w.bidEntries).toEqual([])
    expect(w.customerContact?.details).toBe('left VM')
  })
})

describe('builderOpenPipelineValue', () => {
  it('sums finite positive bid values and ignores null/garbage', () => {
    expect(
      builderOpenPipelineValue([{ bid_value: 214000 }, { bid_value: 146000 }, { bid_value: null }, { bid_value: -5 }, { bid_value: NaN }]),
    ).toBe(360000)
  })
})

describe('formatOpenPipelineValue', () => {
  it('formats k / M with sensible rounding and hides sub-dollar', () => {
    expect(formatOpenPipelineValue(360000)).toBe('$360k')
    expect(formatOpenPipelineValue(1_240_000)).toBe('$1.2M')
    expect(formatOpenPipelineValue(12_400_000)).toBe('$12M')
    expect(formatOpenPipelineValue(900)).toBe('$900')
    expect(formatOpenPipelineValue(0)).toBeNull()
  })
})
