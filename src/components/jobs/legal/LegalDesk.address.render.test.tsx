// @vitest-environment jsdom
/**
 * The desk on its page (punch list #182): no overlay, no ✕ and no full screen button, the page's own door before the
 * title, every change of account, tab and view told to the page so the address can follow, and on a phone the list
 * and the account one at a time (`layout="stacked"`, PR 3). The desk's own cases are in `LegalDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import LegalDesk from './LegalDesk'

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

describe('LegalDesk on its page (punch list #182)', () => {
  it('no overlay, no ✕, no full screen button, the page’s door before the title, and the address told on every change', async () => {
    const onAddressChange = vi.fn()
    const { container } = renderWithProviders(
      <LegalDesk {...baseProps} backDoor={<button type="button">← Pipeline</button>} onAddressChange={onAddressChange} />,
    )
    await settle()
    expect(container.querySelector('[role="presentation"]')).toBeNull()
    expect(container.querySelector('[data-legal-desk-panel="page"]')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: /Legal Desk/ })).toBeNull()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByLabelText('Full screen')).toBeNull()
    expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
    // The account resolved to the one payer, the default tab, the Accounts view.
    await waitFor(() => expect(onAddressChange).toHaveBeenCalledWith({ account: 'c:ridgeway', tab: 'account', view: 'accounts', doc: null }))
    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }))
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ account: 'c:ridgeway', tab: 'timeline', view: 'accounts', doc: null }))
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ account: 'c:ridgeway', tab: 'timeline', view: 'map', doc: null }))
  })

  it('the address is the truth on the page: a tab it names opens, a tab word gone from it returns to the default; the window keeps its own', async () => {
    const { rerender } = renderWithProviders(<LegalDesk {...baseProps} initialTab="timeline" />)
    await settle()
    expect(screen.getByRole('tab', { name: 'Timeline' }).getAttribute('aria-selected')).toBe('true')
    rerender(<LegalDesk {...baseProps} initialTab={null} />)
    await settle()
    expect(screen.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected')).toBe('true')
    rerender(<LegalDesk {...baseProps} initialTab={null} initialView="map" />)
    await settle()
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('stacked (a phone, PR 3): no account named is the list, a press asks the page to open one; an account named is the whole desk with ← Accounts', async () => {
    const onOpenAccount = vi.fn()
    const onShowList = vi.fn()
    const onAddressChange = vi.fn()
    const { container, rerender } = renderWithProviders(
      <LegalDesk {...baseProps} layout="stacked" backDoor={<button type="button">← Pipeline</button>} onOpenAccount={onOpenAccount} onShowList={onShowList} onAddressChange={onAddressChange} />,
    )
    await settle()
    // The list: the rail is the desk, nothing is picked, nothing is written, no tabs, the page's own door.
    expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull()
    expect(screen.queryByRole('tab', { name: 'Account' })).toBeNull()
    expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back to the accounts' })).toBeNull()
    expect(onAddressChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Ridgeway Builders/ }))
    expect(onOpenAccount).toHaveBeenCalledWith('c:ridgeway')
    // The page wrote it into the address: the account is the whole desk, ← Accounts in the door's place.
    rerender(<LegalDesk {...baseProps} layout="stacked" initialPayerKey="c:ridgeway" backDoor={<button type="button">← Pipeline</button>} onOpenAccount={onOpenAccount} onShowList={onShowList} onAddressChange={onAddressChange} />)
    await settle()
    expect(container.querySelector('[data-legal-desk-rail]')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('button', { name: '← Pipeline' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the accounts' }))
    expect(onShowList).toHaveBeenCalledTimes(1)
    // The sentence under the title gives its room to the account on a phone.
    expect(screen.queryByText(/Collections accounts, the way the firm would receive them/)).toBeNull()
    // The six tabs lead the account, pinned, the row scrolling sideways; a press brings that tab's content up under them.
    const strip = screen.getByRole('tablist', { name: 'Packet sections' })
    expect(strip.style.position).toBe('sticky')
    expect(strip.style.overflowX).toBe('auto')
    const name = screen.getAllByText('Ridgeway Builders').find((el) => el.closest('[data-legal-desk-panel]') && !el.closest('[data-legal-desk-rail]'))!
    expect(strip.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const scrolled = vi.fn()
    const had = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrolled
    try {
      fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
      await settle()
      expect(scrolled).toHaveBeenCalledWith({ block: 'start' })
    } finally {
      Element.prototype.scrollIntoView = had
    }
  })

  it('stacked, the list’s Accounts and Map tell the page with no account, and the map is one column; on a computer the legend keeps its 280 px beside the map (v2.5984)', async () => {
    const onAddressChange = vi.fn()
    const { container, unmount } = renderWithProviders(
      <LegalDesk {...baseProps} layout="stacked" onOpenAccount={noop} onShowList={noop} onAddressChange={onAddressChange} />,
    )
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await settle()
    expect(onAddressChange).toHaveBeenLastCalledWith({ account: null, tab: 'account', view: 'map', doc: null })
    expect((container.querySelector('[data-legal-map-grid]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }))
    expect(onAddressChange).toHaveBeenLastCalledWith({ account: null, tab: 'account', view: 'accounts', doc: null })
    unmount()
    const computer = renderWithProviders(<LegalDesk {...baseProps} initialView="map" />)
    await settle()
    expect((computer.container.querySelector('[data-legal-map-grid]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr) 280px')
  })

  it('on a computer the tabs sit under the fix list, the row able to scroll, and a press scrolls nothing', async () => {
    renderWithProviders(<LegalDesk {...baseProps} initialPayerKey="c:ridgeway" />)
    await settle()
    const strip = screen.getByRole('tablist', { name: 'Packet sections' })
    expect(strip.style.position).toBe('')
    expect(strip.style.overflowX).toBe('auto')
    const name = screen.getAllByText('Ridgeway Builders').find((el) => !el.closest('[data-legal-desk-rail]'))!
    expect(strip.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    const scrolled = vi.fn()
    const had = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrolled
    try {
      fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
      await settle()
      expect(scrolled).not.toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = had
    }
  })

  it('the ? card opens as its own row on the page, so the rail and the account keep a row of their own under it', async () => {
    const { container } = renderWithProviders(<LegalDesk {...baseProps} />)
    await settle()
    const panel = container.querySelector('[data-legal-desk-panel="page"]') as HTMLElement
    expect(panel.style.gridTemplateRows).toBe('auto minmax(0, 1fr)')
    fireEvent.click(screen.getByTestId('legend-button-legal-desk'))
    await settle()
    expect(screen.getByTestId('legend-card-legal-desk')).toBeTruthy()
    expect(panel.style.gridTemplateRows).toBe('auto auto minmax(0, 1fr)')
  })
})
