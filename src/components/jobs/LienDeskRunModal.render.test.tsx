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
const recordMock = vi.fn(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [] as { itemId: string; label: string; email: string }[], courtesyFailed: [] as { itemId: string; label: string; email: string; reason: string }[] }))
vi.mock('../../lib/jobs/lienDeskRunIo', () => ({ recordLienDeskRun: (...args: unknown[]) => recordMock(...(args as [])) }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async () => null) }))
vi.mock('../../lib/stripeInvoiceFacts', () => ({ fetchStripeInvoiceFacts: vi.fn(async () => ({})) }))

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

  it('offers to undo the approval only when the opener says the run was just started (v2.4541)', async () => {
    const onUndo = vi.fn()
    const view = renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-undo')).toBeNull()
    view.unmount()
    renderWithProviders(
      <LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} undo={{ words: 'You just approved this notice for Loberg Contracting. Pressed it by mistake?', busy: false, onUndo }} />,
    )
    await settle()
    const strip = screen.getByTestId('run-undo')
    expect(strip.textContent).toContain('You just approved this notice for Loberg Contracting. Pressed it by mistake?')
    // It sits under the title and above the steps.
    expect(strip.compareDocumentPosition(screen.getByTestId('run-steps')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo the approval…' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
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
    // What the packet is sits behind the ? beside the title (v2.4621).
    expect(screen.queryByTestId('run-explainer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'What the packet is' }))
    expect(screen.getByTestId('run-explainer').textContent).toContain('share an envelope')
    expect(screen.getByTestId('run-explainer').textContent).not.toContain('—')
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

describe('LienDeskRunModal · the courtesy PDF to the original contractor (punch list #87 B)', () => {
  const ticked = (partial: Partial<RunNotice> = {}) => {
    const n = notice(partial)
    return { ...n, recipients: n.recipients.map((r) => (r.key === 'original_contractor' ? { ...r, courtesy: true } : r)) }
  }
  const tickLabel = 'Envelope 2 · Original contractor: Loberg Contracting — courtesy PDF by email'

  it('the GC envelope carries the tick, on, naming the address; the owner envelope never does; unticking reaches the record', async () => {
    recordMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-courtesy-1')).toBeNull()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@loberg.test, emailed when the run is recorded')
    const tick = screen.getByLabelText(tickLabel) as HTMLInputElement
    expect(tick.checked).toBe(true)
    fireEvent.click(tick)
    expect((screen.getByLabelText(tickLabel) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent[0]!.recipients.map((r) => [r.key, r.courtesy])).toEqual([
      ['owner', undefined],
      ['original_contractor', false],
    ])
  })

  it('one GC envelope with two notices says one email per notice; switched to email, the tick goes because the email is the send', async () => {
    renderWithProviders(<LienDeskRunModal notices={[ticked(), ticked({ itemId: 'it2', jobId: 'j651', label: '651 · ATI Schertz II', jobNumber: '651', months: ['2026-07'] })]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@loberg.test, emailed when the run is recorded, one email per notice')
    fireEvent.change(screen.getByLabelText('Envelope 2 · Original contractor: Loberg Contracting — method'), { target: { value: 'email' } })
    expect(screen.queryByTestId('run-courtesy-2')).toBeNull()
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('the record names the courtesy PDF that went, and warns when one did not', async () => {
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [{ itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test' }], courtesyFailed: [] }))
    const view = renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    expect(await screen.findByText('1 notice recorded — the desk reads them as sent. Courtesy PDF emailed to office@loberg.test.')).toBeTruthy()
    view.unmount()
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [], courtesyFailed: [{ itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test', reason: 'Resend 502' }] }))
    renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    expect(await screen.findByText('Courtesy PDF not emailed: 650 · ATI Schertz to office@loberg.test (Resend 502). That notice is recorded all the same.')).toBeTruthy()
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

describe('LienDeskRunModal — the mailing (v2.4119)', () => {
  it('shows the steps, checks a number\u2019s shape as it is typed, and records only the numbered envelopes', async () => {
    recordMock.mockClear()
    const printed: string[][] = []
    const two = [notice(), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Other GC', address: '1 GC Rd', email: '', method: 'certified_mail', tracking: '' }] })]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    expect(screen.getByTestId('run-steps').textContent).toContain('1 · Print the packet')
    expect(screen.getByRole('button', { name: /Envelope faces/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Record the run/ })).toBeTruthy()
    const inputs = screen.getAllByPlaceholderText('9407 1118 …')
    fireEvent.change(inputs[0]!, { target: { value: '9407 1118 9876 5432 10' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('18 digits — a certified number has 20')
    fireEvent.change(inputs[0]!, { target: { value: '9407 1118 9876 5432 1098' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('✓ 20 digits · certified')
    expect(screen.getByRole('button', { name: /Record 1 mailed · 1 stays in the pile/ })).toBeTruthy()
    expect(screen.getByText(/1 envelope has no number yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Record 1 mailed/ }))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
    const [recordedNotices, opts] = recordMock.mock.calls[0] as unknown as [RunNotice[], { mailedOn?: string }]
    expect(recordedNotices.map((n) => n.itemId)).toEqual(['it1'])
    expect(opts.mailedOn).toBe('2026-09-29')
    expect(printed).toEqual([])
  })
})

describe('LienDeskRunModal · a run of printed notices opens on recording (v2.4823)', () => {
  it('every notice printed: the title and step 1 say so with the day, step 3 is current, printing is a second-time act, and the record still goes', async () => {
    recordMock.mockClear()
    const two = [notice({ printedAt: '2026-09-14T16:00:00Z' }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: '2026-09-15T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] })]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Record the mailing' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^Record the mailing · 2 notices/ })).toBeTruthy()
    const steps = screen.getByTestId('run-steps')
    // The newest print names the day; the current step is the third.
    expect(steps.textContent).toContain('1 · Printed September 15, 2026 ✓')
    const chips = Array.from(steps.querySelectorAll('span > span:last-child')).filter((el) => /^[123] · /.test(el.textContent ?? '')) as HTMLElement[]
    expect(chips[0]!.style.background).toBe('var(--bg-green-tint)')
    expect(chips[2]!.style.background).toBe('var(--bg-blue-tint)')
    expect(screen.getByText(/Back from the post office\? Type each envelope/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Print it again · 3 envelopes/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Print the packet/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Record the run/ }))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('one notice not yet printed: the run opens on printing as before', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-09-14T16:00:00Z' }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Send the run' })).toBeTruthy()
    expect(screen.getByTestId('run-steps').textContent).toContain('1 · Print the packet')
    expect(screen.getByRole('button', { name: /^Print the packet · / })).toBeTruthy()
  })
})

describe('LienDeskRunModal · read a copy before it prints (v2.4621)', () => {
  it('Preview on a copy row opens the pages that copy prints, the arrows walk the packet, Esc closes only the preview', async () => {
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('lien-run-preview')).toBeNull()
    fireEvent.click(screen.getByTestId('run-preview-j650-owner'))
    const overlay = screen.getByTestId('lien-run-preview')
    expect(screen.getByTestId('lien-run-preview-title').textContent).toBe('650 · ATI Schertz · owner of record')
    expect(screen.getByTestId('lien-run-preview-envelope').textContent).toBe('Envelope 1 · Owner of record Elbel Holdings LLC · 4 Example Way, Schertz, TX')
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('1 of 2')
    // The owner's copy: the cover note, then the form naming the copy.
    expect(screen.getAllByTestId('lien-run-preview-page-label').map((el) => el.textContent)).toEqual(['Page 1 of 2 · Cover note', 'Page 2 of 2 · § 53.056 notice · copy for owner of record'])
    expect(overlay.textContent).toContain('This is a routine notice…')
    expect(overlay.textContent).toContain('Copy for: Owner of record')
    // › walks to the original contractor's copy: the form alone.
    fireEvent.click(screen.getByRole('button', { name: 'Next copy' }))
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('2 of 2')
    expect(screen.getByTestId('lien-run-preview-title').textContent).toBe('650 · ATI Schertz · original contractor')
    expect(screen.getAllByTestId('lien-run-preview-page-label').map((el) => el.textContent)).toEqual(['Page 1 of 1 · § 53.056 notice · copy for original contractor'])
    expect((screen.getByRole('button', { name: 'Next copy' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('1 of 2')
    // Esc closes the preview and leaves the run open.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-run-preview')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Send the run' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("LienDeskRunModal · the enclosed bill carries Stripe's number (v2.4852)", () => {
  it("the preview's invoice page prints Stripe's number and due day, never the app's #0", async () => {
    const { fetchJobWithDetailsById } = await import('../../lib/fetchJobWithDetailsById')
    const { fetchStripeInvoiceFacts } = await import('../../lib/stripeInvoiceFacts')
    const bill = { id: 'inv-878', amount: 15200, sequence_order: 0, status: 'billed', billed_at: '2026-09-16T14:00:00Z', created_at: '2026-09-16T13:59:00Z', sent_to_customer_at: null, estimated_bill_date: null, stripe_invoice_id: 'in_878', stripe_invoice_memo: 'Paper checks can be sent to: Click Plumbing', external_send_note: '', stripe_invoice_footer: null }
    vi.mocked(fetchJobWithDetailsById).mockResolvedValue({ id: 'j650', hcp_number: '878', job_name: 'Take 5- Seguin', job_address: '1 Example Rd', customer_name: 'Southern Post Construction', customer_email: '', customer_id: 'c1', gc_customer_id: null, bill_to_party: 'customer', fixtures: [], materials: [], payments: [], invoices: [bill] } as never)
    vi.mocked(fetchStripeInvoiceFacts).mockResolvedValue({ 'inv-878': { invoiceNumber: '878-2609161138', dueYmd: '2026-10-16', lines: [] } })
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-07" userId="u1" onClose={() => {}} onRecorded={() => {}} stripeMode="live" />)
    await settle()
    expect(vi.mocked(fetchStripeInvoiceFacts)).toHaveBeenCalledWith(['inv-878'], 'live')
    fireEvent.click(screen.getByTestId('run-preview-j650-original_contractor'))
    const overlay = screen.getByTestId('lien-run-preview')
    expect(overlay.textContent).toContain('#878-2609161138')
    expect(overlay.textContent).toContain('October 16, 2026')
    expect(overlay.textContent).not.toContain('#0')
  })
})
