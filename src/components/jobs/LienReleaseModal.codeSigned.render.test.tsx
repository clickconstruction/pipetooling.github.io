// @vitest-environment jsdom
/**
 * His code signs in the Release of Lien window, and the window says so (v2.5987, found on the live walk). After the leader
 * at Taunya's screen signs with his code, step 5 reads *typed with his code on Taunya's screen* (it said *drawn*), and the
 * page writes his name in the cursive face on the line (it showed a bare line while the print carried the name).
 * Job 650's numbers, as the ink smoke uses them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
HTMLCanvasElement.prototype.getContext = (() => null) as never
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return null
    }
  },
}))

const db = vi.hoisted(() => ({ releases: [] as Array<Record<string, unknown>>, fresh: null as Record<string, unknown> | null }))
const io = vi.hoisted(() => ({ codeSigns: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/jobs/lienDeskSignIo', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>
  return { ...actual, lienSignCodeStatus: async () => ({ set: true, setAtIso: '2026-10-23T00:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }) }
})
vi.mock('../../lib/jobs/lienReleaseSignIo', () => ({
  signLienRelease: vi.fn(),
  signLienReleaseWithCode: vi.fn(async (args: Record<string, unknown>) => {
    io.codeSigns.push(args)
    db.fresh = { ...db.releases[0], status: 'signed', signed_at: '2026-10-27T18:06:29Z', signer_consented_at: '2026-10-27T18:06:29Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'code', signer_signature_storage_path: null, signed_on_device_of: 'assistant-1' }
    db.releases = [db.fresh]
    return { ok: true, signedAtIso: '2026-10-27T18:06:29Z', printedName: 'Malachi Whites' }
  }),
}))
vi.mock('../../lib/jobs/lienReleaseInk', () => ({
  loadLienReleaseInk: vi.fn(async () => null),
  lienReleaseRowSignatureWithInk: vi.fn(async () => null),
  lienReleaseSignedPdfBlob: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
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
  io.codeSigns = []
  vi.restoreAllMocks()
})

describe('LienReleaseModal — signed with his code (v2.5987)', () => {
  it('step 5 says typed with his code on Taunya’s screen, and the page writes his name in script', async () => {
    db.releases = [AWAITING]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    await waitFor(() => expect(screen.getByTestId('lien-step-5').textContent).toContain('Waiting for Malachi Whites to sign'))
    expect(screen.queryByTestId('lien-waiver-foot-typed')).toBeNull()
    fireEvent.click(within(screen.getByTestId('lien-step-5')).getByRole('button', { name: '✍ He is here, he signs now' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    fireEvent.change(await within(dialog).findByLabelText('Malachi types his signing code'), { target: { value: '2468' } })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign it with his code' }))
    await waitFor(() => expect(io.codeSigns).toHaveLength(1))
    expect(io.codeSigns[0]).toMatchObject({ releaseId: 'ask-1', signerUserId: 'master-1', code: '2468', deviceUserName: 'Taunya' })
    await waitFor(() => expect(screen.getByTestId('lien-step-5').textContent).toContain('by Malachi Whites · typed with his code on Taunya’s screen'))
    expect(screen.getByTestId('lien-step-5').textContent).not.toContain('drawn')
    expect((await screen.findByTestId('lien-waiver-foot-typed')).textContent).toBe('Malachi Whites')
    expect(screen.queryByTestId('lien-waiver-foot-ink')).toBeNull()
  })
})
