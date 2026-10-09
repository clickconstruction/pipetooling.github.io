// @vitest-environment jsdom
/**
 * Copy link on an agreement emailed as a PDF to sign (punch list #104, v2.5119): the window hands
 * out the link the row already carries and calls nothing, so the row stays a PDF send and
 * File the signed copy stays. Before, Copy link sent through send-job-contract in link mode, which
 * stamped the row a link send (v2.3723) and the paper could no longer convert it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const rowState: { current: Record<string, unknown> } = { current: {} }
const calls: { invoked: string[]; updates: Record<string, unknown>[] } = { invoked: [], updates: [] }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; functions: { invoke: (name: string) => Promise<unknown> } }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert']) builder[m] = () => builder
    builder.update = (values: Record<string, unknown>) => {
      calls.updates.push(values)
      return builder
    }
    builder.maybeSingle = () => Promise.resolve({ data: rowState.current, error: null })
    builder.single = () => Promise.resolve({ data: rowState.current, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [rowState.current], error: null }).then(ok)
    return builder
  }
  // What send-job-contract would answer, so the old path completes: a minted link, and the row re-stamped.
  stub.functions.invoke = (name: string) => {
    calls.invoked.push(name)
    rowState.current = { ...rowState.current, sent_channel: 'link', send_count: 2 }
    return Promise.resolve({ data: { ok: true, emailed: false, sign_url: 'https://app.example/contract/sign?t=minted' }, error: null })
  }
  return { supabase: stub }
})

const copied: string[] = []
beforeEach(() => {
  calls.invoked = []
  calls.updates = []
  copied.length = 0
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => (copied.push(t), Promise.resolve()) } })
})
afterEach(cleanup)

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', revenue: 31400 })
const pdfEmailed = (p: Record<string, unknown> = {}) => ({
  id: 'c1', job_id: 'j1', status: 'sent', revision: 1, fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '' },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: null, cc_emails: [],
  public_token: 'tok-pdf', public_token_expires_at: '2099-01-01T00:00:00Z', sent_at: '2026-09-20T15:00:00Z', last_sent_at: '2026-09-20T15:00:00Z', send_count: 1, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: '2026-09-23T15:00:00Z', signed_at: null, signer_mode: null, voided_at: null, sent_channel: 'pdf_email', created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T15:00:00Z', ...p,
})

async function pressCopyLink() {
  renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
  await screen.findByTestId('contract-file-signed-copy')
  // The Nudge group re-mounts on every commit: settle the loads, then query and click in one tick.
  await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
}

describe('JobContractModal — Copy link on a PDF emailed to sign (#104)', () => {
  it('copies the row’s own link, sends nothing, and the row stays a PDF send the paper can convert', async () => {
    rowState.current = pdfEmailed()
    await pressCopyLink()
    await waitFor(() => expect(copied).toEqual([`${window.location.origin}/contract/sign?t=tok-pdf`]))
    await settle()
    expect(calls.invoked).toEqual([])
    expect(calls.updates.some((u) => 'sent_channel' in u)).toBe(false)
    expect(rowState.current.sent_channel).toBe('pdf_email')
    expect(screen.getByTestId('contract-file-signed-copy')).toBeTruthy()
    expect(document.body.textContent).toContain('📎 PDF emailed to sign by hand')
  })

  it('a lapsed link still goes through the send, which renews it', async () => {
    rowState.current = pdfEmailed({ public_token_expires_at: '2020-01-01T00:00:00Z' })
    await pressCopyLink()
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    await waitFor(() => expect(copied).toEqual(['https://app.example/contract/sign?t=minted']))
  })
})
