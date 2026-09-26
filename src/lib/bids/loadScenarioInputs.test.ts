import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadScenarioInputs, scenarioBidVersionIdOf, scenarioNeedsOwnRows } from './loadScenarioInputs'

/**
 * The per-scenario loader: the four overlay reads carry the scenario and bid keys, and the
 * own-rows decision (`scenarioBidVersionId !== selectedBidVersionId`) decides whether the
 * scenario's own count rows are read — by version, or the unversioned rows for a legacy
 * scenario — or left null so the on-screen rows apply.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string) => { data: unknown; error: null } = () => ({ data: [], error: null })
const supabase = {
  from: (table: string) => {
    const steps: Step[] = []
    queries.push({ table, steps })
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table))
          return (...a: unknown[]) => {
            steps.push({ method: String(prop), args: a })
            return p
          }
        },
      },
    )
    return p
  },
} as unknown as SupabaseClient

const q = (table: string) => queries.find((x) => x.table === table)
const stepsOf = (table: string) => q(table)!.steps.map((s) => [s.method, ...s.args])

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: [], error: null })
})

describe('scenarioNeedsOwnRows', () => {
  it('is false for the on-screen version and for a legacy unversioned scenario on an unversioned bid', () => {
    expect(scenarioNeedsOwnRows('ver-a', 'ver-a')).toBe(false)
    expect(scenarioNeedsOwnRows(null, null)).toBe(false)
  })
  it('is true for another version, and for an unversioned scenario while a version is on screen', () => {
    expect(scenarioNeedsOwnRows('ver-b', 'ver-a')).toBe(true)
    expect(scenarioNeedsOwnRows(null, 'ver-a')).toBe(true)
    expect(scenarioNeedsOwnRows('ver-a', null)).toBe(true)
  })
})

describe('scenarioBidVersionIdOf', () => {
  const scenarios = [
    { id: 'p-a', bid_version_id: 'ver-a' },
    { id: 'p-legacy', bid_version_id: null },
  ]
  it('reads the scenario’s version; null when unversioned or unknown', () => {
    expect(scenarioBidVersionIdOf(scenarios, 'p-a')).toBe('ver-a')
    expect(scenarioBidVersionIdOf(scenarios, 'p-legacy')).toBeNull()
    expect(scenarioBidVersionIdOf(scenarios, 'p-none')).toBeNull()
  })
})

describe('loadScenarioInputs', () => {
  it('reads the four overlays for the scenario and bid; on the on-screen version the count rows stay null and are not read', async () => {
    const out = await loadScenarioInputs(supabase, { bidId: 'bid-1', pricingId: 'p-a', scenarioBidVersionId: 'ver-a', selectedBidVersionId: 'ver-a' })
    expect(stepsOf('price_book_entries')).toEqual([['select', '*, fixture_types(name)'], ['eq', 'version_id', 'p-a']])
    expect(stepsOf('bid_pricing_assignments')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1'], ['eq', 'price_book_version_id', 'p-a']])
    expect(stepsOf('bid_count_row_custom_prices')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1'], ['eq', 'price_book_version_id', 'p-a']])
    expect(stepsOf('bid_count_row_submission_hides')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1'], ['eq', 'price_book_version_id', 'p-a']])
    // The builder is made but never awaited: no version filter, no order — nothing ran.
    expect(stepsOf('bids_count_rows')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1']])
    expect(out.countRows).toBeNull()
  })

  it('on another version reads that version’s rows in sequence order — the v2.3685 rule', async () => {
    route = (table) => (table === 'bids_count_rows' ? { data: [{ id: 'b-wc', fixture: 'Water closet', count: 12 }], error: null } : { data: [], error: null })
    const out = await loadScenarioInputs(supabase, { bidId: 'bid-1', pricingId: 'p-b', scenarioBidVersionId: 'ver-b', selectedBidVersionId: 'ver-a' })
    expect(stepsOf('bids_count_rows')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1'], ['eq', 'bid_version_id', 'ver-b'], ['order', 'sequence_order', { ascending: true }]])
    expect(out.countRows).toEqual([{ id: 'b-wc', fixture: 'Water closet', count: 12 }])
  })

  it('a legacy unversioned scenario while a version is on screen reads the rows with no version', async () => {
    await loadScenarioInputs(supabase, { bidId: 'bid-1', pricingId: 'p-legacy', scenarioBidVersionId: null, selectedBidVersionId: 'ver-a' })
    expect(stepsOf('bids_count_rows')).toEqual([['select', '*'], ['eq', 'bid_id', 'bid-1'], ['is', 'bid_version_id', null], ['order', 'sequence_order', { ascending: true }]])
  })

  it('empty reads are empty lists; own rows that come back empty are [], never null', async () => {
    route = () => ({ data: null, error: null })
    const out = await loadScenarioInputs(supabase, { bidId: 'bid-1', pricingId: 'p-b', scenarioBidVersionId: 'ver-b', selectedBidVersionId: 'ver-a' })
    expect(out).toEqual({ entries: [], assignments: [], customPrices: [], hides: [], countRows: [] })
  })

  it('hands the rows back as read', async () => {
    route = (table) => {
      if (table === 'price_book_entries') return { data: [{ id: 'e1', version_id: 'p-a', total_price: 500, fixture_types: { name: 'Water closet' } }], error: null }
      if (table === 'bid_pricing_assignments') return { data: [{ price_book_version_id: 'p-a', count_row_id: 'a-wc', price_book_entry_id: 'e1' }], error: null }
      if (table === 'bid_count_row_custom_prices') return { data: [{ price_book_version_id: 'p-a', count_row_id: 'a-hb', unit_price: 90 }], error: null }
      if (table === 'bid_count_row_submission_hides') return { data: [{ price_book_version_id: 'p-a', count_row_id: 'a-lav' }], error: null }
      return { data: [], error: null }
    }
    const out = await loadScenarioInputs(supabase, { bidId: 'bid-1', pricingId: 'p-a', scenarioBidVersionId: 'ver-a', selectedBidVersionId: 'ver-a' })
    expect(out.entries).toHaveLength(1)
    expect(out.assignments[0]?.count_row_id).toBe('a-wc')
    expect(out.customPrices[0]?.unit_price).toBe(90)
    expect(out.hides[0]?.count_row_id).toBe('a-lav')
  })
})
