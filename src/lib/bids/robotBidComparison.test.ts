import { describe, expect, it } from 'vitest'
import { classifyCountRow, percentDelta, summarizeDraftForComparison } from './robotBidComparison'

describe('classifyCountRow', () => {
  it('splits footage / fittings / fixtures', () => {
    expect(classifyCountRow('ft of 2" Sanitary Waste')).toBe('footage')
    expect(classifyCountRow('2" Sanitary Waste · 90 Ell')).toBe('fitting')
    expect(classifyCountRow('4" Grease/San Waste · Tee/Wye')).toBe('fitting')
    expect(classifyCountRow('1/2" Cold Water · Tee')).toBe('fitting')
    expect(classifyCountRow('WC (TOTO flush valve)')).toBe('fixture')
    expect(classifyCountRow('Travel & Rentals (73 mi from office)')).toBe('fixture')
  })

  it('does not mistake fixture names containing digits for fittings', () => {
    expect(classifyCountRow('WH Navien NPE-240A2 tankless (199 MBH)')).toBe('fixture')
    expect(classifyCountRow('BFP-1 2in RPZ (Watts 007M1QT)')).toBe('fixture')
  })
})

describe('summarizeDraftForComparison', () => {
  const rows = [
    { id: 'r1', fixture: 'WC (flush valve)', count: 4, bid_version_id: null },
    { id: 'r2', fixture: 'ft of 2" Sanitary Waste', count: 120, bid_version_id: null },
    { id: 'r3', fixture: '2" Sanitary Waste · Tee', count: 10, bid_version_id: null },
    { id: 'r4', fixture: 'LAV', count: 2, bid_version_id: 'v-other' },
  ]
  const assignments = [
    { count_row_id: 'r1', price_book_entry_id: 'e-wc', unit_price_override: null },
    { count_row_id: 'r2', price_book_entry_id: 'e-ft', unit_price_override: 30 },
    { count_row_id: 'r3', price_book_entry_id: 'e-tee', unit_price_override: null },
  ]
  const prices = { 'e-wc': 3350, 'e-ft': 25, 'e-tee': 10 }

  it('totals with override-beats-book and skips other versions', () => {
    const s = summarizeDraftForComparison(rows, null, assignments, prices)
    expect(s.draftTotal).toBe(4 * 3350 + 120 * 30 + 10 * 10)
    expect(s.rowCount).toBe(3)
    expect(s.fixtureCount).toBe(4)
    expect(s.footageFt).toBe(120)
  })

  it('selected version filters to that version', () => {
    const s = summarizeDraftForComparison(rows, 'v-other', assignments, prices)
    expect(s.rowCount).toBe(1)
    expect(s.fixtureCount).toBe(2)
    expect(s.draftTotal).toBe(0)
  })

  it('unassigned rows still count toward fixtures/footage but not dollars', () => {
    const s = summarizeDraftForComparison(
      [{ id: 'r9', fixture: 'ft of 3" Vent', count: 50, bid_version_id: null }],
      null,
      [],
      {},
    )
    expect(s.draftTotal).toBe(0)
    expect(s.footageFt).toBe(50)
  })
})

describe('percentDelta', () => {
  it('signed percent, null on zero base', () => {
    expect(percentDelta(90, 100)).toBeCloseTo(-10)
    expect(percentDelta(110, 100)).toBeCloseTo(10)
    expect(percentDelta(50, 0)).toBeNull()
  })
})
