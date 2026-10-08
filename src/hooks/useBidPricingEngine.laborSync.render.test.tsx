// @vitest-environment jsdom
/**
 * The Labor tab's load sync keeps typed hours (bid history PR 0b, punch list #73) and never moves
 * one row twice (v2.4903): the writes `loadCostEstimateData` makes for each step of
 * `planLaborSync`, the tag each carries, and what the tables hold after.
 *
 * - a fixture renamed only by its [Group] prefix keeps its row (an update, labor-rename);
 * - a row no counted fixture claims is claimed by deleting it, then copied to the unmatched table
 *   (labor-park); a refused delete writes no copy;
 * - while the unmatched table cannot be read (before its migration), the row is deleted as before
 *   PR 0b (labor-sync); a refused copy leaves it deleted, as before;
 * - a counted fixture takes its set-aside row back by claiming it, before the book
 *   (labor-take-back); a refused live write puts the set-aside row back and mints nothing;
 * - two syncs started at once (a version switch starts several) set each row aside once and take
 *   it back once;
 * - the band's Use for writes the set-aside hours onto the chosen row (labor-use-parked);
 * - a sync that moves nothing reads the set-aside table once.
 *
 * Supabase is a small in-memory store: eq filters, inserts that keep the live table's
 * UNIQUE (cost_estimate_id, fixture), deletes that return what they removed, and a yield on every
 * call so two syncs interleave as they do in the browser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

/** One query: its table, its calls in order, the x-bid-action it was tagged with, and what it returned. */
type Query = { table: string; op: string; calls: { m: string; args: unknown[] }[]; tag: string | null; returned?: unknown }
type Row = Record<string, unknown>

const queries: Query[] = []
const db: Record<string, Row[]> = {}
/** `${table}:${op}` → an error the query resolves with. */
const tableErrors: Record<string, { message: string; code?: string }> = {}
const UNIQUE: Record<string, string[]> = { cost_estimate_labor_rows: ['cost_estimate_id', 'fixture'] }
/** Column defaults the database fills on insert. */
const DEFAULTS: Record<string, () => Row> = { cost_estimate_labor_rows_unmatched: () => ({ parked_at: new Date().toISOString() }) }
let nextId = 0

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    const q: Query = { table, op: 'select', calls: [], tag: null }
    queries.push(q)
    let single = false
    let payload: unknown = null
    const filters: [string, unknown][] = []
    const builder: Record<string, unknown> = {}
    const chain = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'ilike', 'order', 'limit', 'range', 'abortSignal']
    for (const m of chain) {
      builder[m] = (...args: unknown[]) => {
        if (m === 'insert' || m === 'update' || m === 'delete' || m === 'upsert') {
          q.op = m
          payload = args[0]
        }
        if (m === 'eq') filters.push([args[0] as string, args[1]])
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
    const result = async () => {
      await Promise.resolve()
      const error = tableErrors[`${table}:${q.op}`]
      if (error) return { data: null, error }
      const rows = (db[table] ??= [])
      const match = (r: Row) => filters.every(([c, v]) => r[c] === v)
      let data: Row[]
      if (q.op === 'insert') {
        const items = (Array.isArray(payload) ? payload : [payload]) as Row[]
        const key = UNIQUE[table]
        if (key && items.some((it) => rows.some((r) => key.every((k) => r[k] === it[k])))) {
          return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${table}` } }
        }
        data = items.map((it) => ({ id: `${table}-new-${++nextId}`, ...DEFAULTS[table]?.(), ...it }))
        rows.push(...data)
      } else if (q.op === 'update') {
        data = rows.filter(match)
        for (const r of data) Object.assign(r, payload as Row)
      } else if (q.op === 'delete') {
        data = rows.filter(match)
        db[table] = rows.filter((r) => !match(r))
      } else {
        data = rows.filter(match)
      }
      q.returned = data
      return { data: single ? data[0] ?? null : data.map((r) => ({ ...r })), error: null, count: data.length }
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
const setAside = (id: string, fixture: string, extra: object = {}) => ({ id, cost_estimate_id: 'ce1', fixture, count: 3, labor_row_id: 'old', parked_at: '2026-10-07T12:00:00Z', ...hours, ...extra })

const writes = (table: string, op: string) => queries.filter((q) => q.table === table && q.op === op)
const argOf = (q: Query, m: string) => q.calls.find((c) => c.m === m)?.args[0]
const fixtures = (table: string) => (db[table] ?? []).map((r) => r.fixture).sort()

async function load(times = 1) {
  const view = mount()
  act(() => view.result.current.setSelectedBidVersionId('b1', 'v1'))
  await act(async () => {
    await Promise.all(Array.from({ length: times }, () => view.result.current.loadCostEstimateData('b1', null)))
  })
  return view
}

describe('useBidPricingEngine · the Labor sync keeps typed hours, and moves each row once', () => {
  beforeEach(() => {
    queries.length = 0
    for (const k of Object.keys(db)) delete db[k]
    for (const k of Object.keys(tableErrors)) delete tableErrors[k]
    db.cost_estimates = [{ id: 'ce1', bid_id: 'b1' }]
    db.cost_estimate_labor_rows_unmatched = []
  })

  it('renames a row whose fixture lost its [Group] prefix: no delete, no mint', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 2)]
    db.cost_estimate_labor_rows = [laborRow('l1', '[Break room] WC', 2, { rough_in_hrs_per_unit: 3 })]
    await load()
    const updates = writes('cost_estimate_labor_rows', 'update')
    expect(updates).toHaveLength(1)
    expect(argOf(updates[0]!, 'update')).toEqual({ fixture: 'WC', count: 2 })
    expect(updates[0]!.tag).toBe('labor-rename')
    expect(writes('cost_estimate_labor_rows', 'delete')).toHaveLength(0)
    expect(writes('cost_estimate_labor_rows', 'insert')).toHaveLength(0)
    expect(db.cost_estimate_labor_rows![0]).toMatchObject({ id: 'l1', fixture: 'WC', rough_in_hrs_per_unit: 3 })
  })

  it('sets aside a row no counted fixture claims: claimed by its delete, then copied with its hours', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3, { rough_in_hrs_per_unit: 4.5 })]
    const { result } = await load()
    const claim = writes('cost_estimate_labor_rows', 'delete')
    expect(claim).toHaveLength(1)
    expect(claim[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'l2'] })
    expect(claim[0]!.tag).toBe('labor-park')
    const copy = writes('cost_estimate_labor_rows_unmatched', 'insert')
    expect(copy).toHaveLength(1)
    expect(argOf(copy[0]!, 'insert')).toEqual({ cost_estimate_id: 'ce1', fixture: 'Floor drain', count: 3, labor_row_id: 'l2', ...hours, rough_in_hrs_per_unit: 4.5 })
    expect(copy[0]!.tag).toBe('labor-park')
    expect(queries.indexOf(claim[0]!)).toBeLessThan(queries.indexOf(copy[0]!))
    expect(fixtures('cost_estimate_labor_rows')).toEqual(['WC'])
    expect(result.current.costEstimateUnmatchedLaborRows.map((r) => r.fixture)).toEqual(['Floor drain'])
  })

  it('a refused delete writes no copy: the row stays where it is', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableErrors['cost_estimate_labor_rows:delete'] = { message: 'lock timeout' }
    await load()
    expect(writes('cost_estimate_labor_rows_unmatched', 'insert')).toHaveLength(0)
    expect(fixtures('cost_estimate_labor_rows')).toEqual(['Floor drain', 'WC'])
  })

  it('falls back to the old delete while the unmatched table cannot be read (before its migration)', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableErrors['cost_estimate_labor_rows_unmatched:select'] = { message: 'relation "public.cost_estimate_labor_rows_unmatched" does not exist' }
    const { result } = await load()
    expect(writes('cost_estimate_labor_rows_unmatched', 'insert')).toHaveLength(0)
    const deletes = writes('cost_estimate_labor_rows', 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'l2'] })
    expect(deletes[0]!.tag).toBe('labor-sync')
    expect(result.current.costEstimateUnmatchedLaborRows).toEqual([])
  })

  it('a refused copy leaves the row deleted, as before PR 0b (the ledger keeps its values)', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1), laborRow('l2', 'Floor drain', 3)]
    tableErrors['cost_estimate_labor_rows_unmatched:insert'] = { message: 'permission denied' }
    await load()
    expect(writes('cost_estimate_labor_rows', 'delete')).toHaveLength(1)
    expect(fixtures('cost_estimate_labor_rows')).toEqual(['WC'])
    expect(fixtures('cost_estimate_labor_rows_unmatched')).toEqual([])
  })

  it('takes a set-aside row back when its fixture is counted again: claimed first, before the book', async () => {
    db.bids_count_rows = [countRow('cr1', 'Floor drain', 2)]
    db.cost_estimate_labor_rows = []
    db.cost_estimate_labor_rows_unmatched = [setAside('p1', 'Floor drain', { rough_in_hrs_per_unit: 4.5 })]
    await load()
    const claim = writes('cost_estimate_labor_rows_unmatched', 'delete')
    expect(claim).toHaveLength(1)
    expect(claim[0]!.calls).toContainEqual({ m: 'eq', args: ['id', 'p1'] })
    expect(claim[0]!.tag).toBe('labor-take-back')
    const back = writes('cost_estimate_labor_rows', 'insert')
    expect(back).toHaveLength(1)
    expect(argOf(back[0]!, 'insert')).toEqual({ cost_estimate_id: 'ce1', fixture: 'Floor drain', count: 2, sequence_order: 1, ...hours, rough_in_hrs_per_unit: 4.5 })
    expect(back[0]!.tag).toBe('labor-take-back')
    expect(queries.indexOf(claim[0]!)).toBeLessThan(queries.indexOf(back[0]!))
    expect(queries.some((q) => q.table === 'fixture_labor_defaults' && q.calls.some((c) => c.m === 'ilike'))).toBe(false)
    expect(fixtures('cost_estimate_labor_rows_unmatched')).toEqual([])
  })

  it('a refused live write puts the set-aside row back and mints nothing', async () => {
    db.bids_count_rows = [countRow('cr1', 'Floor drain', 2)]
    db.cost_estimate_labor_rows = []
    db.cost_estimate_labor_rows_unmatched = [setAside('p1', 'Floor drain', { rough_in_hrs_per_unit: 4.5 })]
    tableErrors['cost_estimate_labor_rows:insert'] = { message: 'permission denied' }
    await load()
    expect(writes('cost_estimate_labor_rows', 'insert')).toHaveLength(1)
    expect(db.cost_estimate_labor_rows_unmatched).toEqual([expect.objectContaining({ id: 'p1', fixture: 'Floor drain', rough_in_hrs_per_unit: 4.5 })])
    expect(queries.some((q) => q.table === 'fixture_labor_defaults' && q.calls.some((c) => c.m === 'ilike'))).toBe(false)
  })

  it('two syncs at once set each row aside once (the version switch on ZZ Test, 2026-10-07)', async () => {
    db.bids_count_rows = [countRow('cr1', 'Toilets', 5)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'Toilets', 5), laborRow('l2', 'WC', 5), laborRow('l3', 'WH', 1, { rough_in_hrs_per_unit: 2.25 })]
    await load(4)
    expect(fixtures('cost_estimate_labor_rows_unmatched')).toEqual(['WC', 'WH'])
    expect(writes('cost_estimate_labor_rows_unmatched', 'insert')).toHaveLength(2)
    expect(fixtures('cost_estimate_labor_rows')).toEqual(['Toilets'])
  })

  it('two syncs at once take each row back once, and mint nothing beside it', async () => {
    db.bids_count_rows = [countRow('cr1', 'Toilets', 5), countRow('cr2', 'WC', 5), countRow('cr3', 'WH', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'Toilets', 5)]
    db.cost_estimate_labor_rows_unmatched = [setAside('p1', 'WC'), setAside('p2', 'WH', { rough_in_hrs_per_unit: 2.25 })]
    await load(4)
    expect(fixtures('cost_estimate_labor_rows')).toEqual(['Toilets', 'WC', 'WH'])
    expect(db.cost_estimate_labor_rows!.find((r) => r.fixture === 'WH')).toMatchObject({ rough_in_hrs_per_unit: 2.25 })
    expect(fixtures('cost_estimate_labor_rows_unmatched')).toEqual([])
    expect(writes('cost_estimate_labor_rows', 'insert')).toHaveLength(2)
  })

  it('reads the set-aside rows once when the sync moved none', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1)]
    await load()
    expect(writes('cost_estimate_labor_rows_unmatched', 'select')).toHaveLength(1)
  })

  it('Use for puts the set-aside hours on the chosen row and lets the set-aside row go', async () => {
    db.bids_count_rows = [countRow('cr1', 'WC', 1)]
    db.cost_estimate_labor_rows = [laborRow('l1', 'WC', 1)]
    db.cost_estimate_labor_rows_unmatched = [setAside('p1', 'Water closet', { top_out_hrs_per_unit: 6 })]
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
