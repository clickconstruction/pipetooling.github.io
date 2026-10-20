// @vitest-environment jsdom
/**
 * The link doors on an agreement emailed as a PDF to sign (punch list #104, v2.5119): Copy link,
 * Text the link and Open the signing page on this device hand out the link the row already carries
 * and call nothing, so the row stays a PDF send and File the signed copy stays. Before, each sent
 * through send-job-contract in link mode, which stamped the row a link send (v2.3723), and the
 * paper could no longer convert it. A link near its end, a draft, and a row another tab moved
 * still go through the send.
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
  // What send-job-contract would answer, so the send path completes: a minted link, and the row re-stamped.
  stub.functions.invoke = (name: string) => {
    calls.invoked.push(name)
    rowState.current = { ...rowState.current, sent_channel: 'link', send_count: 2 }
    return Promise.resolve({ data: { ok: true, emailed: false, sign_url: 'https://app.example/contract/sign?t=minted' }, error: null })
  }
  return { supabase: stub }
})

const copied: string[] = []
const opened: string[] = []
beforeEach(() => {
  calls.invoked = []
  calls.updates = []
  copied.length = 0
  opened.length = 0
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => (copied.push(t), Promise.resolve()) } })
  vi.spyOn(window, 'open').mockImplementation((u?: string | URL) => (opened.push(String(u)), null))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', revenue: 31400 })
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const pdfEmailed = (p: Record<string, unknown> = {}) => ({
  id: 'c1', job_id: 'j1', status: 'sent', revision: 1, fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '' },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: '512-555-0100', cc_emails: [],
  public_token: 'tok-pdf', public_token_expires_at: inDays(60), sent_at: '2026-09-20T15:00:00Z', last_sent_at: '2026-09-20T15:00:00Z', send_count: 1, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: '2026-09-23T15:00:00Z', signed_at: null, signer_mode: null, voided_at: null, sent_channel: 'pdf_email', created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T15:00:00Z', ...p,
})
const ownLink = () => `${window.location.origin}/contract/sign?t=tok-pdf`

/** Mount on a sent row and press one of its doors once the loads settle (the groups re-mount on every commit). */
async function press(name: string, before?: () => void) {
  renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
  await screen.findByTestId('contract-file-signed-copy')
  await settle()
  before?.()
  fireEvent.click(screen.getByRole('button', { name }))
}

function staysAPdfSend() {
  expect(calls.invoked).toEqual([])
  expect(calls.updates.some((u) => 'sent_channel' in u)).toBe(false)
  expect(rowState.current.sent_channel).toBe('pdf_email')
  expect(screen.getByTestId('contract-file-signed-copy')).toBeTruthy()
  expect(document.body.textContent).toContain('📎 PDF emailed to sign by hand')
}

describe('JobContractModal — the link doors on a PDF emailed to sign (#104)', () => {
  it('Copy link copies the row’s own link, sends nothing, and the row stays a PDF send the paper can convert', async () => {
    rowState.current = pdfEmailed()
    await press('Copy link')
    await waitFor(() => expect(copied).toEqual([ownLink()]))
    await settle()
    staysAPdfSend()
  })

  it('Text the link and Open the signing page on this device hand out the same link and send nothing', async () => {
    rowState.current = pdfEmailed()
    await press('Text the link')
    await settle()
    staysAPdfSend()
    cleanup()
    rowState.current = pdfEmailed()
    await press('Open the signing page on this device')
    await waitFor(() => expect(opened).toEqual([`${ownLink()}&inperson=1`]))
    staysAPdfSend()
  })

  it('a link with a week or less left goes through the send, which renews it', async () => {
    rowState.current = pdfEmailed({ public_token_expires_at: inDays(3) })
    await press('Copy link')
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    await waitFor(() => expect(copied).toEqual(['https://app.example/contract/sign?t=minted']))
  })

  it('a row another tab voided goes through the send, which says what is wrong, instead of handing out a dead link', async () => {
    rowState.current = pdfEmailed()
    await press('Copy link', () => {
      rowState.current = pdfEmailed({ status: 'voided', voided_at: '2026-10-09T22:00:00Z', public_token: null })
    })
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    expect(copied).not.toContain(ownLink())
  })

  it('a draft carrying the token Void & redo moved onto it still sends, so it goes out first', async () => {
    rowState.current = pdfEmailed({ status: 'draft', sent_channel: null, sent_at: null, last_sent_at: null, send_count: 0 })
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    await screen.findByRole('button', { name: 'Copy the link' })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    await waitFor(() => expect(copied).toEqual(['https://app.example/contract/sign?t=minted']))
  })
})
