// @vitest-environment jsdom
/**
 * Cover Letter ★ re-align seam of `useBidPricingEngine` (v2.2013 effect, per-version since this fix).
 *
 * Entering the Cover Letter tab re-aligns the working pricing to the saved ★ — but the ★ is per
 * version (v2.2117), and `bids.selected_price_book_version_id` goes stale after a version switch
 * (`switchActiveVersion` never rewrites it). The re-align may only adopt a ★ that belongs to the
 * ACTIVE version; otherwise it keeps (or picks) that version's own pricing — never another GC's.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type Row = Record<string, unknown>
const tableData: Record<string, Row[]> = {}

// Filter-aware Supabase stand-in: selects honour eq/is/in; writes resolve to nothing.
vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    let op = 'select'
    const filters: ((r: Row) => boolean)[] = []
    const builder: Record<string, unknown> = {}
    const passthrough = ['select', 'neq', 'or', 'ilike', 'order', 'limit', 'range', 'abortSignal', 'not', 'gte', 'lte', 'gt', 'lt']
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
import type { BidWithBuilder } from '../types/bidWithBuilder'

type Props = { bid: BidWithBuilder; tab: string }

function makeBid(selectedVersion: string, savedPricing: string | null): BidWithBuilder {
  return {
    id: 'b1',
    selected_bid_version_id: selectedVersion,
    selected_price_book_version_id: savedPricing,
    materials_model: 'exact',
  } as unknown as BidWithBuilder
}

function mount(initial: Props) {
  return renderHook(
    ({ bid, tab }: Props) =>
      useBidPricingEngine({
        selectedBidForCounts: null,
        selectedBidForTakeoff: null,
        selectedBidForCostEstimate: null,
        selectedBidForPricing: bid,
        activeTab: tab,
        selectedServiceTypeId: '',
        authUser: { id: 'u1' },
        setError: () => {},
        loadBids: async () => [],
        setSharedBid: () => {},
      }),
    { initialProps: initial },
  )
}

/** Two GC versions, each with its own pricing; the bid-level ★ column says A's. */
function seedTwoGcVersions(opts: { verBStar?: string | null; verBPricings?: string[] } = {}) {
  tableData.bid_versions = [
    { id: 'ver-A', bid_id: 'b1', name: 'GC A', sort_order: 0, starred_price_book_version_id: 'pbv-A1' },
    { id: 'ver-B', bid_id: 'b1', name: 'GC B', sort_order: 1, starred_price_book_version_id: opts.verBStar ?? null },
  ]
  tableData.price_book_versions = [
    { id: 'pbv-A1', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Base', sort_order: 0 },
    { id: 'pbv-A2', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Tight', sort_order: 1 },
    ...(opts.verBPricings ?? ['pbv-B1']).map((id, i) => ({ id, bid_id: 'b1', bid_version_id: 'ver-B', name: id, sort_order: 2 + i })),
  ]
}

/** Open the bid on Pricing (version A, ★ A1), switch to B, then — like the real reload after
 *  `saveBidSelectedBidVersion` — hand back a bid whose active version is B but whose bid-level
 *  ★ column still names A's pricing, and visit Cover Letter. */
async function switchToBThenCoverLetter() {
  const hook = mount({ bid: makeBid('ver-A', 'pbv-A1'), tab: 'pricing' })
  await waitFor(() => expect(hook.result.current.selectedPricingVersionId).toBe('pbv-A1'))
  await act(async () => { await hook.result.current.switchActiveVersion('b1', 'ver-B') })
  const staleBid = makeBid('ver-B', 'pbv-A1')
  hook.rerender({ bid: staleBid, tab: 'pricing' })
  await act(async () => {})
  const onPricing = hook.result.current.selectedPricingVersionId
  hook.rerender({ bid: staleBid, tab: 'cover-letter' })
  await act(async () => {})
  await act(async () => {})
  return { hook, onPricing }
}

describe('useBidPricingEngine · Cover Letter ★ re-align is per version', () => {
  beforeEach(() => {
    for (const k of Object.keys(tableData)) delete tableData[k]
  })

  it("keeps version B's own pricing — the stale bid-level ★ (another GC's price) is not adopted", async () => {
    seedTwoGcVersions()
    const { hook, onPricing } = await switchToBThenCoverLetter()
    expect(onPricing).toBe('pbv-B1')
    expect(hook.result.current.selectedPricingVersionId).toBe('pbv-B1')
  })

  it("re-aligns to version B's own ★ when B has one", async () => {
    seedTwoGcVersions({ verBStar: 'pbv-B2', verBPricings: ['pbv-B1', 'pbv-B2'] })
    const { hook } = await switchToBThenCoverLetter()
    // View B1 on the Workbench (view-only, no persist), then visit the letter: the ★ wins.
    act(() => hook.result.current.setSelectedPricingVersionId('pbv-B1'))
    hook.rerender({ bid: makeBid('ver-B', 'pbv-A1'), tab: 'pricing' })
    await act(async () => {})
    hook.rerender({ bid: makeBid('ver-B', 'pbv-A1'), tab: 'cover-letter' })
    await act(async () => {})
    expect(hook.result.current.selectedPricingVersionId).toBe('pbv-B2')
  })

  it('leaves a version with no pricing of its own empty (no other GC price lands on it)', async () => {
    seedTwoGcVersions({ verBPricings: [] })
    const { hook, onPricing } = await switchToBThenCoverLetter()
    expect(onPricing).toBeNull()
    expect(hook.result.current.selectedPricingVersionId).toBeNull()
  })

  it('still re-aligns to the ★ on the active version (the v2.2013 behavior)', async () => {
    seedTwoGcVersions()
    const hook = mount({ bid: makeBid('ver-A', 'pbv-A1'), tab: 'pricing' })
    await waitFor(() => expect(hook.result.current.selectedPricingVersionId).toBe('pbv-A1'))
    act(() => hook.result.current.setSelectedPricingVersionId('pbv-A2'))
    await act(async () => {})
    hook.rerender({ bid: makeBid('ver-A', 'pbv-A1'), tab: 'cover-letter' })
    await act(async () => {})
    expect(hook.result.current.selectedPricingVersionId).toBe('pbv-A1')
  })
})
