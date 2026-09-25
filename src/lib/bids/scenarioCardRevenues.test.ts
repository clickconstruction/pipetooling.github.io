import { describe, expect, it } from 'vitest'
import { bidVersionRowsKey, scenarioCardRevenues, type ScenarioCardRevenueInput } from './scenarioCardRevenues'

// Two bid versions (per-GC variants) with their own count rows — ids differ per version.
const rowsA = [
  { id: 'a-wc', fixture: 'Water closet', count: 10 },
  { id: 'a-lav', fixture: 'Lavatory', count: 4 },
]
const rowsB = [
  { id: 'b-wc', fixture: 'Water closet', count: 12 },
  { id: 'b-lav', fixture: 'Lavatory', count: 4 },
]
const entry = (id: string, versionId: string, name: string, total: number) => ({ id, version_id: versionId, total_price: total, fixture_types: { name } })
const assign = (pricing: string, row: string, entryId: string) => ({ price_book_version_id: pricing, count_row_id: row, price_book_entry_id: entryId, is_fixed_price: false, unit_price_override: null })

const base: ScenarioCardRevenueInput = {
  scenarios: [
    { id: 'p-a', bid_version_id: 'ver-a' },
    { id: 'p-b', bid_version_id: 'ver-b' },
  ],
  activeBidVersionId: 'ver-a',
  activeCountRows: rowsA,
  countRowsByBidVersion: new Map([[bidVersionRowsKey('ver-b'), rowsB]]),
  entries: [entry('e-a-wc', 'p-a', 'Water closet', 500), entry('e-a-lav', 'p-a', 'Lavatory', 300), entry('e-b-wc', 'p-b', 'Water closet', 450), entry('e-b-lav', 'p-b', 'Lavatory', 250)],
  assignments: [assign('p-a', 'a-wc', 'e-a-wc'), assign('p-a', 'a-lav', 'e-a-lav'), assign('p-b', 'b-wc', 'e-b-wc'), assign('p-b', 'b-lav', 'e-b-lav')],
  customPrices: [],
  hides: [],
}

describe('scenarioCardRevenues', () => {
  it('prices the on-screen version’s scenario on the on-screen rows', () => {
    expect(scenarioCardRevenues(base)['p-a']).toBe(10 * 500 + 4 * 300)
  })

  it('prices another version’s scenario on ITS rows, not the on-screen ones (v2.3841 — it read $0)', () => {
    expect(scenarioCardRevenues(base)['p-b']).toBe(12 * 450 + 4 * 250)
  })

  it('leaves out a scenario whose version rows were not supplied — no wrong $0', () => {
    const out = scenarioCardRevenues({ ...base, countRowsByBidVersion: new Map() })
    expect(out['p-a']).toBe(6200)
    expect('p-b' in out).toBe(false)
  })

  it('treats a legacy unversioned scenario on an unversioned bid as the on-screen one', () => {
    const out = scenarioCardRevenues({ ...base, scenarios: [{ id: 'p-a', bid_version_id: null }], activeBidVersionId: null })
    expect(out['p-a']).toBe(6200)
  })

  it('applies the scenario’s own custom price to a row with no book entry', () => {
    const out = scenarioCardRevenues({
      ...base,
      countRowsByBidVersion: new Map([[bidVersionRowsKey('ver-b'), [...rowsB, { id: 'b-hb', fixture: 'Hose bibb', count: 3 }]]]),
      customPrices: [
        { price_book_version_id: 'p-b', count_row_id: 'b-hb', unit_price: 90 },
        { price_book_version_id: 'p-a', count_row_id: 'b-hb', unit_price: 999 }, // another scenario's — ignored
      ],
    })
    expect(out['p-b']).toBe(12 * 450 + 4 * 250 + 3 * 90)
  })
})
