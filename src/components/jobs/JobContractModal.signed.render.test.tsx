// @vitest-environment jsdom
/**
 * One window across states (v2.4183): a signed agreement opens the Contract window on its signed
 * state — the paper as signed on the left, the signed rail on the right — and Start a new
 * agreement… turns it back into a draft. An estimate acceptance shows the record and reads Accepted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))
vi.mock('../estimates/CustomerAcceptanceRecordBody', () => ({
  CustomerAcceptanceRecordBody: () => <div data-testid="acceptance-body-stub">acceptance record</div>,
}))

const printed: { current: string[] } = { current: [] }
vi.mock('../../lib/sent/sentCopiesIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/sent/sentCopiesIo')>()),
  printAndFile: (html: string) => {
    printed.current.push(html)
    return true
  },
}))

const rowsState: { current: Record<string, unknown>[] } = { current: [] }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; storage?: unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'update', 'insert']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: rowsState.current[0] ?? null, error: null })
    builder.single = () => Promise.resolve({ data: rowsState.current[0] ?? null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rowsState.current, error: null }).then(ok)
    return builder
  }
  stub.storage = { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://files.example/sig.png' } }) }) }
  return { supabase: stub }
})

afterEach(cleanup)

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', customer_phone: '512-555-0100', revenue: 31400 })
const signedRow = (p: Record<string, unknown> = {}) => ({
  id: 'c1', job_id: 'j1', status: 'signed', revision: 2, fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '' },
  body_html: '1. Scope. The work.\n2. Payment. Half down.', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, template_version_date: '2026-09-01',
  recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: null, cc_emails: [],
  public_token: 'tok', public_token_expires_at: '2026-12-20T00:00:00Z', sent_at: '2026-09-20T15:00:00Z', last_sent_at: '2026-09-20T15:00:00Z', send_count: 1, first_viewed_at: '2026-09-20T16:00:00Z', last_viewed_at: '2026-09-20T16:00:00Z', view_count: 2,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: null,
  signed_at: '2026-09-21T14:30:00Z', signer_mode: 'draw', signer_printed_name: 'Michael Palmer', signer_consented_at: '2026-09-21T14:29:00Z', signer_ip: '203.0.113.9', signer_user_agent: 'Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1',
  signer_signature_storage_path: 'sig/c1.png', signed_pdf_path: 'pdf/c1.pdf', paper_upload_path: null, signed_document_url: null, paper_signed_on: null,
  voided_at: null, sent_channel: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-21T14:30:00Z',
  ...p,
})

describe('JobContractModal — the signed state', () => {
  it('a signed contract: the pill reads Signed, the paper carries the signature, the rail offers Share and Keep, and Start a new agreement… turns the window into a draft', async () => {
    rowsState.current = [signedRow()]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(screen.getByTestId('contract-status-pill').textContent).toMatch(/^✍ Signed .* · Michael Palmer$/)
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Signed by Michael Palmer')
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Drawn on their phone')
    expect(within(rail).getByTestId('contract-signed-email').textContent).toContain('Email a copy…')
    expect(within(rail).getByTestId('contract-signed-copy-link')).toBeTruthy()
    expect(within(rail).getByRole('button', { name: 'Text link' })).toBeTruthy()
    expect(within(rail).getByRole('button', { name: 'Print / save as PDF' })).toBeTruthy()
    // the stored PDF resolves to a link
    await waitFor(() => expect(screen.getByTestId('contract-signed-pdf').getAttribute('href')).toBe('https://files.example/sig.png'))
    // the paper is read-only and signed
    const paper = screen.getByTestId('contract-paper')
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Michael Palmer')
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Signed electronically')
    expect(within(paper).queryByTestId('paper-scope-textarea')).toBeNull()
    expect(screen.queryByTestId('contract-rail')).toBeNull()
    expect(screen.queryByTestId('contract-sent-rail')).toBeNull()
    // no second window: the old Signed agreement view is gone
    expect(screen.queryByText(/Signed agreement · J363/)).toBeNull()
    // Start a new agreement… → a fresh draft with the signing rail, the signed copy noted
    fireEvent.click(within(rail).getByTestId('contract-signed-start-new'))
    expect(await screen.findByTestId('contract-rail')).toBeTruthy()
    expect(screen.queryByTestId('contract-signed-rail')).toBeNull()
    expect(screen.getByTestId('contract-status-pill').textContent).toBe('Signed copy on file · a new agreement would supersede it')
  })

  it('a second signer (v2.4590): the pill and the banner name both, the paper stamps each frame, and the print draws two blocks', async () => {
    printed.current = []
    rowsState.current = [
      signedRow({
        signed_at: '2026-09-21T14:45:00Z',
        co_signer_name: 'Grace Palmer',
        co_signer_email: 'grace@example.com',
        co_signed_at: '2026-09-21T14:45:00Z',
        co_signer_printed_name: 'Grace Palmer',
        co_signer_mode: 'type',
        co_signer_consented_at: '2026-09-21T14:45:00Z',
        co_signer_signature_storage_path: null,
      }),
    ]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(screen.getByTestId('contract-status-pill').textContent).toMatch(/^✍ Signed .* · Michael Palmer and Grace Palmer$/)
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Signed by Michael Palmer and Grace Palmer')
    // the paper's first frame carries its own signing time (9:29 AM), not the agreement's (9:45 AM)
    const sig = within(screen.getByTestId('contract-paper')).getByTestId('paper-signature').textContent ?? ''
    expect(sig).toContain('Signed electronically by Michael Palmer (drawn) · Sep 21, 2026, 9:29 AM CT')
    expect(sig).toContain('Signed electronically by Grace Palmer (typed) · Sep 21, 2026, 9:45 AM CT')
    // Print / save as PDF: the record with both blocks, as the stored PDF has them
    fireEvent.click(within(rail).getByRole('button', { name: 'Print / save as PDF' }))
    expect(printed.current).toHaveLength(1)
    const html = printed.current[0]!
    expect(html).toContain('Customer signature')
    expect(html).toContain('<h2>Second signature</h2>')
    expect(html.match(/class="frame"/g)).toHaveLength(2)
    expect(html).toContain('<div class="mark">Grace Palmer</div>')
    expect(html).toContain('Sep 21, 2026, 9:29 AM CT')
    expect(html).toContain('Sep 21, 2026, 9:45 AM CT')
  })

  it('a paper record whose draft named a second signer: one Signed on paper block, no open "signs here" frame beside it (v2.4590)', async () => {
    rowsState.current = [signedRow({ signer_mode: 'paper', public_token: null, signed_document_url: 'https://docs.google.com/document/d/abc/edit', signer_signature_storage_path: null, signed_pdf_path: null, signer_ip: null, signer_user_agent: null, signer_consented_at: null, signer_printed_name: 'Michael Palmer and Grace Palmer', co_signer_name: 'Grace Palmer' })]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Michael Palmer and Grace Palmer')
    const paper = screen.getByTestId('contract-paper')
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Signed on paper by Michael Palmer and Grace Palmer')
    expect(within(paper).queryByTestId('paper-cosigner-frame')).toBeNull()
  })

  it('a paper signed by two (v2.4657): both frames filed from the paper read as one mark naming both, with no second mark', async () => {
    rowsState.current = [
      signedRow({
        signer_mode: 'paper', public_token: null, signed_document_url: 'https://docs.google.com/document/d/abc/edit', signer_signature_storage_path: null, signed_pdf_path: null, signer_ip: null, signer_user_agent: null, signer_consented_at: null,
        signer_printed_name: 'Michael Palmer', paper_signed_on: '2026-09-21', signed_at: '2026-09-21T12:00:00Z',
        co_signer_name: 'Grace Palmer', co_signed_at: '2026-09-21T12:00:00Z', co_signer_printed_name: 'Grace Palmer', co_signer_mode: 'paper', co_signer_consented_at: null, co_signer_signature_storage_path: null,
      }),
    ]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(screen.getByTestId('contract-status-pill').textContent).toMatch(/^✍ Signed .* · Michael Palmer and Grace Palmer$/)
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Michael Palmer and Grace Palmer')
    const paper = screen.getByTestId('contract-paper')
    expect(paper.textContent).toContain('for Michael Palmer and Grace Palmer')
    const sig = within(paper).getByTestId('paper-signature').textContent ?? ''
    expect(sig).toContain('✍ Michael Palmer and Grace Palmer')
    expect(sig).toContain('Signed on paper by Michael Palmer and Grace Palmer · recorded Sep 21, 2026, 7:00 AM CT')
    expect(within(paper).queryByTestId('paper-cosignature')).toBeNull()
    expect(within(paper).queryByTestId('paper-cosigner-frame')).toBeNull()
  })

  it('a paper filed after the second signer signed through the link (v2.4657): the paper names its own signer, and the link signature keeps its mark', async () => {
    rowsState.current = [
      signedRow({
        signer_mode: 'paper', public_token: null, signed_document_url: 'https://docs.google.com/document/d/abc/edit', signer_signature_storage_path: null, signed_pdf_path: null, signer_ip: null, signer_user_agent: null, signer_consented_at: null,
        signer_printed_name: 'Michael Palmer', paper_signed_on: '2026-09-21', signed_at: '2026-09-21T12:00:00Z',
        co_signer_name: 'Grace Palmer', co_signed_at: '2026-09-20T17:00:00Z', co_signer_printed_name: 'Grace Palmer', co_signer_mode: 'draw', co_signer_consented_at: '2026-09-20T17:00:00Z', co_signer_signature_storage_path: 'sig/c1-co.png',
      }),
    ]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    await screen.findByTestId('contract-signed-rail')
    expect(screen.getByTestId('contract-status-pill').textContent).toMatch(/· Michael Palmer and Grace Palmer$/)
    const paper = screen.getByTestId('contract-paper')
    const sig = within(paper).getByTestId('paper-signature').textContent ?? ''
    expect(sig).toContain('Signed on paper by Michael Palmer · recorded Sep 21, 2026, 7:00 AM CT')
    expect(sig).not.toContain('Signed on paper by Michael Palmer and Grace Palmer')
    expect(within(paper).getByTestId('paper-cosignature').textContent).toContain('Signed electronically by Grace Palmer (drawn) · Sep 20, 2026, 12:00 PM CT')
  })

  it('a filed Google Doc: the document door and the copy by email as the link; no signing link to copy', async () => {
    rowsState.current = [signedRow({ signer_mode: 'paper', public_token: null, signed_document_url: 'https://docs.google.com/document/d/abc/edit', signer_signature_storage_path: null, signed_pdf_path: null, signer_ip: null, signer_user_agent: null, signer_consented_at: null })]
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('filed as a Google Doc')
    expect(within(rail).getByRole('link', { name: /Open the signed Google Doc/ }).getAttribute('href')).toBe('https://docs.google.com/document/d/abc/edit')
    expect(within(rail).getByTestId('contract-signed-email').textContent).toContain('the link')
    expect(within(rail).queryByTestId('contract-signed-copy-link')).toBeNull()
    expect(within(rail).queryByRole('button', { name: 'Print / save as PDF' })).toBeNull()
    // the paper prints a note in place of a body the filed record never held
    const paper = screen.getByTestId('contract-paper')
    expect(within(paper).getByTestId('paper-filed-note').textContent).toContain('the Google Doc filed with this record is the agreement')
    expect(within(paper).queryByText('Scope as discussed.')).toBeNull()
    expect(within(paper).queryByTestId('contract-terms-row')).toBeNull()
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Signed on paper by Michael Palmer')
    expect(screen.queryByRole('button', { name: 'Open full size' })).toBeNull()
  })

  it('an estimate the customer accepted: the record on the left, Accepted in the pill, the estimate door in the rail', async () => {
    rowsState.current = []
    renderWithProviders(
      <JobContractModal
        open
        onClose={() => undefined}
        job={job}
        coverage={{ kind: 'signed', source: 'estimate', signedAt: '2026-09-18T12:00:00Z', signerName: 'Michael Palmer', contractId: null, estimateNumber: 412, estimateId: 'e1' }}
      />,
    )
    const rail = await screen.findByTestId('contract-signed-rail')
    expect(screen.getByTestId('contract-acceptance-record')).toBeTruthy()
    expect(screen.queryByTestId('contract-paper')).toBeNull()
    expect(screen.getByTestId('contract-status-pill').textContent).toMatch(/^✍ Accepted /)
    expect(within(rail).getByTestId('contract-signed-banner').textContent).toContain('Accepted by Michael Palmer')
    expect(within(rail).getByTestId('contract-signed-open-estimate').textContent).toBe('Open estimate #412')
    expect(within(rail).getByTestId('contract-signed-email')).toBeTruthy()
    // the draft's signing rail stays away while the acceptance is the agreement
    expect(screen.queryByTestId('contract-rail')).toBeNull()
    expect(screen.queryByText('Saves as you type.')).toBeNull()
  })
})
