// @vitest-environment jsdom
/**
 * Render smokes for the run (v2.3410): one envelope per name and address
 * (v2.3720) with its method + tracking and the notices inside it, the
 * envelope count, a missing address blocks Record, an email method needs an
 * address on file.
 */
import { lienNoticeSignatureAfterSigning } from '../../lib/jobs/lienNoticeSignature'
import { describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskRunModal from './LienDeskRunModal'
import { AddFileFailure } from '../../lib/jobs/addFileFailure'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'
import { lienPropertyAffidavitLine, lienPropertyNoticeLine } from '../../lib/jobs/lienPropertyPapers'
import type { LienRunProperty } from '../../lib/jobs/lienRunEnvelopeProperty'
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

/** v2.7477: every press but the one for the step the run is on sits under More. These open it and hand back the press. */
function more(testId: string): HTMLElement {
  ensureMore()
  return screen.getByTestId(testId)
}
function moreQuery(testId: string): HTMLElement | null {
  ensureMore()
  return screen.queryByTestId(testId)
}

/** v2.7477: the envelope cards start folded under the rows. A smoke that reads a card opens the fold once, as a person would. */
function renderRun(ui: Parameters<typeof renderWithProviders>[0]) {
  const view = renderWithProviders(ui)
  const fold = screen.queryByTestId('run-cards-fold')
  if (fold && fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold)
  return view
}

/** The one press at the foot (v2.7477): its act, its words, and whether it is dead. */
function onePress(): HTMLButtonElement {
  return screen.getByTestId('run-press') as HTMLButtonElement
}

const NUMBER = '9407 1118 9876 5432 1098'

/**
 * The checklist (v2.7328): Record takes a row only once it is printed and every paper envelope has its number. A test that
 * records prints the packet (the print mock answers yes) and types a number into every card box first.
 */
function printAndNumber() {
  if (onePress().getAttribute('data-act') === 'print' && !onePress().disabled) fireEvent.click(onePress())
  for (const box of screen.getAllByLabelText(/— tracking$/) as HTMLInputElement[]) if (!box.value) fireEvent.change(box, { target: { value: NUMBER } })
}

describe('LienDeskRunModal', () => {
  it('lists an envelope per recipient with the method and tracking, the notice inside it, counts the envelopes, and can record', async () => {
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Print and mail' })).toBeTruthy()
    expect(screen.getByText('Print and mail · 1 notice')).toBeTruthy()
    expect(screen.getByTestId('run-envelope-1').textContent).toContain('Envelope 1 · Owner of record Elwick Holdings LLC')
    expect(screen.getByTestId('run-envelope-2').textContent).toContain('office@lowbeck.test')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 · AXO Schertz')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('cover note')
    expect(screen.getByTestId('run-row-j650-original_contractor').textContent).toContain('Copy for: original contractor')
    expect(screen.getAllByText('June and July 2026')).toHaveLength(2) // once per copy
    // The one count (v2.7477): the second line names the copies and the envelopes once, the count line is in notices, and the one press prints what is ready.
    expect(screen.getByTestId('run-sub').textContent).toBe('2 copies in 2 envelopes')
    expect(screen.getByTestId('run-parts').textContent).toBe('1 notice=1 ready')
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(onePress().getAttribute('data-act')).toBe('print')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('1 can print now.The packet prints with its checklist sheet, in envelope order: 2 envelopes.')
    // The checklist (v2.7328): the row says which tick it waits on, under its part's head.
    expect(screen.getByTestId('run-group-head-ready').textContent).toBe('▾Ready · 1 notice$33,500')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('not printed')
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking'), { target: { value: '9407 1118 9922' } })
    expect((screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    // The number typed on the card is the envelope's: the checklist's box shows it too.
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    printAndNumber()
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('mailed · ready to record')
    expect((screen.getByTestId('run-press') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('run-press').textContent).toBe('Record 1 mailing')
    // Email is offered only where an address is on file.
    const gcMethod = screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — method') as HTMLSelectElement
    fireEvent.change(gcMethod, { target: { value: 'email' } })
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('offers to undo the approval only when the opener says the run was just started (v2.4541)', async () => {
    const onUndo = vi.fn()
    const view = renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-undo')).toBeNull()
    view.unmount()
    renderRun(
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
    renderRun(<LienDeskRunModal notices={[n]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getAllByText(/Owner of record: nobody to send to/).length).toBeGreaterThan(0)
    expect(onePress().disabled).toBe(true)
    expect(onePress().textContent).toBe('Print notices')
    expect(screen.getByTestId('run-parts').textContent).toBe('1 notice=1 held')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('Nothing can print yet.1 notice is held, with its reason.')
    expect(screen.getByTestId('run-group-head-held').textContent).toBe('▾Held · 1 notice$33,500')
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
    renderRun(<LienDeskRunModal notices={[ready, held]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    const button = onePress()
    expect(button.textContent).toBe('Record 1 mailing')
    expect(button.disabled).toBe(false)
    expect(screen.getByTestId('run-parts').textContent).toBe('1 printed=1 ready to record')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('1 is ready to record.Recording writes each notice to its job with how it went and every month it covered.')
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
    renderRun(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Print and mail · 2 notices')).toBeTruthy()
    expect(screen.getByTestId('run-sub').textContent).toBe('4 copies in 2 envelopes')
    expect(onePress().textContent).toBe('Print 2 notices')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 2 envelopes.')
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
    renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('run-courtesy-1')).toBeNull()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@lowbeck.test, emailed when the run is recorded')
    const tick = screen.getByLabelText(tickLabel) as HTMLInputElement
    expect(tick.checked).toBe(true)
    fireEvent.click(tick)
    expect((screen.getByLabelText(tickLabel) as HTMLInputElement).checked).toBe(false)
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-press'))
    await vi.waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [sent] = recordMock.mock.calls[0] as unknown as [RunNotice[]]
    expect(sent[0]!.recipients.map((r) => [r.key, r.courtesy])).toEqual([
      ['owner', undefined],
      ['original_contractor', false],
    ])
  })

  it('one GC envelope with two notices says one email per notice; switched to email, the tick goes because the email is the send', async () => {
    renderRun(<LienDeskRunModal notices={[ticked(), ticked({ itemId: 'it2', jobId: 'j651', label: '651 · AXO Schertz II', jobNumber: '651', months: ['2026-07'] })]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-courtesy-2').textContent).toBe('Courtesy PDF to office@lowbeck.test, emailed when the run is recorded, one email per notice')
    fireEvent.change(screen.getByLabelText('Envelope 2 · Original contractor: Lowbeck Contracting — method'), { target: { value: 'email' } })
    expect(screen.queryByTestId('run-courtesy-2')).toBeNull()
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('the record names the courtesy PDF that went, and warns when one did not', async () => {
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [{ itemId: 'it1', label: '650 · AXO Schertz', email: 'office@lowbeck.test' }], courtesyFailed: [] }))
    const view = renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-press'))
    expect(await screen.findByText('1 notice recorded — the desk reads them as sent. Courtesy PDF emailed to office@lowbeck.test.')).toBeTruthy()
    view.unmount()
    recordMock.mockImplementationOnce(async () => ({ recorded: ['it1'], failed: [], releaseFailed: [] as { label: string; reason: string }[], courtesySent: [], courtesyFailed: [{ itemId: 'it1', label: '650 · AXO Schertz', email: 'office@lowbeck.test', reason: 'Resend 502' }] }))
    renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-06" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-press'))
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
      renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    const view = renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const waiting = screen.getByTestId('run-courtesy-preview-2') as HTMLButtonElement
    expect(waiting.disabled).toBe(true)
    expect(waiting.textContent).toBe('Preview the email · reading the bills…')
    view.unmount()
    const tab = stubTab()
    try {
      renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
      renderRun(<LienDeskRunModal notices={[ticked()]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    expect(screen.getByTestId('run-saved-copy')).toBeTruthy()
    ensureMore()
    fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'drive.google.com/file/d/abc/view' } })
    ensureMore()
    fireEvent.change(screen.getByLabelText('Saved copy — note'), { target: { value: 'the packet as printed' } })
    printAndNumber()
    fireEvent.click(screen.getByTestId('run-press'))
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
    renderRun(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByText('Print and mail · 2 notices')).toBeTruthy()
    // Combine is a rare choice (v2.7477): it sits under More, where it says how many jobs could combine, and stays off unless ticked.
    expect(screen.queryByTestId('run-combine')).toBeNull()
    expect(more('run-combine').textContent).toContain('2 jobs could combine into 1 notice.')
    const tick = screen.getByLabelText('Combine the jobs at one property into one notice') as HTMLInputElement
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    // The count stays in notices, one a job; the second line says what the tick did.
    expect(screen.getByText('Print and mail · 2 notices')).toBeTruthy()
    expect(screen.getByTestId('run-sub').textContent).toBe('2 copies in 2 envelopes · combined: 2 jobs print on 1 form')
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('650 + 651')
    expect(screen.getAllByTestId('run-combined-parts').map((el) => el.textContent)).toEqual(['650 $33,500 · 651 $4,500', '650 $33,500 · 651 $4,500']) // once per copy
    expect(onePress().textContent).toBe('Print 2 notices')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 2 envelopes.')
    // The tracking typed on the envelope reaches both parts.
    fireEvent.change(screen.getByLabelText('Envelope 1 · Owner of record: Elwick Holdings LLC — tracking'), { target: { value: '9407 0000' } })
    printAndNumber()
    // Two rows, one combined notice: the press counts the rows it takes.
    expect(screen.getByTestId('run-press').textContent).toBe('Record 2 mailings')
    fireEvent.click(screen.getByTestId('run-press'))
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
    renderRun(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(moreQuery('run-combine')).toBeNull()
  })
})

describe('LienDeskRunModal — the mailing (v2.4119)', () => {
  it('shows the steps, checks a number\u2019s shape as it is typed, and records only the numbered envelopes', async () => {
    recordMock.mockClear()
    const printed: string[][] = []
    const at = '2026-09-28T16:00:00Z'
    const two = [notice({ printedAt: at }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: at, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'Other GC', address: '1 GC Rd', email: '', method: 'certified_mail', tracking: '' }] })]
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    // Both printed: the run is on its third step, and the count is what printed.
    expect([1, 2, 3].map((n) => screen.getByTestId(`run-journey-${n}`).getAttribute('data-state'))).toEqual(['done', 'done', 'now'])
    expect(screen.getByTestId('run-journey-3').textContent).toBe('3Mail and record0 of 4 numbers typed')
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=2 owe a number')
    ensureMore()
    expect(screen.getByRole('button', { name: /Envelope faces/ })).toBeTruthy()
    expect(onePress().textContent).toBe('Record the mailing')
    expect(onePress().disabled).toBe(true)
    expect(screen.getByTestId('run-foot-status').textContent).toBe('4 envelopes owe a number.Type each from its green slip, or scan it with a phone.')
    // The checklist's box is the envelope's: the card's shape line answers what is typed there.
    const owner = screen.getByLabelText('650 · AXO Schertz — owner tracking')
    fireEvent.change(owner, { target: { value: '9407 1118 9876 5432 10' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('18 digits — a certified number has 20 or 22')
    fireEvent.change(owner, { target: { value: '9407 1118 9876 5432 1098' } })
    expect(screen.getByTestId('run-tracking-shape-1').textContent).toBe('✓ 20 digits · certified')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('printed · not mailed')
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9876 5432 1111' } })
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('mailed · ready to record')
    expect(onePress().textContent).toBe('Record 1 mailing')
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=1 ready to record1 owes a number')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 is ready to record. 1 stays here until its numbers are typed.')
    expect(screen.getByTestId('run-held-list').textContent).toBe('651 · Other · no tracking numbers yet')
    fireEvent.click(screen.getByTestId('run-press'))
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
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Enter mail numbers' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^Enter mail numbers · 2 notices/ })).toBeTruthy()
    // Every notice printed: the journey has Print done and Mail and record as the step the run is on.
    expect(screen.getByTestId('run-journey-2').textContent).toBe('✓Print2 of 2 printed')
    expect(screen.getByTestId('run-journey-3').getAttribute('data-state')).toBe('now')
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=2 owe a number')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('3 envelopes owe a number.Type each from its green slip, or scan it with a phone.')
    // The one press is the record, dead until a notice has every number; printing again is under More.
    expect(onePress().getAttribute('data-act')).toBe('record')
    expect(onePress().disabled).toBe(true)
    ensureMore()
    expect(screen.getByRole('button', { name: /^Print it again · 3 envelopes/ })).toBeTruthy()
    // The Printed ticks carry the day each printed.
    expect(screen.getByTestId('run-check-printed-it1').textContent).toBe('✓ Sep 14')
    expect(screen.getByTestId('run-check-printed-it2').textContent).toBe('✓ Sep 15')
    printAndNumber()
    expect(screen.getByTestId('run-press').textContent).toBe('Record 2 mailings')
    fireEvent.click(screen.getByTestId('run-press'))
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('one notice not yet printed: the run opens on printing as before', async () => {
    renderRun(<LienDeskRunModal notices={[notice({ printedAt: '2026-09-14T16:00:00Z' }), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Print and mail' })).toBeTruthy()
    expect(screen.getByTestId('run-journey-2').getAttribute('data-state')).toBe('now')
    // A second packet: what printed stays in the count beside what is ready.
    expect(screen.getByTestId('run-parts').textContent).toBe('2 notices=1 ready1 printed')
    expect(onePress().textContent).toBe('Print 1 notice')
  })
})

describe('LienDeskRunModal · take back a printed run (punch list #101)', () => {
  const printedTwo = () => [
    notice({ printedAt: '2026-10-07T16:00:00Z' }),
    notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: '2026-10-07T16:00:00Z', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
  ]

  it('Take back… asks first, says what stays and what is dropped, then hands every printed item over and goes back to printing', async () => {
    const taken: string[][] = []
    renderRun(<LienDeskRunModal notices={printedTwo()} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
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
    expect(screen.getByTestId('run-journey-2').getAttribute('data-state')).toBe('now')
    expect(onePress().textContent).toBe('Print 2 notices')
    expect((screen.getAllByLabelText(/tracking$/)[0] as HTMLInputElement).value).toBe('')
    expect(screen.queryByTestId('run-take-back')).toBeNull()
  })

  it('signed notices lose the signature with the take-back (v2.7503): the confirm says so first, and the strip after says the leader signs again', async () => {
    const sig = lienNoticeSignatureAfterSigning({ mode: 'type', printedName: 'Avery Stone', pngDataUrl: null, signedAtIso: '2026-10-06T15:00:00Z', jobNumber: '650', itemId: 'it1', onDeviceName: null })
    const leader = { userId: 'u-avery', name: 'Avery Stone' }
    const taken: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={printedTwo().map((n) => ({ ...n, signature: sig, leader }))} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    const confirm = screen.getByTestId('run-take-back-confirm')
    expect(confirm.textContent).toContain('The 2 notices go back to Approved · to print. The approvals stand.')
    expect(confirm.textContent).toContain('Their signatures come off. The leader signs them again before they print.')
    expect(taken).toEqual([])
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1', 'it2']])
    expect(screen.getByTestId('run-taken-back').textContent).toBe('Taken back. The 2 notices printed October 7, 2026 are in Approved · to print again. The leader signs them again. Then print the packet.')
    // The window shows them unsigned at once (the run window of v2.7477): both sit under the wait on his signature, and nothing can print.
    expect(screen.getByTestId('run-group-head-wait').textContent).toContain('Wait on Avery Stone’s signature · 2 notices')
    expect(screen.getByTestId('run-check-line-it1').textContent).toContain('not signed')
    expect(screen.getByTestId('run-check-line-it2').textContent).toContain('not signed')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('Nothing can print yet.')
  })

  it('only what printed is taken back; a run with nothing printed, or a host without the door, offers none', async () => {
    const taken: string[][] = []
    const { unmount } = renderRun(<LienDeskRunModal notices={[printedTwo()[0]!, notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('Take back the 1 notice that printed?')
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('have not printed stay as they are')
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1']])
    unmount()
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => 0} />)
    await settle()
    expect(screen.queryByTestId('run-take-back')).toBeNull()
  })

  it('a packet printed in this sitting can be taken back at once', async () => {
    const taken: string[][] = []
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    fireEvent.click(onePress())
    await settle()
    ensureMore()
    fireEvent.click(screen.getByTestId('run-take-back'))
    fireEvent.click(screen.getByTestId('run-take-back-yes'))
    await settle()
    expect(taken).toEqual([['it1']])
  })

  it('a failed take-back says so and keeps the run as it was', async () => {
    renderRun(<LienDeskRunModal notices={printedTwo()} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => { throw new Error('offline') }} />)
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
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
    expect(screen.getByTestId('run-journey-2').getAttribute('data-state')).toBe('done')
    // The envelope door: one document for everything inside envelope 1.
    fireEvent.click(screen.getByTestId('run-print-envelope-1'))
    const [envHtml, envFiling] = printMock.mock.calls[2] as unknown as [string, { title: string }]
    expect(envHtml).toContain('<title>Envelope 1 —')
    expect(envFiling.title).toMatch(/^Envelope 1 · Owner of record Elwick Holdings LLC$/)
  })

  it('the preview has a Print this copy button that prints the copy on show', async () => {
    printMock.mockClear()
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-29" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-07" userId="u1" onClose={() => {}} onRecorded={() => {}} stripeMode="live" />)
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
      renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(
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
    renderRun(
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
    // The one count: it waits on his signature, under that head, and nothing can print.
    expect(screen.getByTestId('run-parts').textContent).toBe('1 notice=1 waits on Robert Douglas’s signature')
    expect(screen.getByTestId('run-group-head-wait').textContent).toBe('▾Waits on Robert Douglas’s signature · 1 notice$33,500')
    expect(screen.getByTestId('run-check-line-it1').textContent).toBe('not signed · Robert Douglas signs from a phone, or here with Signed ▸')
    expect(onePress().textContent).toBe('Print notices')
    expect(onePress().disabled).toBe(true)
    expect(screen.getByTestId('run-foot-status').textContent).toBe('Nothing can print yet.1 waits on Robert Douglas’s signature.')
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
    expect(screen.getByTestId('run-parts').textContent).toBe('1 notice=1 ready')
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 2 envelopes.')
  })

  it('with his code set, the sheet opens on the code field (v2.6733, punch list #150): Sign ▸ hands the code to the RPC as his signature on her screen, with no approval, and the envelopes go back into the run', async () => {
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    codeState.signs = []
    signMock.mockClear()
    try {
      renderRun(
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
      expect(onePress().textContent).toBe('Print 1 notice')
      expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 2 envelopes.')
    } finally {
      codeState.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
    }
  })

  it('a refused code says so under the field with the tries left, and the envelope stays held (v2.6733)', async () => {
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    codeState.signs = []
    codeState.answer = { ok: false, reason: 'wrong', message: 'That is not Robert’s code.', triesLeft: 2, lockedUntilIso: null }
    try {
      renderRun(
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
    renderRun(<LienDeskRunModal notices={[notice({ signature: null, leader: { userId: 'u-robert', name: 'Robert Douglas' } })]} issuer={null} todayYmd="2026-10-09" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice({ ...partial, recipients: mailable(ELWICK, LOWBECK) })]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-held-1').textContent).toMatch(held)
    expect(screen.getByTestId('run-held-2').textContent).toMatch(held)
    const door = more('run-docsmit') as HTMLButtonElement
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
    renderRun(<LienDeskRunModal notices={[clean, unsigned, nothing]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    // Envelopes 1 and 2 go out; 3 to 6 are held, each with its reason on its card.
    expect(screen.queryByTestId('run-held-1')).toBeNull()
    expect(screen.queryByTestId('run-held-2')).toBeNull()
    expect(screen.getByTestId('run-held-3').textContent).toMatch(/^Held · Unsigned: /)
    expect(screen.getByTestId('run-held-4').textContent).toMatch(/^Held · Unsigned: /)
    expect(screen.getByTestId('run-held-5').textContent).toMatch(/^Held · Nothing to send/)
    expect(screen.getByTestId('run-held-6').textContent).toMatch(/^Held · Nothing to send/)
    const door = more('run-docsmit') as HTMLButtonElement
    expect(door.textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(door.title).toBe('4 held envelopes wait in the run.')
    // The same two the packet prints: one notice is ready, in two envelopes.
    expect(screen.getByTestId('run-parts').textContent).toBe('3 notices=1 ready1 waits on Robert Douglas’s signature1 held')
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(screen.getByTestId('run-foot-status').textContent).toBe('1 can print now. 2 stay for the next packet.The packet prints with its checklist sheet, in envelope order: 2 envelopes.')
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
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    // The rows sit in groups by part (v2.7477), each under a head that counts notices; the heading that counted ticks is gone.
    expect(screen.getByTestId('run-check').querySelector('h3')).toBeNull()
    expect(screen.getByTestId('run-group-head-owe').textContent).toBe('▾Printed · 1 notice · owes a number$33,500')
    expect(screen.getByTestId('run-group-head-record').textContent).toBe('▾Ready to record · 1 notice$33,500')
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=1 ready to record1 owes a number')
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
    // v2.5533: a paper that printed unsigned records as it went, so with its numbers in it is ready to record; its Signed press stays open.
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=2 ready to record')
    expect(screen.getByTestId('run-group-head-record').textContent).toBe('▾Ready to record · 2 notices$67,000')
    // Signed ▸ opens the pen pane under the row, for that notice alone.
    fireEvent.click(screen.getByTestId('run-check-sign-it1'))
    const pane = screen.getByTestId('lien-pen-pane')
    expect(screen.getByTestId('run-check-it1').contains(pane)).toBe(true)
    expect(pane.textContent).toContain('Robert Douglas')
    expect(screen.getByLabelText('650 · AXO Schertz signed with a pen')).toBeTruthy()
    // The journey is the run's three steps; the lanes strip under it is gone (v2.7477).
    expect(screen.getByTestId('run-journey').querySelectorAll('[role="listitem"]')).toHaveLength(3)
    expect(screen.queryByTestId('run-lanes')).toBeNull()
  })

  it('Printed ▸ on a row marks the paper printed by hand with who and when, and the desk is told; Mark N printed takes every unprinted row at once', async () => {
    const printed: string[][] = []
    const two = [notice(), notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] })]
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    expect(more('run-mark-printed').textContent).toBe('Mark 2 printed')
    expect(screen.getByTestId('run-check-it1').getAttribute('data-waits')).toBe('print')
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('run-check-mark-printed-it1'))
    expect(screen.getByTestId('run-check-printed-it1').textContent).toMatch(/^✓ \w{3} \d{1,2} · Taunya$/)
    expect(printed).toEqual([['it1']])
    expect(more('run-mark-printed').textContent).toBe('Mark 1 printed')
    expect((screen.getByLabelText('650 · AXO Schertz — owner tracking') as HTMLInputElement).disabled).toBe(false)
    fireEvent.click(more('run-mark-printed'))
    expect(printed).toEqual([['it1'], ['it2']])
    expect(more('run-mark-printed').textContent).toBe('Mark printed')
    expect((more('run-mark-printed') as HTMLButtonElement).disabled).toBe(true)
    // Every notice printed: the one press is the record, and printing again is under More.
    expect(onePress().getAttribute('data-act')).toBe('record')
    expect(more('run-print-again').textContent).toBe('Print it again · 3 envelopes')
  })

  it('a printed notice whose job was paid since is held on its row (v2.7337): the foot and Mark N signed leave it out, and its own Signed and Mailed are closed', async () => {
    const at = '2026-10-07T16:00:00Z'
    const leader = { userId: 'u-rob', name: 'Robert Douglas' }
    const two = [
      notice({ printedAt: at, signature: null, leader }),
      // The paper says $2,400; the job's open balance is $0 today.
      notice({ itemId: 'it2', jobId: 'j651', label: '651 · Paid since', jobNumber: '651', printedAt: at, signature: null, leader, amount: 0, fields: { ...notice().fields, claimAmount: '2400.00' }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
    ]
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const why = 'Nothing to claim: the job owes $0 now. The paper says $2,400.'
    // Paid rows fold under one line at the foot of the Held group (v2.7353, v2.7477); the count line reads what printed and is not held.
    expect(screen.queryByTestId('run-check-it2')).toBeNull()
    expect(screen.getByTestId('run-group-head-held').textContent).toBe('▸Held · 1 notice$0')
    expect(screen.getByTestId('run-parts').textContent).toBe('1 printed=1 owes a number')
    expect(screen.getByTestId('run-paid-fold-toggle').textContent).toBe('1 paid notice · nothing to send ▾')
    // No close is offered when the host hands the window none.
    expect(screen.queryByTestId('run-close-paid')).toBeNull()
    fireEvent.click(screen.getByTestId('run-paid-fold-toggle'))
    expect(screen.queryByTestId('run-check-close-it2')).toBeNull()
    expect(screen.getByTestId('run-check-held-it2').textContent).toBe(`Held · ${why}`)
    expect(screen.getByTestId('run-foot-status').textContent).toContain('2 envelopes owe a number.')
    const press = more('run-mark-signed') as HTMLButtonElement
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
    renderRun(
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
    expect(screen.getByTestId('run-foot-status').textContent).toContain('2 envelopes owe a number.')
  })

  it('Mark N signed ▸ opens one pen pane over every printed, unsigned notice of the leader; the record ticks each row', async () => {
    const at = '2026-10-07T16:00:00Z'
    const two = [
      notice({ printedAt: at, signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, rowFields: { a: 1 } }),
      notice({ itemId: 'it2', jobId: 'j651', label: '651 · Other', jobNumber: '651', printedAt: at, signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, rowFields: { a: 2 }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Other Owner', address: '9 Other St', email: '', method: 'certified_mail', tracking: '' }] }),
      notice({ itemId: 'it3', jobId: 'j652', label: '652 · Unprinted', jobNumber: '652', signature: null, leader: { userId: 'u-rob', name: 'Robert Douglas' }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'Third Owner', address: '3 Third St', email: '', method: 'certified_mail', tracking: '' }] }),
    ]
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" viewer={{ userId: 'u-taunya', name: 'Taunya' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const press = more('run-mark-signed') as HTMLButtonElement
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice({ printedAt: '2026-10-07T16:00:00Z', printedBy: 'Taunya' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const door = more('run-docsmit') as HTMLButtonElement
    expect(door.textContent).toBe('Mail through Docsmit · 1 envelope ▸')
    expect(door.disabled).toBe(false)
    expect(more('run-docsmit-send-by').textContent).toMatch(/Docsmit/)
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
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 1 envelope.')
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
    renderRun(<LienDeskRunModal notices={[both]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
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
    renderRun(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(screen.getByTestId('dsm-outcome').textContent).toBe('1 envelope mailed through Docsmit.'))
    // The GC's copy is still to print, so the notice is not in the mail yet; the desk re-reads for the piece all the same.
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(onPrinted).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 1 envelope.')
    fireEvent.click(onePress())
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
    renderRun(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
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
    renderRun(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={onRecorded} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
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
    renderRun(<LienDeskRunModal notices={[full]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} onPrinted={onPrinted} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-print-envelope-2'))
    expect(onPrinted).not.toHaveBeenCalled()
    fireEvent.click(more('run-docsmit'))
    await waitFor(() => expect(screen.getByTestId('dsm-review')).toBeTruthy())
    fireEvent.click(screen.getByTestId('dsm-mail'))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['it1']))
    fireEvent.click(screen.getByTestId('dsm-close'))
    await waitFor(() => expect(screen.queryByTestId('dsm-review')).toBeNull())
    // The packet is printed, so the one press is the record; it waits only on the paper envelope's number.
    expect(onePress().getAttribute('data-act')).toBe('record')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 envelope owes a number.')
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
    renderRun(<LienDeskRunModal notices={[after, unprinted]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} onTakeBack={async () => 0} />)
    await settle()
    // Four envelopes (v2.7477): the unprinted notice's two come first, as its packet numbers them, then the printed notice's two.
    // The GC has two, since a copy that printed shares no envelope with one still to print. Docsmit offers the two that have not gone.
    expect(screen.getByTestId('run-chip-3').textContent).toBe('mailed through Docsmit · 9407 1118 9922 0000 0000 01')
    expect(more('run-docsmit').textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('in envelope order: 2 envelopes.')
    // The notice that went part by Docsmit is not offered back to Approved · to print.
    ensureMore()
    expect(screen.queryByTestId('run-take-back')).toBeNull()
    fireEvent.click(more('run-docsmit'))
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
    renderRun(<LienDeskRunModal notices={[fresh, went]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    // Four envelopes: B's two, then A's two. The GC has two, one mailed and one still to go.
    expect(screen.getByTestId('run-chip-2').textContent).not.toMatch(/mailed through Docsmit/)
    expect(screen.getByTestId('run-chip-4').textContent).toBe('mailed through Docsmit · 9407 2')
    expect(more('run-docsmit').textContent).toBe('Mail through Docsmit · 2 envelopes ▸')
    expect(onePress().textContent).toBe('Print 1 notice')
    fireEvent.click(more('run-docsmit'))
    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1))
    const asked = prepareMock.mock.calls[0]![0] as unknown as Array<{ name: string; contents: Array<{ notice: { itemId: string } }> }>
    expect(asked.map((e) => [e.name, e.contents.map((c) => c.notice.itemId)])).toEqual([['Bandera Holdings', ['it2']], ['Lowbeck Contracting', ['it2']]])
    docsmitState.setUp = false
  })

  it('Mail through Docsmit: no door until a dev set the connection up, none while paused, and a dim one when every certified address is short', async () => {
    docsmitState.setUp = false
    docsmitState.settings.paused = false
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(moreQuery('run-docsmit')).toBeNull()
    cleanup()
    docsmitState.setUp = true
    docsmitState.settings.paused = true
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(moreQuery('run-docsmit')).toBeNull()
    cleanup()
    docsmitState.settings.paused = false
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const door = more('run-docsmit') as HTMLButtonElement
    expect(door.disabled).toBe(true)
    expect(door.title).toMatch(/needs .*ZIP/)
    docsmitState.setUp = false
  })
})


describe('Esc in the run window (v2.5530)', () => {
  it('closes a run with nothing typed; folds More first; holds over a typed number; leaves the preview its own Esc', async () => {
    const onClose = vi.fn()
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
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
    const view = renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose2} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('dialog', { name: 'Print and mail' }))
    expect(onClose2).toHaveBeenCalledTimes(1)
  })

  it('the take-back question closes on Esc before the run does', async () => {
    const onClose = vi.fn()
    const printed = [notice({ printedAt: '2026-10-07T16:00:00Z' })]
    renderRun(<LienDeskRunModal notices={printed} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} onTakeBack={async (ids) => ids.length} />)
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
    renderRun(
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
    renderRun(<LienDeskRunModal notices={[docsmitNotice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
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
    renderRun(<LienDeskRunModal notices={[docsmitNotice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(more('run-docsmit'))
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
    fireEvent.click(more('run-docsmit'))
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
    renderRun(
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
    const view = renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-14" userId="u1" onClose={onClose} onRecorded={() => {}} />)
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
    renderRun(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    // 650's two envelopes numbered on its row.
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — owner tracking'), { target: { value: '9407 1118 9876 5432 1098' } })
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9876 5432 1099' } })
    expect(onePress().textContent).toBe('Record 1 mailing')
    fireEvent.click(onePress())
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
    renderRun(<LienDeskRunModal notices={[n650, n652, n653]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} />)
    await settle()
    ensureMore()
    fireEvent.click(screen.getByLabelText('Combine the jobs at one property into one notice'))
    // Esc closes More first. With the pair joined, Combine then holds.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('run-more-panel')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    // Number the joined notice's envelopes (shared with 652, so its row takes them too) and record it; 653 is left alone.
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — owner tracking'), { target: { value: '9407 1118 9922 1111 2222 01' } })
    fireEvent.change(screen.getByLabelText('650 · AXO Schertz — GC tracking'), { target: { value: '9407 1118 9922 1111 2222 02' } })
    expect((screen.getByLabelText('652 · AXO Schertz annex — owner tracking') as HTMLInputElement).value).toBe('9407 1118 9922 1111 2222 01')
    expect(onePress().textContent).toBe('Record 2 mailings')
    fireEvent.click(onePress())
    await settle()
    expect(recordMock).toHaveBeenCalledTimes(1)
    expect(moreQuery('run-combine')).toBeNull()
    if (screen.queryByTestId('run-more-panel')) fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a run opened on its take-back question with nothing printed closes on the first Esc', async () => {
    const onClose = vi.fn()
    renderRun(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={onClose} onRecorded={() => {}} onTakeBack={async (ids) => ids.length} openOnTakeBack />)
    await settle()
    expect(screen.queryByTestId('run-take-back-confirm')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('LienDeskRunModal · nothing left in the run (punch list #184, sweep C)', () => {
  it('says nothing approved is waiting, in the one empty shape, and prints nothing', async () => {
    renderRun(<LienDeskRunModal notices={[]} issuer={null} todayYmd="2026-10-26" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')!.textContent).toBe('Nothing approved is waiting.')
    expect(onePress().textContent).toBe('Nothing to send')
    expect(onePress().disabled).toBe(true)
    expect(screen.getByTestId('run-foot-status').textContent).toBe('Nothing is in this run.Approve a notice, or put one back in.')
    // No count line and no second line over an empty run.
    expect(screen.queryByTestId('run-parts')).toBeNull()
    expect(screen.queryByTestId('run-sub')).toBeNull()
  })
})

describe('LienDeskRunModal · one count, three steps, one press (v2.7477, punch list #362)', () => {
  const sam = { userId: 'u-sam', name: 'Sam' }
  const zz = (i: number, over: Partial<RunNotice> = {}): RunNotice =>
    notice({
      itemId: `z${i}`,
      jobId: `jz${i}`,
      label: `${1090 + i} · ZZ Test Lot ${i}`,
      jobNumber: String(1090 + i),
      amount: 1_000 + i * 100,
      mailBy: i === 3 ? '2026-11-16' : '2026-11-20',
      leader: sam,
      signature: { mode: 'type', printedName: 'Sam Sample', pngDataUrl: null, signedAtIso: '2026-11-12T19:14:00Z' } as unknown as RunNotice['signature'],
      recipients: [
        { key: 'owner', label: 'Owner of record', name: `ZZ Test Owner ${i} LLC`, address: `${i} Sample Rd, Sampleton, TX 78000`, email: '', method: 'certified_mail', tracking: '' },
        { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Test Builders', address: '100 Example Pkwy, Sampleton, TX 78000', email: '', method: 'certified_mail', tracking: '' },
      ],
      ...over,
    })
  /** The drawing's batch: 15 notices for one contractor. 8 are ready, 5 wait on the signature, 2 are held. */
  const fifteen = () => [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => zz(i)),
    ...[9, 10, 11, 12, 13].map((i) => zz(i, { signature: null })),
    zz(14, { recipients: [{ ...zz(14).recipients[0]!, address: '' }, zz(14).recipients[1]!] }),
    zz(15, { amount: 0 }),
  ]
  const partNumbers = () => [...screen.getByTestId('run-parts').querySelectorAll('[data-testid^="run-part-"] b')].map((b) => Number(b.textContent))

  it('step 1: the head, the three steps, the count line and the groups all count the same notices, and the foot has one press', async () => {
    renderWithProviders(<LienDeskRunModal notices={fifteen()} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByRole('heading', { name: 'Print and mail · 15 notices' })).toBeTruthy()
    // Envelopes are named as envelopes, once: 15 owners, and the contractor's twice, since a stopped notice's copy waits for the next packet.
    expect(screen.getByTestId('run-sub').textContent).toBe('30 copies in 17 envelopes · last day to mail Mon Nov 16')
    expect([1, 2, 3].map((n) => `${screen.getByTestId(`run-journey-${n}`).textContent} ${screen.getByTestId(`run-journey-${n}`).getAttribute('data-state')}`)).toEqual([
      '1Get them right8 of 15 are ready now',
      '2Print0 of 15 printed todo',
      '3Mail and record0 of 15 ready to record todo',
    ])
    expect(screen.getByTestId('run-parts').textContent).toBe('15 notices=8 ready5 wait on Sam’s signature2 held')
    // The parts add up to the total.
    expect(partNumbers().reduce((a, b) => a + b, 0)).toBe(Number(screen.getByTestId('run-parts-total').querySelector('b')!.textContent))
    // The groups, what is stopped first, each under a head with its count; the ready rows are folded while the run stands on what stops a notice.
    expect([...screen.getByTestId('run-check').querySelectorAll('.lienRunGroupHead')].map((h) => h.textContent)).toEqual([
      '▾Held · 2 notices$2,400',
      '▾Wait on Sam’s signature · 5 notices$10,500',
      '▸Ready · 8 notices$11,600',
    ])
    expect(screen.getByTestId('run-check-held-z14').textContent).toBe('Held · Owner of record: no mailing address')
    expect(screen.getByTestId('run-check-z9')).toBeTruthy()
    expect(screen.queryByTestId('run-check-z1')).toBeNull()
    fireEvent.click(screen.getByTestId('run-group-head-ready'))
    expect(screen.getByTestId('run-check-z1')).toBeTruthy()
    // A row that waits on the signature offers Signed ▸ before it prints: the packet will not print it unsigned.
    expect(screen.getByTestId('run-check-sign-z9').textContent).toBe('Signed ▸')
    // The foot: two lines, More, and one press. Everything else is under More, and the cards are folded.
    expect(screen.getByTestId('run-foot-status').textContent).toBe('8 can print now. 7 stay for the next packet.The packet prints with its checklist sheet, in envelope order: 9 envelopes.')
    expect([...screen.getByTestId('run-foot').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['More ▾', 'Print 8 notices'])
    expect(screen.getByTestId('run-cards-fold').getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('run-cards')).toBeNull()
    for (const id of ['run-combine', 'run-mark-printed', 'run-mark-signed', 'run-print-sheet', 'run-label-addresses']) expect(screen.queryByTestId(id)).toBeNull()
    fireEvent.click(screen.getByTestId('run-more'))
    expect([...screen.getByTestId('run-more-panel').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Mark 13 printed · 2 held ▸', 'Mark signed', 'Envelope faces', 'Addresses for the labels', 'Print the sheet'])
  })

  it('the press prints the ready notices, each whole: a waiting notice no longer keeps the contractor’s envelope out, and a number typed after reaches only what printed', async () => {
    printMock.mockClear()
    const printed: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={fifteen()} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { printed.push(ids) }} />)
    await settle()
    fireEvent.click(onePress())
    expect(printMock).toHaveBeenCalledTimes(1)
    const [html, filing] = printMock.mock.calls[0] as unknown as [string, { title: string; jobIds: string[] }]
    expect(filing.title).toBe('§ 53.056 notice packet · 8 notices')
    expect(filing.jobIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => `jz${i}`))
    // Nine envelopes go out, the contractor's among them with the eight ready notices inside; the eight that stay are listed in red.
    expect(html.match(/data-run-sheet-envelope="\d+"(?! data-run-held)/g)).toHaveLength(9)
    expect(html.match(/data-run-held="yes"/g)).toHaveLength(8)
    expect(html).toContain('<b>8 notices</b>')
    expect(printed).toEqual([[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `z${i}`)])
    // Step 3: the count is what printed, the stopped groups fold, and the press is the record, dead until a notice has every number.
    expect(screen.getByTestId('run-journey-2').textContent).toBe('✓Print8 of 15 printed')
    expect(screen.getByTestId('run-journey-3').textContent).toBe('3Mail and record0 of 9 numbers typed')
    expect(screen.getByTestId('run-parts').textContent).toBe('8 printed=8 owe a number')
    expect([...screen.getByTestId('run-check').querySelectorAll('.lienRunGroupHead')].map((h) => h.textContent)).toEqual([
      '▸Held · 2 notices$2,400',
      '▸Wait on Sam’s signature · 5 notices$10,500',
      '▾Printed · 8 notices · owe a number$11,600',
    ])
    expect(onePress().textContent).toBe('Record the mailing')
    expect(onePress().disabled).toBe(true)
    expect(screen.getByTestId('run-foot-status').textContent).toBe('9 envelopes owe a number.Type each from its green slip, or scan it with a phone.')
    // The contractor's number is the printed envelope's: every printed row takes it, and no waiting row does.
    fireEvent.change(screen.getByLabelText('1091 · ZZ Test Lot 1 — GC tracking'), { target: { value: NUMBER } })
    expect((screen.getByLabelText('1098 · ZZ Test Lot 8 — GC tracking') as HTMLInputElement).value).toBe(NUMBER)
    fireEvent.click(screen.getByTestId('run-group-head-wait'))
    expect((screen.getByLabelText('1099 · ZZ Test Lot 9 — GC tracking') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('run-journey-3').textContent).toBe('3Mail and record1 of 9 numbers typed')
    // One owner's number in, and one notice is ready: the press records it and the list under it names what stays, with why.
    fireEvent.change(screen.getByLabelText('1091 · ZZ Test Lot 1 — owner tracking'), { target: { value: '9407 1118 9876 5432 1001' } })
    expect(screen.getByTestId('run-parts').textContent).toBe('8 printed=1 ready to record7 owe a number')
    expect(onePress().textContent).toBe('Record 1 mailing')
    expect(screen.getByTestId('run-foot-status').textContent).toContain('1 is ready to record. 7 stay here until their numbers are typed.')
    const left = [...screen.getByTestId('run-held-list').querySelectorAll('li')].map((li) => li.textContent)
    expect(left).toHaveLength(14)
    expect(left).toContain('1092 · ZZ Test Lot 2 · no tracking number yet')
    expect(left).toContain('1099 · ZZ Test Lot 9 · waits on Sam’s signature')
    expect(left).toContain('1104 · ZZ Test Lot 14 · Owner of record: no mailing address')
    // Printing again is under More, and it names envelopes as envelopes.
    expect(more('run-print-again').textContent).toBe('Print it again · 9 envelopes')
  })

  it('a row stays in its group while its number is typed, and moves once the cursor leaves the box', async () => {
    const at = '2026-11-16T15:00:00Z'
    const one = zz(1, { printedAt: at, recipients: [{ ...zz(1).recipients[0]!, tracking: NUMBER }, zz(1).recipients[1]!] })
    renderWithProviders(<LienDeskRunModal notices={[one, zz(2, { printedAt: at })]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    const box = screen.getByLabelText('1091 · ZZ Test Lot 1 — GC tracking') as HTMLInputElement
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: '9407 1118 9876 5432 1002' } })
    // The count is live; the row has not jumped out from under the cursor.
    expect(screen.getByTestId('run-parts').textContent).toBe('2 printed=1 ready to record1 owes a number')
    expect(screen.queryByTestId('run-group-record')).toBeNull()
    expect(screen.getByTestId('run-group-owe').contains(screen.getByTestId('run-check-z1'))).toBe(true)
    fireEvent.blur(screen.getByLabelText('1091 · ZZ Test Lot 1 — GC tracking'))
    expect(screen.getByTestId('run-group-record').contains(screen.getByTestId('run-check-z1'))).toBe(true)
    expect(screen.getByTestId('run-group-owe').contains(screen.getByTestId('run-check-z2'))).toBe(true)
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

  it('a file that did not go up keeps its reason under the row, and Try again sends the same file (v2.7635); a refusal has no second try', async () => {
    cleanup()
    const sent: File[] = []
    let calls = 0
    const addMailedCopy = vi.fn(async (a: { file: File }) => {
      sent.push(a.file)
      calls += 1
      if (calls === 1) throw new AddFileFailure('The app could not reach Drive.', true)
      if (calls === 2) throw new AddFileFailure('Drive did not take the file. Drive said: quota exceeded.', false)
      return []
    })
    renderWithProviders(<LienDeskRunModal notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z' })]} issuer={null} todayYmd="2026-10-08" userId="u1" onClose={() => {}} onRecorded={() => {}} addMailedCopy={addMailedCopy as never} />)
    await settle()
    const file = scan()
    fireEvent.change(screen.getByTestId('run-check-copy-file-it1'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByTestId('run-check-copy-failed-it1').textContent).toContain('The app could not reach Drive.'))
    fireEvent.click(screen.getByTestId('run-check-copy-retry-it1'))
    // The second try met a refusal: its reason replaces the first, and the press is gone.
    await waitFor(() => expect(screen.getByTestId('run-check-copy-failed-it1').textContent).toContain('Drive said: quota exceeded.'))
    expect(screen.queryByTestId('run-check-copy-retry-it1')).toBeNull()
    expect(sent).toHaveLength(2)
    expect(sent[1]).toBe(file)
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).toBeNull()
  })

  it('Take off (v2.7525): the notice forgets the file after the ask, the row stops listing it, the file goes to Drive’s trash, and Put it back lists it again (v2.7699)', async () => {
    cleanup()
    const removed: Array<{ itemId: string; driveFileId: string }> = []
    const trashed: Array<{ jobId: string; id: string | null }> = []
    const untrashed: Array<{ jobId: string; id: string }> = []
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
        trashFile={async (jobId, id) => {
          trashed.push({ jobId, id })
          return { where: 'trash' }
        }}
        untrashFile={async (jobId, id) => {
          untrashed.push({ jobId, id })
          return { url: kept.url }
        }}
        restoreMailedCopy={async (a) => [a.copy]}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-check-copy-off-it1-0'))
    expect(removed).toEqual([])
    expect(screen.getByTestId('run-check-copy-ask-it1').textContent).toContain('The file goes to Drive’s trash. Drive keeps it there 30 days.')
    fireEvent.click(screen.getByTestId('run-check-copy-off-yes-it1'))
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')).toBeNull())
    expect(removed).toEqual([{ itemId: 'it1', driveFileId: 'f1' }])
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add what was mailed')
    // The link came off first; then the file went to Drive's trash, and the line under the row says so (v2.7699).
    await waitFor(() => expect(screen.getByTestId('run-check-copy-off-line-it1').textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(trashed).toHaveLength(1)
    expect(trashed[0]?.id).toBe('f1')
    expect(document.body.textContent).toContain(`Took ${kept.name} off this notice. The file is in Drive’s trash.`)
    expect(onRecorded).toHaveBeenCalledTimes(1)
    // Put it back: out of the trash, listed on the notice again, and the line is gone.
    fireEvent.click(screen.getByTestId('run-check-copy-put-back-it1'))
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')?.textContent).toContain(kept.name))
    expect(untrashed).toHaveLength(1)
    expect(untrashed[0]?.id).toBe('f1')
    expect(screen.queryByTestId('run-check-copy-off-line-it1')).toBeNull()
    expect(document.body.textContent).toContain(`Put ${kept.name} back on this notice.`)
    expect(onRecorded).toHaveBeenCalledTimes(2)
  })

  it('a file Drive would not trash stays, with its reason; Try again sends it again, and Put it back needs no trash to empty (v2.7699)', async () => {
    cleanup()
    let asks = 0
    const untrash = vi.fn(async () => ({ url: kept.url }))
    renderWithProviders(
      <LienDeskRunModal
        notices={[notice({ printedAt: '2026-10-07T15:00:00.000Z', mailedCopies: [kept] })]}
        issuer={null}
        todayYmd="2026-10-09"
        userId="u1"
        onClose={() => {}}
        onRecorded={() => {}}
        removeMailedCopy={async () => []}
        trashFile={async () => {
          asks += 1
          return asks === 1 ? { where: 'drive', why: 'Drive did not move the file to its trash. Drive said: Error 503 (Service Unavailable)', retry: true } : { where: 'drive', why: 'A lien record still uses it.', retry: false }
        }}
        untrashFile={untrash}
        restoreMailedCopy={async (a) => [a.copy]}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTestId('run-check-copy-off-it1-0'))
    fireEvent.click(screen.getByTestId('run-check-copy-off-yes-it1'))
    await waitFor(() => expect(screen.getByTestId('run-check-copy-off-line-it1').textContent).toContain('Taken off. The file stays in Drive. Drive did not move the file to its trash.'))
    fireEvent.click(screen.getByTestId('run-check-copy-trash-again-it1'))
    // The second try met a refusal a third cannot fix: the reason changes and the press is gone.
    await waitFor(() => expect(screen.getByTestId('run-check-copy-off-line-it1').textContent).toContain('A lien record still uses it.'))
    expect(screen.queryByTestId('run-check-copy-trash-again-it1')).toBeNull()
    expect(asks).toBe(2)
    fireEvent.click(screen.getByTestId('run-check-copy-put-back-it1'))
    await waitFor(() => expect(screen.getByTestId('run-check-copies-it1').querySelector('a')?.textContent).toContain(kept.name))
    // The file never left the folder, so nothing is asked of Drive's trash.
    expect(untrash).not.toHaveBeenCalled()
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

describe('LienDeskRunModal · un-print one notice from its own row (v2.7481)', () => {
  const at = '2026-11-16T15:00:00Z'
  const four = () =>
    [372, 373, 374, 375].map((num, i) =>
      notice({
        itemId: `u${num}`,
        jobId: `ju${num}`,
        label: `${num} · ZZ Test Lot ${i + 1}`,
        jobNumber: String(num),
        printedAt: at,
        printedBy: 'ZZ Office',
        recipients: [
          { key: 'owner', label: 'Owner of record', name: `ZZ Test Owner ${num} LLC`, address: `${num} Sample Rd, Sampleton, TX 78000`, email: '', method: 'certified_mail', tracking: '' },
          { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Test Builders', address: '100 Example Pkwy, Sampleton, TX 78000', email: '', method: 'certified_mail', tracking: '' },
        ],
      }),
    )

  it('the Printed tick is a press that asks first, takes back that notice alone, and the count, the journey and the press follow', async () => {
    const taken: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={four()} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    expect(screen.getByTestId('run-parts').textContent).toBe('4 printed=4 owe a number')
    // Her row had its numbers typed. The contractor's is the shared envelope's, so every printed row shows it.
    fireEvent.change(screen.getByLabelText('372 · ZZ Test Lot 1 — owner tracking'), { target: { value: NUMBER } })
    fireEvent.change(screen.getByLabelText('372 · ZZ Test Lot 1 — GC tracking'), { target: { value: '9407 1118 9876 5432 1111' } })
    // The tick keeps its words and is a press now.
    expect(screen.getByTestId('run-check-printed-u372').textContent).toBe('✓ Nov 16 · ZZ Office')
    const tick = screen.getByTestId('run-check-unprint-u372') as HTMLButtonElement
    expect(tick.textContent).toBe('✓ Nov 16 · ZZ Office · Undo…')
    fireEvent.click(tick)
    const confirm = screen.getByTestId('run-take-back-one-confirm')
    expect(confirm.textContent).toContain('Put 372 back in Approved · to print?')
    expect(confirm.textContent).toContain('372 · ZZ Test Lot 1. Use this when it did not print, or was not mailed.')
    expect(confirm.textContent).toContain('The notice goes back to Approved · to print. The approval stands.')
    expect(confirm.textContent).toContain('A copy that printed here Nov 16 stays in the job’s Documents, filed as printed.')
    expect(confirm.textContent).toContain('The 2 tracking numbers typed on this row are not saved.')
    expect(confirm.textContent).toContain('The other notices in this run stay as they are.')
    // Asking writes nothing, and Esc or Keep it printed closes the question alone.
    expect(taken).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Keep it printed' }))
    expect(screen.queryByTestId('run-take-back-one-confirm')).toBeNull()
    fireEvent.click(screen.getByTestId('run-check-unprint-u372'))
    expect(screen.getByTestId('run-take-back-one-yes').textContent).toBe('Put 372 back in Approved · to print')
    fireEvent.click(screen.getByTestId('run-take-back-one-yes'))
    await settle()
    // One id, not the four the run's own take-back would have taken.
    expect(taken).toEqual([['u372']])
    expect(screen.queryByTestId('run-take-back-one-confirm')).toBeNull()
    expect(screen.getByTestId('run-taken-back').textContent).toBe('Taken back. 372 is in Approved · to print again. Its approval stands.')
    // It is back in the ready part, in the same sitting: the count line, the journey and the one press say so.
    expect(screen.getByTestId('run-parts').textContent).toBe('4 notices=1 ready3 printed')
    expect(screen.getByTestId('run-journey-2').textContent).toBe('2Print3 of 4 printed')
    expect(screen.getByTestId('run-journey-2').getAttribute('data-state')).toBe('now')
    expect(screen.getByTestId('run-group-ready').contains(screen.getByTestId('run-check-u372'))).toBe(true)
    expect(screen.getByTestId('run-check-line-u372').textContent).toBe('not printed')
    expect(screen.getByTestId('run-check-mark-printed-u372').textContent).toBe('Printed ▸')
    expect(onePress().textContent).toBe('Print 1 notice')
    expect(screen.getByRole('heading', { name: 'Print and mail · 4 notices' })).toBeTruthy()
    // Its numbers are dropped; the three still printed keep the contractor's.
    expect((screen.getByLabelText('372 · ZZ Test Lot 1 — owner tracking') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('372 · ZZ Test Lot 1 — GC tracking') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('373 · ZZ Test Lot 2 — GC tracking') as HTMLInputElement).value).toBe('9407 1118 9876 5432 1111')
    expect(screen.getByTestId('run-check-unprint-u373')).toBeTruthy()
    // The run's own take-back is still under More, for the three that printed.
    fireEvent.click(more('run-take-back'))
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('Take back the 3 notices that printed?')
  })

  it('Printed ▸ pressed by accident: a short Undo follows, waits for the desk’s stamp, and takes back that row alone', async () => {
    const calls: string[] = []
    let land: () => void = () => {}
    const stamped = new Promise<void>((resolve) => { land = resolve })
    const two = four().slice(0, 2).map((n) => ({ ...n, printedAt: null, printedBy: null }))
    renderWithProviders(
      <LienDeskRunModal notices={two} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { calls.push(`printed ${ids.join(',')}`); return stamped }} onTakeBack={async (ids) => { calls.push(`back ${ids.join(',')}`); return ids.length }} />,
    )
    await settle()
    expect(screen.queryByTestId('run-marked-undo')).toBeNull()
    fireEvent.click(screen.getByTestId('run-check-mark-printed-u372'))
    expect(screen.getByTestId('run-parts').textContent).toBe('2 notices=1 ready1 printed')
    const strip = screen.getByTestId('run-marked-undo')
    expect(strip.textContent).toContain('372 is marked printed. Pressed it by mistake?')
    expect(screen.getByTestId('run-marked-undo-go').textContent).toBe('Undo the Printed mark')
    fireEvent.click(screen.getByTestId('run-marked-undo-go'))
    await settle()
    // The mark's stamp is still on its way to the desk: the take-back waits, so it does not find the row unprinted.
    expect(calls).toEqual(['printed u372'])
    await act(async () => { land() })
    await waitFor(() => expect(calls).toEqual(['printed u372', 'back u372']))
    await waitFor(() => expect(screen.queryByTestId('run-marked-undo')).toBeNull())
    expect(screen.getByTestId('run-parts').textContent).toBe('2 notices=2 ready')
    expect(screen.getByTestId('run-check-mark-printed-u372').textContent).toBe('Printed ▸')
    expect(onePress().textContent).toBe('Print 2 notices')
  })

  it('a signed notice: the confirm says its signature comes off, and after the take-back the row waits on the signature again', async () => {
    const taken: string[][] = []
    const sam = { userId: 'u-sam', name: 'Sam' }
    const sig = { mode: 'type', printedName: 'Sam Sample', pngDataUrl: null, signedAtIso: '2026-11-12T19:14:00Z' } as unknown as RunNotice['signature']
    const signedFour = four().map((n) => ({ ...n, signature: sig, leader: sam }))
    renderWithProviders(<LienDeskRunModal notices={signedFour} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    expect(screen.getByTestId('run-check-signed-u372').textContent).toBe('✓ typed · Nov 12')
    fireEvent.click(screen.getByTestId('run-check-unprint-u372'))
    const lines = [...screen.getByTestId('run-take-back-one-confirm').querySelectorAll('li')].map((li) => li.textContent)
    expect(lines).toEqual([
      'The notice goes back to Approved · to print. The approval stands.',
      'Its signature comes off. The leader signs it again before it prints.',
      'A copy that printed here Nov 16 stays in the job’s Documents, filed as printed.',
      'The other notices in this run stay as they are.',
    ])
    fireEvent.click(screen.getByTestId('run-take-back-one-yes'))
    await settle()
    expect(taken).toEqual([['u372']])
    expect(screen.getByTestId('run-taken-back').textContent).toBe('Taken back. 372 is in Approved · to print again. The leader signs it again. Then print the packet.')
    // The window drops the signature with the desk: the row is not ready, it waits on the signature, and nothing can print.
    expect(screen.getByTestId('run-parts').textContent).toBe('3 printed=3 owe a number')
    expect(screen.getByTestId('run-journey-1').textContent).toBe('✓Get them right3 of 4 were ready')
    fireEvent.click(screen.getByTestId('run-group-head-wait'))
    expect(screen.getByTestId('run-group-wait').contains(screen.getByTestId('run-check-u372'))).toBe(true)
    expect(screen.getByTestId('run-check-sign-u372').textContent).toBe('Signed ▸')
    expect(onePress().getAttribute('data-act')).toBe('record')
    // The three still printed keep their signatures.
    expect(screen.getByTestId('run-check-signed-u373').textContent).toBe('✓ typed · Nov 12')
  })

  it('Printed ▸ by accident on a signed notice: the Undo asks first, because the signature comes off', async () => {
    const taken: string[][] = []
    const sig = { mode: 'type', printedName: 'Sam Sample', pngDataUrl: null, signedAtIso: '2026-11-12T19:14:00Z' } as unknown as RunNotice['signature']
    const two = four().slice(0, 2).map((n) => ({ ...n, printedAt: null, printedBy: null, signature: sig, leader: { userId: 'u-sam', name: 'Sam' } }))
    renderWithProviders(<LienDeskRunModal notices={two} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => { taken.push(ids); return ids.length }} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-check-mark-printed-u372'))
    expect(screen.getByTestId('run-marked-undo-go').textContent).toBe('Undo the Printed mark…')
    fireEvent.click(screen.getByTestId('run-marked-undo-go'))
    // One press does not take a signature off: the question comes up, and nothing is written yet.
    expect(taken).toEqual([])
    expect(screen.getByTestId('run-take-back-one-confirm').textContent).toContain('Its signature comes off. The leader signs it again before it prints.')
    fireEvent.click(screen.getByRole('button', { name: 'Keep it printed' }))
    expect(taken).toEqual([])
    expect(screen.getByTestId('run-check-printed-u372')).toBeTruthy()
  })

  it('the Undo goes once a number is typed on the row, and the row’s own press still asks; a host with no take-back offers neither', async () => {
    const two = () => four().slice(0, 2).map((n) => ({ ...n, printedAt: null, printedBy: null }))
    const view = renderWithProviders(<LienDeskRunModal notices={two()} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} onTakeBack={async (ids) => ids.length} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-check-mark-printed-u372'))
    expect(screen.getByTestId('run-marked-undo')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('372 · ZZ Test Lot 1 — owner tracking'), { target: { value: NUMBER } })
    expect(screen.queryByTestId('run-marked-undo')).toBeNull()
    fireEvent.click(screen.getByTestId('run-check-unprint-u372'))
    expect(screen.getByTestId('run-take-back-one-confirm').textContent).toContain('The tracking number typed on this row is not saved.')
    // Esc closes the question, not the run.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('run-take-back-one-confirm')).toBeNull()
    view.unmount()
    renderWithProviders(<LienDeskRunModal notices={two()} issuer={null} todayYmd="2026-11-16" userId="u1" viewer={{ userId: 'u-office', name: 'ZZ Office' }} onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-check-mark-printed-u372'))
    expect(screen.queryByTestId('run-marked-undo')).toBeNull()
    expect(screen.queryByTestId('run-check-unprint-u372')).toBeNull()
    expect(screen.getByTestId('run-check-printed-u372').textContent).toMatch(/^✓ \w{3} \d{1,2} · ZZ Office$/)
  })
})

describe('LienDeskRunModal · which paper the run holds, and the street beside a job’s name (v2.7489)', () => {
  it('the head names the paper and the stage and says what is not here; the ? says where the affidavits print', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-what').textContent).toBe('Monthly notices (§ 53.056), approved and not yet mailed. A job whose notice already went is not here. Lien affidavits are not here either.')
    expect(screen.queryByTestId('run-explainer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'What the packet is' }))
    expect(screen.getByTestId('run-explainer').textContent).toContain('Lien affidavits print from the Board, with Print N for notarization. Their copies to the owner and the original contractor go out after the filing.')
  })

  it('a retainage notice in the run is named beside the monthly ones', async () => {
    renderWithProviders(<LienDeskRunModal notices={[notice(), notice({ itemId: 'r1', jobId: 'j700', label: '700 · ZZ Test Tower', jobNumber: '700', kind: 'retainage_53_057' })]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-what').textContent).toContain('Monthly notices (§ 53.056) and retainage notices (§ 53.057), approved and not yet mailed.')
  })

  it('two jobs at one address read as two at that address: the street shows on the row and on the envelope’s copy line, and not where the name says it', async () => {
    const gc = { key: 'original_contractor' as const, label: 'Original contractor', name: 'ZZ Test Builders', address: '100 Example Pkwy, Sampleton, TX 78000', email: '', method: 'certified_mail' as const, tracking: '' }
    const owner = { key: 'owner' as const, label: 'Owner of record', name: 'ZZ Test Kettle LLC', address: '9 Owner Way, Sampleton, TX 78000', email: '', method: 'certified_mail' as const, tracking: '' }
    const a = notice({ itemId: 'k1', jobId: 'jk1', label: '401 · ZZ Test Kettle shop', jobNumber: '401', propertyId: 'p1', street: '212 Kettle Dr', recipients: [owner, gc] })
    const b = notice({ itemId: 'k2', jobId: 'jk2', label: '402 · ZZ Test 212 Kettle Dr, phase 2', jobNumber: '402', propertyId: 'p1', street: '', recipients: [owner, gc] })
    renderRun(<LienDeskRunModal notices={[a, b]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.getByTestId('run-check-street-k1').textContent).toBe(' · 212 Kettle Dr')
    expect(screen.getByTestId('run-check-k1').querySelector('b')!.textContent).toBe('401 · ZZ Test Kettle shop · 212 Kettle Dr')
    expect(screen.queryByTestId('run-check-street-k2')).toBeNull()
    // The contractor's envelope lists both jobs, the first with its street.
    expect(screen.getByTestId('run-row-jk1-original_contractor').textContent).toContain('401 · ZZ Test Kettle shop · 212 Kettle Dr')
    expect(screen.getByTestId('run-row-jk2-original_contractor').textContent).toContain('402 · ZZ Test 212 Kettle Dr, phase 2')
    expect(screen.getByTestId('run-row-jk2-original_contractor').textContent).not.toContain('phase 2 · 212 Kettle Dr')
  })
})

describe('LienDeskRunModal · the envelope says where the other jobs at its properties stand (v2.7559)', () => {
  const gc = { key: 'original_contractor' as const, label: 'Original contractor', name: 'ZZ Test Builders', address: '100 Example Pkwy, Sampleton, TX 78000', email: '', method: 'certified_mail' as const, tracking: '' }
  const ownerAt = (name: string, address: string) => ({ key: 'owner' as const, label: 'Owner of record', name, address, email: '', method: 'certified_mail' as const, tracking: '' })
  const sent = (day: string) => lienPropertyNoticeLine({ isSub: true, pile: 'sent', noticed: true, sentOn: [day] })
  const going = lienPropertyNoticeLine({ isSub: true, pile: 'ready', noticed: false, sentOn: [] })
  const aff = (pile: 'ready' | 'needs_notice') => lienPropertyAffidavitLine({ pile, gateHeld: false, missing: [] })
  const properties = new Map<string, LienRunProperty>([
    ['p1', { addressId: 'p1', street: '212 Kettle Dr', jobs: [{ jobId: 'jk1', notice: going, affidavit: aff('needs_notice') }, { jobId: 'jk8', notice: sent('2026-10-14'), affidavit: aff('ready') }, { jobId: 'jk9', notice: sent('2026-10-14'), affidavit: aff('ready') }] }],
    ['p2', { addressId: 'p2', street: '9 Example St', jobs: [{ jobId: 'jm1', notice: going, affidavit: aff('needs_notice') }, { jobId: 'jm7', notice: sent('2026-09-22'), affidavit: aff('ready') }] }],
    ['p3', { addressId: 'p3', street: '5 Alone Ct', jobs: [{ jobId: 'js1', notice: going, affidavit: aff('needs_notice') }] }],
  ])
  const a = () => notice({ itemId: 'k1', jobId: 'jk1', label: '401 · ZZ Test Kettle shop', jobNumber: '401', propertyId: 'p1', recipients: [ownerAt('ZZ Test Kettle LLC', '9 Owner Way, Sampleton, TX 78000'), gc] })
  const b = () => notice({ itemId: 'm1', jobId: 'jm1', label: '502 · ZZ Test Mill', jobNumber: '502', propertyId: 'p2', recipients: [ownerAt('ZZ Test Mill LLC', '4 Mill Rd, Sampleton, TX 78000'), gc] })
  const c = () => notice({ itemId: 's1', jobId: 'js1', label: '603 · ZZ Test Solo', jobNumber: '603', propertyId: 'p3', recipients: [ownerAt('ZZ Test Solo LLC', '5 Alone Ct, Sampleton, TX 78000'), gc] })
  const envelopeOf = (name: string) => screen.getAllByTestId(/^run-envelope-\d+$/).find((el) => el.textContent?.includes(name))!
  const lineIn = (name: string) => envelopeOf(name).querySelector('[data-testid^="run-property-"]:not(button)') as HTMLElement | null

  it('an owner’s envelope with one job says the other jobs’ notices went, and counts the property’s liens', async () => {
    const onOpenProperty = vi.fn()
    renderRun(<LienDeskRunModal notices={[a(), b(), c()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} properties={properties} onOpenProperty={onOpenProperty} />)
    await settle()
    const line = lineIn('ZZ Test Kettle LLC')!
    expect(line.firstElementChild!.textContent).toBe('At this property: 1 notice in this envelope · 2 notices sent Oct 14 · 2 lien affidavits ready to file')
    expect([...line.querySelectorAll('button')].map((x) => x.textContent)).toEqual(['See the property ›'])
    fireEvent.click(line.querySelector('button')!)
    expect(onOpenProperty).toHaveBeenCalledWith('p1')
  })

  it('the contractor’s envelope spans the properties: one line that totals them, and a press a property', async () => {
    const onOpenProperty = vi.fn()
    renderRun(<LienDeskRunModal notices={[a(), b(), c()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} properties={properties} onOpenProperty={onOpenProperty} />)
    await settle()
    const line = lineIn('ZZ Test Builders')!
    expect(line.firstElementChild!.textContent).toBe('At these 3 properties: 3 notices in this envelope · 2 notices sent Oct 14 · 1 on Sep 22 · 3 lien affidavits ready to file')
    expect([...line.querySelectorAll('button')].map((x) => x.textContent)).toEqual(['See 212 Kettle Dr ›', 'See 9 Example St ›', 'See 5 Alone Ct ›'])
    fireEvent.click(screen.getByText('See 9 Example St ›'))
    expect(onOpenProperty).toHaveBeenCalledWith('p2')
  })

  it('an envelope whose property has no other job says nothing more, and a host with no desk in hand draws no line at all', async () => {
    const first = renderRun(<LienDeskRunModal notices={[a(), c()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} properties={properties} onOpenProperty={() => {}} />)
    await settle()
    expect(lineIn('ZZ Test Solo LLC')).toBeNull()
    expect(lineIn('ZZ Test Kettle LLC')).not.toBeNull()
    first.unmount()
    renderRun(<LienDeskRunModal notices={[a(), c()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(lineIn('ZZ Test Kettle LLC')).toBeNull()
  })

  it('with no way to open a property the line is words alone', async () => {
    renderRun(<LienDeskRunModal notices={[a()]} issuer={null} todayYmd="2026-11-16" userId="u1" onClose={() => {}} onRecorded={() => {}} properties={properties} />)
    await settle()
    const line = lineIn('ZZ Test Kettle LLC')!
    expect(line.textContent).toBe('At this property: 1 notice in this envelope · 2 notices sent Oct 14 · 2 lien affidavits ready to file')
    expect(line.querySelector('button')).toBeNull()
  })
})
