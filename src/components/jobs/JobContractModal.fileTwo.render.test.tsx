// @vitest-environment jsdom
/**
 * Filing a paper signed by two from the Contract window (v2.4657): the draft named a second
 * signer, so the filing sheet's Second signer box starts with them, Who signed defaults to the
 * recipient alone, and the record is written with both frames, the second marked paper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const db = vi.hoisted(() => ({ row: {} as Record<string, unknown>, updates: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert']) builder[m] = () => builder
    builder.update = (payload: Record<string, unknown>) => {
      db.updates.push(payload)
      db.row = { ...db.row, ...payload }
      return builder
    }
    builder.maybeSingle = () => Promise.resolve({ data: db.row, error: null })
    builder.single = () => Promise.resolve({ data: db.row, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [db.row], error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', revenue: 31400 })
const draftRow = () => ({
  id: 'c1', job_id: 'j1', status: 'draft', revision: 1,
  fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '', start_date: '2026-10-01', completion_date: null },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: null, cc_emails: [],
  co_signer_name: 'Grace Palmer', co_signer_email: null, co_signed_at: null, co_signer_printed_name: null, co_signer_mode: null, co_signer_consented_at: null,
  public_token: null, public_token_expires_at: null, sent_at: null, last_sent_at: null, send_count: 0, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: null, signed_at: null, signer_mode: null, voided_at: null, sent_channel: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T15:00:00Z',
})

beforeEach(() => {
  db.row = draftRow()
  db.updates = []
})
afterEach(cleanup)

describe('JobContractModal — filing a paper signed by two', () => {
  it("starts the sheet with the draft's second signer in a box of their own, and records both frames", async () => {
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    await screen.findByText('Saved as you type.')
    await settle()
    db.updates = []
    fireEvent.click(screen.getByTestId('contract-exit-file'))
    const sheet = await screen.findByTestId('contract-file-sheet')
    expect((within(sheet).getByLabelText('Who signed') as HTMLInputElement).value).toBe('Michael Palmer')
    expect((within(sheet).getByLabelText('Second signer') as HTMLInputElement).value).toBe('Grace Palmer')
    fireEvent.change(within(sheet).getByLabelText('Google Doc link'), { target: { value: 'https://docs.google.com/document/d/1' } })
    fireEvent.change(within(sheet).getByLabelText('Date the contract was signed'), { target: { value: '2026-09-30' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() =>
      expect(db.updates[0]).toMatchObject({
        status: 'signed',
        signer_mode: 'paper',
        signer_printed_name: 'Michael Palmer',
        signed_at: '2026-09-30T12:00:00Z',
        co_signer_name: 'Grace Palmer',
        co_signer_printed_name: 'Grace Palmer',
        co_signed_at: '2026-09-30T12:00:00Z',
        co_signer_mode: 'paper',
        co_signer_consented_at: null,
      }),
    )
  })

  it("on a builder's job, the subcontract door files it as signed by the GC, with no second signer from our draft", async () => {
    const gcJob = makeJob({ id: 'j1', hcp_number: '804', job_name: 'Auto Zone', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', customer_id: 'c1', gc_customer_id: 'gc1', gcCustomer: { id: 'gc1', name: 'Summit GC' }, revenue: 32600 } as Parameters<typeof makeJob>[0])
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={gcJob} />)
    await screen.findByText('Saved as you type.')
    await settle()
    db.updates = []
    const go = screen.getByTestId('contract-way-go')
    expect(go.textContent).toBe('File their subcontract')
    fireEvent.click(go)
    const sheet = await screen.findByTestId('contract-file-sheet')
    expect((within(sheet).getByLabelText('Who signed') as HTMLInputElement).value).toBe('Summit GC')
    expect((within(sheet).getByLabelText('Second signer') as HTMLInputElement).value).toBe('')
    fireEvent.change(within(sheet).getByLabelText('Google Doc link'), { target: { value: 'https://docs.google.com/document/d/1' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(db.updates[0]).toMatchObject({ status: 'signed', signer_mode: 'paper', signer_printed_name: 'Summit GC' }))
    expect(db.updates[0]).not.toHaveProperty('co_signer_printed_name')
  })
})
