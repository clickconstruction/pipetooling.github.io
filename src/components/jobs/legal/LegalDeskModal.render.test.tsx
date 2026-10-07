// @vitest-environment jsdom
/**
 * Render smokes for the Legal desk (PR 1): the accounts rail groups two
 * Collections jobs for one customer into one account, the worth panel and
 * five tabs render, the gap strip names the contract stop, and the Their
 * word timeline carries the collections note. Wiring-level only — the packet
 * math lives in src/lib/legal/legalPacket.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
    collections_note: id === 'job-a' ? 'Customer is engaging in theft of service.' : null,
    customer_id: 'tle',
    customer_name: 'The Learning Experience',
    customer_email: 'aaron@tle.test',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })],
  })
}

const noop = () => {}
const baseProps = {
  onClose: noop,
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

describe('LegalDeskModal', () => {
  it('groups the payer, renders the worth panel, five tabs, the contract stop and the timeline', async () => {
    renderWithProviders(<LegalDeskModal open collectionsJobs={[collectionsJob('job-a', '717', 7502), collectionsJob('job-b', '718', 1480)]} {...baseProps} />)
    await settle()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getAllByText('The Learning Experience').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 account · \$8,982\.00/)).toBeTruthy()
    for (const label of ['Account', 'Paper', 'Their word', 'Evidence', 'Fees & steps']) expect(screen.getByRole('tab', { name: label })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/No signed agreement and no sworn-account basis on 717/)).toBeTruthy())
    expect(screen.getByText(/2 things an attorney will ask for first/)).toBeTruthy()
    expect(screen.getByText('Theory')).toBeTruthy()
    expect(screen.getByText('Click keeps')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Their word' }))
    expect(screen.getByText(/theft of service/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    expect(screen.getByText('Where each job stands')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Fees & steps' }))
    expect(screen.getByText(/no firm is on this account/)).toBeTruthy()
  })

  it("on Paper, a stop's title opens the window on the stop as evidence — the record, the rule, the Lien window door (v2.4800)", async () => {
    renderWithProviders(<LegalDeskModal open collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} />)
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    await waitFor(() => expect(document.querySelector('[data-legal-job-timeline] [data-lien-timeline-stop-door]')).toBeTruthy())
    const doors = [...document.querySelectorAll('[data-legal-job-timeline] [data-lien-timeline-stop-door]')] as HTMLButtonElement[]
    const suit = doors.find((d) => d.dataset.lienTimelineStopDoor === 'suit')!
    fireEvent.click(suit)
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('Suit to foreclose the lien')
    // The filing checklist: an original contractor owes no § 53.056 notice, so row A reads not needed; the affidavit is not on file.
    expect(screen.getByTestId('lien-stop-paper-checklist')).toBeTruthy()
    expect(screen.getAllByTestId('lien-stop-paper-check').map((n) => n.getAttribute('data-status')).slice(0, 2)).toEqual(['not_needed', 'not_on_file'])
    expect(screen.getByTestId('lien-stop-paper-rule-words').textContent).toContain('§ 53.158')
    expect(screen.getByTestId('lien-stop-paper-rail-venue').textContent).toContain('district court')
    expect(screen.getByTestId('lien-stop-paper-move').textContent).toBe('COUNSEL')
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open the job’s Lien window ›')
    expect(screen.getByTestId('lien-stop-paper-second-act').textContent).toBe('Copy the record as text')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-stop-paper')).toBeNull()
  })

  it('renders an empty state when nothing is in Collections', async () => {
    renderWithProviders(<LegalDeskModal open collectionsJobs={[]} {...baseProps} />)
    await settle()
    expect(screen.getByText('Nothing is in Collections.')).toBeTruthy()
  })
})

/**
 * The desk's sheets and its Apply discount window are drawn inside the desk's backdrop, outside
 * its panel. A click there carried on to the desk's backdrop and closed the desk (v2.4352): a
 * click outside a sheet closed both, and Apply discount — no backdrop handler of its own — closed
 * the desk on the first click anywhere in it.
 */
describe('LegalDeskModal · a window inside the desk (v2.4352)', () => {
  const firm = { id: 'firm-1', name: 'Barnes & Holt', handling_name: 'Dana Holt', email: 'dana@barnes.test', phone: '', contingency_pct: 33, filing_cost: 350, active: true }
  const legal = {
    available: true,
    loading: false,
    firm,
    firms: [firm],
    matters: [],
    byPayerKey: new Map(),
    byJobId: new Map(),
    jobIdsByMatter: new Map(),
    entriesByMatter: new Map(),
    recipients: [],
    firmPaused: false,
    reload: async () => {},
  }
  const renderDesk = async (extra: { canMarkReady?: boolean; canEditReview?: boolean }) => {
    const onClose = vi.fn()
    renderWithProviders(<LegalDeskModal open collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} onClose={onClose} legal={legal} {...extra} />)
    await settle()
    return onClose
  }
  const desk = () => screen.queryByRole('dialog', { name: /^Legal desk/ })

  it('a click outside Ask a dev to review closes the sheet only', async () => {
    const onClose = await renderDesk({ canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: 'Ask a dev to review…' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Ask a dev to review' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Ask a dev to review' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(desk()).toBeTruthy()
  })

  it('a click outside Mark attorney-ready, the firm preview or the firm’s emails closes that one only', async () => {
    const onClose = await renderDesk({ canMarkReady: true, canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: '⚖ Mark attorney ready…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview what the firm sees ↗' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'What the firm will see' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'What the firm will see' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Firm’s emails ↗' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Who at the firm hears from us' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Who at the firm hears from us' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Mark attorney-ready' })).toBeTruthy()
    fireEvent.click(screen.getByRole('dialog', { name: 'Mark attorney-ready' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Mark attorney-ready' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(desk()).toBeTruthy()
  })

  it('a click in Apply discount, or outside it, leaves the desk open', async () => {
    const onClose = await renderDesk({ canEditReview: true })
    fireEvent.click(screen.getAllByRole('button', { name: 'Write down…' })[0]!)
    fireEvent.click(screen.getByRole('heading', { name: 'Apply discount' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Apply discount' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Apply discount' })).toBeTruthy()
    expect(desk()).toBeTruthy()
  })

  it('the firm’s name in the header opens the firm’s window, and a click outside closes only it (v2.4711)', async () => {
    const onClose = await renderDesk({ canMarkReady: true, canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: 'The collections law firm: Barnes & Holt' }))
    const win = screen.getByRole('dialog', { name: 'The collections law firm' })
    expect(win).toBeTruthy()
    fireEvent.click(win.parentElement!)
    expect(screen.queryByRole('dialog', { name: 'The collections law firm' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(desk()).toBeTruthy()
  })

  it('with no firm, the header and the release sheet both open the firm’s window (v2.4711)', async () => {
    renderWithProviders(<LegalDeskModal open collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, firm: null, firms: [] }} canMarkReady canEditReview />)
    await settle()
    expect(screen.getByRole('button', { name: 'Set up the collections law firm' }).textContent).toBe('No firm yet · Set up the firm…')
    fireEvent.click(screen.getByRole('button', { name: '⚖ Mark attorney ready…' }))
    expect(screen.getByText('No firm is set up yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set up the firm…' }))
    expect(screen.queryByRole('dialog', { name: 'Mark attorney-ready' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'The collections law firm' })).toBeTruthy()
  })
})
