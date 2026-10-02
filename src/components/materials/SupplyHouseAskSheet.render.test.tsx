// @vitest-environment jsdom
/**
 * Render smoke for Ask a house (v2.4443): the house tabs, the summary, the message, the
 * answers typed down the list and saved together, and a click outside that does not lose
 * them. The list, the message and the changes are lib/materials/houseAsk.ts (kernel-tested).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { buildLienSupplierJobs } from '../../lib/jobs/lienJobSuppliers'
import { buildHouseAsks } from '../../lib/materials/houseAsk'
import { SupplyHouseAskSheet } from './SupplyHouseAskSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  getPhysicalInvoiceIssuerDraft: () => ({ companyName: 'Click Plumbing' }),
  fetchPhysicalInvoiceIssuerFromAppSettings: async () => ({ rowExists: true }),
}))
const saveMock = vi.fn()
vi.mock('../../lib/jobs/lienSupplierWordIo', () => ({ saveSupplierWords: (rows: unknown) => saveMock(rows) }))

const TODAY = '2026-10-02'
const invoices = [
  { id: 'a', supply_house_id: 'reece', amount: 5316.26, is_paid: false, invoice_date: '2026-07-12', paidYmd: null, on_job_account: false },
  { id: 'e', supply_house_id: 'reece', amount: 12114.55, is_paid: false, invoice_date: '2026-08-20', paidYmd: null, on_job_account: false },
  { id: 'd', supply_house_id: 'winn', amount: 513.87, is_paid: false, invoice_date: '2026-08-20', paidYmd: null, on_job_account: false },
]
const allocations = [
  { invoice_id: 'a', job_id: 'j363', pct: 100 },
  { invoice_id: 'e', job_id: 'j650', pct: 100 },
  { invoice_id: 'd', job_id: 'j363', pct: 100 },
]
const asks = buildHouseAsks({
  jobs: [
    { jobId: 'j650', jobNumber: '650', jobName: 'ATI Schertz', billed: 33500, paidIn: 17777.51 },
    { jobId: 'j363', jobNumber: '363', jobName: 'Michael Palmer', billed: 31400, paidIn: 31400 },
  ],
  suppliers: buildLienSupplierJobs({ invoices, allocations, houses: [{ id: 'reece', name: 'Reece' }, { id: 'winn', name: 'Winn Supply' }] }),
  todayYmd: TODAY,
})

afterEach(cleanup)
beforeEach(() => {
  saveMock.mockReset()
  saveMock.mockResolvedValue(undefined)
})

function mount() {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderWithProviders(<SupplyHouseAskSheet asks={asks} authName="Grace" isMobile={false} onClose={onClose} onSaved={onSaved} />)
  return { onClose, onSaved }
}

describe('SupplyHouseAskSheet', () => {
  it('opens on the house owed most, with its jobs and what the customer has paid', async () => {
    mount()
    await settle()
    const sheet = screen.getByRole('dialog', { name: 'Ask a supply house' })
    expect(within(sheet).getByRole('tab', { name: /^Reece/ }).getAttribute('aria-selected')).toBe('true')
    expect(sheet.querySelector('[data-house-ask-summary]')?.textContent).toContain('2 jobs · $17,430.81 owed by our books · first notice Oct 15 · 1 paid in full by the customer')
    expect(within(sheet).getByText('customer paid in full')).toBeTruthy()
    expect(within(sheet).getByText('customer owes us $15,722.49')).toBeTruthy()
    // No contact on file in the stub: the sheet says so and the message can still be copied.
    expect(within(sheet).getByText(/No one is on file for this house/)).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Copy the ask' })).toBeTruthy()
  })

  it('shows the message it will copy', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Read the message' }))
    const text = document.querySelector('[data-house-ask-message]')!.textContent!
    expect(text).toContain('Click Plumbing: balances and notice dates on 2 jobs')
    expect(text).toContain('A. 363 Michael Palmer. Our books show $5,316.26 unpaid since July.')
    expect(text).toContain('Thank you,\nGrace\nClick Plumbing')
  })

  it('saves the answers typed down the list together, across houses, and closes', async () => {
    const { onClose, onSaved } = mount()
    await settle()
    const save = () => screen.getByRole('button', { name: /^Save/ }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Reece's balance on 363 Michael Palmer"), { target: { value: '5,000' } })
    fireEvent.change(screen.getByLabelText("The day Reece's notice goes out on 650 ATI Schertz"), { target: { value: '2026-10-14' } })
    fireEvent.change(screen.getByLabelText('Who said it'), { target: { value: 'Dana' } })
    fireEvent.click(screen.getByRole('tab', { name: /^Winn Supply/ }))
    fireEvent.change(screen.getByLabelText("Winn Supply's balance on 363 Michael Palmer"), { target: { value: '0' } })
    expect(screen.getByText(/They show nothing owed/)).toBeTruthy()
    expect(document.querySelector('[data-house-ask-pending]')?.textContent).toBe('3 answers to save')
    fireEvent.click(save())
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    expect(saveMock.mock.calls[0]![0]).toEqual([
      { jobId: 'j363', houseId: 'reece', balance: 5000, noticeYmd: null, saidBy: 'Dana', note: '', notedByName: 'Grace' },
      { jobId: 'j650', houseId: 'reece', balance: null, noticeYmd: '2026-10-14', saidBy: 'Dana', note: '', notedByName: 'Grace' },
      { jobId: 'j363', houseId: 'winn', balance: 0, noticeYmd: null, saidBy: '', note: '', notedByName: 'Grace' },
    ])
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refuses a balance that is not a number, and a click outside does not lose what was typed', async () => {
    const { onClose } = mount()
    await settle()
    const backdrop = screen.getByRole('dialog', { name: 'Ask a supply house' }).parentElement!
    fireEvent.change(screen.getByLabelText("Reece's balance on 363 Michael Palmer"), { target: { value: 'about 5k' } })
    expect(screen.getByText('Type the balance as a number, like 8,950.00.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Save/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close without saving' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a click outside closes it while nothing is typed', async () => {
    const { onClose } = mount()
    await settle()
    fireEvent.click(screen.getByRole('dialog', { name: 'Ask a supply house' }).parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
