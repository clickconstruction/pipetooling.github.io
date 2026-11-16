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
// His code on this screen (v2.6733): the status the card reads when the sheet opens, and the code RPC, watched. No code set unless a case says so.
const codeState = {
  status: { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null } as { set: boolean; setAtIso: string | null; lastUsedAtIso: string | null; lockedUntilIso: string | null } | null,
  signs: [] as Array<Record<string, unknown>>,
  answer: { ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Robert Douglas' } as Record<string, unknown>,
}
vi.mock('../../lib/jobs/lienDeskSignIo', () => ({
  signLienDeskItem: (args: unknown) => signMock(args),
  lienSignCodeStatus: async () => codeState.status,
  signLienDeskItemWithCode: async (args: Record<string, unknown>) => {
    codeState.signs.push(args)
    return codeState.answer
  },
}))
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
const prepareMock = vi.fn(async (envs: Array<{ key: string }>) => ({ prepared: [{ key: envs[0]!.key, n: 1, label: 'Owner of record', who: 'Elwick Holdings LLC', windowLines: ['Elwick Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'], sendType: 'Certified, Electronic Return Receipt', shortCode: 'KX7M2QRT', recipient: 'owner', jobNumber: '650', itemIds: ['it1'], pieceId: 'p1', price: 9.85, correction: null, sheets: 4, envelope: '#10', pdfUrl: 'blob:one', pdfPath: 'mail/KX7M2QRT.pdf' }], held: [{ key: envs[1]?.key ?? 'gc', n: 2, label: 'Original contractor', why: 'The address needs a ZIP or ZIP+4.' }], balance: 120 }))
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
    label: '650 · AXO Schertz',
    jobNumber: '650',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: { noticeDate: '2026-09-14', projectDescription: 'AXO Schertz — 1204 Elwick Rd', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: { refItems: ['Job #650'] },
    coverLetter: null,
    coverNote: 'This is a routine notice…',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '4 Example Way, Schertz, TX', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
    ],
    ...partial,
  }
}

/** Run-4: the secondary doors sit under More ▾; open it once when a test needs one. */
function ensureMore() {
  if (!screen.queryByTestId('run-more-panel')) fireEvent.click(screen.getByTestId('run-more'))
}

const NUMBER = '9407 1118 9876 5432 1098'

/**
 * The checklist (v2.7328): Record takes a row only once it is printed and every paper envelope has its number. A test that
 * records prints the packet (the print mock answers yes) and types a number into every card box first.
 */
function printAndNumber() {
  const print = screen.queryByRole('button', { name: /^Print the packet/ })
  if (print) fireEvent.click(print)
  for (const box of screen.getAllByLabelText(/— tracking$/) as HTMLInputElement[]) if (!box.value) fireEvent.change(box, { target: { value: NUMBER } })
}

describe('LienDeskRunModal', () => {
  it('lists an envelope per recipient with the method and tracking, the notice inside it, counts the envelopes, and can record', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Print and mail' })).toBeTruthy()
    expect(screen.getByText('Print and mail · 1 notice')).toBeTruthy()
    expect(screen.getByTestId('run-envelope-1').textContent).toContain('Envelope 1 · Owner of record Elwick Holdings LLC')
    expect(screen.getByTestId('run-envelope-2').textContent).toContain('office@lowbeck.test')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 · AXO Schertz')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('cover note')
    expect(screen.getByTestId('run-row-j650-original_contractor').textContent).toContain('Copy for: original contractor')
    expect(screen.getAllByText('June and July 2026')).toHaveLength(2) // once per copy
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    // The checklist (v2.7328): Record is dead until the row is printed and every envelope has its number; the row says which tick it waits on.
    expect((screen.getByTestId('run-record') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('not printed')
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking'), { target: { value: '9407 1118 9922' } })
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    // The number typed on the card is the envelope's: the checklist's box shows it too.
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    printAndNumber()
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('mailed · ready to record')
    expect((screen.getByTestId('run-record') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('run-record').textContent).toBe('Record 1 mailing')
    // Email is offered only where an address is on file.
    const gcMethod = screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — method') as HTMLSelectElement
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
      <LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} undo={{ words: 'You just approved this notice for Lowbeck Contracting. Pressed it by mistake?', busy: false, onUndo }} />,
    )
    await settle()
    const strip = screen.getByTestId('run-undo')
    expect(strip.textContent).toContain('You just approved this notice for Lowbeck Contracting. Pressed it by mistake?')
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
    expect(screen.getAllByText(/Owner of record: nobody to send to/).length).toBeGreaterThan(0)
    expect((screen.getByTestId('run-record') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('run-record').textContent).toBe('Record ▸')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('1 heldFix what is marked in red, then print.')
    // The held row's Printed press is dead too: nothing prints for nobody.
    expect((screen.getByTestId('run-check-mark-printed-it1') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a held notice stays in the pile while the ready one records (v2.5533): the button says so, the record carries only the ready one, and the held one keeps its row', async () => {
    recordMock.mockClear()
    const held = notice({ itemId: 'it2', jobId: 'j651', label: '651 · AXO Schertz II', jobNumber: '651' })
    held.recipients[0] = { ...held.recipients[0]!, name: '', address: '' }
    const onClose = vi.fn()
    const ready = notice({ printedAt: '2026-09-13T16:00:00Z' })
    ready.recipients = ready.recipients.map((r) => ({ ...r, tracking: NUMBER }))
    renderWithProviders(<LienDeskRunModal notices={[ready, held]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    const button = screen.getByRole('button', { name: 'Record 1 mailing · 1 waits ▸' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.getByText('1 is held. It stays here with the reason. The 1 ready one records now.')).toBeTruthy()
    expect(screen.getByTestId('run-held-list').textContent).toContain('651 · AXO Schertz II · Owner of record: nobody to send to')
    fireEvent.click(button)
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent.map((x) => x.itemId)).toEqual(['it1'])
    // the held one stays, the window stays open on it
    await settle()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Owner of record: nobody to send to/).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('run-check-it1')).toBeNull()
    expect(screen.getByTestId('run-check-it2')).toBeTruthy()
  })

  it('two notices to one owner at one address share an envelope, and the GC gets one envelope with both inside — one tracking number each', async () => {
    const a = notice()
    const b = notice({ itemId: 'it2', jobId: 'j651', label: '651 · AXO Schertz II', jobNumber: '651', months: ['2026-07'] })
    renderWithProviders(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Print and mail · 2 notices')).toBeTruthy()
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
    fireEvent.change(screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — tracking'), { target: { value: '9407 2' } })
    expect((screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — tracking') as HTMLInputElement).value).toBe('9407 2')
    expect(screen.getAllByLabelText(/— tracking$/)).toHaveLength(2)
  })
})

describe('LienDeskRunModal · the courtesy PDF to the original contractor (punch list #87 B)', () => {
  const ticked = (partial: Partial<RunNotice> = {}) => {
    const n = notice(partial)
    return { ...n, recipients: n.recipients.map((r) => (r.key === 'original_contractor' ? { ...r, courtesy: true } : r)) }
  }
  const tickLabel = 'Envelope 2 · Original contractor: Lowbeck Contracting — courtesy PDF by email'

  it('the GC envelope carries the tick, on, naming the address; the owner envelope never does; unticking reaches the record', async () => {
    recordMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-courtesy-1')).toBeNull()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@lowbeck.test, emailed when the run is recorded')
    const tick = screen.getByLabelText(tickLabel) as HTMLInputElement
    expect(tick.checked).toBe(true)
    fireEvent.click(tick)
    expect((screen.getByLabelText(tickLabel) as HTMLInputElement).checked).toBe(false)
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-record'))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent[0]!.recipients.map((r) => [r.key, r.courtesy])).toEqual([
      ['owner', undefined],
      ['original_contractor', false],
    ])
  })

  it('one GC envelope with two notices says one email per notice; switched to email, the tick goes because the email is the send', async () => {
    renderWithProviders(<LienDeskRunModal notices={[ticked(), ticked({ itemId: 'it2', jobId: 'j651', label: '651 · AXO Schertz II', jobNumber: '651', months: ['2026-07'] })]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@lowbeck.test, emailed when the run is recorded, one email per notice')
    fireEvent.change(screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — method'), { target: { value: 'email' } })
    expect(screen.queryByTestId('run-courtesy-2')).toBeNull()
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('the record names the courtesy PDF that went, and warns when one did not', async () => {
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [{ itemId: 'it1', label: '650 · AXO Schertz', email: 'office@lowbeck.test' }], courtesyFailed: [] }))
    const view = renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-record'))
    expect(await screen.findByText('1 notice recorded — the desk reads them as sent. Courtesy PDF emailed to office@lowbeck.test.')).toBeTruthy()
    view.unmount()
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [], courtesyFailed: [{ itemId: 'it1', label: '650 · AXO Schertz', email: 'office@lowbeck.test', reason: 'Resend 502' }] }))
    renderWithProviders(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-record'))
    expect(await screen.findByText('Courtesy PDF not emailed: 650 · AXO Schertz to office@lowbeck.test (Resend 502). That notice is recorded all the same.')).toBeTruthy()
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
      expect(door.title).toBe('Opens in a new tab, as office@lowbeck.test would get it. Nothing is sent.')
      expect(screen.getByTestId('run-courtesy-2').contains(door)).toBe(false)
      fireEvent.click(door)
      expect(tab.open).toHaveBeenCalledWith('', '_blank')
      await waitFor(() => expect(tab.page()).not.toBe(''))
      const page = tab.page()
      expect(page).toContain('This email goes to office@lowbeck.test when you record the run, while Courtesy PDF stays ticked.')
      expect(page).toContain('<dt>To</dt><dd>office@lowbeck.test</dd>')
      expect(page).toContain('<h1 class="subject">Courtesy copy: notice of claim for unpaid labor or materials — 650 · AXO Schertz</h1>')
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
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-record'))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const opts = (recordMock.mock.calls[0] as unknown as [unknown, { document?: { url?: string; note?: string } }])[1]
    expect(opts.document).toEqual({ url: 'drive.google.com/file/d/abc/view', note: 'the packet as printed' })
  })
})

describe('LienDeskRunModal · one notice per property (#35 PR 3)', () => {
  it('offers the combine tick only when jobs share an owner and address, folds them into one notice, and records the combined notice with its parts', async () => {
    recordMock.mockClear()
    const a = notice()
    const b = { ...notice(), itemId: 'it2', jobId: 'j651', label: '651 · AXO Schertz annex', jobNumber: '651', amount: 4_500, months: ['2026-08'] }
    renderWithProviders(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Print and mail · 2 notices')).toBeTruthy()
    const tick = screen.getByLabelText('Combine the jobs at one property into one notice') as HTMLInputElement
    expect(tick.checked).toBe(false)
    expect(screen.getByTestId('run-combine').textContent).toContain('2 jobs would print as 1 notice (1 combined)')
    fireEvent.click(tick)
    expect(screen.getByText('Print and mail · 1 notice for 2 jobs')).toBeTruthy()
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 + 651')
    expect(screen.getAllByTestId('run-combined-parts').map((el) => el.textContent)).toEqual(['650 $33,500 · 651 $4,500', '650 $33,500 · 651 $4,500']) // once per copy
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    // The tracking typed on the envelope reaches both parts.
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking'), { target: { value: '9407 0000' } })
    printAndNumber()
    // Two rows, one combined notice: the press counts the rows it takes.
    expect(screen.getByTestId('run-record').textContent).toBe('Record 2 mailings')
    fireEvent.click(screen.getByTestId('run-record'))
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
    const at = '2026-09-28T16:00:00Z'
    const two = [notice({ printedAt: at }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: at, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Other GC', address: '1 GC Rd', email: '', method: 'certified_mail', tracking: '' }] })]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('done')
    ensureMore()
    expect(screen.getByRole('button', { name: /Envelope faces/ })).toBeTruthy()
    expect(screen.getByTestId('run-record').textContent).toBe('Record ▸')
    // The checklist's box is the envelope's: the card's shape line answers what is typed there.
    const owner = screen.getByLabelText('650 · AXO Schertz — owner tracking')
    fireEvent.change(owner, { target: { value: '9407 1118 9876 5432 10' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('18 digits — a certified number has 20')
    fireEvent.change(owner, { target: { value: '9407 1118 9876 5432 1098' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('✓ 20 digits · certified')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('printed · not mailed')
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9876 5432 1111' } })
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('mailed · ready to record')
    expect(screen.getByRole('button', { name: 'Record 1 mailing · 1 waits ▸' })).toBeTruthy()
    expect(screen.getByTestId('run-held-list').textContent).toBe('651 · Other · no tracking numbers yet')
    fireEvent.click(screen.getByTestId('run-record'))
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
    expect(screen.getByRole('dialog', { name: 'Enter mail numbers' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^Enter mail numbers · 2 notices/ })).toBeTruthy()
    // Every envelope printed: the journey has Sent done and In the mail as the step that is now (Run-4 retired the step strip).
    expect(screen.getByTestId('run-journey-sent').getAttribute('data-state')).toBe('done')
    expect(screen.getByTestId('run-journey-mailed').getAttribute('data-state')).toBe('now')
    expect(screen.getByText('Type each envelope’s number from the slip. Record takes the rows that have theirs.')).toBeTruthy()
    expect(screen.getByTestId('run-foot-status').textContent).toContain('2 owe a number')
    ensureMore()
    expect(screen.getByRole('button', { name: /^Print it again · 3 envelopes/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Print the packet/ })).toBeNull()
    // The Printed ticks carry the day each printed.
    expect(screen.getByTestId('run-check-printed-it1').textContent).toBe('✓ Sep 14')
    expect(screen.getByTestId('run-check-printed-it2').textContent).toBe('✓ Sep 15')
    printAndNumber()
    expect(screen.getByTestId('run-record').textContent).toBe('Record 2 mailings')
    fireEvent.click(screen.getByTestId('run-record'))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('one notice not yet printed: the run opens on printing as before', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-09-14T16:00:00Z' }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Print and mail' })).toBeTruthy()
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
    expect(confirm.textContent).toContain('The 2 notices go back to Approved · to print. The approvals stand.')
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
    expect(screen.getByTestId('run-taken-back').textContent).toContain('Taken back. The 2 notices printed October 7, 2026 are in Approved · to print again.')
    expect(screen.getByRole('heading', { name: /^Print and mail · 2 notices/ })).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: /^Enter mail numbers · 2 notices/ })).toBeTruthy()
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
    expect(html).not.toContain('Lowbeck Contracting</title>')
    expect(filing).toMatchObject({ kind: 'lien_notice', title: '650 · AXO Schertz · copy for owner of record', jobIds: ['j650'], recipientName: 'Elwick Holdings LLC' })
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
    expect(envFiling.title).toMatch(/^Envelope 1 · Owner of record Elwick Holdings LLC$/)
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
    expect(screen.getByTestId('lien-run-preview-title').textContent).toBe('650 · AXO Schertz · owner of record')
    expect(screen.getByTestId('lien-run-preview-envelope').textContent).toBe('Envelope 1 · Owner of record Elwick Holdings LLC · 4 Example Way, Schertz, TX')
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('1 of 2')
    // The owner's copy: the cover note, then the form naming the copy.
    expect(screen.getAllByTestId('lien-run-preview-page-label').map((el) => el.textContent)).toEqual(['Page 1 of 2 · Cover note', 'Page 2 of 2 · § 53.056 notice · copy for owner of record'])
    expect(overlay.textContent).toContain('This is a routine notice…')
    expect(overlay.textContent).toContain('Copy for: Owner of record')
    // › walks to the original contractor's copy: the form alone.
    fireEvent.click(screen.getByRole('button', { name: 'Next copy' }))
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('2 of 2')
    expect(screen.getByTestId('lien-run-preview-title').textContent).toBe('650 · AXO Schertz · original contractor')
    expect(screen.getAllByTestId('lien-run-preview-page-label').map((el) => el.textContent)).toEqual(['Page 1 of 1 · § 53.056 notice · copy for original contractor'])
    expect((screen.getByRole('button', { name: 'Next copy' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('lien-run-preview-count').textContent).toBe('1 of 2')
    // Esc closes the preview and leaves the run open.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-run-preview')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Print and mail' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("LienDeskRunModal · the enclosed bill carries Stripe's number (v2.4852)", () => {
  it("the preview's invoice page prints Stripe's number and due day, never the app's #0", async () => {
    const { fetchJobWithDetailsById } = await import('../../lib/fetchJobWithDetailsById')
    const { fetchStripeInvoiceFacts } = await import('../../lib/stripeInvoiceFacts')
    const bill = { id: 'inv-878', amount: 15200, sequence_order: 0, status: 'billed', billed_at: '2026-09-16T14:00:00Z', created_at: '2026-09-16T13:59:00Z', sent_to_customer_at: null, estimated_bill_date: null, stripe_invoice_id: 'in_878', stripe_invoice_memo: 'Paper checks can be sent to: Click Plumbing', external_send_note: '', stripe_invoice_footer: null }
    vi.mocked(fetchJobWithDetailsById).mockResolvedValue({ id: 'j650', hcp_number: '878', job_name: 'Tune 5- Seguin', job_address: '1 Example Rd', customer_name: 'Southern Pine Construction', customer_email: '', customer_id: 'c1', gc_customer_id: null, bill_to_party: 'customer', fixtures: [], materials: [], payments: [], invoices: [bill] } as never)
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
      expect(saved).toContain('\r\n,Elwick Holdings LLC,4 Example Way,,"Schertz, TX",,,,Envelope 1 · 650\r\n')
      expect(saved).toContain(',Lowbeck Contracting,2904 Corporate Cr,,,,,,Envelope 2 · 650\r\n')
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
    // The checklist's Signed tick is open and is a press to the pen pane; Mailed takes the numbers; a signature never holds the record.
    expect(screen.getByTestId('run-check-sign-it1').textContent).toBe('Signed ▸')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('printed · not signed')
    printAndNumber()
    const button = screen.getByRole('button', { name: 'Record 1 mailing' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
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

  it('with his code set, the sheet opens on the code field (v2.6733, punch list #150): Sign ▸ hands the code to the RPC as his signature on her screen, with no approval, and the envelopes go back into the run', async () => {
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    codeState.signs = []
    signMock.mockClear()
    try {
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
      expect(screen.getByTestId('run-held-1').textContent).toContain('types his code or draws it here with Leader here, sign ▸')
      fireEvent.click(screen.getByTestId('run-leader-here-sign-1'))
      await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
      const sheet = screen.getByTestId('run-sign-here-1')
      expect(sheet.textContent).toContain('Robert signs here with his code')
      expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Robert Douglas')
      expect(sheet.textContent).toContain('Robert Douglas types his code or draws on this screen. The record names Taunya as whose screen it was.')
      // No code typed: nothing is sent, nothing drawn is asked for.
      fireEvent.click(screen.getByTestId('run-sign-here-go-1'))
      await settle()
      expect(codeState.signs).toHaveLength(0)
      expect(signMock).not.toHaveBeenCalled()
      fireEvent.change(screen.getByLabelText('Robert’s signing code'), { target: { value: '2468' } })
      fireEvent.click(screen.getByTestId('run-sign-here-go-1'))
      await waitFor(() => expect(codeState.signs).toHaveLength(1))
      expect(codeState.signs[0]).toEqual({ itemId: 'it1', fields: { notice: { claimAmount: '33500' } }, signerUserId: 'u-robert', code: '2468', approve: false })
      expect(signMock).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByTestId('run-held-1')).toBeNull())
      expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    } finally {
      codeState.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
    }
  })

  it('a refused code says so under the field with the tries left, and the envelope stays held (v2.6733)', async () => {
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    codeState.signs = []
    codeState.answer = { ok: false, reason: 'wrong', message: 'That is not Robert’s code.', triesLeft: 2, lockedUntilIso: null }
    try {
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
      fireEvent.click(screen.getByTestId('run-leader-here-sign-1'))
      await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
      fireEvent.change(screen.getByLabelText('Robert’s signing code'), { target: { value: '0000' } })
      fireEvent.click(screen.getByTestId('run-sign-here-go-1'))
      await waitFor(() => expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('That is not Robert’s code. 2 tries left.'))
      expect(codeState.signs).toHaveLength(1)
      expect(screen.getByTestId('run-held-1')).toBeTruthy()
      expect(screen.getByTestId('run-sign-here-1')).toBeTruthy()
    } finally {
      codeState.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
      codeState.answer = { ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Robert Douglas' }
    }
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
  const ELWICK: [string, string] = ['Elwick Holdings LLC', '17300 IH 35 N, Schertz, TX 78154']
  const LOWBECK: [string, string] = ['Lowbeck Contracting', '2904 Corporate Cr, San Antonio, TX 78230']

  it.each([
    ['an unsigned', { signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' } }, /^Held · Unsigned: /],
    ['a $0', { amount: 0, fields: { ...notice().fields, claimAmount: '0.00' } }, /^Held · Nothing to send: the claim is \$0\./],
  ] as Array<[string, Partial<RunNotice>, RegExp]>)('%s notice offers no Docsmit envelope: its envelopes are held, the door is dim and says why, and prepare is never asked', async (_kind, partial, held) => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    renderWithProviders(<LienDeskRunModal notices={[notice({ ...partial, recipients: mailable(ELWICK, LOWBECK) })]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    const clean = notice({ recipients: mailable(ELWICK, LOWBECK) })
    const unsigned = notice({ itemId: 'it2', jobId: 'j712', label: '712 · AXO B', jobNumber: '712', signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' }, recipients: mailable(['Bandera Holdings', '2200 Bandera Rd, San Antonio, TX 78228'], ['Harlan Builders', '100 Main St, Seguin, TX 78155']) })
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
      [1, 'Elwick Holdings LLC', ['it1']],
      [2, 'Lowbeck Contracting', ['it1']],
    ])
    docsmitState.setUp = false
  })
})

describe('LienDeskRunModal · the checklist (v2.7328) and the lanes (Run-5)', () => {
  it('one row per notice with Printed, Signed and Mailed across; each open tick is a press; the number typed in a row is the envelope’s; a lane per way the envelopes travel', async () => {
    const two = [
      notice({ printedAt: '2026-10-07T16:00:00Z', printedBy: 'Taunya', signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' } }),
      notice({ itemId: 'it2', jobId: 'j688', label: '688 · Harlan Dental', jobNumber: '688', printedAt: '2026-10-07T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd', email: '', method: 'hand', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd', email: '', method: 'hand', tracking: '' }] }),
    ]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const list = screen.getByTestId('run-check')
    expect(list.textContent).toContain('The checklist')
    expect(list.textContent).toContain('2 printed · 0 signed · 1 mailed of 2')
    // 650: printed by Taunya on the 7th, unsigned (the Signed press opens the pen pane), two numbers owed.
    const row = screen.getByTestId('run-check-it1')
    expect(row.getAttribute('data-waits')).toBe('sign')
    expect(screen.getByTestId('run-check-printed-it1').textContent).toBe('✓ Oct 7 · Taunya')
    expect(screen.getByTestId('run-check-sign-it1').textContent).toBe('Signed ▸')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('printed · not signed')
    expect(row.textContent).toContain('Owner: Elwick Holdings LLC · GC: Lowbeck Contracting')
    expect(row.textContent).toContain('$33,500')
    // 688 goes by hand: the builder said nothing about signing, and a hand delivery owes a name, not a number.
    expect(screen.getByTestId('run-check-signed-it2').textContent).toBe('—')
    expect(screen.getByTestId('run-check-it2').getAttribute('data-waits')).toBe('none')
    expect(screen.getByTestId('run-check-line-it2').textContent).toBe('mailed · ready to record')
    // The number typed on the checklist is the envelope's: the card's box shows it too, and the row moves on.
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — owner tracking'), { target: { value: NUMBER } })
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking') as HTMLInputElement).value).toBe(NUMBER)
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9876 5432 1111' } })
    expect(screen.getByTestId('run-check-it1').getAttribute('data-waits')).toBe('sign')
    expect(list.textContent).toContain('2 printed · 0 signed · 2 mailed of 2')
    // Signed ▸ opens the pen pane under the row, for that notice alone.
    fireEvent.click(screen.getByTestId('run-check-sign-it1'))
    const pane = screen.getByTestId('lien-pen-pane')
    expect(row.contains(pane)).toBe(true)
    expect(pane.textContent).toContain('Robert Douglas')
    expect(screen.getByLabelText('650 · AXO Schertz signed with a pen')).toBeTruthy()
    // Two ways to travel: certified and by hand, each a lane.
    expect(screen.getByTestId('run-lane-certified').textContent).toContain('Certified')
    expect(screen.getByTestId('run-lane-hand').textContent).toContain('By hand')
    expect(screen.getByTestId('run-lane-hand').textContent).toContain('envelope 3')
  })

  it('Printed ▸ on a row marks the paper printed by hand with who and when, and the desk is told; Mark N printed takes every unprinted row at once', async () => {
    const printed: string[][] = []
    const two = [notice(), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] })]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    expect(screen.getByTestId('run-mark-printed').textContent).toBe('Mark 2 printed')
    expect(screen.getByTestId('run-check-it1').getAttribute('data-waits')).toBe('print')
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('run-check-mark-printed-it1'))
    expect(screen.getByTestId('run-check-printed-it1').textContent).toMatch(/^✓ \w{3} \d{1,2} · Taunya$/)
    expect(printed).toEqual([['it1']])
    expect(screen.getByTestId('run-mark-printed').textContent).toBe('Mark 1 printed')
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('run-mark-printed'))
    expect(printed).toEqual([['it1'], ['it2']])
    expect(screen.getByTestId('run-mark-printed').textContent).toBe('Mark printed')
    expect((screen.getByTestId('run-mark-printed') as HTMLButtonElement).disabled).toBe(true)
    // Every notice printed: the foot moves to recording and the packet press goes under More as Print it again.
    expect(screen.queryByRole('button', { name: /^Print the packet/ })).toBeNull()
  })

  it('a printed notice whose job was paid since is held on its row (v2.7337): the foot and Mark N signed leave it out, and its own Signed and Mailed are closed', async () => {
    const at = '2026-10-07T16:00:00Z'
    const leader = { userId: 'u-rob', name: 'Robert Douglas' }
    const two = [
      notice({ printedAt: at, signature: null, leader }),
      // The paper says $2,400; the job's open balance is $0 today.
      notice({ itemId: 'it2', jobId: 'j651', label: '651 · Paid since', jobNumber: '651', printedAt: at, signature: null, leader, amount: 0, fields: { ...notice().fields, claimAmount: '2400.00' }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
    ]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const why = 'Nothing to claim: the job owes $0 now. The paper says $2,400.'
    // Paid rows fold under one line at the foot of the checklist (v2.7353); the heading counts the live ones.
    expect(screen.queryByTestId('run-check-it2')).toBeNull()
    expect(screen.getByTestId('run-check').querySelector('h3')?.textContent).toBe('The checklist 1 printed · 0 signed · 0 mailed of 1')
    expect(screen.getByTestId('run-paid-fold-toggle').textContent).toBe('1 paid notice · nothing to send ▾')
    // No close is offered when the host hands the window none.
    expect(screen.queryByTestId('run-close-paid')).toBeNull()
    fireEvent.click(screen.getByTestId('run-paid-fold-toggle'))
    expect(screen.queryByTestId('run-check-close-it2')).toBeNull()
    expect(screen.getByTestId('run-check-held-it2').textContent).toBe(`Held · ${why}`)
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 to sign · 1 held')
    const press = screen.getByTestId('run-mark-signed') as HTMLButtonElement
    expect(press.textContent).toBe('Mark 1 signed · 1 waits ▸')
    expect(press.title).toBe(`651 · Paid since: ${why}`)
    // The live row keeps its doors; the paid one has no Signed press and a closed Mailed box.
    expect(screen.getByTestId('run-check-sign-it1').textContent).toBe('Signed ▸')
    expect(screen.getByTestId('run-check-sign-it2').textContent).toBe('nothing to sign')
    const box = screen.getByLabelText('651 · Paid since — owner tracking') as HTMLInputElement
    expect(box.disabled).toBe(true)
    expect(box.placeholder).toBe('nothing to mail')
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).disabled).toBe(false)
    fireEvent.click(press)
    expect(screen.getByLabelText('650 · AXO Schertz signed with a pen')).toBeTruthy()
    expect(screen.queryByLabelText('651 · Paid since signed with a pen')).toBeNull()
  })

  it('Close N paid notices (v2.7353): the fold’s press asks first, closes what it can, and names the one that did not', async () => {
    const at = '2026-10-07T16:00:00Z'
    const leader = { userId: 'u-rob', name: 'Robert Douglas' }
    const paid = (itemId: string, n: string) => notice({ itemId, jobId: `j${n}`, label: `${n} · Paid since`, jobNumber: n, printedAt: at, signature: null, leader, amount: 0, fields: { ...notice().fields, claimAmount: '2400.00' }, recipients: [{ key: 'owner', label: 'Owner of record', name: `Owner ${n}`, address: `${n} Other St`, email: '', method: 'certified_mail', tracking: '' }] })
    const asked: string[][] = []
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ printedAt: at, signature: null, leader }), paid('it2', '651'), paid('it3', '652'), paid('it4', '653')]}
        issuer={null}
        todayYmd="2026-10-08"
        userId="u1"
        viewer={{ userId: 'u-taunya', name: 'Taunya' }}
        onClose={() => {}}
        onRecorded={() => {}}
        onClosePaid={async (ids) => {
          asked.push(ids)
          // One row at a time closes; the batch closes all but 653, which moved meanwhile.
          return ids.length === 1 ? { closed: ids, failed: [] } : { closed: ids.filter((id) => id !== 'it4'), failed: [{ itemId: 'it4', why: 'It was sent or closed already.' }] }
        }}
      />,
    )
    await settle()
    expect(screen.getByTestId('run-paid-fold-toggle').textContent).toBe('3 paid notices · nothing to send ▾')
    const press = screen.getByTestId('run-close-paid') as HTMLButtonElement
    expect(press.textContent).toBe('Close 3 paid notices…')
    // The press only asks: nothing is written until the confirm's own press.
    fireEvent.click(press)
    const confirm = screen.getByTestId('run-close-paid-confirm')
    expect(confirm.textContent).toContain('Close the 3 paid notices?')
    expect(confirm.textContent).toContain('651 · Paid since, 652 · Paid since, 653 · Paid since')
    expect(confirm.textContent).toContain('These jobs owe $0 now, so nothing is mailed.')
    expect(confirm.textContent).toContain('The copies that printed stay in each job’s Documents, filed as printed.')
    expect(confirm.textContent).toContain('Closing does not record a mailing. Leave a notice that went out.')
    expect(asked).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Keep them here' }))
    expect(screen.queryByTestId('run-close-paid-confirm')).toBeNull()
    expect(asked).toEqual([])
    // One row's own Close…: the confirm is about that notice alone.
    fireEvent.click(screen.getByTestId('run-paid-fold-toggle'))
    fireEvent.click(screen.getByTestId('run-check-close-it2'))
    expect(screen.getByTestId('run-close-paid-confirm').textContent).toContain('Close the paid notice?')
    expect(screen.getByTestId('run-close-paid-yes').textContent).toBe('Close 1 paid notice')
    fireEvent.click(screen.getByTestId('run-close-paid-yes'))
    await settle()
    expect(asked).toEqual([['it2']])
    expect(screen.getByTestId('run-closed-paid').textContent).toBe('Closed 1 paid notice. Nothing was mailed.')
    expect(screen.queryByTestId('run-check-it2')).toBeNull()
    expect(screen.getByTestId('run-paid-fold-toggle').textContent).toBe('2 paid notices · nothing to send ▴')
    // The batch: it closes 652, and 653 stays on the screen with its reason.
    fireEvent.click(screen.getByTestId('run-close-paid'))
    expect(screen.getByTestId('run-close-paid-yes').textContent).toBe('Close 2 paid notices')
    fireEvent.click(screen.getByTestId('run-close-paid-yes'))
    await settle()
    expect(asked).toEqual([['it2'], ['it3', 'it4']])
    expect(screen.getByTestId('run-closed-paid').textContent).toBe('Closed 1 paid notice. Nothing was mailed.')
    const failed = screen.getByTestId('run-close-paid-failed')
    expect(failed.textContent).toContain('1 paid notice did not close. It stays here with the reason.')
    expect(failed.textContent).toContain('653 · Paid since: It was sent or closed already.')
    expect(screen.queryByTestId('run-check-it3')).toBeNull()
    expect(screen.getByTestId('run-check-it4')).toBeTruthy()
    // The live notice was never asked about, and its row is as it was.
    expect(screen.getByTestId('run-check-sign-it1').textContent).toBe('Signed ▸')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 to sign · 1 held')
  })

  it('Mark N signed ▸ opens one pen pane over every printed, unsigned notice of the leader; the record ticks each row', async () => {
    const at = '2026-10-07T16:00:00Z'
    const two = [
      notice({ printedAt: at, signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, rowFields: { a: 1 } }),
      notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: at, signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, rowFields: { a: 2 }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
      notice({ itemId: 'it3', jobId: 'j652', label: '652 · Unprinted', jobNumber: '652', signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Third Owner', address: '3 Third St', email: '', method: 'certified_mail', tracking: '' }] }),
    ]
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const press = screen.getByTestId('run-mark-signed') as HTMLButtonElement
    expect(press.textContent).toBe('Mark 2 signed · 1 waits ▸')
    expect(press.title).toBe('652 · Unprinted: not printed yet')
    fireEvent.click(press)
    const pane = screen.getByTestId('run-sign-batch')
    expect(screen.getByLabelText('650 · AXO Schertz signed with a pen')).toBeTruthy()
    expect(screen.getByLabelText('651 · Other signed with a pen')).toBeTruthy()
    expect(screen.queryByLabelText('652 · Unprinted signed with a pen')).toBeNull()
    expect(pane.textContent).toContain('Record 2 pen signatures ▸')
    // Esc waits while the pane is open.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText('Finish the signature first, or close its pane.')).toBeTruthy()
  })

  it('nothing printed: the checklist still stands, every row waiting on Printed; no lanes', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-check-it1').getAttribute('data-waits')).toBe('print')
    expect(screen.queryByTestId('run-lanes')).toBeNull()
    // The envelope cards sit under their fold, open on a computer.
    expect(screen.getByTestId('run-cards-fold').textContent).toContain('Envelopes and copies · 2')
    expect(screen.getByTestId('run-cards')).toBeTruthy()
    fireEvent.click(screen.getByTestId('run-cards-fold'))
    expect(screen.queryByTestId('run-cards')).toBeNull()
  })

  it('Print the sheet under More prints one page with a row per notice, three boxes and a code each, and files nothing', async () => {
    printMock.mockClear()
    const opened: string[] = []
    const tab = { document: { open: vi.fn(), write: (h: string) => void opened.push(h), close: vi.fn(), images: [] }, focus: vi.fn(), close: vi.fn(), print: vi.fn(), addEventListener: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-10-07T16:00:00Z', printedBy: 'Taunya' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-print-sheet'))
    const html = opened.join('')
    expect(html).toContain('data-run-checklist-sheet')
    expect(html).toContain('data-run-sheet-row="it1"')
    expect(html).toContain('☑ Printed Oct 7 · Taunya')
    expect(html).toContain('☐ Mailed')
    expect(html).toContain('<img alt="" src="data:image/png;base64,')
    expect(printMock).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('Mail through Docsmit (PR 5b): the door shows once a dev set the connection up, the review lists the prepared and the held, mailing marks the card and moves the foot to recording', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    const full = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
    expect(screen.getByTestId('dsm-env-1').textContent).toContain('Elwick Holdings LLC')
    expect(screen.getByTestId('dsm-held-2').textContent).toContain('The address needs a ZIP or ZIP+4.')
    expect(screen.getByTestId('dsm-price').textContent).toBe('1 envelope · $9.85 · balance $120.00')
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('1 envelope mailed through Docsmit.'))
    expect(sendMock).toHaveBeenCalledWith(['p1'])
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(screen.getByTestId('run-chip-1').textContent).toBe('mailed through Docsmit · number coming')
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking') as HTMLInputElement).disabled).toBe(true)
    // The GC's envelope stays on paper, so the foot still prints, and only that one: the Docsmit envelope left the packet.
    expect(screen.getByRole('button', { name: /Print the packet · 1 envelope$/ })).toBeTruthy()
    docsmitState.setUp = false
  })

  it('a mailing through Docsmit is kept the moment it goes (v2.5532): the notice with every copy out is stamped printed and the desk re-reads, before the × closes the run', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    sendMock.mockClear()
    const both = notice({ recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
    ] })
    const piece = (key: string, n: number, recipient: 'owner' | 'original_contractor', pieceId: string) => ({ key, n, label: recipient === 'owner' ? 'Owner of record' : 'Original contractor', who: recipient === 'owner' ? 'Elwick Holdings LLC' : 'Lowbeck Contracting', windowLines: [], sendType: 'Certified, Electronic Return Receipt', shortCode: `KX7M2QR${n}`, recipient, jobNumber: '650', itemIds: ['it1'], pieceId, price: 9.85, correction: null, sheets: 4, envelope: '#10' as const, pdfUrl: `blob:${n}`, pdfPath: `mail/KX7M2QR${n}.pdf` })
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
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
    // The packet is printed, so the print press is gone from the foot; Record waits only on the paper envelope's number.
    expect(screen.queryByRole('button', { name: /^Print the packet/ })).toBeNull()
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 owes a number')
    expect(screen.getByTestId('run-check-printed-it1').textContent).toMatch(/^✓ /)
    docsmitState.setUp = false
  })

  it('a run opened after a Docsmit send knows the copy that went: no second mailing, no paper copy, nothing to take back (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    // As the desk builds it from the piece behind the item (runRecipientWithPiece): the owner's copy went, the GC's did not.
    const after = notice({ printedAt: '2026-10-14T15:00:00Z', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '9407 1118 9922 0000 0000 01', via: 'docsmit', pieceId: 'p1', pieceStatus: 'mailed', pieceProblem: null },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
    ] })
    const unprinted = notice({ itemId: 'it2', jobId: 'j712', label: '712 · AXO B', jobNumber: '712', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Bandera Holdings', address: '2200 Bandera Rd, San Antonio, TX 78228', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
    ] })
    renderWithProviders(<LienDeskRunModal notices={[after, unprinted]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => 0} />)
    await settle()
    // Three envelopes: the owner's that went, the other owner's, and the GC's with both notices inside. Docsmit offers the two that did not go.
    expect(screen.getByTestId('run-chip-1').textContent).toBe('mailed through Docsmit · 9407 1118 9922 0000 0000 01')
    expect(screen.getByTestId('run-docsmit').textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes$/ })).toBeTruthy()
    // The notice that went part by Docsmit is not offered back to Approved · to print.
    ensureMore()
    expect(screen.queryByTestId('run-take-back')).toBeNull()
    fireEvent.click(screen.getByTestId('run-docsmit'))
    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1))
    expect((prepareMock.mock.calls[0]![0] as unknown as Array<{ name: string }>).map((e) => e.name).sort()).toEqual(['Bandera Holdings', 'Lowbeck Contracting'])
    docsmitState.setUp = false
  })

  it('a copy that went last sitting keeps its own envelope: the new copy to the same GC goes out on its own (v2.5532)', async () => {
    docsmitState.setUp = true
    prepareMock.mockClear()
    // As the desk hands them in: Ready first (B, fresh), then In the mail (A, both copies built from their pieces).
    const fresh = notice({ itemId: 'it2', jobId: 'j712', label: '712 · AXO B', jobNumber: '712', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Bandera Holdings', address: '2200 Bandera Rd, San Antonio, TX 78228', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: '', method: 'certified_mail', tracking: '' },
    ] })
    const went = notice({ printedAt: '2026-10-13T15:00:00Z', recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '9407 1', via: 'docsmit', pieceId: 'p1', pieceStatus: 'mailed', pieceProblem: null },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, San Antonio, TX 78230', email: '', method: 'certified_mail', tracking: '9407 2', via: 'docsmit', pieceId: 'p2', pieceStatus: 'mailed', pieceProblem: null },
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
    expect(asked.map((e) => [e.name, e.contents.map((c) => c.notice.itemId)])).toEqual([['Bandera Holdings', ['it2']], ['Lowbeck Contracting', ['it2']]])
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
    const box = screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking')
    fireEvent.change(box, { target: { value: '9407 1118 9922' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText(/The run stays open over the numbers you typed/)).toBeTruthy()
    expect((box as HTMLInputElement).value).toBe('9407 1118 9922')
    // A click outside holds the same way.
    fireEvent.click(screen.getByRole('dialog', { name: 'Print and mail' }))
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
    const method = screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — method') as HTMLSelectElement
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
    fireEvent.click(screen.getByRole('dialog', { name: 'Print and mail' }))
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
      { key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking: '' },
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
    fireEvent.click(screen.getByRole('dialog', { name: 'Print and mail' }))
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
    fireEvent.click(screen.getByRole('dialog', { name: 'Print and mail' }))
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
    // 650's two envelopes numbered on its row.
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — owner tracking'), { target: { value: '9407 1118 9876 5432 1098' } })
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9876 5432 1099' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record 1 mailing · 1 waits ▸' }))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
    // 651 is left, with boxes of its own, empty.
    expect(screen.queryByTestId('run-check-it1')).toBeNull()
    expect((screen.getByLabelText('651 · Other — owner tracking') as HTMLInputElement).value).toBe('')
    if (screen.queryByTestId('run-more-panel')) fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Combine holds only while it still joins something: a partial record that takes the pair out lets the run close', async () => {
    recordMock.mockClear()
    const onClose = vi.fn()
    const at = '2026-10-07T16:00:00Z'
    const n650 = notice({ printedAt: at })
    const n652 = notice({ itemId: 'it652', jobId: 'j652', label: '652 · AXO Schertz annex', jobNumber: '652', amount: 4_500, months: ['2026-08'], printedAt: at })
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
    // Number the joined notice's envelopes (shared with 652, so its row takes them too) and record it; 653 is left alone.
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — owner tracking'), { target: { value: '9407 1118 9922 1111 2222 01' } })
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9922 1111 2222 02' } })
    expect((screen.getByLabelText('652 · AXO Schertz annex — owner tracking') as HTMLInputElement).value).toBe('9407 1118 9922 1111 2222 01')
    fireEvent.click(screen.getByRole('button', { name: 'Record 2 mailings · 1 waits ▸' }))
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

describe('LienDeskRunModal · what was mailed (the owner’s ask of 2026-11-16)', () => {
  const scan = () => new File(['%PDF-1.4 the scan'], 'SCAN0007.PDF', { type: 'application/pdf' })
  const kept = { url: 'https://drive.google.com/file/d/f1/view', driveFileId: 'f1', name: 'Lien notice as mailed · 650 · 2026-10-08.pdf', at: '2026-10-08T18:00:00.000Z', by: 'u1' }
  const other = (partial: Partial<RunNotice> = {}) => notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }], ...partial })

  it('a printed row takes a scan: the file goes up for that notice, the row lists it with its Drive link, and the desk is told; a row not printed yet has no press', async () => {
    cleanup()
    const added: Array<{ itemId: string; jobId: string; jobNumber: string; fileName: string; todayYmd: string; userId: string | null }> = []
    const onRecorded = vi.fn()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z' }), other()]}
        issuer={null}
        todayYmd="2026-10-08"
        userId="u1"
        onClose={() => {}}
        onRecorded={onRecorded}
        addMailedCopy={async (a) => {
          added.push({ itemId: a.itemId, jobId: a.jobId, jobNumber: a.jobNumber, fileName: a.file.name, todayYmd: a.todayYmd, userId: a.userId })
          return [kept]
        }}
      />,
    )
    await settle()
    expect(screen.queryByTestId('run-check-copy-add-it2')).toBeNull()
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add what was mailed')
    fireEvent.change(screen.getByTestId('run-check-copy-file-it1'), { target: { files: [scan()] } })
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).not.toBeNull())
    expect(added).toEqual([{ itemId: 'it1', jobId: 'j650', jobNumber: '650', fileName: 'SCAN0007.PDF', todayYmd: '2026-10-08', userId: 'u1' }])
    const link = screen.getByTestId('run-check-copies-it1').querySelector('a') as HTMLAnchorElement
    expect([link.getAttribute('href'), link.textContent, link.getAttribute('target')]).toEqual([kept.url, `✓ ${kept.name} ›`, '_blank'])
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add another')
    expect(document.body.textContent).toContain(`Added ${kept.name}. It is in the job’s Drive folder, under Sent by us.`)
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it('a file that is not a scan or a photo is refused with its reason, and an upload that fails says why; neither lists a file', async () => {
    cleanup()
    const addMailedCopy = vi.fn(async () => {
      throw new Error('This job has no Drive folder yet.')
    })
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} addMailedCopy={addMailedCopy} />)
    await settle()
    fireEvent.change(screen.getByTestId('run-check-copy-file-it1'), { target: { files: [new File(['notes'], 'notes.txt', { type: 'text/plain' })] } })
    await waitFor(() => expect(document.body.textContent).toContain('That file is not a scan or a photo. Add a PDF or a picture.'))
    expect(addMailedCopy).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('run-check-copy-file-it1'), { target: { files: [scan()] } })
    await waitFor(() => expect(document.body.textContent).toContain('This job has no Drive folder yet.'))
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).toBeNull()
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add what was mailed')
  })

  it('Take off (v2.7525): the notice forgets the file after the ask, the row stops listing it, the words say it is still in Drive, and the desk is told', async () => {
    cleanup()
    const removed: Array<{ itemId: string; driveFileId: string }> = []
    const onRecorded = vi.fn()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z', mailedCopies: [kept] })]}
        issuer={null}
        todayYmd="2026-10-09"
        userId="u1"
        onClose={() => {}}
        onRecorded={onRecorded}
        removeMailedCopy={async (a) => {
          removed.push({ itemId: a.itemId, driveFileId: a.copy.driveFileId })
          return []
        }}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-check-copy-off-it1-0'))
    expect(removed).toEqual([])
    fireEvent.click(screen.getByTestId('run-check-copy-off-yes-it1'))
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).toBeNull())
    expect(removed).toEqual([{ itemId: 'it1', driveFileId: 'f1' }])
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add what was mailed')
    expect(document.body.textContent).toContain(`Took ${kept.name} off this notice. The file is still in the job’s Drive folder.`)
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it('a take-off that fails says why and the file stays listed', async () => {
    cleanup()
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z', mailedCopies: [kept] })]}
        issuer={null}
        todayYmd="2026-10-09"
        userId="u1"
        onClose={() => {}}
        onRecorded={() => {}}
        removeMailedCopy={async () => {
          throw new Error('The notice could not be reached.')
        }}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-check-copy-off-it1-0'))
    fireEvent.click(screen.getByTestId('run-check-copy-off-yes-it1'))
    await waitFor(() => expect(document.body.textContent).toContain('The notice could not be reached.'))
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')!.getAttribute('href')).toBe(kept.url)
  })

  it('a retainage notice’s row has the press too, and its file is named for the retainage notice (v2.7525)', async () => {
    cleanup()
    const papers: Array<string | undefined> = []
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ kind: 'retainage_53_057', months: [], printedAt: '2026-10-07T15:00:00.000Z' })]}
        issuer={null}
        todayYmd="2026-10-08"
        userId="u1"
        onClose={() => {}}
        onRecorded={() => {}}
        addMailedCopy={async (a) => {
          papers.push(a.paper)
          return [{ ...kept, name: 'Retainage notice as mailed · 650 · 2026-10-08.pdf' }]
        }}
      />,
    )
    await settle()
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add what was mailed')
    fireEvent.change(screen.getByTestId('run-check-copy-file-it1'), { target: { files: [scan()] } })
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).not.toBeNull())
    expect(papers).toEqual(['retainage'])
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')!.textContent).toBe('✓ Retainage notice as mailed · 650 · 2026-10-08.pdf ›')
  })

  it('a notice that already has its file shows it when the run opens again, on a printed row and with the press reading Add another', async () => {
    cleanup()
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z', mailedCopies: [kept] })]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')!.getAttribute('href')).toBe(kept.url)
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add another')
  })
})
