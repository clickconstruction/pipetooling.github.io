// @vitest-environment jsdom
/**
 * The run window's packet and `lienRunReadyPacket` are the same paper (punch list #362, step 6).
 *
 * The checklist's one print builds the notices' packet with no window open. A notice is a legal paper, so the two
 * builds may not part: this prints from the window and from the kernel with the same notices, the same day and the
 * same enclosed bill, and compares the documents whole, with how each is filed and which items each stamps printed.
 * A change to the window's packet that the kernel does not follow fails here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskRunModal from './LienDeskRunModal'
import { useLienRunEnclosures } from './useLienRunEnclosures'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'
import { lienRunGuideCode } from '../../lib/jobs/lienHelpGuideCode'
import { lienRunReadyPacket } from '../../lib/jobs/lienRunPacket'
import { lienPrintSnapshotPapers } from '../../lib/jobs/lienPrintSworn'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { fetchStripeInvoiceFacts } from '../../lib/stripeInvoiceFacts'

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
vi.mock('../../lib/jobs/lienDeskSignIo', () => ({
  signLienDeskItem: async () => ({ ok: true as const, signedAtIso: '2026-10-09T19:14:00Z' }),
  lienSignCodeStatus: async () => null,
  signLienDeskItemWithCode: async () => ({ ok: true }),
}))
vi.mock('../../lib/jobs/lienDeskRunIo', () => ({ recordLienDeskRun: vi.fn(async () => ({ recorded: [], failed: [], releaseFailed: [], courtesySent: [], courtesyFailed: [] })), buildRunNoticePdf: vi.fn(async () => new Blob(['%PDF-1.4'])) }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async () => null) }))
const docsmitState = { settings: { env: 'tracksmit', paused: false, runDefault: 'docsmit', returnReceipt: 'electronic', plusDefault: false, cutoffLocal: '15:00', sendByBufferDays: 1, creditWarn: 25, pollMinutes: 60, callbacks: false, matchSite: false }, setUp: false, loaded: true }
vi.mock('../../hooks/useDocsmitSettings', () => ({ useDocsmitSettings: () => docsmitState }))
vi.mock('../../lib/stripeInvoiceFacts', () => ({ fetchStripeInvoiceFacts: vi.fn(async () => ({})) }))
// The pay codes are drawn from an image the test page cannot load: a stand-in code a bill, so the pay page is in the packet too.
vi.mock('../../lib/jobs/lienNoticePayPageAssets', () => ({
  buildPayPageAssets: async (rows: ReadonlyArray<{ invoiceId: string; payable: boolean }>) => Object.fromEntries(rows.filter((r) => r.payable).map((r) => [r.invoiceId, { svg: `<svg data-pay-code="${r.invoiceId}"></svg>`, png: null }])),
}))

afterEach(() => {
  cleanup()
  printMock.mockClear()
})

const FIELDS = { noticeDate: '2026-09-14', projectDescription: 'ZZ Sample Shop, 12 Sample Rd', claimantName: 'ZZ Plumbing', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'ZZ Builder', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Rosa', claimantAddress: '1 Sample St, Sample, TX 78000' }

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j1',
    kind: 'notice_53_056',
    label: '1001 · ZZ Sample Shop',
    jobNumber: '1001',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: FIELDS,
    extras: { refItems: ['Job #1001'] },
    coverLetter: null,
    coverNote: 'This is a routine notice.',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'ZZ Holdings LLC', address: '4 Example Way, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Builder', address: '29 Example Cir, Sample, TX 78000', email: 'office@zzbuilder.test', method: 'certified_mail', tracking: '' },
    ],
    ...partial,
  } as RunNotice
}

/** Four notices, one in each state the packet treats differently, two of them to the same contractor. */
function run(): RunNotice[] {
  return [
    notice(),
    // Ready, another job, the same original contractor: its copy shares his envelope.
    notice({ itemId: 'it2', jobId: 'j2', label: '1002 · ZZ Second Shop', jobNumber: '1002', amount: 4_200, fields: { ...FIELDS, projectDescription: 'ZZ Second Shop, 14 Sample Rd', claimAmount: '4200.00' }, extras: { refItems: ['Job #1002'] }, recipients: [{ key: 'owner', label: 'Owner of record', name: 'ZZ Second Owner LP', address: '6 Example Way, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' }, { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Builder', address: '29 Example Cir, Sample, TX 78000', email: 'office@zzbuilder.test', method: 'certified_mail', tracking: '' }] }),
    // Held: the owner is not confirmed. It prints nothing, and the sheet lists it in red.
    notice({ itemId: 'it3', jobId: 'j3', label: '1003 · ZZ Held Shop', jobNumber: '1003', amount: 900, ownerUnconfirmed: true, fields: { ...FIELDS, projectDescription: 'ZZ Held Shop, 16 Sample Rd', claimAmount: '900.00' } }),
    // Waits on the leader's signature.
    notice({ itemId: 'it4', jobId: 'j4', label: '1004 · ZZ Unsigned Shop', jobNumber: '1004', amount: 1_100, signature: null, fields: { ...FIELDS, projectDescription: 'ZZ Unsigned Shop, 18 Sample Rd', claimAmount: '1100.00' } }),
    // Printed before this sitting: in the run, not in this packet.
    notice({ itemId: 'it5', jobId: 'j5', label: '1005 · ZZ Printed Shop', jobNumber: '1005', amount: 2_300, printedAt: '2026-09-12T15:00:00Z', fields: { ...FIELDS, projectDescription: 'ZZ Printed Shop, 20 Sample Rd', claimAmount: '2300.00' } }),
  ]
}

/** The first job has one unpaid Stripe bill, so its notice encloses an invoice. */
function withABill() {
  const bill = { id: 'inv-1', amount: 15200, sequence_order: 0, status: 'billed', billed_at: '2026-09-10T14:00:00Z', created_at: '2026-09-10T13:59:00Z', sent_to_customer_at: null, estimated_bill_date: null, stripe_invoice_id: 'in_1', stripe_invoice_memo: 'Paper checks can be sent to: ZZ Plumbing', external_send_note: '', stripe_invoice_footer: null }
  vi.mocked(fetchJobWithDetailsById).mockImplementation(async (id: string) => (id === 'j1' ? ({ id: 'j1', hcp_number: '1001', job_name: 'ZZ Sample Shop', job_address: '12 Sample Rd', customer_name: 'ZZ Builder', customer_email: '', customer_id: 'c1', gc_customer_id: null, bill_to_party: 'customer', fixtures: [], materials: [], payments: [], invoices: [bill] } as never) : null))
  vi.mocked(fetchStripeInvoiceFacts).mockResolvedValue({ 'inv-1': { invoiceNumber: '1001-2609101138', dueYmd: '2026-10-10', lines: [] } } as never)
}

describe('the run window and lienRunReadyPacket print the same packet', () => {
  it('the same notices, day and enclosed bill give the same document, the same filing and the same printed stamps', async () => {
    withABill()
    const notices = run()
    const stamped: string[][] = []
    renderWithProviders(<LienDeskRunModal notices={notices} issuer={null} todayYmd="2026-09-14" userId="u1" stripeMode="live" onClose={() => {}} onRecorded={() => {}} onPrinted={(ids) => { stamped.push(ids) }} />)
    await settle()
    await settle()
    const press = screen.getByTestId('run-press') as HTMLButtonElement
    expect(press.getAttribute('data-act')).toBe('print')
    fireEvent.click(press)
    await settle()
    expect(printMock).toHaveBeenCalledTimes(1)
    const [windowHtml, windowFiling] = printMock.mock.calls[0] as unknown as [string, { kind: string; title: string; jobIds: string[] }]

    const hook = renderHook(() => useLienRunEnclosures(notices, 'live'))
    await waitFor(() => expect(hook.result.current.read).toBe(true))
    const packet = lienRunReadyPacket({ notices, todayYmd: '2026-09-14', issuer: null, enclosures: hook.result.current, guideCode: lienRunGuideCode() })
    expect(packet).not.toBeNull()

    // The enclosed bill is in the packet, so the comparison covers the enclosures too.
    expect(windowHtml).toContain('1001-2609101138')
    expect(windowHtml).toContain('data-pay-code="inv-1"')
    expect(packet!.html).toBe(windowHtml)
    // The whole filing, what each notice said at print with it (step 7): one window's snapshot is the other's.
    expect(packet!.filing).toEqual(windowFiling)
    expect(packet!.filing).toMatchObject({ kind: 'lien_notice_packet', title: '§ 53.056 notice packet · 2 notices', jobIds: ['j1', 'j2'] })
    expect(lienPrintSnapshotPapers(packet!.filing.sourceSnapshot).map((p) => [p.kind, p.jobIds, p.itemIds])).toEqual([['notice', ['j1'], [packet!.notices[0]!.itemId]], ['notice', ['j2'], [packet!.notices[1]!.itemId]]])
    expect(stamped).toEqual([packet!.stampIds])
    expect(packet!.stampIds).toEqual(['it1', 'it2'])
    // What stayed out is on the sheet with its reason, in both.
    expect(packet!.held.length).toBeGreaterThan(0)
    expect(windowHtml).toContain('ZZ Held Shop')
  })

  it('with no enclosure read the two still agree, and a run with nothing ready prints from neither', async () => {
    vi.mocked(fetchJobWithDetailsById).mockImplementation(async () => null)
    const notices = run()
    renderWithProviders(<LienDeskRunModal notices={notices} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByTestId('run-press'))
    await settle()
    const [windowHtml] = printMock.mock.calls[0] as unknown as [string]
    const packet = lienRunReadyPacket({ notices, todayYmd: '2026-09-14', issuer: null, enclosures: { invoiceDocsByJob: {}, payByJob: {} }, guideCode: lienRunGuideCode() })
    expect(packet!.html).toBe(windowHtml)

    const stopped = run().slice(2)
    expect(lienRunReadyPacket({ notices: stopped, todayYmd: '2026-09-14', issuer: null, enclosures: { invoiceDocsByJob: {}, payByJob: {} } })).toBeNull()
  })
})
