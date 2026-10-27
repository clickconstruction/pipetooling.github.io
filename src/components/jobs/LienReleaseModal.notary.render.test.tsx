// @vitest-environment jsdom
/**
 * The notarized PDF itself on the record (v2.5985, phase 0 of the online-notary study). A waiver printed for a notary
 * holds at Out for notary; the window opens on it again when the paper comes back, and the office attaches the PDF the
 * notary sent back (an online notary's sealed file, or the scan of the stamped paper) beside the Drive link. The file
 * goes in the release's own folder of the private bucket, and the row signs in mode notary_paper. A file that is not a
 * PDF, or too big to email, is refused before anything is stored; a failed store changes nothing. A waiver just signed
 * by link takes the file too. Take 5 Seguin's numbers (job 878, $3,800 retainage).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))

type Write = { op: string; payload: Record<string, unknown>; filters: Array<[string, unknown]> }
const db = vi.hoisted(() => ({ releases: [] as Array<Record<string, unknown>>, writes: [] as Write[] }))
const bucket = vi.hoisted(() => ({ uploads: [] as Array<{ bucket: string; path: string; file: File; opts: Record<string, unknown> }>, fail: false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; storage: unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'users') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
      builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'master-1', name: 'Malachi Whites', notes: null, archived_at: null }], error: null }).then(ok)
      return builder
    }
    if (table !== 'job_lien_releases') return realFrom(table)
    let write: Write | null = null
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'is', 'limit']) builder[m] = () => builder
    for (const m of ['eq', 'in']) {
      builder[m] = (col: string, val: unknown) => {
        write?.filters.push([col, val])
        return builder
      }
    }
    for (const op of ['insert', 'update']) {
      builder[op] = (payload: Record<string, unknown>) => {
        write = { op, payload, filters: [] }
        db.writes.push(write)
        return builder
      }
    }
    builder.single = () => {
      const target = db.releases.find((r) => write?.filters.some(([col, val]) => col === 'id' && val === r.id))
      const row = target && write ? { ...target, ...write.payload } : null
      if (row) db.releases = db.releases.map((r) => (r.id === row.id ? row : r))
      return Promise.resolve({ data: row, error: null })
    }
    builder.maybeSingle = () => Promise.resolve({ data: db.releases[0] ?? null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: db.releases, error: null }).then(ok)
    return builder
  }
  stub.storage = {
    from: (name: string) => ({
      upload: (path: string, file: File, opts: Record<string, unknown>) => {
        bucket.uploads.push({ bucket: name, path, file, opts })
        return Promise.resolve(bucket.fail ? { data: null, error: { message: 'storage down' } } : { data: { path }, error: null })
      },
      download: () => Promise.resolve({ data: null, error: { message: 'not in this test' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  }
  return { supabase: stub }
})

const bill1 = makeInvoice({ id: 'b1', status: 'billed', amount: 3800, sequence_order: 1, billed_at: '2026-10-20T15:00:00Z' })
const bill2 = makeInvoice({ id: 'b2', status: 'billed', amount: 1200, sequence_order: 2, billed_at: '2026-10-24T15:00:00Z' })
const job = makeJob({
  id: 'j878',
  hcp_number: '878',
  job_name: 'Take 5- Seguin',
  customer_name: 'Southern Post Construction, LLC',
  gc_customer_id: 'gc-southern',
  gcCustomer: { id: 'gc-southern', name: 'Southern Post Construction' },
  master_user_id: 'master-1',
  invoices: [bill1, bill2],
  revenue: 38625,
} as never)

const HELD = {
  id: 'held-1',
  job_id: 'j878',
  form_type: 'conditional_final',
  status: 'out_for_notary',
  amount: 3800,
  invoice_ids: ['b1'],
  voided_at: null,
  created_at: '2026-10-27T15:00:00Z',
  minted_at: '2026-10-27T15:00:00Z',
  notary_printed_at: '2026-10-27T15:01:00Z',
  signer_user_id: 'master-1',
  signer_signature_mode: null,
  fields: { amount: '3800', companyName: 'Click Plumbing and Electrical', checkFrom: 'Southern Post Construction, LLC', projectDescription: 'Take 5 Seguin', throughDate: '', signedDate: '2026-10-28', signerName: 'Malachi Whites', signerTitle: 'Owner' },
}

const pdf = (name = 'Take 5 notarized.pdf', bytes = 2048, type = 'application/pdf') => new File([new Uint8Array(bytes)], name, { type })
const pick = (file: File) => fireEvent.change(screen.getByLabelText('The notarized PDF'), { target: { files: [file] } })

async function openOnTheHold() {
  db.releases = [{ ...HELD }]
  renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
  return await screen.findByTestId('lien-waiver-notary-hold')
}

afterEach(() => {
  cleanup()
  db.releases = []
  db.writes = []
  bucket.uploads = []
  bucket.fail = false
})

describe('LienReleaseModal — the notarized PDF itself (v2.5985)', () => {
  it('opens again on the held waiver, says an online notary can do it over video, and offers the PDF beside the link', async () => {
    const hold = await openOnTheHold()
    expect(hold.textContent).toContain('Out for notary')
    expect(hold.textContent).toContain('An online notary can also notarize the printed page over video.')
    expect(within(hold).getByRole('button', { name: '📎 Attach the notarized PDF' })).toBeTruthy()
    expect(within(hold).getByPlaceholderText('Or paste the Google Drive link of the signed copy')).toBeTruthy()
    expect(hold.textContent).toContain('Either one marks it signed on paper and opens Send it.')
  })

  it('a PDF that came back is stored in the release’s own folder, signs the waiver before a notary, and opens Send it', async () => {
    await openOnTheHold()
    const file = pdf()
    pick(file)
    await waitFor(() => expect(db.writes).toHaveLength(1))
    expect(bucket.uploads).toHaveLength(1)
    const up = bucket.uploads[0]!
    expect(up.bucket).toBe('lien-release-documents')
    expect(up.path).toMatch(/^held-1\/notary-copy-\d+\.pdf$/)
    expect(up.file).toBe(file)
    expect(up.opts).toEqual({ contentType: 'application/pdf', upsert: false })
    expect(db.writes[0]).toMatchObject({
      op: 'update',
      payload: { notary_copy_path: up.path, status: 'signed', signer_signature_mode: 'notary_paper', signer_printed_name: 'Malachi Whites', signer_signature_storage_path: null, signer_user_id: 'master-1', signed_at: expect.any(String) },
      filters: [
        ['id', 'held-1'],
        ['status', 'out_for_notary'],
      ],
    })
    expect(db.writes[0]!.payload).not.toHaveProperty('notary_copy_url')
    expect(await screen.findByText('Signed before a notary — the PDF is on the record.')).toBeTruthy()
    const attached = await screen.findByTestId('lien-waiver-send-attached')
    expect(attached.textContent).toBe('The notarized PDF you attached')
    expect(screen.queryByTestId('lien-waiver-notary-hold')).toBeNull()
    expect(within(screen.getByTestId('lien-step-6')).getByTestId('lien-waiver-send')).toBeTruthy()
  })

  it('a photo, an empty file or a PDF too big to email is refused before anything is stored', async () => {
    await openOnTheHold()
    pick(pdf('IMG_2231.jpg', 2048, 'image/jpeg'))
    expect(await screen.findByText('Pick the PDF the notary sent back. A photo or a scan in another format will not attach.')).toBeTruthy()
    pick(pdf('empty.pdf', 0))
    expect(await screen.findByText('That PDF is empty. Pick the file the notary sent back.')).toBeTruthy()
    pick(pdf('big.pdf', 6_240_000))
    expect(await screen.findByText('That PDF is 6.2 MB. An email carries 4 MB at most. Put it on Google Drive and paste the link instead.')).toBeTruthy()
    expect(bucket.uploads).toEqual([])
    expect(db.writes).toEqual([])
    expect(screen.getByTestId('lien-waiver-notary-hold')).toBeTruthy()
  })

  it('a failed store changes nothing: the waiver stays out for notary and the link is still there', async () => {
    await openOnTheHold()
    bucket.fail = true
    pick(pdf())
    expect(await screen.findByText('Could not store the PDF — nothing changed. Try again, or paste the Drive link.')).toBeTruthy()
    expect(bucket.uploads).toHaveLength(1)
    expect(db.writes).toEqual([])
    const hold = screen.getByTestId('lien-waiver-notary-hold')
    expect(within(hold).getByRole('button', { name: '📎 Attach the notarized PDF' })).toHaveProperty('disabled', false)
  })

  it('a waiver just signed by link takes the PDF too, and only the path is written', async () => {
    const hold = await openOnTheHold()
    fireEvent.change(within(hold).getByPlaceholderText('Or paste the Google Drive link of the signed copy'), { target: { value: 'https://drive.google.com/file/d/notarized-878/view' } })
    fireEvent.click(within(hold).getByRole('button', { name: 'Save the link' }))
    const attached = await screen.findByTestId('lien-waiver-send-attached')
    expect(attached.textContent).toContain('The PDF, and the email links the notarized copy')
    db.writes = []
    fireEvent.click(within(attached).getByRole('button', { name: 'Attach the notarized PDF' }))
    pick(pdf())
    await waitFor(() => expect(db.writes).toHaveLength(1))
    expect(db.writes[0]).toEqual({
      op: 'update',
      payload: { notary_copy_path: bucket.uploads[0]!.path },
      filters: [
        ['id', 'held-1'],
        ['status', 'signed'],
        ['signer_signature_mode', 'notary_paper'],
      ],
    })
    expect(await screen.findByText('The notarized PDF is on the record. Send it attaches it.')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('lien-waiver-send-attached').textContent).toBe('The notarized PDF you attached · Drive copy ↗'))
  })

  it('a window opened on another bill makes that bill’s waiver: the held one waits in the list', async () => {
    db.releases = [{ ...HELD }]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill2} signerNameFallback="Malachi Whites" />)
    expect(await screen.findByText('out for notary')).toBeTruthy()
    expect(screen.queryByTestId('lien-waiver-notary-hold')).toBeNull()
  })
})
