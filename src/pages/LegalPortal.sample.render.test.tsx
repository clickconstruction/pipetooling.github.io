// @vitest-environment jsdom
/** v2.3639: the firm portal draws the sample matter `legal-portal` answers the sample token with. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
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

  it('speaks the firm’s words, not the office’s (punch list #85 item 3)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Acme Mechanical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    expect(screen.getByText('referred')).toBeTruthy()
    expect(screen.getByText('Particulars for filing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record of contact' }))
    expect(document.body.textContent).toMatch(/Acme Mechanical's contact record with this customer/)
    fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
    expect(document.body.textContent).toMatch(/Account history, oldest first/)
    expect(document.body.textContent).toMatch(/Attorney fee/)
    expect(document.body.textContent).not.toMatch(/Needs You|Their word|From Click|Click’s|What Click did|chose to share/)
    expect(document.body.textContent).toMatch(/this is what the law firm sees/)
    expect(document.body.textContent).not.toMatch(/what a customer sees/)
  })

  it('lists the facts on file for each job, never a theory or the office’s credit terms (punch list #85 item 4)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Acme Mechanical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    const record = document.querySelector('[data-legal-job-record]')
    expect(record?.textContent).toMatch(/^signed agreement \d{4}-\d{2}-\d{2} by Pat Sample, bill sent, field record with a GPS location, no dispute logged$/)
    expect(document.body.textContent).not.toMatch(/theory|Basis|sworn account|Terms with/i)
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    expect(document.body.textContent).toMatch(/Agreements/)
    expect(document.body.textContent).not.toMatch(/Agreements and theory|holds — bill received/)
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

  it('draws no hidden honeypot box, and the function no longer reads one (v2.4622, punch list #85 item 28)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    expect(document.querySelector('input[name="website"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
    await waitFor(() => expect(document.body.textContent).toMatch(/Add a person at the firm/))
    expect(document.querySelector('input[name="website"]')).toBeNull()
    // A password manager that fills every text box would have made a real act vanish behind "Saved".
    expect(readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')).not.toMatch(/body\.website/)
  })
})
