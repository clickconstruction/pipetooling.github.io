// @vitest-environment jsdom
/**
 * Switching price cards on Bids → Pricing (v2.5669, Grace's report of 2026-10-20): "When switching to
 * my alternate it took a few clicks back and forth from the original before it populated my alternate
 * prices." The alternate's 50 rows were priced, but its card read "No prices yet" at $0.00 until she
 * went back to the base price and over again.
 *
 * The cause: a read of the price she was LEAVING landed after the alternate's own read and wrote its
 * rows over the screen. A typed price saves on blur, and clicking the Alternate card is what blurs the
 * cell — so the save's reload of the base price's rows (`loadBidPricingAssignments` with the version
 * the save was for, no abort) went out after the switch's read and came back last. The Workbench prices
 * only the open price's own rows (`scenarioPricingRows`), so every row read as unpriced. Price book
 * entries had the same hole (`loadPriceBookEntries` had no guard at all).
 *
 * The rule now: only the newest read for the price on screen writes. And the screen can tell a price
 * still loading from an empty one (`pricingPricesReady`), so the open card says … instead of offering
 * to copy prices over a price that has them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type Row = Record<string, unknown>
const tableData: Record<string, Row[]> = {}

/** Reads held until the test lets them land: a table plus the eq() filters that pick the read out. */
type Hold = { table: string; eqs: Record<string, unknown>; release: () => void; gate: Promise<void> }
let holds: Hold[] = []
function holdNextRead(table: string, eqs: Record<string, unknown>): () => void {
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  holds.push({ table, eqs, release, gate })
  return release
}

// Filter-aware Supabase stand-in (as in the put back and Cover Letter ★ tests), with two additions:
// a read can be held back to land late, and an abortSignal turns it into PostgREST's AbortError result.
vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    let op = 'select'
    let signal: AbortSignal | null = null
    const eqs: Record<string, unknown> = {}
    const filters: ((r: Row) => boolean)[] = []
    const builder: Record<string, unknown> = {}
    const passthrough = ['select', 'neq', 'or', 'ilike', 'order', 'limit', 'range', 'not', 'gte', 'lte', 'gt', 'lt', 'setHeader']
    for (const m of passthrough) builder[m] = () => builder
    for (const m of ['insert', 'update', 'upsert', 'delete']) builder[m] = () => { op = m; return builder }
    builder.abortSignal = (s: AbortSignal) => { signal = s; return builder }
    builder.eq = (col: string, val: unknown) => { eqs[col] = val; filters.push((r) => r[col] === val); return builder }
    builder.is = (col: string, val: unknown) => { filters.push((r) => (r[col] ?? null) === val); return builder }
    builder.in = (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return builder }
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = async () => {
      if (op !== 'select') return { data: single ? null : [], error: null }
      const i = holds.findIndex((h) => h.table === table && Object.entries(h.eqs).every(([k, v]) => eqs[k] === v))
      if (i >= 0) {
        const [hold] = holds.splice(i, 1)
        await hold!.gate
      }
      if (signal?.aborted) return { data: null, error: { message: 'AbortError: signal is aborted without reason', code: '' }, status: 0 }
      const rows = (tableData[table] ?? []).filter((r) => filters.every((f) => f(r)))
      return { data: single ? rows[0] ?? null : rows, error: null, count: rows.length }
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => result().then(onFulfilled, onRejected)
    builder.catch = (onRejected?: (e: unknown) => unknown) => result().catch(onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => makeBuilder('rpc'),
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    },
  }
})

import { useBidPricingEngine } from './useBidPricingEngine'
import { scenarioRevenue } from '../lib/bids/scenarioPricingRows'
import type { BidWithBuilder } from '../types/bidWithBuilder'

const bid = { id: 'b1', selected_bid_version_id: 'ver-A', selected_price_book_version_id: 'pbv-wendi', materials_model: 'exact' } as unknown as BidWithBuilder

function mount() {
  return renderHook(() => {
    const engine = useBidPricingEngine({
      selectedBidForCounts: null,
      selectedBidForTakeoff: null,
      selectedBidForCostEstimate: null,
      selectedBidForPricing: bid,
      activeTab: 'pricing',
      selectedServiceTypeId: '',
      authUser: { id: 'u1' },
      setError: () => {},
      loadBids: async () => [],
    })
    // What the open card and the Revenue tile read: the open price priced on its own rows (prices only).
    const onScreenRevenue = engine.selectedPricingVersionId
      ? scenarioRevenue({
          scenarioId: engine.selectedPricingVersionId,
          countRows: engine.pricingCountRows,
          entries: engine.priceBookEntries,
          assignments: engine.bidPricingAssignments,
          customPrices: engine.bidCountRowCustomPrices,
        })
      : null
    return { engine, onScreenRevenue }
  })
}

type Hook = ReturnType<typeof mount>

/** The card's click (`viewWorkbenchScenario`): open the price, read its book. */
function viewPrice(hook: Hook, pricingId: string) {
  act(() => {
    hook.result.current.engine.setSelectedPricingVersionId(pricingId)
    void hook.result.current.engine.loadPriceBookEntries(pricingId)
  })
}

// Two rows on one GC version, priced by both prices: WENDI at $100 a fixture (the ★), Alternate 1 at $50.
const WENDI_TOTAL = 3 * 100 + 2 * 100
const ALT_TOTAL = 3 * 50 + 2 * 50

describe('useBidPricingEngine · switching price cards keeps the open price\'s own prices', () => {
  beforeEach(() => {
    holds = []
    for (const k of Object.keys(tableData)) delete tableData[k]
    tableData.bid_versions = [{ id: 'ver-A', bid_id: 'b1', name: 'WENDI', sort_order: 0, starred_price_book_version_id: 'pbv-wendi' }]
    tableData.price_book_versions = [
      { id: 'pbv-wendi', bid_id: 'b1', bid_version_id: 'ver-A', name: 'WENDI', sort_order: 0 },
      { id: 'pbv-alt', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Alternate 1', sort_order: 1, include_in_submission: true },
    ]
    // The rows carry the plans' names, not the book's, so a row is priced only through its own
    // assignment (a row with none falls back to an entry of the same name — `resolveEntryForRow`).
    tableData.bids_count_rows = [
      { id: 'r1', bid_id: 'b1', bid_version_id: 'ver-A', fixture: 'L-1 Lavatory', count: 3, sequence_order: 0 },
      { id: 'r2', bid_id: 'b1', bid_version_id: 'ver-A', fixture: 'WC-1 Water closet', count: 2, sequence_order: 1 },
    ]
    tableData.cost_estimates = [{ id: 'ce1', bid_id: 'b1', labor_rate: 90 }]
    // Alternate 1 started as a copy of WENDI's book: same fixtures, its own entry ids, its own prices.
    tableData.price_book_entries = [
      { id: 'e-w1', version_id: 'pbv-wendi', total_price: 100, fixture_types: { name: 'Lavatory' } },
      { id: 'e-w2', version_id: 'pbv-wendi', total_price: 100, fixture_types: { name: 'Water closet' } },
      { id: 'e-a1', version_id: 'pbv-alt', total_price: 50, fixture_types: { name: 'Lavatory' } },
      { id: 'e-a2', version_id: 'pbv-alt', total_price: 50, fixture_types: { name: 'Water closet' } },
    ]
    tableData.bid_pricing_assignments = [
      { id: 'a-w1', bid_id: 'b1', price_book_version_id: 'pbv-wendi', count_row_id: 'r1', price_book_entry_id: 'e-w1', is_fixed_price: false, unit_price_override: null },
      { id: 'a-w2', bid_id: 'b1', price_book_version_id: 'pbv-wendi', count_row_id: 'r2', price_book_entry_id: 'e-w2', is_fixed_price: false, unit_price_override: null },
      { id: 'a-a1', bid_id: 'b1', price_book_version_id: 'pbv-alt', count_row_id: 'r1', price_book_entry_id: 'e-a1', is_fixed_price: false, unit_price_override: null },
      { id: 'a-a2', bid_id: 'b1', price_book_version_id: 'pbv-alt', count_row_id: 'r2', price_book_entry_id: 'e-a2', is_fixed_price: false, unit_price_override: null },
    ]
  })

  async function openOnWendi(): Promise<Hook> {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.onScreenRevenue).toBe(WENDI_TOTAL))
    return hook
  }

  it('a price typed on WENDI, then the Alternate 1 card clicked: the save\'s reload of WENDI lands last and the alternate keeps its prices', async () => {
    const hook = await openOnWendi()
    // The blur's save, then its reload of the price the save was for (commitWorkbenchTypedPrice).
    // The click that blurred the cell switches the card while that reload is still out.
    const releaseSaveReload = holdNextRead('bid_pricing_assignments', { price_book_version_id: 'pbv-wendi' })
    let saveReload: Promise<void> = Promise.resolve()
    act(() => {
      saveReload = hook.result.current.engine.loadBidPricingAssignments('b1', 'pbv-wendi')
    })
    viewPrice(hook, 'pbv-alt')
    await waitFor(() => expect(hook.result.current.onScreenRevenue).toBe(ALT_TOTAL))
    await act(async () => {
      releaseSaveReload()
      await saveReload
    })
    expect(hook.result.current.engine.selectedPricingVersionId).toBe('pbv-alt')
    expect(hook.result.current.onScreenRevenue).toBe(ALT_TOTAL)
    expect(hook.result.current.engine.pricingPricesReady).toBe(true)
  })

  it('a read of WENDI\'s book still out when the card is clicked lands last: the alternate keeps its own book', async () => {
    const hook = await openOnWendi()
    const releaseWendiBook = holdNextRead('price_book_entries', { version_id: 'pbv-wendi' })
    let wendiBook: Promise<void> = Promise.resolve()
    act(() => {
      wendiBook = hook.result.current.engine.loadPriceBookEntries('pbv-wendi')
    })
    viewPrice(hook, 'pbv-alt')
    await waitFor(() => expect(hook.result.current.onScreenRevenue).toBe(ALT_TOTAL))
    await act(async () => {
      releaseWendiBook()
      await wendiBook
    })
    expect(hook.result.current.engine.priceBookEntries.map((e) => e.id).sort()).toEqual(['e-a1', 'e-a2'])
    expect(hook.result.current.onScreenRevenue).toBe(ALT_TOTAL)
  })

  it('back and forth: whichever price is open last is the one on screen, however the reads land', async () => {
    const hook = await openOnWendi()
    const releaseAltRows = holdNextRead('bid_pricing_assignments', { price_book_version_id: 'pbv-alt' })
    const releaseAltBook = holdNextRead('price_book_entries', { version_id: 'pbv-alt' })
    viewPrice(hook, 'pbv-alt')
    viewPrice(hook, 'pbv-wendi')
    await act(async () => {
      releaseAltRows()
      releaseAltBook()
    })
    await waitFor(() => expect(hook.result.current.engine.pricingPricesReady).toBe(true))
    expect(hook.result.current.engine.selectedPricingVersionId).toBe('pbv-wendi')
    expect(hook.result.current.onScreenRevenue).toBe(WENDI_TOTAL)
  })

  it('while the open price\'s rows are still on their way, the screen knows it is loading — not empty', async () => {
    const hook = await openOnWendi()
    expect(hook.result.current.engine.pricingPricesReady).toBe(true)
    const releaseAltRows = holdNextRead('bid_pricing_assignments', { price_book_version_id: 'pbv-alt' })
    viewPrice(hook, 'pbv-alt')
    await act(async () => {})
    // WENDI's rows are still in state and the kernel skips them, so the open price would read $0.
    expect(hook.result.current.onScreenRevenue).toBe(0)
    expect(hook.result.current.engine.pricingPricesReady).toBe(false)
    await act(async () => {
      releaseAltRows()
    })
    await waitFor(() => expect(hook.result.current.engine.pricingPricesReady).toBe(true))
    expect(hook.result.current.onScreenRevenue).toBe(ALT_TOTAL)
  })

  it('a price with nothing priced yet is ready once its reads land, so it can still say "No prices yet"', async () => {
    tableData.price_book_versions!.push({ id: 'pbv-blank', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Alternate 2', sort_order: 2 })
    const hook = await openOnWendi()
    viewPrice(hook, 'pbv-blank')
    await waitFor(() => expect(hook.result.current.engine.pricingPricesReady).toBe(true))
    expect(hook.result.current.onScreenRevenue).toBe(0)
  })
})
