// @vitest-environment jsdom
/**
 * The Bid window's trade switch through its hook (punch list #51, PR 3): the sibling read and
 * its grouping, copying a bid into another trade (`duplicate_bid_to_service_type`) and what
 * each answer does to the window, and opening a sibling that already exists — in hand or
 * after a reload. The pending autosave is flushed before every way out of the bid.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useBidTradeSwitch } from './useBidTradeSwitch'

const db = vi.hoisted(() => ({
  siblingRows: [] as Array<Record<string, unknown>>,
  siblingError: null as { message: string; code: string } | null,
  siblingQuery: [] as Array<[string, ...unknown[]]>,
  rpcAnswer: { data: 'bid-new' as unknown, error: null as { message: string; code: string } | null },
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'neq']) {
        b[m] = (...args: unknown[]) => {
          db.siblingQuery.push([`${table}.${m}`, ...args])
          return b
        }
      }
      b.then = (ok?: (v: unknown) => unknown, no?: (e: unknown) => unknown) =>
        Promise.resolve({ data: db.siblingError ? null : db.siblingRows, error: db.siblingError }).then(ok, no)
      return b
    },
    rpc: (name: string, args: unknown) => {
      db.rpcCalls.push({ name, args })
      return Promise.resolve(db.rpcAnswer)
    },
  },
}))

afterEach(() => cleanup())
beforeEach(() => {
  db.siblingRows = []
  db.siblingError = null
  db.siblingQuery = []
  db.rpcAnswer = { data: 'bid-new', error: null }
  db.rpcCalls = []
})

const bid = (over: Partial<BidWithBuilder>): BidWithBuilder =>
  ({ id: 'bid-1', bid_number: '482', project_name: 'Pondhill Building 2', customer_id: 'cust-1', service_type_id: 'st-p', ...over }) as BidWithBuilder

const DENIED = { message: 'permission denied', code: '42501' }

function setup(over: { editingBid?: BidWithBuilder | null; bids?: BidWithBuilder[]; authUserId?: string | null; reloaded?: BidWithBuilder[] } = {}) {
  const calls: string[] = []
  const deps = {
    flushAutosave: vi.fn(async () => { calls.push('flush') }),
    setSavingBid: vi.fn((v: boolean) => { calls.push(`saving:${v}`) }),
    setError: vi.fn((m: string | null) => { calls.push(`error:${m}`) }),
    showToast: vi.fn((m: string, t?: string) => { calls.push(`toast:${t}:${m}`) }),
    loadBids: vi.fn(async () => { calls.push('loadBids'); return over.reloaded ?? [] }),
    setSelectedServiceTypeId: vi.fn((id: string) => { calls.push(`trade:${id}`) }),
    closeBidForm: vi.fn(() => { calls.push('close') }),
    openEditBid: vi.fn((b: BidWithBuilder) => { calls.push(`open:${b.id}`) }),
  }
  const hook = renderHook(() =>
    useBidTradeSwitch({
      editingBid: over.editingBid === undefined ? bid({}) : over.editingBid,
      bids: over.bids ?? [],
      authUserId: over.authUserId === undefined ? 'user-1' : over.authUserId,
      ...deps,
    }),
  )
  return { ...hook, calls, deps }
}

describe('useBidTradeSwitch — the siblings', () => {
  it('reads the customer’s other bids and groups the same project’s by trade', async () => {
    db.siblingRows = [
      { id: 'bid-e', bid_number: '483', service_type_id: 'st-e', project_name: 'pondhill building 2 ' },
      { id: 'bid-x', bid_number: '484', service_type_id: 'st-e', project_name: 'Another job' },
      { id: 'bid-h', bid_number: '485', service_type_id: 'st-h', project_name: 'Pondhill Building 2' },
    ]
    const { result } = setup()
    expect(result.current.siblings).toEqual({})
    await act(async () => { await result.current.refreshSiblings() })
    expect(db.siblingQuery).toEqual([
      ['bids.select', 'id, bid_number, service_type_id, project_name'],
      ['bids.eq', 'customer_id', 'cust-1'],
      ['bids.neq', 'id', 'bid-1'],
    ])
    expect(result.current.siblings).toEqual({ 'st-e': [{ id: 'bid-e', bid_number: '483' }], 'st-h': [{ id: 'bid-h', bid_number: '485' }] })
  })

  it('a bid with no customer, or no project name, has no siblings and reads nothing', async () => {
    for (const editingBid of [bid({ customer_id: null }), bid({ project_name: '  ' }), null]) {
      cleanup()
      db.siblingQuery = []
      const { result } = setup({ editingBid })
      await act(async () => { await result.current.refreshSiblings() })
      expect(result.current.siblings).toEqual({})
      expect(db.siblingQuery).toEqual([])
    }
  })

  it('a failed read shows no siblings', async () => {
    db.siblingRows = [{ id: 'bid-e', bid_number: '483', service_type_id: 'st-e', project_name: 'Pondhill Building 2' }]
    const { result } = setup()
    await act(async () => { await result.current.refreshSiblings() })
    expect(Object.keys(result.current.siblings)).toEqual(['st-e'])
    db.siblingError = DENIED
    await act(async () => { await result.current.refreshSiblings() })
    expect(result.current.siblings).toEqual({})
  })

  it('clearSiblings forgets them', async () => {
    db.siblingRows = [{ id: 'bid-e', bid_number: '483', service_type_id: 'st-e', project_name: 'Pondhill Building 2' }]
    const { result } = setup()
    await act(async () => { await result.current.refreshSiblings() })
    act(() => result.current.clearSiblings())
    expect(result.current.siblings).toEqual({})
  })
})

describe('useBidTradeSwitch — copy into another trade', () => {
  it('flushes, copies, reloads, picks the trade, and opens the copy — in that order', async () => {
    const copy = bid({ id: 'bid-new', service_type_id: 'st-e' })
    const { result, calls } = setup({ reloaded: [bid({}), copy] })
    await act(async () => { await result.current.duplicateToTrade('st-e') })
    expect(db.rpcCalls).toEqual([{ name: 'duplicate_bid_to_service_type', args: { p_source_bid_id: 'bid-1', p_target_service_type_id: 'st-e' } }])
    expect(calls).toEqual([
      'flush',
      'saving:true',
      'error:null',
      'loadBids',
      'trade:st-e',
      'close',
      'open:bid-new',
      'toast:success:Bid copied to the new trade.',
      'saving:false',
    ])
  })

  it('into its own trade, says duplicated', async () => {
    const { result, calls } = setup({ reloaded: [bid({ id: 'bid-new' })] })
    await act(async () => { await result.current.duplicateToTrade('st-p') })
    expect(calls).toContain('toast:success:Bid duplicated.')
  })

  it('a copy the reload does not find closes the window and says to refresh', async () => {
    const { result, calls, deps } = setup({ reloaded: [bid({})] })
    await act(async () => { await result.current.duplicateToTrade('st-e') })
    expect(calls).toContain('close')
    expect(deps.openEditBid).not.toHaveBeenCalled()
    expect(calls).toContain('toast:success:Bid copied. Refresh the page if it does not appear.')
  })

  it('an answer with no new id says so and leaves the window open', async () => {
    db.rpcAnswer = { data: null, error: null }
    const { result, calls, deps } = setup()
    await act(async () => { await result.current.duplicateToTrade('st-e') })
    expect(calls).toEqual(['flush', 'saving:true', 'error:null', 'error:Duplicate did not return a new bid id.', 'toast:error:Duplicate did not return a new bid id.', 'saving:false'])
    expect(deps.loadBids).not.toHaveBeenCalled()
    expect(deps.closeBidForm).not.toHaveBeenCalled()
  })

  it('a refused copy says why and leaves the window open', async () => {
    db.rpcAnswer = { data: null, error: DENIED }
    const { result, calls, deps } = setup()
    await act(async () => { await result.current.duplicateToTrade('st-e') })
    const errors = calls.filter((c) => c.startsWith('toast:error:'))
    expect(errors).toHaveLength(1)
    expect(calls[calls.length - 1]).toBe('saving:false')
    expect(deps.closeBidForm).not.toHaveBeenCalled()
  })

  it('with no bid open, or nobody signed in, flushes and does nothing else', async () => {
    for (const over of [{ editingBid: null }, { authUserId: null }]) {
      cleanup()
      db.rpcCalls = []
      const { result, calls } = setup(over)
      await act(async () => { await result.current.duplicateToTrade('st-e') })
      expect(calls).toEqual(['flush'])
      expect(db.rpcCalls).toEqual([])
    }
  })
})

describe('useBidTradeSwitch — open a sibling that exists', () => {
  it('in hand: flushes, picks its trade, and opens it', async () => {
    const sibling = bid({ id: 'bid-e', service_type_id: 'st-e' })
    const { result, calls, deps } = setup({ bids: [bid({}), sibling] })
    await act(async () => { await result.current.openExistingSibling('bid-e') })
    expect(calls).toEqual(['flush', 'trade:st-e', 'close', 'open:bid-e'])
    expect(deps.loadBids).not.toHaveBeenCalled()
  })

  it('not in hand: reloads, then opens it', async () => {
    const sibling = bid({ id: 'bid-e', service_type_id: 'st-e' })
    const { result, calls } = setup({ bids: [bid({})], reloaded: [sibling] })
    await act(async () => { await result.current.openExistingSibling('bid-e') })
    expect(calls).toEqual(['flush', 'loadBids', 'trade:st-e', 'close', 'open:bid-e'])
  })

  it('nowhere to be found: says so and leaves the window open', async () => {
    const { result, calls, deps } = setup({ bids: [bid({})], reloaded: [] })
    await act(async () => { await result.current.openExistingSibling('bid-gone') })
    expect(calls).toEqual(['flush', 'loadBids', 'toast:error:Bid not found or no access.'])
    expect(deps.closeBidForm).not.toHaveBeenCalled()
  })
})
