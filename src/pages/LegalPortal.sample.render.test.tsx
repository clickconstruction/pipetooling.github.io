// @vitest-environment jsdom
/** v2.3639: the firm portal draws the sample matter `legal-portal` answers the sample token with. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LegalPortal — the sample matter', () => {
  it('lists Sample Contracting with its open balance', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    expect(document.body.textContent).toMatch(/14,400/)
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('draws the owner\'s answers under a notice on Paper when the payload carries the desk item that sent it (#41 PR 1b)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today) as { matters: Array<Record<string, unknown> & { jobs: Array<{ id: string }> }> }
    const matter = payload.matters[0]!
    const jobId = matter.jobs[0]!.id
    matter.lienFilings = [{ id: 'f-1', job_id: jobId, kind: 'notice_53_056', amount: 14400, months_covered: ['2026-04'], invoice_ids: [], fields: {}, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118', sent_on: '2026-09-02' }], county: '', recording_number: '', filed_at: null, served_at: null, serve_due: null, created_by: null, created_at: '2026-09-02T15:00:00Z', voided_at: null, by_hand: false, packet_id: null, printed_claim: null, document_url: '', document_note: '' }]
    matter.lienDeskItems = [{ id: 'it-1', job_id: jobId, kind: 'notice_53_056', status: 'sent', sent_at: '2026-09-02T16:00:00Z', sent_filing_id: 'f-1', created_at: '2026-09-01T10:00:00Z', voided_at: null, fields: { letterTwo: null, gcAuthorizedDirectPay: { at: '2026-09-12T12:00:00Z', name: 'Taunya', note: 'email from Pat' }, ownerCall: { at: '2026-09-10T15:30:00Z', name: 'Taunya', owesGc: 'yes', owesAmount: 20000, reserved: 'held', originalContractCompletedOn: null, note: '' } } }]
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    const band = await waitFor(() => document.querySelector('[data-legal-envelope-answers]'))
    expect(band?.textContent).toMatch(/still owes the GC \$20,000\.00 · reserved the 10% and still holds it/)
    expect(band?.textContent).toMatch(/pile A/)
    expect(band?.textContent).toMatch(/not needed — the GC authorized direct pay/)
    expect(band?.textContent).toMatch(/Sep 12 · Taunya · email from Pat/)
  })
})
