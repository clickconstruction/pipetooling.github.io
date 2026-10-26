// @vitest-environment jsdom
/**
 * The desk as a page (punch list #182, PR 1): `frame="page"` draws the same desk with no overlay, no ✕ and no full
 * screen button, the page's own door before the title, and tells the page every change of account, tab and view so
 * the address can follow. The window frame's cases stay in `LegalDeskModal.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../../test/renderSmokeMocks'
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
    customer_id: 'ridgeway',
    customer_name: 'Ridgeway Builders',
    customer_email: 'ap@ridgeway.test',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })],
  })
}

const noop = () => {}
const baseProps = {
  open: true,
  onClose: noop,
  collectionsJobs: [collectionsJob('job-a', '1312', 9000), collectionsJob('job-b', '1287', 5260)],
  contractCoverage: new Map(),
  users: [],
  companyName: 'Click Plumbing and Electrical',
  onOpenContract: noop,
  onOpenLienInstruments: noop,
  onOpenEditJob: noop,
  onOpenCallMode: noop,
  onOpenAccountsReceivable: noop,
  onOpenSessionNotes: noop,
  onOpenReports: noop,
  onOpenJobThread: noop,
  onOpenPromisedPay: noop,
  onFocusJob: noop,
  onAfterWriteDown: noop,
}

afterEach(cleanup)

describe('LegalDeskModal as a page (punch list #182)', () => {
  it('frame="page": no overlay, no ✕, no full screen button, the page’s door before the title, and the address told on every change', async () => {
    const onAddressChange = vi.fn()
    const { container } = renderWithProviders(
      <LegalDeskModal {...baseProps} frame="page" backDoor={<button type="button">← Pipeline</button>} onAddressChange={onAddressChange} />,
    )
    await settle()
    expect(container.querySelector('[role="presentation"]')).toBeNull()
    expect(container.querySelector('[data-legal-desk-panel="page"]')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: /Legal Desk/ })).toBeNull()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByLabelText('Full screen')).toBeNull()
    expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
    // The account resolved to the one payer, the default tab, the Accounts view.
    await waitFor(() => expect(onAddressChange).toHaveBeenCalledWith({ account: 'c:ridgeway', tab: 'account', view: 'accounts' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }))
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ account: 'c:ridgeway', tab: 'timeline', view: 'accounts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ account: 'c:ridgeway', tab: 'timeline', view: 'map' }))
  })

  it('the address is the truth on the page: a tab it names opens, a tab word gone from it returns to the default; the window keeps its own', async () => {
    const { rerender } = renderWithProviders(<LegalDeskModal {...baseProps} frame="page" initialTab="timeline" />)
    await settle()
    expect(screen.getByRole('tab', { name: 'Timeline' }).getAttribute('aria-selected')).toBe('true')
    rerender(<LegalDeskModal {...baseProps} frame="page" initialTab={null} />)
    await settle()
    expect(screen.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected')).toBe('true')
    rerender(<LegalDeskModal {...baseProps} frame="page" initialTab={null} initialView="map" />)
    await settle()
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the window frame is as it was: an overlay that holds a dialog, the ✕ and the full screen button', async () => {
    const { container } = renderWithProviders(<LegalDeskModal {...baseProps} />)
    await settle()
    expect(container.querySelector('[role="presentation"]')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: /Legal Desk/ })).toBeTruthy()
    expect(screen.getByLabelText('Close')).toBeTruthy()
    expect(screen.getByLabelText('Full screen')).toBeTruthy()
  })
})
