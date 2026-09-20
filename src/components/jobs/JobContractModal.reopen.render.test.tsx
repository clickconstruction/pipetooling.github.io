// @vitest-environment jsdom
/**
 * Edit & re-send while unopened (Signing it on paper PR 6, v2.3647): the Contract window offers
 * it on a sent agreement nobody has opened, arms first with what the customer may be holding,
 * and never offers it once they have opened it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const rowState: { current: Record<string, unknown> } = { current: {} }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'update', 'insert']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: rowState.current, error: null })
    builder.single = () => Promise.resolve({ data: rowState.current, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [rowState.current], error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const reopenSpy = vi.fn((input: { row: { id: string; revision: number } }) => Promise.resolve({ ok: true as const, row: { ...input.row, status: 'draft', revision: input.row.revision + 1 } }))
vi.mock('../../lib/jobs/jobContractReopen', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractReopen')>('../../lib/jobs/jobContractReopen')
  return { ...actual, reopenUnopenedJobContract: (input: never) => reopenSpy(input) }
})

afterEach(cleanup)

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', revenue: 31400 })
const sentRow = (p: Record<string, unknown> = {}) => ({
  id: 'c1', job_id: 'j1', status: 'sent', revision: 1, fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '' },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: null, cc_emails: [],
  public_token: 'tok', public_token_expires_at: '2026-12-20T00:00:00Z', sent_at: '2026-09-20T15:00:00Z', last_sent_at: '2026-09-20T15:00:00Z', send_count: 1, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: null, signed_at: null, signer_mode: null, voided_at: null, sent_channel: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T15:00:00Z', ...p,
})

describe('JobContractModal — Edit & re-send', () => {
  it('arms with what the customer may be holding, then unlocks the agreement in place', async () => {
    reopenSpy.mockClear()
    rowState.current = sentRow()
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const btn = await screen.findByTestId('contract-edit-resend')
    expect(btn.textContent).toBe('Edit & re-send')
    fireEvent.click(btn)
    expect(reopenSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('contract-reopen-note').textContent).toContain('unlocks here as revision 2')
    expect(screen.getByTestId('contract-edit-resend').textContent).toBe('Confirm — unlock to edit')
    fireEvent.click(screen.getByTestId('contract-edit-resend'))
    await waitFor(() => expect(reopenSpy).toHaveBeenCalledTimes(1))
    expect(reopenSpy.mock.calls[0]![0].row.id).toBe('c1')
  })

  it('is not offered once they have opened it — the strip says why Void & redo is the way', async () => {
    rowState.current = sentRow({ first_viewed_at: '2026-09-20T16:00:00Z', view_count: 2 })
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Void & redo' })).toBeTruthy())
    expect(screen.queryByTestId('contract-edit-resend')).toBeNull()
    expect(screen.getByText(/They have opened it, so it cannot be edited in place/)).toBeTruthy()
  })
})
