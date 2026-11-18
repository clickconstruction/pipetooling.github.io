// @vitest-environment jsdom
/**
 * The payments' engine by itself: Mark paid in place, the paid bill a typed payment stands behind, the refresh after
 * a payment changes, and the Needs You door. The tab's own render test covers the windows on screen.
 */
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../contexts/ToastContext'

const db = vi.hoisted(() => {
  type R = Record<string, unknown>
  const state = { bills: [] as R[], writes: [] as { values: unknown; id: unknown }[], refuse: false, house: { payments: [] as R[], lines: [] as R[] } }
  function table(name: string) {
    let values: unknown
    let id: unknown
    let op = 'select'
    const run = () => {
      if (name !== 'supply_house_invoices') return { data: [], error: null }
      if (op === 'select') return { data: state.bills.map((b) => ({ id: b.id, is_paid: b.is_paid, paid_at: b.paid_at })), error: null }
      if (state.refuse) return { data: null, error: { message: 'the row is locked' } }
      state.writes.push({ values, id })
      const row = state.bills.find((b) => b.id === id)!
      Object.assign(row, values as R, { paid_at: (values as R).is_paid ? '2026-03-10T18:00:00Z' : null })
      return { data: { is_paid: row.is_paid, paid_at: row.paid_at }, error: null }
    }
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.update = (v: unknown) => ((op = 'update'), (values = v), b)
    b.eq = (_c: string, v: unknown) => ((id = v), b)
    b.single = () => b
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(run()).then(f, r)
    return b
  }
  return { state, table }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: { ...makeSupabaseStub(), from: (name: string) => db.table(name) } }
})
vi.mock('../../lib/materials/payments/supplyPaymentsIo', async (orig) => ({
  ...(await orig<typeof import('../../lib/materials/payments/supplyPaymentsIo')>()),
  supabaseSupplyPaymentsIo: { loadHouse: vi.fn(async () => db.state.house) },
}))

import { useSupplyHousePayments, type SupplyHousePaymentsHost } from './useSupplyHousePayments'
import type { SupplyHouseInvoice, SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'
import type { HousePayments } from '../../lib/materials/payments/supplyPaymentsIo'

// Made-up bills and one typed payment.
const bill = (id: string, is_paid = false): SupplyHouseInvoiceWithAllocations => ({ id, supply_house_id: 'h-ridge', invoice_number: `S-${id}`, is_paid, paid_at: null, amount: 100 }) as unknown as SupplyHouseInvoiceWithAllocations
const TYPED: HousePayments = { payments: [{ id: 'pay-1', supply_house_id: 'h-ridge', paid_on: '2026-03-10', amount: 100, method: 'ach', method_ref: null, receipt_link: null, source: 'typed', removed_at: null }] as never, lines: [{ id: 'l1', payment_id: 'pay-1', invoice_id: 'paid', amount: 100 }] as never }

function hostWith(over: Partial<SupplyHousePaymentsHost> = {}) {
  let invoices = [bill('a'), bill('paid', true)]
  let visit: ReadonlySet<string> = new Set()
  const host: SupplyHousePaymentsHost = {
    supplyHousesList: [],
    agingBookLoaded: false,
    housePayments: { payments: [], lines: [] },
    setHousePayments: vi.fn(),
    setSupplyHouseInvoices: vi.fn((next) => {
      invoices = typeof next === 'function' ? next(invoices) : next
    }),
    setPaidThisVisit: vi.fn((next) => {
      visit = typeof next === 'function' ? next(visit) : next
    }),
    loadSupplyHouseSummary: vi.fn(async () => undefined),
    loadHousePayments: vi.fn(),
    ...over,
  }
  return { host, invoices: () => invoices, visit: () => visit }
}
const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>

beforeEach(() => {
  db.state.bills = [{ id: 'a', is_paid: false, paid_at: null }, { id: 'paid', is_paid: true, paid_at: '2026-03-01T00:00:00Z' }]
  db.state.writes = []
  db.state.refuse = false
  db.state.house = { payments: [], lines: [] }
})

describe('useSupplyHousePayments', () => {
  it('Mark paid writes one flag, patches the row where it stands and keeps it on this visit’s list', async () => {
    const { host, invoices, visit } = hostWith()
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await act(async () => result.current.toggleInvoicePaid(bill('a') as SupplyHouseInvoice))
    expect(db.state.writes).toEqual([{ values: { is_paid: true }, id: 'a' }])
    expect(invoices().find((r) => r.id === 'a')).toMatchObject({ is_paid: true, paid_at: '2026-03-10T18:00:00Z' })
    expect([...visit()]).toEqual(['a'])
    expect(host.loadSupplyHouseSummary).toHaveBeenCalledTimes(1)
    expect(host.loadHousePayments).toHaveBeenCalledWith('h-ridge')
    expect(result.current.finishReloadKey).toBe(1)
    expect(result.current.payingInvoiceId).toBeNull()
  })

  it('Mark unpaid takes a bill paid by hand off this visit’s list', async () => {
    const { host, visit } = hostWith()
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await act(async () => result.current.toggleInvoicePaid(bill('paid', true) as SupplyHouseInvoice))
    expect(db.state.writes).toEqual([{ values: { is_paid: false }, id: 'paid' }])
    expect(visit().has('paid')).toBe(false)
  })

  it('a paid bill a typed payment stands behind opens that payment and writes nothing', async () => {
    const { host } = hostWith({ housePayments: TYPED })
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await act(async () => result.current.toggleInvoicePaid(bill('paid', true) as SupplyHouseInvoice))
    expect(db.state.writes).toEqual([])
    expect(result.current.paymentViewId).toBe('pay-1')
  })

  it('a flag the database refuses leaves the row and the visit’s list alone', async () => {
    db.state.refuse = true
    const { host, invoices, visit } = hostWith()
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await act(async () => result.current.toggleInvoicePaid(bill('a') as SupplyHouseInvoice))
    expect(invoices().find((r) => r.id === 'a')?.is_paid).toBe(false)
    expect(visit().size).toBe(0)
    expect(host.loadSupplyHouseSummary).not.toHaveBeenCalled()
    expect(result.current.payingInvoiceId).toBeNull()
  })

  it('after a payment changes, the house’s bills are patched in place and its payments and the book are read again', async () => {
    db.state.bills = [{ id: 'a', is_paid: true, paid_at: '2026-03-11T00:00:00Z' }, { id: 'paid', is_paid: true, paid_at: '2026-03-01T00:00:00Z' }]
    db.state.house = TYPED as never
    const { host, invoices } = hostWith()
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await act(async () => result.current.refreshHouseMoney('h-ridge'))
    expect(invoices().map((r) => [r.id, r.is_paid])).toEqual([['a', true], ['paid', true]])
    expect(host.setHousePayments).toHaveBeenCalledWith(TYPED)
    expect(host.loadSupplyHouseSummary).toHaveBeenCalledTimes(1)
    expect(result.current.finishReloadKey).toBe(1)
  })

  it('Record a payment opens its window, and the Needs You door opens the finish-later list', async () => {
    const handled = vi.fn()
    const { host } = hostWith({ openList: 'finish', onOpenListHandled: handled })
    const { result } = renderHook(() => useSupplyHousePayments(host), { wrapper })
    await waitFor(() => expect(result.current.finishListOpen).toBe(true))
    expect(handled).toHaveBeenCalledTimes(1)
    act(() => result.current.openRecordPayment())
    expect(result.current.recordPaymentOpen).toBe(true)
  })
})
