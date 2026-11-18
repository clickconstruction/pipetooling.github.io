// @vitest-environment jsdom
/**
 * The aging windows' engine by itself: the move window's data, its two writes (the emailed ask and the attested
 * move), and the job-account flag. The tab's own render test covers the windows on screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const db = vi.hoisted(() => {
  type R = Record<string, unknown>
  const state = {
    rows: {} as Record<string, R[]>,
    writes: [] as { table: string; op: string; values?: unknown; filters: [string, string, unknown][] }[],
    invokes: [] as { name: string; body: unknown }[],
    invokeAnswer: { data: { asked: ['inv-a'], sent_to: 'rep@example.test' } as unknown, error: null as { message: string } | null },
    refuseUpdate: null as string | null,
  }
  function table(name: string) {
    const filters: [string, string, unknown][] = []
    let op = 'select'
    let values: unknown
    const match = (r: R) => filters.every(([k, c, v]) => (k === 'eq' ? r[c] === v : k === 'in' ? (v as unknown[]).includes(r[c]) : k === 'is' ? (r[c] ?? null) === v : true))
    const run = () => {
      if (op === 'select') return { data: (state.rows[name] ?? []).filter(match).map((r) => ({ ...r })), error: null }
      if (op === 'update' && state.refuseUpdate === name) return { data: null, error: { message: 'the row is locked' } }
      state.writes.push({ table: name, op, values, filters: [...filters] })
      if (op === 'update') {
        const hit = (state.rows[name] ?? []).filter(match)
        for (const r of hit) Object.assign(r, values as R)
        return { data: hit.map((r) => ({ ...r })), error: null }
      }
      if (op === 'insert') state.rows[name] = [...(state.rows[name] ?? []), values as R]
      return { data: null, error: null }
    }
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.update = (v: unknown) => ((op = 'update'), (values = v), b)
    b.insert = (v: unknown) => ((op = 'insert'), (values = v), b)
    b.eq = (c: string, v: unknown) => (filters.push(['eq', c, v]), b)
    b.in = (c: string, v: unknown) => (filters.push(['in', c, v]), b)
    b.is = (c: string, v: unknown) => (filters.push(['is', c, v]), b)
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(run()).then(f, r)
    return b
  }
  return { state, table }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return {
    supabase: {
      ...makeSupabaseStub(),
      from: (name: string) => db.table(name),
      functions: { invoke: (name: string, opts: { body?: unknown }) => (db.state.invokes.push({ name, body: opts?.body }), Promise.resolve(db.state.invokeAnswer)) },
    },
  }
})

import { useSupplyHouseAgingWindows, type SupplyHouseAgingWindowsHost } from './useSupplyHouseAgingWindows'
import type { AgingInvoiceRow } from './useSupplyHouseAccountsPayable'
import type { SupplyHouse } from './useSupplyHouseInvoiceForm'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

// Made-up charges: two still current on one job each, one on two jobs.
const soon = ymdAddDays(todayYmdInAppTz(), 20)
const charge = (id: string, over: Partial<AgingInvoiceRow> = {}): AgingInvoiceRow => ({ id, supply_house_id: 'h-ridge', invoice_number: `S-${id}`, purchase_order_number: null, invoice_date: '2026-03-01', amount: 100, due_date: soon, on_job_account: false, link: null, credits_invoice_id: null, ...over })
const BOOK = [charge('inv-a'), charge('inv-b'), charge('inv-two')]

function hostWith(over: Partial<SupplyHouseAgingWindowsHost> = {}) {
  let book = BOOK
  const host: SupplyHouseAgingWindowsHost = {
    agingUnpaidInvoices: book,
    setAgingUnpaidInvoices: vi.fn((next) => {
      book = typeof next === 'function' ? next(book) : next
    }),
    agingBookLoaded: true,
    selectedSupplyHouseForDetail: null,
    loadSupplyHouseDetail: vi.fn(async () => []),
    setError: vi.fn(),
    ...over,
  }
  return { host, book: () => book }
}

beforeEach(() => {
  db.state.rows = {
    supply_house_invoice_job_allocations: [
      { invoice_id: 'inv-a', job_id: 'j1', pct: 100 },
      { invoice_id: 'inv-b', job_id: 'j2', pct: 100 },
      { invoice_id: 'inv-two', job_id: 'j1', pct: 50 },
      { invoice_id: 'inv-two', job_id: 'j2', pct: 50 },
    ],
    supply_house_invoice_move_requests: [{ id: 'ask-b', invoice_id: 'inv-b', requested_at: '2026-03-02T00:00:00Z', via: 'email', sent_to: 'rep@example.test', confirmed_at: null }],
    job_supply_house_accounts: [],
    supply_house_invoices: BOOK.map((r) => ({ ...r })),
  }
  db.state.writes = []
  db.state.invokes = []
  db.state.invokeAnswer = { data: { asked: ['inv-a'], sent_to: 'rep@example.test' }, error: null }
  db.state.refuseUpdate = null
})

describe('useSupplyHouseAgingWindows', () => {
  it('reads the move window’s jobs and open asks for the still-current charges', async () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingMoveData.loaded).toBe(true))
    expect(Object.fromEntries(Object.entries(result.current.agingMoveData.allocations).map(([id, list]) => [id, list.length]))).toEqual({ 'inv-a': 1, 'inv-b': 1, 'inv-two': 2 })
    expect(Object.keys(result.current.agingMoveData.asks)).toEqual(['inv-b'])
    expect(result.current.agingMoveData.notNeeded.size).toBe(0)
  })

  it('an emailed ask calls the function for those invoices and marks them asked', async () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingMoveData.loaded).toBe(true))
    await act(async () => result.current.sendMoveRequest(['inv-a'], 'house:h-ridge', false))
    expect(db.state.invokes).toEqual([{ name: 'request-job-account-move', body: { invoice_ids: ['inv-a'], include_asked: false } }])
    expect(result.current.agingMoveData.asks['inv-a']).toMatchObject({ id: 'pending', via: 'email', sent_to: 'rep@example.test' })
    expect(result.current.agingMoveBusy).toBeNull()
    expect(result.current.agingMoveError).toBeNull()
  })

  it('an ask the function refuses says why and marks nothing', async () => {
    db.state.invokeAnswer = { data: { error: 'This house has no job-accounts rep with an email.' }, error: null }
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingMoveData.loaded).toBe(true))
    await act(async () => result.current.sendMoveRequest(['inv-a'], 'send', false))
    expect(result.current.agingMoveError).toBe('This house has no job-accounts rep with an email.')
    expect(result.current.agingMoveData.asks['inv-a']).toBeUndefined()
  })

  it('an ask for no invoices does nothing', async () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await act(async () => result.current.sendMoveRequest([], 'send', false))
    expect(db.state.invokes).toEqual([])
  })

  it('the attested move flags the bill, confirms its open ask and clears it from the window', async () => {
    const { host, book } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingMoveData.loaded).toBe(true))
    await act(async () => result.current.markMovedConfirmed(BOOK[1]!, 'j2'))
    expect(db.state.writes.map((w) => [w.table, w.op])).toEqual([['supply_house_invoices', 'update'], ['supply_house_invoice_move_requests', 'update']])
    expect(db.state.writes[0]).toMatchObject({ values: { on_job_account: true }, filters: [['eq', 'id', 'inv-b']] })
    expect(book().find((r) => r.id === 'inv-b')?.on_job_account).toBe(true)
    expect(result.current.agingMoveData.asks['inv-b']).toBeUndefined()
    expect(result.current.agingMoveModalFor).toBeNull()
  })

  it('a move with no ask on record writes its own confirmed phone row', async () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingMoveData.loaded).toBe(true))
    await act(async () => result.current.markMovedConfirmed(BOOK[0]!, 'j1'))
    const insert = db.state.writes.find((w) => w.op === 'insert')
    expect(insert).toMatchObject({ table: 'supply_house_invoice_move_requests', values: { invoice_id: 'inv-a', job_id: 'j1', supply_house_id: 'h-ridge', via: 'phone' } })
  })

  it('a flag the database refuses tells the tab why and leaves the book alone', async () => {
    db.state.refuseUpdate = 'supply_house_invoices'
    const { host, book } = hostWith()
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await act(async () => result.current.setInvoiceJobAcct(BOOK[0]!, true))
    expect(host.setError).toHaveBeenCalledWith('Could not flag S-inv-a: the row is locked')
    expect(book()).toBe(BOOK)
  })

  it('a flag on a bill of the open house makes that house read again', async () => {
    const open = { id: 'h-ridge', name: 'Ridge Supply' } as SupplyHouse
    const { host } = hostWith({ selectedSupplyHouseForDetail: open })
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await act(async () => result.current.setInvoiceJobAcct(BOOK[0]!, false))
    expect(host.loadSupplyHouseDetail).toHaveBeenCalledWith(open)
  })

  it('the Needs You door opens the worked list once the move data is for the book on screen', async () => {
    const handled = vi.fn()
    const { host } = hostWith({ openList: 'movable', onOpenListHandled: handled })
    const { result } = renderHook(() => useSupplyHouseAgingWindows(host))
    await waitFor(() => expect(result.current.agingCellModal).toEqual({ houseId: null, cell: 'movable' }))
    expect(handled).toHaveBeenCalledTimes(1)
  })
})
