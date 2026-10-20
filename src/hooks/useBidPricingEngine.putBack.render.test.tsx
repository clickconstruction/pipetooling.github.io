// @vitest-environment jsdom
/**
 * Bid history's put back on the bid's book pick (punch list #73, v2.5130): Undo of a book switch
 * writes the bid's pick and its version's ★ back, and the open Pricing tab must follow. Found on the
 * ZZ Test walk of 2026-10-10: the tab kept the switched-to book until a reload, so a price typed then
 * would have gone into the wrong book. The engine hears `BID_HISTORY_PUT_BACK_EVENT` and re-resolves
 * the book when the put back touched `bids` or `bid_versions`, and only then.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type Row = Record<string, unknown>
const tableData: Record<string, Row[]> = {}

// Filter-aware Supabase stand-in (as in the Cover Letter ★ test): selects honour eq/is/in; writes resolve to nothing.
vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    let op = 'select'
    const filters: ((r: Row) => boolean)[] = []
    const builder: Record<string, unknown> = {}
    const passthrough = ['select', 'neq', 'or', 'ilike', 'order', 'limit', 'range', 'abortSignal', 'not', 'gte', 'lte', 'gt', 'lt', 'setHeader']
    for (const m of passthrough) builder[m] = () => builder
    for (const m of ['insert', 'update', 'upsert', 'delete']) builder[m] = () => { op = m; return builder }
    builder.eq = (col: string, val: unknown) => { filters.push((r) => r[col] === val); return builder }
    builder.is = (col: string, val: unknown) => { filters.push((r) => (r[col] ?? null) === val); return builder }
    builder.in = (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return builder }
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (op !== 'select') return Promise.resolve({ data: single ? null : [], error: null })
      const rows = (tableData[table] ?? []).filter((r) => filters.every((f) => f(r)))
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null, count: rows.length })
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
import { BID_HISTORY_PUT_BACK_EVENT, type BidHistoryPutBackDetail } from '../lib/bids/bidHistoryPutBack'
import type { BidWithBuilder } from '../types/bidWithBuilder'

const bid = { id: 'b1', selected_bid_version_id: 'ver-A', selected_price_book_version_id: 'pbv-wendi', materials_model: 'exact' } as unknown as BidWithBuilder

function mount() {
  return renderHook(() =>
    useBidPricingEngine({
      selectedBidForCounts: null,
      selectedBidForTakeoff: null,
      selectedBidForCostEstimate: null,
      selectedBidForPricing: bid,
      activeTab: 'pricing',
      selectedServiceTypeId: '',
      authUser: { id: 'u1' },
      setError: () => {},
      loadBids: async () => [],
    }),
  )
}

const starOf = (id: string) => {
  tableData.bid_versions = [{ id: 'ver-A', bid_id: 'b1', name: 'To Plans', sort_order: 0, starred_price_book_version_id: id }]
}

const putBack = (detail: BidHistoryPutBackDetail) =>
  act(async () => {
    window.dispatchEvent(new CustomEvent<BidHistoryPutBackDetail>(BID_HISTORY_PUT_BACK_EVENT, { detail }))
  })

/** Open the bid on Pricing (its ★ WENDI), then switch it to Default as the price book drawer does: the ★ and the tab move. */
async function openThenSwitchToDefault() {
  starOf('pbv-wendi')
  const hook = mount()
  await waitFor(() => expect(hook.result.current.selectedPricingVersionId).toBe('pbv-wendi'))
  starOf('pbv-default')
  act(() => hook.result.current.setSelectedPricingVersionId('pbv-default'))
  await act(async () => {})
  expect(hook.result.current.selectedPricingVersionId).toBe('pbv-default')
  return hook
}

describe('useBidPricingEngine · a put back on the book pick moves the open tab', () => {
  beforeEach(() => {
    for (const k of Object.keys(tableData)) delete tableData[k]
    tableData.price_book_versions = [
      { id: 'pbv-wendi', bid_id: 'b1', bid_version_id: 'ver-A', name: 'WENDI', sort_order: 0 },
      { id: 'pbv-default', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Default', sort_order: 1 },
    ]
  })

  it('Undo of a book switch (the bid and its version written back) puts the tab back on the first book', async () => {
    const hook = await openThenSwitchToDefault()
    starOf('pbv-wendi')
    await putBack({ bidId: 'b1', table: 'bids' })
    await waitFor(() => expect(hook.result.current.selectedPricingVersionId).toBe('pbv-wendi'))
  })

  it('a put back of the version ★ alone moves it too', async () => {
    const hook = await openThenSwitchToDefault()
    starOf('pbv-wendi')
    await putBack({ bidId: 'b1', table: 'bid_versions' })
    await waitFor(() => expect(hook.result.current.selectedPricingVersionId).toBe('pbv-wendi'))
  })

  it('a put back of a price, or one on another bid, leaves the book the tab shows', async () => {
    const hook = await openThenSwitchToDefault()
    starOf('pbv-wendi')
    await putBack({ bidId: 'b1', table: 'bid_count_row_custom_prices' })
    await putBack({ bidId: 'b2', table: 'bids' })
    await act(async () => {})
    expect(hook.result.current.selectedPricingVersionId).toBe('pbv-default')
  })
})
