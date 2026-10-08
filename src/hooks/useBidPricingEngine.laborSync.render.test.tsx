// @vitest-environment jsdom
/**
 * The Labor tab's load sync keeps typed hours (bid history PR 0b, punch list #73): the writes
 * `loadCostEstimateData` makes for each step of `planLaborSync`, and the tag each carries.
 *
 * - a fixture renamed only by its [Group] prefix keeps its row (an update, labor-rename);
 * - a row no counted fixture claims is copied to the unmatched table and then deleted (labor-park);
 * - while the unmatched table cannot be read or written (before its migration is pushed), the row
 *   is deleted as before PR 0b (labor-sync), and nothing is written to the missing table;
 * - a counted fixture takes its set-aside row back, hours and all, before the book (labor-take-back);
 * - the band's Use for writes the set-aside hours onto the chosen row (labor-use-parked);
 * - a sync that moves nothing reads the set-aside table once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

/** One query: its table, its calls in order, and the x-bid-action it was tagged with. */
type Query = { table: string; op: string; calls: { m: string; args: unknown[] }[]; tag: string | null }

const queries: Query[] = []
const tableData: Record<string, unknown[]> = {}
/** `${table}:${op}` → an error the query resolves with. */
const tableErrors: Record<string, { message: string }> = {}

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    const q: Query = { table, op: 'select', calls: [], tag: null }
    queries.push(q)
    let single = false
    const builder: Record<string, unknown> = {}
    const chain = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'ilike', 'order', 'limit', 'range', 'abortSignal']
    for (const m of chain) {
      builder[m] = (...args: unknown[]) => {
        if (m === 'insert' || m === 'update' || m === 'delete' || m === 'upsert') q.op = m
        q.calls.push({ m, args })
        return builder
      }
    }
    builder.setHeader = (name: string, value: string) => {
      if (name === 'x-bid-action') q.tag = value
      return builder
    }
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      const error = tableErrors[`${table}:${q.op}`]
      if (error) return Promise.resolve({ data: null, error })
      if (q.op === 'insert') {
        const inserted = { id: `${table}-new`, ...(q.calls.find((c) => c.m === 'insert')?.args[0] as object) }
        return Promise.resolve({ data: single ? inserted : [inserted], error: null })
      }
      if (q.op !== 'select') return Promise.resolve({ data: single ? { id: 'ok' } : [{ id: 'ok' }], error: null })
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
    }),
  )
}

const hours = { rough_in_hrs_per_unit: 1.5, top_out_hrs_per_unit: 2, trim_set_hrs_per_unit: 0.75, is_fixed: false, kind: 'fixture', unit: 'each', source: null, source_note: null }
const countRow = (id: string, fixture: string, count: number) => ({ id, bid_id: 'b1', bid_version_id: 'v1', fixture, count, sequence_order: 1 })
const laborRow = (id: string, fixture: string, count: number, extra: object = {}) => ({ id, cost_estimate_id: 'ce1', fixture, count, sequence_order: 1, created_at: null, ...hours, ...extra })

const writes = (table: string, op: string) => queries.filter((q) => q.table === table && q.op === op)
const argOf = (q: Query, m: string) => q.calls.find((c) => c.m === m)?.args[0]

async function load() {
  const view = mount()
  act(() => view.result.current.setSelectedBidVersionId('b1', 'v1'))
  await act(async () => { await view.result.current.loadCostEstimateData('b1', null) })
  return view
}

describe('useBidPricingEngine · the Labor sync keeps typed hours', () => {
  beforeEach(() => {
    queries.length = 0
    for (const k of Object.keys(tableData)) delete tableData[k]
    for (const k of Object.keys(tableErrors)) delete tableErrors[k]
    tableData.cost_estimates = [{ id: 'ce1', bid_id: 'b1' }]
  })

  it('renames a row whose fixture lost its [Group] prefix: no delete, no mint', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 2)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', '[Break room] WC', 2, { rough_in_hrs_per_unit: 3 })]
    tableData.cost_estimate_labor_rows_unmatched = []
    await load()
    const updates = writes('cost_estimate_labor_rows', 'update')
    expect(updates).toHaveLength(1)
    expect(argOf(updates[0]!, 'update')).toEqual({ fixture: 'WC', count: 2 })
    expect(updates[0]!.tag).toBe('labor-rename')
    expect(writes('cost_estimate_labor_rows', 'delete')).toHaveLength(0)
    expect(writes('cost_estimate_labor_rows', 'insert')).toHaveLength(0)
  })

  it('sets aside a row no counted fixture claims: copied with its hours, then deleted', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3, { rough_in_hrs_per_unit: 4.5 })]
    tableData.cost_estimate_labor_rows_unmatched = []
    const { result } = await load()
    const parked = writes('cost_estimate_labor_rows_unmatched', 'insert')
    expect(parked).toHaveLength(1)
    expect(argOf(parked[0]!, 'insert')).toEqual({ cost_estimate_id: 'ce1', fixture: 'Floor drain', count: 3, labor_row_id: 'l2', ...hours, rough_in_hrs_per_unit: 4.5 })
    expect(parked[0]!.tag).toBe('labor-park')
    const deletes = writes('cost_estimate_labor_rows', 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'l2'] })
    expect(deletes[0]!.tag).toBe('labor-park')
    // The copy is written before the row goes.
    expect(queries.indexOf(parked[0]!)).toBeLessThan(queries.indexOf(deletes[0]!))
    expect(result.current.costEstimateUnmatchedLaborRows).toEqual([])
  })

  it('falls back to the old delete while the unmatched table cannot be read (before its migration)', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableErrors['cost_estimate_labor_rows_unmatched:select'] = { message: 'relation "public.cost_estimate_labor_rows_unmatched" does not exist' }
    const { result } = await load()
    expect(writes('cost_estimate_labor_rows_unmatched', 'insert')).toHaveLength(0)
    const deletes = writes('cost_estimate_labor_rows', 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'l2'] })
    expect(deletes[0]!.tag).toBe('labor-sync')
    expect(result.current.costEstimateUnmatchedLaborRows).toEqual([])
  })

  it('falls back to the old delete when the copy cannot be written', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableData.cost_estimate_labor_rows_unmatched = []
    tableErrors['cost_estimate_labor_rows_unmatched:insert'] = { message: 'permission denied' }
    await load()
    const deletes = writes('cost_estimate_labor_rows', 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]!.tag).toBe('labor-sync')
  })

  it('removes the copy again when the row itself cannot be deleted: one place for the hours', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableData.cost_estimate_labor_rows_unmatched = []
    tableErrors['cost_estimate_labor_rows:delete'] = { message: 'lock timeout' }
    await load()
    const undo = writes('cost_estimate_labor_rows_unmatched', 'delete')
    expect(undo).toHaveLength(1)
    expect(undo[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'cost_estimate_labor_rows_unmatched-new'] })
  })

  it('takes a set-aside row back when its fixture is counted again, before the book', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'Floor drain', 2)]
    tableData.cost_estimate_labor_rows = []
    tableData.cost_estimate_labor_rows_unmatched = [
      { id: 'p1', cost_estimate_id: 'ce1', fixture: 'Floor drain', count: 3, labor_row_id: 'l2', parked_at: '2026-10-07T12:00:00Z', ...hours, rough_in_hrs_per_unit: 4.5 },
    ]
    await load()
    const back = writes('cost_estimate_labor_rows', 'insert')
    expect(back).toHaveLength(1)
    expect(argOf(back[0]!, 'insert')).toEqual({ cost_estimate_id: 'ce1', fixture: 'Floor drain', count: 2, sequence_order: 1, ...hours, rough_in_hrs_per_unit: 4.5 })
    expect(back[0]!.tag).toBe('labor-take-back')
    const gone = writes('cost_estimate_labor_rows_unmatched', 'delete')
    expect(gone).toHaveLength(1)
    expect(gone[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'p1'] })
    expect(gone[0]!.tag).toBe('labor-take-back')
    expect(queries.some((q) => q.table === 'fixture_labor_defaults' && q.calls.some((c) => c.m === 'ilike'))).toBe(false)
  })

  it('reads the set-aside rows once when the sync moved none', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1)]
    tableData.cost_estimate_labor_rows_unmatched = []
    await load()
    expect(writes('cost_estimate_labor_rows_unmatched', 'select')).toHaveLength(1)
  })

  it('Use for puts the set-aside hours on the chosen row and lets the set-aside row go', async () => {
    tableData.bids_count_rows = [countRow('cr1', 'WC', 1)]
    tableData.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1)]
    tableData.cost_estimate_labor_rows_unmatched = [
      { id: 'p1', cost_estimate_id: 'ce1', fixture: 'Water closet', count: 1, labor_row_id: 'old', parked_at: '2026-10-07T12:00:00Z', ...hours, top_out_hrs_per_unit: 6 },
    ]
    const { result } = await load()
    expect(result.current.costEstimateUnmatchedLaborRows.map((r) => r.id)).toEqual(['p1'])
    queries.length = 0
    let ok = false
    await act(async () => { ok = await result.current.applyUnmatchedLaborRow('p1', 'l1') })
    expect(ok).toBe(true)
    const used = writes('cost_estimate_labor_rows', 'update')
    expect(argOf(used[0]!, 'update')).toEqual({ ...hours, top_out_hrs_per_unit: 6 })
    expect(used[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'l1'] })
    expect(used[0]!.tag).toBe('labor-use-parked')
    expect(writes('cost_estimate_labor_rows_unmatched', 'delete')[0]!.tag).toBe('labor-use-parked')
    expect(result.current.costEstimateUnmatchedLaborRows).toEqual([])
    expect(result.current.costEstimateLaborRows.find((r) => r.id === 'l1')?.top_out_hrs_per_unit).toBe(6)
  })
})
