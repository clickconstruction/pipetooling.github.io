// @vitest-environment jsdom
/**
 * Render smoke for the portal's Lien waivers (v2.4278): one row per bill, the conditional and
 * unconditional columns as a dated PDF link, "on its way", or the dashed "when your check clears".
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PortalWaiversSection from './PortalWaiversSection'
import type { PortalWaiverRow } from '../../lib/portal/portalPayload'

afterEach(cleanup)

const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const rows: PortalWaiverRow[] = [
  { jobId: 'j', jobLabel: '977 · Springtown', jobAddress: null, invoiceId: 'b', billLabel: 'Bill 2 of 3', amount: 15406, billedYmd: '2026-09-30', paid: false, final: false, conditional: { state: 'sent', ymd: '2026-09-30', pdfUrl: 'https://x.example/c2.pdf' }, unconditional: { state: 'none', ymd: null, pdfUrl: null } },
  { jobId: 'j', jobLabel: '977 · Springtown', jobAddress: null, invoiceId: 'a', billLabel: 'Bill 1 of 3', amount: 11240, billedYmd: '2026-08-12', paid: true, final: false, conditional: { state: 'sent', ymd: '2026-08-12', pdfUrl: 'https://x.example/c1.pdf' }, unconditional: { state: 'signing', ymd: '2026-09-06', pdfUrl: null } },
  { jobId: 'k', jobLabel: '898 · Reliant Health', jobAddress: null, invoiceId: 'c', billLabel: 'Bill 3 of 3', amount: 4800, billedYmd: '2026-09-29', paid: false, final: true, conditional: { state: 'none', ymd: null, pdfUrl: null }, unconditional: { state: 'none', ymd: null, pdfUrl: null } },
]

describe('PortalWaiversSection', () => {
  it('draws one row per bill with the two halves', () => {
    render(<PortalWaiversSection waivers={rows} formatUsd={usd} />)
    const items = screen.getAllByText(/Bill \d of 3/)
    expect(items).toHaveLength(3)
    const pdfs = document.querySelectorAll('[data-portal-waiver-pdf]')
    expect(pdfs).toHaveLength(2)
    expect((pdfs[0] as HTMLAnchorElement).href).toBe('https://x.example/c2.pdf')
    expect(pdfs[0]!.textContent).toContain('Sep 30')
    expect(screen.getByText('when your check clears')).toBeTruthy()
    expect(screen.getAllByText('on its way')).toHaveLength(2) // an open bill's conditional not yet sent, and the paid bill's unconditional being signed
    expect(screen.getByText('when your check clears · final')).toBeTruthy()
    expect(screen.getByText('paid')).toBeTruthy()
  })
  it('renders nothing with no rows', () => {
    const { container } = render(<PortalWaiversSection waivers={[]} formatUsd={usd} />)
    expect(container.innerHTML).toBe('')
  })
})
