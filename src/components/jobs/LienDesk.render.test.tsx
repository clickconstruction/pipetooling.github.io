// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk (v2.3405): the piles and the list from a
 * built queue, the office pane's readiness gate (owner of record blocks the
 * send and offers the door), months checkboxes, the document preview, the
 * spoken-word form, and the leader's decision footer. Wiring-level only —
 * the queue math lives in src/lib/jobs/lienDesk.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_LIEN_RETAINAGE_QUEUE, LIEN_RETAINAGE_PILES, buildLienRetainageQueue, type LienRetainageRow } from '../../lib/jobs/lienDeskRetainage'
import { letterTwoByJobFrom } from '../../lib/jobs/lienLetterTwo'
import type { CourtesyRecord } from '../../lib/jobs/lienCourtesyNotice'
import { ownerCallByJobFrom } from '../../lib/jobs/lienOwnerCall'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { lienFieldsHash } from '../../lib/jobs/lienNoticeSignature'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDesk from './LienDesk'
import { LienJobSuppliersCard } from './LienJobSuppliers'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from '../../lib/jobs/lienDesk'
import { LIEN_DESK_JOB_COLUMNS, type LienDeskData } from '../../hooks/useLienDeskData'
import type { LienClaimBill } from '../../lib/jobs/lienClaimBills'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { LIEN_AFFIDAVIT_PILES, buildLienAffidavitQueue, withContractorAddress, withHomesteadAnswer, withPublicOwner, type LienAffidavitRow } from '../../lib/jobs/lienDeskAffidavits'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import { resetPropertyLookupCache } from '../../lib/customers/propertyLookupCache'
import { buildLienSupplierJobs, type LienSupplierJob } from '../../lib/jobs/lienJobSuppliers'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The desk's owner pane reads the roll (v2.3450): the lookup and the two writes are seams here.
const lookupMock = vi.fn()
vi.mock('../../lib/customers/propertyLookupClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/customers/propertyLookupClient')>('../../lib/customers/propertyLookupClient')
  return { ...actual, lookupPropertyRecord: (address: string) => lookupMock(address) }
})
const confirmMock = vi.fn()
const stampMock = vi.fn()
const saveClaimMock = vi.fn()
const clearClaimMock = vi.fn()
vi.mock('../../lib/jobs/lienClaimCorrectionIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/lienClaimCorrectionIo')>('../../lib/jobs/lienClaimCorrectionIo')
  return { ...actual, saveLienClaimCorrection: (...args: unknown[]) => saveClaimMock(...args), clearLienClaimCorrection: (...args: unknown[]) => clearClaimMock(...args), lookLienClaimCorrection: vi.fn() }
})
// The stand-in month's check (v2.7280): the write is a seam; the kernel has its own tests.
const saveMonthCheckMock = vi.fn()
vi.mock('../../lib/jobs/lienMonthCheckIo', () => ({ saveLienMonthCheck: (...args: unknown[]) => saveMonthCheckMock(...args), clearLienMonthCheck: vi.fn() }))
const savePropertyKindMock = vi.fn()
const payPageRefresh = vi.fn()
const payPageState: { rows: Array<{ invoiceId: string; label: string; description: string; openAmount: number; payable: boolean }>; assets: Record<string, { svg: string; png: string | null }>; bills: LienClaimBill[]; job: JobWithDetails | null; loading: boolean; refresh: () => void } = { rows: [], assets: {}, bills: [], job: null, loading: false, refresh: payPageRefresh }
vi.mock('../../hooks/useNoticePayPage', () => ({ useNoticePayPage: () => payPageState }))
// Bill Customer over the desk (v2.4969): the window is the provider's; the desk only asks it to open.
const openBillCustomerMock = vi.fn()
const billCustomerState: { value: { openBillCustomer: (o: unknown) => void; closeBillCustomer: () => void } | null } = { value: { openBillCustomer: (o: unknown) => openBillCustomerMock(o), closeBillCustomer: () => {} } }
vi.mock('../../contexts/BillCustomerModalContext', () => ({ useBillCustomerModal: () => billCustomerState.value }))
// Supply houses on the desk's jobs (v2.4404): the read is a seam; the kernel has its own tests.
const supplierState: { byJob: Map<string, LienSupplierJob> } = { byJob: new Map() }
const supplierReload = vi.fn()
vi.mock('../../hooks/useLienJobSuppliers', () => ({ useLienJobSuppliers: () => ({ byJob: supplierState.byJob, loaded: true, reload: supplierReload }) }))
// The conditional release enclosed with a notice (v2.4729): the reads and writes are seams; the kernel has its own tests.
const releaseState: { byId: Map<string, import('../../lib/jobs/lienNoticeRelease').NoticeRelease> } = { byId: new Map() }
const releaseReload = vi.fn()
const createReleaseMock = vi.fn(async (_input: unknown) => 'rel-1')
const refreshReleaseMock = vi.fn(async () => undefined)
const voidReleaseMock = vi.fn(async () => undefined)
vi.mock('../../hooks/useNoticeReleases', () => ({ useNoticeReleases: () => ({ byId: releaseState.byId, loaded: true, reload: releaseReload }) }))
vi.mock('../../lib/jobs/lienNoticeReleaseIo', () => ({ createNoticeReleaseDraft: (input: unknown) => createReleaseMock(input), refreshNoticeReleaseDraft: (...a: unknown[]) => refreshReleaseMock(...(a as [])), voidNoticeReleaseDraft: (...a: unknown[]) => voidReleaseMock(...(a as [])) }))
// What the house told us (v2.4411): the two writes are seams.
const saveWordMock = vi.fn()
const clearWordMock = vi.fn()
vi.mock('../../lib/jobs/lienSupplierWordIo', () => ({ saveSupplierWord: (input: unknown) => saveWordMock(input), clearSupplierWord: (...args: unknown[]) => clearWordMock(...args) }))
vi.mock('../../lib/jobs/propertyKindWrite', () => ({
  savePropertyKind: (...args: unknown[]) => savePropertyKindMock(...args),
  savePropertyHomestead: vi.fn(),
}))
const startTwoMock = vi.fn()
const gcOkayMock = vi.fn()
const ownerCallMock = vi.fn()
const promiseMock = vi.fn()
const jobPromiseMock = vi.fn()
vi.mock('../../lib/jobs/paymentChaseIo', () => ({ addJobPaymentPromise: (...args: unknown[]) => jobPromiseMock(...args) }))
// Is this public property? (v2.7443): the window's read and the one write.
const readPublicPropertyMock = vi.fn()
const readJobPathMock = vi.fn()
vi.mock('../../lib/jobs/lienPublicPropertyIo', () => ({ readLienPublicProperty: (...args: unknown[]) => readPublicPropertyMock(...args), setLienPublicAnswer: vi.fn(async () => ({ answer: 'public', jobs: [] })) }))
vi.mock('../../lib/jobs/lienJobPathIo', () => ({ readLienJobPath: (...args: unknown[]) => readJobPathMock(...args), setJobLienPathAnswer: vi.fn(async () => ({ answer: null, changed: true, onAttorneyList: false, alreadyOnList: false, held: null })) }))
const clearPrintedMock = vi.fn()
const saveDraftMock = vi.fn(async () => 'it-new')
const redrawOneMock = vi.fn(async (..._args: unknown[]) => undefined)
// The leader's one press on the Board (v2.7334): each approval is a seam.
const approveLotMock = vi.fn(async (_id: string) => undefined)
const redrawManyMock = vi.fn(async (papers: Array<{ jobId: string }>, _userId: unknown) => ({ done: papers.map((p) => p.jobId), failed: [] as Array<{ jobId: string; reason: string }> }))
const submitManyMock = vi.fn(async (papers: Array<{ jobId: string; itemId: string; outcome: { status: string } }>) => ({ done: papers.map((p) => p.jobId), failed: [] as Array<{ jobId: string; reason: string }> }))
// The list's print (v2.6918): the window it opens and the copy it files on each job.
const openPrintMock = vi.fn((_html: string) => true)
vi.mock('../../lib/jobsDocuments/printWindow', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobsDocuments/printWindow')>('../../lib/jobsDocuments/printWindow')
  return { ...actual, openHtmlPrintWindow: (html: string) => openPrintMock(html) }
})
const fileCopyMock = vi.fn(async (_filing: { kind: string; title: string; how: string; jobIds?: ReadonlyArray<string> }, _body: { html: string }) => true)
vi.mock('../../lib/sent/sentCopiesIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sent/sentCopiesIo')>('../../lib/sent/sentCopiesIo')
  return { ...actual, fileSentCopy: (filing: { kind: string; title: string; how: string; jobIds?: ReadonlyArray<string> }, body: { html: string }) => fileCopyMock(filing, body) }
})
const signMock = vi.fn()
// The pen door on the draft (v2.7297): the record, then the approval on his word.
const penMock = vi.fn()
const wordMock = vi.fn(async () => undefined)
const submitMock = vi.fn(async () => undefined)
const tellLeaderMock = vi.fn(async (..._args: unknown[]): Promise<{ ok: true; told: { pushSent: number; emailSent: boolean; leaderName: string | null; held?: number; said?: string | null; told?: number | null } } | { ok: false; reason: string }> => ({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi Whites' } }))
// An affidavit sent for approval tells the leader too (punch list #305, v2.7180): one call for every paper of one press.
const tellAffMock = vi.fn(async (_papers: Array<{ itemId: string; dueYmd: string | null }>, _opts?: { remind?: boolean }): Promise<{ ok: true; told: { pushSent: number; emailSent: boolean; leaderName: string | null; held?: number; said?: string | null; told?: number | null } } | { ok: false; reason: string }> => ({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi Whites' } }))
// Redraw from the bills (v2.7520): the write behind the band's press and behind a signing press whose stored paper is not the one shown.
const redrawNoticeMock = vi.fn()
const redrawNoticeState = { ok: true }
// The notices that wait on his signature (v2.7491): one call for the lot, from the Board's line or To do's waiting head.
const tellSignMock = vi.fn(async (_papers: Array<{ itemId: string; dueYmd: string | null }>): Promise<{ ok: true; told: { pushSent: number; emailSent: boolean; leaderName: string | null; held?: number; said?: string | null; told?: number | null; textSent?: number; textSaid?: string | null } } | { ok: false; reason: string }> => ({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi Whites' } }))
vi.mock('../../lib/jobs/lienDeskIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/lienDeskIo')>('../../lib/jobs/lienDeskIo')
  return { ...actual, redrawLienDeskItem: async (itemId: string, fields: Record<string, unknown>) => { redrawNoticeMock(itemId, fields); return redrawNoticeState.ok }, approveLienDeskItem: (id: string) => approveLotMock(id), redrawLienAffidavitShort: (...args: unknown[]) => redrawOneMock(...args), redrawLienAffidavitsShort: (papers: Array<{ jobId: string }>, userId: unknown) => redrawManyMock(papers, userId), submitLienAffidavits: (papers: Array<{ jobId: string; itemId: string; outcome: { status: string } }>) => submitManyMock(papers), saveLienDeskDraft: (...args: unknown[]) => saveDraftMock(...(args as [])), submitLienDeskItem: (...args: unknown[]) => submitMock(...(args as [])), tellLeaderOfLienApproval: (...args: unknown[]) => tellLeaderMock(...(args as [])), tellLeaderOfLienAffidavits: (papers: Array<{ itemId: string; dueYmd: string | null }>, opts?: { remind?: boolean }) => (opts ? tellAffMock(papers, opts) : tellAffMock(papers)), clearLienDeskItemPrinted: (id: string) => clearPrintedMock(id), startLetterTwo: (input: unknown) => startTwoMock(input), noteGcAuthorizedDirectPay: (...args: unknown[]) => gcOkayMock(...args), noteOwnerCall: (...args: unknown[]) => ownerCallMock(...args), notePromiseOnNotice: (...args: unknown[]) => promiseMock(...args), sendLienDeskItemOnWord: (...args: unknown[]) => wordMock(...(args as [])), tellLeaderOfLienSignatures: (papers: Array<{ itemId: string; dueYmd: string | null }>) => tellSignMock(papers) }
})
// Sign it again (v2.7502): the clear is a seam; its guard has its own tests.
const signAgainMock = vi.fn(async (..._args: unknown[]): Promise<{ ok: true } | { ok: false; message: string }> => ({ ok: true }))
const codeState = { status: { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null } as { set: boolean; setAtIso: string | null; lastUsedAtIso: string | null; lockedUntilIso: string | null } | null, signs: [] as Array<Record<string, unknown>>, answer: { ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Malachi' } as Record<string, unknown> }
vi.mock('../../lib/jobs/lienDeskSignIo', async () => ({
  ...(await vi.importActual<typeof import('../../lib/jobs/lienDeskSignIo')>('../../lib/jobs/lienDeskSignIo')),
  signLienDeskItem: async ({ itemId, approve, signer, onDevice, payload }: { itemId: string; approve: boolean; signer: unknown; onDevice: unknown; payload: unknown }) => {
    signMock(itemId, approve, signer, onDevice, payload)
    return { ok: true, signedAtIso: '2026-10-09T19:14:00Z' }
  },
  lienSignCodeStatus: async () => codeState.status,
  recordLienPenSignature: async (args: { itemId: string; how: string; signedAtIso: string }) => {
    penMock(args)
    return { ok: true, signedAtIso: args.signedAtIso, how: args.how, pagePath: null }
  },
  signLienDeskItemWithCode: async (args: Record<string, unknown>) => {
    codeState.signs.push(args)
    return codeState.answer
  },
  clearLienSignatureToSignAgain: (...args: unknown[]) => signAgainMock(...args),
}))
// The pad (v2.5791): jsdom has no canvas, and the master's line opens on the pad when his code cannot be taken.
vi.mock('signature_pad', () => ({
  default: class {
    constructor(_c: HTMLCanvasElement) {}
    off() {}
    on() {}
    isEmpty() {
      return true
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
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({
  confirmOwnerForProperty: (input: unknown) => confirmMock(input),
  stampOwnerConfirmed: (id: string, userId: string | null) => stampMock(id, userId),
}))

afterEach(cleanup)
beforeEach(() => {
  resetPropertyLookupCache()
  supplierState.byJob = new Map()
  supplierReload.mockReset()
  releaseState.byId = new Map()
  releaseReload.mockReset()
  createReleaseMock.mockClear()
  refreshReleaseMock.mockClear()
  voidReleaseMock.mockClear()
  saveWordMock.mockReset()
  saveWordMock.mockResolvedValue(undefined)
  clearWordMock.mockReset()
  clearWordMock.mockResolvedValue(undefined)
  lookupMock.mockReset()
  lookupMock.mockResolvedValue({ ok: false, error: 'not_found' })
  confirmMock.mockReset()
  confirmMock.mockResolvedValue({ updated: [], inserted: [{ customerAddressId: 'addr-new', jobIds: ['j650'] }], skipped: [] })
  stampMock.mockReset()
  stampMock.mockResolvedValue(undefined)
  savePropertyKindMock.mockReset()
  savePropertyKindMock.mockResolvedValue(undefined)
  saveClaimMock.mockReset()
  saveClaimMock.mockResolvedValue(undefined)
  clearClaimMock.mockReset()
  clearClaimMock.mockResolvedValue(undefined)
  saveMonthCheckMock.mockReset()
  saveMonthCheckMock.mockResolvedValue(undefined)
  payPageState.rows = []
  payPageState.bills = []
  payPageState.job = null
  payPageState.loading = false
  payPageRefresh.mockReset()
  openBillCustomerMock.mockReset()
})

// The courtesy notice's io (punch list #249, row 1): the addresses found at once, the send and the record write as the case sets them.
const courtesyIo = vi.hoisted(() => ({ send: vi.fn(), write: vi.fn() }))
vi.mock('../../lib/jobs/lienCourtesyIo', () => ({
  loadCourtesyRecipients: async () => [{ who: 'original_contractor', name: 'Lowbeck Contracting', email: { address: 'office@lowbeck.test', goes: true, reason: '' }, text: { address: '', goes: false, reason: 'no number on the job' }, contactId: null, textChannelId: null }],
  sendCourtesyNotice: (...args: unknown[]) => courtesyIo.send(...args),
  writeCourtesyRecord: (...args: unknown[]) => courtesyIo.write(...args),
}))

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<LienNoticeMonthRow> = {}): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 82.6, noticed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, desk_item_id: null, desk_status: null, desk_months: null, ...extra }
}

function data(rows: LienNoticeMonthRow[], items: LienDeskItemRow[] = [], hasOwnerAddress = false, addr: Record<string, unknown> = {}): LienDeskData {
  const queue = buildLienDeskQueue(rows, items, { lowbeck: 'ask' }, TODAY)
  return {
    queue,
    summary: summarizeLienDeskForNeedsYou(queue),
    rows,
    items,
    affidavits: { entries: [], piles: { needs_property: [], needs_notice: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, needs_notice: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
    affidavitRows: [],
    retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
    retainageRows: [],
    letterTwoByJob: {},
    ownerCallByJob: {},
    jobsById: {
      j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'AXO Schertz', job_address: '1204 Elwick Rd, Schertz, TX', customer_id: 'axo', customer_name: 'AXO Schertz', gc_customer_id: 'lowbeck', customer_address_id: hasOwnerAddress ? 'addr1' : null, revenue: 33_500, payments_made: 0, master_user_id: null, last_work_date: null },
    },
    gcsById: { lowbeck: { id: 'lowbeck', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@lowbeck.test', policy: 'ask', policyNote: '' } },
    addressesById: hasOwnerAddress
      ? ({ addr1: { id: 'addr1', address: '1204 Elwick Rd, Schertz, TX', county: 'Guadalupe', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: 'Elwick Holdings LLC', owner_mailing_address: '4 Example Way, Schertz, TX', ...addr } } as unknown as LienDeskData['addressesById'])
      : {},
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(), claimCorrectionsByJob: {}, affidavitMonthsByJob: {}, filingsByJob: {},
  }
}

const J650 = [row('j650', '2026-06', '2026-09-15'), row('j650', '2026-07', '2026-10-15'), row('j650', '2026-08', '2026-11-16')]

const baseProps = {
  loading: false,
  todayYmd: TODAY,
  authUserId: 'u-taunya',
  authName: 'Taunya',
  workMonths: null,
  issuer: null,
  signerNameFor: () => 'Robert Douglas, Master Plumber',
  onChanged: () => {},
  onOpenEditJob: () => {},
  onOpenLienInstruments: () => {},
}

describe('LienDesk', () => {
  it('a named region with no overlay, no ✕ and no full screen button; the door back before the title; the address told once the rows are in (punch list #182)', async () => {
    const onAddressChange = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={null} backDoor={<button type="button">← Pipeline</button>} onAddressChange={onAddressChange} initialKind="next" />)
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Lien desk' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Lien desk' })).toBeTruthy()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByLabelText('Full screen')).toBeNull()
    expect(document.querySelector('[data-lien-desk-panel="page"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
    // An empty desk writes nothing: a pasted address must not be dropped before the rows arrive.
    expect(onAddressChange).not.toHaveBeenCalled()
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} backDoor={<button type="button">← Pipeline</button>} onAddressChange={onAddressChange} initialKind="next" />)
    await settle()
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'next', job: null, pile: null }))
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    // Notices opens on its first notice on a computer, and the address names it.
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'notice', job: 'j650', pile: null }))
    // The address is the truth: a view word changed from outside moves the desk.
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} backDoor={<button type="button">← Pipeline</button>} onAddressChange={onAddressChange} initialKind="calendar" />)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'By date' }).getAttribute('aria-selected')).toBe('true'))
  })

  it('stacked (a phone, punch list #182 PR 3): the Notices list is the whole desk and picks nothing; a press asks the page to open the notice; an open notice has ← Notices in the door’s place', async () => {
    const onOpenNotice = vi.fn()
    const onShowList = vi.fn()
    const onAddressChange = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} layout="stacked" initialKind="notice" onOpenNotice={onOpenNotice} onShowList={onShowList} onAddressChange={onAddressChange} backDoor={<button type="button">← Pipeline</button>} />)
    await settle()
    // The list, with nothing picked: the address names the list alone.
    expect(document.querySelector('[data-lien-desk-list]')).not.toBeNull()
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'notice', job: null, pile: null }))
    expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back to the notices' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /AXO Schertz/ }))
    expect(onOpenNotice).toHaveBeenCalledWith('j650', null)
    // The page answers with the address: the notice is the whole desk, ← Notices where the page's door was.
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} layout="stacked" initialKind="notice" initialJobId="j650" onOpenNotice={onOpenNotice} onShowList={onShowList} onAddressChange={onAddressChange} backDoor={<button type="button">← Pipeline</button>} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the notices' })).toBeTruthy())
    expect(document.querySelector('[data-lien-desk-list]')).toBeNull()
    expect(screen.queryByRole('button', { name: '← Pipeline' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the notices' }))
    expect(onShowList).toHaveBeenCalledTimes(1)
    // The address loses the notice: the list is back, nothing picked.
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} layout="stacked" initialKind="notice" initialJobId={null} onOpenNotice={onOpenNotice} onShowList={onShowList} onAddressChange={onAddressChange} backDoor={<button type="button">← Pipeline</button>} />)
    await waitFor(() => expect(document.querySelector('[data-lien-desk-list]')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Back to the notices' })).toBeNull()
  })

  it('the ? after § Rules opens the card of what each part holds, with the guide as its door (punch list #187 PR 3)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'What this desk holds' }))
    const card = screen.getByTestId('legend-card-lien-desk')
    expect(card.textContent).toContain('To do')
    // The run's row takes the press's own name (v2.7448; Record the mailing until then), and its note names the second press.
    expect(card.textContent).toContain('Print and mailThe approved notices as one packet to print. Enter mail numbers then records what is ready and holds the rest with the reason.')
    expect(card.textContent).not.toContain('Record the mailing')
    expect((screen.getByTestId('legend-card-lien-desk-guide') as HTMLAnchorElement).getAttribute('href')).toBe('/help?g=send-lien-notices-from-the-lien-desk&via=legend')
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('legend-card-lien-desk')).toBeNull()
  })

  it('the title bar’s Share opens where the liens stand, from the same place on every tab (v2.4311)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const share = document.querySelector('[data-lien-desk-share]') as HTMLButtonElement
    expect(share.textContent).toContain('Share')
    expect(share.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    expect(document.querySelector('[data-lien-desk-share]')).toBe(share)
    fireEvent.click(share)
    await settle()
    const panel = screen.getByRole('dialog', { name: 'Share where the liens stand' })
    expect(panel.textContent).toContain('We are about to send a lien notice on 1 job.')
    expect(panel.textContent).toContain('$33,500 is owed on it.')
    expect(share.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(share)
    expect(screen.queryByRole('dialog', { name: 'Share where the liens stand' })).toBeNull()
  })

  it('the records window’s door is the last row of the window ☎ opens, for the office and only when the desk is given one; the title bar has no press for it (v2.4544; in the call window since v2.7780)', async () => {
    const onOpenOwnerRecords = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    // Nothing on the bar: the door is drawn only in the call window.
    expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    const door = within(screen.getByTestId('lien-call-script')).getByTestId('lien-owner-records-door')
    expect(door.textContent).toBe('An owner asked for records ›')
    expect(door.closest('[data-lien-call-script-records]')!.textContent).toBe('Asking what we billed and what was paid?An owner asked for records ›')
    fireEvent.click(door)
    // The call window closes behind it.
    expect(onOpenOwnerRecords).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('lien-call-script')).toBeNull()
    view.unmount()
    // With a notice open in By paper's pane the records window is handed its job, so it opens on that property.
    const picked = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    fireEvent.click(screen.getByTestId('lien-owner-records-door'))
    expect(onOpenOwnerRecords).toHaveBeenLastCalledWith('j650')
    picked.unmount()
    // To do has no pane: the desk still holds that notice, which nobody chose here, so the window is handed none and starts at the owner picker.
    const todo = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="next" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    fireEvent.click(screen.getByTestId('lien-owner-records-door'))
    expect(onOpenOwnerRecords).toHaveBeenLastCalledWith(null)
    todo.unmount()
    // jsdom draws no widths, so the bar keeps the two steady lines of v2.6569: the tool row under the title line, with the break before it, on By date as on By paper.
    const deadlines = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="calendar" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    const right = document.querySelector('[data-lien-desk-right]') as HTMLElement
    expect(right.querySelector('[data-lien-desk-share]')).toBeTruthy()
    expect(right.querySelector('[data-testid="lien-rules-door"]')).toBeTruthy()
    expect(right.querySelector('[data-lien-caller-door]')).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-header-break]')).not.toBeNull()
    const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
    const order = Array.from(bar.children).map((el) => (el.hasAttribute('data-lien-desk-kinds') ? 'views' : el.hasAttribute('data-lien-desk-header-break') ? 'break' : el.hasAttribute('data-lien-desk-right') ? 'tools' : el.hasAttribute('data-lien-desk-run') ? 'run' : null)).filter(Boolean)
    expect(order).toEqual(['views', 'break', 'tools'])
    deadlines.unmount()
    // A desk given no records window draws no row in the call window.
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    expect(screen.getByTestId('lien-call-script')).toBeTruthy()
    expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
  })

  it('the tools end the title line when it has room for them (v2.7213; the line measured since v2.7277): the four presses in a 2,000 px window and at 1,300, and off By paper the bar is one line since v2.7780, when the owner-records door left it; a line too narrow keeps the tool row, which falls under the papers when the pile line cannot hold both', async () => {
    const rect = Element.prototype.getBoundingClientRect
    // The desk as drawn (← Back, the views and the four presses) in a bar `barWidth` px wide. The run's door stood after the views until v2.7490;
    // without its 270 px the line holds its tools in far narrower windows. Since v2.7465 the title is the first tab, so the heading is a clipped pixel out of the line and the views are 372 px (*⏱ Lien desk · 32 to do*, measured 2026-11-16).
    // 1,952 is a 2,000 px window, 1,252 a 1,300 px one, 760 an 808 px one. jsdom has no ResizeObserver, so the bar reads the line once, on mount.
    // `pile` draws By paper's line too (v2.7311): the paper tabs and the right span at the widths given; without it they are 0 and the line holds everything.
    const drawn = (barWidth: number, pile?: { papers: number; right: number }) =>
      function (this: Element): DOMRect {
        const w = this.classList.contains('lienDeskTitleBar') ? barWidth : this.hasAttribute('data-lien-desk-way-back') ? 90 : this.tagName === 'H2' ? 1 : this.hasAttribute('data-lien-desk-kinds') ? 372 : this.hasAttribute('data-lien-desk-run') ? 270 : this.hasAttribute('data-lien-desk-presses') ? 231 : this.hasAttribute('data-lien-desk-paper-kinds') ? (pile?.papers ?? 0) : this.hasAttribute('data-lien-desk-right') ? (pile?.right ?? 0) : 0
        return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON: () => ({}) } as DOMRect
      }
    const back = <button type="button" data-lien-desk-way-back>← Back</button>
    // One printed notice: until v2.7490 that drew the run's door after the views. No view draws it now.
    const printed = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z',
    } as unknown as LienDeskItemRow
    const withRun = data(J650, [printed], true)
    const shape = () => {
      const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
      return Array.from(bar.children).map((el) => (el.hasAttribute('data-lien-desk-kinds') ? 'views' : el.hasAttribute('data-lien-desk-run') ? 'run' : el.hasAttribute('data-lien-desk-tools') ? 'tools' : el.hasAttribute('data-lien-desk-header-break') ? 'break' : el.hasAttribute('data-lien-desk-paper-kinds') ? 'papers' : el.hasAttribute('data-lien-desk-piles') ? 'piles' : el.hasAttribute('data-lien-desk-pile-break') ? 'pile-break' : el.hasAttribute('data-lien-desk-right') ? 'right' : null)).filter(Boolean)
    }
    const names = (within: Element) => Array.from(within.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent)
    try {
      Element.prototype.getBoundingClientRect = drawn(1952)
      const onOpenOwnerRecords = vi.fn()
      // Deadlines, the owner's screenshot of v2.7213: the four presses end the title line in their order, and the bar has no second line. From v2.7311 to v2.7780 the owner-records door had one to itself, under Share.
      const deadlines = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="calendar" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      const tools = document.querySelector('[data-lien-desk-tools]') as HTMLElement
      expect(tools.style.marginLeft).toBe('auto')
      expect(names(tools)).toEqual(['§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      expect(document.querySelector('[data-lien-desk-right]')).toBeNull()
      expect(document.querySelector('[data-lien-desk-header-break]')).toBeNull()
      expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
      // Share still opens from the title line.
      fireEvent.click(document.querySelector('[data-lien-desk-share]') as HTMLElement)
      expect(screen.getByRole('dialog', { name: 'Share where the liens stand' })).toBeTruthy()
      deadlines.unmount()
      // To do: the same one line.
      const now = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="next" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      now.unmount()
      // By paper's Lien affidavits, which draws no run: the four presses stay on the title line, before the break, and the paper tabs are the second line, with no span at its end.
      const affidavits = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="affidavit" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools', 'break', 'papers'])
      expect(names(document.querySelector('[data-lien-desk-tools]')!)).toEqual(['§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      // Back on To do the second line goes with the papers.
      fireEvent.click(screen.getByRole('tab', { name: /^Lien desk/ }))
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      affidavits.unmount()
      // The leader has no caller's door: § Rules, ? and Share end his title line, and the bar has no second line.
      const leader = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650)} initialKind="calendar" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      expect(document.querySelector('[data-lien-desk-tools] [data-testid="lien-rules-door"]')).toBeTruthy()
      expect(document.querySelector('[data-lien-desk-tools] [data-lien-desk-share]')).toBeTruthy()
      expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
      leader.unmount()

      // A 1,300 px window (the owner's screenshot of 2026-11-14, v2.7277): the same one line. Until v2.7780 the door sat alone on a second line here.
      Element.prototype.getBoundingClientRect = drawn(1252)
      const owner = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="calendar" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      expect(names(document.querySelector('[data-lien-desk-tools]')!)).toEqual(['§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      // By paper's Lien affidavits: the papers are the second line. No run door is drawn here or anywhere.
      fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
      await settle()
      fireEvent.click(screen.getByRole('tab', { name: /^Lien affidavits/ }))
      await settle()
      expect(document.querySelector('[data-lien-desk-run]')).toBeNull()
      expect(shape()).toEqual(['views', 'tools', 'break', 'papers'])
      owner.unmount()
      const leaderNarrow = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650)} initialKind="calendar" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      leaderNarrow.unmount()

      // An 808 px window, too narrow for the four presses (721.8 px of the way back, the views, the presses and two gaps in a 720 px line): the two steady lines of v2.6569, the tool row under the title line. With the run's door on the line this happened at 1,048 px, and with the title beside the views at 828.
      Element.prototype.getBoundingClientRect = drawn(760)
      const steady = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="calendar" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'break', 'right'])
      expect(document.querySelector('[data-lien-desk-run]')).toBeNull()
      expect(names(document.querySelector('[data-lien-desk-right]')!)).toEqual(['§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      steady.unmount()

      // An 808 px window on By paper (v2.7311): the pile line — 500 px of paper tabs and a 231 px span of the four presses — cannot hold both, so the bar breaks before the span and it falls under the papers as one piece, still pushed right and still its presses.
      Element.prototype.getBoundingClientRect = drawn(760, { papers: 500, right: 231 })
      const tablet = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="affidavit" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'break', 'papers', 'pile-break', 'right'])
      expect((document.querySelector('[data-lien-desk-pile-break]') as HTMLElement).style.flexBasis).toBe('100%')
      // v2.7322: on a computer the bar's row gap is 0 and the lines sit 6 px apart by the items' block margins in index.css, so a 0-height break on a line of its own costs no gap of its own; the bar's padding is 1 px over the title line and 3 under the pile line, under those margins.
      expect((document.querySelector('[data-lien-desk-pile-break]') as HTMLElement).style.height).toBe('0px')
      expect((document.querySelector('[data-lien-desk-header-break]') as HTMLElement).style.height).toBe('0px')
      expect((document.querySelector('.lienDeskTitleBar') as HTMLElement).style.rowGap).toBe('0')
      expect((document.querySelector('.lienDeskTitleBar') as HTMLElement).style.padding).toBe('1px 1.25rem 3px')
      expect(names(document.querySelector('[data-lien-desk-right]')!)).toEqual(['§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      tablet.unmount()
      // The same bar with room on its 720 px line (the papers at 393, the span at 231): no break, the span ends the line.
      Element.prototype.getBoundingClientRect = drawn(760, { papers: 393, right: 231 })
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRun} initialKind="affidavit" backDoor={back} onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'break', 'papers', 'right'])
    } finally {
      Element.prototype.getBoundingClientRect = rect
    }
  })

  it('By paper’s three paper tabs ride the title line, between the views and the tools, when the measured line holds them (v2.7789); a line too narrow keeps them leading the second, and the piles stay on the line under', async () => {
    const rect = Element.prototype.getBoundingClientRect
    // The bar as drawn on 2026-11-18: ← Back 90, the views 305, the three paper tabs 411, the four presses 231, the pile chips and the GC door at the widths given.
    // The line needs 90 + 305 + 411 + 231 and three 14.4 px gaps, 1,080.2 px: a 1,121 px bar's line (1,081) holds it and a 1,120 px one (1,080) does not.
    const drawn = (barWidth: number, o: { papers?: number; piles?: number; right?: number } = {}) =>
      function (this: Element): DOMRect {
        const w = this.classList.contains('lienDeskTitleBar') ? barWidth : this.hasAttribute('data-lien-desk-way-back') ? 90 : this.tagName === 'H2' ? 1 : this.hasAttribute('data-lien-desk-kinds') ? 305 : this.hasAttribute('data-lien-desk-presses') ? 231 : this.hasAttribute('data-lien-desk-paper-kinds') ? (o.papers ?? 411) : this.hasAttribute('data-lien-desk-piles') ? (o.piles ?? 0) : this.hasAttribute('data-lien-desk-right') ? (o.right ?? 0) : 0
        return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON: () => ({}) } as DOMRect
      }
    const back = <button type="button" data-lien-desk-way-back>← Back</button>
    const shape = () => {
      const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
      return Array.from(bar.children).map((el) => (el.hasAttribute('data-lien-desk-kinds') ? 'views' : el.hasAttribute('data-lien-desk-tools') ? 'tools' : el.hasAttribute('data-lien-desk-header-break') ? 'break' : el.hasAttribute('data-lien-desk-paper-kinds') ? 'papers' : el.hasAttribute('data-lien-desk-piles') ? 'piles' : el.hasAttribute('data-lien-desk-pile-break') ? 'pile-break' : el.hasAttribute('data-lien-desk-right') ? 'right' : null)).filter(Boolean)
    }
    const papersLine = () => (document.querySelector('[data-lien-desk-paper-kinds]') as HTMLElement).getAttribute('data-lien-desk-paper-kinds')
    const plain = data(J650)
    // Two affidavits to draft: Lien affidavits draws a pile chip in the header.
    const withPiles = { ...plain, affidavits: { ...plain.affidavits, counts: { ...plain.affidavits.counts, to_draft: 2 } } }
    try {
      // Lien affidavits in a 1,300 px window, no pile to show: the papers are up and the bar is one line.
      Element.prototype.getBoundingClientRect = drawn(1252)
      const oneLine = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={plain} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'papers', 'tools'])
      expect(papersLine()).toBe('title_line')
      expect(document.querySelector('[data-lien-desk-header-break]')).toBeNull()
      // On the title line the tabs keep the bar's own block margin, not the second line's 2 px.
      expect((document.querySelector('[data-lien-desk-paper-kinds]') as HTMLElement).style.marginBlock).toBe('')
      // The tabs still pick a paper from up there, and still read in their order.
      const paper = within(screen.getByRole('tablist', { name: 'Kind of paper' }))
      expect(paper.getAllByRole('tab').map((t) => t.textContent?.replace(/ · \d+$/, ''))).toEqual(['Monthly notices', 'Lien affidavits', 'Retainage notices'])
      fireEvent.click(paper.getByRole('tab', { name: /^Retainage notices/ }))
      await settle()
      expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage notices/ }).getAttribute('aria-selected')).toBe('true')
      expect(shape()).toEqual(['views', 'papers', 'tools'])
      // Off By paper the papers go and the bar is the views and the tools.
      fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      oneLine.unmount()

      // Lien affidavits with a pile: the papers up, the piles alone on the line under, no span at its end.
      Element.prototype.getBoundingClientRect = drawn(1252, { piles: 427 })
      const piles = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPiles} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'papers', 'tools', 'break', 'piles'])
      expect(document.querySelector('[data-lien-desk-right]')).toBeNull()
      piles.unmount()

      // Monthly notices with a GC to put on notice: one line. The door left the bar in v2.7806; the press is on the job's own notice (the case under this one).
      Element.prototype.getBoundingClientRect = drawn(1252)
      const notices = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={plain} initialKind="notice" backDoor={back} onPutGcOnNotice={vi.fn()} />)
      await settle()
      expect(shape()).toEqual(['views', 'papers', 'tools'])
      expect(document.querySelector('[data-lien-desk-right]')).toBeNull()
      expect(document.querySelector('.lienDeskTitleBar button[aria-haspopup="menu"]')).toBeNull()
      notices.unmount()

      // The edge: a 1,121 px bar holds the line and a 1,120 px one does not. Under it the papers lead the second line, as before, with the presses still up.
      Element.prototype.getBoundingClientRect = drawn(1121, { piles: 427 })
      const justFits = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPiles} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'papers', 'tools', 'break', 'piles'])
      justFits.unmount()
      Element.prototype.getBoundingClientRect = drawn(1120, { piles: 427 })
      const justShort = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPiles} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools', 'break', 'papers', 'piles'])
      expect(papersLine()).toBe('second_line')
      expect((document.querySelector('[data-lien-desk-paper-kinds]') as HTMLElement).style.marginBlock).toBe('2px')
      justShort.unmount()

      // Longer counts are measured, not assumed: 451 px of paper tabs do not fit the bar that held 411.
      Element.prototype.getBoundingClientRect = drawn(1121, { papers: 451 })
      const longCounts = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={plain} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools', 'break', 'papers'])
      longCounts.unmount()

      // A 738 px window has no room for the presses either (654.8 px of the way back, the views, the presses and two gaps in a 650 px line): the two steady lines, the papers leading the second and the tool row at its end.
      Element.prototype.getBoundingClientRect = drawn(690, { papers: 393, right: 231 })
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={plain} initialKind="affidavit" backDoor={back} />)
      await settle()
      expect(shape()).toEqual(['views', 'break', 'papers', 'right'])
      expect(papersLine()).toBe('second_line')
    } finally {
      Element.prototype.getBoundingClientRect = rect
    }
  })

  it('Put a GC on notice is a press beside the GC’s name on a job’s own notice, and no part of the title bar on a computer (v2.7806, the owner’s pick: "Build 2")', async () => {
    const onPutGcOnNotice = vi.fn()
    const office = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" onPutGcOnNotice={onPutGcOnNotice} />)
    await settle()
    // The title bar holds no door to it, and no picker opens from it.
    expect(document.querySelector('.lienDeskTitleBar button[aria-haspopup="menu"]')).toBeNull()
    expect(document.querySelector('[data-lien-gc-picker]')).toBeNull()
    expect(within(document.querySelector('.lienDeskTitleBar') as HTMLElement).queryByText(/on notice…/)).toBeNull()
    // The job's heading: its GC's name, then the press, named for that GC.
    const press = document.querySelector('[data-lien-gc-notice-press]') as HTMLButtonElement
    expect(press.dataset.lienGcNoticePress).toBe('lowbeck')
    expect(press.textContent).toBe('⚠ Put on notice…')
    expect(press.getAttribute('aria-label')).toMatch(/^Put .+ on notice…$/)
    expect(press.title).toContain('one approved run')
    expect(press.previousElementSibling?.textContent).toMatch(/^· GC /)
    expect(press.closest('[data-lien-pane-keep]')).not.toBeNull()
    expect(screen.getByRole('button', { name: press.getAttribute('aria-label')! })).toBe(press)
    // One press opens the run for that GC, with no picker between.
    fireEvent.click(press)
    expect(onPutGcOnNotice).toHaveBeenCalledTimes(1)
    expect(onPutGcOnNotice).toHaveBeenCalledWith('lowbeck')
    office.unmount()

    // The leader is the office too, so the press is his as the title bar's door was. A desk handed no run window draws none.
    const leader = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650)} initialJobId="j650" initialKind="notice" onPutGcOnNotice={onPutGcOnNotice} />)
    await settle()
    expect((document.querySelector('[data-lien-gc-notice-press]') as HTMLElement).dataset.lienGcNoticePress).toBe('lowbeck')
    leader.unmount()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" />)
    await settle()
    expect(document.querySelector('[data-lien-gc-notice-press]')).toBeNull()
    // The heading still names the GC, in its one line as before.
    expect(document.querySelector('[data-lien-pane-keep]')!.textContent).toMatch(/· GC /)
  })

  it('a phone keeps Put a GC on notice as a row of More, which opens the picker as a sheet, and draws no press on the job (v2.7806)', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const onPutGcOnNotice = vi.fn()
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="notice" onPutGcOnNotice={onPutGcOnNotice} />)
      await settle()
      expect(document.querySelector('[data-lien-gc-notice-press]')).toBeNull()
      fireEvent.click(document.querySelector('[data-lien-desk-more="door"]') as HTMLElement)
      fireEvent.click(screen.getByRole('button', { name: /Put a GC on notice…/ }))
      await settle()
      const sheet = document.querySelector('[data-lien-gc-picker]') as HTMLElement
      expect(sheet).not.toBeNull()
      fireEvent.click(sheet.querySelector('[data-lien-gc-option="lowbeck"]') as HTMLElement)
      expect(onPutGcOnNotice).toHaveBeenCalledWith('lowbeck')
    } finally {
      window.matchMedia = before
    }
  })

  it('a phone keeps the paper tabs as its second row whatever the bar would measure (v2.7789)', async () => {
    const rect = Element.prototype.getBoundingClientRect
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      // Widths that would take the papers up on a computer: a phone is never measured.
      Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
        const w = this.classList.contains('lienDeskTitleBar') ? 1952 : this.hasAttribute('data-lien-desk-paper-kinds') ? 200 : 50
        return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON: () => ({}) } as DOMRect
      }
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" />)
      await settle()
      expect(document.querySelector('[data-lien-desk-more="door"]')).not.toBeNull()
      const papers = document.querySelector('[data-lien-desk-paper-kinds]') as HTMLElement
      expect(papers.getAttribute('data-lien-desk-paper-kinds')).toBe('second_line')
      expect(document.querySelector('[data-lien-desk-header-break]')!.nextElementSibling).toBe(papers)
    } finally {
      Element.prototype.getBoundingClientRect = rect
      window.matchMedia = before
    }
  })

  it("a stop's title on the timeline opens the window on what that stop sends; Esc closes it alone (v2.4793)", async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" />)
    await settle()
    const door = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-stop-door="notice:2026-06"]') as HTMLButtonElement
    expect(door?.tagName).toBe('BUTTON')
    fireEvent.click(door)
    expect(screen.getByTestId('lien-stop-paper')).toBeTruthy()
    expect(screen.getByTestId('lien-stop-paper-eyebrow').textContent).toBe('§ 53.056 · Jun')
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toMatch(/^The .*notice$/)
    // The gates that are not clear read under Before it can go — the owner of record is missing on this job.
    expect(screen.getAllByTestId('lien-stop-paper-before').map((n) => n.textContent).join(' ')).toMatch(/[Oo]wner/)
    // The hold line (v2.4806): the draft footer's own sentence, with the gate's door; the folded path's dots at its right.
    expect(screen.getByTestId('lien-stop-paper-hold').textContent).toBe("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(screen.getByTestId('lien-stop-paper-hold-act').textContent).toBe('Go to gate 1 ▴')
    expect(screen.getByTestId('lien-stop-paper-dots').textContent).toContain('of')
    fireEvent.click(screen.getByRole('button', { name: 'Next stop' }))
    expect(screen.getByTestId('lien-stop-paper-eyebrow').textContent).toBe('§ 53.056 · Jul')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-stop-paper')).toBeNull()
    expect(screen.getByRole('region', { name: 'Lien desk' })).toBeTruthy()
    // The affidavit stop shows the affidavit as the Affidavits pane prints it.
    fireEvent.click(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-stop-door="affidavit"]') as HTMLButtonElement)
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('The lien affidavit')
    expect(screen.getByTestId('lien-stop-paper-rule').textContent).toBe('§ 53.052 · What the affidavit needs before it can be filed ›')
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it("on Lien affidavits, a stop's title opens the window with this pane's affidavit and the Lien window door (v2.4793)", async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data(J650)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const door = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-stop-door="affidavit"]') as HTMLButtonElement
    expect(door?.tagName).toBe('BUTTON')
    fireEvent.click(door)
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('The lien affidavit')
    expect(screen.getByTestId('lien-stop-paper-page').textContent).toMatch(/AFFIDAVIT/i)
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open it in the Lien window ›')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-stop-paper')).toBeNull()
    // A notice stop from this side points at Notices, where the pages are.
    fireEvent.click(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-stop-door^="notice:"]') as HTMLButtonElement)
    expect(screen.getByTestId('lien-stop-paper-eyebrow').textContent).toMatch(/§ 53.056/)
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open it on Monthly notices ›')
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('a printed notice has a footer: Enter mail numbers, and Back to Approved · to print; the header counts it (v2.4568; the words v2.7448)', async () => {
    clearPrintedMock.mockReset()
    clearPrintedMock.mockResolvedValue(undefined)
    const printed = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z',
    } as unknown as LienDeskItemRow
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [printed], true)} initialJobId="j650" initialKind="notice" onChanged={onChanged} />)
    await settle()
    // Nothing is in Approved · to print, one is printed. The title bar drew a door to the run here until v2.7490 (*Enter mail numbers · 1*, with its meter);
    // the owner retired it on every view. The printed notice's own footer still opens the run on its mail numbers.
    expect(document.querySelector('[data-lien-desk-run]')).toBeNull()
    expect(document.querySelector('[data-lien-desk-run-meter]')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Print and mail/ })).toBeNull()
    expect(document.querySelector('[data-lien-desk-header-break]')!.nextElementSibling!.hasAttribute('data-lien-desk-paper-kinds')).toBe(true)
    const footer = document.querySelector('[data-lien-desk-printed-footer]') as HTMLElement
    // v2.4855: the state is a chip with the day; the old sentence is its hover.
    const chip = footer.querySelector('.lienFootChip') as HTMLElement
    expect(chip.textContent).toContain('Printed Sep 14 · to mail')
    expect(chip.title).toContain('Printed September 14, 2026. It now waits to mail.')
    expect(footer.querySelectorAll('.lienFootLink').length).toBe(2)
    expect(within(footer).getByRole('button', { name: 'Enter mail numbers · 1 ▸' })).toBeTruthy()
    fireEvent.click(within(footer).getByRole('button', { name: 'Back to Approved · to print' }))
    await waitFor(() => expect(clearPrintedMock).toHaveBeenCalledWith('it1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('two printed notices are one To do row; its Take back… opens the run on the confirm, and the rail counts them (punch list #101)', async () => {
    const item = (id: string, job: string) =>
      ({ id, job_id: job, kind: 'notice_53_056', months: ['2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z' }) as unknown as LienDeskItemRow
    const rows = [...J650, row('j651', '2026-07', '2026-10-15')]
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(rows, [item('it1', 'j650'), item('it2', 'j651')], true)} initialKind="next" />)
    await settle()
    const run = document.querySelector('[data-lien-next-up-row="run:printed"]') as HTMLElement
    expect(run.textContent).toContain('2 notices printed Sep 14')
    expect(document.querySelectorAll('[data-lien-next-up-act="add_tracking"]').length).toBe(0)
    // The Board (v2.7332) counts them in Approved · to mail, where the rail's fourth rung did; nothing is left to print (v2.7448).
    expect(document.querySelector('[data-lien-board-bin="notice:to_print"] [data-lien-board-count]')!.textContent).toBe('0')
    expect(document.querySelector('[data-lien-board-bin="notice:in_mail"] [data-lien-board-count]')!.textContent).toBe('2')
    fireEvent.click(within(run).getByRole('button', { name: 'Take back…' }))
    await settle()
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('Take back the run?')
  })

  it('the Board’s Approved · to mail bin carries the run’s own press on its title line: with every approved notice printed it reads Enter mail numbers and opens the whole run (v2.7470, punch list #362; in the bin since v2.7708)', async () => {
    const item = (id: string, job: string) =>
      ({ id, job_id: job, kind: 'notice_53_056', months: ['2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z' }) as unknown as LienDeskItemRow
    const rows = [...J650, row('j651', '2026-07', '2026-10-15')]
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(rows, [item('it1', 'j650'), item('it2', 'j651')], true)} initialKind="next" />)
    await settle()
    const foot = document.querySelector('[data-lien-board-bin-title="notice:in_mail"]') as HTMLElement
    expect(document.querySelector('[data-lien-board-prints]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin="affidavit:ready"] [data-lien-board-bin-press]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(within(foot).getByRole('button', { name: 'Enter mail numbers · 2' }))
    await settle()
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0)
  })

  it('public property (v2.7443): a job whose property asks is marked on the Board under one amber line, Review opens its property, and the jobs already off the path sit in their own bin', async () => {
    readPublicPropertyMock.mockReturnValue(new Promise(() => {}))
    const base = data(J650, [], true)
    const offPath = { jobId: 'j900', addressId: 'addr-zz', number: '900', name: 'ZZ Test Drains', gcName: 'Lowbeck Contracting', unpaid: 2918.4, bond: 'unknown' as const, attorneySince: null, status: 'working', papers: [] }
    const withPublic = { ...base, jobsById: { ...base.jobsById, j650: { ...base.jobsById.j650!, customer_address_id: 'addr-650' } }, publicAskJobIds: new Set(['j650']), publicJobs: [offPath] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPublic} initialKind="next" />)
    await settle()
    const chip = document.querySelector('[data-lien-board-chip="j650"]') as HTMLElement
    expect(chip.getAttribute('data-public')).toBe('yes')
    const lineEl = document.querySelector('[data-lien-public-board-line]') as HTMLElement
    expect(lineEl.textContent).toContain('1 job sits on public property and is still on the lien path')
    const bin = document.querySelector('[data-lien-public-bin]') as HTMLElement
    // The box opens folded to one line that still counts the job whose bond nobody knows (punch list #390).
    expect(bin.textContent).toBe('Public jobs · bond claim1 job · $2,918 unpaid1 to get the bondShow ▾')
    fireEvent.click(within(bin).getByRole('button', { expanded: false }))
    expect(bin.textContent).toContain('not on the attorney’s list, the job is still being worked')
    expect((document.querySelector('[data-lien-board-column="affidavit"]') as HTMLElement).contains(bin)).toBe(true)
    fireEvent.click(within(lineEl).getByRole('button', { name: 'Review it ›' }))
    expect(await screen.findByRole('dialog', { name: 'Take this property off the lien path?' })).toBeTruthy()
    expect(readPublicPropertyMock).toHaveBeenCalledWith('addr-650')
  })

  it('off the lien path (v2.7526): the jobs a person took off sit in a bin of their own with the reason, and Put it back… opens that job’s window', async () => {
    readJobPathMock.mockReturnValue(new Promise(() => {}))
    const off = { jobId: 'j977', number: '977', name: 'ZZ Test Trip Charges', gcName: 'Lowbeck Contracting', unpaid: 1050, reason: 'The bill is for trips to pick up checks.', since: '2026-09-10T15:00:00Z', byUserId: 'u1', byName: 'Dana', attorneySince: null, status: 'billed', papers: [] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={{ ...data(J650, [], true), offPathJobs: [off] }} initialKind="next" />)
    await settle()
    const bin = document.querySelector('[data-lien-off-path-bin]') as HTMLElement
    // Folded as the public box is (punch list #390): one line, then a press on it opens the rows.
    expect(bin.textContent).toBe('Off the lien path1 job · $1,050 unpaidShow ▾')
    fireEvent.click(within(bin).getByRole('button', { expanded: false }))
    expect(bin.textContent).toContain('977 · ZZ Test Trip Charges')
    expect(bin.textContent).toContain('Lowbeck Contracting · off since Sep 10, by Dana · not on the attorney’s list')
    expect(bin.textContent).toContain('The bill is for trips to pick up checks.')
    expect((document.querySelector('[data-lien-board-column="affidavit"]') as HTMLElement).contains(bin)).toBe(true)
    // The job is on no list: no chip and no row of its own.
    expect(document.querySelector('[data-lien-board-chip="j977"]')).toBeNull()
    fireEvent.click(within(bin).getByRole('button', { name: 'Put it back…' }))
    expect(await screen.findByTestId('lien-job-path-window')).toBeTruthy()
    expect(readJobPathMock).toHaveBeenCalledWith('j977')
  })

  it('off the lien path: a reader who is not the lien office sees the bin and no press', async () => {
    const off = { jobId: 'j977', number: '977', name: 'ZZ Test Trip Charges', gcName: '', unpaid: 1050, reason: 'Not for work on the property.', since: null, byUserId: null, attorneySince: null, status: 'billed', papers: [] }
    renderWithProviders(<LienDesk {...baseProps} authRole="estimator" data={{ ...data(J650, [], true), offPathJobs: [off] }} initialKind="next" />)
    await settle()
    const bin = document.querySelector('[data-lien-off-path-bin]') as HTMLElement
    fireEvent.click(within(bin).getByRole('button', { expanded: false }))
    expect(document.querySelectorAll('[data-lien-off-path-bin-row]')).toHaveLength(1)
    expect(document.querySelector('[data-lien-off-path-bin-back]')).toBeNull()
  })

  it('the office: a notice waiting on the leader closes To do under his name and leaves the tab’s count (punch list #101 PR 3)', async () => {
    const awaiting = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [awaiting], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    // Since v2.7456 (punch list #362, step 4) a computer's list follows the Board: the paper sits under its bin's name, and a bin whose papers all wait on the leader names him. It read *Waiting on Sam · 1*.
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h4')).map((h) => h.textContent)
    expect(titles).toEqual(['Awaiting Master approval · 1 notice · waiting on Sam'])
    expect(document.querySelector('[data-lien-next-up-bin="notice:awaiting"]')).toBeTruthy()
    // The head names the leader; since v2.7372 the row under it says when the paper was sent and how long it has waited.
    expect((document.querySelector('[data-lien-next-up-row="notice:j650"] [data-lien-next-up-line]') as HTMLElement).textContent).toBe('Sent for approval Sep 12 · waiting 2 days')
    expect(screen.getByRole('tab', { name: /^Lien desk/ }).textContent).toBe('⏱ Lien desk · 0 to do')
  })

  it('the office reminds the leader of what waits on him: one press on the waiting head asks, sends the notice’s own message again, says what was sent and is dead after (v2.7371, punch list #362 step 2)', async () => {
    tellLeaderMock.mockClear()
    const awaiting = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' } as unknown as LienDeskItemRow
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [awaiting], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    const press = () => document.querySelector('[data-lien-next-up-remind]') as HTMLButtonElement
    expect(press().textContent).toBe('Remind Sam of 1 paper')
    expect(document.querySelector('[data-lien-next-up-group="waiting"]')!.contains(press())).toBe(true)
    fireEvent.click(press())
    // It asks first, with the act on its button and nothing sent yet.
    expect(await screen.findByText('Remind Sam of 1 paper?')).toBeTruthy()
    expect(tellLeaderMock).not.toHaveBeenCalled()
    const confirms = screen.getAllByRole('button', { name: 'Remind Sam' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledTimes(1))
    expect((tellLeaderMock.mock.calls[0] as unknown[])[0]).toBe('it1')
    // The function is told this is a reminder (v2.7445): its email says so.
    expect((tellLeaderMock.mock.calls[0] as unknown[])[2]).toEqual({ remind: true })
    expect(await screen.findByText('Sam was reminded of 1 paper.')).toBeTruthy()
    await waitFor(() => expect(press().textContent).toMatch(/^Reminded at \d{1,2}:\d{2}/))
    expect(press().disabled).toBe(true)
    view.unmount()
    // The leader's own desk has no such press: the row is his to approve.
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    expect(document.querySelector('[data-lien-next-up-remind]')).toBeNull()
  })

  it('a reminder the function took and did not send is never called a reminder sent: the toast says why, and the press stays live (v2.7445)', async () => {
    tellLeaderMock.mockClear()
    tellLeaderMock.mockImplementationOnce(async () => ({ ok: true, told: { pushSent: 0, emailSent: false, leaderName: null, held: 0, said: 'Not awaiting approval', told: null } }))
    const awaiting = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [awaiting], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    const press = () => document.querySelector('[data-lien-next-up-remind]') as HTMLButtonElement
    fireEvent.click(press())
    expect(await screen.findByText('Remind Sam of 1 paper?')).toBeTruthy()
    const confirms = screen.getAllByRole('button', { name: 'Remind Sam' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/^Sam was not reminded\. 1 reminder did not send: .+ \(not waiting for approval now\)\.$/)).toBeTruthy()
    expect(press().textContent).toBe('Remind Sam of 1 paper')
    expect(press().disabled).toBe(false)
  })

  it('a retainage notice has its message: the send for approval tells the leader with the day its window closes, and Remind takes it as a notice (v2.7478)', async () => {
    const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }
    const withRetainage = (items: LienDeskItemRow[]) => {
      const d = data(J650, [], true)
      d.retainageRows = [retRow]
      d.retainage = buildLienRetainageQueue([retRow], items, TODAY)
      return d
    }
    saveDraftMock.mockClear()
    submitMock.mockClear()
    tellLeaderMock.mockClear()
    // The pane's send: the paper lands in Awaiting Master approval, and the leader is told after the write.
    const pane = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRetainage([])} initialKind="retainage" initialJobId="j650" leaderNameFor={() => 'Sam'} />)
    await settle()
    fireEvent.click(within(document.querySelector('[data-lien-desk-footer="retainage"]') as HTMLElement).getByRole('button', { name: /approve ▸/ }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(submitMock.mock.calls[0]).toEqual(['it-new', { status: 'awaiting_approval', reason: 'first_notice' }])
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledWith('it-new', '2026-10-05'))
    expect(await screen.findByText("Sent for approval. Malachi's phone has it.")).toBeTruthy()
    pane.unmount()
    // A message that does not go is said with its reason, and the paper is still sent.
    submitMock.mockClear()
    tellLeaderMock.mockClear()
    tellLeaderMock.mockImplementationOnce(async () => ({ ok: false, reason: 'Not a lien notice' }))
    const miss = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRetainage([])} initialKind="retainage" initialJobId="j650" leaderNameFor={() => 'Sam'} />)
    await settle()
    fireEvent.click(within(document.querySelector('[data-lien-desk-footer="retainage"]') as HTMLElement).getByRole('button', { name: /approve ▸/ }))
    expect(await screen.findByText('Sent for approval. The message to Sam did not go. The part of the app that tells the leader is waiting for its update. The paper is on the Dashboard. Tell Sam another way.')).toBeTruthy()
    expect(submitMock).toHaveBeenCalledTimes(1)
    miss.unmount()
    // The To do view's Remind: the retainage notice that waits is one of the papers, sent through the notice's own call.
    tellLeaderMock.mockClear()
    const awaiting = { id: 'ret1', job_id: 'j650', kind: 'retainage_53_057', months: [], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRetainage([awaiting])} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    const press = () => document.querySelector('[data-lien-next-up-remind]') as HTMLButtonElement
    expect(press().textContent).toBe('Remind Sam of 1 paper')
    fireEvent.click(press())
    const asked = await screen.findByText(/Sam gets one message for the notice\./)
    expect(asked.textContent).not.toContain('stays out')
    const confirms = screen.getAllByRole('button', { name: 'Remind Sam' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledTimes(1))
    expect(tellLeaderMock.mock.calls[0]).toEqual(['ret1', '2026-10-05', { remind: true }])
    expect(await screen.findByText('Sam was reminded of 1 paper.')).toBeTruthy()
  })

  it('a notice that waits on his signature has the reminder on the Board, with no paper awaiting approval: one press, one call for the lot, and what the function did not tell him of is named (v2.7491)', async () => {
    tellSignMock.mockClear()
    tellLeaderMock.mockClear()
    // Approved on his word and never signed: it stands in Approved · to sign (v2.7712), and the run holds it until he signs.
    const unsigned = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z', approved_by: 'u-taunya', approved_at: '2026-09-12T15:00:00Z', approval_mode: 'word', word_note: 'He said to send it', word_channel: 'phone' } as unknown as LienDeskItemRow
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [unsigned], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    // No row waits on an approval, so To do's waiting head has no press. The Board's Approved · to sign bin carries it, on its title line.
    expect(document.querySelector('[data-lien-next-up-remind]')).toBeNull()
    const press = () => document.querySelector('[data-lien-board-remind]') as HTMLButtonElement
    expect(document.querySelector('[data-lien-board-bin-title="notice:to_sign"]')!.contains(press())).toBe(true)
    expect(document.querySelectorAll('[data-lien-board-chips="notice:to_sign"] [data-lien-board-chip]')).toHaveLength(1)
    expect(document.querySelector('[data-lien-board-bin="notice:to_print"] [data-lien-board-bin-press]')).toBeNull()
    expect(press().textContent).toBe('Remind Sam of 1 paper ›')
    fireEvent.click(press())
    expect(await screen.findByText('Remind Sam of 1 paper?')).toBeTruthy()
    expect(screen.getByText(/Sam gets one message for the notice to sign\./)).toBeTruthy()
    expect(tellSignMock).not.toHaveBeenCalled()
    const confirms = screen.getAllByRole('button', { name: 'Remind Sam' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(tellSignMock).toHaveBeenCalledTimes(1))
    expect(tellSignMock.mock.calls[0]![0]).toEqual([{ itemId: 'it1', dueYmd: expect.any(String) }])
    // Not the notice's approval message: that one is refused for a paper already approved.
    expect(tellLeaderMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Sam was reminded of 1 paper.')).toBeTruthy()
    await waitFor(() => expect(press().textContent).toMatch(/^Reminded at \d{1,2}:\d{2}/))
    expect(press().disabled).toBe(true)
    view.unmount()
    // He signed between the list and the press: the function answers 200 with nothing told, and the desk says so.
    tellSignMock.mockResolvedValueOnce({ ok: true, told: { pushSent: 0, emailSent: false, leaderName: null, held: 0, said: 'Not waiting on a signature', told: 0 } })
    const again = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [unsigned], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    fireEvent.click(press())
    const confirmsAgain = await screen.findAllByRole('button', { name: 'Remind Sam' })
    fireEvent.click(confirmsAgain[confirmsAgain.length - 1]!)
    expect(await screen.findByText(/^Sam was not reminded\. 1 reminder did not send: .+ \(not waiting on a signature now\)\.$/)).toBeTruthy()
    expect(press().textContent).toBe('Remind Sam of 1 paper ›')
    again.unmount()
    // The leader's own desk has no such press: the notice is his to sign.
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [unsigned], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    expect(document.querySelector('[data-lien-board-remind]')).toBeNull()
  })

  it('a reminder says whether its text went: *A text went too.*, or in amber why none did, with the leader still reminded (v2.7495)', async () => {
    const unsigned = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z', approved_by: 'u-taunya', approved_at: '2026-09-12T15:00:00Z', approval_mode: 'word', word_note: 'He said to send it', word_channel: 'phone' } as unknown as LienDeskItemRow
    const remind = async () => {
      const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [unsigned], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
      await settle()
      fireEvent.click(document.querySelector('[data-lien-board-remind]') as HTMLButtonElement)
      // The window says a text goes too, before anything is sent.
      expect(await screen.findByText(/A text with the link goes too\./)).toBeTruthy()
      const confirms = screen.getAllByRole('button', { name: 'Remind Sam' })
      fireEvent.click(confirms[confirms.length - 1]!)
      return view
    }
    tellSignMock.mockResolvedValueOnce({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Sam', told: 1, textSent: 1, textSaid: null } })
    const went = await remind()
    expect(await screen.findByText('Sam was reminded of 1 paper. A text went too.')).toBeTruthy()
    went.unmount()
    tellSignMock.mockResolvedValueOnce({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Sam', told: 1, textSent: 0, textSaid: 'there is no mobile number on the account' } })
    await remind()
    expect(await screen.findByText('Sam was reminded of 1 paper. No text went: there is no mobile number on the account.')).toBeTruthy()
    // He was reminded, so the press reads when and is dead, as after any reminder that went.
    await waitFor(() => expect((document.querySelector('[data-lien-board-remind]') as HTMLButtonElement).disabled).toBe(true))
  })

  it('a chip on the Board, pointed at, says which job it is before any press: its name, address, customer and GC, and where its notice stands (v2.7381)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const chip = document.querySelector('[data-lien-board-chip="j650"]') as HTMLElement
    expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull()
    fireEvent.mouseEnter(chip)
    const card = document.querySelector('[data-lien-board-chip-card]') as HTMLElement
    expect(card.querySelector('[data-lien-board-card-title]')!.textContent).toBe('650 · AXO Schertz')
    expect(Array.from(card.querySelectorAll('[data-lien-board-card-fact]')).map((f) => [f.getAttribute('data-lien-board-card-fact'), f.textContent])).toEqual([
      ['address', '1204 Elwick Rd, Schertz, TX'],
      ['customer', 'AXO Schertz'],
      ['gc', 'Lowbeck Contracting'],
    ])
    // Its status is the Board's own: the column, the bin, and the one thing to know as its To do row says it.
    const status = card.querySelector('[data-lien-board-card-status]') as HTMLElement
    expect(status.textContent).toContain('Monthly noticeNeeds the owner')
    expect(card.querySelector('[data-lien-board-card-detail]')!.textContent).toBe((document.querySelector('[data-lien-next-up-row="notice:j650"] [data-lien-next-up-detail]') as HTMLElement).textContent!.replace(/^ · /, ''))
    expect(card.querySelector('[data-lien-board-card-door]')!.textContent).toMatch(/^Press to open /)
    // Pointing opens nothing: To do is still the view, with no window over it.
    expect(document.querySelector('[data-lien-do-now]')).not.toBeNull()
    expect(screen.queryByTestId('lien-paper-property-window')).toBeNull()
    fireEvent.mouseLeave(chip)
    await waitFor(() => expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull())
  })

  it('To do on a computer pins the Board and scrolls the list; stacked, the Board and the list scroll as one page and a pressed bin brings its rows up (punch list #352, PR 0; the Board since v2.7332)', async () => {
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const frame = () => document.querySelector('[data-lien-do-now]') as HTMLElement
    const list = () => document.querySelector('[data-lien-next-up="list"]') as HTMLElement
    expect(frame().getAttribute('data-lien-do-now')).toBe('pinned')
    expect(frame().style.gridTemplateRows).toBe('auto auto minmax(0, 1fr)')
    expect(list().getAttribute('data-scrolls')).toBe('yes')
    // The month, the find box and the list are all inside the one frame.
    expect(frame().contains(list())).toBe(true)
    view.unmount()

    const brought: Element[] = []
    const before = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) { brought.push(this) }
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" layout="stacked" />)
      await settle()
      expect(frame().getAttribute('data-lien-do-now')).toBe('one-page')
      expect(frame().style.overflowY).toBe('auto')
      expect(frame().style.gridTemplateRows).toBe('')
      expect(list().getAttribute('data-scrolls')).toBe('no')
      expect(list().style.overflowY).toBe('visible')
      expect(frame().contains(list())).toBe(true)
      // Opening the desk brings no rows up (the view tabs bring their own picked tab into view); a pressed bin does.
      const rowsBrought = () => brought.filter((el) => el.matches('[data-lien-next-up-group], [data-lien-next-up="empty"]'))
      expect(rowsBrought()).toHaveLength(0)
      const bin = frame().querySelector('button[data-lien-board-bin-head="notice:to_send"]') as HTMLButtonElement
      fireEvent.click(bin)
      await settle()
      expect(rowsBrought()).toHaveLength(1)
      expect(frame().contains(rowsBrought()[0]!)).toBe(true)
    } finally {
      Element.prototype.scrollIntoView = before
    }
  })

  it('To do on a computer is one page where the Board leaves the list too little room, the find box pinning with the way back; a pressed bin brings the page to the list (v2.7367, punch list #362 step 1)', async () => {
    // jsdom lays nothing out: give the frame a laptop's 751 px, the Board its 614 and the find box's bar its 47.
    const heightOf = (el: HTMLElement) => (el.hasAttribute('data-lien-do-now') ? 751 : el.hasAttribute('data-lien-board') ? 614 : el.hasAttribute('data-lien-do-now-bar') ? 47 : 0)
    const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return heightOf(this) } })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return heightOf(this) } })
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
      await settle()
      const frame = document.querySelector('[data-lien-do-now]') as HTMLElement
      const list = document.querySelector('[data-lien-next-up="list"]') as HTMLElement
      const bar = document.querySelector('[data-lien-do-now-bar]') as HTMLElement
      expect(frame.getAttribute('data-lien-do-now')).toBe('one-page')
      expect(frame.style.overflowY).toBe('auto')
      // One thing scrolls: the list is not its own scroller, and the find box is inside the bar that pins.
      expect(list.getAttribute('data-scrolls')).toBe('no')
      expect(bar.getAttribute('data-pins')).toBe('yes')
      expect(bar.style.position).toBe('sticky')
      expect(bar.querySelector('[data-testid="lien-desk-find-input"]')).not.toBeNull()
      expect(frame.contains(bar)).toBe(true)
      // A pressed bin brings the page to the Board's bottom edge, where the list starts under the pinned bar.
      const scrolled: unknown[] = []
      frame.scrollTo = ((o: unknown) => { scrolled.push(o) }) as typeof frame.scrollTo
      const boardEl = frame.querySelector('[data-lien-board]') as HTMLElement
      frame.getBoundingClientRect = () => ({ top: 140, bottom: 891, left: 0, right: 1400, width: 1400, height: 751, x: 0, y: 140, toJSON: () => ({}) })
      boardEl.getBoundingClientRect = () => ({ top: 140, bottom: 754, left: 0, right: 1400, width: 1400, height: 614, x: 0, y: 140, toJSON: () => ({}) })
      fireEvent.click(frame.querySelector('button[data-lien-board-bin-head="notice:to_send"]') as HTMLButtonElement)
      await settle()
      expect(scrolled).toEqual([{ top: 614, behavior: 'smooth' }])
    } finally {
      if (client) Object.defineProperty(Element.prototype, 'clientHeight', client)
      if (offset) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offset)
    }
  })

  it('To do is the first tab (punch list #82; Next up until v2.4630): its count, and a row\u2019s button opens the Notices pane on that job and pile', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    // On a computer the first tab carries the page's name and the count (v2.7465); the clock mark is drawn, and is no part of the tab's name.
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs[0]).toBe('⏱ Lien desk · 1 to do')
    expect(screen.getByRole('tab', { name: 'Lien desk · 1 to do' }).getAttribute('aria-selected')).toBe('true')
    // J650 has no owner on file: its one move is Find the owner.
    const row = document.querySelector('[data-lien-next-up-row="notice:j650"]') as HTMLElement
    expect(row.textContent).toContain('650 · AXO Schertz')
    fireEvent.click(within(row).getByRole('button', { name: 'Find the owner' }))
    await settle()
    expect(screen.getByRole('tab', { name: /^Monthly notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-lien-next-up="list"]')).toBeNull()
  })

  it('a Docsmit envelope that came back is a To do row opening the notice under Sent, whose head has the Deliveries filter and whose footer has the cost (the Docsmit train, 6b-2)', async () => {
    const sent = { id: 'r2', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'sent', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: 'f1', sent_at: '2026-09-14T16:00:00Z', printed_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T16:00:00Z', voided_at: null } as unknown as LienDeskItemRow
    // Every month noticed (v2.6624): a job with a month still due sits in To send for Master approval now, and this test is about the Sent pile's filter.
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sent], true)
    d.filingsByJob = { j650: [{ id: 'f1', job_id: 'j650', kind: 'notice', sends: [], voided_at: null } as never] }
    d.mailPiecesByFiling = { f1: [{ id: 'p2', kind: 'lien_notice_53_056', recipient: 'original_contractor', status: 'returned', usps_tracking: '9407 1118', mailed_at: '2026-09-15T00:30:00Z', delivered_at: null, signed_by: null, delivery_status: 'Return to Sender', source_ids: ['f1'], price: 9.85 }] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const row = document.querySelector('[data-lien-next-up-row="mail:p2"]') as HTMLElement
    expect(row.textContent).toContain('Docsmit · original contractor · returned to sender')
    fireEvent.click(within(row).getByRole('button', { name: 'Open the notice' }))
    await settle()
    expect(screen.getByRole('tab', { name: /^Monthly notices/ }).getAttribute('aria-selected')).toBe('true')
    const toggle = document.querySelector('[data-lien-pile-head="sent"] [data-lien-pile-deliveries]') as HTMLElement
    expect(toggle.textContent).toBe('Deliveries · 1')
    fireEvent.click(toggle)
    await settle()
    expect((document.querySelector('[data-lien-pile-deliveries]') as HTMLElement).getAttribute('data-lien-pile-deliveries')).toBe('on')
    expect((document.querySelector('[data-lien-pile-rows="sent"]') as HTMLElement).textContent).toContain('mailed through Docsmit · returned to sender')
    expect((document.querySelector('[data-lien-mail-cost]') as HTMLElement).textContent).toBe('Docsmit cost $9.85')
  })

  it('a door re-aims an open desk at the same job when its aim key changes (v2.4612)', async () => {
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={1} />)
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    expect(screen.getByRole('tab', { name: 'By date' }).getAttribute('aria-selected')).toBe('true')
    // The same job, pressed again from its Lien window: the tab is applied again.
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={2} />)
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Monthly notices/ }).getAttribute('aria-selected')).toBe('true')
    // A re-render with the same aim changes nothing.
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={2} />)
    await settle()
    expect(screen.getByRole('tab', { name: 'By date' }).getAttribute('aria-selected')).toBe('true')
  })

  // v2.7744: the address names a job its list does not hold. Each list answered with its own first row, the address lost the job, and nothing said so.
  const offListData = (): LienDeskData => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-08', deadline: '2026-09-30', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
    const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }
    const d = data(J650, [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.retainageRows = [retRow]
    d.retainage = buildLienRetainageQueue([retRow], [], TODAY)
    return d
  }
  const offListNote = () => document.querySelector('[data-lien-desk-off-list]') as HTMLElement | null
  const PANE: Record<'notice' | 'affidavit' | 'retainage', string> = { notice: '[data-lien-desk-pane]', affidavit: '[data-lien-affidavit-pane]', retainage: '[data-lien-retainage-pane]' }

  it('an address that names a job its list does not hold opens no other job on any of the three lists: the note says so, offers the Lien window and the address keeps the job until a row is picked (v2.7744)', async () => {
    for (const [kind, listName] of [['notice', 'Monthly notices'], ['affidavit', 'Lien affidavits'], ['retainage', 'Retainage notices']] as const) {
      const onAddressChange = vi.fn()
      const onOpenLienInstruments = vi.fn()
      const onOpenLienAffidavit = vi.fn()
      const onOpenCalendarJob = vi.fn()
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={offListData()} initialKind={kind} initialJobId="gone" onAddressChange={onAddressChange} onOpenLienInstruments={onOpenLienInstruments} onOpenLienAffidavit={onOpenLienAffidavit} onOpenCalendarJob={onOpenCalendarJob} />)
      await settle()
      // The list still holds its one job, and its pane is not open.
      expect(screen.getAllByRole('button', { name: /AXO Schertz/ }).length).toBeGreaterThan(0)
      expect(document.querySelector(PANE[kind])).toBeNull()
      const note = offListNote()!
      expect(note.getAttribute('data-lien-desk-off-list')).toBe(kind)
      expect(note.textContent).toBe(`The job this link names is not on the ${listName} list. Open its Lien window › shows where it stands.`)
      await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind, job: 'gone', pile: null }))
      // The Lien window is the job's, on the tab its list names.
      fireEvent.click(within(note).getByRole('button', { name: 'Open its Lien window ›' }))
      const door = kind === 'affidavit' ? onOpenLienAffidavit : kind === 'retainage' ? onOpenCalendarJob : onOpenLienInstruments
      expect(door).toHaveBeenCalledWith('gone')
      // A picked row is the reader's: its pane opens, the note goes, and the address is the list's own again.
      fireEvent.click(screen.getAllByRole('button', { name: /AXO Schertz/ })[0]!)
      await waitFor(() => expect(document.querySelector(PANE[kind])).not.toBeNull())
      expect(offListNote()).toBeNull()
      await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind, job: kind === 'notice' ? 'j650' : null, pile: null }))
      cleanup()
    }
  })

  it('a job off its list that another list holds: the note offers that list first, and the press opens the job there (v2.7744)', async () => {
    const d = offListData()
    // Off Monthly notices, on Lien affidavits.
    d.rows = []
    d.queue = buildLienDeskQueue([], [], { lowbeck: 'ask' }, TODAY)
    const onAddressChange = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="notice" initialJobId="j650" onAddressChange={onAddressChange} />)
    await settle()
    expect(document.querySelector(PANE.notice)).toBeNull()
    const note = offListNote()!
    expect(note.textContent).toBe('650 · AXO Schertz is not on the Monthly notices list. Open it on Lien affidavits › or Open its Lien window ›')
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'notice', job: 'j650', pile: null }))
    fireEvent.click(within(note).getByRole('button', { name: 'Open it on Lien affidavits ›' }))
    await waitFor(() => expect(document.querySelector(PANE.affidavit)).not.toBeNull())
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Lien affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(offListNote()).toBeNull()
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'affidavit', job: null, pile: null }))
  })

  it('a door that re-aims an open desk at a job its list does not hold closes the open pane; a job the list holds opens as before, and leaving the list drops the note for good (v2.7744)', async () => {
    const onAddressChange = vi.fn()
    const d = offListData()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" initialJobId="j650" onAddressChange={onAddressChange} />)
    await settle()
    // On its list: the pane, no note, and the address spends the job as it always did.
    await waitFor(() => expect(document.querySelector(PANE.affidavit)).not.toBeNull())
    expect(offListNote()).toBeNull()
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'affidavit', job: null, pile: null }))
    for (const kind of ['affidavit', 'retainage', 'notice'] as const) {
      view.rerender(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind={kind} initialJobId={`gone-${kind}`} onAddressChange={onAddressChange} />)
      await settle()
      await waitFor(() => expect(offListNote()?.getAttribute('data-lien-desk-off-list')).toBe(kind))
      expect(document.querySelector(PANE[kind])).toBeNull()
      await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind, job: `gone-${kind}`, pile: null }))
    }
    // Another list, then back: the note is gone and Monthly notices opens its own first row.
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage notices/ }))
    await settle()
    expect(offListNote()).toBeNull()
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Monthly notices/ }))
    await settle()
    expect(offListNote()).toBeNull()
    await waitFor(() => expect(document.querySelector(PANE.notice)).not.toBeNull())
  })

  it('on one column the note tops the list, since no pane is open to hold it (v2.7744)', async () => {
    const onAddressChange = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={offListData()} layout="stacked" initialKind="affidavit" initialJobId="gone" onAddressChange={onAddressChange} />)
    await settle()
    const column = document.querySelector('[data-lien-desk-find-column]') as HTMLElement
    expect(column.querySelector('[data-lien-desk-off-list="affidavit"]')).not.toBeNull()
    expect(within(column).getAllByRole('button', { name: /AXO Schertz/ }).length).toBeGreaterThan(0)
    expect(document.querySelector(PANE.affidavit)).toBeNull()
    await waitFor(() => expect(onAddressChange).toHaveBeenLastCalledWith({ kind: 'affidavit', job: 'gone', pile: null }))
  })

  it('four views (three from punch list #82, PR 5; By job since v2.7219): To do, By date, By paper, By job; By paper holds the three papers and reopens on the last one', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const views = () => within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab').map((t) => t.textContent)
    // On a computer the three after the title read one word each (v2.7784) and keep the view's name as the tab's own.
    expect(views()).toEqual(['⏱ Lien desk · 1 to do', 'Date', 'Paper', 'Job'])
    expect(within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab').slice(1).map((t) => t.getAttribute('aria-label'))).toEqual(['By date', 'By paper', 'By job'])
    // On To do and on By date the three papers' tabs are not drawn.
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    await settle()
    const paper = within(screen.getByRole('tablist', { name: 'Kind of paper' }))
    expect(paper.getAllByRole('tab').map((t) => t.textContent?.replace(/ · \d+$/, ''))).toEqual(['Monthly notices', 'Lien affidavits', 'Retainage notices'])
    expect(paper.getByRole('tab', { name: /^Monthly notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'By paper' }).getAttribute('aria-selected')).toBe('true')
    // Retainage keeps its named place; leaving and coming back lands on it again.
    fireEvent.click(paper.getByRole('tab', { name: /^Retainage notices/ }))
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage notices/ }).getAttribute('aria-selected')).toBe('true')
    // By job is a view of its own (v2.7219): no row of papers under it, and By paper still reopens on the paper last looked at.
    fireEvent.click(screen.getByRole('tab', { name: 'By job' }))
    await settle()
    expect(screen.getByRole('tab', { name: 'By job' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'By paper' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage notices/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('a door that names the timeline lands on By job, with no row of papers (v2.7219; the address word is still timeline)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="timeline" />)
    await settle()
    expect(screen.getByRole('tab', { name: 'By job' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'By paper' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
  })

  it('a door that names a kind still lands on its list, inside By paper (punch list #82, PR 5)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" />)
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Lien affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /^By paper/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('the empty affidavit list names its press: a find clears, nothing close opens By date (punch list #184, sweep C)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" />)
    await settle()
    const empty = () => document.querySelector('[data-lien-affidavit-empty] [data-empty-state]') as HTMLElement
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: 'zzz' } })
    expect(document.querySelector('[data-lien-affidavit-empty]')!.getAttribute('data-lien-affidavit-empty')).toBe('find')
    expect(empty().textContent).toBe('Nothing matches “zzz”. Clear the find')
    fireEvent.click(within(empty()).getByRole('button', { name: 'Clear the find' }))
    expect((screen.getByTestId('lien-desk-find-input') as HTMLInputElement).value).toBe('')
    expect(empty().textContent).toBe('No affidavit window closes within 30 days. By date › shows what falls due later.')
    fireEvent.click(within(empty()).getByRole('button', { name: 'By date ›' }))
    await settle()
    expect(screen.getByRole('tab', { name: 'By date' }).getAttribute('aria-selected')).toBe('true')
  })

  it('a picked affidavit or retainage pile that empties under the list offers Show every pile (punch list #184, sweep C)', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }
    const full = data(J650, [], true)
    full.affidavitRows = [affRow]
    full.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    full.retainageRows = [retRow]
    full.retainage = buildLienRetainageQueue([retRow], [], TODAY)
    const emptied = data(J650, [], true)
    const affLabel = LIEN_AFFIDAVIT_PILES.find((p) => p.key === full.affidavits.entries[0]!.pile)!.label
    const retLabel = LIEN_RETAINAGE_PILES.find((p) => p.key === full.retainage.entries[0]!.pile)!.label
    for (const [kind, label, hook] of [['affidavit', affLabel, 'data-lien-affidavit-empty'], ['retainage', retLabel, 'data-lien-retainage-empty']] as const) {
      const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={full} initialKind={kind} />)
      await settle()
      fireEvent.click(screen.getByRole('button', { name: `${label} · 1` }))
      view.rerender(<LienDesk {...baseProps} authRole="assistant" data={emptied} initialKind={kind} />)
      await settle()
      const empty = document.querySelector(`[${hook}] [data-empty-state]`) as HTMLElement
      expect(empty.textContent).toBe('Nothing in this pile. Show every pile ›')
      fireEvent.click(within(empty).getByRole('button', { name: 'Show every pile ›' }))
      expect(screen.queryByRole('button', { name: `${label} · 0` })).toBeNull()
      cleanup()
    }
  })

  it('the empty retainage list under a find offers Clear the find (punch list #184, sweep C)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="retainage" />)
    await settle()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: 'zzz' } })
    const empty = document.querySelector('[data-lien-retainage-empty="find"] [data-empty-state]') as HTMLElement
    expect(empty.textContent).toBe('Nothing matches “zzz”. Clear the find')
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear the find' }))
    expect(document.querySelector('[data-lien-retainage-empty]')).toBeNull()
  })

  it('lists the job under Needs the owner, blocks the send, and offers the Find the owner door', async () => {
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} onOpenEditJob={onOpenEditJob} />)
    await settle()
    // The desk is a page's region since punch list #182 (PR 3 took the window frame): no dialog, no status-bar padding of its own.
    expect(screen.getByRole('region', { name: 'Lien desk' })).toBeTruthy()
    // the tab row is the sideways scroller that fades a cut end (v2.4441); a row that fits carries no fade
    const kinds = document.querySelector('[data-lien-desk-kinds]') as HTMLElement
    expect(kinds.getAttribute('role')).toBe('tablist')
    expect(kinds.style.maskImage ?? '').toBe('')
    expect(screen.getByRole('button', { name: /Needs the owner/ }).textContent).toContain('1')
    expect(screen.getAllByText(/650 · AXO Schertz/).length).toBeGreaterThan(0)
    // The job's lien timeline (v2.3761) sits under the title: the path, today marked, one next step.
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    expect(timeline).toBeTruthy()
    expect(timeline.textContent).toMatch(/Find the owner, then send the Jun( \+ \w+)* notice — tomorrow\./)
    expect(timeline.querySelector('[data-lien-timeline-step="notice:2026-06"]')?.textContent).toContain('tomorrow · owner of record missing')
    expect(timeline.querySelector('[data-lien-timeline-step="affidavit"]')?.textContent).toContain('§ 53.052')
    expect(timeline.querySelector('[data-lien-timeline-step="retainage"]')?.textContent).toContain('30 days after our contract ends')
    expect(timeline.querySelector('[data-lien-timeline-step="retainage"]')?.textContent).not.toContain('set the date') // the door waits for the contract-end field (v2.3753)
    // Readiness: owner missing → the door, and the send button is disabled with the reason.
    // Two doors read Find the owner › since v2.7321: the band's press (the property window) and the gate's (Edit Job). This is the gate's.
    fireEvent.click(screen.getAllByRole('button', { name: 'Find the owner ›' }).find((b) => !b.closest('[data-lien-desk-timeline]'))!)
    // It opens Edit Job at the Property record, as its hover says (punch list #87 E).
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'property-record')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    // The gates (v2.3657): the verdict is the headline, gate 1 is the one blocker, and its detail is numbered to match.
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe("The four gates✗ Can't go out yet · 1 blocker · 1 to check")
    expect((gatesBox.querySelector('[data-gate="owner"]') as HTMLElement).getAttribute('data-tone')).toBe('blocker')
    // A gate that is not clear opens on its own (v2.4718); the clear ones stay folded until asked.
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1Owner of record')
    expect(gatesBox.querySelector('[data-gate-detail="gc"]')).toBeNull()
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /to approve ▸/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(screen.getByRole('button', { name: 'Go to gate 1 ▴' })).toBeTruthy()
    // Months: all three open windows ticked by default; the document names them.
    const boxes = screen.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)
    expect(boxes.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/Work months June, July and August 2026/)).toBeTruthy()
    // the form's title — counsel's commercial letter on page 1 names it too (v2.3828), so there are two
    expect(screen.getAllByText(/Notice of Claim for Unpaid Labor or Materials/).length).toBeGreaterThanOrEqual(1)
    // Blocked (v2.3776): no routing news about a send that cannot happen yet — the row is the gate and its door.
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).not.toContain('first notice')
  })

  it('the verdict band is a press (v2.7321): one row, the mark and the words, and Find the owner › at the right opens the property record in a window over the desk; the office waits on the leader with no press', async () => {
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} onOpenEditJob={onOpenEditJob} />)
    await settle()
    const band = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-verdict]') as HTMLElement
    expect(band.getAttribute('data-tone')).toBe('red')
    expect(band.getAttribute('data-lien-timeline-verdict-act')).toBe('gate:owner')
    expect(band.querySelector('[data-lien-timeline-mark]')?.textContent).toBe('✗')
    // One row: the words in bold, then the press. The Waiting on sentence rides in the press's title, not a second row.
    expect(band.textContent).toMatch(/^Next on the path✗Find the owner, then send the Jun( \+ \w+)* notice — tomorrow\./)
    expect(band.textContent).toMatch(/Find the owner ›$/)
    expect(band.querySelector('[data-lien-timeline-waiting]')).toBeNull()
    const press = band.querySelector('[data-lien-timeline-act="gate:owner"]') as HTMLButtonElement
    expect(press.getAttribute('title')).toBe('Waiting on us — the owner’s name for the notice')
    fireEvent.click(press)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect(onOpenEditJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    // The office on a notice waiting on the leader: the band wears his name as a tag, and no press.
    cleanup()
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" leaderNameFor={() => 'Malachi Whites'} data={data(J650, [awaiting], true)} />)
    await settle()
    const waiting = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-verdict]') as HTMLElement
    expect(waiting.textContent).toContain('Approve the Jun')
    expect(waiting.querySelector('[data-lien-timeline-act]')).toBeNull()
    expect(waiting.querySelector('[data-lien-timeline-waiting-tag]')?.textContent).toBe('Waiting on Malachi Whites')
  })

  it('with the owner on file the office can send for approval or record the leader’s spoken word', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /To send/ }).textContent).toContain('1')
    // The passing gate is a chip; the whole sentence rides in its tooltip (v2.3522).
    expect(screen.getByTitle(/Owner of record with a mailing address — Elwick Holdings LLC/)).toBeTruthy()
    expect((document.querySelector('[data-gate="owner"]') as HTMLElement).textContent).toBe('1Owner of record✓ Elwick Holdings LLC')
    expect((screen.getByRole('button', { name: /to approve ▸/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("One line on the leader’s phone · first notice we've sent this GC")
    // One press per footer (v2.7324): his word waits behind He already okayed it ▾; the row runs what the old press ran.
    expect(screen.queryByRole('button', { name: /said to send it/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'He already okayed it ▾' }))
    const menu = screen.getByRole('menu', { name: 'He already okayed it. Pick how.' })
    expect(within(menu).getAllByRole('menuitem').map((r) => r.querySelector('strong')?.textContent)).toEqual(['The leader said to send it…', 'He signed the paper…'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: /said to send it/ }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByText('by phone')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve on his word/ })).toBeTruthy()
  })

  it('the scrolled strip says only what is out of view and every chip is a press (v2.7318): one red owner chip opens the property record at the owner, no Can\u2019t go out yet, and no next chip while it repeats the blocker', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const pane = document.querySelector('[data-lien-desk-pane]') as HTMLElement
    expect(document.querySelector('[data-lien-desk-strip]')).toBeNull()
    fireEvent.scroll(pane, { target: { scrollTop: 300 } })
    const strip = document.querySelector('[data-lien-desk-strip]') as HTMLElement
    expect(strip).toBeTruthy()
    const chips = Array.from(strip.querySelectorAll<HTMLElement>('[data-lien-strip-chip]'))
    // The blocker is red, the unknown kind an amber check; the months and the claim are quiet presses.
    expect(chips.map((c) => c.textContent)).toEqual(['Owner of record missing \u203a', 'Property kind unknown \u203a', 'Jun + Jul + Aug \u203a', 'Claim $33,500 \u203a'])
    expect(chips.map((c) => c.getAttribute('data-tone'))).toEqual(['red', 'amber', 'quiet', 'quiet'])
    expect(chips.every((c) => c.tagName === 'BUTTON')).toBe(true)
    expect(strip.textContent).not.toContain("Can't go out yet")
    // The timeline's *Find the owner, then send\u2026* says what the owner chip says, so the strip carries no next chip.
    expect(strip.querySelector('[data-lien-desk-strip-next]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show gates \u25b4' })).toBeTruthy()
    fireEvent.click(strip.querySelector('[data-lien-strip-chip="gate:owner"]') as HTMLElement)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
  })

  it('the scrolled strip on a ready notice (v2.7318): one green Ready to go out \u203a, no red chip, and the next chip stays since it adds the day', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    fireEvent.scroll(document.querySelector('[data-lien-desk-pane]') as HTMLElement, { target: { scrollTop: 300 } })
    const strip = document.querySelector('[data-lien-desk-strip]') as HTMLElement
    expect((strip.querySelector('[data-lien-strip-chip="ready"]') as HTMLElement).textContent).toBe('Ready to go out \u203a')
    expect(strip.querySelectorAll('[data-lien-strip-chip^="gate:"]').length).toBe(0)
    // The next chip keeps the timeline's own tone (red: due tomorrow) and its words, with the door mark.
    expect(strip.querySelector('[data-lien-desk-strip-next]')?.textContent).toMatch(/^Draft the Jun( \+ \w+)* notice \u2014 tomorrow \u203a$/)
  })

  it('a phone\u2019s header is one row with More; the doors it held are rows of the sheet and open what they open on a computer (punch list #352, PR 1)', { timeout: 30000 }, async () => {
    // A computer keeps its header: the doors are in the bar and there is no More.
    const onOpenOwnerRecords = vi.fn()
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-more="door"]')).toBeNull()
    expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
    // The records window's door is a row of the call window on a computer (v2.7780), so the bar has the caller's door and no press for the records.
    expect(document.querySelector('[data-lien-caller-door]')).toBeTruthy()
    expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
    expect(document.querySelector('[data-lien-desk-share]')).toBeTruthy()
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" layout="stacked" onOpenOwnerRecords={onOpenOwnerRecords} backDoor={<button type="button">← Pipeline</button>} />)
      await settle()
      const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
      const more = bar.querySelector('[data-lien-desk-more="door"]') as HTMLButtonElement
      expect(more.getAttribute('aria-label')).toBe('More')
      expect(more.style.height).toBe('44px')
      // v2.7322 trimmed the computer's bar; a phone keeps its own rows: the 0.4rem row gap, its own padding, and no break on To do.
      expect(bar.style.rowGap).toBe('0.4rem')
      expect(bar.style.padding).toBe('0.15rem 0.6rem 0.5rem')
      expect(bar.querySelector('[data-lien-desk-header-break]')).toBeNull()
      // None of the doors is in the bar any more.
      expect(within(bar).queryByTestId('lien-rules-door')).toBeNull()
      expect(within(bar).queryByTestId('lien-owner-records-door')).toBeNull()
      expect(bar.querySelector('[data-lien-desk-share]')).toBeNull()
      expect(bar.querySelector('[data-lien-caller-door]')).toBeNull()
      expect(bar.querySelector('[data-lien-desk-run]')).toBeNull()
      // The three views are a thumb tall and share the width.
      for (const tab of bar.querySelectorAll('[data-lien-desk-view]')) expect((tab as HTMLElement).style.minHeight).toBe('44px')
      // A phone keeps its title on its own row, with its press, and its first tab reads To do and the count (v2.7465): the name in the tab is a computer's.
      const title = within(bar).getByRole('button', { name: 'Lien desk: open To do at the Board' })
      expect(title.textContent).toBe('⏱ Lien desk')
      expect(title.closest('h2')?.hasAttribute('data-lien-desk-heading')).toBe(false)
      expect(within(within(bar).getByRole('tablist', { name: 'View' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['To do · 1', 'By date', 'By paper', 'By job'])
      const phoneFirst = within(bar).getByRole('tab', { name: 'To do · 1' })
      expect(phoneFirst.hasAttribute('data-lien-desk-title')).toBe(false)
      expect(phoneFirst.style.fontSize).toBe('0.875rem')
      expect(phoneFirst.style.fontWeight).toBe('600')

      fireEvent.click(more)
      const sheet = screen.getByRole('dialog', { name: 'More on the Lien desk' })
      expect([...sheet.querySelectorAll('[data-lien-desk-more-row]')].map((r) => r.getAttribute('data-lien-desk-more-row'))).toEqual(['rules', 'caller', 'legend', 'share', 'owner_records'])

      // A row closes the sheet and opens its door.
      fireEvent.click(within(sheet).getByRole('button', { name: /An owner asked for records/ }))
      expect(onOpenOwnerRecords).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog', { name: 'More on the Lien desk' })).toBeNull()

      fireEvent.click(more)
      fireEvent.click(within(screen.getByRole('dialog', { name: 'More on the Lien desk' })).getByRole('button', { name: /§ Rules/ }))
      expect(screen.queryByRole('dialog', { name: 'More on the Lien desk' })).toBeNull()
      // The window is a lazy chunk that carries every help guide; give its first import room.
      expect(await screen.findByTestId('lien-rules-modal', undefined, { timeout: 15000 })).toBeTruthy()
    } finally {
      window.matchMedia = before
    }
  })

  it('the Board tops To do (v2.7332): two columns and four tiles on a computer, stacked on a phone, no month bar and no rails; a pressed bin narrows the list and Show every row puts it back', async () => {
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    expect(screen.queryByTestId('lien-month-bar')).toBeNull()
    expect(screen.queryByTestId('lien-step-rails')).toBeNull()
    const board = document.querySelector('[data-lien-board]') as HTMLElement
    expect(board.getAttribute('data-lien-board-layout')).toBe('columns')
    expect(board.querySelectorAll('[data-lien-board-tile]')).toHaveLength(4)
    expect(Array.from(board.querySelectorAll('[data-lien-board-column="notice"] [data-lien-board-bin]')).map((el) => el.getAttribute('data-stage'))).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent'])
    expect(Array.from(board.querySelectorAll('[data-lien-board-column="affidavit"] [data-lien-board-bin]')).map((el) => el.getAttribute('data-stage'))).toEqual(['needs_property', 'needs_notice', 'to_send', 'awaiting', 'ready', 'filed', 'served'])
    // J650 is one chip in the notice column. No bin is lit as the busiest since v2.7714.
    const chip = board.querySelector('[data-lien-board-chip="j650"][data-kind="notice"]') as HTMLElement
    const bin = chip.closest('[data-lien-board-bin]') as HTMLElement
    expect(board.querySelector('[data-lit]')).toBeNull()
    const binLabel = bin.querySelector('[data-lien-board-bin-head] > span')!.textContent!
    // A pressed bin narrows the list under the Board to its jobs; the line says so; Show every row puts it back.
    fireEvent.click(within(bin).getByRole('button', { name: new RegExp(`^${binLabel}`) }))
    expect(bin.getAttribute('data-picked')).toBe('yes')
    expect(screen.getByText(`Showing 1 row in ${binLabel}.`)).toBeTruthy()
    expect(document.querySelectorAll('[data-lien-next-up-row]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(document.querySelector('[data-lien-board-pick]')).toBeNull()
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" layout="stacked" />)
      await settle()
      const phone = document.querySelector('[data-lien-board]') as HTMLElement
      expect(phone.getAttribute('data-lien-board-layout')).toBe('stacked')
      // Stacked, the crossing arrow is not drawn.
      expect(phone.querySelectorAll('[data-lien-board-arrow][data-kind="cross"]')).toHaveLength(0)
    } finally {
      window.matchMedia = before
    }
  })

  it('the Board’s second tile counts what waits on the leader, to approve and to sign (v2.7448): its line names both parts, a press narrows To do to those rows, and Show every row puts the list back', async () => {
    // Four notices, one a job. One awaits approval. One is approved on the leader's word and not signed. One is approved and signed. One is printed.
    const sent = { cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' }
    const approved = { ...sent, status: 'approved', approved_by: 'u-sam', approved_at: '2026-09-12T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '' }
    const signed = { signed_by: 'u-sam', signed_at: '2026-09-12T15:00:00Z', signer_printed_name: 'Sam', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}) }
    const item = (id: string, job: string, over: Record<string, unknown>) => ({ id, job_id: job, kind: 'notice_53_056', months: ['2026-07'], fields: {}, ...over }) as unknown as LienDeskItemRow
    const items = [
      item('it1', 'j650', { ...sent, status: 'awaiting_approval' }),
      item('it2', 'j651', { ...approved, approved_by: 'u-taunya', approval_mode: 'word', word_note: 'Sam said send it', word_channel: 'phone' }),
      item('it3', 'j652', { ...approved, ...signed }),
      item('it4', 'j653', { ...approved, ...signed, printed_at: '2026-09-13T16:00:00Z' }),
    ]
    // The signed one is another GC's, so each approved notice keeps a row of its own (two at one GC fold into the GC's row).
    const d = data([row('j650', '2026-07', '2026-10-15'), row('j651', '2026-07', '2026-10-15'), row('j652', '2026-07', '2026-10-15', { gc_customer_id: 'zzb' }), row('j653', '2026-07', '2026-10-15')], items, true)
    d.jobsById.j650 = { ...d.jobsById.j650!, master_user_id: 'u-sam' } as NonNullable<typeof d.jobsById.j650>
    d.jobsById.j651 = { ...d.jobsById.j650!, id: 'j651', hcp_number: '651', job_name: 'Palomino Trail' }
    d.jobsById.j652 = { ...d.jobsById.j650!, id: 'j652', hcp_number: '652', job_name: 'Quarry Bend', gc_customer_id: 'zzb' }
    d.jobsById.j653 = { ...d.jobsById.j650!, id: 'j653', hcp_number: '653', job_name: 'Heron Ct' }
    d.gcsById = { ...d.gcsById, zzb: { ...d.gcsById.lowbeck!, id: 'zzb', name: 'ZZ Builders' } }
    const tileWords = (key: string) => ['figure', 'label', 'line'].map((part) => document.querySelector(`[data-lien-board-tile="${key}"] [data-lien-board-tile-${part}]`)?.textContent)
    const bin = (stage: string) => document.querySelector(`[data-lien-board-bin="notice:${stage}"]`) as HTMLElement
    const rowKeys = () => Array.from(document.querySelectorAll('[data-lien-next-up-row]')).map((r) => r.getAttribute('data-lien-next-up-row')).sort()
    const lineOf = (key: string) => (document.querySelector(`[data-lien-next-up-row="${key}"] [data-lien-next-up-line]`) as HTMLElement).textContent
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    // The second tile is one count of what waits on the leader: the paper he has yet to approve and the approved notice he has yet to sign.
    expect(tileWords('waiting')).toEqual(['2', 'waiting on Sam', '1 to approve · 1 to sign'])
    // The third tile counts the two bins under it, and reads as the press that opens them. The unsigned notice is the second tile's alone (v2.7712).
    expect(tileWords('in_mail')).toEqual(['2', 'to print and mail', '1 to print · 1 to mail'])
    expect(['awaiting', 'to_sign', 'to_print', 'in_mail'].map((stage) => [bin(stage).querySelector('[data-lien-board-bin-head] > span')!.textContent, bin(stage).querySelector('[data-lien-board-count]')!.textContent])).toEqual([
      ['Awaiting Master approval', '1'],
      ['Approved · to sign', '1'],
      ['Approved · to print', '1'],
      ['Approved · to mail', '1'],
    ])
    // The title bar's door, which counted the unsigned notice a third way (*1 for Sam to sign*), is gone (v2.7490). The bins say it: one notice stands in Approved · to sign with the office's reminder, and Approved · to print holds the one its press takes, one number for both (v2.7712). The bin under it has the run again, named for its mail numbers.
    expect(document.querySelector('[data-lien-desk-run]')).toBeNull()
    const print = document.querySelector('[data-lien-board-bin="notice:to_print"]') as HTMLElement
    expect(within(print).getByRole('button', { name: 'Print and mail 1 notice' }).parentElement!.getAttribute('data-lien-board-bin-title')).toBe('notice:to_print')
    expect(document.querySelector('[data-lien-board-bin-press="notice:in_mail"]')!.textContent).toBe('Enter mail numbers · 1')
    expect(print.querySelector('[data-lien-board-print-left]')).toBeNull()
    expect(print.querySelector('[data-lien-board-count]')!.textContent).toBe('1')
    expect(document.querySelector('[data-lien-board-bin-title="notice:to_sign"] [data-lien-board-remind]')!.textContent).toContain('Remind Sam')
    // Since v2.7456 (punch list #362, step 4) what is due later than a week waits under one line, Later, while something needs someone now: one press shows its rows.
    expect(rowKeys()).toEqual(['notice:j650'])
    fireEvent.click(document.querySelector('[data-lien-next-up-later-press]') as HTMLButtonElement)
    // Every row is on the list. An approved notice's row reads its bin, then only what the bin does not say.
    expect(rowKeys()).toEqual(['notice:j650', 'notice:j651', 'notice:j652', 'notice:j653'])
    // The unsigned one's row starts with its own bin since v2.7712.
    expect(lineOf('notice:j651')).toContain('Approved · to sign · not printed · not signed, waits on Sam')
    expect(lineOf('notice:j652')).toContain('Approved · to print · not printed')
    expect(lineOf('notice:j652')).not.toContain('not signed')
    expect(lineOf('notice:j653')).toContain('Approved · to mail · signed · not mailed')
    // The tile's press narrows the list to the two rows it counted. The signed notice and the printed one wait on nobody's signature.
    fireEvent.click(document.querySelector('button[data-lien-board-tile="waiting"]') as HTMLButtonElement)
    expect(document.querySelector('[data-lien-board-pick-words]')!.textContent).toBe('Showing 2 rows waiting on Sam.')
    expect(rowKeys()).toEqual(['notice:j650', 'notice:j651'])
    expect(bin('awaiting').getAttribute('data-picked')).toBe('yes')
    expect(bin('to_sign').getAttribute('data-picked')).toBe('yes')
    expect(bin('to_print').getAttribute('data-picked')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(document.querySelector('[data-lien-board-pick]')).toBeNull()
    expect(rowKeys()).toEqual(['notice:j650', 'notice:j651', 'notice:j652', 'notice:j653'])
    desk.unmount()

    // On a phone the row's words are the bin's name, then who has yet to sign.
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" layout="stacked" leaderNameFor={() => 'Sam'} />)
      await settle()
      const subOf = (key: string) => (document.querySelector(`[data-lien-next-up-row="${key}"] [data-lien-next-up-sub]`) as HTMLElement).textContent ?? ''
      expect(subOf('notice:j651')).toContain('Approved · to print · not signed, waits on Sam')
      expect(subOf('notice:j652').startsWith('Approved · to print')).toBe(true)
      expect(subOf('notice:j652')).not.toMatch(/not printed|not signed/)
    } finally {
      window.matchMedia = before
    }
  })

  it('a chip is a zoom (v2.7333): each destination kind opens its own door, and the job number on a To do row and a By paper row is the same press', async () => {
    const onOpenLienInstruments = vi.fn()
    const onZoomAddress = vi.fn()
    const chip = (jobId: string, kind: 'notice' | 'affidavit') => document.querySelector(`[data-lien-board-chip="${jobId}"][data-kind="${kind}"]`) as HTMLButtonElement
    // Needs the owner → the property record, opened at the owner, over To do.
    let desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [], true)} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} onZoomAddress={onZoomAddress} />)
    await settle()
    // The chip's name still says where its press goes; since v2.7381 the card says it on hover, in place of the browser's tip.
    expect(chip('j650', 'notice').getAttribute('aria-label')).toContain('Open the property record at the owner')
    fireEvent.click(chip('j650', 'notice'))
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect(onZoomAddress).not.toHaveBeenCalled()
    desk.unmount()
    // The same press on the To do row's number; the name keeps the job's door.
    const onOpenJob = vi.fn()
    desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [], true)} initialKind="next" onOpenJob={onOpenJob} onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    const zoom = screen.getByTestId('lien-next-up-zoom-j650')
    expect(zoom.textContent).toBe('650')
    expect(zoom.getAttribute('title')).toBe('Open the property record at the owner')
    fireEvent.click(zoom)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    fireEvent.click(screen.getByTestId('lien-next-up-job-j650'))
    expect(onOpenJob).toHaveBeenCalledWith('j650')
    desk.unmount()
    // To send → the notice on By paper, as an entry of its own through the page.
    desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} onZoomAddress={onZoomAddress} />)
    await settle()
    expect(chip('j650', 'notice').getAttribute('aria-label')).toContain('Open the notice')
    fireEvent.click(chip('j650', 'notice'))
    await settle()
    expect(onZoomAddress).toHaveBeenCalledWith({ kind: 'notice', job: 'j650', pile: 'to_draft' })
    expect(screen.getByRole('tab', { name: /^By paper/ }).getAttribute('aria-selected')).toBe('true')
    expect(Array.from(document.querySelectorAll('button[aria-current="true"]')).some((b) => (b.textContent ?? '').includes('650'))).toBe(true)
    desk.unmount()
    // Approved · to mail → the run on that envelope, open on its mail numbers.
    const printed = { id: 'it-p', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T14:20:00Z', approval_mode: 'manual', printed_at: '2026-09-14T15:00:00Z', created_at: '2026-09-14T14:00:00Z', voided_at: null, sent_at: null, sent_filing_id: null, hold_reason: null, hold_until: null, hold_note: null } as unknown as LienDeskItemRow
    desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [printed], true)} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} onZoomAddress={onZoomAddress} />)
    await settle()
    expect(chip('j650', 'notice').getAttribute('aria-label')).toContain('Open the run on this envelope')
    fireEvent.click(chip('j650', 'notice'))
    expect(await screen.findByRole('dialog', { name: 'Enter mail numbers' })).toBeTruthy()
    desk.unmount()
    // Ready to file → the affidavit pane; Filed → the job's Lien window.
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: true, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: true, has_legal: true, homestead: false, desk_item_id: 'it-a', desk_status: 'approved' }
    const affItem = (status: string, over: Record<string, unknown> = {}) => ({ id: 'it-a', job_id: 'j650', kind: 'affidavit', months: [], status, fields: {}, created_at: '2026-09-10T14:00:00Z', voided_at: null, sent_at: null, ...over }) as unknown as LienDeskItemRow
    const withAff = (status: string, over: Record<string, unknown> = {}) => {
      const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [], true)
      d.affidavitRows = [affRow]
      d.affidavits = buildLienAffidavitQueue([affRow], [affItem(status, over)], TODAY)
      return d
    }
    desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withAff('approved')} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} onZoomAddress={onZoomAddress} />)
    await settle()
    expect(chip('j650', 'affidavit').closest('[data-lien-board-bin]')!.getAttribute('data-lien-board-bin')).toBe('affidavit:ready')
    fireEvent.click(chip('j650', 'affidavit'))
    await settle()
    expect(onZoomAddress).toHaveBeenLastCalledWith({ kind: 'affidavit', job: 'j650', pile: null })
    expect(screen.getByRole('tab', { name: /Lien affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(Array.from(document.querySelectorAll('button[aria-current="true"]')).some((b) => (b.textContent ?? '').includes('650'))).toBe(true)
    desk.unmount()
    desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withAff('sent', { sent_at: '2026-09-12T14:00:00Z' })} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} onZoomAddress={onZoomAddress} />)
    await settle()
    // A filed affidavit with no copies owed stands in Served (punch list #366); its chip still opens the job's Lien window.
    expect(chip('j650', 'affidavit').closest('[data-lien-board-bin]')!.getAttribute('data-lien-board-bin')).toBe('affidavit:served')
    fireEvent.click(chip('j650', 'affidavit'))
    expect(onOpenLienInstruments).toHaveBeenCalledWith('j650')
    desk.unmount()
    // On By paper the list row's number is the same zoom; the row's own press still selects.
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [], true)} initialKind="notice" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    const listZoom = document.querySelector('[data-lien-list-zoom="j650"]') as HTMLElement
    expect(listZoom.getAttribute('title')).toBe('Open the property record at the owner')
    fireEvent.click(listZoom)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
  })

  it('on a computer the title is the first tab (v2.7465, the owner’s pick; a door of its own from v2.7332): it reads the page’s name and the count, and its press opens To do with the Board brought into view, from By paper and on To do itself', async () => {
    const brought: Element[] = []
    const before = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) { brought.push(this) }
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="notice" />)
      await settle()
      expect(document.querySelector('[data-lien-board]')).toBeNull()
      // The separate title and its press are gone; the heading stays for a screen reader and the page's outline, out of the line and with no press in it.
      expect(screen.queryByRole('button', { name: 'Lien desk: open To do at the Board' })).toBeNull()
      const heading = screen.getByRole('heading', { level: 2, name: 'Lien desk' })
      expect(heading.getAttribute('data-lien-desk-heading')).toBe('outline')
      expect(heading.className).toBe('lienDeskOutlineHeading')
      expect(heading.querySelector('button')).toBeNull()
      // The first tab: the name and the count are its name, the clock mark is drawn beside them, and the title's long hint is its hint.
      const tab = screen.getByRole('tab', { name: 'Lien desk · 1 to do' })
      expect(tab.textContent).toBe('⏱ Lien desk · 1 to do')
      expect(tab.querySelector('[aria-hidden="true"]')?.textContent).toBe('⏱ ')
      expect(tab.hasAttribute('data-lien-desk-title')).toBe(true)
      expect(tab.getAttribute('title')).toMatch(/^To do, at the Board\. Every unpaid work month on a job with a GC/)
      expect(within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab')[0]).toBe(tab)
      // On another view it is unfilled, in the heading's own colour and heavier and larger than the other three, so the page keeps its name.
      expect(tab.getAttribute('aria-selected')).toBe('false')
      expect(tab.style.color).toBe('var(--text-base)')
      expect(tab.style.background).toBe('var(--surface)')
      expect(tab.style.fontWeight).toBe('700')
      expect(tab.style.fontSize).toBe('0.9rem')
      const byDate = screen.getByRole('tab', { name: 'By date' })
      expect(byDate.style.fontWeight).toBe('600')
      expect(byDate.style.fontSize).toBe('0.78rem')
      // Its line is the other tabs' line, so the row is no taller than the doors beside it.
      expect(tab.style.lineHeight).toBe('1.17rem')
      fireEvent.click(tab)
      await settle()
      expect(tab.getAttribute('aria-selected')).toBe('true')
      expect(tab.style.color).toBe('rgb(255, 255, 255)')
      const board = document.querySelector('[data-lien-board]') as HTMLElement
      expect(board).toBeTruthy()
      expect(brought.some((el) => el === board)).toBe(true)
      // On To do already, the press still brings the Board back up.
      brought.length = 0
      fireEvent.click(screen.getByRole('tab', { name: 'Lien desk · 1 to do' }))
      await settle()
      expect(brought.some((el) => el === document.querySelector('[data-lien-board]'))).toBe(true)
    } finally {
      Element.prototype.scrollIntoView = before
    }
  })

  it('while the desk’s book is not in, a computer’s first tab reads the page’s name alone (v2.7465)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={null} initialKind="next" />)
    await settle()
    const tab = within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab')[0] as HTMLElement
    expect(tab.textContent).toBe('⏱ Lien desk')
    expect(screen.getByRole('tab', { name: 'Lien desk' })).toBe(tab)
  })

  it('on a phone a row opens its job as a screen over the desk: the steps, the doors and the row’s press; the way back returns to the list and the press goes where the row’s goes (punch list #352, PR 4)', async () => {
    // A computer has no such screen: a press on the row acts.
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    expect(document.querySelector('[data-lien-next-up-open]')).toBeNull()
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const onOpenJob = vi.fn()
      const onOpenLienInstruments = vi.fn()
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" layout="stacked" onOpenJob={onOpenJob} onOpenLienInstruments={onOpenLienInstruments} />)
      await settle()
      expect(document.querySelector('[data-lien-job-screen]')).toBeNull()
      const name = document.querySelector<HTMLElement>('[data-lien-next-up-open]')!
      const rowKey = name.getAttribute('data-lien-next-up-open')!
      const rowPress = name.closest('[data-lien-next-up-row]')!.querySelector<HTMLElement>('[data-lien-next-up-act]')!.textContent
      fireEvent.click(name)
      const jobScreen = document.querySelector<HTMLElement>('[data-lien-job-screen]')!
      expect(jobScreen.getAttribute('data-lien-job-screen')).toBe(rowKey)
      // It sits inside the desk's panel, over the header and the list.
      expect(jobScreen.closest('[data-lien-desk-panel]')).not.toBeNull()
      expect(jobScreen.style.position).toBe('absolute')
      expect(within(jobScreen).getAllByTestId('lien-step-card-item')).toHaveLength(4)
      // The doors open what the row's chip and name opened.
      fireEvent.click(jobScreen.querySelector('[data-lien-job-screen-door="job"]')!)
      expect(onOpenJob).toHaveBeenCalledWith('j650')
      fireEvent.click(jobScreen.querySelector('[data-lien-job-screen-door="lien_window"]')!)
      expect(onOpenLienInstruments).toHaveBeenCalledWith('j650')
      fireEvent.click(jobScreen.querySelector('[data-lien-job-screen-door="paper"]')!)
      expect(await screen.findByTestId('lien-paper-preview')).toBeTruthy()
      fireEvent.keyDown(document, { key: 'Escape' })
      // The way back closes the screen and the list is still the first view.
      fireEvent.click(within(document.querySelector<HTMLElement>('[data-lien-job-screen]')!).getByRole('button', { name: 'Back to the list' }))
      expect(document.querySelector('[data-lien-job-screen]')).toBeNull()
      expect(document.querySelector('[data-lien-do-now]')).not.toBeNull()
      // The pinned press has the row's words and goes where the row's press goes: the notice, with the screen closed behind it.
      fireEvent.click(document.querySelector<HTMLElement>('[data-lien-next-up-open]')!)
      const press = document.querySelector<HTMLElement>('[data-lien-job-screen-act]')!
      expect(press.textContent).toBe(rowPress)
      fireEvent.click(press)
      await settle()
      expect(document.querySelector('[data-lien-job-screen]')).toBeNull()
      expect(document.querySelector('[data-lien-do-now]')).toBeNull()
    } finally {
      window.matchMedia = before
    }
  })

  it('the leader on a phone gets one screen: the money, the mail-by day, the named steps, Approve and Not yet; Details unfolds the rest (v2.4881)', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const awaiting = {
        id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
      } as LienDeskItemRow
      renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} initialJobId="j650" initialKind="notice" />)
      await settle()
      const pane = document.querySelector('[data-lien-desk-pane]') as HTMLElement
      expect(pane.getAttribute('data-lien-pane-simple')).toBe('yes')
      const card = document.querySelector('[data-lien-approve-card]') as HTMLElement
      expect(card.textContent).toContain('1 waiting on you')
      expect(card.textContent).toContain('$33,500 owed by Lowbeck Contracting')
      expect((card.querySelector('[data-lien-approve-mail-by]') as HTMLElement).textContent).toBe('Mail by Sep 15 · 1 day')
      expect(card.textContent).toContain('Sent to you Sep 14. All four gates clear.')
      const tiles = Array.from(card.querySelectorAll('.lienStepTile')).map((t) => `${t.textContent}:${t.getAttribute('data-state')}`)
      expect(tiles).toEqual(['✓Owner:done', '✓Drafted:done', 'youApprove:now', '\u00a0Mail:todo'])
      // The footer: two buttons, and nothing of the computer's row.
      expect(screen.getByRole('button', { name: 'Sign and approve ▸' })).toBeTruthy()
      // The notice's own signature line sits on the card (v2.5082): his name in cursive, one tap signs and approves.
      expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('type')
      expect(screen.queryByRole('button', { name: /Sign and approve & next/ })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))
      expect(screen.getByRole('button', { name: /Hold — they promised/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Back to the office' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.getByRole('button', { name: 'Not yet' })).toBeTruthy()
      // Details unfolds the pane the computer shows.
      fireEvent.click(screen.getByRole('button', { name: 'Details ▾' }))
      expect(pane.hasAttribute('data-lien-pane-simple')).toBe(false)
      expect(screen.getByText("What you're deciding")).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Hide details ▴' })).toBeTruthy()
    } finally {
      window.matchMedia = before
    }
  })

  it('Send for approval tells the leader after the write, with the mail-by day, and the toast says his phone has it (v2.4872)', async () => {
    saveDraftMock.mockClear()
    submitMock.mockClear()
    tellLeaderMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /to approve ▸/ }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(submitMock.mock.calls[0]).toEqual(['it-new', { status: 'awaiting_approval', reason: 'first_notice' }])
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledWith('it-new', '2026-09-15'))
    expect(await screen.findByText("Sent for approval. Malachi's phone has it.")).toBeTruthy()
  })

  it('Send for approval says so when the message to the leader did not go, with the reason, and the paper is still sent (v2.7445)', async () => {
    saveDraftMock.mockClear()
    submitMock.mockClear()
    tellLeaderMock.mockClear()
    tellLeaderMock.mockImplementationOnce(async () => ({ ok: false, reason: 'Not the office' }))
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} leaderNameFor={() => 'Sam'} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /to approve ▸/ }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(submitMock.mock.calls[0]).toEqual(['it-new', { status: 'awaiting_approval', reason: 'first_notice' }])
    expect(await screen.findByText('Sent for approval. The message to Sam did not go. Not the office. The paper is on the Dashboard. Tell Sam another way.')).toBeTruthy()
    // The send is not reported as failed: the paper is with the leader.
    expect(screen.queryByText(/^Send for approval: /)).toBeNull()
    expect(screen.queryByText(/phone has it/)).toBeNull()
  })

  it('a "send" rule with no notice recorded to the GC still sends the first one to the leader (v2.3469)', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    const lowbeck = { id: 'lowbeck', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@lowbeck.test', policy: 'send' as const, policyNote: '' }
    const withRule: LienDeskData = { ...d, gcsById: { lowbeck }, queue: buildLienDeskQueue(d.rows, d.items, { lowbeck: 'send' }, TODAY) }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRule} />)
    await settle()
    expect(screen.getByRole('button', { name: /to approve ▸/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Move it to print/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('One line on the leader’s phone · first notice to this GC — the rule starts with the next one')
  })

  it('the leader sees what he is deciding, the standing rule, and Approve & next / Hold on an awaiting item', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /Awaiting Master approval/ }).textContent).toContain('1')
    expect(screen.getByText("What you're deciding")).toBeTruthy()
    expect(screen.getByText(/Open with Lowbeck Contracting/)).toBeTruthy()
    expect(screen.getByText(/Jun 2026's lien right ends September 15, 2026/)).toBeTruthy()
    expect(screen.getByText(/Standing rule for Lowbeck Contracting/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Send notices without asking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sign and approve & next/ })).toBeTruthy()
    // The pay offer (v2.4713): off until he ticks it, then the sentence as the page prints it. v2.4745: the switch sits in the
    // footer's bottom row and the box opens above that row only once it is on.
    expect(screen.queryByTestId('lien-offer-box')).toBeNull()
    expect(screen.getByTestId('lien-offer-switch').closest('[data-lien-desk-next]')).toBeTruthy()
    // v2.7382 (Taunya's ask): the footer is one box. The call, the press and the other ways out sit inside the signature's box.
    const box = screen.getByTestId('lien-sign-line')
    expect(box.hasAttribute('data-lien-sign-frame')).toBe(true)
    expect((box.querySelector('.lienSignFrameCall') as HTMLElement).textContent).toContain('Your call on')
    expect(box.contains(screen.getByRole('button', { name: /Sign and approve & next/ }))).toBe(true)
    expect((box.querySelector('.lienSignFrameStrip') as HTMLElement).textContent).toBe("Not yetHold — they promised…Hold — I'll call firstBack to the officeOffer a discountAlready mailed? Record it ›")
    fireEvent.click(screen.getByTestId('lien-offer-switch'))
    expect(screen.getByTestId('lien-offer-box').closest('[data-lien-desk-next]')).toBeNull()
    expect(screen.getByTestId('lien-offer-box').getAttribute('data-on')).toBe('yes')
    expect(screen.getByTestId('lien-offer-prints').textContent).toContain('and it is 10% less')
    fireEvent.click(screen.getByTestId('lien-offer-pct-15'))
    expect(screen.getByTestId('lien-offer-prints').textContent).toContain('and it is 15% less')
    fireEvent.click(screen.getByRole('button', { name: /Hold — I'll call first/ }))
    expect(screen.getByText(/then asks again/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hold' })).toBeTruthy()
  })

  it('the title bar carries no FYI line for the leader (v2.6569 took the Sent on your word strip of v2.5028 out), and none for the office', async () => {
    const item = (id: string, job: string, over: Record<string, unknown>) =>
      ({ id, job_id: job, kind: 'notice_53_056', months: ['2026-06'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: '2026-09-14T15:00:00Z', approval_mode: 'rule', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, printed_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T15:00:00Z', voided_at: null, ...over }) as unknown as LienDeskItemRow
    const rows = [...J650, row('j651', '2026-06', '2026-09-15'), row('j652', '2026-06', '2026-09-15'), row('j653', '2026-06', '2026-09-15')]
    const items = [
      item('w1', 'j650', { approval_mode: 'word', word_note: 'Malachi Whites, Sep 14', word_channel: 'phone' }),
      item('r1', 'j651', { approval_mode: 'rule' }),
      item('r2', 'j652', { approval_mode: 'rule', status: 'sent', sent_at: '2026-09-14T16:00:00Z' }),
      // Printed and in the mail, its tracking not yet typed: still a send (the printed pile came after this list, v2.4119).
      item('w2', 'j653', { approval_mode: 'word', word_note: 'Malachi Whites, Sep 14', word_channel: 'text', printed_at: '2026-09-14T16:30:00Z' }),
    ]
    const withJobs = () => {
      const d = data(rows, items, true)
      d.jobsById.j651 = { ...d.jobsById.j650!, id: 'j651', hcp_number: '651', job_name: 'Palomino Trail' }
      d.jobsById.j652 = { ...d.jobsById.j650!, id: 'j652', hcp_number: '652', job_name: 'Quarry Bend' }
      d.jobsById.j653 = { ...d.jobsById.j650!, id: 'j653', hcp_number: '653', job_name: 'Heron Ct' }
      return d
    }
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={withJobs()} />)
    await settle()
    // Until v2.6569 the leader read *Sent on your word: 650, 653 · by Lowbeck Contracting’s rule: 651, 652* in the title bar; Grace found it meaningless and it is gone. The record stays on each notice.
    expect(document.querySelector('[data-lien-fyi]')).toBeNull()
    expect(screen.queryByText(/Sent on your word/)).toBeNull()
    view.unmount()
    // The office drafts and sends; the list is the leader's.
    renderWithProviders(<LienDesk {...baseProps} authRole="controller" data={withJobs()} />)
    await settle()
    expect(document.querySelector('[data-lien-fyi]')).toBeNull()
  })

  it('the office sees an awaiting item as waiting on the leader, and nothing due reads calm', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="controller" data={data([])} />)
    await settle()
    expect(screen.getByText(/Nothing is due/)).toBeTruthy()
  })

  it('“he is here” (v2.3813): the office’s awaiting footer records the leader’s word at the desk, with the presence line', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={() => 'Malachi Whites'} data={data(J650, [awaiting], true)} />)
    await settle()
    // v2.4855: the state is a chip; the old sentence is its hover.
    const chip = document.querySelector('[data-lien-desk-awaiting-words]') as HTMLElement
    expect(chip.textContent).toContain('Waiting on the leader · since')
    expect(chip.title).toMatch(/^Waiting on the leader since /)
    expect(screen.queryByRole('button', { name: /Sign and approve & next/ })).toBeNull()
    // Blue, the desk's primary: it is the approval step, not a side act (v2.4850, the owner's ask).
    const leaderHere = screen.getByRole('button', { name: /Leader here, Approve/ })
    expect(leaderHere.style.background).toBe('rgb(37, 99, 235)')
    fireEvent.click(leaderHere)
    // One line (v2.4856): the lead-in, the master's name in the box, the presence channel picked, the short note, and the preview door.
    expect(screen.getByText('Leader here')).toBeTruthy()
    expect((screen.getByLabelText('Who said it and when') as HTMLInputElement).value).toMatch(/^Malachi Whites, /)
    expect((screen.getByLabelText('standing over me') as HTMLInputElement).checked).toBe(true)
    expect(document.querySelector('[data-lien-word-presence]')!.textContent).toContain('Recorded by Wendi. Malachi can pull it back with “Not what I said”.')
    expect(document.querySelector('[data-lien-word-row]')!.querySelectorAll(':scope > div').length).toBe(1)
    const approve = screen.getByRole('button', { name: /Approve on his word/ }) as HTMLButtonElement
    expect(approve.disabled).toBe(false)
    expect(approve.style.background).toBe('rgb(37, 99, 235)')
    // The preview: every place the record lands, in the words the desk will draw.
    expect(document.querySelector('[data-lien-word-preview]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview the record ›' }))
    const card = document.querySelector('[data-lien-word-preview]') as HTMLElement
    expect(card.textContent).toContain('What the record will say')
    expect(card.textContent).toMatch(/On Malachi’s word · Malachi Whites, .* · standing over the desk/)
    expect(card.textContent).toContain('Sent on your word: 650 · AXO Schertz')
    expect(card.textContent).toContain('The notice itself does not change.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-lien-word-preview]')).toBeNull()
    fireEvent.click(screen.getByLabelText('typing it in'))
    expect(document.querySelector('[data-lien-word-presence]')!.textContent).toContain('Recorded by Wendi.')
    // The remembered three are still there; a remembered word shows no presence line, only the preview door.
    fireEvent.click(screen.getByLabelText('by phone'))
    expect(screen.queryByText(/Recorded by Wendi/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Preview the record ›' })).toBeTruthy()
  })

  it('the leader’s own awaiting footer has no “he is here” — he approves', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.queryByRole('button', { name: /Leader here/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Sign and approve & next/ })).toBeTruthy()
  })
})

describe('LienDesk · the demand letter on the panes’ strips (v2.3880, punch list #32)', () => {
  const letter = { id: 'd1', job_id: 'j650', amount: 8_940, created_at: '2026-09-08T16:00:00Z', created_by: null, deadline_date: '2026-09-22', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Lowbeck Contracting', sent_at: '2026-09-08T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null } as unknown as NonNullable<LienDeskData['demandLettersByJob']>[string][number]

  it('the notice pane draws the letter the desk loaded, and says who is waited on; without letters there is no node', async () => {
    const d = data(J650)
    d.demandLettersByJob = { j650: [letter] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    expect(timeline.querySelector('[data-lien-timeline-step="demand"]')?.textContent).toContain('reply by Sep 22')
    expect(timeline.textContent).toContain('Waiting on')
    cleanup()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="demand"]')).toBeNull()
  })

  it('the affidavit pane draws it too', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.demandLettersByJob = { j650: [letter] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="demand"]')?.textContent).toContain('reply by Sep 22')
  })

  it('a month dated from the bill asks whether it is right, with two presses; the ask saves who said so; a confirmed month reads a quiet line with Change › (v2.7280, punch list #358)', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-08', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 1_049, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, month_source: 'bill' }
    const d = data([], [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const onOpenCalendarLastWork = vi.fn()
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" initialJobId="j650" onOpenCalendarLastWork={onOpenCalendarLastWork} />)
    await settle()
    expect(document.querySelector('[data-lien-affidavit-month-stand-in]')!.textContent).toContain('The month comes from the bill, not from recorded work. Is August the month the work was done?')
    // The second press is today's door, the last day of work, which moves every clock.
    fireEvent.click(screen.getByRole('button', { name: 'Set the last day of work ›' }))
    expect(onOpenCalendarLastWork).toHaveBeenCalledWith('j650')
    // The first opens the one-line ask; the confirm is dead until who said so is typed.
    fireEvent.click(screen.getByRole('button', { name: 'Yes, August is right ›' }))
    const confirm = screen.getByRole('button', { name: 'Confirm August' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(document.querySelector('[data-lien-affidavit-month-check-ask]')!.textContent).toContain('It changes no date and no paper. It takes the flag off.')
    fireEvent.change(screen.getByLabelText('Who said August is the month, and when?'), { target: { value: 'The owner, Nov 14: the work was done in August.' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(saveMonthCheckMock).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j650', month: '2026-08', note: 'The owner, Nov 14: the work was done in August.', userId: 'u-taunya', userName: 'Taunya' })))
    desk.unmount()

    // Confirmed: the quiet line in the flag's place, the grid's words, and Change › reopens the ask with the note.
    const checked = data([], [], true)
    checked.affidavitRows = [affRow]
    checked.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    checked.jobsById = { j650: { ...checked.jobsById.j650!, lien_month_checked_month: '2026-08', lien_month_checked_at: '2026-11-14T17:00:00Z', lien_month_checked_by_name: 'Robert', lien_month_check_note: 'The owner, Nov 14: the work was done in August.' } }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={checked} initialKind="affidavit" initialJobId="j650" />)
    await settle()
    expect(document.querySelector('[data-lien-affidavit-month-stand-in]')).toBeNull()
    expect(document.querySelector('[data-lien-affidavit-month-checked]')!.textContent).toContain('August checked · Robert · Nov 14 · The owner, Nov 14: the work was done in August.')
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-lien-affidavit-month-change]')!)
    expect((screen.getByLabelText('Who said August is the month, and when?') as HTMLInputElement).value).toBe('The owner, Nov 14: the work was done in August.')
  })
})

describe('LienDesk · an open paper on a phone (punch list #352, PR 6)', () => {
  const phone = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia

  it('an open notice has a one-row header, one pinned section title, a column held to the screen and a footer that folds without losing what is in it', async () => {
    // A computer: the pane beside the list keeps its stacked titles and has no fold.
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="notice" initialJobId="j650" />)
    await settle()
    expect(document.querySelector('.lienDeskTitleBar')!.getAttribute('data-lien-pane-open')).toBeNull()
    expect(document.querySelector('[data-lien-desk-pane]')!.getAttribute('data-lien-pane-phone')).toBeNull()
    expect(document.querySelector('[data-lien-desk-foot-fold]')).toBeNull()
    // The footer's blue head (v2.7422) is a computer's alone and pins at the bottom only, so it is not one of the stacked ones.
    expect(document.querySelectorAll('[data-lien-pane-head][data-tone="blue"]').length).toBe(1)
    const wideHeads = [...document.querySelectorAll<HTMLElement>('[data-lien-pane-head]:not([data-tone])')]
    expect(wideHeads.length).toBeGreaterThan(1)
    expect(wideHeads.map((h) => parseFloat(h.style.top))).toEqual(wideHeads.map((_, i) => i * 24))
    expect(wideHeads.every((h) => h.style.height === '24px')).toBe(true)
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = phone
    try {
      const onShowList = vi.fn()
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} layout="stacked" initialKind="notice" initialJobId="j650" onOpenNotice={() => {}} onShowList={onShowList} backDoor={<button type="button">← Pipeline</button>} />)
      await settle()
      await waitFor(() => expect(document.querySelector('[data-lien-desk-pane]')).not.toBeNull())
      // The header says a paper is open, which hides both rows of tabs (`index.css`); its way back is the list.
      expect(document.querySelector('.lienDeskTitleBar')!.getAttribute('data-lien-pane-open')).toBe('notice')
      expect(screen.getByRole('button', { name: 'Back to the notices' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: '← Back to the list' })).toBeNull()
      // The pane: one column held to its width, one title pinned at a time, a thumb tall.
      const pane = document.querySelector<HTMLElement>('[data-lien-desk-pane]')!
      expect(pane.getAttribute('data-lien-pane-phone')).toBe('yes')
      expect(pane.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
      const heads = [...document.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
      expect(heads.length).toBe(wideHeads.length)
      for (const h of heads) {
        expect(parseFloat(h.style.top)).toBe(0)
        expect(h.style.bottom).toBe('auto')
        expect(h.style.height).toBe('40px')
      }
      // The footer folds to one bar and comes back with its presses, never unmounted.
      const fold = document.querySelector<HTMLButtonElement>('[data-lien-desk-foot-fold]')!
      expect(fold.getAttribute('aria-expanded')).toBe('true')
      expect(fold.textContent).toContain('Hide the next step')
      const footer = fold.nextElementSibling as HTMLElement
      const footerButtons = footer.querySelectorAll('button').length
      expect(footerButtons).toBeGreaterThan(0)
      fireEvent.click(fold)
      expect(fold.getAttribute('aria-expanded')).toBe('false')
      expect(fold.textContent).toContain('Show the next step')
      expect((fold.nextElementSibling as HTMLElement).querySelectorAll('button').length).toBe(footerButtons)
      fireEvent.click(fold)
      expect(fold.getAttribute('aria-expanded')).toBe('true')
    } finally {
      window.matchMedia = before
    }
  })

  it('a sent notice’s folded footer names its mail proof on the bar, and drops the chip once the footer is open (v2.7715)', async () => {
    const sent = { id: 'r2', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'sent', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: 'f1', sent_at: '2026-09-14T16:00:00Z', printed_at: null, pulled_back_by: null, pulled_back_at: null, mailed_copies: [], created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T16:00:00Z', voided_at: null } as unknown as LienDeskItemRow
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sent], true)
    d.filingsByJob = { j650: [{ id: 'f1', job_id: 'j650', kind: 'notice_53_056', filed_on: '2026-09-14', document_url: null, document_note: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 0001', sent_on: '2026-09-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 0002', sent_on: '2026-09-14' }], voided_at: null } as never] }
    const before = window.matchMedia
    window.matchMedia = phone
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} layout="stacked" initialKind="notice" initialJobId="j650" initialPile="sent" onOpenNotice={() => {}} backDoor={<button type="button">← Pipeline</button>} />)
      await settle()
      await waitFor(() => expect(document.querySelector('[data-lien-desk-foot-fold]')).not.toBeNull())
      const fold = document.querySelector<HTMLButtonElement>('[data-lien-desk-foot-fold]')!
      // Open, the block itself is on the screen under the bar, so the bar does not say it twice.
      expect(fold.getAttribute('aria-expanded')).toBe('true')
      expect((fold.nextElementSibling as HTMLElement).querySelector('[data-lien-mail-proof="notice"] [data-lien-mail-proof-chip]')!.textContent).toBe('Mail proof: 0 of 3 on file')
      expect(fold.querySelector('[data-lien-desk-foot-fold-proof]')).toBeNull()
      // Folded, the one row a phone shows names the proof with the block's own words.
      fireEvent.click(fold)
      expect(fold.getAttribute('aria-expanded')).toBe('false')
      const chip = fold.querySelector<HTMLElement>('[data-lien-desk-foot-fold-proof]')!
      expect(chip.getAttribute('data-lien-desk-foot-fold-proof')).toBe('owed')
      expect(chip.textContent).toBe('Mail proof: 0 of 3 on file')
      expect(fold.textContent).toContain('Show the next step')
      // The bar is a press, so it is a thumb tall.
      expect(fold.style.minHeight).toBe('44px')
      fireEvent.click(fold)
      expect(fold.querySelector('[data-lien-desk-foot-fold-proof]')).toBeNull()
    } finally {
      window.matchMedia = before
    }
  })

  it('an open affidavit has a way back to its list in the header, where it had none', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const before = window.matchMedia
    window.matchMedia = phone
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} layout="stacked" initialKind="affidavit" backDoor={<button type="button">← Pipeline</button>} />)
      await settle()
      // The list first: the page's own door, both rows of tabs, no fold.
      expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
      expect(document.querySelector('.lienDeskTitleBar')!.getAttribute('data-lien-pane-open')).toBeNull()
      expect(document.querySelector('[data-lien-desk-foot-fold]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /AXO Schertz/ }))
      await waitFor(() => expect(document.querySelector('.lienDeskTitleBar')!.getAttribute('data-lien-pane-open')).toBe('affidavit'))
      expect(screen.queryByRole('button', { name: '← Pipeline' })).toBeNull()
      const back = screen.getByRole('button', { name: 'Back to the affidavits' })
      expect(back.textContent).toContain('Affidavits')
      expect(back.style.height).toBe('44px')
      expect(document.querySelector('[data-lien-desk-foot-fold]')).not.toBeNull()
      fireEvent.click(back)
      await waitFor(() => expect(document.querySelector('.lienDeskTitleBar')!.getAttribute('data-lien-pane-open')).toBeNull())
      expect(screen.getByRole('button', { name: '← Pipeline' })).toBeTruthy()
      expect(screen.getByRole('button', { name: /AXO Schertz/ })).toBeTruthy()
    } finally {
      window.matchMedia = before
    }
  })
})

describe('LienDesk reads the roll (v2.3450)', () => {
  function payload(owner: string, mailing: string) {
    return { ok: true, county_geocoder: 'Guadalupe', parcel: { propId: '12345', ownerName: owner, nameCare: '', legalDescription: 'LOT 1', situsAddress: '1204 ELWICK RD, SCHERTZ, TX', mailingAddress: mailing, county: 'Guadalupe', source: 'Guadalupe Appraisal District', taxYear: '2025' } }
  }

  it('an ownerless item shows the roll’s answer with its chips and Use, keeps the door, and Use writes the property and re-reads', async () => {
    lookupMock.mockImplementation(async (address: string) => proposalFromLookupPayload(address, payload('SAMPLE STATION LTD', '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209')))
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} onChanged={onChanged} />)
    await waitFor(() => expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('found'))
    expect(screen.getByText('Sample Station Ltd')).toBeTruthy()
    expect(screen.getByText(/landlord · AXO Schertz is the tenant/)).toBeTruthy()
    expect(screen.getByText(/Guadalupe Appraisal District 2025/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Find the owner ›' }).length).toBeGreaterThanOrEqual(1)
    // Still blocked until Use — the roll's answer is a proposal, not the record.
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /to approve ▸/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(screen.getByRole('button', { name: 'Go to gate 1 ▴' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('lien-desk-owner-use'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    const input = confirmMock.mock.calls[0]![0] as { address: string; jobs: { jobId: string; customerId: string | null; gcCustomerId: string | null }[]; source: { kind: string }; userId: string | null }
    expect(input.address).toBe('1204 Elwick Rd, Schertz, TX')
    expect(input.jobs).toEqual([{ jobId: 'j650', customerId: 'axo', gcCustomerId: 'lowbeck', customerAddressId: null }])
    expect(input.source.kind).toBe('proposal')
    expect(input.userId).toBe('u-taunya')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a public owner on the record reads the bond-claim sentence and is not draftable', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true, { owner_company: 'CITY OF ROUND ROCK', owner_mailing_address: '221 E Main St, Round Rock, TX', owner_confirmed_at: '2026-09-14T00:00:00Z' })} />)
    await settle()
    expect(screen.getByRole('button', { name: /To send/ }).textContent).toContain('1')
    expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('public')
    expect(screen.getAllByText(/a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond/).length).toBeGreaterThanOrEqual(2)
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /to approve ▸/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. This is public property, so no lien notice can go.")
    // The footer's press, apart from the band's Go to gate 1 › (v2.7321).
    expect(screen.getByRole('button', { name: 'Go to gate 1 ▴' })).toBeTruthy()
    // Blocked, the menus are gone too (v2.7324): no door to his word on a paper that cannot go.
    expect(document.querySelector('[data-lien-foot-menu]')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('an owner the nightly run saved from the roll drafts, shows the provenance and the CAD check, and Confirm stamps the record', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true, { owner_confirmed_at: null, parcel_source: 'Guadalupe Appraisal District', parcel_tax_year: '2025', parcel_id: '12345' })} onChanged={onChanged} />)
    await settle()
    expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('unconfirmed')
    expect(screen.getByText(/Owner from the roll \(2025\) · unconfirmed/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /confirm on Guadalupe CAD/ })).toBeTruthy()
    // Drafting is allowed on it; only the run refuses (lienDeskRun.test.ts).
    expect((screen.getByRole('button', { name: /to approve ▸/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('lien-desk-owner-confirm'))
    await waitFor(() => expect(stampMock).toHaveBeenCalledWith('addr1', 'u-taunya'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(lookupMock).not.toHaveBeenCalled()
  })
})

describe('LienDesk affidavits (v2.3412)', () => {
  it('switches to the affidavit kind, lists the window with its missing gates, and offers the property door', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="affidavit" />)
    await settle()
    expect(screen.getByRole('tab', { name: /Lien affidavits · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Needs the property facts · 1' })).toBeTruthy()
    // The row's gates as five marks on its chip line (v2.7335): on a computer the strip stands in for the *missing …* words, which live in its title and the marks' titles.
    const strip = document.querySelector('[data-lien-gate-marks]') as HTMLElement
    expect(strip.getAttribute('title')).toBe('2 of 5 clear · missing owner, legal, a mailed notice')
    expect(Array.from(strip.querySelectorAll('[data-lien-gate-mark]')).map((m) => `${m.getAttribute('data-lien-gate-mark')}:${m.getAttribute('data-state')}`)).toEqual(['owner:open', 'legal:open', 'contractor:ok', 'notice:open', 'homestead:ok'])
    expect(strip.querySelector('[data-lien-gate-mark="owner"]')?.getAttribute('title')).toBe('owner — Missing owner')
    expect(screen.queryByText(/missing owner, legal, a mailed notice/)).toBeNull()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    // v2.7187: the desk's own timeline names the step the paper is on, as its To do row does (*the property record is not complete*).
    expect(timeline.textContent).toContain('Fix the property record, then file the affidavit — tomorrow · owner of record, legal description, a mailed notice missing.')
    // Whose move and for what rides in the band's press (v2.7321), which opens the one gate that holds the paper.
    expect(timeline.querySelector('[data-lien-timeline-act="gate:owner"]')?.getAttribute('title')).toBe('Waiting on us — the property record to be completed')
    expect(timeline.querySelector('[data-lien-timeline-act]')?.textContent).toBe('Find the owner ›')
    // The kind is not set: the timeline says residential dates are shown, the earlier ones (v2.5031).
    expect(timeline.textContent).toContain('Property kind not set: residential dates shown, the earlier ones. Commercial would be a month later.')
    // The gate box's caption is the pane's grey head since v2.7320: the count of gates missing, each named short.
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe('Before it can be generated✗ 3 missing · owner of record missing · county or legal description missing · no § 53.056 notice on the job')
    expect(document.querySelector('[data-lien-affidavit-window]')?.textContent).toBe('§ 53.052 · window from May 2026, the last month worked')
    // v2.4724: the door opens the property record in a window over the desk, not Edit Job.
    fireEvent.click(screen.getAllByRole('button', { name: /Fill in the record ›/ })[0]!)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect(onOpenEditJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    expect(screen.getByRole('button', { name: /Send the notice first ›/ })).toBeTruthy()
  })

  it('an affidavit that waits on a notice already approved says where that notice stands, on its pane and on its To do row', async () => {
    // The job's notice is approved and stands in the run, with no mailing on record yet: the affidavit's one closed gate.
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-08', deadline: '2026-12-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
    const approved = { id: 'it-a', job_id: 'j650', kind: 'notice_53_056', months: ['2026-08'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T14:20:00Z', approval_mode: 'manual', printed_at: null, created_at: '2026-09-14T14:00:00Z', voided_at: null, sent_at: null, sent_filing_id: null, hold_reason: null, hold_until: null, hold_note: null } as unknown as LienDeskItemRow
    const d = data([row('j650', '2026-08', '2026-11-16', { has_owner: true, property_kind: 'non_residential' })], [approved], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    expect(d.queue.entries.find((e) => e.jobId === 'j650')?.pile).toBe('ready')
    expect(d.affidavits.entries[0]!.gates.filter((g) => !g.ok).map((g) => g.key)).toEqual(['notice'])
    // Its pile is its own (v2.7457): nothing on the property record is missing.
    expect(d.affidavits.entries[0]!.pile).toBe('needs_notice')
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    // The gates head and the gate row say approved and not mailed; nobody is told to send the notice first.
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe('Before it can be generated✗ 1 missing · § 53.056 notice not mailed yet')
    const gates = document.querySelector<HTMLElement>('[data-lien-pane-body="gates"]')!
    expect(within(gates).getByRole('button', { name: /approved · not mailed yet.*Open the notice ›$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send the notice first/ })).toBeNull()
    expect(screen.queryByText(/no § 53\.056 notice on the job/)).toBeNull()
    // By paper lists it under the pile of the same name, and Needs the property facts is empty.
    expect(document.querySelector('[data-lien-pile-rows="needs_notice"]')?.querySelectorAll('button').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-lien-pile-rows="needs_property"]')?.querySelectorAll('button').length ?? 0).toBe(0)
    view.unmount()
    // To do: the row's tag and its press.
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const affidavitRow = document.querySelector<HTMLElement>('[data-lien-next-up-row="affidavit:j650"]')
    expect(affidavitRow).not.toBeNull()
    expect(affidavitRow!.textContent).toContain('Its § 53.056 notice is approved and not mailed yet.')
    expect(affidavitRow!.querySelector('[data-lien-next-up-tag]')?.textContent).toBe('Notice approved · not mailed yet')
    // The row starts with its bin, and on the Board the affidavit's chip and its notice's chip are one pair.
    expect(affidavitRow!.querySelector('[data-lien-next-up-stage]')?.textContent).toBe('Waiting on its notice')
    expect(document.querySelector('[data-lien-board-bin="affidavit:needs_notice"] [data-lien-board-chip="j650"]')?.getAttribute('data-pair')).toBe('notice:j650')
    expect(document.querySelector('[data-lien-board-bin="notice:to_sign"] [data-lien-board-chip="j650"]')?.getAttribute('data-pair')).toBe('notice:j650')
    expect(within(affidavitRow!).getByRole('button', { name: 'Print and mail' })).toBeTruthy()
    expect(affidavitRow!.textContent).not.toContain('No notice on record')
    expect(affidavitRow!.textContent).not.toContain('Send the notice first')
  })

  it('on a phone the gate marks keep the missing words beside them, since a phone has no hover (v2.7335)', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
      await settle()
      expect(document.querySelector('[data-lien-gate-marks]')?.getAttribute('title')).toBe('2 of 5 clear · missing owner, legal, a mailed notice')
      expect(screen.getByText(/missing owner, legal, a mailed notice/)).toBeTruthy()
    } finally {
      window.matchMedia = before
    }
  })

  it('the pane says which months the affidavit claims, and a missed month is worked but unsecured (v2.3681)', () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const workMonths = {
      j650: { jobId: 'j650', role: 'sub' as const, propertyKind: '', months: [{ key: '2026-05', label: 'May 2026', weeks: [], people: ['Malachi'], hours: 20, pendingHours: 0, dayCount: 3, hoursShare: 100, notice: { due: '2026-08-17', daysLeft: -28, state: 'closed' as const } }], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-05', affidavitDue: '2026-09-15' },
    }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} workMonths={workMonths} initialKind="affidavit" />)
    const card = document.querySelector('[data-lien-affidavit-months]') as HTMLElement
    // The section's title is its grey head since v2.7320, with the months the paper swears, the claim and the months worked with no notice.
    expect(document.querySelector('[data-lien-pane-head="months"]')?.textContent).toBe('Months the affidavit claimsMay 2026 · $33,500 · 1 worked, not noticed')
    expect(card.textContent).toContain('Worked, not noticedMay 202620 approved hours · window closed Aug 17 with no notice — the lien does not cover itunsecured')
    expect(card.textContent).toContain("No month has a notice on record — the affidavit cannot claim this work. May 2026's share of the balance stays an ordinary receivable")
  })
})

describe('LienDesk affidavits · a paper keeps the form it was drafted on (punch list #305)', () => {
  // A GC job with every gate clear, and the notice on record: July named, mailed to the owner on August 14.
  const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-07', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
  const notice = { id: 'f-n', job_id: 'j650', kind: 'notice_53_056', months_covered: ['2026-07'], voided_at: null, filed_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-08-14' }], fields: {}, created_at: '2026-08-14T15:00:00Z' }
  const draft = (fields: Record<string, unknown>) =>
    ({ id: 'aff1', job_id: 'j650', kind: 'affidavit', months: ['2026-07'], status: 'approved', fields, cover_note: false, drafted_by: 'u-taunya', drafted_at: '2026-09-10T14:00:00Z', submitted_at: '2026-09-10T14:12:00Z', approved_by: null, approved_at: '2026-09-10T14:12:00Z', approval_mode: 'rule', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, printed_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-10T14:00:00Z', updated_at: '2026-09-10T14:12:00Z', voided_at: null }) as unknown as LienDeskItemRow
  const desk = (items: LienDeskItemRow[]) => {
    const d = data([], items, true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], items, TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    return d
  }
  const paper = () => (document.querySelector('[data-lien-affidavit-paper]') as HTMLElement)

  it('a job with no draft is drawn on the short form: seven paragraphs, the months and the notice from the record, nothing above the title', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([])} initialKind="affidavit" />)
    await settle()
    expect(paper().getAttribute('data-lien-affidavit-paper')).toBe('short')
    expect(paper().textContent).toContain('Claimant did so under a contract with Lowbeck Contracting, 2904 Corporate Cr, Flower Mound, TX, the original contractor.')
    expect(paper().textContent).toContain('Payment is requested for work done and materials furnished in July 2026.')
    expect(paper().textContent).toContain('Notice of the claim was sent to the owner by certified mail on August 14, 2026.')
    expect(paper().textContent).toContain('The amount of the claim is $33,500.00. Claimant claims a lien on the property for that amount.')
    expect(paper().textContent).not.toContain('Job #650')
    expect(paper().textContent).not.toContain('Last work month')
    expect(paper().textContent).not.toContain('COUNTY OF GUADALUPE')
    expect(document.querySelector('[data-lien-affidavit-form]')).toBeNull()
  })

  it('on a homestead the paper opens with the § 53.254(f) notice, above the title, and the desk still holds it', async () => {
    const d = data([], [], true, { homestead: true, property_kind: 'residential' })
    const row = { ...affRow, homestead: true, property_kind: 'residential' }
    d.affidavitRows = [row]
    d.affidavits = buildLienAffidavitQueue([row], [], TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const top = paper().querySelector('[data-top-notice]') as HTMLElement
    expect(top.textContent).toBe('NOTICE: THIS IS NOT A LIEN. THIS IS ONLY AN AFFIDAVIT CLAIMING A LIEN.')
    expect(paper().textContent!.indexOf('THIS IS NOT A LIEN')).toBeLessThan(paper().textContent!.indexOf('Lien Affidavit'))
    expect(document.body.textContent).toContain('Homestead — lien rights need a pre-work contract signed by both spouses and recorded (§ 53.254); talk to your attorney')
  })

  it('a home nobody answered the homestead question for holds the affidavit, and the gate’s door opens the property record on the question', async () => {
    const d = data([], [], true, { property_kind: 'residential', homestead_answered_at: null })
    const rows = withHomesteadAnswer([{ ...affRow, property_kind: 'residential' }], { j650: 'addr1' }, d.addressesById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(d.affidavits.entries[0]!.pile).toBe('needs_property')
    expect(document.body.textContent).toContain("Nobody has answered whether this home is the owner's homestead. Answer yes or no on the property record")
    // The row's hold rides the gate strip's title on a computer (v2.7335), and its homestead mark is the open one.
    expect(document.querySelector('[data-lien-gate-marks]')?.getAttribute('title')).toBe('4 of 5 clear · missing the homestead answer')
    expect(document.querySelector('[data-lien-gate-mark="homestead"]')?.getAttribute('data-state')).toBe('open')
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The hold changes the pile, never the words: the paper is the same short form, with no homestead notice on it.
    expect(paper().getAttribute('data-lien-affidavit-paper')).toBe('short')
    expect(paper().querySelector('[data-top-notice]')).toBeNull()
    const door = document.querySelector('[data-lien-affidavit-homestead-door]') as HTMLElement
    expect(door.textContent).toContain('Answer it ›')
    fireEvent.click(door)
    await settle()
    const question = document.querySelector('[data-homestead-question]') as HTMLElement
    expect(question.getAttribute('data-homestead-question')).toBe('unanswered')
    expect(question.textContent).toContain("Is this the owner's homestead?")
  })

  it('To do names the held affidavit’s one question under the job, with its bin and its notice, and the press opens the property record on it (v2.7372, punch list #362 step 3)', async () => {
    const d = data([], [], true, { property_kind: 'residential', homestead_answered_at: null })
    const rows = withHomesteadAnswer([{ ...affRow, property_kind: 'residential' }], { j650: 'addr1' }, d.addressesById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const row = document.querySelector('[data-lien-next-up-row="affidavit:j650"]') as HTMLElement
    expect(row.getAttribute('data-layout')).toBe('two-line')
    // The Board's bin first, then the one fact, in the words the gate uses everywhere; no dots on a row with a bin.
    expect(row.querySelector('[data-lien-next-up-stage]')!.textContent).toBe('Needs the property facts')
    expect(row.querySelector('[data-lien-next-up-detail]')!.textContent).toBe(' · Nobody has answered whether this home is a homestead.')
    expect(within(row).queryByTestId('lien-step-mark')).toBeNull()
    // Where its notice stands rides beside it: the job has one on record.
    expect(row.querySelector('[data-lien-next-up-tag]')!.getAttribute('data-lien-next-up-tag')).toBe('ok')
    expect(row.querySelector('[data-lien-next-up-tag]')!.textContent).toMatch(/^Notice (sent|on record)/)
    // The press says the act and opens the property record on the question, over the desk.
    const press = within(row).getByRole('button', { name: 'Answer the homestead question' })
    fireEvent.click(press)
    await settle()
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect((document.querySelector('[data-homestead-question]') as HTMLElement).getAttribute('data-homestead-question')).toBe('unanswered')
    // To do is still the view behind it: the press did not move the desk to By paper.
    expect(document.querySelector('[data-lien-do-now]')).not.toBeNull()
  })

  it('a home with a no on record passes the homestead gate, and a property record read before the column holds nothing', async () => {
    const d = data([], [], true, { property_kind: 'residential', homestead_answered_at: '2026-11-17T15:00:00Z' })
    const rows = withHomesteadAnswer([{ ...affRow, property_kind: 'residential' }], { j650: 'addr1' }, d.addressesById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    expect(d.affidavits.entries[0]!.pile).toBe('to_draft')
    const older = data([], [], true, { property_kind: 'residential' })
    expect(buildLienAffidavitQueue(withHomesteadAnswer([{ ...affRow, property_kind: 'residential' }], { j650: 'addr1' }, older.addressesById), [], TODAY).entries[0]!.pile).toBe('to_draft')
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(document.body.textContent).toContain('Not a homestead')
    expect(document.querySelector('[data-lien-affidavit-homestead-door]')).toBeNull()
  })

  it('a public owner holds the affidavit: the gate says no lien attaches, and offers no record to fill in (punch list #314)', async () => {
    const d = data([], [], true, { owner_name: 'SAMPLE CITY OF', owner_company: 'ATTN REAL ESTATE MANAGER', owner_mode: 'building_owner' })
    const rows = withPublicOwner([affRow], { j650: 'addr1' }, d.addressesById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(d.affidavits.entries[0]!.pile).toBe('needs_property')
    expect(document.body.textContent).toContain("Public property — a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond. Talk to the attorney.")
    expect(document.querySelector('[data-lien-gate-marks]')?.getAttribute('title')).toBe('4 of 5 clear · missing a private owner')
    expect(document.querySelector('[data-lien-gate-mark="owner"]')?.getAttribute('title')).toBe('owner — Missing a private owner')
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The paper names the owner, never the attention line.
    expect(paper().textContent).toContain('The owner or reputed owner is SAMPLE CITY OF')
    expect(paper().textContent).not.toContain('ATTN REAL ESTATE MANAGER')
    expect(screen.queryByRole('button', { name: /Fill in the record ›/ })).toBeNull()
  })

  it('a sworn month whose notice went late, with no copy to the contractor, is flagged for the attorney and holds nothing (punch list #314)', async () => {
    const lateNotice = { ...notice, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-10-20' }] }
    const d = data([], [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.filingsByJob = { j650: [lateNotice] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const flag = document.querySelector('[data-lien-affidavit-notice-check]') as HTMLElement
    expect(flag.textContent).toContain('Ask the attorney before this is filed.')
    expect(flag.textContent).toContain("The owner's notice went after its date, or is not on record, for July 2026.")
    expect(flag.textContent).toContain('No copy to the original contractor is on record for July 2026.')
    // A flag, not a hold: the paper is still ready to draft and its press is live.
    expect(d.affidavits.entries[0]!.pile).toBe('to_draft')
    expect(document.body.textContent).not.toContain('Blocked until every gate above is clear.')
    expect(paper().textContent).toContain('Payment is requested for work done and materials furnished in July 2026.')
  })

  it('a notice mailed on time to the owner and the contractor raises no flag', async () => {
    const whole = { ...notice, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-08-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 2', sent_on: '2026-08-14' }] }
    const d = data([], [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.filingsByJob = { j650: [whole] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(document.querySelector('[data-lien-affidavit-notice-check]')).toBeNull()
  })

  it('a GC with no address on file holds the affidavit: the gate says so, the door opens the GC’s record, and the paper keeps its words', async () => {
    const d = data([], [], true)
    d.gcsById = { lowbeck: { ...d.gcsById.lowbeck!, address: '' } }
    const rows = withContractorAddress([affRow], d.gcsById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    d.filingsByJob = { j650: [notice] } as unknown as LienDeskData['filingsByJob']
    const onOpenCustomerRecord = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" onOpenCustomerRecord={onOpenCustomerRecord} />)
    await settle()
    expect(d.affidavits.entries[0]!.pile).toBe('needs_property')
    expect(document.body.textContent).toContain('The general contractor has no address on its customer record. The affidavit gives its last known address (§ 53.054) — Lowbeck Contracting')
    expect(document.querySelector('[data-lien-gate-marks]')?.getAttribute('title')).toBe("4 of 5 clear · missing the GC's address")
    expect(document.querySelector('[data-lien-gate-mark="contractor"]')?.getAttribute('data-state')).toBe('open')
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The hold changes the pile, never the words: the paper still names the GC, with a blank where its address goes.
    expect(paper().textContent).toContain('Claimant did so under a contract with Lowbeck Contracting')
    fireEvent.click(document.querySelector('[data-lien-affidavit-contractor-door]') as HTMLElement)
    expect(onOpenCustomerRecord).toHaveBeenCalledWith('lowbeck')
  })

  it('every gate row is a press (v2.7313): a passed owner row ends in Change › and opens the property window, the notice row ends in See it › and opens Monthly notices', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([])} initialKind="affidavit" />)
    await settle()
    const owner = document.querySelector('[data-lien-gate-row="owner"]') as HTMLButtonElement
    expect(owner.getAttribute('data-lien-gate-ok')).toBe('yes')
    expect(owner.textContent).toContain('Change ›')
    expect(owner.title).toBe('Opens the property record at the owner of record')
    // A failed gate's chips are gone from a passed row: the row itself is the press.
    expect(screen.queryByRole('button', { name: /Fill in the record ›/ })).toBeNull()
    const noticeRow = document.querySelector('[data-lien-gate-row="notice"]') as HTMLButtonElement
    expect(noticeRow.textContent).toContain('sent Aug 14')
    expect(noticeRow.textContent).toContain('See it ›')
    fireEvent.click(owner)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    fireEvent.click(noticeRow)
    await settle()
    // The desk is on Monthly notices for the job now, so the affidavit's gate list is gone.
    expect(document.querySelector('[data-lien-gate-row="owner"]')).toBeNull()
    expect(screen.getByRole('tab', { name: /Monthly notices/ })).toBeTruthy()
  })

  it('the address gate offers no door to a role that cannot edit the record, and none without the page’s handler', async () => {
    const d = data([], [], true)
    d.gcsById = { lowbeck: { ...d.gcsById.lowbeck!, address: '' } }
    const rows = withContractorAddress([affRow], d.gcsById)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, [], TODAY)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(document.body.textContent).toContain('The general contractor has no address on its customer record.')
    expect(document.querySelector('[data-lien-affidavit-contractor-door]')).toBeNull()
  })

  it('on an affidavit ready to file the band reads File it › and opens the Lien window’s affidavit tab, as the footer’s press does (v2.7321)', async () => {
    const onOpenLienAffidavit = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([draft({ notice: {}, affidavitForm: 'short' })])} initialKind="affidavit" onOpenLienAffidavit={onOpenLienAffidavit} />)
    await settle()
    const band = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-verdict]') as HTMLElement
    expect(band.textContent).toContain('File the affidavit')
    const press = band.querySelector('[data-lien-timeline-act="footer"]') as HTMLButtonElement
    expect(press.textContent).toBe('File it ›')
    expect(press.getAttribute('title')).toBe('Waiting on us — the affidavit to be filed')
    fireEvent.click(press)
    expect(onOpenLienAffidavit).toHaveBeenCalledWith('j650')
    // The footer's own press is the same door.
    expect(screen.getByRole('button', { name: 'Open the affidavit tab ›' })).toBeTruthy()
  })

  it('an affidavit approved before the short form keeps its ten paragraphs, and Redraw on the short form takes it back to a marked draft', async () => {
    redrawOneMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([draft({ notice: {}, gcEmail: '' })])} initialKind="affidavit" />)
    await settle()
    expect(paper().getAttribute('data-lien-affidavit-paper')).toBe('long')
    expect(paper().textContent).toContain('All statutory notices required by the Texas Property Code have been sent')
    expect(paper().textContent).toContain('Job #650')
    const note = document.querySelector('[data-lien-affidavit-form="long"]') as HTMLElement
    expect(note.textContent).toContain('This affidavit is on the earlier form, as it was drafted.')
    // The press asks once, in words that say what happens to the approval.
    fireEvent.click(screen.getByRole('button', { name: 'Redraw on the short form…' }))
    expect(note.textContent).toContain('It needs approval again before it is filed.')
    expect(redrawOneMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw on the short form' }))
    // One write (`redrawLienAffidavitShort`): the item back to a draft with the short form's mark.
    await waitFor(() => expect(redrawOneMock).toHaveBeenCalledTimes(1))
    expect((redrawOneMock.mock.calls[0] as unknown as [{ id: string }])[0].id).toBe('aff1')
  })

  it('the list offers one press for every ready earlier-form paper: it names the count, asks once, and redraws them', async () => {
    redrawManyMock.mockClear()
    // Two jobs ready on the earlier form, one already on the short form.
    const rows = ['j650', 'j651', 'j652'].map((job_id) => ({ ...affRow, job_id }))
    const items = [draft({ notice: {} }), { ...draft({ notice: {} }), id: 'aff2', job_id: 'j651' }, { ...draft({ notice: {}, affidavitForm: 'short' }), id: 'aff3', job_id: 'j652' }] as LienDeskItemRow[]
    const d = data([], items, true)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, items, TODAY)
    d.jobsById = { ...d.jobsById, j651: { ...d.jobsById.j650!, id: 'j651', hcp_number: '651' }, j652: { ...d.jobsById.j650!, id: 'j652', hcp_number: '652' } }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-redraw]') as HTMLElement
    expect(bar.textContent).toContain('2 ready affidavits are on the earlier form.')
    fireEvent.click(within(bar).getByRole('button', { name: 'Redraw 2 on the short form…' }))
    // The confirm window says what happens to the approval, and its button names the act with the count.
    expect(await screen.findByText('Redraw 2 affidavits on the short form?')).toBeTruthy()
    expect(screen.getByText('Each affidavit goes back to To send for Master approval on the short form. Each needs approval again before it is filed.')).toBeTruthy()
    expect(redrawManyMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw 2 on the short form' }))
    await waitFor(() => expect(redrawManyMock).toHaveBeenCalledTimes(1))
    expect((redrawManyMock.mock.calls[0]![0] as Array<{ jobId: string; item: { id: string } }>).map((p) => [p.jobId, p.item.id])).toEqual([['j650', 'aff1'], ['j651', 'aff2']])
  })

  it('a paper that did not take stays listed under the press with its reason and a door to its row', async () => {
    redrawManyMock.mockClear()
    redrawManyMock.mockImplementationOnce(async () => ({ done: [], failed: [{ jobId: 'j650', reason: 'This affidavit is no longer a draft on the desk.' }] }))
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([draft({ notice: {} })])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw 1 on the short form…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Redraw 1 on the short form' }))
    await waitFor(() => expect(document.querySelector('[data-lien-affidavit-redraw-failed]')).toBeTruthy())
    const failed = document.querySelector('[data-lien-affidavit-redraw-failed]') as HTMLElement
    expect(failed.textContent).toContain('1 affidavit did not redraw. It stays here with the reason.')
    expect(failed.textContent).toContain('This affidavit is no longer a draft on the desk.')
    expect(within(failed).getByRole('button').textContent).toContain('650')
  })

  it('no ready paper on the earlier form: no press on the list', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([draft({ notice: {}, affidavitForm: 'short' })])} initialKind="affidavit" />)
    await settle()
    expect(document.querySelector('[data-lien-affidavit-redraw]')).toBeNull()
  })

  it('a draft that carries the mark is drawn on the short form, with no redraw press', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk([draft({ notice: {}, gcEmail: '', affidavitForm: 'short' })])} initialKind="affidavit" />)
    await settle()
    expect(paper().getAttribute('data-lien-affidavit-paper')).toBe('short')
    expect(document.querySelector('[data-lien-affidavit-form]')).toBeNull()
  })

  // Three jobs at one GC whose standing rule is "send", with a notice to it on record.
  const three = (items: LienDeskItemRow[]) => {
    const rows = ['j650', 'j651', 'j652'].map((job_id) => ({ ...affRow, job_id }))
    const d = data([], items, true)
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, items, TODAY)
    d.jobsById = { ...d.jobsById, j651: { ...d.jobsById.j650!, id: 'j651', hcp_number: '651' }, j652: { ...d.jobsById.j650!, id: 'j652', hcp_number: '652' } }
    d.gcsById = { lowbeck: { ...d.gcsById.lowbeck!, policy: 'send' } }
    d.gcsWithPriorNotice = new Set(['lowbeck'])
    d.filingsByJob = { j650: [notice], j651: [{ ...notice, id: 'f-n2', job_id: 'j651' }], j652: [{ ...notice, id: 'f-n3', job_id: 'j652' }] } as unknown as LienDeskData['filingsByJob']
    return d
  }

  it('the list sends every drafted affidavit for approval in one press: it names the count, says where each goes, and leaves a paper nobody drafted (v2.6918)', async () => {
    submitManyMock.mockClear()
    const drafted = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id, status: 'drafted', approval_mode: null }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([drafted('aff1', 'j650'), drafted('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-send-all]') as HTMLElement
    expect(bar.textContent).toContain('2 drafted affidavits are ready to send.')
    expect(bar.querySelector('[data-lien-affidavit-send-all-foot]')?.textContent).toBe('1 in To send for Master approval was never opened. Open it from its own paper.')
    fireEvent.click(within(bar).getByRole('button', { name: 'Send 2 for approval…' }))
    expect(await screen.findByText('Send 2 affidavits for approval?')).toBeTruthy()
    expect(screen.getByText('2 are approved at once by a GC’s standing rule and move to Ready to file.')).toBeTruthy()
    expect(submitManyMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval' }))
    await waitFor(() => expect(submitManyMock).toHaveBeenCalledTimes(1))
    expect(submitManyMock.mock.calls[0]![0].map((p) => [p.jobId, p.itemId, p.outcome.status])).toEqual([['j650', 'aff1', 'approved'], ['j651', 'aff2', 'approved']])
    // Nothing is ready to print yet, so the print press is not offered.
    expect(document.querySelector('[data-lien-affidavit-print-all]')).toBeNull()
  })

  it('a find narrows both presses to the rows it shows, and each says what it hides (punch list #353, part 1)', async () => {
    submitManyMock.mockClear()
    const drafted = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id, status: 'drafted', approval_mode: null }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([drafted('aff1', 'j650'), drafted('aff2', 'j651'), drafted('aff3', 'j652')])} initialKind="affidavit" />)
    await settle()
    const bar = () => document.querySelector('[data-lien-affidavit-send-all]') as HTMLElement
    expect(within(bar()).getByRole('button', { name: 'Send 3 for approval…' })).toBeTruthy()
    expect(bar().querySelector('[data-lien-affidavit-send-all-hidden]')).toBeNull()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: '651' } })
    await settle()
    expect(within(bar()).getByRole('button', { name: 'Send 1 shown for approval…' })).toBeTruthy()
    expect(bar().querySelector('[data-lien-affidavit-send-all-hidden]')?.textContent).toBe('2 more drafted papers are not shown. Clear the find to send them too.')
    fireEvent.click(within(bar()).getByRole('button', { name: 'Send 1 shown for approval…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send 1 shown for approval' }))
    await waitFor(() => expect(submitManyMock).toHaveBeenCalledTimes(1))
    expect(submitManyMock.mock.calls[0]![0].map((p) => p.jobId)).toEqual(['j651'])
  })

  it('To do’s door to the batch print reads as the button it leads to, and lands on the list where that button stands (v2.7398)', async () => {
    openPrintMock.mockClear()
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    // Three ready affidavits due inside the week, so they stand under Needs you now, where the door is.
    const d = three([ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')])
    for (const e of d.affidavits.entries) Object.assign(e, { deadline: '2026-09-16', daysLeft: 2, severity: 'red' })
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    // Since v2.7456 (punch list #362, step 4) the three papers are one row under Ready to file, and the door is that row's press. It stood on the On track head.
    expect(document.querySelector('[data-lien-next-up-track-press]')).toBeNull()
    const fold = document.querySelector('[data-lien-next-up-row="fold:affidavit:ready:file_affidavit"]') as HTMLElement
    expect(document.querySelectorAll('[data-lien-next-up-bin="affidavit:ready"] [data-lien-next-up-row]')).toHaveLength(1)
    expect(fold.textContent).toContain('3 affidavits approved and ready to file')
    expect(document.querySelector('[data-lien-next-up-bin="affidavit:ready"] h4')!.textContent).toBe('Ready to file · 3 affidavits')
    // Its jobs wait behind the fold, each a door to its job.
    fireEvent.click(fold.querySelector('[data-lien-next-up-fold]') as HTMLElement)
    expect(fold.querySelectorAll('[data-lien-next-up-fold-body] [data-lien-next-up-fold-amount]')).toHaveLength(3)
    expect(fold.querySelector('[data-lien-next-up-fold-body]')!.textContent).toContain('650')
    const door = fold.querySelector('[data-lien-next-up-act="file_affidavit"]') as HTMLButtonElement
    expect(door.textContent).toBe('Print 3 for notarization ›')
    fireEvent.click(door)
    await settle()
    // The list at Ready to file, with the button of the same name; the door printed nothing itself.
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    expect(within(bar).getByRole('button', { name: 'Print 3 for notarization' })).toBeTruthy()
    expect(door.textContent).toBe(`${within(bar).getByRole('button', { name: 'Print 3 for notarization' }).textContent} ›`)
    expect(document.querySelector('[data-lien-do-now]')).toBeNull()
    expect(openPrintMock).not.toHaveBeenCalled()
  })

  it('the Board’s Ready to file bin carries the print itself on its title line: it prints from To do, and a stack that is not the usual one says so with the press that puts it back (v2.7470, punch list #362; in the bin since v2.7708)', async () => {
    openPrintMock.mockClear()
    window.localStorage.setItem('pt.lienHelpSheet.v1', 'off')
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    const d = three([ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')])
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const foot = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(foot.querySelector('[data-lien-board-print-note]')!.textContent).toBe('Prints without the help sheet · Put it back ›')
    const press = within(foot).getByRole('button', { name: 'Print 3 for notarization' })
    fireEvent.click(press)
    await settle()
    // The stack printed, and the desk is still on To do: the press is the print, not a door.
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-do-now]')).toBeTruthy()
    // The line's press puts the usual pages back where it stands: the line goes, the choice is forgotten, and the desk is still on To do.
    fireEvent.click(within(foot).getByRole('button', { name: 'Put it back ›' }))
    await settle()
    expect(document.querySelector('[data-lien-board-bin="affidavit:ready"] [data-lien-board-print-note]')).toBeNull()
    expect(window.localStorage.getItem('pt.lienHelpSheet.v1')).toBeNull()
    expect(document.querySelector('[data-lien-do-now]')).toBeTruthy()
    expect(document.querySelector('[data-lien-affidavit-print-all]')).toBeNull()
  })

  it('the usual stack draws no line under Ready to file (the owner’s call of 2026-11-18)', async () => {
    window.localStorage.removeItem('pt.lienHelpSheet.v1')
    window.localStorage.removeItem('pt.lienNoticeRecord.v1')
    window.localStorage.removeItem('pt.lienNoticeCopiesBatch.v1')
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')])} initialKind="next" />)
    await settle()
    const foot = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(within(foot).getByRole('button', { name: 'Print 3 for notarization' })).toBeTruthy()
    expect(foot.querySelector('[data-lien-board-print-note]')).toBeNull()
  })

  it('an approved affidavit a fact holds stands in Ready to file as a held chip, with no line and no Held bin, and the bin counts what the print takes (v2.7783)', async () => {
    window.localStorage.removeItem('pt.lienHelpSheet.v1')
    window.localStorage.removeItem('pt.lienNoticeRecord.v1')
    window.localStorage.removeItem('pt.lienNoticeCopiesBatch.v1')
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    const items = [ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')]
    const d = three(items)
    // The legal description went missing on one job after its paper was approved: the approval stands, and the print leaves it.
    const rows = d.affidavitRows.map((r) => (r.job_id === 'j652' ? { ...r, has_legal: false } : r))
    d.affidavitRows = rows
    d.affidavits = buildLienAffidavitQueue(rows, items, TODAY)
    expect(d.affidavits.entries.find((e) => e.jobId === 'j652')!.pile).toBe('held')
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    expect(document.querySelector('[data-lien-board-bin$=":held"]')).toBeNull()
    const bin = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(bin.querySelector('[data-lien-board-count]')!.textContent).toBe('2')
    expect(within(bin).getByRole('button', { name: 'Print 2 for notarization' })).toBeTruthy()
    expect(bin.querySelector('[data-lien-board-bin-line]')).toBeNull()
    expect(Array.from(bin.querySelectorAll('[data-lien-board-chip]')).map((el) => [el.textContent, el.getAttribute('data-held')])).toEqual([['650', null], ['651', null], ['652‖', 'yes']])
  })

  it('a reader who is not the lien office gets no print on the Board’s bins', async () => {
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="estimator" data={three([ready('aff1', 'j650'), ready('aff2', 'j651')])} initialKind="next" />)
    await settle()
    expect(document.querySelector('[data-lien-board-print-press]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin-press]')).toBeNull()
  })

  it('a find narrows the print to the rows it shows, and the help sheet lists no hidden paper as held (punch list #353, part 1)', async () => {
    openPrintMock.mockClear()
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')])} initialKind="affidavit" />)
    await settle()
    const bar = () => document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    expect(within(bar()).getByRole('button', { name: 'Print 3 for notarization' })).toBeTruthy()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: '651' } })
    await settle()
    expect(bar().querySelector('[data-lien-affidavit-print-ready]')?.textContent).toBe('1 ready to print')
    expect(bar().querySelector('[data-lien-affidavit-print-all-hidden]')?.textContent).toBe('2 more ready papers are not shown. Clear the find to print them too.')
    fireEvent.click(within(bar()).getByRole('button', { name: 'Print 1 shown for notarization' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    const html = openPrintMock.mock.calls[0]![0]
    expect(html.match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(1)
    expect(html).not.toContain('not in this print')
  })

  it('a paper that was not sent stays listed under the press with its reason', async () => {
    submitManyMock.mockClear()
    submitManyMock.mockImplementationOnce(async () => ({ done: [], failed: [{ jobId: 'j650', reason: 'The affidavit could not be sent for approval.' }] }))
    const drafted = { ...draft({ notice: {}, affidavitForm: 'short' }), status: 'drafted', approval_mode: null } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([drafted])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 for approval…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send 1 for approval' }))
    await waitFor(() => expect(document.querySelector('[data-lien-affidavit-send-all-failed]')).toBeTruthy())
    const failed = document.querySelector('[data-lien-affidavit-send-all-failed]') as HTMLElement
    expect(failed.textContent).toContain('1 affidavit did not send. It stays here with the reason.')
    expect(failed.textContent).toContain('The affidavit could not be sent for approval.')
  })

  // The same three jobs with no standing rule: every paper goes to the leader.
  const threeAsked = (items: LienDeskItemRow[]) => {
    const d = three(items)
    d.gcsById = { lowbeck: { ...d.gcsById.lowbeck!, policy: 'ask' } }
    return d
  }
  const draftedAff = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id, status: 'drafted', approval_mode: null }) as LienDeskItemRow

  it('a batch sent for approval tells the leader once, with every paper that waits for him and its day to file (punch list #305, v2.7180)', async () => {
    submitManyMock.mockClear()
    tellAffMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={threeAsked([draftedAff('aff1', 'j650'), draftedAff('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval…' }))
    expect(await screen.findByText('2 go to the leader for approval.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval' }))
    // One call for the two papers, never one each.
    await waitFor(() => expect(tellAffMock).toHaveBeenCalledTimes(1))
    expect(tellAffMock.mock.calls[0]![0].map((p) => [p.itemId, p.dueYmd])).toEqual([['aff1', '2026-11-16'], ['aff2', '2026-11-16']])
    expect(await screen.findByText("Sent 2 affidavits. Malachi's phone has the 2 that wait for approval in one message.")).toBeTruthy()
  })

  it('a batch a standing rule approves tells nobody: nothing waits for the leader', async () => {
    submitManyMock.mockClear()
    tellAffMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([draftedAff('aff1', 'j650'), draftedAff('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send 2 for approval' }))
    expect(await screen.findByText('Sent 2 affidavits.')).toBeTruthy()
    expect(tellAffMock).not.toHaveBeenCalled()
  })

  it('a tell that fails never blocks the send: the papers are sent, and the toast says he was not told and why', async () => {
    submitManyMock.mockClear()
    tellAffMock.mockClear()
    // The function as it was before it learned the affidavit refuses the request until it is redeployed.
    tellAffMock.mockImplementationOnce(async () => ({ ok: false, reason: 'Missing item_id' }))
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} onChanged={onChanged} authRole="assistant" data={threeAsked([draftedAff('aff1', 'j650'), draftedAff('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send 2 for approval' }))
    expect(await screen.findByText('Sent 2 affidavits. The leader was not told of the 2 that wait for approval. The part of the app that tells the leader is waiting for its update. The Dashboard shows them.')).toBeTruthy()
    expect(submitManyMock).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalled()
    expect(document.querySelector('[data-lien-affidavit-send-all-failed]')).toBeNull()
  })

  it('a paper whose send failed is not in the tell', async () => {
    submitManyMock.mockClear()
    tellAffMock.mockClear()
    submitManyMock.mockImplementationOnce(async () => ({ done: ['j651'], failed: [{ jobId: 'j650', reason: 'The affidavit could not be sent for approval.' }] }))
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={threeAsked([draftedAff('aff1', 'j650'), draftedAff('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 for approval…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send 2 for approval' }))
    await waitFor(() => expect(tellAffMock).toHaveBeenCalledTimes(1))
    expect(tellAffMock.mock.calls[0]![0].map((p) => p.itemId)).toEqual(['aff2'])
    expect(await screen.findByText("Sent 1 affidavit. 1 did not send. Malachi's phone has the 1 that waits for approval.")).toBeTruthy()
  })

  it('the pane’s own Send for approval tells the leader of that one paper, as a notice does', async () => {
    saveDraftMock.mockClear()
    submitMock.mockClear()
    tellAffMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={threeAsked([])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /to approve ▸/ }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect((submitMock.mock.calls[0] as unknown as [string, { status: string }])[1].status).toBe('awaiting_approval')
    await waitFor(() => expect(tellAffMock).toHaveBeenCalledTimes(1))
    expect(tellAffMock.mock.calls[0]![0]).toEqual([{ itemId: 'it-new', dueYmd: '2026-11-16' }])
    expect(await screen.findByText("Sent for approval. Malachi's phone has it.")).toBeTruthy()
  })

  it('one press per affidavit footer (v2.7324): the office’s menu holds his word alone and runs the word row; the leader sees I approve it ▸ alone, with the notary line and no signing box', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" leaderNameFor={() => 'Malachi Whites'} data={threeAsked([])} initialKind="affidavit" />)
    await settle()
    expect(screen.queryByRole('button', { name: /said to file it/ })).toBeNull()
    expect((document.querySelector('[data-lien-affidavit-foot-line]') as HTMLElement).textContent).toContain('One line on Malachi’s phone.')
    fireEvent.click(screen.getByRole('button', { name: 'He already okayed it ▾' }))
    const rows = screen.getAllByRole('menuitem')
    expect(rows.map((r) => r.querySelector('strong')?.textContent)).toEqual(['Malachi said to file it…'])
    fireEvent.click(rows[0]!)
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve on his word/ })).toBeTruthy()
    cleanup()
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" leaderNameFor={() => 'Malachi Whites'} data={threeAsked([])} initialKind="affidavit" />)
    await settle()
    expect(screen.getByRole('button', { name: 'I approve it ▸' })).toBeTruthy()
    expect(document.querySelector('[data-lien-foot-menu]')).toBeNull()
    expect(screen.queryByTestId('lien-sign-line')).toBeNull()
    expect((document.querySelector('[data-lien-affidavit-foot-line]') as HTMLElement).textContent).toContain('Ready to file. You sign it on paper before a notary.')
  })

  it('an affidavit opened and read writes no row (v2.7327): the draft saves itself only on a change', async () => {
    saveDraftMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={threeAsked([])} initialKind="affidavit" />)
    await settle()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()
    expect(saveDraftMock).not.toHaveBeenCalled()
    expect(document.querySelector('[data-lien-affidavit-saved]')).toBeNull()
  })

  it('the pane’s send that a standing rule approves tells nobody', async () => {
    submitMock.mockClear()
    tellAffMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /to approve ▸/ }))
    expect(await screen.findByText('Approved by the standing rule — ready to file.')).toBeTruthy()
    expect(tellAffMock).not.toHaveBeenCalled()
  })

  it('the address names the affidavit to open on: the leader’s push for one paper lands on it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={threeAsked([])} initialKind="affidavit" initialJobId="j651" />)
    await settle()
    const current = Array.from(document.querySelectorAll('button[aria-current="true"]')).map((b) => b.textContent ?? '')
    expect(current.some((t) => t.includes('651'))).toBe(true)
    expect(current.some((t) => t.includes('650'))).toBe(false)
  })

  it('the leader’s press (v2.7334; on his bin’s title line since v2.7708): a master reads every bin, and his Awaiting Master approval bin carries one counted press that asks, approves the affidavits one by one and re-reads; a dev who leads none and the office get no press', async () => {
    approveLotMock.mockClear()
    const awaiting = (id: string, job_id: string) => ({ ...draftedAff(id, job_id), status: 'awaiting_approval', submitted_at: '2026-09-13T14:00:00Z' }) as LienDeskItemRow
    const onChanged = vi.fn()
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={threeAsked([awaiting('aff1', 'j650'), awaiting('aff2', 'j651')])} initialKind="next" onChanged={onChanged} />)
    await settle()
    const board = () => document.querySelector('[data-lien-board]') as HTMLElement
    // Every bin, with no switch to his own two.
    expect(board().querySelectorAll('[data-lien-board-bin]').length).toBeGreaterThan(2)
    expect(board().querySelector('[data-lien-board-mine]')).toBeNull()
    expect(board().querySelector('[data-lien-board-leader-bar]')).toBeNull()
    expect(board().querySelectorAll('[data-lien-board-chips="affidavit:awaiting"] [data-lien-board-chip]')).toHaveLength(2)
    const press = board().querySelector('[data-lien-board-approve]') as HTMLButtonElement
    expect(press.parentElement!.getAttribute('data-lien-board-bin-title')).toBe('affidavit:awaiting')
    expect(press.textContent).toBe('Approve 2 affidavits')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    expect(await screen.findByText('Approve 2 affidavits?')).toBeTruthy()
    const confirms = screen.getAllByRole('button', { name: 'Approve 2 affidavits' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(approveLotMock).toHaveBeenCalledTimes(2))
    expect(approveLotMock.mock.calls.map((c) => c[0]).sort()).toEqual(['aff1', 'aff2'])
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    desk.unmount()
    // The office reads the same bins and has no press to approve.
    cleanup()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={threeAsked([awaiting('aff1', 'j650')])} initialKind="next" />)
    await settle()
    expect(board().querySelectorAll('[data-lien-board-chips="affidavit:awaiting"] [data-lien-board-chip]')).toHaveLength(1)
    expect(board().querySelector('[data-lien-board-mine]')).toBeNull()
    expect(board().querySelector('[data-lien-board-approve]')).toBeNull()
  })

  it('on a phone the notary’s print box opens folded behind one bar, and a computer has no bar (punch list #352, the leftovers)', async () => {
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    // A computer: the whole box, no bar.
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    expect(document.querySelector('[data-lien-affidavit-print-all]')).not.toBeNull()
    expect(document.querySelector('[data-lien-affidavit-print-fold]')).toBeNull()
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651')])} layout="stacked" initialKind="affidavit" />)
      await settle()
      const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
      // The count stays over the bar. The bar says what it opens and starts folded (`index.css` hides what follows it).
      expect(bar.querySelector('[data-lien-affidavit-print-ready]')?.textContent).toBe('2 ready to print')
      const fold = bar.querySelector('[data-lien-affidavit-print-fold]') as HTMLButtonElement
      expect(fold.textContent).toBe('Show the print for the notary▾')
      expect(fold.getAttribute('aria-expanded')).toBe('false')
      expect(fold.style.minHeight).toBe('44px')
      // The count is before the bar and the print press, the chips and the county after it, so the fold takes those and no more.
      const kids = [...bar.children]
      expect(kids.indexOf(bar.querySelector('[data-lien-affidavit-print-status]')!)).toBeLessThan(kids.indexOf(fold))
      expect(kids.indexOf(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))).toBeGreaterThan(kids.indexOf(fold))
      expect(kids.indexOf(bar.querySelector('[data-lien-affidavit-print-with]')!)).toBeGreaterThan(kids.indexOf(fold))
      // A tick made while it is open is kept through a fold: the box stays mounted.
      fireEvent.click(fold)
      expect(fold.getAttribute('aria-expanded')).toBe('true')
      expect(fold.textContent).toBe('Hide the print for the notary▴')
      const helpSheet = bar.querySelector('[data-lien-affidavit-help-sheet] input') as HTMLInputElement
      const was = helpSheet.checked
      fireEvent.click(helpSheet)
      fireEvent.click(fold)
      expect(fold.getAttribute('aria-expanded')).toBe('false')
      expect((bar.querySelector('[data-lien-affidavit-help-sheet] input') as HTMLInputElement).checked).toBe(!was)
      // The choice is kept on this computer, so the next test gets it back as it was.
      fireEvent.click(bar.querySelector('[data-lien-affidavit-help-sheet] input') as HTMLInputElement)
    } finally {
      window.matchMedia = before
    }
  })

  it('the list prints every ready short-form affidavit in one press: one window, each paper on its own sheet, and each job files its own copy (v2.6918)', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    const ready = (id: string, job_id: string, short: boolean) => ({ ...draft(short ? { notice: {}, affidavitForm: 'short' } : { notice: {} }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650', true), ready('aff2', 'j651', true), ready('aff3', 'j652', false)])} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    // The status line (v2.7209): the count in short, and the old sentence's fact as its tip. No paper is held, so no amber press.
    expect(bar.querySelector('[data-lien-affidavit-print-ready]')?.textContent).toBe('2 ready to print')
    expect(bar.querySelector('[data-lien-affidavit-print-ready]')?.getAttribute('title')).toBe('2 affidavits on the short form are ready to file.')
    expect(bar.querySelector('[data-lien-affidavit-print-held]')).toBeNull()
    expect(bar.querySelector('[data-lien-affidavit-print-all-foot]')?.textContent).toBe('1 ready affidavit is on the earlier form and is left out. Redraw it, or print it from its own Lien window.')
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    const html = openPrintMock.mock.calls[0]![0]
    expect(html.match(/<div class="filing-paper[^"]*"/g)).toEqual(['<div class="filing-paper filing-tight"', '<div class="filing-paper filing-next-paper filing-tight"'])
    expect(html.match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(2)
    // A print counts as a send: each job keeps its own paper, as the Lien window's print files it.
    expect(fileCopyMock).toHaveBeenCalledTimes(2)
    expect(fileCopyMock.mock.calls.map(([f]) => [f.kind, f.how, f.jobIds])).toEqual([['lien_affidavit', 'print', ['j650']], ['lien_affidavit', 'print', ['j651']]])
    expect(fileCopyMock.mock.calls.map(([f]) => f.title)).toEqual([expect.stringMatching(/^Lien Affidavit — Job .*650$/), expect.stringMatching(/^Lien Affidavit — Job .*651$/)])
    expect(fileCopyMock.mock.calls[0]![1].html.match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(1)
    // The help sheet prints first (punch list #314): a row for each paper and the one left out, and no job's filed copy carries it.
    expect(html.indexOf('data-lien-help="batch"')).toBeGreaterThan(0)
    expect(html.indexOf('data-lien-help="batch"')).toBeLessThan(html.indexOf('<div class="filing-paper'))
    expect(html).toContain('Lien affidavits: this batch of 2')
    expect(html).toContain('Not printed. It is on the earlier form. Redraw it, or print it from its own Lien window.')
    expect(fileCopyMock.mock.calls.every(([, body]) => !body.html.includes('lien-help'))).toBe(true)
  })

  it('the help sheet box is ticked until someone unticks it, and an unticked box prints the papers alone (punch list #314)', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    window.localStorage.removeItem('pt.lienHelpSheet.v1')
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651')])} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    const box = within(bar.querySelector('[data-lien-affidavit-help-sheet]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    // A chip under *Print with* (v2.7209): still a tick box, with the same stored choice.
    expect(bar.querySelector('[data-lien-affidavit-help-sheet]')?.textContent).toBe('Help sheet')
    expect(within(bar).getByRole('group', { name: 'Print with' }).contains(box)).toBe(true)
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(box.checked).toBe(false)
    expect(window.localStorage.getItem('pt.lienHelpSheet.v1')).toBe('off')
    // The notice records have a box of their own (punch list #322): with both unticked the papers print alone.
    fireEvent.click(within(bar.querySelector('[data-lien-affidavit-notice-record]') as HTMLElement).getByRole('checkbox'))
    expect(window.localStorage.getItem('pt.lienNoticeRecord.v1')).toBe('off')
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    expect(openPrintMock.mock.calls[0]![0]).not.toContain('lien-help')
    expect(fileCopyMock).toHaveBeenCalledTimes(2)
    window.localStorage.removeItem('pt.lienHelpSheet.v1')
    window.localStorage.removeItem('pt.lienNoticeRecord.v1')
  })

  it('the batch prints a notice record block for each paper behind the help sheet, and copies of the notices when their box is ticked (punch list #322)', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    for (const key of ['pt.lienHelpSheet.v1', 'pt.lienNoticeRecord.v1', 'pt.lienNoticeCopiesBatch.v1']) window.localStorage.removeItem(key)
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    const d = three([ready('aff1', 'j650'), ready('aff2', 'j651')])
    // j650 has a notice on record with both copies and its own words; j651 has none.
    const words = { noticeDate: '2026-07-10', projectDescription: '650 Sample Way, Marlow, TX 75001', claimantName: 'Sample Plumbing LLC', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Ridgeway Builders', contractedWithIfDifferent: '', claimAmount: '2650.00', contactPerson: 'Pat Sample', claimantAddress: '100 Made Up Rd, Marlow, TX 75001' }
    const sends = [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 0000 0000 0000 0000 11', sent_on: '2026-07-10' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-07-10' }]
    d.filingsByJob = { j650: [{ id: 'f-n', job_id: 'j650', kind: 'notice_53_056', months_covered: ['2026-06'], sends, fields: words, amount: 2650, created_at: '2026-07-10T15:00:00Z', voided_at: null, document_url: '', document_note: '' }] } as unknown as LienDeskData['filingsByJob']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    const recordBox = within(bar.querySelector('[data-lien-affidavit-notice-record]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(bar.querySelector('[data-lien-affidavit-notice-record]')?.textContent).toBe('Notice record')
    expect(recordBox.checked).toBe(true)
    // The copies are the one box that starts unticked, and it says what it costs.
    const copiesBox = within(bar.querySelector('[data-lien-affidavit-notice-copies]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(bar.querySelector('[data-lien-affidavit-notice-copies]')?.textContent).toBe('Notice copies, 1 page')
    // The three chips keep the order the boxes had: help sheet, notice record, copies.
    expect(within(within(bar).getByRole('group', { name: 'Print with' })).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['Help sheet', 'Notice record', 'Notice copies, 1 page'])
    expect(copiesBox.checked).toBe(false)
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    let html = openPrintMock.mock.calls[0]![0]
    expect(html.indexOf('data-lien-help="batch"')).toBeLessThan(html.indexOf('data-lien-help="records"'))
    expect(html.indexOf('data-lien-help="records"')).toBeLessThan(html.indexOf('<div class="filing-paper'))
    expect(html.match(/data-lien-record-paper="/g)).toHaveLength(2)
    expect(html).toContain('9407 0000 0000 0000 0000 11')
    expect(html).toContain('<strong>No mail number on record</strong>')
    expect(html).toContain('data-lien-record-no-notice')
    expect(html).toContain('The notice records are next, then 2 papers')
    expect(html).not.toContain('data-lien-help="notice-copy"')
    // No job's filed copy carries a word of the record.
    expect(fileCopyMock.mock.calls.every(([, body]) => !body.html.includes('lien-help') && !body.html.includes('lien-record'))).toBe(true)
    // Ticked, a copy of the notice prints behind the records, named by its paper's row, and still in front of every paper.
    fireEvent.click(copiesBox)
    expect(window.localStorage.getItem('pt.lienNoticeCopiesBatch.v1')).toBe('on')
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    html = openPrintMock.mock.calls[1]![0]
    expect(html.match(/data-lien-help="notice-copy"/g)).toHaveLength(1)
    expect(html).toContain('Copy of notice 1 · do not mail or file this page')
    expect(html).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(html.lastIndexOf('</section>')).toBeLessThan(html.indexOf('<div class="filing-paper'))
    expect(fileCopyMock.mock.calls.every(([, body]) => !body.html.includes('lien-help'))).toBe(true)
    for (const key of ['pt.lienHelpSheet.v1', 'pt.lienNoticeRecord.v1', 'pt.lienNoticeCopiesBatch.v1']) window.localStorage.removeItem(key)
  })

  it('a ready paper a gate has closed is not printed, the sheet says what the app checked, and the typed county prints on both county lines (punch list #314)', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    window.localStorage.removeItem('pt.lienHelpSheet.v1')
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    const d = three([ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')])
    // j652's owner turned out to be a public body after the paper was approved: the closed gate moves it to Held (punch list #335; it stayed in Ready to file until v2.7449).
    d.affidavitRows = d.affidavitRows.map((r) => (r.job_id === 'j652' ? { ...r, owner_public: true } : r))
    d.affidavits = buildLienAffidavitQueue(d.affidavitRows, [ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')], TODAY)
    expect(d.affidavits.entries.find((e) => e.jobId === 'j652')).toMatchObject({ pile: 'held', ready: false })
    expect(d.affidavits.entries.find((e) => e.jobId === 'j652')?.item?.status).toBe('approved')
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    expect(bar.querySelector('[data-lien-affidavit-print-ready]')?.textContent).toBe('2 ready to print')
    // The held paper is an amber press beside the count (v2.7209), not a grey line at the foot. Its tip keeps the old sentence.
    const held = within(bar).getByRole('button', { name: /1 held, not in this print/ })
    expect(held.getAttribute('title')).toBe('1 approved affidavit is held by a gate and is left out. Its row says why.')
    expect(held.getAttribute('aria-pressed')).toBe('false')
    expect(bar.querySelector('[data-lien-affidavit-print-all-foot]')).toBeNull()
    // Pressed, the list narrows to the held paper, whose row says why, and a line over it offers the way back.
    const rowJobs = () => Array.from(document.querySelectorAll('button')).map((b) => b.textContent ?? '').filter((t) => /last work/.test(t))
    expect(rowJobs()).toHaveLength(3)
    fireEvent.click(held)
    expect(held.getAttribute('aria-pressed')).toBe('true')
    expect(rowJobs()).toHaveLength(1)
    expect(rowJobs()[0]).toContain('652')
    expect(rowJobs()[0]).toContain('missing')
    // Its pane's footer is the gate's (punch list #335): approved and held, with the reason, and nothing for the leader to release.
    const gateFoot = document.querySelector('[data-lien-affidavit-gate-held]') as HTMLElement
    expect(gateFoot.getAttribute('data-lien-affidavit-gate-held')).toBe('public_owner')
    expect(gateFoot.textContent).toContain('Approved, and held. This is public property, so no lien can be filed.')
    expect(gateFoot.textContent).toContain('Once that is answered the paper goes back to Ready to file by itself, and the approval stands.')
    expect(screen.queryByRole('button', { name: /Release the hold and approve/ })).toBeNull()
    const strip = document.querySelector('[data-lien-affidavit-held-only]') as HTMLElement
    expect(strip.textContent).toContain('Showing the 1 held paper. Its row says why.')
    fireEvent.click(within(strip).getByRole('button', { name: 'Show every paper' }))
    expect(rowJobs()).toHaveLength(3)
    expect(document.querySelector('[data-lien-affidavit-held-only]')).toBeNull()
    // The press is its own way back too.
    fireEvent.click(held)
    expect(rowJobs()).toHaveLength(1)
    fireEvent.click(held)
    expect(rowJobs()).toHaveLength(3)
    // The county is one line (v2.7209): the empty box says in grey that the notary writes it, and nothing stands under it.
    const county = bar.querySelector('[data-lien-signing-county] input') as HTMLInputElement
    expect(county.value).toBe('')
    expect(county.placeholder).toBe('the notary writes it')
    const tip = bar.querySelector('[data-lien-signing-county-hint]') as HTMLElement
    expect(tip.hidden).toBe(true)
    // The paragraph is behind the ?, and it is the box's own description whether or not it is open.
    expect(county.getAttribute('aria-describedby')).toBe(tip.id)
    expect(tip.textContent).toBe('Type the county where it is signed to print it on both county lines.')
    const ask = within(bar).getByRole('button', { name: 'About the county it is signed in' })
    // The keyboard's focus opens it and leaving closes it; a tap opens it and a second tap closes it; Escape closes it.
    fireEvent.focus(ask)
    expect(tip.hidden).toBe(false)
    expect(ask.getAttribute('aria-expanded')).toBe('true')
    fireEvent.blur(ask)
    expect(tip.hidden).toBe(true)
    fireEvent.click(ask)
    expect(tip.hidden).toBe(false)
    fireEvent.click(ask)
    expect(tip.hidden).toBe(true)
    fireEvent.click(ask)
    fireEvent.keyDown(ask, { key: 'Escape' })
    expect(tip.hidden).toBe(true)
    // A tap somewhere else closes a tip a tap opened.
    fireEvent.click(ask)
    expect(tip.hidden).toBe(false)
    fireEvent(document.body, new MouseEvent('pointerdown', { bubbles: true }))
    expect(tip.hidden).toBe(true)
    fireEvent.change(county, { target: { value: 'Travis' } })
    expect(tip.textContent).toBe('Both county lines print Travis County. Signing somewhere else? Type that county for this print.')
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    const html = openPrintMock.mock.calls[0]![0]
    expect(html.match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(2)
    // On the two papers, behind the help sheet (whose small picture of the paper names the county too).
    expect(html.slice(html.lastIndexOf('</section>')).match(/COUNTY OF TRAVIS/g)).toHaveLength(4)
    expect(html).not.toContain('where signed')
    expect(html).toContain('Each paper has three things to write')
    expect(html).toContain('data-lien-help-batch-checks')
    expect(html).toMatch(/\d clear to sign\./)
    expect(html).toContain('1 not printed.')
    expect(html).toMatch(/Not printed\. [^<]*public/)
    // Only the two printed papers are filed, each with the county it printed.
    expect(fileCopyMock.mock.calls.map(([f]) => f.jobIds)).toEqual([['j650'], ['j651']])
    expect(fileCopyMock.mock.calls.every(([, body]) => body.html.match(/COUNTY OF TRAVIS/g)?.length === 2)).toBe(true)
  })

  it('under the print press the list names a paper that takes a second sheet, by its job, and the press still prints every paper (v2.6930)', async () => {
    openPrintMock.mockClear()
    const ready = (id: string, job_id: string) => ({ ...draft({ notice: {}, affidavitForm: 'short' }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650'), ready('aff2', 'j651')])} initialKind="affidavit" />)
    // No wait before the frames are stood in for: jsdom loads a frame by itself a tick later, with no layout to read.
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    const frame = () => bar.querySelector('iframe[data-filing-sheet-measure]') as HTMLIFrameElement
    // jsdom lays nothing out, so the frame's document is stood in for: a paper this tall, its closing run from here to there.
    const layOut = (paperPx: number, run: { top: number; bottom: number }) => {
      const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top })
      const f = frame()
      Object.defineProperty(f, 'contentDocument', { configurable: true, value: { querySelector: () => ({ getBoundingClientRect: () => rect(0, paperPx), querySelectorAll: () => [{ getBoundingClientRect: () => rect(run.top, run.bottom) }] }) } })
      fireEvent.load(f)
    }
    // Each paper is laid out alone, as its own Lien window lays it out: the first job's paper, on the sheet's rules.
    expect(frame().getAttribute('srcdoc')).toContain('@media all {')
    expect(frame().getAttribute('srcdoc')!.match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(1)
    expect(bar.querySelector('[data-lien-affidavit-print-all-sheets]')).toBeNull()
    layOut(870, { top: 560, bottom: 870 })
    layOut(995, { top: 561, bottom: 995 })
    const flags = bar.querySelector('[data-lien-affidavit-print-all-sheets]') as HTMLElement
    expect(flags.textContent).toContain('1 paper in this print takes a second sheet.')
    const row = flags.querySelector('[data-lien-affidavit-print-all-sheet="j651"]') as HTMLElement
    expect(row.textContent).toMatch(/651.* · This paper prints on 2 pages\. The last statement, the signature and the notary’s block moved to page 2 together, so none of it is cut\.$/)
    expect(flags.querySelector('[data-lien-affidavit-print-all-sheet="j650"]')).toBeNull()
    await settle()
    expect(bar.querySelector('[data-lien-affidavit-print-all-sheet="j651"]')).toBeTruthy()
    // The flag holds nothing back: the press keeps its count and prints both papers.
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    expect(openPrintMock.mock.calls[0]![0].match(/SWORN TO AND SUBSCRIBED BEFORE ME/g)).toHaveLength(2)
  })

  it('a blocked print window files nothing', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    openPrintMock.mockImplementationOnce(() => false)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([draft({ notice: {}, affidavitForm: 'short' })])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Print 1 for notarization' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    expect(fileCopyMock).not.toHaveBeenCalled()
  })
})

// ---------- v2.3522: the paper is the pane; wording; the preview window ----------

describe('LienDesk · wording and the preview (v2.3522)', () => {
  const officeWithOwner = () => data(J650.map((r) => ({ ...r, has_owner: true })), [], true)

  it('the paper is the editor (v2.3694): a shaded value becomes a box in place, Enter keeps it, the label counts it, Back puts the job’s wording back', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={officeWithOwner()} />)
    await settle()
    expect(screen.queryByRole('button', { name: /Wording/ })).toBeNull()
    const paper = document.querySelector('[data-lien-desk-paper]') as HTMLElement
    // The four typed values wear the shaded box; a filled-from-the-job value says where it comes from; the optional party line is a ghost.
    expect([...paper.querySelectorAll('[data-editable="yes"]')].map((n) => n.getAttribute('data-field'))).toEqual(['projectDescription', 'laborMaterialsType', 'contractedWithIfDifferent', 'contactPerson'])
    expect((paper.querySelector('[data-field="originalContractorName"]') as HTMLElement).getAttribute('title')).toContain('Filled from the job · the GC')
    expect((paper.querySelector('[data-field="contractedWithIfDifferent"]') as HTMLElement).getAttribute('data-ghost')).toBe('yes')
    expect(screen.queryByLabelText('Type of labor or materials')).toBeNull()
    fireEvent.click(paper.querySelector('[data-field="laborMaterialsType"] [data-field-text]') as HTMLElement)
    const labor = screen.getByLabelText('Type of labor or materials') as HTMLInputElement
    expect(labor.value).toBe('Plumbing labor and materials')
    fireEvent.change(labor, { target: { value: 'Electrical labor and materials' } })
    fireEvent.keyDown(labor, { key: 'Enter' })
    expect(screen.queryByLabelText('Type of labor or materials')).toBeNull()
    const value = () => paper.querySelector('[data-field="laborMaterialsType"] [data-field-text]') as HTMLElement
    expect(value().textContent).toBe('Electrical labor and materials')
    expect((paper.querySelector('[data-field="laborMaterialsType"]') as HTMLElement).getAttribute('data-changed')).toBe('yes')
    const noticeLabel = () => [...document.querySelectorAll('[data-lien-desk-page-label]')].map((n) => n.textContent ?? '').find((t) => t.includes('the notice')) ?? ''
    expect(noticeLabel()).toContain('1 value changed by Taunya')
    // Esc puts a typed value back without keeping it.
    fireEvent.click(value())
    fireEvent.change(screen.getByLabelText('Type of labor or materials'), { target: { value: 'nope' } })
    fireEvent.keyDown(screen.getByLabelText('Type of labor or materials'), { key: 'Escape' })
    expect(value().textContent).toBe('Electrical labor and materials')
    fireEvent.click(paper.querySelector('[data-reset="laborMaterialsType"]') as HTMLElement)
    expect(value().textContent).toBe('Plumbing labor and materials')
    expect(noticeLabel()).toContain("the job's unpaid invoice follows it in the packet")
    // The ghost line becomes a real value once typed.
    fireEvent.click(paper.querySelector('[data-field="contractedWithIfDifferent"] [data-field-text]') as HTMLElement)
    fireEvent.change(screen.getByLabelText('Party contracted with, if different from the GC'), { target: { value: 'Lowbeck Contracting of Texas LLC' } })
    fireEvent.keyDown(screen.getByLabelText('Party contracted with, if different from the GC'), { key: 'Enter' })
    expect((paper.querySelector('[data-field="contractedWithIfDifferent"]') as HTMLElement).getAttribute('data-ghost')).toBeNull()
    expect((paper.querySelector('[data-field="contractedWithIfDifferent"] [data-field-text]') as HTMLElement).textContent).toBe('Lowbeck Contracting of Texas LLC')
  })

  it('the footer says who gets it and carries the cover note; every gate has its section, a cell click brings it up, and gate 3 sets the kind in place', async () => {
    const onOpenEditJob = vi.fn()
    const onChanged = vi.fn()
    // Owner on file, property kind blank → it can go out, gate 3 is a check with its switch.
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    d.addressesById = { addr1: { ...(d.addressesById.addr1 as Record<string, unknown>), property_kind: '' } as never }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} onChanged={onChanged} />)
    // The envelope (v2.3776) sits above the paper, not in the footer; one card since v2.7427, who it goes to at the left and the ticks at the right.
    const send = document.querySelector('[data-lien-desk-send-line]') as HTMLElement
    expect(send.querySelector('[data-lien-envelope-zone="to"]')?.textContent).toContain('Goes to · certified mail')
    expect(send.textContent).toContain('Lowbeck Contracting')
    expect(send.textContent).toContain('and a courtesy PDF to office@lowbeck.test')
    // The key to the shaded boxes and the preview door are the same card's foot line.
    const legend = send.querySelector('[data-lien-desk-paper-legend]') as HTMLElement
    expect(legend.textContent).toContain('A shaded box on the paper is yours to change. Hover says where the rest came from.')
    expect(within(legend).getByRole('button', { name: 'Preview in a new window ↗' })).toBeTruthy()
    // Ready (v2.3776): ONE row — the state and its why, then Save draft and the one primary (Skip left in v2.4743).
    const next = document.querySelector('[data-lien-desk-next]') as HTMLElement
    expect(next.getAttribute('data-blocked')).toBe('no')
    expect(next.textContent).toContain('One line on the leader’s phone')
    expect(next.textContent).not.toContain('Blocked until')
    expect(next.textContent).not.toContain('give up the lien right')
    expect(screen.queryByRole('button', { name: /Go to gate/ })).toBeNull()
    // v2.4743: no Skip — a month nobody sends closes on its own and is noted as missed.
    expect(screen.queryByRole('button', { name: /^Skip / })).toBeNull()
    expect(screen.getByLabelText(/Counsel's cover letter/)).toBeTruthy()
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(gatesBox.getAttribute('data-ready')).toBe('yes')
    // The verdict row is the pane's stacked head now (v2.4733).
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe('The four gates✓ Ready to go out · 1 to check')
    expect(gatesBox.querySelector('.lienGatesHead')).toBeNull()
    expect([...gatesBox.querySelectorAll('[data-gate]')].map((g) => `${g.getAttribute('data-n')}:${g.getAttribute('data-tone')}`)).toEqual(['1:ok', '2:ok', '3:check', '4:ok'])
    expect((gatesBox.querySelector('[data-gate-detail="kind"]') as HTMLElement).textContent).toContain('3Property kind')
    // The sections fold (v2.4718): the clear gates' rows wait behind More details ∨; the one to check is open on its own.
    expect(gatesBox.querySelector('[data-gate-detail="owner"]')).toBeNull()
    expect(gatesBox.querySelector('[data-gate-detail="gc"]')).toBeNull()
    fireEvent.click(gatesBox.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    // Every gate has its section (v2.3670): a row — the number, the label, the fact with its doors first, one muted line under it.
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1Owner of recordElwick Holdings LLCCheck on Guadalupe CAD ↗Change ›4 Example Way, Schertz, TX')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('From the property record · every job here uses it.')
    expect((gatesBox.querySelector('[data-gate-detail="gc"]') as HTMLElement).textContent).toContain('2Original contractorLowbeck ContractingChange the GC ›2904 Corporate Cr, Flower Mound, TX')
    expect((gatesBox.querySelector('[data-gate-detail="months"]') as HTMLElement).textContent).toContain('4Approved hoursJun 2026 · 82.6 approved hours · on this notice')
    expect((gatesBox.querySelector('[data-lien-gates-fold]') as HTMLElement).getAttribute('data-lien-gates-fold')).toBe('close')
    expect(screen.getByRole('button', { name: 'Change the GC ›' })).toBeTruthy()
    // A cell is a button that brings its section up: both wear the ring.
    fireEvent.click(gatesBox.querySelector('[data-gate="gc"]') as HTMLElement)
    expect((gatesBox.querySelector('[data-gate="gc"]') as HTMLElement).getAttribute('data-active')).toBe('yes')
    expect((gatesBox.querySelector('[data-gate-detail="gc"]') as HTMLElement).getAttribute('data-active')).toBe('yes')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).getAttribute('data-active')).toBe('no')
    // Gate 3 on a linked property is the switch itself (v2.3667's, set in place); while the kind is blank the chooser is open with its warning (v2.4718): a pick writes the property's kind and re-reads.
    expect(screen.queryByRole('button', { name: /Set property kind/ })).toBeNull()
    expect((gatesBox.querySelector('[data-lien-gate-kind-fact]') as HTMLElement).getAttribute('data-kind-open')).toBe('yes')
    expect((gatesBox.querySelector('[data-lien-gate-kind-chooser]') as HTMLElement).textContent).toContain('Every date on the job follows the pick.')
    fireEvent.click(within(gatesBox.querySelector('[data-gate-detail="kind"]') as HTMLElement).getByRole('button', { name: 'Commercial' }))
    await waitFor(() => expect(savePropertyKindMock).toHaveBeenCalledWith('addr1', 'non_residential'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    // The Send card is gone: recipients are said once, beside the button.
    expect(screen.queryByText(/^Send$/)).toBeNull()
  })

  it('a plain value is a door to its source (v2.3697): the GC to Edit Job’s GC row, the claimant to Settings, the claim to the claim box; it rings on the paper when it comes back changed', () => {
    const onOpenEditJob = vi.fn()
    const onOpenCompanySettings = vi.fn()
    const d = officeWithOwner()
    const { rerender } = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} onOpenCompanySettings={onOpenCompanySettings} />)
    const paper = () => document.querySelector('[data-lien-desk-paper]') as HTMLElement
    const field = (k: string) => paper().querySelector(`[data-field="${k}"]`) as HTMLElement
    expect(field('originalContractorName').getAttribute('data-door')).toBe('gc')
    expect(field('originalContractorName').getAttribute('title')).toBe('Filled from the job · the GC — click to change it there')
    expect(field('claimantName').getAttribute('data-door')).toBe('company')
    expect(field('claimAmount').getAttribute('data-door')).toBe('claim')
    expect(field('noticeDate').getAttribute('data-door')).toBeNull()
    expect(field('noticeDate').getAttribute('title')).toBe('The day it is signed — nothing to change')
    fireEvent.click(field('claimantAddress').querySelector('[data-field-text]') as HTMLElement)
    expect(onOpenCompanySettings).toHaveBeenCalledWith('addressText')
    // The claim amount's door is the desk's own claim box: it opens.
    expect(screen.queryByLabelText('Claim amount on the notice')).toBeNull()
    fireEvent.click(field('claimAmount').querySelector('[data-field-text]') as HTMLElement)
    expect(screen.getByLabelText('Claim amount on the notice')).toBeTruthy()
    fireEvent.keyDown(screen.getByLabelText('Claim amount on the notice'), { key: 'Escape' })
    fireEvent.click(field('originalContractorName').querySelector('[data-field-text]') as HTMLElement)
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'gc')
    // Back from Edit Job with the GC renamed: the paper re-reads the job and rings the value that changed.
    expect(field('originalContractorName').getAttribute('data-ring')).toBeNull()
    const d2 = officeWithOwner()
    d2.gcsById = { lowbeck: { ...d2.gcsById.lowbeck!, name: 'Lowbeck Contracting of Texas LLC' } }
    rerender(<LienDesk {...baseProps} authRole="assistant" data={d2} onOpenEditJob={onOpenEditJob} onOpenCompanySettings={onOpenCompanySettings} />)
    expect((paper().querySelector('[data-field="originalContractorName"] [data-field-text]') as HTMLElement).textContent).toBe('Lowbeck Contracting of Texas LLC')
    expect(field('originalContractorName').getAttribute('data-ring')).toBe('yes')
  })

  it('Preview opens the marked notice in a new tab, and the tab’s message opens that value on the paper', async () => {
    const urls: string[] = []
    const createObjectURL = vi.fn((_b: Blob) => { const u = `blob:http://localhost/${urls.length}`; urls.push(u); return u })
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const open = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false, postMessage: () => {} }) as unknown as Window)
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={officeWithOwner()} />)
      await settle()
      fireEvent.click(screen.getByRole('button', { name: /Preview in a new window/ }))
      expect(open).toHaveBeenCalledTimes(1)
      expect(open.mock.calls[0]?.[0]).toBe(urls[0])
      // Not noopener — the preview needs its opener to post the field back.
      expect(open.mock.calls[0]?.[2]).toBeUndefined()
      const blob = createObjectURL.mock.calls[0]?.[0] as Blob
      expect(blob.type).toBe('text/html')
      const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(blob) })
      // The office can change a drafted notice's wording, so the preview's typed values are boxes (v2.3660).
      expect(text).toContain('You can change this — here or on the desk')
      expect(text).toContain('<input type="text" data-edit="contactPerson"')
      // The desk listens for the preview's message and opens that value on the paper (v2.3694).
      expect(screen.queryByLabelText('Contact person (signs)')).toBeNull()
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'lien-notice-preview-field', field: 'contactPerson' }, origin: window.location.origin }))
      await waitFor(() => expect(screen.getByLabelText('Contact person (signs)')).toBeTruthy())
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Contact person (signs)')))
      // A derived field, or a foreign origin, is ignored.
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'lien-notice-preview-field', field: 'claimAmount' }, origin: window.location.origin }))
      expect(document.activeElement).toBe(screen.getByLabelText('Contact person (signs)'))
    } finally {
      open.mockRestore()
    }
  })

  it('months are a grid (#38): each month with its window, a skipped month as a row that says who and why, and this notice as the last column', () => {
    const skippedMay = {
      id: 'sk1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-05'], status: 'missed', approval_mode: null, drafted_by: 'u-taunya', submitted_at: null,
      fields: { notice: { noticeDate: TODAY, projectDescription: '', claimantName: '', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '', contactPerson: '', claimantAddress: '' }, gcEmail: '', skipReason: 'Lowbeck paid the May invoice in full', skippedBy: { name: 'Taunya', at: '2026-08-11T15:00:00Z' } },
      cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, sent_at: null, approved_at: null, approved_by: null, held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-08-11T15:00:00Z', created_at: '2026-08-11T15:00:00Z', updated_at: '2026-08-11T15:00:00Z', voided_at: null,
    } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [skippedMay], true)} />)
    const box = document.querySelector('[data-lien-desk-month-grid]') as HTMLElement
    // The title is the pane's stacked head now (v2.4733); the helper sentence stays on the card.
    expect(document.querySelector('[data-lien-pane-head="months"]')?.textContent).toContain('Months on this job')
    expect(box.textContent).not.toContain('Months on this job')
    expect(box.textContent).toContain('Every month worked, oldest first.')
    expect(box.textContent).toContain('Claim amount on the notice$33,500')
    // Every month is a row; July's window column spells the deadline out.
    const jul = box.querySelector('[data-lien-grid-row="2026-07"]') as HTMLElement
    expect(jul.getAttribute('data-window')).toBe('open')
    expect(jul.textContent).toContain('mail by Oct\u00a015')
    expect(jul.textContent).toContain('31 days left')
    expect((screen.getByRole('checkbox', { name: /^Jul(y)? 2026$/ }) as HTMLInputElement).checked).toBe(true)
    // Several months ticked → the earliest deadline is the date this notice has to beat.
    expect(box.textContent).toContain('Sep 15 is the date this one has to beat')
    // May was skipped: a closed row that says who and why, its tick locked.
    const may = box.querySelector('[data-lien-grid-row="2026-05"]') as HTMLElement
    expect(may.getAttribute('data-window')).toBe('closed')
    expect(may.textContent).toContain('skipped')
    expect(may.textContent).toContain('Taunya: “Lowbeck paid the May invoice in full”')
    expect((screen.getByRole('checkbox', { name: 'May 2026' }) as HTMLInputElement).disabled).toBe(true)
    // This notice is the last column, lettered after the papers (none here). Its head is the name alone.
    expect((box.querySelector('[data-lien-grid-paper="this"]') as HTMLElement).textContent).toBe('AThis notice')
    // The total sits at the foot of that column (Taunya's ask of 2026-11-15), under the ticks, beside the months it names.
    const foot = box.querySelector('[data-lien-grid-foot]') as HTMLElement
    expect(foot.closest('tfoot')).toBeTruthy()
    expect(foot.textContent).toBe('This notice names Jun, Jul, Aug$33,5003 months')
    expect((foot.querySelector('[data-lien-grid-total]') as HTMLElement).textContent).toBe('$33,5003 months')
    // A skip is not a miss: no line under the grid says a lien right is gone.
    expect(box.querySelector('[data-lien-months-missed]')).toBeNull()
    // A closed month's cells are the one-line kind; an open month keeps its two lines.
    expect(may.querySelector('td.lienMonthOne')).toBeTruthy()
    expect(jul.querySelector('td.lienMonthOne')).toBeNull()
  })

  it('the claim box is the editor (v2.3682): one figure, one reason, one tick — and the notice claims the rest', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={officeWithOwner()} onChanged={onChanged} />)
    const box = document.querySelector('[data-lien-claim-box]') as HTMLElement
    expect(box.textContent).toContain('$33,500')
    expect(box.getAttribute('data-corrected')).toBe('no')
    fireEvent.click(screen.getByRole('button', { name: 'Correct the claim ›' }))
    const apply = screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Claim amount on the notice'), { target: { value: '32,000' } })
    expect((document.querySelector('[data-lien-claim-delta]') as HTMLElement).textContent).toContain('$1,500 under the $33,500 unpaid in the app')
    fireEvent.change(screen.getByLabelText('Why the claim is corrected'), { target: { value: 'GC disputes the 8/14 change order' } })
    expect(apply.disabled).toBe(false)
    fireEvent.click(apply)
    await waitFor(() => expect(saveClaimMock).toHaveBeenCalledWith({ jobId: 'j650', amountOff: 1_500, perMonth: null, reason: 'GC disputes the 8/14 change order', carry: true, userId: 'u-taunya', userName: 'Taunya' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a carried correction rides on the balance: the box, the paper, the leader’s card and the send all say so (v2.3682)', () => {
    const d = officeWithOwner()
    d.claimCorrectionsByJob = { j650: { jobId: 'j650', amountOff: 1_500, perMonth: null, reason: 'GC disputes the 8/14 change order', carry: true, setByName: 'Taunya', setAt: '2026-09-10T15:00:00Z', lookedAt: null, lookedByName: '' } }
    // A notice already went out after the correction was set → the strip asks "still true", and the rule cannot send it.
    d.items = [{ id: 'sent-1', job_id: 'j650', kind: 'notice_53_056', status: 'sent', months: ['2026-05'], fields: {}, voided_at: null, created_at: '2026-09-12T00:00:00Z', updated_at: '2026-09-12T00:00:00Z', sent_at: '2026-09-12T10:00:00Z', approval_mode: 'leader' } as never]
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={d} />)
    const box = document.querySelector('[data-lien-claim-box]') as HTMLElement
    expect(box.getAttribute('data-corrected')).toBe('yes')
    expect(box.textContent).toContain('$32,000')
    expect(box.textContent).toContain('$1,500 under the $33,500 unpaid in the app · carries until cleared')
    expect(box.textContent).toContain('Taunya · Sep 10 · “GC disputes the 8/14 change order”')
    expect((document.querySelector('[data-lien-claim-carry-strip]') as HTMLElement).textContent).toContain('Carrying Taunya’s correction from Sep 10: $1,500 off')
    expect(screen.getByRole('button', { name: 'Still true' })).toBeTruthy()
    // The paper claims the corrected figure.
    expect(document.body.textContent).toContain('$32,000.00')
    fireEvent.click(screen.getByRole('button', { name: 'Back to the job’s figure' }))
    expect(clearClaimMock).toHaveBeenCalledWith('j650')
  })

  it('a closed month nobody noted is a red row with the loss in words and Note it as missed in the row (#38; v2.3681 words)', () => {
    const d = data([row('j650', '2026-05', '2026-09-10'), ...J650].map((r) => ({ ...r, has_owner: true })), [], true)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    const may = document.querySelector('[data-lien-desk-month-grid] [data-lien-grid-row="2026-05"]') as HTMLElement
    expect(may.getAttribute('data-window')).toBe('closed')
    expect(may.textContent).toContain('closed Sep 10')
    expect(may.textContent).toContain('not noted')
    // What the missed window costs is said once, in a line under the grid that names the month, not on the row.
    expect(may.textContent).not.toContain('lien right gone')
    expect((document.querySelector('[data-lien-desk-month-grid] [data-lien-months-missed]') as HTMLElement).textContent).toBe('closed May · lien right gone · the money still rides')
    expect(within(may).getByRole('button', { name: 'Note it as missed' })).toBeTruthy()
    // One line: the chips and the press share a row, with no trailing words in the Steps view.
    const line = may.querySelector('.lienMonthClosed') as HTMLElement
    expect(line.contains(within(may).getByRole('button', { name: 'Note it as missed' }))).toBe(true)
    expect(line.querySelector('.lienMonthClosedTail')).toBeNull()
    expect(may.querySelector('td.lienMonthOne')).toBeTruthy()
    // The strip above the card is gone — the row carries it.
    expect(document.querySelector('[data-lien-desk-missed-strip]')).toBeNull()
  })

  it('a value typed in the preview lands on the desk, and the desk sends the rebuilt pages back (v2.3660)', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/p'), configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const posted: Array<{ type: string; docHtml: string; diff: string[]; values: Record<string, string> }> = []
    // A real window (an iframe's) so the message's `source` is one the desk can compare with what it opened.
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const preview = frame.contentWindow as Window
    vi.spyOn(preview, 'postMessage').mockImplementation(((m: never) => void posted.push(m)) as never)
    const open = vi.spyOn(window, 'open').mockImplementation(() => preview)
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={officeWithOwner()} />)
      await settle()
      fireEvent.click(screen.getByRole('button', { name: /Preview in a new window/ }))
      const edit = (source: Window, value: string) =>
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'lien-notice-preview-edit', field: 'laborMaterialsType', value }, origin: window.location.origin, source: source as unknown as MessageEventSource }))
      // Only the window the desk opened may write; anything else is ignored.
      edit(window, 'From somewhere else')
      expect((document.querySelector('[data-lien-desk-paper] [data-field="laborMaterialsType"]') as HTMLElement).textContent).toBe('Plumbing labor and materials')
      edit(preview, 'Electrical labor and materials')
      await waitFor(() => expect((document.querySelector('[data-lien-desk-paper] [data-field="laborMaterialsType"] [data-field-text]') as HTMLElement).textContent).toBe('Electrical labor and materials'))
      await waitFor(() => expect(posted.some((m) => m.type === 'lien-notice-preview-pages' && m.docHtml.includes('Electrical labor and materials') && m.diff.includes('laborMaterialsType') && m.values.laborMaterialsType === 'Electrical labor and materials')).toBe(true))
      // A derived field is never writable from the preview.
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'lien-notice-preview-edit', field: 'claimAmount', value: '1' }, origin: window.location.origin, source: preview as unknown as MessageEventSource }))
      expect((document.querySelector('[data-lien-desk-paper] [data-field="claimAmount"]') as HTMLElement).textContent).toBe('$33,500.00')
    } finally {
      open.mockRestore()
      frame.remove()
    }
  })

  it('the leader is told when the wording was edited, before he approves', () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'awaiting_approval', approval_mode: null, drafted_by: 'u-taunya', submitted_at: '2026-09-14T15:00:00Z',
      fields: { notice: { noticeDate: TODAY, projectDescription: 'AXO Schertz — 1204 Elwick Rd, Schertz, TX', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Electrical labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '' }, gcEmail: '', wording: { editedBy: 'Taunya', editedAt: '2026-09-14T14:59:00Z' } },
      cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, sent_at: null, approved_at: null, approved_by: null, held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-14T14:00:00Z',
    } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650.map((r) => ({ ...r, has_owner: true })), [awaiting], true)} />)
    expect(document.body.textContent).toContain('1 value changed by Taunya from the job’s wording — the notice below carries it')
    // The paper is locked once the item has left drafted (v2.3694): dotted boxes, and a click opens nothing.
    const paper = document.querySelector('[data-lien-desk-paper]') as HTMLElement
    expect((paper.querySelector('[data-field="laborMaterialsType"]') as HTMLElement).getAttribute('data-editable')).toBe('locked')
    expect(paper.querySelector('[data-ghost]')).toBeNull()
    fireEvent.click(paper.querySelector('[data-field="laborMaterialsType"] [data-field-text]') as HTMLElement)
    expect(screen.queryByLabelText('Type of labor or materials')).toBeNull()
  })
})

describe('LienDesk · the cover page in the pane (v2.3540)', () => {
  it('shows counsel’s cover letter as page 1 while it is ticked, and only the notice when it is not', () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    const cover = document.querySelector('[data-lien-desk-cover]') as HTMLElement
    expect(cover).toBeTruthy()
    expect(cover.textContent).toContain('Re: 650 · AXO Schertz')
    // Counsel's letter everywhere (v2.3828): page 1 is counsel's letter for the property's kind, not the old routine note.
    expect(cover.textContent).toContain('This page is a cover letter.')
    expect(cover.textContent).not.toContain('routine notice')
    expect(screen.getByText('Page 1 of 2 · cover letter')).toBeTruthy()
    expect(document.body.textContent).toContain('Page 2 of 2 · the notice')
    fireEvent.click(screen.getByLabelText(/Counsel's cover letter/))
    expect(document.querySelector('[data-lien-desk-cover]')).toBeNull()
    expect(document.body.textContent).toContain('Page 1 of 1 · the notice')
    expect(document.querySelector('[data-lien-desk-paper]')).toBeTruthy()
  })
})

describe('LienDesk retainage (v2.3753)', () => {
  const retRow = (partial: Partial<LienRetainageRow> = {}): LienRetainageRow => ({ job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null, ...partial })

  it('switches to the retainage kind, lists the job with its clock, shows the gates, the trap warning and the two forms, and sends for approval', async () => {
    const d = data([], [], true)
    d.retainageRows = [retRow()]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="retainage" />)
    await settle()
    expect(screen.getByRole('tab', { name: /Retainage notices · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'To send for Master approval · 1' })).toBeTruthy()
    const list = document.querySelector('[data-lien-retainage-list]') as HTMLElement
    expect(list.textContent).toContain('complete Sep 3')
    expect(list.textContent).toContain('not yet in a § 53.056 claim')
    // The gate box's caption is the pane's grey head since v2.7320, its fact the verdict, the retainage and the contract's end.
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe('Before it can go✓ all four clear · $1,760 · complete Sep 3')
    expect(document.querySelector('[data-lien-retainage-window]')?.textContent).toBe('§ 53.057 · 30 days from the day our contract on the job ended · complete Sep 3')
    expect((document.querySelector('[data-lien-retainage-in-claim]') as HTMLElement).getAttribute('data-lien-retainage-in-claim')).toBe('no')
    expect(screen.getAllByText(/§ 53\.081\(c\)/).length).toBeGreaterThan(0)
    const paper = (document.querySelector('[data-lien-retainage-pane]') as HTMLElement).textContent ?? ''
    expect(paper).toContain('Notice of Claim for Unpaid Retainage')
    expect(paper).toContain('Total retainage unpaid:')
    expect(paper).toContain('$1,760.00')
    expect(paper).toContain('Tex. Prop. Code § 53.057')
    fireEvent.click(screen.getAllByRole('button', { name: 'Change ›' })[0]!)
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
    expect(((await screen.findByRole('button', { name: /to approve ▸/ })) as HTMLButtonElement).disabled).toBe(false)
  })

  it('one press per retainage footer (v2.7324): the ask alone, the menu holds his word and runs the word row', async () => {
    const d = data([], [], true)
    d.retainageRows = [retRow()]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" leaderNameFor={() => 'Malachi Whites'} data={d} initialKind="retainage" />)
    await settle()
    expect(screen.queryByRole('button', { name: /said to send it/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ask Malachi to approve ▸' }).getAttribute('title')).toBe('One line on Malachi’s phone.')
    fireEvent.click(screen.getByRole('button', { name: 'He already okayed it ▾' }))
    const rows = screen.getAllByRole('menuitem')
    expect(rows.map((r) => r.querySelector('strong')?.textContent)).toEqual(['Malachi said to send it…'])
    fireEvent.click(rows[0]!)
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
  })

  it('a job whose contract is still open sits in Clock not started with the door to set the day', async () => {
    const d = data([], [], true)
    d.retainageRows = [retRow({ contract_ended_on: null, contract_ended_how: null, deadline: null })]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="retainage" />)
    await settle()
    expect(screen.getByRole('button', { name: 'Clock not started · 1' })).toBeTruthy()
    expect(screen.getByText(/§ 53\.057 · clock not started/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Set the day our contract ended/ }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })

  it('retainage nobody recorded is a To do row and a count on the Board, and its press opens the list at that job (fix A, PR 2)', async () => {
    const d = data([], [], true)
    d.retainageUnrecorded = [
      { jobId: 'j-held', label: 'C2041', name: 'Cedar Hollow Clinic', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: { held: 2460, percent: 10, billCount: 3, billIds: ['a', 'b', 'c'] }, noteDay: null },
      { jobId: 'j-note', label: 'C2077', name: 'Pecan Row Offices', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: null, noteDay: '2026-09-21' },
    ]
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    expect(document.querySelector('[data-lien-board-retainage]')?.textContent).toBe('Retainage · 2 look held, not on the job')
    const row = document.querySelector('[data-lien-next-up-row="retainage-unrecorded:j-held"]') as HTMLElement
    expect(row.textContent).toContain('C2041 · Cedar Hollow Clinic')
    expect(row.textContent).toContain('Retainage not on the job · $2,460.00 looks held · 3 bills paid at 90%')
    expect(document.querySelector('[data-lien-next-up-row="retainage-unrecorded:j-note"]')?.textContent).toContain('Retainage not on the job · a note of Sep 21 says retainage · no figure yet')
    fireEvent.click(within(row).getByRole('button', { name: 'Record the retainage' }))
    await settle()
    // The Retainage list, whole, with the job's row ringed above the piles; the tab counts both jobs.
    const list = document.querySelector('[data-lien-retainage-list]') as HTMLElement
    expect(within(list).getByTestId('lien-retainage-unrecorded').textContent).toContain('Looks held · not on the job · 2')
    expect(within(list).getAllByTestId('lien-retainage-unrecorded-row').map((n) => [n.getAttribute('data-job-id'), n.getAttribute('data-focused')])).toEqual([
      ['j-held', 'yes'],
      ['j-note', 'no'],
    ])
    expect(screen.getByRole('tab', { name: 'Retainage notices · 2' })).toBeTruthy()
  })

  it('the notice pane names the retainage inside the claim once the job records it, and offers the door when it does not', () => {
    const withRetainage = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    withRetainage.jobsById.j650!.lien_retainage_held = 1_760
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRetainage} />)
    expect((document.querySelector('[data-lien-claim-retainage]') as HTMLElement).getAttribute('data-lien-claim-retainage')).toBe('yes')
    expect(screen.getByText(/Of which, unpaid retainage:/)).toBeTruthy()
    cleanup()
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} onOpenEditJob={onOpenEditJob} />)
    expect((document.querySelector('[data-lien-claim-retainage]') as HTMLElement).getAttribute('data-lien-claim-retainage')).toBe('unset')
    fireEvent.click(screen.getByRole('button', { name: 'Set on the job ›' }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })
})

describe('LienDesk footer hand-off (v2.3753)', () => {
  const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
  const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }

  for (const kind of ['affidavit', 'retainage'] as const) {
    it(`the ${kind} pane's footer reaches the strip without re-rendering the desk in a loop`, async () => {
      const d = data([], [], true)
      d.affidavitRows = [affRow]
      d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
      d.retainageRows = [retRow]
      d.retainage = buildLienRetainageQueue([retRow], [], TODAY)
      // The old hand-off set desk state from the pane's render on a microtask, once per paint, forever (about 300 in 300ms).
      const orig = globalThis.queueMicrotask
      let n = 0
      globalThis.queueMicrotask = (cb) => {
        n += 1
        orig(cb)
      }
      try {
        renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind={kind} />)
        await new Promise((r) => setTimeout(r, 250))
      } finally {
        globalThis.queueMicrotask = orig
      }
      expect(n).toBeLessThan(40)
      const strip = document.querySelector(`[data-lien-desk-footer="${kind}"]`) as HTMLElement
      expect(strip.textContent).toContain(kind === 'affidavit' ? 'Blocked until every gate above is clear' : 'One line on the leader’s phone')
    })
  }
})

describe('LienDesk · the footer is the pane’s own bottom bar (the owner’s ask of 2026-11-15)', () => {
  const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
  const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }
  const withPaper = () => {
    const d = data(J650, [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.retainageRows = [retRow]
    d.retainage = buildLienRetainageQueue([retRow], [], TODAY)
    return d
  }

  it('on a computer the notice footer is the pane’s last section, under the one blue head (v2.7422, Taunya’s ask of 2026-11-15)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPaper()} initialKind="notice" initialJobId="j650" />)
    await waitFor(() => expect(document.querySelector('[data-lien-desk-footer="notice"]')).not.toBeNull())
    const strip = document.querySelector<HTMLElement>('[data-lien-desk-footer="notice"]')!
    const pane = document.querySelector<HTMLElement>('[data-lien-desk-pane]')!
    // The footer scrolls with the paper: it is in the pane, in the section the blue head names.
    expect(pane.contains(strip)).toBe(true)
    const body = strip.closest<HTMLElement>('[data-lien-pane-body="sign"]')!
    expect(body).not.toBeNull()
    expect(body.parentElement).toBe(pane)
    const head = pane.querySelector<HTMLElement>('[data-lien-pane-head="sign"]')!
    expect(head.getAttribute('data-tone')).toBe('blue')
    expect(head.nextElementSibling).toBe(body)
    expect(head.textContent).toBe('Sign and sendNot signed yet')
    // It is the last head, after every page, and the only blue one.
    const heads = [...pane.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
    expect(heads[heads.length - 1]).toBe(head)
    expect(pane.querySelectorAll('[data-lien-pane-head][data-tone="blue"]').length).toBe(1)
    const labels = [...pane.querySelectorAll<HTMLElement>('[data-lien-desk-page-label]')]
    expect(labels.length).toBeGreaterThan(0)
    for (const l of labels) expect(l.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Nothing is pinned under the pane, and the list still has nothing below it.
    const column = pane.closest<HTMLElement>('[data-lien-desk-pane-column]')!
    expect(column.lastElementChild).toBe(pane)
    expect(column.parentElement!.parentElement!.querySelector(':scope > [data-lien-desk-footer]')).toBeNull()
    expect(document.querySelector('[data-lien-desk-foot-fold]')).toBeNull()
  })

  for (const kind of ['affidavit', 'retainage'] as const) {
    it(`on a computer the ${kind} footer sits inside the pane column, not under the list, and the list has nothing below it`, async () => {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPaper()} initialKind={kind} initialJobId="j650" />)
      await waitFor(() => expect(document.querySelector(`[data-lien-desk-footer="${kind}"]`)).not.toBeNull())
      const strip = document.querySelector<HTMLElement>(`[data-lien-desk-footer="${kind}"]`)!
      const column = strip.closest<HTMLElement>('[data-lien-desk-pane-column]')!
      expect(column).not.toBeNull()
      expect(column.style.gridTemplateRows).toBe('minmax(0, 1fr) auto')
      // The pane scrolls above the footer, the footer is the column's last child.
      expect(column.lastElementChild).toBe(strip)
      expect(column.contains(document.querySelector('[data-lien-desk-find-column]'))).toBe(false)
      expect(strip.closest('[data-lien-desk-find-column]')).toBeNull()
      // The list column and the pane column are the grid's two children: nothing spans under both.
      const grid = column.parentElement!
      expect(grid.querySelector('[data-lien-desk-find-column]')).not.toBeNull()
      expect(grid.parentElement!.querySelector(':scope > [data-lien-desk-footer]')).toBeNull()
      expect(document.querySelector('[data-lien-desk-foot-fold]')).toBeNull()
    })
  }

  it('a phone keeps the strip as the desk’s, right after the fold bar, with no column around the pane', async () => {
    const phone = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    const orig = window.matchMedia
    window.matchMedia = phone
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withPaper()} initialKind="affidavit" initialJobId="j650" />)
      await waitFor(() => expect(document.querySelector('[data-lien-desk-foot-fold]')).not.toBeNull())
      const fold = document.querySelector<HTMLElement>('[data-lien-desk-foot-fold]')!
      expect(fold.nextElementSibling?.getAttribute('data-lien-desk-footer')).toBe('affidavit')
      expect(document.querySelector('[data-lien-desk-pane-column]')).toBeNull()
    } finally {
      window.matchMedia = orig
    }
  })
})

describe('LienDesk · the pay page in the pane (punch list #35, PR 3)', () => {
  it('is page 3 of 3 under the notice when the job has unpaid bills, with the count and the total, and the count moves with the cover note', async () => {
    payPageState.rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
    payPageState.assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
      await settle()
      expect(screen.getByText('Page 1 of 3 · cover letter')).toBeTruthy()
      const labels = () => [...document.querySelectorAll('[data-lien-desk-page-label]')].map((n) => n.textContent ?? '')
      expect(labels().find((t) => t.includes('the notice'))).toContain('Page 2 of 3 · the notice · the pay codes and the invoice follow it in the packet')
      expect(labels().find((t) => t.includes('· pay codes'))).toContain('Page 3 of 3 · pay codes · 1 bill · $33,500.00 still owed')
      const pay = document.querySelector('[data-lien-desk-pay]') as HTMLElement
      expect(pay.textContent).toContain('Once these bills are paid, there will be no lien filed.')
      expect(pay.textContent).toContain('only if Lowbeck Contracting has told you in writing')
      expect(pay.querySelector('svg[data-code]')).toBeTruthy()
      fireEvent.click(screen.getByLabelText(/Counsel's cover letter/))
      expect(labels().find((t) => t.includes('· pay codes'))).toContain('Page 2 of 2 · pay codes')
    } finally {
      payPageState.rows = []
      payPageState.assets = {}
    }
  })
})

describe('LienDesk · the pay page lines are typed in place (v2.4724)', () => {
  it('a shaded line opens a box; Enter keeps it on this page only, the label counts it, and Back puts the bill’s line back', async () => {
    payPageState.rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
    payPageState.assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
      await settle()
      const pay = () => document.querySelector('[data-lien-desk-pay]') as HTMLElement
      const label = () => (document.querySelector('[data-lien-desk-pay-label]') as HTMLElement).textContent ?? ''
      expect(label()).toContain('a shaded line is yours to change, on this page only')
      fireEvent.click(pay().querySelector('[data-field="payLine:inv-1"]')!)
      const box = screen.getByLabelText("The line under this bill's code") as HTMLInputElement
      expect(box.value).toBe('Rough-in.')
      fireEvent.change(box, { target: { value: 'Plumbing rough-in at 650 Schertz Pkwy' } })
      fireEvent.keyDown(box, { key: 'Enter' })
      expect(pay().textContent).toContain('Plumbing rough-in at 650 Schertz Pkwy')
      expect(pay().textContent).toContain('changed on this page only · the bill keeps its own line')
      expect(label()).toContain('1 line changed on this page, the bills keep their own')
      fireEvent.click(pay().querySelector('[data-reset="payLine:inv-1"]')!)
      expect(pay().textContent).toContain('Rough-in.')
      expect(label()).not.toContain('changed')
    } finally {
      payPageState.rows = []
      payPageState.assets = {}
    }
  })
})

describe('LienDesk · the pen door on the draft (v2.7297)', () => {
  it('the office’s draft footer offers He signed the paper…; the press saves the draft, the pane records his pen signature, and the record approves the notice on his word in person', async () => {
    penMock.mockClear()
    wordMock.mockClear()
    saveDraftMock.mockClear()
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    d.jobsById.j650 = { ...d.jobsById.j650!, master_user_id: 'u-malachi' } as NonNullable<typeof d.jobsById.j650>
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={d} />)
    await settle()
    // v2.7324: the pen door is a row of He already okayed it ▾.
    expect(document.querySelector('[data-lien-desk-pen]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'He already okayed it ▾' }))
    const door = document.querySelector('[data-lien-foot-menu-row="pen"]') as HTMLButtonElement | null
    expect(door?.querySelector('strong')?.textContent).toBe('He signed the paper…')
    fireEvent.click(door!)
    const pane = await screen.findByTestId('lien-pen-pane')
    expect(saveDraftMock).toHaveBeenCalledTimes(1)
    expect(pane.textContent).toContain('Malachi Whites')
    // The draft's door is the by-hand door's neighbour, not a second signing line: the word row stays closed.
    expect(screen.queryByRole('button', { name: /Approve on his word/ })).toBeNull()
    fireEvent.click(screen.getByTestId('lien-pen-record'))
    await waitFor(() => expect(wordMock).toHaveBeenCalledTimes(1))
    expect(penMock.mock.calls[0]?.[0]).toMatchObject({ itemId: 'it-new', how: 'watched' })
    const [itemId, word] = wordMock.mock.calls[0] as unknown as [string, { note: string; channel: string }]
    expect(itemId).toBe('it-new')
    expect(word.channel).toBe('in_person')
    expect(word.note).toMatch(/^He signed the printed paper with a pen .+\. Written down by Robert, who watched him sign\.$/)
    expect(screen.queryByTestId('lien-pen-pane')).toBeNull()
  })

  it('a leader’s own draft footer has no pen door and no okayed menu: Sign and approve ▸ places his typed name', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-pen]')).toBeNull()
    expect(document.querySelector('[data-lien-foot-menu="okayed"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign and approve ▸' })).toBeTruthy()
  })
})

describe('LienDesk · one press per draft footer (v2.7324)', () => {
  const ownerOn = () => data(J650.map((r) => ({ ...r, has_owner: true })), [], true)

  it('the leader on his own notice: no signing box, the line says his typed name goes on it; Sign another way ▾ → Draw it draws the pad, and Type my name takes it away again', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-malachi" authName="Malachi" leaderNameFor={() => 'Malachi Whites'} data={ownerOn()} />)
    await settle()
    expect(screen.queryByTestId('lien-sign-line')).toBeNull()
    const next = document.querySelector('[data-lien-desk-next]') as HTMLElement
    expect(next.textContent).toContain('Your typed name goes on it. It then waits to print')
    expect(screen.getByRole('button', { name: 'Sign and approve ▸' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign another way ▾' }))
    const menu = screen.getByRole('menu', { name: 'Sign another way. Pick how.' })
    expect(within(menu).getAllByRole('menuitem').map((r) => r.querySelector('strong')?.textContent)).toEqual(['Draw it'])
    // Escape closes the menu and nothing changes.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByTestId('lien-sign-line')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign another way ▾' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Draw it/ }))
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    // The line's own toggle is off: the menu is the way between the ways.
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Your signature on the line goes on it. It then waits to print')
    // v2.7386: with the pad, the line's box holds the footer. The press sits beside the paper and the menu in the box's strip.
    const draftBox = screen.getByTestId('lien-sign-line')
    expect(draftBox.hasAttribute('data-lien-sign-frame')).toBe(true)
    expect(draftBox.contains(document.querySelector('[data-lien-desk-approve]'))).toBe(true)
    expect((draftBox.querySelector('.lienSignFrameStrip') as HTMLElement).contains(screen.getByRole('button', { name: 'Sign another way ▾' }))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Sign another way ▾' }))
    expect(screen.getAllByRole('menuitem').map((r) => r.querySelector('strong')?.textContent)).toEqual(['Type my name'])
    fireEvent.click(screen.getByRole('menuitem', { name: /Type my name/ }))
    expect(screen.queryByTestId('lien-sign-line')).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Your typed name goes on it. It then waits to print')
  })

  it('the office’s notice footer: no Save draft (v2.7327), Already mailed? a quiet link, the one press asks the leader, and the menu closes on a press outside', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" leaderNameFor={() => 'Malachi Whites'} data={ownerOn()} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-save-draft]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(document.querySelector('[data-lien-desk-by-hand]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ask Malachi to approve ▸' }).getAttribute('title')).toBe('One line on Malachi’s phone.')
    expect(screen.queryByRole('button', { name: /Sign another way/ })).toBeNull()
    const press = screen.getByRole('button', { name: 'He already okayed it ▾' })
    fireEvent.click(press)
    expect(press.getAttribute('aria-expanded')).toBe('true')
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(press.getAttribute('aria-expanded')).toBe('false')
  })

  it('the dev is both: Sign and approve ▸ with both menus beside it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" leaderNameFor={() => 'Malachi Whites'} data={ownerOn()} />)
    await settle()
    expect(screen.getByRole('button', { name: 'Sign and approve ▸' })).toBeTruthy()
    expect(Array.from(document.querySelectorAll('[data-lien-foot-menu]')).map((m) => m.getAttribute('data-lien-foot-menu'))).toEqual(['okayed', 'sign'])
  })
})

describe('LienDesk · the draft saves itself (v2.7327)', () => {
  const ownerOn = () => data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
  afterEach(() => vi.useRealTimers())

  it('never on open: the pane sits for two seconds and writes no row', async () => {
    saveDraftMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={ownerOn()} />)
    await settle()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()
    expect(saveDraftMock).not.toHaveBeenCalled()
    expect(document.querySelector('[data-lien-desk-save-draft]')).toBeNull()
  })

  it('a month ticked and the cover box set within 800 ms are one save; Saved shows beside the state line, and the desk re-reads', async () => {
    saveDraftMock.mockClear()
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={ownerOn()} onChanged={onChanged} />)
    await settle()
    onChanged.mockClear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const boxes = screen.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)
    fireEvent.click(boxes[0]!)
    vi.advanceTimersByTime(500)
    fireEvent.click(screen.getByLabelText(/Counsel's cover letter/))
    vi.advanceTimersByTime(700)
    expect(saveDraftMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    vi.useRealTimers()
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1))
    const input = (saveDraftMock.mock.calls[0] as unknown as [{ itemId: string | null; months: string[]; coverNote: boolean }])[0]
    expect(input.itemId).toBeNull()
    expect(input.months).toHaveLength(2)
    expect(input.coverNote).toBe(false)
    await waitFor(() => expect(document.querySelector('[data-lien-desk-saved="saved"]')?.textContent).toContain('Saved'))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a press inside the wait saves first and once: Ask the leader after a tick writes one row and sends it', async () => {
    saveDraftMock.mockClear()
    submitMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={ownerOn()} />)
    await settle()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const boxes = screen.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)
    fireEvent.click(boxes[0]!)
    vi.advanceTimersByTime(300)
    fireEvent.click(screen.getByRole('button', { name: /to approve ▸/ }))
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(saveDraftMock).toHaveBeenCalledTimes(1)
  })
})

describe('LienDesk · a notice that already went out (#35 PR 2)', () => {
  it('the draft footer offers "Already mailed? Record it…" and opens the by-hand pane prefilled with the desk’s months', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    const door = document.querySelector('[data-lien-desk-by-hand]') as HTMLButtonElement | null
    expect(door).toBeTruthy()
    fireEvent.click(door!)
    const pane = await screen.findByTestId('lien-notice-by-hand')
    expect(pane.textContent).toContain('Record a notice that already went out')
    expect((screen.getByLabelText('Months as printed') as HTMLInputElement).value).not.toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByTestId('lien-notice-by-hand')).toBeNull()
  })

  it('on a phone the by-hand step is a sheet over the desk’s card (v2.4446): the same fields, Back to the notice, × closes the sheet (punch list #182 PR 3: there is no window to close)', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" initialJobId="j650" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
      const door = document.querySelector('[data-lien-desk-by-hand]') as HTMLButtonElement | null
      expect(door).toBeTruthy()
      fireEvent.click(door!)
      await screen.findByTestId('lien-notice-by-hand')
      const sheet = document.querySelector('[data-lien-record-sheet="notice_by_hand"]') as HTMLElement
      expect(sheet).toBeTruthy()
      // the sheet is positioned against the desk's card, not the backdrop that pads for the status bar
      const card = sheet.closest('[data-lien-desk-panel]') as HTMLElement
      expect(card.style.position).toBe('relative')
      expect((screen.getByLabelText('Months as printed') as HTMLInputElement).style.fontSize).toBe('1rem')
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(document.querySelector('[data-lien-record-sheet]')).toBeNull()
      // × on the sheet closes the sheet alone: the desk is a page now, and stays.
      fireEvent.click(document.querySelector('[data-lien-desk-by-hand]') as HTMLButtonElement)
      await screen.findByTestId('lien-notice-by-hand')
      fireEvent.click((document.querySelector('[data-lien-record-sheet="notice_by_hand"]') as HTMLElement).querySelector('[aria-label="Close"]')!)
      expect(document.querySelector('[data-lien-record-sheet]')).toBeNull()
      expect(screen.getByRole('region', { name: 'Lien desk' })).toBeTruthy()
    } finally {
      window.matchMedia = before
    }
  })
})

describe('LienDesk the attorney’s letter (v2.3760)', () => {
  const sentPacket = {
    id: 'sent1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T14:00:00Z', sent_at: '2026-09-02T15:00:00Z',
    fields: { notice: { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }, gcEmail: 'office@lowbeck.test' },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_at: '2026-09-02T14:30:00Z', approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: 'f1', pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-02T15:00:00Z', voided_at: null,
  } as unknown as LienDeskItemRow

  function sentDesk() {
    // Every month noticed, the packet 12 days old, the balance still open.
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    return d
  }

  it('a sent job with a new month due sits in To send, its row saying when the notice went, its footer carrying the attorney’s letter door beside Send for approval (v2.6624, punch list #248)', async () => {
    // June and July noticed by the Sep 2 packet; August's window is still open, so the next notice drafts while letter two's clock runs.
    const d = data([row('j650', '2026-06', '2026-09-15', { has_owner: true, noticed: true }), row('j650', '2026-07', '2026-10-15', { has_owner: true, noticed: true }), row('j650', '2026-08', '2026-11-16', { has_owner: true })], [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    expect(screen.getByRole('button', { name: /To send/ }).textContent).toContain('1')
    expect(document.querySelector('[data-lien-pile-rows="sent"]')).toBeNull()
    const row650 = document.querySelector('[data-lien-pile-rows="to_draft"]') as HTMLElement
    expect((row650.querySelector('[data-lien-desk-sent-words]') as HTMLElement).textContent).toBe('· sent Sep 2')
    expect((row650.querySelector('[data-lien-letter-two]') as HTMLElement).textContent).toBe('day 12 · the attorney’s letter')
    const doors = document.querySelector('[data-lien-desk-sent-doors]') as HTMLElement
    expect(doors.textContent).toContain('Sent')
    expect(doors.textContent).toContain('day 12 · the attorney’s letter')
    expect(doors.querySelector('[data-lien-letter-two-door]')).toBeTruthy()
    expect((screen.getByRole('button', { name: /to approve ▸/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(document.querySelector('[data-lien-since-sent]')).toBeNull()
  })

  it('GC paid reads the sent bills, not the job’s price less payments (v2.7530): bills paid in full on a job with work not yet billed', () => {
    // The job's price is above its payments, but every sent bill is paid: the desk's row owes $0.
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true, open_balance: 0 })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 0, TODAY, formatYmdMonthDay)
    expect(Number(d.jobsById.j650!.revenue ?? 0) - Number(d.jobsById.j650!.payments_made ?? 0)).toBeGreaterThan(0)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    const since = document.querySelector('[data-lien-since-sent]') as HTMLElement
    expect(since.textContent).toContain('GC paid: yes')
  })

  it('the sent row and footer count the days, and Send the attorney’s letter drafts counsel’s paid-out letter on the job', async () => {
    startTwoMock.mockReset()
    startTwoMock.mockResolvedValue('two1')
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={sentDesk()} onChanged={onChanged} />)
    expect((document.querySelector('[data-lien-letter-two]') as HTMLElement).textContent).toBe('day 12 · the attorney’s letter')
    const since = document.querySelector('[data-lien-since-sent]') as HTMLElement
    expect(since.textContent).toContain('Day 12')
    expect(since.textContent).toContain('GC paid: no')
    expect(since.textContent).toContain('GC authorized direct pay: no')
    fireEvent.click(screen.getByRole('button', { name: 'Send the attorney’s letter ▸' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /We believe the owner paid the GC out/ }))
    await waitFor(() => expect(startTwoMock).toHaveBeenCalled())
    const input = startTwoMock.mock.calls[0]![0] as { first: { id: string }; fields: { letterTwo?: { kind: string; afterItemId: string }; coverLetter?: string; notice: { claimAmount: string } } }
    expect(input.first.id).toBe('sent1')
    expect(input.fields.letterTwo).toMatchObject({ kind: 'paid_out', afterItemId: 'sent1' })
    expect(input.fields.coverLetter).toContain('reason to believe you may already have paid Lowbeck Contracting in full')
    expect(input.fields.notice.claimAmount).toBe('33500.00')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a sent notice with nothing due folds its gates to one line with no verdict, and its head reads the day it went (v2.6625, punch list #248)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={sentDesk()} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-gates]')).toBeNull()
    const fold = document.querySelector('[data-lien-gates-sent]') as HTMLElement
    expect((fold.querySelector('[data-lien-gates-sent-line]') as HTMLElement).textContent).toBe('Sent Sep 2 · Elwick Holdings LLC · Lowbeck Contracting · Commercial · Guadalupe · Jun + Jul')
    expect(fold.textContent).not.toContain('go out')
    expect((document.querySelector('[data-lien-pane-head="gates"] [data-lien-pane-head-fact]') as HTMLElement).textContent).toContain('Sent Sep 2')
    fireEvent.click(fold.querySelector('[data-lien-gates-sent-fold="open"]') as HTMLElement)
    expect(fold.querySelectorAll('[data-lien-gates-sent-row]')).toHaveLength(4)
  })

  it('the GC’s written okay is recorded on the first packet and turns the attorney’s letter off', async () => {
    gcOkayMock.mockReset()
    gcOkayMock.mockResolvedValue(undefined)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={sentDesk()} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'The GC authorized direct pay…' }))
    fireEvent.change(screen.getByLabelText("The GC's okay — where and when"), { target: { value: 'email from Lowbeck, Sep 12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record it ▸' }))
    await waitFor(() => expect(gcOkayMock).toHaveBeenCalled())
    expect(gcOkayMock.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(gcOkayMock.mock.calls[0]![1]).toEqual({ name: 'Taunya', note: 'email from Lowbeck, Sep 12' })
  })

  it('a letter-two draft wears its mark in the list and on the pane heading', () => {
    const twoDraft = { ...sentPacket, id: 'two1', status: 'drafted', sent_at: null, sent_filing_id: null, approval_mode: null, created_at: '2026-09-14T09:00:00Z', fields: { ...(sentPacket.fields as object), letterTwo: { kind: 'unresponsive', afterItemId: 'sent1', afterSentAt: '2026-09-02T15:00:00Z' } } } as unknown as LienDeskItemRow
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket, twoDraft], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    expect((document.querySelector('[data-lien-letter-two="draft"]') as HTMLElement).textContent).toBe('the attorney’s letter · unresponsive')
    expect((document.querySelector('[data-lien-letter-two-heading]') as HTMLElement).textContent).toContain('the attorney’s letter · unresponsive · after the Sep 2 packet')
  })

  it('a courtesy send whose record did not take closes the window, names it on the footer in place of Send, and Write the record again writes the record alone (punch list #249, row 1)', async () => {
    const record: CourtesyRecord = { at: '2026-09-14T15:00:00Z', by: 'Taunya', lienDay: '2026-11-16', claim: 33_500, to: [{ who: 'original_contractor', name: 'Lowbeck Contracting', channel: 'email', address: 'office@lowbeck.test', ok: true, id: 're_1', reason: '' }] }
    courtesyIo.send.mockReset()
    courtesyIo.write.mockReset()
    courtesyIo.send.mockResolvedValue({ record, to: record.to, recordError: 'the row was changed by someone else' })
    courtesyIo.write.mockResolvedValue(undefined)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={sentDesk()} />)
    await settle()
    const door = document.querySelector('[data-lien-courtesy-door]') as HTMLButtonElement | null
    expect(door, 'the courtesy door on the sent footer').not.toBeNull()
    fireEvent.click(door!)
    await waitFor(() => expect((document.querySelector('[data-lien-courtesy-send]') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(document.querySelector('[data-lien-courtesy-send]') as HTMLButtonElement)
    await waitFor(() => expect(courtesyIo.send).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-lien-courtesy-window]')).toBeNull())
    const band = document.querySelector('[data-lien-courtesy-unrecorded]') as HTMLElement
    expect(band.textContent).toContain('1 message went: email to the GC. The record could not be written: the row was changed by someone else. Write the record again. Nothing goes out a second time.')
    expect(document.querySelector('[data-lien-courtesy-door]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Write the record again ›' }))
    await waitFor(() => expect(courtesyIo.write).toHaveBeenCalledTimes(1))
    expect(courtesyIo.write.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(courtesyIo.write.mock.calls[0]![1]).toEqual(record)
    expect(courtesyIo.send).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelector('[data-lien-courtesy-unrecorded]')).toBeNull())
  })

  it('a reply in Messages after the courtesy closes it on the footer, with the day they answered (punch list #249, row 3)', async () => {
    const d = sentDesk()
    const courtesy = [{ at: '2026-09-10T15:00:00.000Z', by: 'Taunya', lienDay: '2026-11-16', claim: 33_500, to: [{ who: 'original_contractor', name: 'Lowbeck Contracting', channel: 'email', address: 'office@lowbeck.test', ok: true, id: 're_1', reason: '' }] }]
    d.items = [{ ...sentPacket, fields: { ...(sentPacket.fields as object), courtesy } } as unknown as LienDeskItemRow]
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    // The desk's read: the GC's line of Sep 13 on a thread the office never texted from.
    d.courtesyRepliedAtByJob = { j650: '2026-09-13T16:20:00.000Z' }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    const state = document.querySelector('[data-lien-courtesy-state]') as HTMLElement
    expect(state.getAttribute('data-lien-courtesy-state')).toBe('closed')
    expect(state.textContent).toContain('they answered Sep 13')
    // Closed: no courtesy door, and the attorney's letter is not amber either.
    expect(document.querySelector('[data-lien-courtesy-door]')).toBeNull()
  })

  it('paying it down (PR 3 of #274): a payment after the packet reads on the footer, the attorney’s letter door goes plain, and Record what they promised writes the job’s promise and the notice’s record', async () => {
    promiseMock.mockReset()
    promiseMock.mockResolvedValue(undefined)
    jobPromiseMock.mockReset()
    jobPromiseMock.mockResolvedValue(undefined)
    const d = sentDesk()
    d.jobsById = { ...d.jobsById, j650: { ...d.jobsById.j650!, payments_made: 4000 } }
    d.paymentsByJob = { j650: [{ amount: 4000, paidOn: '2026-09-10' }] }
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 29_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    const state = document.querySelector('[data-lien-courtesy-state]') as HTMLElement
    expect(state.getAttribute('data-lien-courtesy-state')).toBe('paying')
    expect(state.textContent).toContain('paying it down · $4,000 paid Sep 10 · $29,500 still owed')
    expect((document.querySelector('[data-lien-letter-two-door]') as HTMLElement).getAttribute('data-letter-waits')).toBe('paying')
    expect(document.querySelector('[data-lien-courtesy-door]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Record what they promised…' }))
    fireEvent.change(screen.getByLabelText('The day they promised'), { target: { value: '2026-09-25' } })
    fireEvent.change(screen.getByLabelText('The amount they promised'), { target: { value: '29,500' } })
    fireEvent.change(screen.getByLabelText('Their words'), { target: { value: 'Dana said the check goes out the 24th' } })
    expect((document.querySelector('[data-lien-promise-form]') as HTMLElement).textContent).toContain('The desk asks again Sep 25.')
    fireEvent.click(screen.getByRole('button', { name: 'Record it ▸' }))
    await waitFor(() => expect(promiseMock).toHaveBeenCalled())
    expect(jobPromiseMock.mock.calls[0]![0]).toMatchObject({ jobId: 'j650', ymd: '2026-09-25', note: 'Dana said the check goes out the 24th' })
    expect(promiseMock.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(promiseMock.mock.calls[0]![1]).toMatchObject({ by: 'Taunya', ymd: '2026-09-25', amount: 29_500, note: 'Dana said the check goes out the 24th' })
  })
})

describe('LienDesk the owner’s call and the piles (v2.3767)', () => {
  const sentPacket = {
    id: 'sent1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T14:00:00Z', sent_at: '2026-09-02T15:00:00Z',
    fields: { notice: { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }, gcEmail: '' },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_at: '2026-09-02T14:30:00Z', approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: 'f1', pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-02T15:00:00Z', voided_at: null,
  } as unknown as LienDeskItemRow
  const answered = { ...sentPacket, fields: { ...(sentPacket.fields as object), ownerCall: { at: '2026-09-10T15:00:00Z', name: 'Taunya', owesGc: 'no', owesAmount: null, reserved: 'never', originalContractCompletedOn: '2026-08-20', note: 'paid Lowbeck in full' } } } as unknown as LienDeskItemRow

  it('the sent footer records the owner’s call — the three questions — on the first packet, and reads back the pile', async () => {
    ownerCallMock.mockReset()
    ownerCallMock.mockResolvedValue(undefined)
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    expect((document.querySelector('[data-lien-owner-called]') as HTMLElement).textContent).toContain('Owner called: not yet')
    fireEvent.click(screen.getByRole('button', { name: 'Record the owner’s call…' }))
    const dialog = document.querySelector('[data-lien-owner-call-dialog]') as HTMLElement
    expect(dialog).toBeTruthy()
    // the conversation (v2.3854): the letter they hold, then one card at a time in the owner's words
    expect(dialog.querySelector('[data-lien-owner-call-holding]')!.textContent).toContain('is holding the commercial § 53.056 notice mailed')
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('open')
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="opening:sued"]') as HTMLElement)
    expect(dialog.querySelector('[data-lien-owner-call-say]')!.textContent).toContain('this isn’t a lawsuit')
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="still_owe"]') as HTMLElement) // opens the amount
    fireEvent.change(within(dialog).getByLabelText('About how much is left'), { target: { value: '14,000' } })
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-next]') as HTMLElement)
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('owes')
    expect(dialog.querySelector('[data-lien-owner-call-say]')!.textContent).toContain('Please don’t send Lowbeck Contracting that money until this is cleared.')
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="ten_held"]') as HTMLElement)
    fireEvent.click(within(dialog).getByLabelText('still going'))
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-next]') as HTMLElement)
    expect(dialog.querySelector('[data-lien-owner-call-pile]')!.getAttribute('data-lien-owner-call-pile')).toBe('A')
    expect(dialog.querySelector('[data-lien-owner-call-sentence]')!.textContent).toContain('still owes Lowbeck Contracting about $14,000. The 10% is still with them. Lowbeck Contracting is still on the job.')
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="wait"]') as HTMLElement)
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('wrap')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the call' }))
    await waitFor(() => expect(ownerCallMock).toHaveBeenCalled())
    expect(ownerCallMock.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(ownerCallMock.mock.calls[0]![1]).toMatchObject({ name: 'Taunya', owesGc: 'yes', owesAmount: 14_000, reserved: 'held', originalContractCompletedOn: null, wantsToPayUs: false, told: ['open', 'sued', 'owes', 'next', 'wrap'] })
  })

  it('☎ An owner is calling opens the words on the selected job, and Record the call opens the sheet on its notice (v2.4731)', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    const script = screen.getByTestId('lien-call-script')
    expect(script.getAttribute('data-has-job')).toBe('yes')
    expect(screen.getByTestId('lien-call-script-sub').textContent).toContain('650 · AXO Schertz · GC Lowbeck Contracting · § 53.056 notice mailed')
    expect(screen.getByTestId('lien-call-script-open').textContent).toContain('you did nothing wrong by paying Lowbeck Contracting')
    // nothing to type: the search that lived here is gone
    expect(screen.queryByLabelText('Find a job on the Lien desk')).toBeNull()
    fireEvent.click(document.querySelector('[data-lien-call-script-opening="sued"]') as HTMLElement)
    expect(screen.getByTestId('lien-call-script-next').textContent).toContain('this isn’t a lawsuit')
    fireEvent.click(screen.getByTestId('lien-call-script-record'))
    const dialog = document.querySelector('[data-lien-owner-call-dialog]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('open')
    expect(dialog.querySelector('[data-lien-owner-call-holding]')!.textContent).toContain('Elwick Holdings LLC is holding')
    expect(screen.queryByTestId('lien-call-script')).toBeNull()
  })

  it('the find box reaches every notice the desk ever sent (v2.4731): a letter not on the piles shows under Also sent and opens the call sheet', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialPile="to_draft" />)
    await settle()
    expect(document.querySelector('[data-lien-also-sent]')).toBeNull()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: 'elwick' } })
    const head = document.querySelector('[data-lien-pile-head="also_sent"]') as HTMLElement
    expect(head.textContent).toContain('Also sent · every notice out')
    const row = document.querySelector('[data-lien-also-sent="j650"]') as HTMLElement
    expect(row.textContent).toContain('Elwick Holdings LLC')
    expect(row.textContent).toContain('Sent ')
    expect(row.textContent).toContain('Open the call ›')
    expect(screen.queryByTestId('lien-desk-find-nothing')).toBeNull()
    fireEvent.click(row)
    const dialog = document.querySelector('[data-lien-owner-call-dialog]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('open')
  })

  it('the practice call is the whole sheet on a made-up letter, with no Save — nothing is written (v2.4249)', async () => {
    ownerCallMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    // The job under the reader has nothing drafted: the words still read with its facts, and nothing can be recorded (v2.4731).
    expect(screen.getByTestId('lien-call-script').getAttribute('data-has-job')).toBe('yes')
    expect(screen.getByTestId('lien-call-script-letter').textContent).toContain('not mailed yet')
    expect(screen.queryByTestId('lien-call-script-record')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-call-script-practice'))
    const dialog = document.querySelector('[data-lien-owner-call-dialog]') as HTMLElement
    expect(dialog.getAttribute('data-lien-owner-call-practice')).toBe('yes')
    expect(dialog.getAttribute('aria-label')).toBe('Practice call · 000 · Practice job')
    expect(dialog.querySelector('strong')!.textContent).toBe('Practice call · 000 · Practice job')
    expect(dialog.querySelector('[data-lien-owner-call-practice-banner]')!.textContent).toContain('Practice call · a made-up letter · nothing is saved')
    expect(dialog.querySelector('[data-lien-owner-call-holding]')!.textContent).toContain('Pat Sample is holding')
    expect(dialog.querySelector('[data-lien-owner-call-holding]')!.textContent).toContain('$4,250.00 for July and August 2026 under Sample Builders')
    expect(dialog.querySelector('[data-lien-owner-call-save]')).toBeNull()
    // the cards work: a reply moves the sheet on, Start over puts it back
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="opening:sued"]') as HTMLElement)
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('sued')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start over ↺' }))
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('open')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done practicing' }))
    expect(document.querySelector('[data-lien-owner-call-dialog]')).toBeNull()
    expect(ownerCallMock).not.toHaveBeenCalled()
  })

  it('the affidavit row and pane read counsel’s pile from the answers, with the bond line and its door', () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-07', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([], [answered], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.ownerCallByJob = ownerCallByJobFrom(d.items)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="affidavit" />)
    expect((document.querySelector('[data-lien-affidavit-pile]') as HTMLElement).textContent).toBe('B · paid, never reserved the 10%')
    const box = document.querySelector('[data-lien-affidavit-owner-answers]') as HTMLElement
    expect(box.getAttribute('data-pile')).toBe('B')
    expect(box.textContent).toContain('owner called Sep 10 · owes the GC nothing · never reserved the 10% · their contract completed Aug 20 · the 10% hold (§ 53.101) ends Sep 21')
    expect(box.textContent).toContain('reserved-funds lien')
    expect((document.querySelector('[data-lien-affidavit-bond]') as HTMLElement).getAttribute('data-lien-affidavit-bond')).toBe('unknown')
    fireEvent.click(screen.getByRole('button', { name: 'Check the project ›' }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })

  it('marks a job where a supply house is owed, draws its card, and copies the paragraph (v2.4404)', async () => {
    supplierState.byJob = buildLienSupplierJobs({
      invoices: [
        { id: 'r1', supply_house_id: 'reece', amount: 1480, is_paid: true, invoice_date: '2026-06-20', paidYmd: '2026-07-09', on_job_account: false },
        { id: 'r2', supply_house_id: 'reece', amount: 9612.4, is_paid: false, invoice_date: '2026-07-18', paidYmd: null, on_job_account: false },
      ],
      allocations: [
        { invoice_id: 'r1', job_id: 'j650', pct: 100 },
        { invoice_id: 'r2', job_id: 'j650', pct: 100 },
      ],
      houses: [{ id: 'reece', name: 'Reece' }],
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    // AXO Schertz on its commercial property record (a kind not set would date the house's July a month earlier, v2.5031).
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [], true)} />)
    await settle()
    const mark = document.querySelector('[data-lien-supplier-mark]')
    expect(mark?.textContent).toContain('1 house owed $9,612')
    const card = document.querySelector<HTMLElement>('[data-lien-suppliers-card="owed"]')!
    expect(card).toBeTruthy()
    expect(within(card).getByText('July materials')).toBeTruthy()
    // July on a commercial clock is due Oct 15; today is Sep 14.
    expect(within(card).getByText('by Oct 15')).toBeTruthy()
    expect(card.querySelector('[data-lien-suppliers-verdict]')?.textContent).toBe('The $33,500.00 Lowbeck Contracting owes us covers what the houses are owed.')
    fireEvent.click(within(card).getByRole('button', { name: 'Copy for an email' }))
    await settle()
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = String(writeText.mock.calls[0]![0])
    expect(text).toContain('Supply houses on 650 · AXO Schertz')
    expect(text).toContain('Reece is owed $9,612.40. Its oldest unpaid materials are from July. We expect its own notice by October 15.')
    expect(within(card).getByRole('link', { name: 'Open in Held for suppliers ›' }).getAttribute('href')).toBe('/materials?tab=job-accounts&job=j650')
    // The owner's letter names the house (v2.4725): the tick starts on, the paragraph is the letter's last, the amber line waits for counsel; unticked, the paragraph leaves.
    const tick = screen.getByLabelText(/Name the supply house owed\s*\$9,612/) as HTMLInputElement
    expect(tick.checked).toBe(true)
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).toContain('You should also know that Reece sold materials for this job and is still owed $9,612.40. We expect Reece’s own notice by October 15. That notice is Reece’s own claim for materials. It is not covered by our release, and it is not included in the $33,500.00. Paying us the $33,500.00 is what lets us clear that account.')
    // The caution sits in its own tick's row (v2.7427), not at the card's foot.
    const housesNote = document.querySelector('[data-lien-desk-houses-counsel]') as HTMLElement
    expect(housesNote.textContent).toBe('Counsel has not read this paragraph yet.')
    expect(housesNote.closest('[data-lien-envelope-tick]')).toBe(tick.closest('[data-lien-envelope-tick="houses"]'))
    expect(document.querySelector('[data-lien-desk-release-counsel]')).toBeNull()
    fireEvent.click(tick)
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).not.toContain('You should also know')
    expect(document.querySelector('[data-lien-desk-houses-counsel]')).toBeNull()
  })

  it('encloses a conditional release on a tick (v2.4729): a draft row from the notice, the paragraph closes the letter, the form is page 2, the enclosure line says it, and unticking voids it', async () => {
    releaseState.byId = new Map([
      [
        'rel-1',
        { id: 'rel-1', formType: 'conditional_progress', amount: 33500, signature: null, fields: { companyName: 'Click Plumbing', checkFrom: 'Lowbeck Contracting', amount: '33500.00', projectDescription: 'AXO Schertz, 1204 Elwick Rd, Schertz, TX', throughDate: '2026-07-31', signedDate: '', signerName: 'Robert Douglas', signerTitle: '' } },
      ],
    ])
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const tick = screen.getByLabelText(/A conditional release\s*\$33,500/) as HTMLInputElement
    expect(tick.checked).toBe(false)
    expect(document.querySelector('[data-lien-desk-release]')).toBeNull()
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).not.toContain('conditional release')
    fireEvent.click(tick)
    await settle()
    expect(createReleaseMock).toHaveBeenCalledTimes(1)
    const input = createReleaseMock.mock.calls[0]![0] as { jobId: string; formType: string; amount: number; invoiceIds: string[]; throughDate: string; fields: { checkFrom: string; companyName: string; amount: string; throughDate: string; signedDate: string } }
    expect(input.jobId).toBe('j650')
    // No bills known to the pane: the Progress form, the one that does not call itself the last payment.
    expect(input.formType).toBe('conditional_progress')
    expect(input.amount).toBe(33500)
    expect(input.invoiceIds).toEqual([])
    expect(input.throughDate).toBe('2026-08-31')
    expect(input.fields).toMatchObject({ checkFrom: 'Lowbeck Contracting', amount: '33500.00', throughDate: '2026-08-31', signedDate: '' })
    expect(tick.checked).toBe(true)
    const cover = document.querySelector('[data-lien-desk-cover]')!
    expect(cover.textContent).toContain('A conditional release of lien is enclosed. This release is not effective today. It becomes effective only after $33,500.00 is received and the funds have cleared. Until then, the notice stands.')
    expect(cover.textContent).toContain(', and a conditional release of lien.')
    expect(screen.getByText('Page 2 of 3 · conditional release', { exact: false })).toBeTruthy()
    expect(screen.getByText('Page 3 of 3 · the notice', { exact: false })).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-release]')?.textContent).toContain('a check from Lowbeck Contracting in the sum of $33,500.00 payable to Click Plumbing')
    const releaseNote = document.querySelector('[data-lien-desk-release-counsel]') as HTMLElement
    expect(releaseNote.textContent).toBe('Counsel has not read this paragraph yet.')
    expect(releaseNote.closest('[data-lien-envelope-tick]')).toBe(tick.closest('[data-lien-envelope-tick="release"]'))
    fireEvent.click(tick)
    await settle()
    expect(voidReleaseMock).toHaveBeenCalledWith('rel-1', expect.anything())
    expect(tick.checked).toBe(false)
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).not.toContain('conditional release')
  })

  it('pins a head per section, like the list’s pile heads (v2.4733): five in order with their facts, the first lit, a press lands on its section, and the cards give up their titles', async () => {
    supplierState.byJob = buildLienSupplierJobs({
      invoices: [{ id: 'r2', supply_house_id: 'reece', amount: 9612.4, is_paid: false, invoice_date: '2026-07-18', paidYmd: null, on_job_account: false }],
      allocations: [{ invoice_id: 'r2', job_id: 'j650', pct: 100 }],
      houses: [{ id: 'reece', name: 'Reece' }],
    })
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const heads = [...document.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
    expect(heads.map((h) => h.getAttribute('data-lien-pane-head'))).toEqual(['path', 'gates', 'houses', 'months', 'envelope', 'sign'])
    expect(heads.map((h) => h.querySelector('.lienPaneHeadLabel')?.textContent)).toEqual(['Where this notice is', 'The four gates', 'Supply houses', 'Months on this job', 'In the envelope', 'Sign and send'])
    expect(heads[1]!.textContent).toContain('✓ Ready to go out · All 4 clear')
    expect(heads[2]!.textContent).toBe('Supply houses1 house owed · $9,612 · from our books · Sep 14')
    expect(heads[3]!.textContent).toBe('Months on this jobJun + Jul + Aug · $33,500')
    expect(heads[4]!.textContent).toBe('In the envelope2 pages · owner + GC · courtesy PDF to the GC')
    // Stacked: passed heads at the top, coming ones at the bottom; the first is lit at the top of the pane.
    // 24 px a head since v2.7323 (30 before): the owner's ask that the bars sit closer with the words as they are.
    // The footer's head (v2.7422) is the last: the coming heads stack over it at the bottom, and it takes no place at the top.
    expect(heads.map((h) => [h.style.top, h.style.bottom])).toEqual([['0px', '120px'], ['24px', '96px'], ['48px', '72px'], ['72px', '48px'], ['96px', '24px'], ['auto', '0px']])
    expect(heads.every((h) => h.style.height === '24px')).toBe(true)
    expect(heads.map((h) => h.getAttribute('data-on'))).toEqual(['yes', 'no', 'no', 'no', 'no', 'no'])
    expect(heads.map((h) => h.getAttribute('data-tone'))).toEqual([null, null, null, null, null, 'blue'])
    // Every head sits before its section, as a sibling in the pane's grid.
    for (const key of ['path', 'gates', 'houses', 'months', 'envelope']) {
      const head = document.querySelector(`[data-lien-pane-head="${key}"]`)!
      const body = document.querySelector(`[data-lien-pane-body="${key}"]`)!
      expect(head.parentElement).toBe(body.parentElement)
      expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    // The cards gave their title rows to the heads.
    expect(screen.queryByText('Supply houses on this job')).toBeNull()
    expect(document.querySelector('[data-lien-desk-gates] .lienGatesHead')).toBeNull()
    // Press a head: the pane scrolls to its section and the head lights.
    fireEvent.click(heads[3]!.querySelector('button')!)
    expect(heads[3]!.getAttribute('data-on')).toBe('yes')
    expect(heads[0]!.getAttribute('data-on')).toBe('no')
  })

  it('draws no card and no mark on a job that bought nothing (v2.4404)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    expect(document.querySelector('[data-lien-suppliers-card]')).toBeNull()
    expect(document.querySelector('[data-lien-supplier-mark]')).toBeNull()
  })
  describe('what the house told us (v2.4411)', () => {
    const reece = (word?: Parameters<typeof buildLienSupplierJobs>[0]['wordsByJob']) =>
      buildLienSupplierJobs({
        invoices: [{ id: 'r2', supply_house_id: 'reece', amount: 9612.4, is_paid: false, invoice_date: '2026-07-18', paidYmd: null, on_job_account: false }],
        allocations: [{ invoice_id: 'r2', job_id: 'j650', pct: 100 }],
        houses: [{ id: 'reece', name: 'Reece' }],
        wordsByJob: word,
      })

    it('the office records the house’s balance and its notice day, and the card re-reads', async () => {
      supplierState.byJob = reece()
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
      await settle()
      const card = document.querySelector<HTMLElement>('[data-lien-suppliers-card="owed"]')!
      fireEvent.click(within(card).getByRole('button', { name: 'They told us…' }))
      const form = card.querySelector<HTMLElement>('[data-lien-supplier-word-form="Reece"]')!
      // Nothing typed says nothing: Save waits.
      expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
      fireEvent.change(within(form).getByLabelText('Their balance on this job'), { target: { value: 'about 9k' } })
      expect(within(form).getByText('Type the balance as a number, like 8,950.00.')).toBeTruthy()
      fireEvent.change(within(form).getByLabelText('Their balance on this job'), { target: { value: '$8,950.00' } })
      fireEvent.change(within(form).getByLabelText('Their notice goes out'), { target: { value: '2026-10-14' } })
      fireEvent.change(within(form).getByLabelText('Who said it'), { target: { value: 'Dana' } })
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(saveWordMock).toHaveBeenCalledTimes(1))
      expect(saveWordMock.mock.calls[0]![0]).toEqual({ jobId: 'j650', houseId: 'reece', balance: 8950, noticeYmd: '2026-10-14', saidBy: 'Dana', note: '', notedByName: 'Taunya' })
      await waitFor(() => expect(supplierReload).toHaveBeenCalledTimes(1))
      expect(card.querySelector('[data-lien-supplier-word-form]')).toBeNull()
    })

    it('a recorded word shows over the estimate, and Clear takes it off', async () => {
      supplierState.byJob = reece(new Map([['j650', [{ houseId: 'reece', balance: 8950, noticeYmd: '2026-10-14', saidBy: 'Dana', note: '', notedByName: 'Grace', notedYmd: '2026-09-12' }]]]))
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
      await settle()
      const card = document.querySelector<HTMLElement>('[data-lien-suppliers-card="owed"]')!
      expect(within(card).getByText('notice goes out Oct 14')).toBeTruthy()
      expect(within(card).getByText('Dana said so · noted Sep 12 by Grace')).toBeTruthy()
      expect(within(card).getByText('Reece says $8,950.00')).toBeTruthy()
      fireEvent.click(within(card).getByRole('button', { name: 'Change what they told us…' }))
      fireEvent.click(within(card).getByRole('button', { name: 'Clear' }))
      await waitFor(() => expect(clearWordMock).toHaveBeenCalledWith('j650', 'reece'))
      await waitFor(() => expect(supplierReload).toHaveBeenCalledTimes(1))
    })

    it('the card without the office’s door (the Lien window) shows the word and offers no change', async () => {
      const job = reece(new Map([['j650', [{ houseId: 'reece', balance: null, noticeYmd: '2026-10-14', saidBy: '', note: 'on their list', notedByName: 'Grace', notedYmd: '2026-09-12' }]]])).get('j650')!
      renderWithProviders(<LienJobSuppliersCard job={job} propertyKind="" todayYmd={TODAY} openBalance={33_500} payerName="Lowbeck Contracting" jobLabel="650 · AXO Schertz" isMobile={false} />)
      await settle()
      expect(screen.getByText('notice goes out Oct 14')).toBeTruthy()
      expect(screen.getByText('Reece said so · noted Sep 12 by Grace')).toBeTruthy()
      expect(screen.getByText('“on their list”')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /told us/ })).toBeNull()
    })
  })
})

describe('LienDesk · an evening stamp keeps its day (v2.4468)', () => {
  // 00:30 UTC on Sep 3 is 7:30 pm CDT on Sep 2; 01:00 UTC on Sep 11 is 8 pm CDT on Sep 10.
  const notice = { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }
  const packet = {
    id: 'sentE', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T20:00:00Z', approved_at: '2026-09-02T21:00:00Z', sent_at: '2026-09-03T00:30:00Z',
    fields: { notice, gcEmail: 'office@lowbeck.test', gcAuthorizedDirectPay: { at: '2026-09-11T01:00:00Z', name: 'Taunya', note: 'email from Lowbeck' } },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-03T00:30:00Z', voided_at: null,
  } as unknown as LienDeskItemRow

  it('the sent row, the sent footer, its day count and the GC’s okay read the Central day', () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [packet], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    const since = document.querySelector('[data-lien-since-sent]') as HTMLElement
    expect(since.textContent).toContain('Sent September 2, 2026')
    expect(since.textContent).toContain('Day 12')
    expect(since.textContent).toContain('GC authorized direct pay: yes · Sep 10 · email from Lowbeck')
    expect(document.body.textContent).toContain('sent Sep 2')
  })

  it('a correction set in the evening is carried from its Central day', () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    d.claimCorrectionsByJob = { j650: { jobId: 'j650', amountOff: 1_500, perMonth: null, reason: 'GC disputes the 8/14 change order', carry: true, setByName: 'Taunya', setAt: '2026-09-11T01:00:00Z', lookedAt: null, lookedByName: '' } }
    d.items = [{ ...packet, fields: { notice, gcEmail: '' }, sent_at: '2026-09-12T15:00:00Z' } as LienDeskItemRow]
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={d} />)
    expect((document.querySelector('[data-lien-claim-carry-strip]') as HTMLElement).textContent).toContain('Carrying Taunya’s correction from Sep 10:')
    expect((document.querySelector('[data-lien-claim-box]') as HTMLElement).textContent).toContain('Taunya · Sep 10 · “GC disputes the 8/14 change order”')
  })
})

describe('LienDesk · By paper on a phone (punch list #352, PR 5)', () => {
  it('a computer stacks the pile titles at both ends; a phone pins one at the top, a thumb tall, and its tabs wrap sooner than slide', async () => {
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const heads = [...document.querySelectorAll<HTMLElement>('[data-lien-pile-head]')]
    expect(heads.length).toBeGreaterThanOrEqual(1)
    // i bars from the top, n-1-i from the bottom, 24 px each since v2.7323 (`lienPhoneLists.test.ts` holds a list of five).
    expect(heads.map((h) => parseFloat(h.style.top))).toEqual(heads.map((_, i) => i * 24))
    expect(heads.map((h) => parseFloat(h.style.bottom))).toEqual(heads.map((_, i) => (heads.length - 1 - i) * 24))
    expect(heads.every((h) => h.style.height === '24px')).toBe(true)
    const wide = document.querySelector<HTMLElement>('[data-lien-desk-paper-kinds] [role="tab"]')!
    expect(wide.style.whiteSpace).toBe('nowrap')
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} layout="stacked" />)
      await settle()
      const phoneHeads = [...document.querySelectorAll<HTMLElement>('[data-lien-pile-head]')]
      expect(phoneHeads.length).toBe(heads.length)
      for (const h of phoneHeads) {
        expect(parseFloat(h.style.top)).toBe(0)
        expect(h.style.bottom).toBe('auto')
        expect(h.style.height).toBe('40px')
        expect(h.style.fontSize).toBe('0.75rem')
      }
      // Both rows of tabs: a thumb tall, free to shrink, words wrapping in place of a sideways slide.
      const tabs = [...document.querySelectorAll<HTMLElement>('[data-lien-desk-view], [data-lien-desk-paper-kinds] [role="tab"]')]
      expect(tabs.length).toBeGreaterThanOrEqual(7)
      for (const t of tabs) {
        expect(t.style.minHeight).toBe('44px')
        expect(t.style.whiteSpace).toBe('normal')
        expect(t.style.flexShrink).toBe('1')
        expect(parseFloat(t.style.minWidth)).toBe(0)
      }
      expect(screen.getByTestId('lien-desk-find').style.minHeight).toBe('44px')
    } finally {
      window.matchMedia = before
    }
  })
})

describe('LienDesk · the pile titles stack (v2.4672)', () => {
  it('draws a sticky title per pile with its count and its place, no chip row; a press scrolls the list and lights the title', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const head = document.querySelector('[data-lien-pile-head="needs_owner"]') as HTMLElement
    expect(head).toBeTruthy()
    expect(head.className).toBe('lienPileHead')
    expect(head.style.top).toBe('0px')
    expect(head.querySelector('[data-lien-pile-count="needs_owner"]')!.textContent).toBe('1')
    expect(screen.getAllByRole('button', { name: /Needs the owner/ })).toHaveLength(1)
    expect(document.querySelector('[data-lien-pile-rows="needs_owner"]')!.textContent).toContain('650 · AXO Schertz')
    const host = document.querySelector('[data-lien-desk-list]') as HTMLElement & { scrollTo: (o: unknown) => void }
    const scrollTo = vi.fn()
    host.scrollTo = scrollTo
    fireEvent.click(screen.getByRole('button', { name: /Needs the owner/ }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(head.getAttribute('data-on')).toBe('yes')
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
  })
  it('a door that opens an empty pile says what is no longer there, counts the other piles, and offers the way out (v2.4854)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650)} initialPile="awaiting" />)
    await settle()
    const empty = document.querySelector('[data-lien-desk-empty-pile="awaiting"]') as HTMLElement
    expect(empty.textContent).toContain('Nothing is waiting for approval.')
    expect(empty.textContent).toContain('1 notice is on the other piles.')
    expect(document.querySelectorAll('[data-lien-pile-head]')).toHaveLength(0)
    fireEvent.click(within(empty).getByRole('button', { name: 'Show every pile ›' }))
    expect(document.querySelector('[data-lien-desk-empty-pile]')).toBeNull()
    expect(document.querySelector('[data-lien-pile-head="needs_owner"]')).toBeTruthy()
  })
  it('a narrowed pile that empties under the leader’s act widens by itself (v2.4854)', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    const { rerender } = renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} initialPile="awaiting" />)
    await settle()
    expect(document.querySelector('[data-lien-pile-head="awaiting"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-lien-pile-head]')).toHaveLength(1)
    // The desk re-reads after the approval: the item is in Approved · to print, the awaiting pile is empty.
    const approved = { ...awaiting, status: 'approved', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader' } as LienDeskItemRow
    rerender(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [approved], true)} initialPile="awaiting" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-empty-pile]')).toBeNull()
    expect(document.querySelector('[data-lien-pile-head="ready"]')).toBeTruthy()
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
  })
  it('a list narrowed to one pile offers every pile on its title, and widens on it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialPile="needs_owner" />)
    await settle()
    expect(document.querySelectorAll('[data-lien-pile-head]')).toHaveLength(1)
    // Two words on the bar (v2.7434), so the longest pile name and its count hold one line; the hover and a screen reader get the whole act.
    const every = document.querySelector('[data-lien-pile-all]') as HTMLElement
    expect(every.textContent).toBe('every pile')
    expect(every.getAttribute('aria-label')).toBe('Show every pile')
    expect(every.title).toBe('Show every pile')
    expect(every.style.whiteSpace).toBe('nowrap')
    fireEvent.click(every)
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
    expect(document.querySelector('[data-lien-pile-head="needs_owner"]')).toBeTruthy()
  })
})

describe('LienDesk — the page labels stick (v2.4726)', () => {
  it('the page labels stack under the strip and at the foot like the pile titles, the one under the reader lit, each a button to its page', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const labels = Array.from(document.querySelectorAll('[data-lien-desk-page-label]')) as HTMLElement[]
    expect(labels.length).toBeGreaterThanOrEqual(2)
    // Stacked like the pile titles, under the pane's section heads (v2.4733: four on this job, which bought from no house) — the i-th label sits
    // heads + i bars from the top once passed; it does not stack at the foot, where the envelope head already names the pages.
    // The footer's blue head (v2.7422) pins at the pane's bottom and never over a page, so the labels do not count it.
    const headCount = document.querySelectorAll('[data-lien-pane-head]:not([data-tone])').length
    expect(headCount).toBe(4)
    // 24 px a bar since v2.7323 (30 before), the same number as the pane's heads over them.
    expect(labels.map((l) => l.style.top)).toEqual(labels.map((_, i) => `${(headCount + i) * 24}px`))
    expect(labels.map((l) => l.style.bottom)).toEqual(labels.map(() => 'auto'))
    expect(labels.every((l) => l.style.height === '24px')).toBe(true)
    expect(labels.map((l) => l.getAttribute('data-on'))).toEqual(labels.map((_, i) => (i === 0 ? 'yes' : 'no')))
    expect(labels[0]!.textContent).toMatch(/^Page 1 of \d/)
    // Each is a button that goes to its page and lights up.
    const pane = document.querySelector('[data-lien-desk-pane]') as HTMLElement
    pane.scrollTo = vi.fn() as never
    fireEvent.click(labels[1]!.querySelector('button') as HTMLElement)
    expect(pane.scrollTo).toHaveBeenCalled()
    expect(labels[1]!.getAttribute('data-on')).toBe('yes')
    expect(labels[0]!.getAttribute('data-on')).toBe('no')
  })
  it('each page bar carries Open ↗ and PDF ↓ beside its own button, never inside it, and the bar still goes to its page (v2.7432)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const labels = Array.from(document.querySelectorAll('[data-lien-desk-page-label]')) as HTMLElement[]
    expect(labels.length).toBeGreaterThanOrEqual(2)
    for (const label of labels) {
      const key = label.getAttribute('data-lien-desk-page-label') as string
      const bar = label.querySelector('.lienPileHeadBtn') as HTMLElement
      const presses = label.querySelector('[data-lien-page-export]') as HTMLElement
      // Siblings: a button inside a button is not allowed, and a press must not scroll the pane.
      expect(bar.parentElement).toBe(label)
      expect(presses.parentElement).toBe(label)
      expect(bar.querySelector('button')).toBeNull()
      expect(bar.nextElementSibling).toBe(presses)
      expect(presses.getAttribute('data-lien-page-export')).toBe(key)
      expect((presses.querySelector(`[data-lien-page-open="${key}"]`) as HTMLElement).textContent).toBe('Open ↗')
      expect((presses.querySelector(`[data-lien-page-pdf="${key}"]`) as HTMLElement).textContent).toBe('PDF ↓')
    }
    const pane = document.querySelector('[data-lien-desk-pane]') as HTMLElement
    pane.scrollTo = vi.fn() as never
    fireEvent.click(labels[1]!.querySelector('.lienPileHeadBtn') as HTMLElement)
    expect(pane.scrollTo).toHaveBeenCalledTimes(1)
    expect(labels[1]!.getAttribute('data-on')).toBe('yes')
  })
})

describe('LienDesk — find on the list (v2.4721)', () => {
  it('narrows the piles as you type, writes the hidden fact that matched into the row, counts, says what to try when nothing matches, and the one match selects itself', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const box = screen.getByTestId('lien-desk-find')
    expect(box.getAttribute('data-finding')).toBe('no')
    const input = screen.getByTestId('lien-desk-find-input') as HTMLInputElement
    // The owner's name is not on the row; the find still lands on it and says so.
    fireEvent.change(input, { target: { value: 'elwick' } })
    expect(screen.getByTestId('lien-desk-find-count').textContent).toBe('1 job')
    const list = document.querySelector('[data-lien-desk-list]') as HTMLElement
    expect(list.querySelector('[data-lien-find-hit="owner"]')?.textContent).toContain('owner Elwick Holdings LLC')
    expect(list.querySelector('[data-lien-pile-count]')?.textContent).toMatch(/^1 of \d+$/)
    expect(list.querySelectorAll('[data-lien-find-mark]').length).toBeGreaterThan(0)
    // Nothing matches: the words say what to try and where else to look; the piles keep their titles, greyed.
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByTestId('lien-desk-find-nothing').textContent).toContain('Nothing matches “zzz”.')
    expect(screen.getByTestId('lien-desk-find-nothing').textContent).toContain('Someone’s calling')
    expect(list.querySelector('[data-lien-pile-head][data-empty="yes"]')).toBeTruthy()
    // × clears it and the list comes back whole.
    fireEvent.click(screen.getByTestId('lien-desk-find-clear'))
    expect(box.getAttribute('data-finding')).toBe('no')
    expect(screen.queryByTestId('lien-desk-find-nothing')).toBeNull()
  })

  it('the Months card lists the bills behind the claim, and Bill it from here opens Bill Customer and re-reads the desk (v2.4969)', async () => {
    // Job 922's shape: a $33,500 job, two bills sent that still owe $25,000, the rest not billed.
    const bill = (invoiceId: string, number: string, what: string, owed: number, paid = 0): LienClaimBill => ({ invoiceId, number, what, sentYmd: '2026-09-24', stripe: true, dueYmd: '2026-09-24', billed: owed + paid, paid, owed })
    payPageState.bills = [bill('inv-rough', '#650-2609241309', 'Rough In', 15_000), bill('inv-top', '#650-2609301442', 'Top Out', 10_000, 2_000)]
    payPageState.job = { id: 'j650', master_user_id: 'u-master', hcp_number: '650', click_number: null, job_name: 'AXO Schertz', customer_id: 'axo', customer_name: 'AXO Schertz', customer_email: 'ap@axo.test', job_address: '1204 Elwick Rd, Schertz, TX', customer_phone: null, last_work_date: null } as unknown as JobWithDetails
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true, open_balance: 25_000 })), [], true)} onChanged={onChanged} />)
    await settle()
    // The claim is what the sent bills owe, and the pane's Months row counts them.
    expect((document.querySelector('[data-lien-pane-head="months"]') as HTMLElement | null)?.textContent ?? document.body.textContent).toContain('$25,000 · 2 bills')
    const list = document.querySelector('[data-lien-claim-bills]') as HTMLElement
    expect(list).toBeTruthy()
    const rows = within(list).getAllByText(/Owed/).map((el) => el.parentElement!.textContent)
    expect(rows).toEqual(['Owed$15,000.00', 'Owed$10,000.00'])
    expect((list.querySelector('[data-lien-claim-bill="inv-top"]') as HTMLElement).textContent).toContain('#650-2609301442 · Top Out')
    expect((list.querySelector('[data-lien-claim-bill="inv-top"]') as HTMLElement).textContent).toContain('Paid$2,000.00')
    const unbilled = list.querySelector('[data-lien-claim-unbilled]') as HTMLElement
    expect(unbilled.textContent).toContain('$8,500 of the job’s $33,500 · not claimed until it is billed')
    // No fifth gate while the sent bills still owe money.
    expect(document.querySelector('[data-gate="billed"]')).toBeNull()
    expect((screen.getByRole('button', { name: /to approve ▸/ }) as HTMLButtonElement).disabled).toBe(false)
    // The door opens the app's own Bill Customer window on this job; once the bill goes, the desk reads the job and the queue again.
    fireEvent.click(within(unbilled).getByRole('button', { name: 'Bill it from here ›' }))
    expect(openBillCustomerMock).toHaveBeenCalledTimes(1)
    const opts = openBillCustomerMock.mock.calls[0]![0] as { payload: { kind: string; job: { id: string; customer_id: string } }; onSuccess: () => Promise<void> }
    expect(opts.payload.kind).toBe('job')
    expect(opts.payload.job).toMatchObject({ id: 'j650', customer_id: 'axo' })
    await opts.onSuccess()
    expect(payPageRefresh).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('nothing owed on the sent bills while money is still on the job: the fifth gate holds the send (v2.4969)', async () => {
    payPageState.bills = []
    payPageState.job = { id: 'j650', master_user_id: 'u-master', hcp_number: '650', click_number: null, job_name: 'AXO Schertz', customer_id: 'axo', customer_name: 'AXO Schertz', customer_email: '', job_address: '', customer_phone: null, last_work_date: null } as unknown as JobWithDetails
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true, open_balance: 0 })), [], true)} />)
    await settle()
    const gate = document.querySelector('[data-gate="billed"]') as HTMLElement
    expect(gate.textContent).toBe('5Nothing billed✗ Bill the work first')
    expect((document.querySelector('[data-lien-gate-billed-fact]') as HTMLElement).textContent).toContain('Nothing is billed on this job yet. A notice claims what is billed.')
    expect(screen.getByRole('button', { name: 'Go to gate 5 ▴' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /to approve ▸/ })).toBeNull()
    expect(document.body.textContent).toContain("Don't send yet. Bill the work first. A notice claims what is billed.")
    // The gate's own door bills from the desk too.
    fireEvent.click(document.querySelector('[data-lien-gate-bill-from-here]') as HTMLElement)
    expect(openBillCustomerMock).toHaveBeenCalledTimes(1)
  })
})

describe('LienDesk · the master signs on someone else’s screen with his code (v2.5791, punch list #150)', () => {
  const awaitingOn = (jobOver: Record<string, unknown>) => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    const d = data(J650, [awaiting], true)
    d.jobsById.j650 = { ...d.jobsById.j650!, ...jobOver } as NonNullable<typeof d.jobsById.j650>
    return d
  }

  it('a dev who is not the job’s master sees the master’s name on the line, his code field, and the press goes to the code RPC as the master', async () => {
    codeState.signs = []
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
    const line = screen.getByTestId('lien-sign-line')
    expect(line.textContent).toContain('Malachi signs here with his code')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi Whites')
    expect(line.textContent).not.toContain('Your signature, as it will print')
    const press = screen.getByRole('button', { name: /Sign and approve & next/ })
    fireEvent.click(press)
    await settle()
    // No code typed: nothing is sent.
    expect(codeState.signs).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '2468' } })
    fireEvent.click(press)
    await waitFor(() => expect(codeState.signs).toHaveLength(1))
    expect(codeState.signs[0]).toMatchObject({ itemId: 'it1', signerUserId: 'u-malachi', code: '2468', approve: true })
  })

  it('a wrong code says so under the field with the tries left; Draw instead stays and is the master’s hand on this screen', async () => {
    codeState.signs = []
    codeState.answer = { ok: false, reason: 'wrong', message: 'That is not Malachi’s code.', triesLeft: 3, lockedUntilIso: null }
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '0000' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign and approve & next/ }))
    await waitFor(() => expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('That is not Malachi’s code. 3 tries left.'))
    fireEvent.click(screen.getByTestId('lien-sign-line-toggle'))
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(screen.getByTestId('lien-sign-line').textContent).toContain('Malachi signs here, in his own hand')
    codeState.answer = { ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Malachi' }
  })

  it('the line previews his full name while the words around it keep the short one (v2.7395)', async () => {
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi' : 'Robert')} signatureNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : id === 'u-robert' ? 'Robert Douglas' : '')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi Whites')
    expect(screen.getByTestId('lien-sign-line').textContent).toContain('Malachi signs here with his code')
    cleanup()
    // On his own sign-in the preview is his own full name, not the short name he is signed in under.
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-malachi" authName="Malachi" leaderNameFor={() => 'Malachi'} signatureNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : '')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('type')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi Whites')
  })

  it('with no code set the line opens on the pad and says where he sets one; the office’s awaiting footer carries the same line and its own press', async () => {
    codeState.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Wendi')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-lien-sign-code-words]')).toBeTruthy())
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('Malachi has not set a signing code yet. He sets it under Settings, Your account. He can draw here instead.')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
    expect(document.querySelector('[data-lien-desk-office-sign-press]')).toBeTruthy()
    // v2.7386: the line is a box with the office's press inside it; the awaiting row stays under the box.
    const officeBox = screen.getByTestId('lien-sign-line')
    expect((officeBox.querySelector('.lienSignFrameCallTitle') as HTMLElement).textContent).toBe('→ His code or his hand here')
    expect((officeBox.querySelector('.lienSignFrameCallNote') as HTMLElement).textContent).toContain(' · The record names your screen.')
    expect(officeBox.contains(document.querySelector('[data-lien-desk-office-sign-press]'))).toBe(true)
    expect(officeBox.contains(document.querySelector('[data-lien-desk-foot="awaiting"]'))).toBe(false)
    // The spoken word is still a door.
    expect(screen.getByRole('button', { name: /Leader here, Approve/ })).toBeTruthy()
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
  })

  it('Just this one opens the run on that one notice, and counts its envelopes (v2.7512): the Lien window is not opened, an unsigned notice reads held', async () => {
    const onOpenLienInstruments = vi.fn()
    const approved = { cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z', status: 'approved', approved_by: 'u-sam', approved_at: '2026-09-12T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '' }
    const signed = { signed_by: 'u-sam', signed_at: '2026-09-12T15:00:00Z', signer_printed_name: 'Sam', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}) }
    const item = (id: string, job: string, over: Record<string, unknown>) => ({ id, job_id: job, kind: 'notice_53_056', months: ['2026-07'], fields: {}, ...over }) as unknown as LienDeskItemRow
    // Two approved notices wait to print. One is signed; the other was approved on the leader's word and is not.
    const d = data([row('j650', '2026-07', '2026-10-15'), row('j651', '2026-07', '2026-10-15')], [item('it1', 'j650', { ...approved, ...signed }), item('it2', 'j651', { ...approved, approved_by: 'u-taunya', approval_mode: 'word', word_note: 'Sam said send it', word_channel: 'phone' })], true)
    d.jobsById.j650 = { ...d.jobsById.j650!, master_user_id: 'u-sam' } as NonNullable<typeof d.jobsById.j650>
    d.jobsById.j651 = { ...d.jobsById.j650!, id: 'j651', hcp_number: '651', job_name: 'Palomino Trail' }
    const link = () => document.querySelector('[data-lien-desk-just-this-one]') as HTMLButtonElement
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={() => 'Sam'} data={d} initialPile="ready" initialJobId="j650" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    // The owner and the original contractor each have a mailing address, so the press prints two envelopes and says so.
    expect(link().textContent).toBe('Just this one · 2 envelopes ›')
    expect([link().getAttribute('data-envelopes'), link().getAttribute('data-held')]).toEqual(['2', '0'])
    expect(link().title).toContain('Both envelopes print in one press.')
    // The whole run still counts both approved notices.
    expect(within(document.querySelector('[data-lien-desk-foot="ready"]') as HTMLElement).getByRole('button', { name: /Print and mail 2/ })).toBeTruthy()
    fireEvent.click(link())
    const run = await screen.findByRole('dialog', { name: 'Print and mail' })
    // The run window holds this one notice, not the two the desk has approved.
    expect(within(run).getByRole('heading', { level: 2 }).textContent).toBe('Print and mail · 1 notice')
    expect(run.textContent).toContain('AXO Schertz')
    expect(run.textContent).not.toContain('Palomino Trail')
    expect(onOpenLienInstruments).not.toHaveBeenCalled()
    desk.unmount()

    // The unsigned one: nothing would print, as in the run, and the link says so before the press.
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={() => 'Sam'} data={d} initialPile="ready" initialJobId="j651" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    expect(link().textContent).toBe('Just this one · held ›')
    expect(link().title).toMatch(/^Nothing prints yet\. Unsigned: /)
    expect(link().disabled).toBe(false)
  })

  it('the office’s Ready footer carries his line and its own Sign ▸ (v2.6733): the code goes to the RPC as the master with no approval, and He signed the paper stays', async () => {
    codeState.signs = []
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    // Approved on his word (unsigned), the job's master Malachi, the office signed in.
    const approved = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-taunya', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'word', word_note: 'Malachi said send it', word_channel: 'phone', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T15:00:00Z', voided_at: null,
    } as LienDeskItemRow
    const d = data(J650, [approved], true)
    d.jobsById.j650 = { ...d.jobsById.j650!, master_user_id: 'u-malachi' } as NonNullable<typeof d.jobsById.j650>
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Wendi')} data={d} initialPile="ready" />)
    await settle()
    const foot = document.querySelector('[data-lien-desk-foot="ready"]') as HTMLElement
    expect(foot).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi Whites')
    // v2.7386: the line is the footer's box. Sign ▸ sits beside the code and the Ready row is the box's strip.
    const box = screen.getByTestId('lien-sign-line')
    expect((box.querySelector('.lienSignFrameStrip') as HTMLElement).contains(foot)).toBe(true)
    expect((box.querySelector('.lienSignFrameCallTitle') as HTMLElement).textContent).toBe('→ Malachi’s signature on June 2026')
    expect(box.querySelector('[data-lien-desk-sign]')).toBeNull()
    expect(foot.querySelector('[data-lien-desk-pen]')).toBeTruthy()
    const press = box.querySelector('[data-lien-desk-office-sign-press]') as HTMLButtonElement
    expect(foot.contains(press)).toBe(false)
    expect(press.textContent).toBe('Sign ▸')
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '1357' } })
    fireEvent.click(press)
    await waitFor(() => expect(codeState.signs).toHaveLength(1))
    expect(codeState.signs[0]).toMatchObject({ itemId: 'it1', signerUserId: 'u-malachi', code: '1357', approve: false })
  })

  describe('Sign it again (v2.7502)', () => {
    const FIELDS = { gcEmail: 'zz@example.test' }
    // Approved and signed by a drawing on the office's screen: the job's master is Avery, the office is Dana.
    const signedItem = (over: Record<string, unknown> = {}) =>
      ({
        id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'approved', fields: FIELDS, cover_note: true, drafted_by: 'u-dana', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-avery', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T15:00:00Z', voided_at: null, printed_at: null,
        signed_by: 'u-avery', signed_at: '2026-09-14T15:00:00Z', signer_printed_name: 'Avery Stone', signer_signature_mode: 'draw', signer_signature_storage_path: 'desk/it1/ink.png', signed_on_device_of: 'u-dana', signed_fields_hash: lienFieldsHash(FIELDS), signed_leader_confirmed_at: null,
        ...over,
      }) as unknown as LienDeskItemRow
    const CLEAR = { signed_by: null, signed_at: null, signer_printed_name: null, signer_signature_mode: null, signer_signature_storage_path: null, signed_on_device_of: null, signed_fields_hash: null }
    const cleared = () => signedItem({ ...CLEAR, fields: { ...FIELDS, signatureCleared: { at: '2026-09-14T17:00:00Z', by: 'u-dana', byName: 'Dana', signedAt: '2026-09-14T15:00:00Z', signedBy: 'u-avery', signerName: 'Avery Stone', mode: 'draw', storagePath: 'desk/it1/ink.png' } } })
    const deskData = (item: LienDeskItemRow) => {
      const d = data(J650, [item], true)
      d.jobsById.j650 = { ...d.jobsById.j650!, master_user_id: 'u-avery' } as NonNullable<typeof d.jobsById.j650>
      return d
    }
    const names = (id: string | null) => (id === 'u-avery' ? 'Avery Stone' : 'Dana')
    const office = { ...baseProps, authRole: 'assistant' as const, authUserId: 'u-dana', authName: 'Dana', leaderNameFor: names }
    const master = { ...baseProps, authRole: 'master_technician' as const, authUserId: 'u-avery', authName: 'Avery', leaderNameFor: names }
    beforeEach(() => {
      signAgainMock.mockClear()
      signAgainMock.mockResolvedValue({ ok: true })
      codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    })

    it('the office: the link in the Ready row, a confirm that says what happens, Cancel writes nothing, the button clears, and the cleared footer carries his line with the code', async () => {
      const onChanged = vi.fn()
      const view = renderWithProviders(<LienDesk {...office} onChanged={onChanged} data={deskData(signedItem())} initialPile="ready" />)
      await settle()
      const foot = document.querySelector('[data-lien-desk-foot="ready"]') as HTMLElement
      const link = foot.querySelector('[data-lien-desk-sign-again]') as HTMLButtonElement
      expect(link.textContent).toBe('Sign it again…')
      // A signed notice has no signing line: the row stands alone.
      expect(screen.queryByTestId('lien-sign-line')).toBeNull()
      fireEvent.click(link)
      const ask = await screen.findByRole('alertdialog', { name: 'Sign the notice again for AXO Schertz, job 650?' })
      expect(ask.textContent).toContain('Avery Stone’s signature from Sep 14 comes off this notice. The approval stands. The run holds the notice until it is signed again. Avery signs it on his own screen, or here with his code or his hand. The notice keeps a line saying who cleared it and when.')
      fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(signAgainMock).not.toHaveBeenCalled()
      fireEvent.click(link)
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Clear the signature' }))
      await waitFor(() => expect(signAgainMock).toHaveBeenCalledTimes(1))
      expect(signAgainMock).toHaveBeenCalledWith('it1', { userId: 'u-dana', userName: 'Dana' })
      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect(await screen.findByText('Cleared. The notice waits for Avery to sign it again.')).toBeTruthy()
      // The desk reads again: the notice is unsigned, so his line is back on the office's screen, with his code and its own press.
      view.rerender(<LienDesk {...office} onChanged={onChanged} data={deskData(cleared())} initialPile="ready" />)
      await settle()
      await waitFor(() => expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('code'))
      const box = screen.getByTestId('lien-sign-line')
      expect((box.querySelector('.lienSignFrameCallTitle') as HTMLElement).textContent).toBe('→ Avery’s signature on June 2026')
      expect(box.querySelector('[data-lien-desk-office-sign-press]')).toBeTruthy()
      expect(screen.getByLabelText('Avery’s signing code')).toBeTruthy()
      const row = document.querySelector('[data-lien-desk-foot="ready"]') as HTMLElement
      expect(row.querySelector('[data-lien-desk-sign-again]')).toBeNull()
      expect(row.querySelector('[data-lien-desk-ready-words]')!.textContent).toContain('unsigned')
      expect((document.querySelector('[data-lien-desk-signature-cleared]') as HTMLElement).textContent).toBe('The signing record, kept here and not printed. Signature cleared Sep 14 by Dana. It was a drawn signature by Avery Stone from Sep 14.')
    })

    it('the leader on his own screen: the confirm speaks to him, and the cleared footer is his signing box with Sign ▸', async () => {
      const own = signedItem({ signer_signature_mode: 'type', signer_signature_storage_path: null, signed_on_device_of: null })
      const view = renderWithProviders(<LienDesk {...master} data={deskData(own)} initialPile="ready" />)
      await settle()
      fireEvent.click(document.querySelector('[data-lien-desk-sign-again]') as HTMLButtonElement)
      const ask = await screen.findByRole('alertdialog', { name: 'Sign the notice again for AXO Schertz, job 650?' })
      expect(ask.textContent).toContain('Your signature from Sep 14 comes off this notice. The approval stands. The run holds the notice until you sign it again. The signing box opens here for you.')
      fireEvent.click(within(ask).getByRole('button', { name: 'Clear the signature' }))
      await waitFor(() => expect(signAgainMock).toHaveBeenCalledWith('it1', { userId: 'u-avery', userName: 'Avery' }))
      expect(await screen.findByText('Cleared. The signing box is open. Sign the notice again.')).toBeTruthy()
      view.rerender(<LienDesk {...master} data={deskData(cleared())} initialPile="ready" />)
      await settle()
      const box = screen.getByTestId('lien-sign-line')
      expect((box.querySelector('.lienSignFrameCallTitle') as HTMLElement).textContent).toBe('→ Your signature on June 2026')
      expect((box.querySelector('[data-lien-desk-sign]') as HTMLButtonElement).textContent).toBe('Sign ▸')
      expect(box.getAttribute('data-lien-sign-mode')).toBe('type')
    })

    it('a notice that printed in the meantime is left alone: the reason is told and the desk reads again', async () => {
      signAgainMock.mockResolvedValue({ ok: false, message: 'Nothing was cleared. The notice changed since this screen read it. It may have printed, or its signature is already off.' })
      const onChanged = vi.fn()
      renderWithProviders(<LienDesk {...office} onChanged={onChanged} data={deskData(signedItem())} initialPile="ready" />)
      await settle()
      fireEvent.click(document.querySelector('[data-lien-desk-sign-again]') as HTMLButtonElement)
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Clear the signature' }))
      expect(await screen.findByText('Sign it again: Nothing was cleared. The notice changed since this screen read it. It may have printed, or its signature is already off.')).toBeTruthy()
      expect(onChanged).toHaveBeenCalled()
      expect(screen.queryByText(/^Cleared\./)).toBeNull()
    })

    it('Back to Approved · to print on a signed notice asks first (v2.7503): the signature comes off, Cancel writes nothing, the button takes it back', async () => {
      clearPrintedMock.mockReset()
      clearPrintedMock.mockResolvedValue(undefined)
      renderWithProviders(<LienDesk {...office} data={deskData(signedItem({ printed_at: '2026-09-14T16:00:00Z' }))} initialPile="printed" />)
      await settle()
      const footer = document.querySelector('[data-lien-desk-printed-footer]') as HTMLElement
      const back = within(footer).getByRole('button', { name: 'Back to Approved · to print' })
      expect(back.title).toBe('It was not mailed: put it back in Approved · to print. The approval stands, and a signature on it comes off')
      fireEvent.click(back)
      const ask = await screen.findByRole('alertdialog', { name: 'Take back the notice for AXO Schertz, job 650?' })
      expect(ask.textContent).toContain('The notice goes back to Approved · to print. The approval stands. Avery Stone’s signature comes off, so the notice can be signed again. The run holds the notice until then.')
      fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(clearPrintedMock).not.toHaveBeenCalled()
      fireEvent.click(back)
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Take back the notice' }))
      await waitFor(() => expect(clearPrintedMock).toHaveBeenCalledWith('it1'))
      expect(await screen.findByText('Back in Approved · to print. It waits to be signed again.')).toBeTruthy()
    })

    it('no press on a printed notice, on an unsigned one, or beside the leader’s own Not me', async () => {
      renderWithProviders(<LienDesk {...office} data={deskData(signedItem({ printed_at: '2026-09-14T16:00:00Z' }))} initialPile="printed" />)
      await settle()
      expect(document.querySelector('[data-lien-desk-foot="printed"]')).toBeTruthy()
      expect(document.querySelector('[data-lien-desk-sign-again]')).toBeNull()
      cleanup()
      renderWithProviders(<LienDesk {...office} data={deskData(signedItem(CLEAR))} initialPile="ready" />)
      await settle()
      expect(document.querySelector('[data-lien-desk-foot="ready"]')).toBeTruthy()
      expect(document.querySelector('[data-lien-desk-sign-again]')).toBeNull()
      cleanup()
      // His code signed it on the office's screen and he has not confirmed: his own footer offers Not me, which clears it too.
      renderWithProviders(<LienDesk {...master} data={deskData(signedItem({ signer_signature_mode: 'code', signer_signature_storage_path: null }))} initialPile="ready" />)
      await settle()
      expect(document.querySelector('[data-lien-desk-pen-no]')).toBeTruthy()
      expect(document.querySelector('[data-lien-desk-sign-again]')).toBeNull()
    })
  })

  it('a held notice on the master’s own sign-in (v2.7386): his line is the footer’s box, the release press sits inside it and the held row is its strip', async () => {
    const heldItem = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'held', hold_reason: 'call_first', hold_until: '2026-12-01', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '',
    } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [heldItem], true)} initialPile="held" />)
    await settle()
    const box = screen.getByTestId('lien-sign-line')
    expect(box.hasAttribute('data-lien-sign-frame')).toBe(true)
    expect((box.querySelector('.lienSignFrameCallTitle') as HTMLElement).textContent).toBe('→ Your call on June 2026')
    expect(box.contains(screen.getByRole('button', { name: /Release the hold, sign and approve/ }))).toBe(true)
    const row = document.querySelector('[data-lien-desk-foot="held"]') as HTMLElement
    expect((box.querySelector('.lienSignFrameStrip') as HTMLElement).contains(row)).toBe(true)
    expect(row.querySelector('[data-lien-desk-held-words]')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Back to draft' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: /Release the hold/ })).toBeNull()
  })

  it('a dev on another master’s job reads To do as the office does (v2.6734): the row waits on Malachi, out of his count, and his code signature’s confirm group is not drawn on the dev’s Ready footer', async () => {
    const d = awaitingOn({ master_user_id: 'u-malachi' })
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={d} initialKind="next" />)
    await settle()
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h4')).map((h) => h.textContent)
    expect(titles).toEqual(['Awaiting Master approval · 1 notice · waiting on Malachi Whites'])
    expect((document.querySelector('[data-lien-next-up-row="notice:j650"] [data-lien-next-up-line]') as HTMLElement).textContent).toBe('Sent for approval Sep 14 · today')
    expect(screen.getByRole('tab', { name: /^Lien desk/ }).textContent).toBe('⏱ Lien desk · 0 to do')
    cleanup()
    // Ready, signed by Malachi's code on Robert's screen and not yet confirmed: Robert's footer draws no Yes, it was me; Malachi's own does.
    const signedByCode = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T15:00:00Z', voided_at: null,
      signed_by: 'u-malachi', signed_at: '2026-10-23T19:14:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'code', signed_on_device_of: 'u-robert', signed_fields_hash: lienFieldsHash({}), signed_leader_confirmed_at: null,
    } as unknown as LienDeskItemRow
    const ready = data(J650, [signedByCode], true)
    ready.jobsById.j650 = { ...ready.jobsById.j650!, master_user_id: 'u-malachi' } as NonNullable<typeof ready.jobsById.j650>
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={ready} initialPile="ready" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-foot="ready"]')).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-pen-confirm]')).toBeNull()
    // v2.7437 (Taunya's ask): the paper carries the day alone, with no clock and no sentence of how it was signed…
    const paper = document.querySelector('[data-lien-desk-paper]') as HTMLElement
    expect(paper.querySelector('[data-filing-signed-mode="code"]')).toBeTruthy()
    expect(paper.textContent).toContain('Signed October 23, 2026')
    for (const banned of [/ CT\b/, /\b[AP]M\b/, /Typed by/, /signing code/, /screen/]) expect(paper.textContent).not.toMatch(banned)
    // …and the desk keeps the whole record under the paper, outside it.
    const record = document.querySelector('[data-lien-desk-signature-record]') as HTMLElement
    expect(paper.contains(record)).toBe(false)
    expect(record.textContent).toBe('The signing record, kept here and not printed. Typed by Malachi Whites with his signing code in ClickTooling on October 23, 2026 at 2:14 PM CT, on Robert’s screen.')
    cleanup()
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-malachi" authName="Malachi" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={ready} initialPile="ready" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-pen-confirm]')?.getAttribute('data-lien-desk-confirm-mode')).toBe('code')
  })

  it('the master on his own screen is unchanged: his own name, a press', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-malachi" authName="Malachi" leaderNameFor={() => 'Malachi Whites'} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('type')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi')
    expect(document.querySelector('[data-lien-sign-code-row]')).toBeNull()
  })
})

describe('LienDesk · the affidavit and retainage panes under grey heads (v2.7320, the owner’s ask of 2026-11-15)', () => {
  const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
  const affDesk = () => {
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    return d
  }
  const phone = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia

  it('the affidavit pane is sections under the notice pane’s stacked heads, in order with their facts; the boxes lost their captions; a lower head’s press lands on its body', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={affDesk()} initialKind="affidavit" />)
    await settle()
    const pane = document.querySelector<HTMLElement>('[data-lien-affidavit-pane]')!
    const heads = [...pane.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
    expect(heads.map((h) => h.getAttribute('data-lien-pane-head'))).toEqual(['path', 'gates', 'owner', 'paper'])
    expect(heads.map((h) => h.querySelector('.lienPaneHeadLabel')?.textContent)).toEqual(['Where this affidavit is', 'Before it can be generated', "The owner's answers", 'The paper'])
    expect(heads[0]!.querySelector('[data-lien-pane-head-fact]')!.textContent).toBe('Fix the property record, then file the affidavit — tomorrow · owner of record, legal description, a mailed notice missing')
    expect(heads[1]!.textContent).toBe('Before it can be generated✗ 3 missing · owner of record missing · county or legal description missing · no § 53.056 notice on the job')
    expect(heads[2]!.textContent).toBe("The owner's answersno call yet · bond unknown")
    expect(heads[3]!.textContent).toBe('The papershort form · Robert Douglas, Master Plumber')
    // Stacked like the notice pane: passed heads at the top, coming ones at the bottom, the first lit.
    // 24 px a head since v2.7323 (30 when v2.7320 shipped): the owner's ask that the bars sit closer with the words as they are.
    expect(heads.map((h) => [h.style.top, h.style.bottom])).toEqual([['0px', '72px'], ['24px', '48px'], ['48px', '24px'], ['72px', '0px']])
    expect(heads.map((h) => h.getAttribute('data-on'))).toEqual(['yes', 'no', 'no', 'no'])
    // Every head sits before its body, a sibling in the pane's grid, and the pane is the scrolling box.
    for (const key of ['path', 'gates', 'owner', 'paper']) {
      const head = pane.querySelector(`[data-lien-pane-head="${key}"]`)!
      const body = pane.querySelector(`[data-lien-pane-body="${key}"]`)!
      expect(head.parentElement).toBe(pane)
      expect(body.parentElement).toBe(pane)
      expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(pane.style.overflow).toBe('auto')
    // The boxes gave their captions to the heads; the gate caption's window words lead the gates body.
    expect(screen.queryByText(/Before this affidavit can be generated/)).toBeNull()
    expect(pane.querySelector('[data-lien-pane-body="gates"] [data-lien-affidavit-window]')!.textContent).toBe('§ 53.052 · window from May 2026, the last month worked')
    expect(pane.querySelector('[data-lien-pane-body="owner"]')!.getAttribute('data-lien-affidavit-owner-answers')).not.toBeNull()
    // The bodies keep their doors.
    // The gate rows are the presses of v2.7313: the notice gate's row ends in its door.
    expect(within(pane.querySelector<HTMLElement>('[data-lien-pane-body="gates"]')!).getByRole('button', { name: /Send the notice first ›$/ })).toBeTruthy()
    expect(within(pane.querySelector<HTMLElement>('[data-lien-pane-body="owner"]')!).getByRole('button', { name: 'Record it on the notice ›' })).toBeTruthy()
    expect(pane.querySelector('[data-lien-pane-body="paper"] [data-lien-affidavit-paper="short"]')).not.toBeNull()
    // Press a lower head: the pane scrolls its body up under the stacked heads (jsdom lays nothing out, so the body's offset is given), and the head lights.
    const paperBody = pane.querySelector<HTMLElement>('[data-lien-pane-body="paper"]')!
    Object.defineProperty(paperBody, 'offsetTop', { value: 900, configurable: true })
    fireEvent.click(heads[3]!.querySelector('button')!)
    expect(pane.scrollTop).toBe(900 - 4 * 24)
    expect(heads[3]!.getAttribute('data-on')).toBe('yes')
    expect(heads[0]!.getAttribute('data-on')).toBe('no')
  })

  it('on a phone the affidavit pane pins one head at a time, a thumb tall, in one column held to the screen', async () => {
    const before = window.matchMedia
    window.matchMedia = phone
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={affDesk()} layout="stacked" initialKind="affidavit" backDoor={<button type="button">← Pipeline</button>} />)
      await settle()
      // A phone shows the list first; the row opens its pane.
      fireEvent.click(screen.getByRole('button', { name: /AXO Schertz/ }))
      await waitFor(() => expect(document.querySelector('[data-lien-affidavit-pane]')).not.toBeNull())
      const pane = document.querySelector<HTMLElement>('[data-lien-affidavit-pane]')!
      expect(pane.getAttribute('data-lien-pane-phone')).toBe('yes')
      expect(pane.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
      const heads = [...pane.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
      expect(heads.map((h) => h.getAttribute('data-lien-pane-head'))).toEqual(['path', 'gates', 'owner', 'paper'])
      for (const h of heads) {
        expect(parseFloat(h.style.top)).toBe(0)
        expect(h.style.bottom).toBe('auto')
        expect(h.style.height).toBe('40px')
      }
    } finally {
      window.matchMedia = before
    }
  })

  it('the retainage pane has its own three heads — the gates, the § 53.056 claim, the paper — and its boxes lost their captions', async () => {
    const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: false, payment_bond: 'unknown', desk_item_id: null, desk_status: null }
    const d = data([], [], true)
    d.retainageRows = [retRow]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="retainage" />)
    await settle()
    const pane = document.querySelector<HTMLElement>('[data-lien-retainage-pane]')!
    const heads = [...pane.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
    expect(heads.map((h) => h.textContent)).toEqual([
      'Before it can go✗ 1 missing · owner of record missing',
      'The § 53.056 claimnot yet inside one · the owner withholds once the affidavit is filed',
      'The paper2 pages · cover letter + the form · § 53.057(a-2)',
    ])
    expect(heads.map((h) => [h.style.top, h.style.bottom])).toEqual([['0px', '48px'], ['24px', '24px'], ['48px', '0px']])
    expect(screen.queryByText(/Before this notice can go/)).toBeNull()
    expect(screen.queryByText(/Not yet inside a § 53\.056 claim/)).toBeNull()
    expect(pane.querySelector('[data-lien-pane-body="gates"] [data-lien-retainage-window]')!.textContent).toBe('§ 53.057 · 30 days from the day our contract on the job ended · complete Sep 3')
    expect(pane.querySelector('[data-lien-pane-body="claim"]')!.getAttribute('data-lien-retainage-in-claim')).toBe('no')
    expect(within(pane.querySelector<HTMLElement>('[data-lien-pane-body="claim"]')!).getByRole('button', { name: 'The monthly notices on this job ›' })).toBeTruthy()
    expect(within(pane.querySelector<HTMLElement>('[data-lien-pane-body="gates"]')!).getByRole('button', { name: 'Property record ›' })).toBeTruthy()
    expect(pane.querySelectorAll('[data-lien-pane-body="paper"] [data-theme="light"]').length).toBe(2)
    // The gates head is the one lit at the top; a press on the paper's head lights it.
    expect(heads.map((h) => h.getAttribute('data-on'))).toEqual(['yes', 'no', 'no'])
    fireEvent.click(heads[2]!.querySelector('button')!)
    expect(heads[2]!.getAttribute('data-on')).toBe('yes')
  })
})

describe('LienDesk · Lien affidavits and Retainage notices stack their pile titles like Monthly notices (the owner’s ask of 2026-11-15)', () => {
  const affRow = (partial: Partial<LienAffidavitRow> = {}): LienAffidavitRow => ({ job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null, ...partial })
  const retRow = (partial: Partial<LienRetainageRow> = {}): LienRetainageRow => ({ job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null, ...partial })
  const twoPiles = () => {
    const d = data([], [], true)
    d.jobsById.j651 = { ...d.jobsById.j650!, id: 'j651', hcp_number: '651', job_name: 'Palomino Trail' }
    d.affidavitRows = [affRow(), affRow({ job_id: 'j651', last_month: '2026-08', deadline: '2026-11-16', noticed: true, has_owner: true, has_legal: true, property_kind: 'non_residential', has_contractor_address: true })]
    d.affidavits = buildLienAffidavitQueue(d.affidavitRows, [], TODAY)
    d.retainageRows = [retRow({ contract_ended_on: null, contract_ended_how: null, deadline: null }), retRow({ job_id: 'j651' })]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    return d
  }
  const heads = () => [...document.querySelectorAll<HTMLElement>('[data-lien-pile-head]')]

  for (const [kind, listHook, first, second] of [
    ['affidavit', '[data-lien-affidavit-list]', 'needs_property', 'to_draft'],
    ['retainage', '[data-lien-retainage-list]', 'clock_not_started', 'to_draft'],
  ] as const) {
    it(`${kind}: one sticky title per pile with rows, its count at the right, stacked at both ends; a press on a later title scrolls to it and lights it`, async () => {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={twoPiles()} initialKind={kind} />)
      await settle()
      const list = document.querySelector(listHook) as HTMLElement & { scrollTo: (o: unknown) => void }
      expect(list.style.position).toBe('relative')
      expect(heads().map((h) => h.getAttribute('data-lien-pile-head'))).toEqual([first, second])
      for (const [i, h] of heads().entries()) {
        expect(h.className).toBe('lienPileHead')
        // 24 px a title since v2.7323 (30 when v2.7316 shipped): the owner's ask that the bars sit closer with the words as they are.
        expect(h.style.top).toBe(`${i * 24}px`)
        expect(h.style.bottom).toBe(`${(1 - i) * 24}px`)
        expect(h.style.height).toBe('24px')
        expect(h.querySelector(`[data-lien-pile-count="${h.getAttribute('data-lien-pile-head')}"]`)!.textContent).toBe('1')
      }
      // No flat caption is left over.
      expect(list.querySelectorAll('.lienPileHead').length).toBe(2)
      expect(list.querySelector(`[data-lien-pile-rows="${second}"]`)!.textContent).toContain('651 · Palomino Trail')
      expect(heads()[0]!.getAttribute('data-on')).toBe('yes')
      expect(heads()[1]!.getAttribute('data-on')).toBe('no')
      const scrollTo = vi.fn()
      list.scrollTo = scrollTo
      fireEvent.click(within(heads()[1]!).getByTitle('Go to this pile'))
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
      expect(heads()[1]!.getAttribute('data-on')).toBe('yes')
      expect(heads()[0]!.getAttribute('data-on')).toBe('no')
      // No pile is picked, so no title offers the way back.
      expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
    })

    it(`${kind}: a pile chip narrows the list to that pile's title and rows, the title offers every pile, and a find keeps every title with its count`, async () => {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={twoPiles()} initialKind={kind} />)
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'To send for Master approval · 1' }))
      expect(heads().map((h) => h.getAttribute('data-lien-pile-head'))).toEqual([second])
      expect(heads()[0]!.style.top).toBe('0px')
      expect(heads()[0]!.style.bottom).toBe('0px')
      expect(document.querySelector(`[data-lien-pile-rows="${first}"]`)).toBeNull()
      fireEvent.click(document.querySelector('[data-lien-pile-all]') as HTMLElement)
      expect(heads().map((h) => h.getAttribute('data-lien-pile-head'))).toEqual([first, second])
      // A find that empties a pile keeps its title, greyed, counting the matches of the pile's total.
      fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: '651' } })
      expect(heads().map((h) => h.getAttribute('data-lien-pile-head'))).toEqual([first, second])
      expect(heads()[0]!.getAttribute('data-empty')).toBe('yes')
      expect(heads()[0]!.querySelector('[data-lien-pile-count]')!.textContent).toBe('0 of 1')
      expect(heads()[1]!.getAttribute('data-empty')).toBeNull()
      expect(heads()[1]!.querySelector('[data-lien-pile-count]')!.textContent).toBe('1 of 1')
    })
  }

  it('on a phone each title pins alone at the top, a thumb tall, on both lists', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      for (const kind of ['affidavit', 'retainage'] as const) {
        const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={twoPiles()} initialKind={kind} layout="stacked" />)
        await settle()
        expect(heads()).toHaveLength(2)
        for (const h of heads()) {
          expect(h.style.top).toBe('0px')
          expect(h.style.bottom).toBe('auto')
          expect(h.style.height).toBe('40px')
          expect(h.style.fontSize).toBe('0.75rem')
        }
        view.unmount()
      }
    } finally {
      window.matchMedia = before
    }
  })
})

describe('LienDesk · serve the filed liens together (punch list #366)', () => {
  // Two filed affidavits that owe their copies. Every name here is made up.
  const filed = (id: string, job_id: string) => ({ id, job_id, kind: 'affidavit', months_covered: [], voided_at: null, filed_at: '2026-09-10', serve_due: '2026-09-15', served_at: null, county: 'Guadalupe', recording_number: `2026-${id}`, sends: [], fields: { ownerName: 'Elwick Holdings LLC', ownerAddress: '4 Example Way, Schertz, TX', propertyAddress: '1204 Elwick Rd, Schertz, TX', unpaidAmount: '33500.00', originalContractorName: 'Lowbeck Contracting', originalContractorAddress: '2904 Corporate Cr, Flower Mound, TX', isSub: true }, created_at: '2026-09-10T15:00:00Z' })
  const desk = (jobs: string[]) => {
    const d = data([], [], true)
    d.jobsById = Object.fromEntries(jobs.map((id, i) => [id, { ...d.jobsById.j650!, id, hcp_number: String(650 + i) }]))
    d.filingsByJob = Object.fromEntries(jobs.map((id) => [id, [filed(`f-${id}`, id)]])) as unknown as LienDeskData['filingsByJob']
    return d
  }
  const serveRows = () => screen.getAllByRole('button', { name: 'Print the copies to mail' })

  it('two filed liens: the list folds them into one row whose press opens one window that prints both and takes their mail numbers', async () => {
    const onOpenLienInstruments = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk(['j650', 'j651'])} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    // The Board: both stand in Filed · copies to mail, and the bin carries the same press.
    const bin = document.querySelector('[data-lien-board-bin="affidavit:filed"]') as HTMLElement
    expect(bin.querySelector('[data-lien-board-count]')!.textContent).toBe('2')
    expect(document.querySelector('[data-lien-board-bin="affidavit:served"] [data-lien-board-count]')!.textContent).toBe('0')
    expect(bin.querySelector('[data-lien-board-bin-press]')!.textContent).toBe('Print 2 liens’ copies ›')
    // The list: one row for the two, under the bin's own name.
    expect(screen.getByText('2 filed liens owe their copies')).toBeTruthy()
    const presses = screen.getAllByRole('button', { name: 'Print 2 liens’ copies ›' })
    expect(presses).toHaveLength(2)
    fireEvent.click(presses[presses.length - 1]!)
    const win = within(screen.getByTestId('lien-serve-window'))
    expect(win.getByText('2 filed liens owe their copies. The soonest is due Sep 15.')).toBeTruthy()
    expect(win.getByRole('button', { name: 'Print 2 liens’ copies' })).toBeTruthy()
    expect(win.getByRole('textbox', { name: 'Job 650, owner, certified mail number' })).toBeTruthy()
    expect(onOpenLienInstruments).not.toHaveBeenCalled()
    // The door said Print, so the window lands on its print half.
    expect(document.querySelector('[data-landed="yes"]')?.hasAttribute('data-lien-serve-print-part')).toBe(true)
  })

  // The owner's word of 2026-11-18: a door reads the stage the copies are at, and lands on that half (`lienServeStage.ts`).
  it('once both liens’ copies are printed, the bin’s press reads Enter mail numbers and opens the window on the numbers', async () => {
    const d = desk(['j650', 'j651'])
    d.servePrintedFilingIds = ['f-j650', 'f-j651']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const press = document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLElement
    expect(press.textContent).toBe('Enter mail numbers · 2 ›')
    expect(screen.queryByRole('button', { name: /^Print 2 liens’ copies ›$/ })).toBeNull()
    fireEvent.click(press)
    const lit = document.querySelector('[data-landed="yes"]') as HTMLElement
    expect(lit.textContent).toBe('2 · After the post office: enter mail numbers')
  })

  it('one printed, one not: the bin’s press names both halves with their counts and opens the window at its top', async () => {
    const d = desk(['j650', 'j651'])
    d.servePrintedFilingIds = ['f-j650']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const press = document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLElement
    expect(press.textContent).toBe('Print 1 · Enter mail numbers 1 ›')
    fireEvent.click(press)
    expect(screen.getByTestId('lien-serve-window')).toBeTruthy()
    expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(0)
  })

  it('one filed lien whose copies are printed: its row reads Enter mail numbers and opens the copies window at its own line', async () => {
    const onOpenLienInstruments = vi.fn()
    const d = desk(['j650'])
    d.servePrintedFilingIds = ['f-j650']
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    expect(screen.queryByRole('button', { name: 'Print the copies to mail' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Enter mail numbers' })[0]!)
    expect(screen.getByTestId('lien-serve-window')).toBeTruthy()
    expect(onOpenLienInstruments).not.toHaveBeenCalled()
    const lit = document.querySelector('[data-landed="yes"]') as HTMLElement
    expect(lit.getAttribute('data-lien-serve-envelope')).toBe('owner')
    expect(lit.closest('[data-lien-serve-job]')?.getAttribute('data-lien-serve-job')).toBe('j650')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Job 650, owner, certified mail number')
  })

  it('the bin’s own press on the Board opens the same window', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk(['j650', 'j651'])} initialKind="next" />)
    await settle()
    fireEvent.click(document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLElement)
    expect(screen.getByTestId('lien-serve-window')).toBeTruthy()
  })

  it('a reader outside the lien office gets no press on the bin', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="estimator" data={desk(['j650', 'j651'])} initialKind="next" />)
    await settle()
    expect(document.querySelector('[data-lien-board-bin-press]')).toBeNull()
  })

  it('one filed lien keeps its own Lien window', async () => {
    const onOpenLienInstruments = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk(['j650'])} initialKind="next" onOpenLienInstruments={onOpenLienInstruments} />)
    await settle()
    // The row says what is owed and by when: today is Sep 14 here and its day is Sep 15.
    expect(screen.getByText(/Lien filed · mail its copies by Sep 15/)).toBeTruthy()
    fireEvent.click(serveRows()[0]!)
    expect(screen.queryByTestId('lien-serve-window')).toBeNull()
    expect(onOpenLienInstruments).toHaveBeenCalledWith('j650')
  })
})

describe('LienDesk · add the stamped scans (punch list #366)', () => {
  // Two filed affidavits with no saved copy. Every name here is made up.
  const filed = (id: string, job_id: string, over: Record<string, unknown> = {}) => ({ id, job_id, kind: 'affidavit', months_covered: [], voided_at: null, filed_at: '2026-09-10', serve_due: '2026-09-15', served_at: null, county: 'Guadalupe', recording_number: `2026-00${id}`, sends: [], document_url: '', fields: { ownerName: 'Elwick Holdings LLC', ownerAddress: '4 Example Way, Schertz, TX', propertyAddress: '1204 Elwick Rd, Schertz, TX', unpaidAmount: '33500.00', isSub: false }, created_at: '2026-09-10T15:00:00Z', ...over })
  const desk = () => {
    const d = data([], [], true)
    d.jobsById = { j650: d.jobsById.j650!, j651: { ...d.jobsById.j650!, id: 'j651', hcp_number: '651' } }
    d.filingsByJob = { j650: [filed('71', 'j650')], j651: [filed('72', 'j651')] } as unknown as LienDeskData['filingsByJob']
    return d
  }

  it('the address door opens the window on every filed lien with no scan', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk()} initialKind="next" openScans={{ key: 1 }} />)
    await settle()
    const win = within(screen.getByTestId('lien-scan-batch-window'))
    expect(win.getByText('2 filed liens have no scan yet.')).toBeTruthy()
    expect(win.getByText('650 · AXO Schertz · no. 2026-0071')).toBeTruthy()
  })

  it('the window that mails the copies has a door to it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={desk()} initialKind="next" />)
    await settle()
    expect(screen.queryByTestId('lien-scan-batch-window')).toBeNull()
    fireEvent.click(document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLElement)
    fireEvent.click(within(screen.getByTestId('lien-serve-window')).getByRole('button', { name: 'Add the stamped scans ›' }))
    expect(screen.queryByTestId('lien-serve-window')).toBeNull()
    expect(screen.getByTestId('lien-scan-batch-window')).toBeTruthy()
  })
})

describe('LienDesk · a notice whose stored paper and bills have parted (v2.7520)', () => {
  // The paper as it was sent for approval, when the desk claimed the whole job: $51,000.00. The bills now owe $33,500.00.
  const stored = { noticeDate: '2026-08-01', projectDescription: 'AXO Schertz — 1204 Elwick Rd, Schertz, TX', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '51000.00', contactPerson: 'Sam Rowe, Master Plumber', claimantAddress: '' }
  const base = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-08-01T14:00:00Z', submitted_at: '2026-08-01T14:10:00Z', word_note: '', word_channel: '', hold_reason: '', hold_until: null, sent_at: null, held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, voided_at: null }
  const rows = J650.map((r) => ({ ...r, has_owner: true }))
  const fieldsOf = (claimAmount: string, noticeDate = '2026-08-01') => ({ notice: { ...stored, claimAmount, noticeDate }, gcEmail: '' })
  const approvedSigned = (fields: Record<string, unknown>, over: Record<string, unknown> = {}) =>
    ({ ...base, status: 'approved', approval_mode: 'leader', approved_by: 'u-sam', approved_at: '2026-09-12T15:00:00Z', fields, signed_by: 'u-sam', signed_at: '2026-09-12T15:00:00Z', signer_printed_name: 'Sam Rowe', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash(fields), ...over }) as unknown as LienDeskItemRow
  const awaiting = (fields: Record<string, unknown>) => ({ ...base, status: 'awaiting_approval', approval_mode: null, approved_by: null, approved_at: null, fields }) as unknown as LienDeskItemRow

  beforeEach(() => {
    redrawNoticeMock.mockClear()
    signMock.mockClear()
    redrawNoticeState.ok = true
  })

  it('a signed notice: the band says both figures and that the run holds it, and Redraw asks first, then writes today’s paper', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(rows, [approvedSigned(fieldsOf('51000.00'))], true)} initialJobId="j650" initialKind="notice" leaderNameFor={() => 'Sam Rowe'} />)
    await settle()
    const band = document.querySelector('[data-lien-desk-parted]') as HTMLElement
    expect(band.getAttribute('data-lien-desk-parted')).toBe('signed')
    expect(band.textContent).toContain('The signed paper and the bills no longer agree.')
    expect(band.textContent).toContain('The paper claims $51,000.00. The bills now come to $33,500.00, $17,500.00 less.')
    expect(band.textContent).toContain('The run holds it. Redraw it from the bills and Sam signs it again.')
    fireEvent.click(within(band).getByRole('button', { name: 'Redraw from the bills ▸' }))
    const confirm = await screen.findByRole('button', { name: 'Redraw the notice' })
    expect(document.body.textContent).toContain('Redraw this notice from the bills?')
    expect(document.body.textContent).toContain('The signature comes off, and Sam signs it again before it prints.')
    expect(redrawNoticeMock).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(redrawNoticeMock).toHaveBeenCalledTimes(1))
    const [itemId, fields] = redrawNoticeMock.mock.calls[0] as [string, { notice: Record<string, unknown>; gcEmail: string; redrawn: Record<string, unknown> }]
    expect(itemId).toBe('it1')
    expect(fields.notice.claimAmount).toBe('33500.00')
    expect(fields.notice.noticeDate).toBe(TODAY)
    // The wording and the other keys of the row stay.
    expect(fields.notice.contactPerson).toBe('Sam Rowe, Master Plumber')
    expect(fields.gcEmail).toBe('')
    expect(fields.redrawn).toMatchObject({ byName: 'Taunya', wasClaim: '51000.00', wasDate: '2026-08-01' })
  })

  it('a signed notice that agrees with the bills has no band, and keeps the date it was signed with', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(rows, [approvedSigned(fieldsOf('33500.00'))], true)} initialJobId="j650" initialKind="notice" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-parted]')).toBeNull()
    expect((document.querySelector('[data-lien-desk-paper] [data-field="noticeDate"]') as HTMLElement).textContent).toContain('August 1, 2026')
  })

  it('a printed notice says to check it and has no Redraw: it is taken back first', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(rows, [approvedSigned(fieldsOf('51000.00'), { printed_at: '2026-09-13T15:00:00Z' })], true)} initialJobId="j650" initialKind="notice" />)
    await settle()
    const band = document.querySelector('[data-lien-desk-parted]') as HTMLElement
    expect(band.getAttribute('data-lien-desk-parted')).toBe('printed')
    expect(band.textContent).toContain('Check it before it is mailed.')
    expect(within(band).queryByRole('button', { name: 'Redraw from the bills ▸' })).toBeNull()
  })

  it('the leader’s Sign and approve signs the paper the pane shows: the row is rewritten with today’s claim and date first, then signed', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-sam" authName="Sam Rowe" data={data(rows, [awaiting(fieldsOf('51000.00'))], true)} initialJobId="j650" initialKind="notice" leaderNameFor={() => 'Sam Rowe'} />)
    await settle()
    const band = document.querySelector('[data-lien-desk-parted]') as HTMLElement
    expect(band.getAttribute('data-lien-desk-parted')).toBe('unsigned')
    expect(band.textContent).toContain('This screen shows today’s figures. Sam signs those.')
    // The pane dates an unsigned paper today.
    expect((document.querySelector('[data-lien-desk-paper] [data-field="noticeDate"]') as HTMLElement).textContent).toContain('September 14, 2026')
    fireEvent.click(screen.getByRole('button', { name: /Sign and approve & next/ }))
    await waitFor(() => expect(signMock).toHaveBeenCalledTimes(1))
    expect(redrawNoticeMock).toHaveBeenCalledTimes(1)
    expect(redrawNoticeMock.mock.invocationCallOrder[0]!).toBeLessThan(signMock.mock.invocationCallOrder[0]!)
    const [, fields] = redrawNoticeMock.mock.calls[0] as [string, { notice: Record<string, unknown>; redrawn: Record<string, unknown> }]
    expect(fields.notice.claimAmount).toBe('33500.00')
    expect(fields.notice.noticeDate).toBe(TODAY)
    expect(fields.redrawn).toMatchObject({ wasClaim: '51000.00' })
  })

  it('a row that moved on is not signed: the press says so and nothing is placed', async () => {
    redrawNoticeState.ok = false
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-sam" authName="Sam Rowe" data={data(rows, [awaiting(fieldsOf('51000.00'))], true)} initialJobId="j650" initialKind="notice" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Sign and approve & next/ }))
    await waitFor(() => expect(redrawNoticeMock).toHaveBeenCalledTimes(1))
    await settle()
    expect(signMock).not.toHaveBeenCalled()
  })

  it('a paper already the one shown is signed as it stands: nothing is rewritten', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" authUserId="u-sam" authName="Sam Rowe" data={data(rows, [awaiting(fieldsOf('33500.00', TODAY))], true)} initialJobId="j650" initialKind="notice" signerNameFor={() => 'Sam Rowe, Master Plumber'} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-parted]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Sign and approve & next/ }))
    await waitFor(() => expect(signMock).toHaveBeenCalledTimes(1))
    expect(redrawNoticeMock).not.toHaveBeenCalled()
  })
})

describe('LienDesk — the last day of work, set from under the timeline’s LAST WORK stop (v2.7684)', () => {
  // A job with no clock hours: its months stand in from the job's creation, as the owner's screen read on 2026-11-17.
  const STAND_IN = [row('j650', '2026-07', '2026-10-15', { month_source: 'job_created' }), row('j650', '2026-08', '2026-11-16', { month_source: 'job_created' })]
  const standInData = (job: Record<string, unknown> = {}) => {
    const d = data(STAND_IN, [], true)
    d.jobsById.j650 = { ...d.jobsById.j650!, created_at: '2026-08-03T15:00:00Z', ...job } as LienDeskData['jobsById'][string]
    return d
  }

  it('the office presses set the day › under the stop, the window that sets the day opens in place, and the strip takes the new day', async () => {
    const onCalendarChanged = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={standInData()} initialKind="notice" initialJobId="j650" onCalendarChanged={onCalendarChanged} />)
    await settle()
    const stop = () => document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="last_work"]') as HTMLElement
    await waitFor(() => expect(stop()).toBeTruthy())
    expect(stop().textContent).toContain('Aug 2026')
    expect(stop().textContent).toContain('dated from the job’s creation · no clock hours')
    const door = stop().querySelector('[data-lien-timeline-last-work-door]') as HTMLButtonElement
    expect(door.textContent).toBe('set the day ›')
    expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
    fireEvent.click(door)
    // The same window the months' Change › line saves through. A stand-in is no day anyone said, so the window opens empty and asks for one, the day field in hand.
    const win = screen.getByTestId('lien-last-work-confirm')
    expect(win.textContent).toContain('650 · AXO Schertz')
    expect(win.getAttribute('data-verdict')).toBe('refused')
    expect(screen.getByTestId('lien-last-work-shift').textContent).toBe('Type a day.')
    expect(document.activeElement).toBe(within(win).getByLabelText('Last day of work'))
    expect((screen.getByTestId('lien-last-work-confirm-set') as HTMLButtonElement).disabled).toBe(true)
    // The line's own editor stayed shut: the press opened the window, not the line a screen below.
    expect(screen.queryByTestId('lien-last-work-editor')).toBeNull()
    const day = within(win).getByLabelText('Last day of work')
    fireEvent.change(day, { target: { value: '2026-07-24' } })
    fireEvent.blur(day)
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).not.toBe('refused')
    // The reason is asked, as everywhere the day is set: no reason, no save.
    expect((screen.getByTestId('lien-last-work-confirm-set') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'The crew’s last trip, by the daily log' } })
    fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
    await waitFor(() => expect(onCalendarChanged).toHaveBeenCalledWith('last_work'))
    await waitFor(() => expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull())
    // The page re-reads: the job carries the hand day and its month is the month of that day.
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={(() => { const d = data([row('j650', '2026-07', '2026-10-15', { month_source: 'hand' })], [], true); d.jobsById.j650 = { ...d.jobsById.j650!, created_at: '2026-08-03T15:00:00Z', lien_last_work_on: '2026-07-24' } as LienDeskData['jobsById'][string]; return d })()} initialKind="notice" initialJobId="j650" onCalendarChanged={onCalendarChanged} />)
    await settle()
    await waitFor(() => expect(stop().textContent).toContain('Jul 2026'))
    expect(stop().textContent).toContain('last day set by hand')
    expect(stop().querySelector('[data-lien-timeline-last-work-door]')?.textContent).toBe('change ›')
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Jul 24')
  })

  it('closing the window writes nothing, and a person who cannot change the day sees the stop’s words and no press', async () => {
    const onCalendarChanged = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={standInData()} initialKind="notice" initialJobId="j650" onCalendarChanged={onCalendarChanged} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-last-work-door]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-last-work-door]') as HTMLButtonElement)
    fireEvent.click(within(screen.getByTestId('lien-last-work-confirm')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
    expect(onCalendarChanged).not.toHaveBeenCalled()
    view.unmount()
    renderWithProviders(<LienDesk {...baseProps} authRole="estimator" data={standInData()} initialKind="notice" initialJobId="j650" />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="last_work"]')).toBeTruthy())
    expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="last_work"]')?.textContent).toContain('dated from the job’s creation')
    expect(document.querySelector('[data-lien-timeline-last-work-door]')).toBeNull()
  })

  it('a day set by hand comes off the desk’s read with its reason and its time: the months’ line shows both, and the press under the stop opens the window on that reason (v2.7741)', async () => {
    // The job as the desk's read hands it back: the row jobs_ledger holds, cut to the columns the read names.
    // An embed (`alias:table(...)`) comes back under its alias. Until v2.7741 the read named the day and not its reason, time or who.
    const readNames = new Set(LIEN_DESK_JOB_COLUMNS.split(/,(?![^(]*\))/).map((c) => c.trim().replace(/[:(].*$/, '')))
    const asRead = (stored: Record<string, unknown>) => Object.fromEntries(Object.entries(stored).filter(([name]) => readNames.has(name))) as LienDeskData['jobsById'][string]
    const WHY = 'The crew’s last trip, by the daily log'
    const d = data([row('j650', '2026-07', '2026-10-15', { month_source: 'hand' })], [], true)
    d.jobsById.j650 = asRead({ ...d.jobsById.j650!, created_at: '2026-08-03T15:00:00Z', lien_last_work_on: '2026-07-24', lien_last_work_note: WHY, lien_last_work_set_at: '2026-09-10T18:00:00Z', lien_last_work_set_by: 'u-taunya', a_column_the_read_does_not_name: 'dropped' })
    // The cut is a real one: a column the read does not name is gone, and the job is still the job.
    expect(d.jobsById.j650).not.toHaveProperty('a_column_the_read_does_not_name')
    expect(d.jobsById.j650).toMatchObject({ id: 'j650', hcp_number: '650', job_name: 'AXO Schertz' })
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="notice" initialJobId="j650" />)
    await settle()
    // The months' line: the day, the chip that says a person set it and on which day, and the reason in quotes, as the Lien window reads them.
    await waitFor(() => expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Jul 24'))
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('hand')
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('set by hand · Sep 10')
    expect(screen.getByTestId('lien-last-work-note').textContent).toBe(`“${WHY}”`)
    // The press under LAST WORK: the window opens on the day the job reads and on the reason already stored, not on an empty one.
    const door = document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-last-work-door]') as HTMLButtonElement
    expect(door.textContent).toBe('change ›')
    fireEvent.click(door)
    const win = screen.getByTestId('lien-last-work-confirm')
    expect((within(win).getByLabelText('Last day of work') as HTMLInputElement).value).toBe('2026-07-24')
    expect((within(win).getByLabelText('Why the last day is set by hand') as HTMLTextAreaElement).value).toBe(WHY)
  })

  it('the affidavit pane’s strip carries the press too, and a save re-reads the lien clocks', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-08', deadline: '2026-11-16', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([], [], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.jobsById.j650 = { ...d.jobsById.j650!, last_work_date: '2026-08-20' } as LienDeskData['jobsById'][string]
    const onCalendarChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="controller" data={d} initialKind="affidavit" onCalendarChanged={onCalendarChanged} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-lien-affidavit-pane] [data-lien-timeline-last-work-door]')).toBeTruthy())
    const door = document.querySelector('[data-lien-affidavit-pane] [data-lien-timeline-last-work-door]') as HTMLButtonElement
    // Clock hours behind the month: the day is there to change.
    expect(door.textContent).toBe('change ›')
    fireEvent.click(door)
    const win = screen.getByTestId('lien-last-work-confirm')
    expect(win.textContent).toContain('650 · AXO Schertz')
    const day = within(win).getByLabelText('Last day of work')
    // Over clock hours the window opens on the day the job reads.
    expect((day as HTMLInputElement).value).toBe('2026-08-20')
    fireEvent.change(day, { target: { value: '2026-09-02' } })
    fireEvent.blur(day)
    fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'Final walk with the superintendent' } })
    fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
    await waitFor(() => expect(onCalendarChanged).toHaveBeenCalledWith('last_work'))
    await waitFor(() => expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull())
  })
})

describe('LienDesk — the closed end on the Board (the owner’s pick of 2026-11-18)', () => {
  // A made-up approved affidavit whose day passed four days before TODAY with nothing filed.
  const lateRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-10', is_sub: true, noticed: true, filed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: true, has_legal: true, homestead: false, desk_item_id: 'it-a', desk_status: 'approved' }
  const lateItem = { id: 'it-a', job_id: 'j650', kind: 'affidavit', months: [], status: 'approved', fields: {}, created_at: '2026-09-01T14:00:00Z', voided_at: null, sent_at: null } as unknown as LienDeskItemRow
  const withLate = () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [], true)
    d.affidavitRows = [lateRow]
    d.affidavits = buildLienAffidavitQueue([lateRow], [lateItem], TODAY)
    return d
  }
  const closedChip = () => document.querySelector('[data-lien-board-chips="affidavit:missed"] [data-lien-board-chip="j650"]') as HTMLButtonElement

  it('an approved affidavit past its day stands in Lien day passed, not in Ready to file, and the print does not count it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withLate()} initialKind="next" />)
    await settle()
    const bin = document.querySelector('[data-lien-board-bin="affidavit:missed"]') as HTMLElement
    expect(bin.closest('[data-lien-board-closed]')!.getAttribute('data-lien-board-closed')).toBe('affidavit')
    expect(bin.textContent).toContain('Lien day passed · not filed')
    expect(closedChip().getAttribute('data-closed')).toBe('yes')
    expect(document.querySelector('[data-lien-board-chips="affidavit:ready"] [data-lien-board-chip]')).toBeNull()
    expect(document.querySelector('[data-lien-board-print-press="print_affidavits"]')).toBeNull()
    expect(document.querySelector('[data-lien-board-closed-press="affidavit:missed"]')!.textContent).toBe('Answer 1 ›')
  })

  it('the chip and the bin’s press open the window, and its date door goes to the last day of work', async () => {
    const onOpenCalendarLastWork = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withLate()} initialKind="next" onOpenCalendarLastWork={onOpenCalendarLastWork} />)
    await settle()
    expect(closedChip().getAttribute('aria-label')).toContain('See what closed and answer it')
    fireEvent.click(closedChip())
    const win = await screen.findByTestId('lien-closed-window')
    expect(win.getAttribute('aria-label')).toBe('The lien day has passed')
    expect(win.getAttribute('data-lien-closed-job')).toBe('j650')
    expect(win.querySelector('[data-lien-closed-sub]')!.textContent).toContain('$33,500 unpaid')
    expect(win.querySelector('[data-lien-closed-what]')!.textContent).toBe('The last day to file a lien on this job was Thursday, Sep 10.')
    // One paper in the bin: nothing to walk.
    expect(win.querySelector('[data-lien-closed-walk]')).toBeNull()
    fireEvent.click(win.querySelector('[data-lien-closed-press="date"]') as HTMLButtonElement)
    expect(onOpenCalendarLastWork).toHaveBeenCalledWith('j650')
    await waitFor(() => expect(screen.queryByTestId('lien-closed-window')).toBeNull())
    fireEvent.click(document.querySelector('[data-lien-board-closed-press="affidavit:missed"]') as HTMLButtonElement)
    expect((await screen.findByTestId('lien-closed-window')).getAttribute('data-lien-closed-kind')).toBe('gone')
  })

  it('a viewer with no door to the last day of work reads the date answer dead', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withLate()} initialKind="next" />)
    await settle()
    fireEvent.click(closedChip())
    const win = await screen.findByTestId('lien-closed-window')
    expect((win.querySelector('[data-lien-closed-press="date"]') as HTMLButtonElement).disabled).toBe(true)
    expect((win.querySelector('[data-lien-closed-press="keep"]') as HTMLButtonElement).disabled).toBe(false)
  })
})
