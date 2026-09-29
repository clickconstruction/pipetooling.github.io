// @vitest-environment jsdom
/**
 * The Contract window's rail (v2.4154): one question, pre-picked from what the job knows; the
 * fields the pick needs; one button whose label follows; the sentence; the exits; the pill.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: 'office@clickplumbing.com', tagline: '', licenseLine: '' }),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

installDomShims()
afterEach(cleanup)

const withEmail = makeJob({ id: 'j1', hcp_number: '1053', job_name: 'Water heater', customer_name: 'Sam Sample', customer_email: 'sam@example.com', customer_phone: '', revenue: 2200, gc_customer_id: null, customer_id: 'c1' })
const noContact = makeJob({ id: 'j2', hcp_number: '1054', job_name: 'Repipe', customer_name: 'Pat Paper', customer_email: null, customer_phone: null, revenue: 900, gc_customer_id: null, customer_id: 'c2' })
const builders = makeJob({ id: 'j3', hcp_number: '1055', job_name: 'Rough-in', customer_name: 'Summit GC', customer_email: 'pm@summit.example', revenue: 50000, gc_customer_id: 'gc1', customer_id: 'c3', gcCustomer: { id: 'gc1', name: 'Summit GC' } })

describe('JobContractModal — the rail', () => {
  it('a customer with an email opens on Send a link, with the address filled and the sentence saying so; the pill reads draft', async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={withEmail} />)
    const rail = await screen.findByTestId('contract-rail')
    expect(within(rail).getByTestId('contract-way-link').getAttribute('aria-checked')).toBe('true')
    expect((within(rail).getByLabelText("Signer's email") as HTMLInputElement).value).toBe('sam@example.com')
    expect(within(rail).getByTestId('contract-way-go').textContent).toBe('Send the link')
    expect(within(rail).getByTestId('contract-way-sentence').textContent).toContain('Emails sam@example.com a Review & sign link from office@clickplumbing.com. Reminders every 3 days until signed, up to 3.')
    expect(screen.getByTestId('contract-status-pill').textContent).toBe('Draft · nothing sent yet')
    // the old footer and header door are gone; the exits sit under the rail
    expect(screen.queryByRole('button', { name: 'Send by email' })).toBeNull()
    expect(screen.queryByRole('button', { name: /File a signed contract/ })).toBeNull()
    expect(within(rail).getByTestId('contract-exit-file').textContent).toBe('File their signed contract')
    expect(within(rail).getByTestId('contract-exit-not-needed')).toBeTruthy()
  })

  it('no email and no mobile: Send a link is greyed with the reason, On paper is picked, and the button downloads and marks it handed over', async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={noContact} />)
    const rail = await screen.findByTestId('contract-rail')
    const link = within(rail).getByTestId('contract-way-link')
    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(link.textContent).toContain('Needs an email or a mobile')
    expect(within(rail).getByTestId('contract-way-paper').getAttribute('aria-checked')).toBe('true')
    expect(within(rail).getByTestId('contract-way-go').textContent).toBe('Download & mark handed over')
    expect(within(rail).getByTestId('contract-way-sentence').textContent).toContain('marks the agreement handed over today')
    // Email the PDF needs an address: the button greys
    fireEvent.click(within(rail).getByRole('button', { name: 'Email the PDF' }))
    expect((within(rail).getByTestId('contract-way-go') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the pick shapes the pane: Sign here, now asks only for an optional copy address and opens the signing page', async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={withEmail} />)
    const rail = await screen.findByTestId('contract-rail')
    fireEvent.click(within(rail).getByTestId('contract-way-here'))
    expect(within(rail).getByTestId('contract-pane-here')).toBeTruthy()
    expect(within(rail).queryByLabelText('Copies to')).toBeNull()
    expect(within(rail).getByTestId('contract-way-go').textContent).toBe('Open the signing page')
    expect(within(rail).getByTestId('contract-way-sentence').textContent).toContain('Their signed copy goes to sam@example.com.')
  })

  it("a builder's job leads with File their subcontract and keeps our ways behind Send ours anyway", async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={builders} />)
    const rail = await screen.findByTestId('contract-rail')
    expect(within(rail).getByTestId('contract-way-file_theirs').textContent).toContain("File Summit GC's subcontract")
    expect(within(rail).queryByTestId('contract-way-link')).toBeNull()
    expect(within(rail).getByTestId('contract-way-go').textContent).toBe('File their subcontract')
    fireEvent.click(within(rail).getByTestId('contract-send-ours'))
    expect(within(rail).getByTestId('contract-way-link')).toBeTruthy()
    await waitFor(() => expect(within(rail).getByTestId('contract-way-link').getAttribute('aria-checked')).toBe('true'))
  })

  it('the terms row names the document and reads its wording in place; Not needed opens its reasons under the rail', async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={withEmail} />)
    await screen.findByTestId('contract-rail')
    const terms = screen.getByTestId('contract-terms-row')
    expect(terms.textContent).toContain('Built-in service agreement terms')
    fireEvent.click(within(terms).getByTestId('contract-terms-read'))
    expect(terms.textContent).toContain('1. Scope.')
    fireEvent.click(screen.getByTestId('contract-exit-not-needed'))
    expect(screen.getByTestId('contract-not-needed-panel').textContent).toContain("Why doesn't this job need an agreement of ours?")
  })
})
