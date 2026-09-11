// @vitest-environment jsdom
/**
 * Render smokes for the Legal desk (PR 1): the accounts rail groups two
 * Collections jobs for one customer into one account, the five tabs render,
 * and the gap strip names the contract stop. Wiring-level only — the packet
 * math lives in src/lib/legal/legalPacket.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../../test/renderSmokeMocks'
import LegalDeskModal from './LegalDeskModal'

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function collectionsJob(id: string, hcp: string, amount: number) {
  return makeJob({
    id,
    hcp_number: hcp,
    status: 'billed',
    collections_at: '2026-08-20T15:00:00Z',
    collections_note: id === 'job-a' ? 'Customer is engaging in theft of service.' : null,
    customer_id: 'tle',
    customer_name: 'The Learning Experience',
    customer_email: 'aaron@tle.test',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount, status: 'billed', billed_at: '2026-04-17T12:00:00Z' })],
  })
}

const noop = () => {}

describe('LegalDeskModal', () => {
  it('groups the payer, renders the five tabs and the contract gap', async () => {
    renderWithProviders(
      <LegalDeskModal
        open
        onClose={noop}
        collectionsJobs={[collectionsJob('job-a', '717', 7502), collectionsJob('job-b', '718', 1480)]}
        contractCoverage={new Map()}
        users={[]}
        companyName="Click Plumbing and Electrical"
        onOpenContract={noop}
        onOpenLienInstruments={noop}
        onOpenEditJob={noop}
        onOpenCallMode={noop}
      />,
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    // One account for two jobs, with the summed balance.
    expect(screen.getAllByText('The Learning Experience').length).toBeGreaterThan(0)
    expect(screen.getByText('1 account · $8,982.00')).toBeTruthy()
    for (const label of ['Account', 'Paper', 'Their word', 'Evidence', 'Fees & steps']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy()
    }
    await waitFor(() => expect(screen.getByText(/No signed agreement on 717/)).toBeTruthy())
    expect(screen.getByText(/2 things an attorney will ask for first/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Their word' }))
    expect(screen.getByText(/theft of service/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Fees & steps' }))
    expect(screen.getByText(/no firm is assigned/)).toBeTruthy()
  })

  it('renders an empty state when nothing is in Collections', () => {
    renderWithProviders(
      <LegalDeskModal
        open
        onClose={noop}
        collectionsJobs={[]}
        contractCoverage={new Map()}
        users={[]}
        companyName="Click Plumbing and Electrical"
        onOpenContract={noop}
        onOpenLienInstruments={noop}
        onOpenEditJob={noop}
        onOpenCallMode={noop}
      />,
    )
    expect(screen.getByText('Nothing is in Collections.')).toBeTruthy()
  })
})
