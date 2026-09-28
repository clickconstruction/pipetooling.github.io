// @vitest-environment jsdom
/**
 * The Bids page's loads through their hook: what the role load keeps of a person's trade
 * scope, which trade the page starts on, what `loadBids` asks the database for (the trade, a
 * primary's own bids, never an adopted bid), how it flattens the embedded rows, and when the
 * three load gates fire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useState } from 'react'
import type { BidsTabKey } from '../lib/bids/bidsTabAccess'
import { useBidsLoadGates, useBidsPageData } from './useBidsPageData'

type Answer = { data: unknown; error: { message: string } | null }
type Query = { table: string; calls: Array<[string, ...unknown[]]> }

const db = vi.hoisted(() => ({
  answers: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  queries: [] as Array<{ table: string; calls: Array<[string, ...unknown[]]> }>,
}))

vi.mock('../lib/supabase', () => {
  function builder(table: string) {
    const query: Query = { table, calls: [] }
    db.queries.push(query)
    let single = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'or', 'in', 'order', 'limit', 'range']) {
      b[m] = (...args: unknown[]) => {
        query.calls.push([m, ...args])
        return b
      }
    }
    b.single = () => {
      single = true
      return b
    }
    b.then = (ok?: (v: unknown) => unknown, no?: (e: unknown) => unknown) => {
      const answer: Answer = db.answers[table] ?? { data: single ? null : [], error: null }
      const data = single && Array.isArray(answer.data) ? (answer.data[0] ?? null) : answer.data
      return Promise.resolve({ ...answer, data }).then(ok, no)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
vi.mock('../lib/bids/bidGcRecipients', () => ({
  fetchBidGcRecipientsMap: () => Promise.resolve({ 'bid-1': [{ id: 'r-1' }] }),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
beforeEach(() => {
  db.answers = {}
  db.queries = []
})

const TRADES = [
  { id: 'st-e', name: 'Electrical', sequence_order: 1 },
  { id: 'st-p', name: 'Plumbing', sequence_order: 2 },
  { id: 'st-h', name: 'HVAC', sequence_order: 3 },
]

function setup(opts: { authUserId?: string | null; trade?: string } = {}) {
  const setLoading = vi.fn()
  const setError = vi.fn()
  const hook = renderHook(() => {
    const [selectedServiceTypeId, setSelectedServiceTypeId] = useState(opts.trade ?? '')
    const data = useBidsPageData({
      authUserId: opts.authUserId === undefined ? 'user-1' : opts.authUserId,
      selectedServiceTypeId,
      setSelectedServiceTypeId,
      setLoading,
      setError,
    })
    return { data, selectedServiceTypeId }
  })
  return { ...hook, setLoading, setError }
}

const queriesOn = (table: string) => db.queries.filter((q) => q.table === table)
const lastQueryOn = (table: string) => {
  const list = queriesOn(table)
  return list[list.length - 1]!
}
const callsNamed = (q: Query, name: string) => q.calls.filter((c) => c[0] === name).map((c) => c.slice(1))

describe('useBidsPageData — the role load', () => {
  it('with nobody signed in, stops loading and asks nothing', async () => {
    const { result, setLoading } = setup({ authUserId: null })
    await act(async () => { await result.current.data.loadRole() })
    expect(setLoading).toHaveBeenCalledWith(false)
    expect(db.queries).toEqual([])
    expect(result.current.data.myRole).toBeNull()
  })

  it('keeps an estimator’s trades and nobody else’s', async () => {
    db.answers.users = { data: [{ role: 'estimator', estimator_service_type_ids: ['st-p'], primary_service_type_ids: ['st-e'], superintendent_service_type_ids: ['st-h'] }], error: null }
    const { result, setLoading } = setup()
    await act(async () => { await result.current.data.loadRole() })
    expect(result.current.data.myRole).toBe('estimator')
    expect(result.current.data.estimatorServiceTypeIds).toEqual(['st-p'])
    expect(result.current.data.primaryServiceTypeIds).toBeNull()
    expect(result.current.data.superintendentServiceTypeIds).toBeNull()
    expect(setLoading).not.toHaveBeenCalled()
    expect(callsNamed(lastQueryOn('users'), 'eq')).toEqual([['id', 'user-1']])
  })

  it('keeps a primary’s and a superintendent’s own list', async () => {
    db.answers.users = { data: [{ role: 'primary', estimator_service_type_ids: ['st-p'], primary_service_type_ids: ['st-e'], superintendent_service_type_ids: null }], error: null }
    const primary = setup()
    await act(async () => { await primary.result.current.data.loadRole() })
    expect(primary.result.current.data.primaryServiceTypeIds).toEqual(['st-e'])
    expect(primary.result.current.data.estimatorServiceTypeIds).toBeNull()
    cleanup()
    db.answers.users = { data: [{ role: 'superintendent', superintendent_service_type_ids: ['st-h'] }], error: null }
    const sup = setup()
    await act(async () => { await sup.result.current.data.loadRole() })
    expect(sup.result.current.data.superintendentServiceTypeIds).toEqual(['st-h'])
  })

  it('an empty list is no scope', async () => {
    db.answers.users = { data: [{ role: 'estimator', estimator_service_type_ids: [] }], error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadRole() })
    expect(result.current.data.estimatorServiceTypeIds).toBeNull()
  })

  it('a role with no Bids access stops loading', async () => {
    db.answers.users = { data: [{ role: 'helpers' }], error: null }
    const { result, setLoading } = setup()
    await act(async () => { await result.current.data.loadRole() })
    expect(result.current.data.myRole).toBe('helpers')
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it('a failed read says why and stops loading', async () => {
    db.answers.users = { data: null, error: { message: 'permission denied' } }
    const { result, setLoading, setError } = setup()
    await act(async () => { await result.current.data.loadRole() })
    expect(setError).toHaveBeenCalledWith('permission denied')
    expect(setLoading).toHaveBeenCalledWith(false)
    expect(result.current.data.myRole).toBeNull()
  })
})

describe('useBidsPageData — which trade the page starts on', () => {
  it('Plumbing first, whatever the order', async () => {
    db.answers.service_types = { data: TRADES, error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadServiceTypes() })
    expect(result.current.data.serviceTypes).toHaveLength(3)
    expect(result.current.selectedServiceTypeId).toBe('st-p')
  })

  it('Electrical when there is no Plumbing, else the first listed', async () => {
    db.answers.service_types = { data: TRADES.filter((t) => t.name !== 'Plumbing'), error: null }
    const electrical = setup()
    await act(async () => { await electrical.result.current.data.loadServiceTypes() })
    expect(electrical.result.current.selectedServiceTypeId).toBe('st-e')
    cleanup()
    db.answers.service_types = { data: [{ id: 'st-h', name: 'HVAC', sequence_order: 3 }, { id: 'st-x', name: 'Gas', sequence_order: 4 }], error: null }
    const first = setup()
    await act(async () => { await first.result.current.data.loadServiceTypes() })
    expect(first.result.current.selectedServiceTypeId).toBe('st-h')
  })

  it('keeps the trade already picked when it is still allowed', async () => {
    db.answers.service_types = { data: TRADES, error: null }
    const { result } = setup({ trade: 'st-h' })
    await act(async () => { await result.current.data.loadServiceTypes() })
    expect(result.current.selectedServiceTypeId).toBe('st-h')
  })

  it('an estimator scoped to one trade starts on it, and a picked trade outside the scope is replaced', async () => {
    db.answers.users = { data: [{ role: 'estimator', estimator_service_type_ids: ['st-h'] }], error: null }
    db.answers.service_types = { data: TRADES, error: null }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadRole() })
    await act(async () => { await result.current.data.loadServiceTypes() })
    expect(result.current.selectedServiceTypeId).toBe('st-h')
    expect(result.current.data.serviceTypes).toHaveLength(3)
  })

  it('a scope that matches no trade falls back to every trade', async () => {
    db.answers.users = { data: [{ role: 'primary', primary_service_type_ids: ['st-gone'] }], error: null }
    db.answers.service_types = { data: TRADES, error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadRole() })
    await act(async () => { await result.current.data.loadServiceTypes() })
    expect(result.current.selectedServiceTypeId).toBe('st-p')
  })

  it('a failed read says why and picks nothing', async () => {
    db.answers.service_types = { data: null, error: { message: 'down' } }
    const { result, setError } = setup()
    await act(async () => { await result.current.data.loadServiceTypes() })
    expect(setError).toHaveBeenCalledWith('Failed to load service types: down')
    expect(result.current.selectedServiceTypeId).toBe('')
  })

  it('fixture types load for the picked trade only', async () => {
    db.answers.fixture_types = { data: [{ id: 'f-1', name: 'Lavatory' }], error: null }
    const none = setup()
    await act(async () => { await none.result.current.data.loadFixtureTypes() })
    expect(queriesOn('fixture_types')).toEqual([])
    cleanup()
    const picked = setup({ trade: 'st-p' })
    await act(async () => { await picked.result.current.data.loadFixtureTypes() })
    expect(picked.result.current.data.fixtureTypes).toEqual([{ id: 'f-1', name: 'Lavatory' }])
    expect(callsNamed(lastQueryOn('fixture_types'), 'eq')).toEqual([['service_type_id', 'st-p']])
  })
})

describe('useBidsPageData — loadBids', () => {
  const ROW = {
    id: 'bid-1',
    bid_number: '482',
    customers: [{ id: 'c-1', name: 'H & I Construction' }],
    bids_gc_builders: null,
    estimator: [{ id: 'u-1', name: 'Tristen', email: 't@x.test' }],
    account_manager: { id: 'u-2', name: 'Wendi', email: 'w@x.test' },
  }

  it('asks for the picked trade, never an adopted bid, newest due first', async () => {
    db.answers.bids = { data: [ROW], error: null }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadBids() })
    const q = lastQueryOn('bids')
    expect(callsNamed(q, 'is')).toEqual([['adopted_into_bid_id', null]])
    expect(callsNamed(q, 'eq')).toEqual([['service_type_id', 'st-p']])
    expect(callsNamed(q, 'or')).toEqual([])
    expect(callsNamed(q, 'order')).toEqual([['bid_due_date', { ascending: false, nullsFirst: true }]])
  })

  it('a trade handed in wins over the picked one; null asks for every trade', async () => {
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadBids('st-h') })
    expect(callsNamed(lastQueryOn('bids'), 'eq')).toEqual([['service_type_id', 'st-h']])
    await act(async () => { await result.current.data.loadBids(null) })
    expect(callsNamed(lastQueryOn('bids'), 'eq')).toEqual([])
  })

  it('a primary’s board is the bids they are on', async () => {
    db.answers.users = { data: [{ role: 'primary' }], error: null }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadRole() })
    await act(async () => { await result.current.data.loadBids() })
    expect(callsNamed(lastQueryOn('bids'), 'or')).toEqual([['estimator_id.eq.user-1,account_manager_id.eq.user-1,created_by.eq.user-1']])
  })

  it('flattens the embedded rows and hands the rows back', async () => {
    db.answers.bids = { data: [ROW], error: null }
    const { result } = setup({ trade: 'st-p' })
    let rows: unknown[] = []
    await act(async () => { rows = await result.current.data.loadBids() })
    expect(rows).toHaveLength(1)
    const bid = result.current.data.bids[0]!
    expect(bid.customers).toEqual({ id: 'c-1', name: 'H & I Construction' })
    expect(bid.bids_gc_builders).toBeNull()
    expect(bid.estimator).toEqual({ id: 'u-1', name: 'Tristen', email: 't@x.test' })
    expect(bid.account_manager).toEqual({ id: 'u-2', name: 'Wendi', email: 'w@x.test' })
    expect(result.current.data.bidsLoaded).toBe(true)
  })

  it('reads the contact recency and the GC recipients with the bids', async () => {
    db.answers.bids = { data: [ROW], error: null }
    db.answers.bids_submission_entries = {
      data: [
        { bid_id: 'bid-1', occurred_at: '2026-09-01T12:00:00Z', contact_method: 'phone' },
        { bid_id: 'bid-1', occurred_at: '2026-09-20T12:00:00Z', contact_method: null },
      ],
      error: null,
    }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadBids() })
    expect(result.current.data.lastContactFromEntries['bid-1']).toBe('2026-09-20T12:00:00Z')
    expect(result.current.data.lastMethodContactFromEntries['bid-1']).toBe('2026-09-01T12:00:00Z')
    expect(result.current.data.bidGcRecipientsByBidId).toEqual({ 'bid-1': [{ id: 'r-1' }] })
  })

  it('reads the entries of the bids in hand, in pages', async () => {
    db.answers.bids = { data: [ROW, { ...ROW, id: 'bid-2' }], error: null }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadBids() })
    const q = lastQueryOn('bids_submission_entries')
    expect(callsNamed(q, 'in')).toEqual([['bid_id', ['bid-1', 'bid-2']]])
    expect(callsNamed(q, 'order').map((c) => c[0])).toEqual(['bid_id', 'id'])
    expect(callsNamed(q, 'range')).toEqual([[0, 999]])
  })

  it('no bids, no entries read', async () => {
    db.answers.bids = { data: [], error: null }
    const { result } = setup({ trade: 'st-p' })
    await act(async () => { await result.current.data.loadBids() })
    expect(queriesOn('bids_submission_entries')).toEqual([])
    expect(result.current.data.lastContactFromEntries).toEqual({})
  })

  it('a failed entries read shows no recency and still hands the bids back', async () => {
    db.answers.bids = { data: [ROW], error: null }
    db.answers.bids_submission_entries = { data: null, error: { message: 'timeout' } }
    const { result, setError } = setup({ trade: 'st-p' })
    let rows: unknown[] = []
    await act(async () => { rows = await result.current.data.loadBids() })
    expect(rows).toHaveLength(1)
    expect(result.current.data.lastContactFromEntries).toEqual({})
    expect(result.current.data.lastMethodContactFromEntries).toEqual({})
    expect(setError).not.toHaveBeenCalled()
  })

  it('a failed read says why, ends the skeleton and hands back nothing', async () => {
    db.answers.bids = { data: null, error: { message: 'timeout' } }
    const { result, setError } = setup({ trade: 'st-p' })
    let rows: unknown[] = [1]
    await act(async () => { rows = await result.current.data.loadBids() })
    expect(rows).toEqual([])
    expect(setError).toHaveBeenCalledWith('Failed to load bids: timeout')
    expect(result.current.data.bidsLoaded).toBe(true)
    expect(queriesOn('bids_submission_entries')).toEqual([])
  })
})

describe('useBidsPageData — the rest of the loads', () => {
  it('customers: commercial or untyped, archived ones left out of the picker', async () => {
    db.answers.customers = { data: [{ id: 'c-1', name: 'Live', archived_at: null }, { id: 'c-2', name: 'Gone', archived_at: '2026-01-01T00:00:00Z' }], error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadCustomers() })
    expect(result.current.data.customers.map((c) => c.id)).toEqual(['c-1'])
    expect(callsNamed(lastQueryOn('customers'), 'or')).toEqual([['customer_type.is.null,customer_type.eq.commercial']])
  })

  it('estimators: nobody archived, no helpers, no "delete" placeholder', async () => {
    db.answers.users = { data: [{ id: 'u-1', name: 'Tristen' }, { id: 'u-2', name: ' Delete ' }, { id: 'u-3', name: null }], error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadEstimatorUsers() })
    expect(result.current.data.estimatorUsers.map((u) => u.id)).toEqual(['u-1', 'u-3'])
    const q = lastQueryOn('users')
    expect(callsNamed(q, 'is')).toEqual([['archived_at', null]])
    expect(callsNamed(q, 'neq')).toEqual([['role', 'helpers']])
  })

  it('twin user ids: the flagged users, archived or not', async () => {
    db.answers.users = { data: [{ id: 'twin-1' }, { id: 'twin-2' }], error: null }
    const { result } = setup()
    await act(async () => { await result.current.data.loadTwinUserIds() })
    expect([...result.current.data.twinUserIds]).toEqual(['twin-1', 'twin-2'])
    const q = lastQueryOn('users')
    expect(callsNamed(q, 'eq')).toEqual([['is_digital_twin', true]])
    expect(callsNamed(q, 'is')).toEqual([])
  })

  it('contacts and contact persons load, and a failure says which', async () => {
    db.answers.customer_contacts = { data: [{ id: 'cc-1' }], error: null }
    db.answers.customer_contact_persons = { data: null, error: { message: 'down' } }
    const { result, setError } = setup()
    await act(async () => { await result.current.data.loadCustomerContacts() })
    await act(async () => { await result.current.data.loadCustomerContactPersons() })
    expect(result.current.data.customerContacts).toEqual([{ id: 'cc-1' }])
    expect(setError).toHaveBeenCalledWith('Failed to load contact persons: down')
  })
})

describe('useBidsLoadGates', () => {
  function setupGates(role: string | null, initial: { activeTab: BidsTabKey; trade: string }) {
    const calls: string[] = []
    const setLoading = vi.fn()
    const loader = (name: string) => () => {
      calls.push(name)
      return Promise.resolve()
    }
    const data = {
      myRole: role,
      estimatorServiceTypeIds: null,
      primaryServiceTypeIds: null,
      superintendentServiceTypeIds: null,
      loadServiceTypes: loader('serviceTypes'),
      loadFixtureTypes: loader('fixtureTypes'),
      loadBids: (trade?: string | null) => {
        calls.push(`bids:${trade === null ? 'every trade' : trade}`)
        return Promise.resolve([])
      },
      loadCustomers: loader('customers'),
      loadCustomerContacts: loader('contacts'),
      loadCustomerContactPersons: loader('contactPersons'),
      loadEstimatorUsers: loader('estimators'),
      loadTwinUserIds: loader('twins'),
    } as unknown as Parameters<typeof useBidsLoadGates>[0]
    const hook = renderHook(
      (p: { activeTab: BidsTabKey; trade: string }) =>
        useBidsLoadGates(data, { activeTab: p.activeTab, selectedServiceTypeId: p.trade, setLoading, loadBooks: () => [loader('books')()] }),
      { initialProps: initial },
    )
    return { ...hook, calls, setLoading }
  }

  beforeEach(() => vi.useFakeTimers())

  it('a role that may open Bids loads the trades, then the fixture types, then stops loading', async () => {
    const { calls, setLoading } = setupGates('estimator', { activeTab: 'bid-board', trade: '' })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(calls).toEqual(['serviceTypes', 'fixtureTypes'])
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it('no role yet, or a role with no access, loads nothing', async () => {
    const none = setupGates(null, { activeTab: 'bid-board', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    expect(none.calls).toEqual([])
    const helper = setupGates('helpers', { activeTab: 'builder-review', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    expect(helper.calls).toEqual([])
    expect(helper.setLoading).not.toHaveBeenCalled()
  })

  it('a picked trade loads the page’s data for that trade, 80 ms on', async () => {
    const { calls } = setupGates('estimator', { activeTab: 'bid-board', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(79) })
    expect(calls).toEqual(['serviceTypes', 'fixtureTypes'])
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(calls.slice(2)).toEqual(['customers', 'bids:st-p', 'contacts', 'contactPersons', 'estimators', 'twins', 'fixtureTypes', 'books'])
  })

  it('By builder loads every trade’s bids instead', async () => {
    const { calls } = setupGates('estimator', { activeTab: 'builder-review', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(80) })
    expect(calls.filter((c) => c.startsWith('bids:'))).toEqual(['bids:every trade'])
  })

  it('a tab switch reloads for the trade; a switch inside 80 ms loads once', async () => {
    const { calls, rerender } = setupGates('estimator', { activeTab: 'bid-board', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    rerender({ activeTab: 'counts', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(80) })
    expect(calls.filter((c) => c.startsWith('bids:'))).toEqual(['bids:st-p'])
    rerender({ activeTab: 'pricing', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(80) })
    expect(calls.filter((c) => c.startsWith('bids:'))).toEqual(['bids:st-p', 'bids:st-p'])
  })

  it('leaving By builder goes back to the trade’s bids', async () => {
    const { calls, rerender } = setupGates('estimator', { activeTab: 'builder-review', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(80) })
    rerender({ activeTab: 'bid-board', trade: 'st-p' })
    await act(async () => { await vi.advanceTimersByTimeAsync(80) })
    expect(calls.filter((c) => c.startsWith('bids:'))).toEqual(['bids:every trade', 'bids:st-p'])
  })
})
