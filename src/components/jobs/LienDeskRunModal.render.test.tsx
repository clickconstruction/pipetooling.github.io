// @vitest-environment jsdom
/**
 * Render smokes for the run (v2.3410): one envelope per name and address
 * (v2.3720) with its method + tracking and the notices inside it, the
 * envelope count, a missing address blocks Record, an email method needs an
 * address on file.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskRunModal from './LienDeskRunModal'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const recordMock = vi.fn(async () => ({ recorded: ['it1'], failed: [] }))
vi.mock('../../lib/jobs/lienDeskRunIo', () => ({ recordLienDeskRun: (...args: unknown[]) => recordMock(...(args as [])) }))

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j650',
    kind: 'notice_53_056',
    label: '650 · ATI Schertz',
    jobNumber: '650',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: { noticeDate: '2026-09-14', projectDescription: 'ATI Schertz — 1204 Elbel Rd', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: { refItems: ['Job #650'] },
    coverLetter: null,
    coverNote: 'This is a routine notice…',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '4 Example Way, Schertz, TX', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ],
    ...partial,
  }
}

describe('LienDeskRunModal', () => {
  it('lists an envelope per recipient with the method and tracking, the notice inside it, counts the envelopes, and can record', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Send the run' })).toBeTruthy()
    expect(screen.getByText('Send the run · 1 notice')).toBeTruthy()
    expect(screen.getByTestId('run-envelope-1').textContent).toContain('Envelope 1 · Owner of record Elbel Holdings LLC')
    expect(screen.getByTestId('run-envelope-2').textContent).toContain('office@loberg.test')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 · ATI Schertz')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('cover note')
    expect(screen.getByTestId('run-row-j650-original_contractor').textContent).toContain('Copy for: original contractor')
    expect(screen.getAllByText('June and July 2026')).toHaveLength(2) // once per copy
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    expect((screen.getByRole('button', { name: /Record the run/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elbel Holdings LLC — tracking'), { target: { value: '9407 1118 9922' } })
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elbel Holdings LLC — tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    // Email is offered only where an address is on file.
    const gcMethod = screen.getByLabelText('Envelope 2 · Original contractor: Loberg Contracting — method') as HTMLSelectElement
    fireEvent.change(gcMethod, { target: { value: 'email' } })
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('a recipient with no mailing address blocks the run and says so', async () => {
    const n = notice()
    n.recipients[0] = { ...n.recipients[0]!, name: '', address: '' }
    renderWithProviders(<LienDeskRunModal notices={[n]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText(/Owner of record: nobody to send to/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Record the run/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Fix the recipients marked in red/)).toBeTruthy()
  })

  it('two notices to one owner at one address share an envelope, and the GC gets one envelope with both inside — one tracking number each', async () => {
    const a = notice()
    const b = notice({ itemId: 'it2', jobId: 'j651', label: '651 · ATI Schertz II', jobNumber: '651', months: ['2026-07'] })
    renderWithProviders(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Send the run · 2 notices')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    expect(screen.getByText(/share an envelope/)).toBeTruthy()
    expect(screen.getByTestId('run-envelope-1').textContent).toContain('2 notices inside')
    expect(screen.getByTestId('run-row-j650-owner')).toBeTruthy()
    expect(screen.getByTestId('run-row-j651-owner')).toBeTruthy()
    expect(screen.queryByTestId('run-envelope-3')).toBeNull()
    // one tracking box for the envelope; typing in it is typing for both notices inside
    fireEvent.change(screen.getByLabelText('Envelope 2 · Original contractor: Loberg Contracting — tracking'), { target: { value: '9407 2' } })
    expect((screen.getByLabelText('Envelope 2 · Original contractor: Loberg Contracting — tracking') as HTMLInputElement).value).toBe('9407 2')
    expect(screen.getAllByLabelText(/— tracking$/)).toHaveLength(2)
  })
})

describe('LienDeskRunModal · the saved copy (v2.3763)', () => {
  it('carries the Drive link and the note into the record', async () => {
    recordMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-saved-copy')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'drive.google.com/file/d/abc/view' } })
    fireEvent.change(screen.getByLabelText('Saved copy — note'), { target: { value: 'the packet as printed' } })
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const opts = (recordMock.mock.calls[0] as unknown as [unknown, { document?: { url?: string; note?: string } }])[1]
    expect(opts.document).toEqual({ url: 'drive.google.com/file/d/abc/view', note: 'the packet as printed' })
  })
})

describe('LienDeskRunModal · one notice per property (#35 PR 3)', () => {
  it('offers the combine tick only when jobs share an owner and address, folds them into one notice, and records the combined notice with its parts', async () => {
    recordMock.mockClear()
    const a = notice()
    const b = { ...notice(), itemId: 'it2', jobId: 'j651', label: '651 · ATI Schertz annex', jobNumber: '651', amount: 4_500, months: ['2026-08'] }
    renderWithProviders(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Send the run · 2 notices')).toBeTruthy()
    const tick = screen.getByLabelText('Combine the jobs at one property into one notice') as HTMLInputElement
    expect(tick.checked).toBe(false)
    expect(screen.getByTestId('run-combine').textContent).toContain('2 jobs would print as 1 notice (1 combined)')
    fireEvent.click(tick)
    expect(screen.getByText('Send the run · 1 notice for 2 jobs')).toBeTruthy()
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 + 651')
    expect(screen.getAllByTestId('run-combined-parts').map((el) => el.textContent)).toEqual(['650 $33,500 · 651 $4,500', '650 $33,500 · 651 $4,500']) // once per copy
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    // The tracking typed on the envelope reaches both parts.
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elbel Holdings LLC — tracking'), { target: { value: '9407 0000' } })
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [{ jobNumber: string; amount: number; months: string[]; parts?: { itemId: string }[]; recipients: { key: string; tracking: string }[] }[]]
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ jobNumber: '650 + 651', amount: 38_000, months: ['2026-06', '2026-07', '2026-08'] })
    expect(sent[0]!.parts!.map((p) => p.itemId)).toEqual(['it1', 'it2'])
    expect(sent[0]!.recipients.find((r) => r.key === 'owner')!.tracking).toBe('9407 0000')
  })
  it('two jobs at different properties get no tick', async () => {
    const a = notice()
    const b = { ...notice(), itemId: 'it2', jobId: 'j700', label: '700 · Elsewhere', jobNumber: '700' }
    b.recipients = [{ ...b.recipients[0]!, name: 'Someone Else', address: '1 Other St' }, b.recipients[1]!]
    renderWithProviders(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-combine')).toBeNull()
  })
})
