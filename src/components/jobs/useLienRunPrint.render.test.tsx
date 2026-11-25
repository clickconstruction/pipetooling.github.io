// @vitest-environment jsdom
/**
 * The hook behind the run's one print (punch list #362, step 6): what it reads and when, what the press prints, how
 * each paper is filed, which notices it stamps printed, and what it does where one print job cannot hold both papers.
 * The plan and the words are `lienRunPrint.test.ts`; the document is `lienRunStack.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { LienAffidavitFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { lienAffidavitPrintRun } from '../../lib/jobs/lienAffidavitBatch'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'
import type { LienGetItRight, LienRunLine } from '../../lib/jobs/lienGetItRight'
import { lienPrintSnapshotPapers } from '../../lib/jobs/lienPrintSworn'
import { LIEN_STACK_CLASS } from '../../lib/jobs/lienRunStack'
import { useLienRunPrint, type LienRunPrintHookInput } from './useLienRunPrint'

const toastMock = vi.fn()
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: toastMock }) }))
const openMock = vi.fn((_html: string) => true)
vi.mock('../../lib/jobsDocuments/printWindow', () => ({ openHtmlPrintWindow: (html: string) => openMock(html) }))
const fileMock = vi.fn(async (_filing: unknown, _body: unknown) => true)
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy: (filing: unknown, body: unknown) => fileMock(filing, body) }))
const stampMock = vi.fn(async (_ids: ReadonlyArray<string>, _userId: string | null) => {})
vi.mock('../../lib/jobs/lienDeskIo', () => ({ markLienDeskItemsPrinted: (ids: ReadonlyArray<string>, userId: string | null) => stampMock(ids, userId) }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async () => null) }))
vi.mock('../../lib/stripeInvoiceFacts', () => ({ fetchStripeInvoiceFacts: vi.fn(async () => ({})) }))

const NF = { noticeDate: '2026-11-15', projectDescription: 'ZZ Sample Shop, 12 Sample Rd', claimantName: 'ZZ Plumbing', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'ZZ Builder', contractedWithIfDifferent: '', claimAmount: '500.00', contactPerson: 'Rosa', claimantAddress: '1 Sample St, Sample, TX 78000' }
const notice = (i: number): RunNotice =>
  ({
    itemId: `it${i}`,
    jobId: `j${i}`,
    kind: 'notice_53_056',
    label: `${1000 + i} · ZZ Shop ${i}`,
    jobNumber: String(1000 + i),
    months: ['2026-09'],
    amount: 500 + i,
    fields: { ...NF, projectDescription: `ZZ Shop ${i}, ${10 + i} Sample Rd` },
    extras: { refItems: [`Job #${1000 + i}`] },
    coverLetter: null,
    coverNote: '',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: `ZZ Holdings ${i} LLC`, address: `${i} Example Way, Sample, TX 78000`, email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Builder', address: '29 Example Cir, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' },
    ],
  }) as RunNotice
const AF = { county: 'Marlow', claimantPersonName: 'Rey Master, Master Plumber', claimantCompany: 'ZZ Plumbing LLC', claimantAddress: '1 Shop Rd, Sample, TX 78201', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress: '12 Sample Rd, Sample, TX 78209', contractedWithName: 'ZZ Builder', workDescription: 'Plumbing labor and materials', workStart: '', workEnd: '', ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct, Sample, TX 78209', originalContractorName: 'ZZ Builder', originalContractorAddress: '9 Yard St, Sample TX 78016', contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'July and August 2026', noticesSentWords: 'certified mail on September 14, 2026' } as LienAffidavitFields

function line(over: Partial<LienRunLine>): LienRunLine {
  return { key: `${over.kind ?? 'notice'}:${over.jobId ?? 'j'}`, kind: 'notice', jobId: 'j', label: '1001', title: 'ZZ Sample Shop', stage: 'Approved · to print', stageKey: 'to_print', detail: '', dueYmd: '2026-11-16', amount: 100, atRisk: false, standing: 'right', rowKey: null, press: null, leftOut: null, rightNow: false, ...over } as LienRunLine
}
function runOf(over: Partial<Pick<LienGetItRight, 'asked' | 'settle' | 'right' | 'leftOut'>>): LienGetItRight {
  const asked = over.asked ?? []
  const settle = over.settle ?? []
  const right = over.right ?? []
  const leftOut = over.leftOut ?? []
  return { day: '2026-11-16', dayWords: 'tomorrow', asked, settle, right, leftOut, counts: { papers: asked.length + settle.length + right.length, settle: asked.length + settle.length, right: right.length, leftOut: leftOut.length, toPrint: 0, toMail: 0, toFile: 0 }, totals: { run: 0, waits: 0, right: 0 }, step: 2, steps: [] as unknown as LienGetItRight['steps'], rightParts: '' }
}
/** A run with one notice and one affidavit right. Job j2's notice is ready on the desk and due later: not in the run. */
const BOTH = runOf({ right: [line({ kind: 'notice', jobId: 'j1' }), line({ kind: 'affidavit', jobId: 'job-1', stageKey: 'ready', stage: 'Ready to file' })] })

const noticesFor = vi.fn(() => [notice(1), notice(2)])
const affidavitsRun = vi.fn((_run: { jobIds: ReadonlySet<string>; leftOut: ReadonlyArray<{ jobLabel: string; reason: string }> }) => lienAffidavitPrintRun([{ jobId: 'job-1', jobNumber: 'J700', fields: AF }]))
const onChanged = vi.fn()
const input = (over: Partial<LienRunPrintHookInput> = {}): LienRunPrintHookInput => ({ run: BOTH, open: true, noticesFor, affidavitCount: (ids) => ids.size, affidavitsRun, issuer: null, todayYmd: '2026-11-15', stripeMode: 'live', userId: 'u1', onChanged, ...over })
const mount = (over: Partial<LienRunPrintHookInput> = {}) => renderHook((p: LienRunPrintHookInput) => useLienRunPrint(p), { initialProps: input(over) })

/** Whether the browser gives a named page its own margins: the test page has no `CSS.supports`, so each case says. */
function browserCan(can: boolean) {
  ;(globalThis as { CSS?: unknown }).CSS = { supports: (p: string) => can && p === 'page' }
}

beforeEach(() => {
  for (const m of [toastMock, fileMock, stampMock, noticesFor, affidavitsRun, onChanged]) m.mockClear()
  openMock.mockReset().mockReturnValue(true)
  browserCan(true)
})
afterEach(cleanup)

describe('useLienRunPrint', () => {
  it('reads and builds nothing while the checklist is shut, and has no state with no run', () => {
    const shut = mount({ open: false })
    expect(noticesFor).not.toHaveBeenCalled()
    expect(shut.result.current!.press).toMatchObject({ dead: true, papers: 0 })
    expect(mount({ run: null }).result.current).toBeNull()
  })

  it('waits for the notices’ bills, then is the run with its count, and builds no document until the press', async () => {
    const view = mount()
    expect(view.result.current!.press.label).toBe('Print the run · reading the bills…')
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    expect(view.result.current!.press.label).toBe('Print the run · 2 papers')
    expect(view.result.current).toMatchObject({ notices: 1, affidavits: 1, mode: 'one', printed: null })
    expect(affidavitsRun).not.toHaveBeenCalled()
    expect(openMock).not.toHaveBeenCalled()
  })

  it('the press prints one stack, files each paper as its own press files it, and stamps the run’s notices printed', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    await act(async () => view.result.current!.print())
    expect(openMock).toHaveBeenCalledTimes(1)
    const html = openMock.mock.calls[0]![0]
    expect(html).toContain(`class="${LIEN_STACK_CLASS.notices}"`)
    expect(html).toContain(`class="${LIEN_STACK_CLASS.divider}"`)
    expect(html).toContain(`class="${LIEN_STACK_CLASS.affidavits}"`)
    expect(html).toContain('<title>The run — November 15, 2026</title>')
    // The run's notice alone: a ready notice due later is not in this stack.
    expect(html).toContain('ZZ Shop 1')
    expect(html).not.toContain('ZZ Shop 2')
    // One packet for the notices, on its job, and each affidavit alone on its job.
    expect(fileMock.mock.calls.map((c) => c[0])).toMatchObject([
      { kind: 'lien_notice_packet', title: '§ 53.056 notice packet', jobIds: ['j1'], how: 'print' },
      { kind: 'lien_affidavit', title: 'Lien Affidavit — Job J700', jobIds: ['job-1'], how: 'print' },
    ])
    // Step 7: each filed copy keeps what its paper said as it printed, the notice with its desk item.
    const kept = fileMock.mock.calls.map((c) => lienPrintSnapshotPapers((c[0] as { sourceSnapshot?: Record<string, unknown> }).sourceSnapshot))
    expect(kept.map((papers) => papers.map((p) => [p.kind, p.jobIds]))).toEqual([[['notice', ['j1']]], [['affidavit', ['job-1']]]])
    expect(kept[0]![0]!.itemIds).toHaveLength(1)
    expect(kept[1]![0]!.fields.unpaidAmount).toBe('2000.00')
    // Each filed copy is the paper alone, never the stack.
    for (const c of fileMock.mock.calls) expect((c[1] as { html: string }).html).not.toContain(LIEN_STACK_CLASS.divider)
    expect(stampMock).toHaveBeenCalledWith(['it1'], 'u1')
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(view.result.current!.printed!.next).toBe('The notices are marked printed. The affidavits go to the notary.')
    expect(view.result.current!.printed!.words).toContain('Printed at')
  })

  it('hands the batch the run’s affidavit jobs and what its help sheet names as left out', async () => {
    const out = line({ kind: 'affidavit', jobId: 'job-out', standing: 'left_out', stageKey: 'ready', stage: 'Ready to file', label: '1040', title: 'ZZ Out', leftOut: { id: 'r1', jobId: 'job-out', paper: 'affidavit', runDay: '2026-11-16', reason: 'customer_paying', note: '', leftOutBy: 'u-rosa', leftOutAt: '2026-11-15T16:00:00Z', putBackBy: null, putBackAt: null } })
    const view = mount({ run: runOf({ right: BOTH.right, leftOut: [out] }) })
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    await act(async () => view.result.current!.print())
    const arg = affidavitsRun.mock.calls[0]![0]
    expect([...arg.jobIds]).toEqual(['job-1'])
    expect(arg.leftOut).toEqual([{ jobLabel: '1040 · ZZ Out', reason: 'Left out of this run. The customer is paying.' }])
  })

  it('a blocked popup prints nothing, files nothing and stamps nothing', async () => {
    openMock.mockReturnValue(false)
    const view = mount()
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    await act(async () => view.result.current!.print())
    expect(toastMock).toHaveBeenCalledWith('Popup blocked. Allow popups to print the run.', 'error')
    expect(fileMock).not.toHaveBeenCalled()
    expect(stampMock).not.toHaveBeenCalled()
    expect(view.result.current!.printed).toBeNull()
  })

  it('where one print job cannot hold both papers, each kind prints alone as its own document', async () => {
    browserCan(false)
    const view = mount()
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    expect(view.result.current!.mode).toBe('two')
    expect(view.result.current!.twoWhy).toBe('This browser cannot print both kinds as one stack. Print each with its own press.')
    expect(view.result.current!.parts).toEqual({ notices: 'Print 1 notice', affidavits: 'Print 1 affidavit' })
    expect(view.result.current!.order.replace(/[^\x20-\x7e]/g, '')).toContain('Two prints:')
    await act(async () => view.result.current!.print('notices'))
    expect(openMock.mock.calls[0]![0]).not.toContain(LIEN_STACK_CLASS.divider)
    expect(fileMock.mock.calls.map((c) => (c[0] as { kind: string }).kind)).toEqual(['lien_notice_packet'])
    expect(stampMock).toHaveBeenCalledWith(['it1'], 'u1')
    await act(async () => view.result.current!.print('affidavits'))
    expect(openMock.mock.calls[1]![0]).not.toContain(LIEN_STACK_CLASS.divider)
    expect(fileMock.mock.calls.map((c) => (c[0] as { kind: string }).kind)).toEqual(['lien_notice_packet', 'lien_affidavit'])
    expect(stampMock).toHaveBeenCalledTimes(1)
  })

  it('one kind alone is one press in any browser, and its document is that paper’s own', async () => {
    browserCan(false)
    const view = mount({ run: runOf({ right: [line({ kind: 'affidavit', jobId: 'job-1', stageKey: 'ready', stage: 'Ready to file' })] }) })
    expect(view.result.current).toMatchObject({ mode: 'one', notices: 0, affidavits: 1 })
    expect(view.result.current!.press.label).toBe('Print the run · 1 paper')
    await act(async () => view.result.current!.print())
    expect(openMock.mock.calls[0]![0]).toBe(lienAffidavitPrintRun([{ jobId: 'job-1', jobNumber: 'J700', fields: AF }]).html)
    expect(stampMock).not.toHaveBeenCalled()
    expect(view.result.current!.printed!.next).toBe('The affidavits go to the notary, then to the county clerk.')
  })

  it('a document the merge does not know prints nothing and gives each kind its own press', async () => {
    affidavitsRun.mockReturnValueOnce({ html: '<!doctype html><html><head><style>p { margin: 0; }</style></head><body><p>x</p></body></html>', copies: [] })
    const view = mount()
    await waitFor(() => expect(view.result.current!.press.dead).toBe(false))
    await act(async () => view.result.current!.print())
    expect(openMock).not.toHaveBeenCalled()
    expect(fileMock).not.toHaveBeenCalled()
    expect(view.result.current!.mode).toBe('two')
    expect(view.result.current!.twoWhy).toBe('The two papers could not be put in one stack. Print each with its own press.')
  })
})
