// @vitest-environment jsdom
/**
 * Render smoke for v2.4566: the Sorted view says where each charge went, flags one whose
 * invoices leave money uncovered, and opens the right window for each.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { TeamPurchasesSortedList } from './TeamPurchasesSortedList'
import type { SortedTeamPurchaseRow } from '../lib/teamPurchasesSorted'

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const row = (p: Partial<SortedTeamPurchaseRow>): SortedTeamPurchaseRow => ({
  target_user_id: 'u1', target_name: 'Trace', mercury_transaction_id: 'tx', posted_at: '2026-09-30T14:59:00Z', amount: -1,
  counterparty_name: 'Store', note: null, mercury_account_id: null, currency: 'USD', mercury_id: null, raw: null,
  job_splits: [], invoice_links: [], sorted_at: '2026-10-02T20:00:00Z', sorted_by_name: 'Taunya', ...p,
})

const ROWS = [
  row({ mercury_transaction_id: 'short', amount: -595.54, counterparty_name: 'The Home Depot', invoice_links: [{ invoice_id: 'i1', invoice_number: '88231', supply_house_name: 'Home Depot', amount: 412.1 }] }),
  row({ mercury_transaction_id: 'job', amount: -100.02, counterparty_name: 'QuikTrip', job_splits: [{ job_id: 'j1', amount: -100.02, hcp_number: '1048', job_name: 'Loberg remodel' }] }),
]

describe('TeamPurchasesSortedList', () => {
  it('flags the short charge, filters to it, and routes each button', () => {
    const onChangeJobs = vi.fn()
    const onInvoices = vi.fn()
    renderWithProviders(<TeamPurchasesSortedList rows={ROWS} isNarrow={false} windowDays={30} onChangeJobs={onChangeJobs} onInvoices={onInvoices} />)
    expect(screen.getAllByTestId('team-purchases-sorted-row')).toHaveLength(2)
    expect(screen.getByText('$183.44 of the charge has no invoice yet')).toBeTruthy()
    expect(screen.getByText(/1048 · Loberg remodel/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add invoice' }))
    expect(onInvoices.mock.calls[0]![0].mercury_transaction_id).toBe('short')
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(onChangeJobs.mock.calls[0]![0].mercury_transaction_id).toBe('job')

    fireEvent.click(screen.getByRole('button', { name: 'Show only that one' }))
    expect(screen.getAllByTestId('team-purchases-sorted-row')).toHaveLength(1)
  })

  it('says so when nothing was sorted', () => {
    renderWithProviders(<TeamPurchasesSortedList rows={[]} isNarrow windowDays={30} onChangeJobs={() => {}} onInvoices={() => {}} />)
    expect(screen.getByText('Nothing was sorted in the last 30 days.')).toBeTruthy()
  })
})
