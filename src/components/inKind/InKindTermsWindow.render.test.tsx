// @vitest-environment jsdom
/**
 * The terms of a deal (punch list #301): a new deal starts with the customer's open billed jobs picked; a job another
 * deal pays is locked; a monthly credit asks for its amount and first month; saving sends the terms and the jobs;
 * ending and removing each ask in a window whose press names the act.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import InKindTermsWindow, { type InKindTermsIo } from './InKindTermsWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { InKindLedgerJob } from '../../lib/inKind/inKindIo'
import { concreteDeal } from './inKindTestData'

const cand = (id: string, hcp: string, name: string, status: string, revenue: number, paid: number, arrangementId: string | null = null): InKindLedgerJob => ({
  id,
  hcp_number: hcp,
  click_number: null,
  job_name: name,
  status,
  revenue,
  payments_made: paid,
  created_at: '2026-10-01T00:00:00Z',
  in_kind_arrangement_id: arrangementId,
  invoices: [],
})
const candidates = [cand('j1', '1163', 'Water line repair', 'billed', 2400, 0), cand('j2', '1150', 'Old repair', 'paid', 300, 300), cand('j3', '1170', 'New trench', 'working', 900, 0), cand('j4', '1171', 'Wash rack', 'billed', 6800, 0, 'other')]

function makeIo(over: Partial<InKindTermsIo> = {}): InKindTermsIo {
  return { loadJobs: vi.fn(() => Promise.resolve(candidates)), save: vi.fn(() => Promise.resolve('new-id')), end: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve(true)), ...over }
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('InKindTermsWindow', () => {
  it('starts a new deal with the open billed jobs picked and locks a job another deal pays', async () => {
    renderWithProviders(<InKindTermsWindow customerId="c3" customerName="Pecan Creek Gravel" existing={null} userId="u1" onClose={() => undefined} onSaved={() => undefined} io={makeIo()} />)
    await settle()
    expect(await screen.findByText('1163 Water line repair')).toBeTruthy()
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.slice(0, 4).map((b) => b.checked)).toEqual([true, false, false, false])
    expect(boxes[3]!.disabled).toBe(true)
    expect(screen.getByText('Paid by another arrangement.')).toBeTruthy()
    expect(screen.getByText('1 job picked, $2,400.00 open on bills. Their bills will read as scheduled in kind, not late.')).toBeTruthy()
  })

  it('saves a deal with no schedule and its jobs', async () => {
    const io = makeIo()
    const onSaved = vi.fn()
    renderWithProviders(<InKindTermsWindow customerId="c3" customerName="Pecan Creek Gravel" existing={null} userId="u1" onClose={() => undefined} onSaved={onSaved} io={io} />)
    await settle()
    const press = screen.getByTestId('in-kind-terms-save') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    type('What they give instead of money', 'Road base, by the load')
    expect(press.textContent).toBe('Save the arrangement')
    fireEvent.click(press)
    await settle()
    expect(io.save).toHaveBeenCalledWith({
      id: null,
      userId: 'u1',
      jobIds: ['j1'],
      terms: { customer_id: 'c3', what_given: 'Road base, by the load', note: '', monthly_amount: null, monthly_due: null, bank_payee: '', starts_on: null },
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('asks a monthly credit for its amount and first month', async () => {
    const io = makeIo()
    renderWithProviders(<InKindTermsWindow customerId="c1" customerName="Calloway Holdings" existing={null} userId="u1" onClose={() => undefined} onSaved={() => undefined} io={io} />)
    await settle()
    type('What they give instead of money', 'Rent credit, the shop')
    fireEvent.click(screen.getByLabelText(/It has a credit every month/))
    const press = screen.getByTestId('in-kind-terms-save') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    type('The usual credit a month', '1500')
    type('The first month to enter', '2026-11')
    type('The whole monthly bill', '1000')
    expect(press.disabled).toBe(true) // the whole bill cannot be less than the credit
    type('The whole monthly bill', '3000')
    type('Its name at the bank', 'Calloway')
    fireEvent.click(press)
    await settle()
    expect(io.save).toHaveBeenCalledWith(expect.objectContaining({ terms: expect.objectContaining({ monthly_amount: 1500, monthly_due: 3000, bank_payee: 'Calloway', starts_on: '2026-11-01' }) }))
  })

  it('ends an open deal through a window whose press names the act', async () => {
    const io = makeIo()
    const onSaved = vi.fn()
    renderWithProviders(<InKindTermsWindow customerId="c2" customerName="Lone Oak Concrete" existing={concreteDeal()} userId="u1" onClose={() => undefined} onSaved={onSaved} io={io} />)
    await settle()
    expect(screen.queryByText('Remove it')).toBeNull() // it has lines on it
    fireEvent.click(screen.getByText('End the arrangement'))
    expect(screen.getByText('End this arrangement?')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByText('End the arrangement'))
    await settle()
    expect(io.end).toHaveBeenCalledWith('a2')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('removes a deal with nothing on it', async () => {
    const io = makeIo()
    const d = concreteDeal()
    d.lines = []
    d.payments = []
    renderWithProviders(<InKindTermsWindow customerId="c2" customerName="Lone Oak Concrete" existing={d} userId="u1" onClose={() => undefined} onSaved={() => undefined} io={io} />)
    await settle()
    fireEvent.click(screen.getByText('Remove it'))
    fireEvent.click(screen.getByText('Remove the arrangement'))
    await settle()
    expect(io.remove).toHaveBeenCalledWith('a2')
  })

  it('shows the reason when the save is refused', async () => {
    const io = makeIo({ save: vi.fn(() => Promise.reject(new Error('A job in the list is already paid by another arrangement.'))) })
    renderWithProviders(<InKindTermsWindow customerId="c3" customerName="Pecan Creek Gravel" existing={null} userId="u1" onClose={() => undefined} onSaved={() => undefined} io={io} />)
    await settle()
    type('What they give instead of money', 'Road base')
    fireEvent.click(screen.getByTestId('in-kind-terms-save'))
    await settle()
    expect((await screen.findByRole('alert')).textContent).toBe('A job in the list is already paid by another arrangement.')
  })
})
