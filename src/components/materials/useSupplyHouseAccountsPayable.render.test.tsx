// @vitest-environment jsdom
/**
 * The Supply houses tab's data by itself: both mount contracts, the two reads that fall back when a column is not
 * there yet, and what opening a house reads and hands on. The tab's own render test covers the data on screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type Row = Record<string, unknown>

const db = vi.hoisted(() => {
  type R = Record<string, unknown>
  const state = {
    rows: {} as Record<string, R[]>,
    /** A select to refuse: `table` with a column list that contains `column`. */
    refuse: [] as { table: string; column: string }[],
    reads: [] as { table: string; columns: string }[],
  }
  function table(name: string) {
    let columns = '*'
    const filters: [string, unknown][] = []
    const among: [string, unknown[]][] = []
    let single = false
    let range: [number, number] | null = null
    const run = () => {
      state.reads.push({ table: name, columns })
      if (state.refuse.some((r) => r.table === name && (r.column === '*' ? columns === '*' : columns.includes(r.column)))) return { data: null, error: { message: `no column on ${name}` } }
      let rows = (state.rows[name] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v) && among.every(([c, vs]) => vs.includes(r[c]))).map((r) => ({ ...r }))
      // A read with no range is cut at the API's row cap, as the real one is.
      rows = range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, 1000)
      return { data: single ? (rows[0] ?? null) : rows, error: null }
    }
    const b: Record<string, unknown> = {}
    for (const m of ['order', 'or', 'is', 'limit']) b[m] = () => b
    b.range = (from: number, to: number) => ((range = [from, to]), b)
    b.in = (c: string, vs: unknown[]) => (among.push([c, vs]), b)
    b.select = (c?: string) => ((columns = c ?? '*'), b)
    b.eq = (c: string, v: unknown) => (filters.push([c, v]), b)
    b.single = () => ((single = true), b)
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(run()).then(f, r)
    return b
  }
  const rpc = (name: string, args: { p_job_ids?: string[] }) => ({
    then: (f?: (v: unknown) => unknown) => Promise.resolve({ data: name === 'get_jobs_ledger_by_ids' ? (state.rows.jobs_ledger ?? []).filter((j) => (args.p_job_ids ?? []).includes(j.id as string)) : [], error: null }).then(f),
  })
  return { state, table, rpc }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: { ...makeSupabaseStub(), from: (name: string) => db.table(name), rpc: (name: string, args: { p_job_ids?: string[] }) => db.rpc(name, args) } }
})

import { useSupplyHouseAccountsPayable, type SupplyHouseAccountsPayableHost } from './useSupplyHouseAccountsPayable'
import type { SupplyHouse } from './useSupplyHouseInvoiceForm'
import { installDomShims } from '../../test/renderSmokeMocks'

// Made-up houses, bills and a job.
const RIDGE = { id: 'h-ridge', name: 'Ridge Supply', monthly_payment_day: 10 } as SupplyHouse
const CANAL = { id: 'h-canal', name: 'Canal Pipe', monthly_payment_day: null } as SupplyHouse
const bill = (id: string, supply_house_id: string, over: Row = {}): Row => ({ id, supply_house_id, invoice_number: `S-${id}`, purchase_order_number: null, invoice_date: '2026-03-01', due_date: '2026-03-31', amount: 100, amount_paid: 0, is_paid: false, updated_at: null, paid_at: null, on_job_account: false, link: null, credits_invoice_id: null, is_interest: false, ...over })

function hostWith(over: Partial<SupplyHouseAccountsPayableHost> = {}) {
  const host: SupplyHouseAccountsPayableHost = { setError: vi.fn(), loadPapersFor: vi.fn(async () => undefined), ...over }
  return host
}

beforeEach(() => {
  installDomShims()
  db.state.rows = {
    supply_houses: [CANAL, RIDGE],
    supply_house_invoices: [bill('part', 'h-ridge', { amount: 800, amount_paid: 300 }), bill('done', 'h-ridge', { is_paid: true, paid_at: '2026-03-05T18:00:00Z' }), bill('canal', 'h-canal', { amount: 400 })],
    supply_house_invoice_job_allocations: [{ invoice_id: 'part', job_id: 'j-elm', pct: '100' }],
    jobs_ledger: [{ id: 'j-elm', hcp_number: '1017', click_number: null, job_name: 'Elm Street' }],
    purchase_orders: [],
    material_po_generator_entries: [{ po_code: 10410, notes: null, created_at: null, job_ledger_id: 'j-elm', jobs_ledger: null, for_user: null, created_by_user: null }],
  }
  db.state.refuse = []
  db.state.reads = []
})

describe('useSupplyHouseAccountsPayable', () => {
  it('mounted bare, loads the houses itself and reads the book: a bill paid in part counts for what is left', async () => {
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    await waitFor(() => expect(result.current.supplyHousesList).toHaveLength(2))
    expect(result.current.supplyHouseSummary.map((r) => [r.name, r.outstanding, r.monthlyPaymentDay])).toEqual([['Ridge Supply', 500, 10], ['Canal Pipe', 400, null]])
    expect(result.current.agingUnpaidInvoices.map((r) => [r.id, r.amount, r.billed])).toEqual([['part', 500, 800], ['canal', 400, 400]])
    expect(result.current.supplyHouseSummaryLoading).toBe(false)
  })

  it('handed a house list, uses it and asks the parent to reload it', async () => {
    const reload = vi.fn()
    const host = hostWith({ supplyHousesProp: [RIDGE], onSupplyHousesChange: reload })
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    expect(result.current.supplyHousesList).toEqual([RIDGE])
    // Only the book's own read of the houses was made: the list itself was never fetched.
    expect(db.state.reads.filter((r) => r.table === 'supply_houses').map((r) => r.columns)).toEqual(['id, name, monthly_payment_day'])
    await act(async () => result.current.loadSupplyHouses())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reads the houses without the pay day when that column is refused', async () => {
    db.state.refuse = [{ table: 'supply_houses', column: 'monthly_payment_day' }, { table: 'supply_houses', column: '*' }]
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    expect(result.current.supplyHouseSummary.map((r) => r.monthlyPaymentDay)).toEqual([null, null])
    await waitFor(() => expect(result.current.supplyHousesList.map((h) => h.monthly_payment_day)).toEqual([null, null]))
    expect(host.setError).not.toHaveBeenCalled()
  })

  it('reads the book again without is_interest when that column is refused, so the summary is never empty over it', async () => {
    db.state.refuse = [{ table: 'supply_house_invoices', column: 'is_interest' }]
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    expect(result.current.supplyHouseSummary.find((r) => r.name === 'Ridge Supply')?.outstanding).toBe(500)
    expect(db.state.reads.filter((r) => r.table === 'supply_house_invoices')).toHaveLength(2)
  })

  it('opening a house reads its bills with their jobs, its PO codes and its papers, and starts with no payments', async () => {
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    let rows: unknown
    await act(async () => {
      rows = await result.current.loadSupplyHouseDetail(RIDGE)
    })
    expect(result.current.selectedSupplyHouseForDetail?.id).toBe('h-ridge')
    expect(result.current.supplyHouseInvoices.map((i) => [i.id, i.job_allocations])).toEqual([['part', [{ job_id: 'j-elm', pct: 100 }]], ['done', []]])
    expect(rows).toEqual(result.current.supplyHouseInvoices)
    expect([...(result.current.poGeneratorCodesForSelectedHouse ?? [])]).toEqual([10410])
    await waitFor(() => expect(result.current.supplyHouseJobDetailsMap).toEqual({ 'j-elm': { hcp_number: '1017', click_number: '', job_name: 'Elm Street' } }))
    expect(result.current.paidThisVisit.size).toBe(0)
    expect(result.current.housePayments).toEqual({ payments: [], lines: [], events: [] })
    expect(result.current.supplyHouseDetailLoading).toBe(false)
    expect(host.loadPapersFor).toHaveBeenCalledWith(result.current.supplyHouseInvoices)
  })

  it('opens the house a link names once the list has it, and says it has', async () => {
    const handled = vi.fn()
    const host = hostWith({ autoOpenHouseId: 'h-canal', onAutoOpenHouseHandled: handled })
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.selectedSupplyHouseForDetail?.id).toBe('h-canal'))
    expect(handled).toHaveBeenCalledTimes(1)
    expect(result.current.supplyHouseInvoices.map((i) => i.id)).toEqual(['canal'])
  })

  it('reads every bill on the book, past the row cap a read with no range is cut at', async () => {
    db.state.rows.supply_house_invoices = Array.from({ length: 1200 }, (_, i) => bill(`b${i}`, 'h-ridge', { amount: 1 }))
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    expect(result.current.agingUnpaidInvoices).toHaveLength(1200)
    expect(result.current.supplyHouseSummary.find((r) => r.name === 'Ridge Supply')?.outstanding).toBe(1200)
    // Two pages: the first full, the second short.
    expect(db.state.reads.filter((r) => r.table === 'supply_house_invoices')).toHaveLength(2)
  })

  it('opening a house reads the jobs on its own bills only, and never its purchase orders’ items', async () => {
    db.state.rows.supply_house_invoice_job_allocations!.push({ invoice_id: 'canal', job_id: 'j-far', pct: 100 })
    db.state.rows.jobs_ledger!.push({ id: 'j-far', hcp_number: '2000', click_number: null, job_name: 'Far Road' })
    db.state.rows.purchase_orders = [{ id: 'po-1', supply_house_id: 'h-ridge', name: 'PO: Ridge Supply', status: 'draft' }]
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    await act(async () => {
      await result.current.loadSupplyHouseDetail(RIDGE)
    })
    await waitFor(() => expect(Object.keys(result.current.supplyHouseJobDetailsMap)).toEqual(['j-elm']))
    expect(result.current.supplyHousePOs.map((po) => [po.name, po.status])).toEqual([['PO: Ridge Supply', 'draft']])
    expect(db.state.reads.some((r) => r.table === 'purchase_order_items')).toBe(false)
  })

  it('a house with no bills asks for no jobs at all', async () => {
    db.state.rows.supply_house_invoices = []
    const host = hostWith()
    const { result } = renderHook(() => useSupplyHouseAccountsPayable(host))
    await waitFor(() => expect(result.current.agingBookLoaded).toBe(true))
    await act(async () => {
      await result.current.loadSupplyHouseDetail(RIDGE)
    })
    expect(db.state.reads.some((r) => r.table === 'supply_house_invoice_job_allocations')).toBe(false)
    expect(result.current.supplyHouseJobDetailsMap).toEqual({})
  })
})
