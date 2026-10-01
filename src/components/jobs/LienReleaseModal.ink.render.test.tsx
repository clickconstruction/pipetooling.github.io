// @vitest-environment jsdom
/**
 * Signing on the page's own line, and the ink kept after (v2.4335). The leader at Taunya's screen
 * signs on the signature line at the foot of the page: his printed name sits under the line as
 * text (no box anyone could type in), drawing only, and nothing is signed until there is ink on
 * the line. Once signed, the window's page shows the ink stored at signing and Download PDF hands
 * over the stored signed PDF (it rebuilt the page with the name in italic type). Job 650's numbers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
// jsdom has no canvas: the pad is a stub whose ink the test puts on the line.
const pad = vi.hoisted(() => ({ empty: true }))
// jsdom draws nothing: the line's canvas gets no 2D context (and no "not implemented" noise).
HTMLCanvasElement.prototype.getContext = (() => null) as never
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {
      pad.empty = true
    }
    isEmpty() {
      return pad.empty
    }
    toDataURL() {
      return pad.empty ? null : 'data:image/png;base64,DRAWN'
    }
  },
}))

const db = vi.hoisted(() => ({ releases: [] as Array<Record<string, unknown>>, fresh: null as Record<string, unknown> | null }))
const io = vi.hoisted(() => ({ signs: [] as Array<Record<string, unknown>>, pdfRows: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/jobs/lienReleaseSignIo', () => ({
  signLienRelease: vi.fn(async (args: Record<string, unknown>) => {
    io.signs.push(args)
    db.fresh = { ...db.releases[0], status: 'signed', signed_at: '2026-10-01T21:23:28Z', signer_consented_at: '2026-10-01T21:23:28Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'draw', signer_signature_storage_path: 'ask-1/signature.png', signed_pdf_path: 'ask-1/signed.pdf', signed_on_device_of: 'assistant-1' }
    db.releases = [db.fresh]
    return { ok: true, signedAtIso: '2026-10-01T21:23:28Z' }
  }),
}))
vi.mock('../../lib/jobs/lienReleaseInk', () => ({
  loadLienReleaseInk: vi.fn(async (row: { signer_signature_storage_path?: string | null }) => (row.signer_signature_storage_path ? 'data:image/png;base64,STORED' : null)),
  lienReleaseRowSignatureWithInk: vi.fn(async () => null),
  lienReleaseSignedPdfBlob: vi.fn(async (row: Record<string, unknown>) => {
    io.pdfRows.push(row)
    return new Blob(['the signed bytes'], { type: 'application/pdf' })
  }),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'users') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
      builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'master-1', name: 'Malachi Whites', notes: null, archived_at: null }], error: null }).then(ok)
      return builder
    }
    if (table !== 'job_lien_releases') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert', 'update']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: db.fresh, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: db.releases, error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const bill1 = makeInvoice({ id: 'b1', status: 'billed', amount: 26800, sequence_order: 0, billed_at: '2026-07-15T22:05:23Z' })
const job = makeJob({
  id: 'j650',
  hcp_number: '650',
  job_name: 'ATI Schertz — As per plans',
  customer_name: 'SCHERTZ STATION LTD',
  gc_customer_id: 'gc-loberg',
  gcCustomer: { id: 'gc-loberg', name: 'Loberg Contracting' },
  master_user_id: 'master-1',
  invoices: [bill1],
  revenue: 26800,
  payments: [
    { id: 'p1', job_id: 'j650', invoice_id: 'b1', amount: 11700, paid_on: '2026-09-14', sent_on: null, created_at: '2026-09-14T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 0 },
    { id: 'p2', job_id: 'j650', invoice_id: 'b1', amount: 6077.51, paid_on: '2026-09-28', sent_on: null, created_at: '2026-09-28T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 1 },
  ],
} as never)

const AWAITING = {
  id: 'ask-1',
  job_id: 'j650',
  form_type: 'unconditional_progress',
  status: 'awaiting_signature',
  amount: 17777.51,
  invoice_ids: ['b1'],
  voided_at: null,
  created_at: '2026-10-01T18:00:00Z',
  minted_at: '2026-10-01T18:00:00Z',
  signature_requested_at: '2026-10-01T18:00:00Z',
  signer_user_id: 'master-1',
  fields: { amount: '17777.51', companyName: 'Click Plumbing and Electrical', projectDescription: 'ATI Schertz', throughDate: '2026-07-15', signedDate: '2026-10-01', signerName: 'Malachi Whites', signerTitle: '' },
}

afterEach(() => {
  cleanup()
  db.releases = []
  db.fresh = null
  io.signs = []
  io.pdfRows = []
  pad.empty = true
  vi.restoreAllMocks()
})

describe('LienReleaseModal — he signs on the line, and the ink stays (v2.4335)', () => {
  it('the pad is the page’s signature line: his name printed under it, draw only, no ink no signing', async () => {
    db.releases = [AWAITING]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    await waitFor(() => expect(screen.getByTestId('lien-step-5').textContent).toContain('Waiting for Malachi Whites to sign'))
    fireEvent.click(within(screen.getByTestId('lien-step-5')).getByRole('button', { name: '✍ He is here, he signs now' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    const line = within(dialog).getByTestId('lien-waiver-sign-foot')
    expect(line.textContent).toContain('Sign here, on the line')
    expect(line.textContent).toContain('Malachi Whites, Click Plumbing and Electrical')
    expect(within(line).getByLabelText('Sign on the line')).toBeTruthy()
    // His name is printed, not typed: no box, and no way to type the signature at someone else's screen.
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Type it instead' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign it' }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Sign on the line first.')
    await settle()
    expect(io.signs).toHaveLength(0)
  })

  it('signed with ink: the drawing is what is signed; then the page shows the stored ink and Download PDF hands over the stored file', async () => {
    db.releases = [AWAITING]
    const createUrl = vi.fn(() => 'blob:signed')
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    await waitFor(() => expect(screen.getByTestId('lien-step-5').textContent).toContain('Waiting for Malachi Whites to sign'))
    // Before signing the page has the empty line.
    expect(screen.queryByTestId('lien-waiver-foot-ink')).toBeNull()
    fireEvent.click(within(screen.getByTestId('lien-step-5')).getByRole('button', { name: '✍ He is here, he signs now' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    pad.empty = false
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign it' }))
    await waitFor(() => expect(io.signs).toHaveLength(1))
    expect(io.signs[0]).toMatchObject({
      releaseId: 'ask-1',
      payload: { mode: 'draw', printedName: 'Malachi Whites', signaturePngBase64: 'data:image/png;base64,DRAWN' },
      signer: { userId: 'master-1' },
      onDevice: { userId: 'assistant-1', name: 'Taunya' },
    })
    const ink = await screen.findByTestId('lien-waiver-foot-ink')
    expect(ink.getAttribute('src')).toBe('data:image/png;base64,STORED')
    expect(ink.getAttribute('alt')).toBe('Signature of Malachi Whites')
    fireEvent.click(within(screen.getByTestId('lien-step-6')).getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(io.pdfRows).toHaveLength(1))
    expect(io.pdfRows[0]).toMatchObject({ id: 'ask-1', status: 'signed', signed_pdf_path: 'ask-1/signed.pdf' })
    await waitFor(() => expect(createUrl).toHaveBeenCalled())
  })
})
