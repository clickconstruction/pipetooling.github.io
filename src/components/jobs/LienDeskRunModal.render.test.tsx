// @vitest-environment jsdom
/**
 * Render smokes for the run (v2.3410): one envelope per name and address
 * (v2.3720) with its method + tracking and the notices inside it, the
 * envelope count, a missing address blocks Record, an email method needs an
 * address on file.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskRunModal from './LienDeskRunModal'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const printMock = vi.fn((_html: string, _filing: unknown) => true)
vi.mock('../../lib/sent/sentCopiesIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sent/sentCopiesIo')>('../../lib/sent/sentCopiesIo')
  return { ...actual, printAndFile: (html: string, filing: unknown) => printMock(html, filing) }
})
const recordMock = vi.fn(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [] as { itemId: string; label: string; email: string }[], courtesyFailed: [] as { itemId: string; label: string; email: string; reason: string }[] }))
// The courtesy preview's PDF (v2.5073) is the send's own builder; here it hands back a stand-in.
const buildPdfMock = vi.fn(async (..._args: unknown[]) => new Blob(['%PDF-1.4 courtesy']))
// Leader here, sign ▸ (v2.5086): the drawing's write, watched.
const signMock = vi.fn(async (_args: unknown) => ({ ok: true as const, signedAtIso: '2026-10-09T19:14:00Z' }))
vi.mock('../../lib/jobs/lienDeskSignIo', () => ({ signLienDeskItem: (args: unknown) => signMock(args) }))
vi.mock('signature_pad', () => ({
  default: class {
    constructor(_c: HTMLCanvasElement) {}
    off() {}
    on() {}
    isEmpty() {
      return false
    }
    toDataURL() {
      return 'data:image/png;base64,AAAA'
    }
    toData() {
      return []
    }
    fromData() {}
    clear() {}
  },
}))
vi.mock('../../lib/jobs/lienDeskRunIo', () => ({ recordLienDeskRun: (...args: unknown[]) => recordMock(...(args as [])), buildRunNoticePdf: (...args: unknown[]) => buildPdfMock(...args) }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async () => null) }))
// Mail through Docsmit (PR 5b): the switches as a dev saved them, and the run's doing side stood in for.
const docsmitState = { settings: { env: 'tracksmit', paused: false, runDefault: 'docsmit', returnReceipt: 'electronic', plusDefault: false, cutoffLocal: '15:00', sendByBufferDays: 1, creditWarn: 25, pollMinutes: 60, callbacks: false, matchSite: false }, setUp: false, loaded: true }
vi.mock('../../hooks/useDocsmitSettings', () => ({ useDocsmitSettings: () => docsmitState }))
const prepareMock = vi.fn(async (envs: Array<{ key: string }>) => ({ prepared: [{ key: envs[0]!.key, n: 1, label: 'Owner of record', who: 'Elbel Holdings LLC', windowLines: ['Elbel Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'], sendType: 'Certified, Electronic Return Receipt', shortCode: 'KX7M2QRT', recipient: 'owner', jobNumber: '650', itemIds: ['it1'], pieceId: 'p1', price: 9.85, correction: null, sheets: 4, envelope: '#10', pdfUrl: 'blob:one', pdfPath: 'mail/KX7M2QRT.pdf' }], held: [{ key: envs[1]?.key ?? 'gc', n: 2, label: 'Original contractor', why: 'The address needs a ZIP or ZIP+4.' }], balance: 120 }))
const sendMock = vi.fn(async () => ({ ok: true, sent: ['p1'] }))
vi.mock('../../lib/mail/runDocsmitIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/mail/runDocsmitIo')>('../../lib/mail/runDocsmitIo')
  return { ...actual, prepareDocsmitRun: (...args: unknown[]) => prepareMock(...(args as [Array<{ key: string }>])), sendDocsmitRun: (...args: unknown[]) => sendMock(...(args as [])) }
})
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

/** Run-4: the secondary doors sit under More ▾; open it once when a test needs one. */
function ensureMore() {
  if (!screen.queryByTestId('run-more-panel')) fireEvent.click(screen.getByTestId('run-more'))
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
    ensureMore()
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
    expect(strip.compareDocumentPosition(screen.getByTestId('run-journey')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo the approval…' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('a recipient with no mailing address holds the notice; alone in the run, nothing is ready and the button says so', async () => {
    const n = notice()
    n.recipients[0] = { ...n.recipients[0]!, name: '', address: '' }
    renderWithProviders(<LienDeskRunModal notices={[n]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText(/Owner of record: nobody to send to/)).toBeTruthy()
    ensureMore()
    expect((screen.getByRole('button', { name: /Record the run/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Nothing is ready to record')).toBeTruthy()
    expect(screen.getByText('Sign or fix what is marked in red, then record.')).toBeTruthy()
  })

  it('a held notice stays in the pile while the ready one records (v2.5533): the button says so, the record carries only the ready one, and the held one keeps its row', async () => {
    recordMock.mockClear()
    const held = notice({ itemId: 'it2', jobId: 'j651', label: '651 · ATI Schertz II', jobNumber: '651' })
    held.recipients[0] = { ...held.recipients[0]!, name: '', address: '' }
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[notice(), held]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    const button = screen.getByRole('button', { name: 'Record 1 · 1 held stays in the pile ▸' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.getByText('1 notice is held')).toBeTruthy()
    expect(screen.getByText('It stays in the pile with the reason in red. The 1 ready one records now.')).toBeTruthy()
    fireEvent.click(button)
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent.map((x) => x.itemId)).toEqual(['it1'])
    // the held one stays, the window stays open on it
    await settle()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/Owner of record: nobody to send to/)).toBeTruthy()
    expect(screen.queryByText('650 · ATI Schertz')).toBeNull()
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
    ensureMore()
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
    ensureMore()
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    expect(await screen.findByText('1 notice recorded — the desk reads them as sent. Courtesy PDF emailed to office@loberg.test.')).toBeTruthy()
    view.unmount()
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [], courtesyFailed: [{ itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test', reason: 'Resend 502' }] }))
    renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByRole('button', { name: /Record the run/ }))
    expect(await screen.findByText('Courtesy PDF not emailed: 650 · ATI Schertz to office@loberg.test (Resend 502). That notice is recorded all the same.')).toBeTruthy()
  })

  // The preview tab (v2.5073): a stand-in window that keeps what is written to it, and object URLs jsdom does not have.
  const stubTab = () => {
    const writes: string[] = []
    const tab = { document: { open: vi.fn(), write: (h: string) => void writes.push(h), close: vi.fn(), images: [] }, focus: vi.fn(), close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const urls = URL as unknown as { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void }
    const before = { create: urls.createObjectURL, revoke: urls.revokeObjectURL }
    urls.createObjectURL = vi.fn(() => 'blob:preview-1')
    urls.revokeObjectURL = vi.fn()
    const page = () => writes.find((h) => h.includes('data-courtesy-preview-strip')) ?? ''
    const restore = () => {
      open.mockRestore()
      urls.createObjectURL = before.create
      urls.revokeObjectURL = before.revoke
    }
    return { open, page, restore }
  }

  it('Preview the email › sits after the line, outside the tick, and opens the email as the GC gets it: the send\u2019s words and the PDF the record attaches (v2.5073)', async () => {
    buildPdfMock.mockClear()
    const tab = stubTab()
    try {
      renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
      await settle()
      expect(screen.queryByTestId('run-courtesy-preview-1')).toBeNull()
      const door = screen.getByTestId('run-courtesy-preview-2') as HTMLButtonElement
      await waitFor(() => expect(door.disabled).toBe(false))
      expect(door.textContent).toBe('Preview the email ›')
      expect(door.title).toBe('Opens in a new tab, as office@loberg.test would get it. Nothing is sent.')
      expect(screen.getByTestId('run-courtesy-2').contains(door)).toBe(false)
      fireEvent.click(door)
      expect(tab.open).toHaveBeenCalledWith('', '_blank')
      await waitFor(() => expect(tab.page()).not.toBe(''))
      const page = tab.page()
      expect(page).toContain('This email goes to office@loberg.test when you record the run, while Courtesy PDF stays ticked.')
      expect(page).toContain('<dt>To</dt><dd>office@loberg.test</dd>')
      expect(page).toContain('<h1 class="subject">Courtesy copy: notice of claim for unpaid labor or materials — 650 · ATI Schertz</h1>')
      expect(page).toContain('The notice itself is being delivered by certified mail. For questions call the office: (512) 360-0599</p>')
      expect(page).toContain('<iframe class="pdf" src="blob:preview-1" title="notice-53-056-650.pdf"></iframe>')
      expect(buildPdfMock).toHaveBeenCalledTimes(1)
      const [n, copy, docs, pay] = buildPdfMock.mock.calls[0] as unknown as [RunNotice, string, unknown[], unknown[]]
      expect([n.itemId, copy, docs, pay]).toEqual(['it1', 'original_contractor', [], []])
      // Pressing the door never flips the tick.
      expect((screen.getByLabelText(tickLabel) as HTMLInputElement).checked).toBe(true)
    } finally {
      tab.restore()
    }
  })

  it('the door waits while the bills are read; an unticked box still previews, saying the email will not go', async () => {
    vi.mocked(fetchJobWithDetailsById).mockImplementationOnce(() => new Promise(() => {}))
    const view = renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const waiting = screen.getByTestId('run-courtesy-preview-2') as HTMLButtonElement
    expect(waiting.disabled).toBe(true)
    expect(waiting.textContent).toBe('Preview the email · reading the bills…')
    view.unmount()
    const tab = stubTab()
    try {
      renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
      await settle()
      fireEvent.click(screen.getByLabelText(tickLabel))
      const door = screen.getByTestId('run-courtesy-preview-2') as HTMLButtonElement
      await waitFor(() => expect(door.disabled).toBe(false))
      fireEvent.click(door)
      await waitFor(() => expect(tab.page()).not.toBe(''))
      expect(tab.page()).toContain('<div class="strip off" data-courtesy-preview-strip>Preview — nothing has been sent. Courtesy PDF is not ticked, so this email will not go. Tick it in the run window to send it.</div>')
    } finally {
      tab.restore()
    }
  })

  it('a blocked popup says so and builds nothing', async () => {
    buildPdfMock.mockClear()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
      await settle()
      const door = screen.getByTestId('run-courtesy-preview-2') as HTMLButtonElement
      await waitFor(() => expect(door.disabled).toBe(false))
      fireEvent.click(door)
      expect(await screen.findByText('Popup blocked — allow popups to preview the email.')).toBeTruthy()
      expect(buildPdfMock).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })
})

describe('LienDeskRunModal · the saved copy (v2.3763)', () => {
  it('carries the Drive link and the note into the record', async () => {
    recordMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    expect(screen.getByTestId('run-saved-copy')).toBeTruthy()
    ensureMore()
    fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'drive.google.com/file/d/abc/view' } })
    ensureMore()
    fireEvent.change(screen.getByLabelText('Saved copy — note'), { target: { value: 'the packet as printed' } })
    ensureMore()
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
    ensureMore()
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
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('now')
    ensureMore()
    expect(screen.getByRole('button', { name: /Envelope faces/ })).toBeTruthy()
    ensureMore()
    expect(screen.getByRole('button', { name: /^Record the run/ })).toBeTruthy()
    const inputs = screen.getAllByPlaceholderText('9407 1118 …')
    fireEvent.change(inputs[0]!, { target: { value: '9407 1118 9876 5432 10' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('18 digits — a certified number has 20')
    fireEvent.change(inputs[0]!, { target: { value: '9407 1118 9876 5432 1098' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('✓ 20 digits · certified')
    ensureMore()
    expect(screen.getByRole('button', { name: /Record 1 mailed · 1 stays in the pile/ })).toBeTruthy()
    expect(screen.getByText(/1 envelope has no number yet/)).toBeTruthy()
    ensureMore()
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
    // Every envelope printed: the journey has Sent done and In the mail as the step that is now (Run-4 retired the step strip).
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('done')
    expect(screen.getByTestId('run-journey-mailed').getAttribute('data-state')).toBe('now')
    expect(screen.getByText(/Back from the post office\? Type each envelope/)).toBeTruthy()
    ensureMore()
    expect(screen.getByRole('button', { name: /^Print it again · 3 envelopes/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Print the packet/ })).toBeNull()
    ensureMore()
    fireEvent.click(screen.getByRole('button', { name: /^Record the run/ }))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('one notice not yet printed: the run opens on printing as before', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-09-14T16:00:00Z' }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Send the run' })).toBeTruthy()
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('now')
    expect(screen.getByRole('button', { name: /^Print the packet · / })).toBeTruthy()
  })
})

describe('LienDeskRunModal · take back a printed run (punch list #101)', () => {
  const printedTwo = () => [
    notice({ printedAt: '2026-10-07T16:00:00Z' }),
    notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: '2026-10-07T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
  ]

  it('Take back… asks first, says what stays and what is dropped, then hands every printed item over and goes back to printing', async () => {
    const taken: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={printedTwo()} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    fireEvent.change(screen.getAllByLabelText(/tracking$/)[0]!, { target: { value: '9407111898765432101234' } })
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    const confirm = screen.getByTestId('run-take-back-confirm')
    expect(confirm.textContent).toContain('Take back the run?')
    expect(confirm.textContent).toContain('The 2 notices go back to Ready to send. The approvals stand.')
    expect(confirm.textContent).toContain('The copies printed Oct 7 stay in each job’s Documents, filed as printed.')
    expect(confirm.textContent).toMatch(/tracking numbers? typed here (is|are) not saved/)
    expect(taken).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByTestId('run-take-back-confirm')).toBeNull()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1', 'it2']])
    expect(screen.getByTestId('run-taken-back').textContent).toContain('Taken back. The 2 notices printed October 7, 2026 are in Ready to send again.')
    expect(screen.getByRole('heading', { name: /^Send the run · 2 notices/ })).toBeTruthy()
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('now')
    expect(screen.getByRole('button', { name: /^Print the packet · / })).toBeTruthy()
    expect((screen.getAllByLabelText(/tracking$/)[0] as HTMLInputElement).value).toBe('')
    expect(screen.queryByTestId('run-take-back')).toBeNull()
  })

  it('only what printed is taken back; a run with nothing printed, or a host without the door, offers none', async () => {
    const taken: string[][] = []
    const { unmount } = renderWithProviders(<LienDeskRunModal notices={[printedTwo()[0]!, notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('Take back the 1 notice that printed?')
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('have not printed stay as they are')
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1']])
    unmount()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => 0} />)
    await settle()
    expect(screen.queryByTestId('run-take-back')).toBeNull()
  })

  it('a packet printed in this sitting can be taken back at once', async () => {
    const taken: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Print the packet · / }))
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1']])
  })

  it('a failed take-back says so and keeps the run as it was', async () => {
    renderWithProviders(<LienDeskRunModal notices={printedTwo()} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => { throw new Error('offline') }} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(screen.getByRole('heading', { name: /^Record the mailing · 2 notices/ })).toBeTruthy()
    expect(screen.queryByTestId('run-taken-back')).toBeNull()
  })
})

describe('LienDeskRunModal · print one item (v2.4853)', () => {
  it('Print › on a copy prints and files that copy alone; the notice is stamped printed only once both copies have printed; the envelope door prints every copy inside', async () => {
    printMock.mockClear()
    const printed: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-print-j650-owner'))
    expect(printMock).toHaveBeenCalledTimes(1)
    const [html, filing] = printMock.mock.calls[0] as unknown as [string, { kind: string; title: string; jobIds: string[]; recipientName: string | null }]
    expect(html).toContain('copy for owner of record</title>')
    expect(html).not.toContain('Loberg Contracting</title>')
    expect(filing).toMatchObject({ kind: 'lien_notice', title: '650 · ATI Schertz · copy for owner of record', jobIds: ['j650'], recipientName: 'Elbel Holdings LLC' })
    // Half a notice is not in the mail yet.
    expect(printed).toEqual([])
    expect(screen.getByTestId('run-print-j650-owner').textContent).toContain('Printed ✓')
    expect(screen.getByTestId('run-print-j650-original_contractor').textContent).toBe('Print ›')
    fireEvent.click(screen.getByTestId('run-print-j650-original_contractor'))
    await settle()
    expect(printMock).toHaveBeenCalledTimes(2)
    expect(printed).toEqual([['it1']])
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('done')
    // The envelope door: one document for everything inside envelope 1.
    fireEvent.click(screen.getByTestId('run-print-envelope-1'))
    const [envHtml, envFiling] = printMock.mock.calls[2] as unknown as [string, { title: string }]
    expect(envHtml).toContain('<title>Envelope 1 —')
    expect(envFiling.title).toMatch(/^Envelope 1 · Owner of record Elbel Holdings LLC$/)
  })

  it('the preview has a Print this copy button that prints the copy on show', async () => {
    printMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-preview-j650-original_contractor'))
    fireEvent.click(screen.getByTestId('lien-run-preview-print'))
    expect(printMock).toHaveBeenCalledTimes(1)
    expect((printMock.mock.calls[0] as unknown as [string])[0]).toContain('copy for original contractor</title>')
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

  it('Addresses for the labels saves one CSV row per envelope that goes out, in the label service’s columns (v2.4977)', async () => {
    const two = [notice(), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', amount: 0, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Nobody Home', address: '', email: '', method: 'certified_mail', tracking: '' }] })]
    let saved = ''
    const urlApi = URL as unknown as { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void }
    const hadCreate = urlApi.createObjectURL
    const hadRevoke = urlApi.revokeObjectURL
    urlApi.createObjectURL = (b: Blob) => {
      // jsdom's Blob has no text(); FileReader reads it.
      const r = new FileReader()
      r.onload = () => { saved = String(r.result ?? '') }
      r.readAsText(b)
      return 'blob:labels'
    }
    urlApi.revokeObjectURL = () => {}
    const clicks: string[] = []
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { clicks.push(this.getAttribute('download') ?? '') }
    try {
      renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
      await settle()
      // The second notice's envelope is held (no address, $0): it is listed, never on the labels.
      expect(screen.getByTestId('run-held-3').textContent).toMatch(/^Held · /)
      ensureMore()
      fireEvent.click(screen.getByTestId('run-label-addresses'))
      await waitFor(() => expect(saved).toContain('Company,Name,Address Line 1'))
      expect(clicks).toEqual(['certified-labels_2026-10-08.csv'])
      expect(saved).toContain('\r\n,Elbel Holdings LLC,4 Example Way,,"Schertz, TX",,,,Envelope 1 · 650\r\n')
      expect(saved).toContain(',Loberg Contracting,2904 Corporate Cr,,,,,,Envelope 2 · 650\r\n')
      expect(saved).not.toContain('Nobody Home')
    } finally {
      HTMLAnchorElement.prototype.click = origClick
      urlApi.createObjectURL = hadCreate
      urlApi.revokeObjectURL = hadRevoke
    }
  })
})

describe('a printed notice is not held for its signature (v2.5533)', () => {
  it('in the mail unsigned: no red hold, the amber line says it records as it went, both signing doors stay, and Record is live', async () => {
    recordMock.mockClear()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ signature: null, printedAt: '2026-10-08T15:00:00Z', leader: { userId: 'u-robert', name: 'Robert Douglas' }, rowFields: { notice: { claimAmount: '33500' } } })]}
        issuer={null}
        todayYmd="2026-10-14"
        userId="u-taunya"
        viewer={{ userId: 'u-taunya', name: 'Taunya' }}
        onClose={() => {}}
        onRecorded={() => {}}
      />,
    )
    await settle()
    expect(screen.queryByTestId('run-held-1')).toBeNull()
    expect(screen.getByTestId('run-unsigned-1').textContent).toBe('In the mail unsigned · it records as it went. If Robert Douglas signed the paper, record that first.')
    expect(screen.getByTestId('run-leader-here-sign-1')).toBeTruthy()
    expect(screen.getByTestId('run-pen-sign-1')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Record the run ▸' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.queryByText('Nothing is ready to record')).toBeNull()
    fireEvent.click(button)
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent.map((x) => x.itemId)).toEqual(['it1'])
  })
})

describe('an unsigned notice at the run (v2.5086)', () => {
  it('its envelopes are held and listed in red with the reason; with the leader beside her, Leader here, sign ▸ opens the pad, and Sign ▸ records his drawing on her screen for every unsigned notice in the envelope', async () => {
    signMock.mockClear()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' }, rowFields: { notice: { claimAmount: '33500' } } })]}
        issuer={null}
        todayYmd="2026-10-09"
        userId="u-taunya"
        viewer={{ userId: 'u-taunya', name: 'Taunya' }}
        onClose={() => {}}
        onRecorded={() => {}}
      />,
    )
    await settle()
    expect(screen.getByTestId('run-held-1').textContent).toContain('Unsigned: the leader signs it from his phone')
    expect(screen.getByTestId('run-held-2').textContent).toContain('Unsigned')
    expect(screen.getByRole('button', { name: /Print the packet · 0 envelopes/ })).toBeTruthy()
    fireEvent.click(screen.getByTestId('run-leader-here-sign-1'))
    const sheet = screen.getByTestId('run-sign-here-1')
    expect(sheet.textContent).toContain('Robert Douglas draws on this screen. The record names Taunya as whose screen it was.')
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
    fireEvent.click(screen.getByTestId('run-sign-here-go-1'))
    await waitFor(() => expect(signMock).toHaveBeenCalledTimes(1))
    const args = signMock.mock.calls[0]![0] as { itemId: string; approve: boolean; payload: { mode: string }; signer: { userId: string; printedName: string }; onDevice: { userId: string; name: string }; fields: unknown }
    expect(args.itemId).toBe('it1')
    expect(args.approve).toBe(false)
    expect(args.payload.mode).toBe('draw')
    expect(args.signer).toEqual({ userId: 'u-robert', printedName: 'Robert Douglas' })
    expect(args.onDevice).toEqual({ userId: 'u-taunya', name: 'Taunya' })
    expect(args.fields).toEqual({ notice: { claimAmount: '33500' } })
    // Signed: the envelopes go back into the run, numbered 1 and 2, nothing held.
    await waitFor(() => expect(screen.queryByTestId('run-held-1')).toBeNull())
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
  })

  it('without a viewer, or a notice whose builder said nothing about signing, there is no door and nothing held for it', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice({ signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' } })]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-held-1')).toBeTruthy()
    expect(screen.queryByTestId('run-leader-here-sign-1')).toBeNull()
  })
})

describe('Mail through Docsmit offers only the envelopes that go out (v2.5535)', () => {
  // Full addresses, so Docsmit could take every one: only the run's own hold keeps an envelope back.
  const mailable = (owner: [string, string], gc: [string, string]): RunNotice['recipients'] => [
    { key: 'owner', label: 'Owner of record', name: owner[0], address: owner[1], email: '', method: 'certified_mail', tracking: '' },
    { key: 'original_contractor', label: 'Original contractor', name: gc[0], address: gc[1], email: '', method: 'certified_mail', tracking: '' },
  ]
  const ELBEL: [string, string] = ['Elbel Holdings LLC', '17300 IH 35 N, Schertz, TX 78154']
  const LOBERG: [string, string] = ['Loberg Contracting', '2904 Corporate Cr, San Antonio, TX 78230']

  it.each([
    ['an unsigned', { signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' } }, /^Held · Unsigned: /],
    ['a $0', { amount: 0, fields: { ...notice().fields, claimAmount: '0.00' } }, /^Held · Nothing to send: the claim is \$0\./],
  ] as Array<[string, Partial<RunNotice>, RegExp]>)('%s notice offers no Docsmit envelope: its envelopes are held, the door is dim and says why, and prepare is never asked', async (_kind, partial, held) => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[notice({ ...partial, recipients: mailable(ELBEL, LOBERG) })]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-held-1').textContent).toMatch(held)
    expect(screen.getByTestId('run-held-2').textContent).toMatch(held)
    const door = screen.getByTestId('run-docsmit') as HTMLButtonElement
    expect(door.textContent).toBe('Mail through Docsmit ▸')
    expect(door.disabled).toBe(true)
    expect(door.title).toBe('Every certified envelope is held. Its card says why.')
    fireEvent.click(door)
    await settle()
    expect(prepareMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('dsm-review')).toBeNull()
    docsmitState.setUp = false
  })

  it('a mixed run offers only the clean envelopes, the same ones the packet prints, and prepare is asked for those alone', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    const clean = notice({ recipients: mailable(ELBEL, LOBERG) })
    const unsigned = notice({ itemId: 'it2', jobId: 'j712', label: '712 · ATI B', jobNumber: '712', signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' }, recipients: mailable(['Bandera Holdings', '2200 Bandera Rd, San Antonio, TX 78228'], ['Harlan Builders', '100 Main St, Seguin, TX 78155']) })
    const nothing = notice({ itemId: 'it3', jobId: 'j688', label: '688 · Cibolo', jobNumber: '688', amount: 0, recipients: mailable(['Cibolo Partners LLC', '5 Oak St, Cibolo, TX 78108'], ['Medina Contracting', '9 Elm St, Castroville, TX 78009']) })
    renderWithProviders(<LienDeskRunModal notices={[clean, unsigned, nothing]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    // Envelopes 1 and 2 go out; 3 to 6 are held, each with its reason on its card.
    expect(screen.queryByTestId('run-held-1')).toBeNull()
    expect(screen.queryByTestId('run-held-2')).toBeNull()
    expect(screen.getByTestId('run-held-3').textContent).toMatch(/^Held · Unsigned: /)
    expect(screen.getByTestId('run-held-4').textContent).toMatch(/^Held · Unsigned: /)
    expect(screen.getByTestId('run-held-5').textContent).toMatch(/^Held · Nothing to send/)
    expect(screen.getByTestId('run-held-6').textContent).toMatch(/^Held · Nothing to send/)
    const door = screen.getByTestId('run-docsmit') as HTMLButtonElement
    expect(door.textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(door.title).toBe('4 held envelopes wait in the run.')
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes$/ })).toBeTruthy()
    fireEvent.click(door)
    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1))
    const asked = prepareMock.mock.calls[0]![0] as unknown as Array<{ n: number; name: string; contents: Array<{ notice: { itemId: string } }> }>
    expect(asked.map((e) => [e.n, e.name, e.contents.map((c) => c.notice.itemId)])).toEqual([
      [1, 'Elbel Holdings LLC', ['it1']],
      [2, 'Loberg Contracting', ['it1']],
    ])
    docsmitState.setUp = false
  })
})

describe('LienDeskRunModal · the checklist, live, and the lanes (Run-5)', () => {
  it('once the packet printed, one checklist row per paper envelope with its boxes and its number box, and a lane per way the envelopes travel', async () => {
    const two = [
      notice({ printedAt: '2026-10-07T16:00:00Z' }),
      notice({ itemId: 'it2', jobId: 'j688', label: '688 · Harlan Dental', jobNumber: '688', printedAt: '2026-10-07T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd', email: '', method: 'hand', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd', email: '', method: 'hand', tracking: '' }] }),
    ]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const list = screen.getByTestId('run-checklist')
    expect(list.textContent).toContain('At the counter')
    expect(screen.getByTestId('run-checklist-1').textContent).toContain('650 owner')
    expect(screen.getByLabelText('Envelope 1 — slip on')).toBeTruthy()
    expect(screen.getByLabelText('Envelope 3 — handed over')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Envelope 1 — stuffed'))
    expect((screen.getByLabelText('Envelope 1 — stuffed') as HTMLInputElement).checked).toBe(true)
    // The number typed on the checklist is the envelope's number: the card's box shows it too, and the row is done.
    fireEvent.change(screen.getByLabelText('Envelope 1 — number (checklist)'), { target: { value: '9407 1118 9876 5432 1098' } })
    expect((screen.getAllByLabelText(/tracking$/)[0] as HTMLInputElement).value).toBe('9407 1118 9876 5432 1098')
    expect(screen.getByTestId('run-checklist-1').getAttribute('data-done')).toBe('yes')
    expect(list.textContent).toContain('2 of 3 have their number')
    // Two ways to travel: certified and by hand, each a lane.
    expect(screen.getByTestId('run-lane-certified').textContent).toContain('Certified')
    expect(screen.getByTestId('run-lane-hand').textContent).toContain('By hand')
    expect(screen.getByTestId('run-lane-hand').textContent).toContain('envelope 3')
  })

  it('nothing printed: no checklist and no lanes', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-checklist')).toBeNull()
    expect(screen.queryByTestId('run-lanes')).toBeNull()
  })

  it('Mail through Docsmit (PR 5b): the door shows once a dev set the connection up, the review lists the prepared and the held, mailing marks the card and moves the foot to recording', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const door = screen.getByTestId('run-docsmit') as HTMLButtonElement
    expect(door.textContent).toBe('Mail through Docsmit · 1 envelope ▸')
    expect(door.disabled).toBe(false)
    expect(screen.getByTestId('run-docsmit-send-by').textContent).toMatch(/Docsmit/)
    fireEvent.click(door)
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    expect(prepareMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('dsm-env-1').textContent).toContain('Elbel Holdings LLC')
    expect(screen.getByTestId('dsm-held-2').textContent).toContain('The address needs a ZIP or ZIP+4.')
    expect(screen.getByTestId('dsm-price').textContent).toBe('1 envelope · $9.85 · balance $120.00')
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('1 envelope mailed through Docsmit.'))
    expect(sendMock).toHaveBeenCalledWith(['p1'])
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(screen.getByTestId('run-chip-1').textContent).toBe('mailed through Docsmit · number coming')
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elbel Holdings LLC — tracking') as HTMLInputElement).disabled).toBe(true)
    // The GC's envelope stays on paper, so the foot still prints, and only that one: the Docsmit envelope left the packet.
    expect(screen.getByRole('button', { name: /Print the packet · 1 envelope$/ })).toBeTruthy()
    docsmitState.setUp = false
  })

  it('a mailing through Docsmit is kept the moment it goes (v2.5532): the notice with every copy out is stamped printed and the desk re-reads, before the × closes the run', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    const both = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    const piece = (key: string, n: number, recipient: 'owner' | 'original_contractor', pieceId: string) => ({ key, n, label: recipient === 'owner' ? 'Owner of record' : 'Original contractor', who: recipient === 'owner' ? 'Elbel Holdings LLC' : 'Loberg Contracting', windowLines: [], sendType: 'Certified, Electronic Return Receipt', shortCode: `KX7M2QR${n}`, recipient, jobNumber: '650', itemIds: ['it1'], pieceId, price: 9.85, correction: null, sheets: 4, envelope: '#10' as const, pdfUrl: `blob:${n}`, pdfPath: `mail/KX7M2QR${n}.pdf` })
    prepareMock.mockImplementationOnce(async (envs) => ({ prepared: [piece(envs[0]!.key, 1, 'owner', 'p1'), piece(envs[1]!.key, 2, 'original_contractor', 'p2')], held: [], balance: 120 }))
    sendMock.mockImplementationOnce(async () => ({ ok: true, sent: ['p1', 'p2'] }))
    const onPrinted = vi.fn()
    const onRecorded = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[both]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('2 envelopes mailed through Docsmit.'))
    // Kept at once: nothing waits on Record the run.
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['it1']))
    expect(onRecorded).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('dsm-close'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPrinted).toHaveBeenCalledTimes(1)
    docsmitState.setUp = false
  })

  it('a send with a copy left on paper re-reads the desk at once, and stamps the notice once that copy prints (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    const onPrinted = vi.fn()
    const onRecorded = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('1 envelope mailed through Docsmit.'))
    // The GC's copy is still to print, so the notice is not in the mail yet; the desk re-reads for the piece all the same.
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(onPrinted).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Print the packet · 1 envelope$/ }))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['it1']))
    docsmitState.setUp = false
  })

  it('a send whose answer was lost stamps nothing and still re-reads the desk, which learns from the pieces what went (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    sendMock.mockImplementationOnce(async () => ({ ok: false, sent: [], error: 'Docsmit did not answer.' }) as unknown as { ok: boolean; sent: string[] })
    const onPrinted = vi.fn()
    const onRecorded = vi.fn()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toMatch(/^Nothing mailed\./))
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(onPrinted).not.toHaveBeenCalled()
    docsmitState.setUp = false
  })

  it('Docsmit saying nothing went (credit short at the first envelope) stamps nothing and leaves the desk alone (v2.5532)', async () => {
    docsmitState.setUp = true
    sendMock.mockImplementationOnce(async () => ({ ok: false, sent: [], stopped_at: 'p1', shortfall: 5, error: 'Docsmit credit is short by $5.00, nothing more was sent.' }) as unknown as { ok: boolean; sent: string[] })
    const onPrinted = vi.fn()
    const onRecorded = vi.fn()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toMatch(/^Nothing mailed\. Docsmit credit is short/))
    expect(onRecorded).not.toHaveBeenCalled()
    expect(onPrinted).not.toHaveBeenCalled()
    docsmitState.setUp = false
  })

  it('a send that finishes a notice whose paper copy printed first moves the foot to recording (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    const onPrinted = vi.fn()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-print-envelope-2'))
    expect(onPrinted).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['it1']))
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(screen.getByRole('button', { name: 'Record the run ▸' })).toBeTruthy()
    docsmitState.setUp = false
  })

  it('a run opened after a Docsmit send knows the copy that went: no second mailing, no paper copy, nothing to take back (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    // As the desk builds it from the piece behind the item (runRecipientWithPiece): the owner's copy went, the GC's did not.
    const after = notice({ printedAt: '2026-10-14T15:00:00Z', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '9407 1118 9922 0000 0000 01', via: 'docsmit', pieceId: 'p1', pieceStatus: 'mailed', pieceProblem: null },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    const unprinted = notice({ itemId: 'it2', jobId: 'j712', label: '712 · ATI B', jobNumber: '712', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Bandera Holdings', address: '2200 Bandera Rd, San Antonio, TX 78228', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[after, unprinted]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => 0} />)
    await settle()
    // Three envelopes: the owner's that went, the other owner's, and the GC's with both notices inside. Docsmit offers the two that did not go.
    expect(screen.getByTestId('run-chip-1').textContent).toBe('mailed through Docsmit · 9407 1118 9922 0000 0000 01')
    expect(screen.getByTestId('run-docsmit').textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes$/ })).toBeTruthy()
    // The notice that went part by Docsmit is not offered back to Ready to send.
    ensureMore()
    expect(screen.queryByTestId('run-take-back')).toBeNull()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1))
    expect((prepareMock.mock.calls[0]![0] as unknown as Array<{ name: string }>).map((e) => e.name).sort()).toEqual(['Bandera Holdings', 'Loberg Contracting'])
    docsmitState.setUp = false
  })

  it('a copy that went last sitting keeps its own envelope: the new copy to the same GC goes out on its own (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    // As the desk hands them in: Ready first (B, fresh), then In the mail (A, both copies built from their pieces).
    const fresh = notice({ itemId: 'it2', jobId: 'j712', label: '712 · ATI B', jobNumber: '712', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Bandera Holdings', address: '2200 Bandera Rd, San Antonio, TX 78228', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: '', method: 'certified_mail', tracking: '' },
    ] })
    const went = notice({ printedAt: '2026-10-13T15:00:00Z', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '9407 1', via: 'docsmit', pieceId: 'p1', pieceStatus: 'mailed', pieceProblem: null },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: '', method: 'certified_mail', tracking: '9407 2', via: 'docsmit', pieceId: 'p2', pieceStatus: 'mailed', pieceProblem: null },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[fresh, went]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    // Four envelopes: B's two, then A's two. The GC has two, one mailed and one still to go.
    expect(screen.getByTestId('run-chip-2').textContent).not.toMatch(/mailed through Docsmit/)
    expect(screen.getByTestId('run-chip-4').textContent).toBe('mailed through Docsmit · 9407 2')
    expect(screen.getByTestId('run-docsmit').textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes$/ })).toBeTruthy()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1))
    const asked = prepareMock.mock.calls[0]![0] as unknown as Array<{ name: string; contents: Array<{ notice: { itemId: string } }> }>
    expect(asked.map((e) => [e.name, e.contents.map((c) => c.notice.itemId)])).toEqual([['Bandera Holdings', ['it2']], ['Loberg Contracting', ['it2']]])
    docsmitState.setUp = false
  })

  it('Mail through Docsmit: no door until a dev set the connection up, none while paused, and a dim one when every certified address is short', async () => {
    docsmitState.setUp = false
    docsmitState.settings.paused = false
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-docsmit')).toBeNull()
    cleanup()
    docsmitState.setUp = true
    docsmitState.settings.paused = true
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-docsmit')).toBeNull()
    cleanup()
    docsmitState.settings.paused = false
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const door = screen.getByTestId('run-docsmit') as HTMLButtonElement
    expect(door.disabled).toBe(true)
    expect(door.title).toMatch(/needs .*ZIP/)
    docsmitState.setUp = false
  })
})


describe('Esc in the run window (v2.5530)', () => {
  it('closes a run with nothing typed; folds More first; holds over a typed number; leaves the preview its own Esc', async () => {
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    // More ▾ open: the first Esc folds it and the run stays.
    ensureMore()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('run-more-panel')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    // The preview keeps Esc for itself: it closes and the run stays.
    fireEvent.click(screen.getByTestId('run-preview-j650-original_contractor'))
    expect(screen.getByTestId('lien-run-preview')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-run-preview')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    // A number typed: Esc holds the run open and says how to close it.
    const box = screen.getByLabelText('Envelope 1 · Owner of record: Elbel Holdings LLC — tracking')
    fireEvent.change(box, { target: { value: '9407 1118 9922' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText(/The run stays open over the numbers you typed/)).toBeTruthy()
    expect((box as HTMLInputElement).value).toBe('9407 1118 9922')
    // A click outside holds the same way.
    fireEvent.click(screen.getByRole('dialog', { name: 'Send the run' }))
    expect(onClose).not.toHaveBeenCalled()
    // Cleared again: nothing changed since it opened, so Esc closes.
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a changed send method or Mailed on day holds too; a click outside a run with nothing changed closes it', async () => {
    const onClose = vi.fn()
    const view = renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    const method = screen.getByLabelText('Envelope 2 · Original contractor: Loberg Contracting — method') as HTMLSelectElement
    fireEvent.change(method, { target: { value: 'hand' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText(/The run stays open over your changes/)).toBeTruthy()
    fireEvent.change(method, { target: { value: 'certified_mail' } })
    ensureMore()
    fireEvent.change(screen.getByLabelText('Mailed on'), { target: { value: '2026-09-12' } })
    fireEvent.keyDown(window, { key: 'Escape' }) // folds More
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    view.unmount()
    const onClose2 = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose2} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('dialog', { name: 'Send the run' }))
    expect(onClose2).toHaveBeenCalledTimes(1)
  })

  it('the take-back question closes on Esc before the run does', async () => {
    const onClose = vi.fn()
    const printed = [notice({ printedAt: '2026-10-07T16:00:00Z' })]
    renderWithProviders(<LienDeskRunModal notices={printed} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} onTakeBack={async (ids) => ids.length} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    expect(screen.getByTestId('run-take-back-confirm')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('run-take-back-confirm')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    if (screen.queryByTestId('run-more-panel')) {
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByTestId('run-more-panel')).toBeNull()
    }
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a signature pane on screen makes Esc wait; once it is gone, even with its twin pane left open on the other envelope, Esc closes', async () => {
    signMock.mockClear()
    const onClose = vi.fn()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' }, rowFields: { notice: { claimAmount: '33500' } } })]}
        issuer={null}
        todayYmd="2026-10-09"
        userId="u-taunya"
        viewer={{ userId: 'u-taunya', name: 'Taunya' }}
        onClose={onClose}
        onRecorded={() => {}}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-leader-here-sign-1'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('run-sign-here-1')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText('Finish the signature first, or close its pane.')).toBeTruthy()
    // The pen pane on the other envelope of the same notice, then the drawing signs both envelopes free.
    fireEvent.click(screen.getByTestId('run-pen-sign-2'))
    fireEvent.click(screen.getByTestId('run-sign-here-go-1'))
    await waitFor(() => expect(screen.queryByTestId('run-held-1')).toBeNull())
    await waitFor(() => expect(screen.queryByTestId('run-held-2')).toBeNull())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Esc and a click outside after review round 2 (v2.5530)', () => {
  const docsmitNotice = () =>
    notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ] })

  it('a Docsmit send holds the run on Esc and on a click outside, with words that say to record it', async () => {
    docsmitState.setUp = true
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[docsmitNotice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('1 envelope mailed through Docsmit.'))
    // The review's own Esc closes it; the run stays.
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText(/Envelopes went through Docsmit in this run\. Record the run so the desk keeps them/)).toBeTruthy()
    fireEvent.click(screen.getByRole('dialog', { name: 'Send the run' }))
    expect(onClose).not.toHaveBeenCalled()
    docsmitState.setUp = false
  })

  it('the Docsmit review closed while it mails does not leave Esc dead in the run', async () => {
    docsmitState.setUp = true
    let release: () => void = () => {}
    sendMock.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ ok: true, sent: [] }) }))
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[docsmitNotice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    // Mailing…: Esc closes the review (its own key); the run, mid-write, lets it be.
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { release() })
    await settle()
    // The review stays closed and its door works again.
    expect(screen.queryByTestId('dsm-review')).toBeNull()
    prepareMock.mockClear()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    expect(prepareMock).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    // Nothing went (sent: []), so nothing holds: More folds, then the run closes.
    ensureMore()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('run-more-panel')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    docsmitState.setUp = false
  })

  it('a click outside waits on a signature pane on screen, as Esc does', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <LienDeskRunModal notices={[notice({ signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' } })]} issuer={null} todayYmd="2026-10-09" userId="u-taunya" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={onClose} onRecorded={() => {}} />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-leader-here-sign-1'))
    fireEvent.click(screen.getByRole('dialog', { name: 'Send the run' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('run-sign-here-1')).toBeTruthy()
    expect(await screen.findByText('Finish the signature first, or close its pane.')).toBeTruthy()
  })

  it('a run left open past midnight is not changed by it: Mailed on is measured against the day it opened', async () => {
    const onClose = vi.fn()
    const view = renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    view.rerender(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-15" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('after a partial record, the recorded envelope’s ticks neither show on the envelopes left nor hold the run', async () => {
    recordMock.mockClear()
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [], courtesySent: [], courtesyFailed: [] }))
    const onClose = vi.fn()
    const two = [
      notice({ printedAt: '2026-10-07T16:00:00Z' }),
      notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: '2026-10-07T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Zed Holdings', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Yarrow Builders', address: '1 GC Rd', email: '', method: 'certified_mail', tracking: '' }] }),
    ]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    // 650's two envelopes: ticked at the counter and numbered.
    fireEvent.click(screen.getByLabelText('Envelope 1 — stuffed'))
    fireEvent.click(screen.getByLabelText('Envelope 2 — stuffed'))
    fireEvent.change(screen.getByLabelText('Envelope 1 — number (checklist)'), { target: { value: '9407 1118 9876 5432 1098' } })
    fireEvent.change(screen.getByLabelText('Envelope 2 — number (checklist)'), { target: { value: '9407 1118 9876 5432 1099' } })
    ensureMore()
    fireEvent.click(screen.getByRole('button', { name: /Record 1 mailed/ }))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
    // 651 is left, renumbered from 1, with boxes of its own.
    expect(screen.getByTestId('run-checklist-1').textContent).toContain('651 owner')
    expect((screen.getByLabelText('Envelope 1 — stuffed') as HTMLInputElement).checked).toBe(false)
    if (screen.queryByTestId('run-more-panel')) fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Combine holds only while it still joins something: a partial record that takes the pair out lets the run close', async () => {
    recordMock.mockClear()
    const onClose = vi.fn()
    const at = '2026-10-07T16:00:00Z'
    const n650 = notice({ printedAt: at })
    const n652 = notice({ itemId: 'it652', jobId: 'j652', label: '652 · ATI Schertz annex', jobNumber: '652', amount: 4_500, months: ['2026-08'], printedAt: at })
    const n653 = notice({
      itemId: 'it653', jobId: 'j653', label: '653 · Zed Shop', jobNumber: '653', printedAt: at,
      fields: { ...notice().fields, originalContractorName: 'Yarrow Builders' },
      recipients: [
        { key: 'owner', label: 'Owner of record', name: 'Zed Holdings', address: '9 Other Rd, Austin, TX', email: '', method: 'certified_mail', tracking: '' },
        { key: 'original_contractor', label: 'Original contractor', name: 'Yarrow Builders', address: '77 Third St', email: '', method: 'certified_mail', tracking: '' },
      ],
    })
    renderWithProviders(<LienDeskRunModal notices={[n650, n652, n653]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Combine the jobs at one property into one notice'))
    // With the pair joined, Combine holds.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    // Number the joined notice's envelopes and record it; 653 is left alone.
    for (let n = 1; n <= 6; n++) {
      const row = screen.queryByTestId(`run-checklist-${n}`)
      if (row && /650/.test(row.textContent ?? '')) fireEvent.change(screen.getByLabelText(`Envelope ${n} — number (checklist)`), { target: { value: `9407 1118 9922 1111 2222 0${n}` } })
    }
    const rec = screen.getAllByRole('button').find((b) => /Record .* mailed/.test(b.textContent ?? ''))!
    fireEvent.click(rec)
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Combine the jobs at one property into one notice')).toBeNull()
    if (screen.queryByTestId('run-more-panel')) fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a run opened on its take-back question with nothing printed closes on the first Esc', async () => {
    const onClose = vi.fn()
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} onTakeBack={async (ids) => ids.length} openOnTakeBack />)
    await settle()
    expect(screen.queryByTestId('run-take-back-confirm')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('LienDeskRunModal · nothing left in the run (punch list #184, sweep C)', () => {
  it('says nothing approved is waiting, in the one empty shape, and prints nothing', async () => {
    renderWithProviders(<LienDeskRunModal notices={[]} issuer={null} todayYmd="2026-10-26" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')!.textContent).toBe('Nothing approved is waiting.')
    expect((screen.getByRole('button', { name: /Print the packet/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
