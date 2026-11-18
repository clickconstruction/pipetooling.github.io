// @vitest-environment jsdom
/**
 * The invoice form's engine by itself: what it sets when it opens, and what it asks its host to read again after a
 * save or a delete, in the order the tab always did it. The tab's own render test covers the form on screen.
 */
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'

const saved = vi.hoisted(() => ({ drafts: [] as unknown[], result: { ok: true, id: 'inv-new', allocationProblem: null } as { ok: true; id: string; allocationProblem: string | null } | { ok: false; problem: string } }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/materials/supplyInvoiceWrite', async (orig) => ({
  ...(await orig<typeof import('../../lib/materials/supplyInvoiceWrite')>()),
  saveSupplyInvoice: vi.fn(async (_db: unknown, draft: unknown) => (saved.drafts.push(draft), saved.result)),
}))

import { useSupplyHouseInvoiceForm, type SupplyHouse, type SupplyHouseInvoiceFormHost, type SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'
import type { PaperIo } from '../../lib/materials/lines/paperIo'
import { nextMonthlyPaymentDueYmd } from '../../lib/supplyHouseAging'
import { todayYmdInAppTz } from '../../utils/dateUtils'

// A made-up house and bill.
const HOUSE = { id: 'h-ridge', name: 'Ridge Supply', monthly_payment_day: 10 } as SupplyHouse
const BILL = { id: 'inv-1', supply_house_id: 'h-ridge', invoice_number: 'S-1', invoice_date: '2026-03-01', due_date: null, amount: -40, document_kind: 'credit', is_paid: false, paid_at: null, link: null, purchase_order_number: null, on_job_account: true, credits_invoice_id: null, job_allocations: [{ job_id: 'j1', pct: 100 }] } as unknown as SupplyHouseInvoiceWithAllocations

function hostWith(over: Partial<SupplyHouseInvoiceFormHost> = {}) {
  const calls: string[] = []
  const host: SupplyHouseInvoiceFormHost = {
    myRole: 'dev',
    selectedSupplyHouseForDetail: HOUSE,
    supplyHouseInvoices: [BILL],
    poGeneratorEntriesForSelectedHouse: null,
    housePayments: { payments: [], lines: [] },
    supplyHouseSummary: [{ supply_house_id: 'h-ridge' }],
    supplyHousesList: [HOUSE],
    agingCellFormFocusRef: { current: null },
    paperIo: {} as PaperIo,
    loadSupplyHouseDetail: vi.fn(async () => (calls.push('detail'), [BILL])),
    loadSupplyHouseSummary: vi.fn(async () => void calls.push('summary')),
    setError: vi.fn((m: string | null) => void (m ? calls.push(`error:${m}`) : undefined)),
    setLinesRefresh: vi.fn(() => void calls.push('lines')),
    agingCellModal: null,
    setAgingCellJobsRefresh: vi.fn(() => void calls.push('cell')),
    ...over,
  }
  return { host, calls }
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <ConfirmDialogProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>
    </ConfirmDialogProvider>
  </ToastProvider>
)
const submit = { preventDefault: () => {} } as never

beforeEach(() => {
  saved.drafts = []
  saved.result = { ok: true, id: 'inv-new', allocationProblem: null }
})

describe('useSupplyHouseInvoiceForm', () => {
  it('starts closed, with the fill off until its switch reads', () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    expect(result.current.invoiceFormOpen).toBe(false)
    expect(result.current.editingInvoice).toBeNull()
    expect(result.current.billFillOn).toBe(false)
  })

  it('Add opens a new bill: dated today, due on the house’s next pay day, on no job', () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openAddInvoice())
    const today = todayYmdInAppTz()
    expect(result.current).toMatchObject({ invoiceFormOpen: true, editingInvoice: null, invoiceNumber: '', invoiceDate: today, invoiceDueDate: nextMonthlyPaymentDueYmd(10, today), invoiceAmount: '', invoiceDocumentKind: 'invoice', invoiceIsPaid: false, invoiceOnJobAccount: false, invoiceJobAllocations: [] })
  })

  it('Edit opens the row’s own fields: the amount unsigned, the kind and the jobs from the row', () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openEditInvoice(BILL))
    expect(result.current).toMatchObject({ invoiceFormOpen: true, editingInvoice: BILL, invoiceNumber: 'S-1', invoiceAmount: '40', invoiceDocumentKind: 'credit', invoiceOnJobAccount: true, invoiceJobAllocations: [{ job_id: 'j1', pct: 100 }] })
    expect(result.current.invoiceWords.title(true)).toBe('Edit credit')
  })

  it('Close shuts the form and forgets the row', () => {
    const { host } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openEditInvoice(BILL))
    act(() => result.current.closeInvoiceForm())
    expect(result.current).toMatchObject({ invoiceFormOpen: false, editingInvoice: null })
  })

  it('Save hands the draft to the save, then asks for the house, the lines and the book, in that order, and closes', async () => {
    const { host, calls } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openAddInvoice())
    act(() => {
      result.current.setInvoiceNumber('S-new')
      result.current.setInvoiceAmount('12.50')
    })
    await act(async () => result.current.saveInvoice(submit))
    expect(saved.drafts).toHaveLength(1)
    expect(saved.drafts[0]).toMatchObject({ supplyHouseId: 'h-ridge', number: 'S-new', amountTyped: '12.50', kind: 'invoice' })
    expect(calls).toEqual(['detail', 'lines', 'summary'])
    expect(result.current.invoiceFormOpen).toBe(false)
    expect(result.current.savingInvoice).toBe(false)
  })

  it('a save under an open aging cell window makes that window read its jobs again', async () => {
    const { host, calls } = hostWith({ agingCellModal: { houseId: 'h-ridge', cell: 'current' } })
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openAddInvoice())
    await act(async () => result.current.saveInvoice(submit))
    expect(calls).toEqual(['detail', 'lines', 'summary', 'cell'])
  })

  it('a save that is refused tells the host why and leaves the form open, with nothing read again', async () => {
    saved.result = { ok: false, problem: 'An invoice number is needed.' }
    const { host, calls } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openAddInvoice())
    await act(async () => result.current.saveInvoice(submit))
    expect(calls).toEqual(['error:An invoice number is needed.'])
    expect(result.current.invoiceFormOpen).toBe(true)
    await waitFor(() => expect(result.current.savingInvoice).toBe(false))
  })

  it('a row whose jobs saved badly still closes the form, and the host hears the problem', async () => {
    saved.result = { ok: true, id: 'inv-new', allocationProblem: 'The jobs were not saved on the invoice.' }
    const { host, calls } = hostWith()
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    act(() => result.current.openAddInvoice())
    await act(async () => result.current.saveInvoice(submit))
    expect(calls).toEqual(['error:The jobs were not saved on the invoice.', 'detail', 'lines', 'summary'])
    expect(result.current.invoiceFormOpen).toBe(false)
  })

  it('with no open house, Save does nothing', async () => {
    const { host, calls } = hostWith({ selectedSupplyHouseForDetail: null })
    const { result } = renderHook(() => useSupplyHouseInvoiceForm(host), { wrapper })
    await act(async () => result.current.saveInvoice(submit))
    expect(saved.drafts).toEqual([])
    expect(calls).toEqual([])
  })
})
