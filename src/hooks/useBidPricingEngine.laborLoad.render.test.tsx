// @vitest-environment jsdom
/**
 * Labor-tab load seam of `useBidPricingEngine` (journey-map J11-F1 / T1 / N1):
 *
 * - `loadCostEstimateData` filters the count rows on the bid's ACTIVE version (the ref the
 *   Labor effect resolves first) — never on Base for a versioned bid.
 * - Opening a bid with no fixtures mints no `cost_estimates` row; the first write
 *   (`ensureCostEstimateForBid`) does, exactly once.
 * - A bid with fixtures still mints on load: the HOURS table is made of
 *   `cost_estimate_labor_rows`, which need the parent row.
 * - The load lifecycle settles for the bid so the tab can leave its skeleton.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

type Op = { table: string; op: string; args: unknown[] }

const recorded: Op[] = []
const tableData: Record<string, unknown[]> = {}

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    let op = 'select'
    const builder: Record<string, unknown> = {}
    const chain = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'ilike', 'order', 'limit', 'range', 'abortSignal']
    for (const m of chain) {
      builder[m] = (...args: unknown[]) => {
        if (m === 'insert' || m === 'update' || m === 'delete' || m === 'upsert') op = m
        recorded.push({ table, op: m, args })
        return builder
      }
    }
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (op === 'insert') {
        const lastInsert = recorded.filter((r) => r.table === table && r.op === 'insert').slice(-1)[0]
        const inserted = { id: `${table}-new`, ...(lastInsert?.args[0] as object) }
        return Promise.resolve({ data: single ? inserted : [inserted], error: null })
      }
      if (op !== 'select') return Promise.resolve({ data: single ? null : [], error: null })
      const rows = tableData[table] ?? []
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

const bid = { id: 'b1', selected_bid_version_id: 'v1', materials_model: 'exact' } as unknown as BidWithBuilder

function mount() {
  return renderHook(() =>
    useBidPricingEngine({
      selectedBidForCounts: null,
      selectedBidForTakeoff: null,
      selectedBidForCostEstimate: bid,
      selectedBidForPricing: null,
      activeTab: 'labor',
      selectedServiceTypeId: '',
      authUser: { id: 'u1' },
      setError: () => {},
      loadBids: async () => [],
      setSharedBid: () => {},
    }),
  )
}

const insertsInto = (table: string) => recorded.filter((r) => r.table === table && r.op === 'insert')

describe('useBidPricingEngine · Labor load seam', () => {
  beforeEach(() => {
    recorded.length = 0
    for (const k of Object.keys(tableData)) delete tableData[k]
  })

  it('filters count rows on the resolved active version, not Base', async () => {
    const { result } = mount()
    act(() => result.current.setSelectedBidVersionId('b1', 'v1'))
    await act(async () => { await result.current.loadCostEstimateData('b1', null) })
    const countQuery = recorded.filter((r) => r.table === 'bids_count_rows' && (r.op === 'eq' || r.op === 'is'))
    expect(countQuery).toContainEqual({ table: 'bids_count_rows', op: 'eq', args: ['bid_version_id', 'v1'] })
    expect(countQuery.some((r) => r.op === 'is' && r.args[0] === 'bid_version_id')).toBe(false)
  })

  it('does not mint a cost_estimates row when the resolved version has no fixtures; the first write does, once', async () => {
    const { result } = mount()
    act(() => result.current.setSelectedBidVersionId('b1', 'v1'))
    await act(async () => { await result.current.loadCostEstimateData('b1', null) })
    expect(insertsInto('cost_estimates')).toHaveLength(0)
    expect(result.current.costEstimate).toBeNull()
    expect(result.current.costEstimateResolve).toEqual({ bidId: 'b1', status: 'ready' })

    await act(async () => { await result.current.ensureCostEstimateForBid('b1') })
    expect(insertsInto('cost_estimates')).toHaveLength(1)
    expect(insertsInto('cost_estimates')[0]!.args[0]).toEqual({ bid_id: 'b1' })
    expect(result.current.costEstimate?.id).toBe('cost_estimates-new')
  })

  it('mints once on load when the resolved version has fixtures (the HOURS rows need the parent row)', async () => {
    tableData.bids_count_rows = [{ id: 'cr1', bid_id: 'b1', bid_version_id: 'v1', fixture: 'Lavatory', count: 4, sequence_order: 1 }]
    const { result } = mount()
    act(() => result.current.setSelectedBidVersionId('b1', 'v1'))
    await act(async () => { await result.current.loadCostEstimateData('b1', null) })
    expect(insertsInto('cost_estimates')).toHaveLength(1)
    expect(insertsInto('cost_estimate_labor_rows').length).toBeGreaterThan(0)
    expect(result.current.costEstimateCountRows).toHaveLength(1)
    expect(result.current.costEstimateResolve).toEqual({ bidId: 'b1', status: 'ready' })
  })

  it('starts unresolved for a bid it has never loaded (the frame the Labor tab shows as a skeleton)', async () => {
    const { result } = mount()
    await act(async () => {}) // flush mount-time loaders
    expect(result.current.costEstimateResolve.bidId).not.toBe('b1')
  })
})
