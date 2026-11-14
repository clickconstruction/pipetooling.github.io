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
import type { LienDeskData } from '../../hooks/useLienDeskData'
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
const clearPrintedMock = vi.fn()
const saveDraftMock = vi.fn(async () => 'it-new')
const redrawOneMock = vi.fn(async (..._args: unknown[]) => undefined)
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
const submitMock = vi.fn(async () => undefined)
const tellLeaderMock = vi.fn(async () => ({ pushSent: 1, emailSent: false, leaderName: 'Malachi Whites' }))
// An affidavit sent for approval tells the leader too (punch list #305, v2.7180): one call for every paper of one press.
const tellAffMock = vi.fn(async (_papers: Array<{ itemId: string; dueYmd: string | null }>): Promise<{ ok: true; told: { pushSent: number; emailSent: boolean; leaderName: string | null } } | { ok: false; reason: string }> => ({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi Whites' } }))
vi.mock('../../lib/jobs/lienDeskIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/lienDeskIo')>('../../lib/jobs/lienDeskIo')
  return { ...actual, redrawLienAffidavitShort: (...args: unknown[]) => redrawOneMock(...args), redrawLienAffidavitsShort: (papers: Array<{ jobId: string }>, userId: unknown) => redrawManyMock(papers, userId), submitLienAffidavits: (papers: Array<{ jobId: string; itemId: string; outcome: { status: string } }>) => submitManyMock(papers), saveLienDeskDraft: (...args: unknown[]) => saveDraftMock(...(args as [])), submitLienDeskItem: (...args: unknown[]) => submitMock(...(args as [])), tellLeaderOfLienApproval: (...args: unknown[]) => tellLeaderMock(...(args as [])), tellLeaderOfLienAffidavits: (papers: Array<{ itemId: string; dueYmd: string | null }>) => tellAffMock(papers), clearLienDeskItemPrinted: (id: string) => clearPrintedMock(id), startLetterTwo: (input: unknown) => startTwoMock(input), noteGcAuthorizedDirectPay: (...args: unknown[]) => gcOkayMock(...args), noteOwnerCall: (...args: unknown[]) => ownerCallMock(...args), notePromiseOnNotice: (...args: unknown[]) => promiseMock(...args) }
})
const codeState = { status: { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null } as { set: boolean; setAtIso: string | null; lastUsedAtIso: string | null; lockedUntilIso: string | null } | null, signs: [] as Array<Record<string, unknown>>, answer: { ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Malachi' } as Record<string, unknown> }
vi.mock('../../lib/jobs/lienDeskSignIo', async () => ({
  ...(await vi.importActual<typeof import('../../lib/jobs/lienDeskSignIo')>('../../lib/jobs/lienDeskSignIo')),
  signLienDeskItem: async ({ itemId, approve, signer, onDevice, payload }: { itemId: string; approve: boolean; signer: unknown; onDevice: unknown; payload: unknown }) => {
    signMock(itemId, approve, signer, onDevice, payload)
    return { ok: true, signedAtIso: '2026-10-09T19:14:00Z' }
  },
  lienSignCodeStatus: async () => codeState.status,
  signLienDeskItemWithCode: async (args: Record<string, unknown>) => {
    codeState.signs.push(args)
    return codeState.answer
  },
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
    affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
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
    gcsHeldBefore: new Set(), claimCorrectionsByJob: {}, filingsByJob: {},
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
    expect(card.textContent).toContain('Record the mailing')
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

  it('the title bar has the door for an owner who asks for our records, for the office and only when the desk is given one (v2.4544)', async () => {
    const onOpenOwnerRecords = vi.fn()
    const view = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    const door = screen.getByTestId('lien-owner-records-door')
    // Since v2.6569 the door leads the tool row, the title bar's steady second line on a computer, just before § Rules and Share (v2.4786 had it on the title line).
    const right = door.closest('[data-lien-desk-right]') as HTMLElement
    expect(right).toBeTruthy()
    expect(right.querySelector('[data-lien-desk-share]')).toBeTruthy()
    expect(right.querySelector('[data-testid="lien-rules-door"]')).toBeTruthy()
    expect(door.textContent).toBe('An owner asked for records ›')
    fireEvent.click(door)
    expect(onOpenOwnerRecords).toHaveBeenCalledTimes(1)
    view.unmount()
    // On By date too (v2.6569): the tool row under the title line, with the break before it, the same shape as on By paper.
    const deadlines = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="calendar" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    const up = screen.getByTestId('lien-owner-records-door')
    expect(up.closest('[data-lien-desk-right]')).toBeTruthy()
    expect(up.closest('[data-lien-desk-right]')!.querySelector('[data-lien-desk-share]')).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-header-break]')).not.toBeNull()
    // The run stays on the title line after the views; the break comes after it.
    const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
    const order = Array.from(bar.children).map((el) => (el.hasAttribute('data-lien-desk-kinds') ? 'views' : el.hasAttribute('data-lien-desk-header-break') ? 'break' : el.hasAttribute('data-lien-desk-right') ? 'tools' : el.hasAttribute('data-lien-desk-run') ? 'run' : null)).filter(Boolean)
    expect(order).toEqual(['views', 'break', 'tools'])
    deadlines.unmount()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
  })

  it('in a window of 1,500 px or more the tools end the title line, and only By paper keeps a second line (v2.7213)', async () => {
    const before = window.matchMedia
    // A wide computer: the one-line query matches, the phone's does not.
    window.matchMedia = ((query: string) => ({ matches: query === '(min-width: 1500px)', media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    const shape = () => {
      const bar = document.querySelector('.lienDeskTitleBar') as HTMLElement
      return Array.from(bar.children).map((el) => (el.hasAttribute('data-lien-desk-kinds') ? 'views' : el.hasAttribute('data-lien-desk-run') ? 'run' : el.hasAttribute('data-lien-desk-tools') ? 'tools' : el.hasAttribute('data-lien-desk-header-break') ? 'break' : el.hasAttribute('data-lien-desk-paper-kinds') ? 'papers' : el.hasAttribute('data-lien-desk-right') ? 'right' : null)).filter(Boolean)
    }
    try {
      const onOpenOwnerRecords = vi.fn()
      // Deadlines, the owner's screenshot: one line, the five tools at its end in their order, no break and no empty span after them.
      const deadlines = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="calendar" onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      const tools = document.querySelector('[data-lien-desk-tools]') as HTMLElement
      expect(tools.style.marginLeft).toBe('auto')
      const names = Array.from(tools.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent)
      expect(names).toEqual(['An owner asked for records ›', '§ Rules', 'An owner is calling', 'What this desk holds', 'Share'])
      expect(document.querySelector('[data-lien-desk-right]')).toBeNull()
      fireEvent.click(screen.getByTestId('lien-owner-records-door'))
      expect(onOpenOwnerRecords).toHaveBeenCalledTimes(1)
      // Share still opens from the title line.
      fireEvent.click(document.querySelector('[data-lien-desk-share]') as HTMLElement)
      expect(screen.getByRole('dialog', { name: 'Share where the liens stand' })).toBeTruthy()
      deadlines.unmount()
      // To do: the same line.
      const now = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      now.unmount()
      // By paper: the tools stay on the title line, before the break; the paper tabs lead the second line.
      const affidavits = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" onOpenOwnerRecords={onOpenOwnerRecords} />)
      await settle()
      expect(shape()).toEqual(['views', 'tools', 'break', 'papers'])
      affidavits.unmount()
      // The leader has no owner-records door and no caller's door: § Rules, ? and Share end his title line.
      renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650)} initialKind="calendar" />)
      await settle()
      expect(shape()).toEqual(['views', 'tools'])
      expect(document.querySelector('[data-lien-desk-tools] [data-testid="lien-rules-door"]')).toBeTruthy()
      expect(document.querySelector('[data-lien-desk-tools] [data-lien-desk-share]')).toBeTruthy()
      expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
    } finally {
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

  it("on Affidavits, a stop's title opens the window with this pane's affidavit and the Lien window door (v2.4793)", async () => {
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
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open it on Notices ›')
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('a printed notice has a footer: the run to record the mailing, and Back to ready; the header counts it (v2.4568)', async () => {
    clearPrintedMock.mockReset()
    clearPrintedMock.mockResolvedValue(undefined)
    const printed = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z',
    } as unknown as LienDeskItemRow
    const onChanged = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [printed], true)} initialJobId="j650" initialKind="notice" onChanged={onChanged} />)
    await settle()
    // Nothing is Ready to send, one is printed: the header still offers the run, counting what the run lists —
    // and says what the run will do (v2.4823), as the printed footer does, instead of Send the run.
    expect(screen.getByRole('button', { name: 'Record the mailing · 1' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Send the run/ })).toBeNull()
    // v2.4740: the run sits on the title line, right after the views; on By paper the paper tabs lead the second line.
    expect(document.querySelector('[data-lien-desk-kinds]')!.nextElementSibling!.hasAttribute('data-lien-desk-run')).toBe(true)
    expect(document.querySelector('[data-lien-desk-header-break]')!.nextElementSibling!.hasAttribute('data-lien-desk-paper-kinds')).toBe(true)
    const footer = document.querySelector('[data-lien-desk-printed-footer]') as HTMLElement
    // v2.4855: the state is a chip with the day; the old sentence is its hover.
    const chip = footer.querySelector('.lienFootChip') as HTMLElement
    expect(chip.textContent).toContain('Printed Sep 14 · in the mail')
    expect(chip.title).toContain('Printed September 14, 2026 · in the mail.')
    expect(footer.querySelectorAll('.lienFootLink').length).toBe(2)
    expect(within(footer).getByRole('button', { name: /Record the mailing · 1/ })).toBeTruthy()
    fireEvent.click(within(footer).getByRole('button', { name: 'Back to ready' }))
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
    expect(screen.getByTestId('lien-step-count-notice-4').textContent).toBe('2 printed')
    fireEvent.click(within(run).getByRole('button', { name: 'Take back…' }))
    await settle()
    expect(screen.getByTestId('run-take-back-confirm').textContent).toContain('Take back the run?')
  })

  it('the office: a notice waiting on the leader closes To do under his name and leaves the tab’s count (punch list #101 PR 3)', async () => {
    const awaiting = { id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-07'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-12T14:00:00Z', submitted_at: '2026-09-12T14:12:00Z' } as unknown as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650, [awaiting], true)} initialKind="next" leaderNameFor={() => 'Sam'} />)
    await settle()
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Waiting on Sam · 1'])
    expect((document.querySelector('[data-lien-next-up-row="notice:j650"]') as HTMLElement).textContent).toContain('Waiting on Sam · since Sep 12')
    expect(screen.getByRole('tab', { name: /^To do/ }).textContent).toBe('To do · 0')
  })

  it('To do on a computer pins the month and scrolls the list; stacked, the month and the list scroll as one page and a pressed zone brings its rows up (punch list #352, PR 0)', async () => {
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
      // Opening the desk brings no rows up (the view tabs bring their own picked tab into view); a pressed zone does.
      const rowsBrought = () => brought.filter((el) => el.matches('[data-lien-next-up-group], [data-lien-next-up="empty"]'))
      expect(rowsBrought()).toHaveLength(0)
      const zone = frame().querySelector('[data-testid="lien-month-bar"] button[data-testid^="lien-month-zone-"]') as HTMLButtonElement
      fireEvent.click(zone)
      await settle()
      expect(rowsBrought()).toHaveLength(1)
      expect(frame().contains(rowsBrought()[0]!)).toBe(true)
    } finally {
      Element.prototype.scrollIntoView = before
    }
  })

  it('To do is the first tab (punch list #82; Next up until v2.4630): its count, and a row\u2019s button opens the Notices pane on that job and pile', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs[0]).toBe('To do · 1')
    expect(screen.getByRole('tab', { name: 'To do · 1' }).getAttribute('aria-selected')).toBe('true')
    // J650 has no owner on file: its one move is Find the owner.
    const row = document.querySelector('[data-lien-next-up-row="notice:j650"]') as HTMLElement
    expect(row.textContent).toContain('650 · AXO Schertz')
    fireEvent.click(within(row).getByRole('button', { name: 'Find the owner' }))
    await settle()
    expect(screen.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-lien-next-up="list"]')).toBeNull()
  })

  it('a Docsmit envelope that came back is a To do row opening the notice under Sent, whose head has the Deliveries filter and whose footer has the cost (the Docsmit train, 6b-2)', async () => {
    const sent = { id: 'r2', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'sent', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: 'f1', sent_at: '2026-09-14T16:00:00Z', printed_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T16:00:00Z', voided_at: null } as unknown as LienDeskItemRow
    // Every month noticed (v2.6624): a job with a month still due sits in To draft now, and this test is about the Sent pile's filter.
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sent], true)
    d.filingsByJob = { j650: [{ id: 'f1', job_id: 'j650', kind: 'notice', sends: [], voided_at: null } as never] }
    d.mailPiecesByFiling = { f1: [{ id: 'p2', kind: 'lien_notice_53_056', recipient: 'original_contractor', status: 'returned', usps_tracking: '9407 1118', mailed_at: '2026-09-15T00:30:00Z', delivered_at: null, signed_by: null, delivery_status: 'Return to Sender', source_ids: ['f1'], price: 9.85 }] }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="next" />)
    await settle()
    const row = document.querySelector('[data-lien-next-up-row="mail:p2"]') as HTMLElement
    expect(row.textContent).toContain('Docsmit · original contractor · returned to sender')
    fireEvent.click(within(row).getByRole('button', { name: 'Open the notice' }))
    await settle()
    expect(screen.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
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
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    // A re-render with the same aim changes nothing.
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    view.rerender(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={2} />)
    await settle()
    expect(screen.getByRole('tab', { name: 'By date' }).getAttribute('aria-selected')).toBe('true')
  })

  it('three views (punch list #82, PR 5; renamed v2.4630): To do, By date, By paper; By paper holds Notices, Affidavits, Retainage and Timeline and reopens on the last one', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const views = () => within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab').map((t) => t.textContent)
    expect(views()).toEqual(['To do · 1', 'By date', 'By paper'])
    // On To do and on By date the four lists are not drawn.
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    await settle()
    const paper = within(screen.getByRole('tablist', { name: 'Kind of paper' }))
    expect(paper.getAllByRole('tab').map((t) => t.textContent?.replace(/ · \d+$/, ''))).toEqual(['Notices', 'Affidavits', 'Retainage', 'Timeline'])
    expect(paper.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'By paper' }).getAttribute('aria-selected')).toBe('true')
    // Retainage keeps its named place; leaving and coming back lands on it again.
    fireEvent.click(paper.getByRole('tab', { name: /^Retainage/ }))
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await settle()
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('a door that names a kind still lands on its list, inside By paper (punch list #82, PR 5)', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" />)
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Affidavits/ }).getAttribute('aria-selected')).toBe('true')
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
    fireEvent.click(screen.getByRole('button', { name: 'Find the owner ›' }))
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
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(screen.getByRole('button', { name: /Go to gate 1/ })).toBeTruthy()
    // Months: all three open windows ticked by default; the document names them.
    const boxes = screen.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)
    expect(boxes.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/Work months June, July and August 2026/)).toBeTruthy()
    // the form's title — counsel's commercial letter on page 1 names it too (v2.3828), so there are two
    expect(screen.getAllByText(/Notice of Claim for Unpaid Labor or Materials/).length).toBeGreaterThanOrEqual(1)
    // Blocked (v2.3776): no routing news about a send that cannot happen yet — the row is the gate and its door.
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).not.toContain('first notice')
  })

  it('with the owner on file the office can send for approval or record the leader’s spoken word', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    // The passing gate is a chip; the whole sentence rides in its tooltip (v2.3522).
    expect(screen.getByTitle(/Owner of record with a mailing address — Elwick Holdings LLC/)).toBeTruthy()
    expect((document.querySelector('[data-gate="owner"]') as HTMLElement).textContent).toBe('1Owner of record✓ Elwick Holdings LLC')
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Goes to the leader · first notice we've sent this GC")
    fireEvent.click(screen.getByRole('button', { name: /The leader said to send it/ }))
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByText('by phone')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve on his word/ })).toBeTruthy()
  })

  it('a phone\u2019s header is one row with More; the doors it held are rows of the sheet and open what they open on a computer (punch list #352, PR 1)', { timeout: 30000 }, async () => {
    // A computer keeps its header: the doors are in the bar and there is no More.
    const onOpenOwnerRecords = vi.fn()
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-more="door"]')).toBeNull()
    expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
    expect(screen.getByTestId('lien-owner-records-door')).toBeTruthy()
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
      // None of the doors is in the bar any more.
      expect(within(bar).queryByTestId('lien-rules-door')).toBeNull()
      expect(within(bar).queryByTestId('lien-owner-records-door')).toBeNull()
      expect(bar.querySelector('[data-lien-desk-share]')).toBeNull()
      expect(bar.querySelector('[data-lien-caller-door]')).toBeNull()
      expect(bar.querySelector('[data-lien-desk-run]')).toBeNull()
      // The three views are a thumb tall and share the width.
      for (const tab of bar.querySelectorAll('[data-lien-desk-view]')) expect((tab as HTMLElement).style.minHeight).toBe('44px')

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

  it('on a phone the lien month is one line and the step rails one folded row; a computer keeps the bar and the rails (punch list #352, PR 2)', async () => {
    const desk = renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    expect(screen.getByTestId('lien-month-bar').getAttribute('data-layout')).toBeNull()
    expect(screen.queryByTestId('lien-month-line')).toBeNull()
    expect(document.querySelectorAll('[data-testid^="lien-month-zone-"][data-state]')).toHaveLength(5)
    expect(screen.queryByTestId('lien-step-rails-fold')).toBeNull()
    expect(screen.getByTestId('lien-step-rails').getAttribute('data-folded')).toBeNull()
    desk.unmount()

    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" layout="stacked" />)
      await settle()
      expect(screen.getByTestId('lien-month-bar').getAttribute('data-layout')).toBe('line')
      const line = screen.getByTestId('lien-month-line')
      expect(screen.getByTestId('lien-month-line-head').textContent!.length).toBeGreaterThan(0)
      // No zone card is drawn until the line is pressed; then all five are, in a sheet.
      expect(document.querySelectorAll('[data-testid^="lien-month-zone-"][data-state]')).toHaveLength(0)
      expect(screen.getByTestId('lien-step-rails').getAttribute('data-folded')).toBe('yes')
      fireEvent.click(line)
      const sheet = screen.getByRole('dialog', { name: 'The lien month' })
      expect(sheet.querySelectorAll('[data-testid^="lien-month-zone-"][data-state]')).toHaveLength(5)
    } finally {
      window.matchMedia = before
    }
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
    fireEvent.click(screen.getByRole('button', { name: /Send for approval/ }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(submitMock.mock.calls[0]).toEqual(['it-new', { status: 'awaiting_approval', reason: 'first_notice' }])
    await waitFor(() => expect(tellLeaderMock).toHaveBeenCalledWith('it-new', '2026-09-15'))
    expect(await screen.findByText("Sent for approval. Malachi's phone has it.")).toBeTruthy()
  })

  it('a "send" rule with no notice recorded to the GC still sends the first one to the leader (v2.3469)', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    const lowbeck = { id: 'lowbeck', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@lowbeck.test', policy: 'send' as const, policyNote: '' }
    const withRule: LienDeskData = { ...d, gcsById: { lowbeck }, queue: buildLienDeskQueue(d.rows, d.items, { lowbeck: 'send' }, TODAY) }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={withRule} />)
    await settle()
    expect(screen.getByRole('button', { name: /Send for approval/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Put it in the run/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Goes to the leader · first notice to this GC — the rule starts with the next one')
  })

  it('the leader sees what he is deciding, the standing rule, and Approve & next / Hold on an awaiting item', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /Awaiting approval/ }).textContent).toContain('1')
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
    const wideHeads = [...document.querySelectorAll<HTMLElement>('[data-lien-pane-head]')]
    expect(wideHeads.length).toBeGreaterThan(1)
    expect(wideHeads.map((h) => parseFloat(h.style.top))).toEqual(wideHeads.map((_, i) => i * 30))
    expect(wideHeads.every((h) => h.style.height === '')).toBe(true)
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
    expect(screen.getByRole('button', { name: 'Find the owner ›' })).toBeTruthy()
    // Still blocked until Use — the roll's answer is a proposal, not the record.
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(screen.getByRole('button', { name: /Go to gate 1/ })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('public')
    expect(screen.getAllByText(/a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond/).length).toBeGreaterThanOrEqual(2)
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Don't send yet. This is public property, so no lien notice can go.")
    expect(screen.getByRole('button', { name: /Go to gate 1/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /The leader said to send it/ })).toBeNull()
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
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
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
    expect(screen.getByRole('tab', { name: /Affidavits · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Needs the property facts/ }).textContent).toContain('1')
    expect(screen.getByText(/missing owner, legal, notice/)).toBeTruthy()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    // v2.7187: the desk's own timeline names the step the paper is on, as its To do row does (*the property record is not complete*).
    expect(timeline.textContent).toContain('Fix the property record, then file the affidavit — tomorrow · owner of record, legal description, the notice missing.')
    expect(timeline.textContent).toContain('the property record to be completed')
    // The kind is not set: the timeline says residential dates are shown, the earlier ones (v2.5031).
    expect(timeline.textContent).toContain('Property kind not set: residential dates shown, the earlier ones. Commercial would be a month later.')
    expect(screen.getByText(/Before this affidavit can be generated/)).toBeTruthy()
    // v2.4724: the door opens the property record in a window over the desk, not Edit Job.
    fireEvent.click(screen.getAllByRole('button', { name: 'Fill in the record ›' })[0]!)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect(onOpenEditJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    expect(screen.getByRole('button', { name: 'Send the notice first ›' })).toBeTruthy()
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
    expect(card.textContent).toContain('Months the affidavit claims')
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
    expect(document.body.textContent).toContain('missing the homestead answer')
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The hold changes the pile, never the words: the paper is the same short form, with no homestead notice on it.
    expect(paper().getAttribute('data-lien-affidavit-paper')).toBe('short')
    expect(paper().querySelector('[data-top-notice]')).toBeNull()
    const door = document.querySelector('[data-lien-affidavit-homestead-door]') as HTMLElement
    expect(door.textContent).toBe('Answer it ›')
    fireEvent.click(door)
    await settle()
    const question = document.querySelector('[data-homestead-question]') as HTMLElement
    expect(question.getAttribute('data-homestead-question')).toBe('unanswered')
    expect(question.textContent).toContain("Is this the owner's homestead?")
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
    expect(document.body.textContent).toContain('missing a private owner')
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The paper names the owner, never the attention line.
    expect(paper().textContent).toContain('The owner or reputed owner is SAMPLE CITY OF')
    expect(paper().textContent).not.toContain('ATTN REAL ESTATE MANAGER')
    expect(screen.queryByRole('button', { name: 'Fill in the record ›' })).toBeNull()
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
    expect(document.body.textContent).toContain("missing the GC's address")
    expect(document.body.textContent).toContain('Blocked until every gate above is clear.')
    // The hold changes the pile, never the words: the paper still names the GC, with a blank where its address goes.
    expect(paper().textContent).toContain('Claimant did so under a contract with Lowbeck Contracting')
    fireEvent.click(document.querySelector('[data-lien-affidavit-contractor-door]') as HTMLElement)
    expect(onOpenCustomerRecord).toHaveBeenCalledWith('lowbeck')
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
    expect(screen.getByText('Each affidavit goes back to To draft on the short form. Each needs approval again before it is filed.')).toBeTruthy()
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
    expect(bar.querySelector('[data-lien-affidavit-send-all-foot]')?.textContent).toBe('1 in To draft has no draft yet. Draft it from its own paper.')
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
    fireEvent.click(screen.getByRole('button', { name: 'Send for approval ▸' }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect((submitMock.mock.calls[0] as unknown as [string, { status: string }])[1].status).toBe('awaiting_approval')
    await waitFor(() => expect(tellAffMock).toHaveBeenCalledTimes(1))
    expect(tellAffMock.mock.calls[0]![0]).toEqual([{ itemId: 'it-new', dueYmd: '2026-11-16' }])
    expect(await screen.findByText("Sent for approval. Malachi's phone has it.")).toBeTruthy()
  })

  it('the pane’s send that a standing rule approves tells nobody', async () => {
    submitMock.mockClear()
    tellAffMock.mockClear()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([])} initialKind="affidavit" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send for approval ▸' }))
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

  it('the list prints every ready short-form affidavit in one press: one window, each paper on its own sheet, and each job files its own copy (v2.6918)', async () => {
    openPrintMock.mockClear()
    fileCopyMock.mockClear()
    const ready = (id: string, job_id: string, short: boolean) => ({ ...draft(short ? { notice: {}, affidavitForm: 'short' } : { notice: {} }), id, job_id }) as LienDeskItemRow
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={three([ready('aff1', 'j650', true), ready('aff2', 'j651', true), ready('aff3', 'j652', false)])} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    expect(bar.textContent).toContain('2 affidavits on the short form are ready to file.')
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
    expect(bar.querySelector('[data-lien-affidavit-help-sheet]')?.textContent).toBe('Print the help sheet first')
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
    expect(bar.querySelector('[data-lien-affidavit-notice-record]')?.textContent).toBe('Print the notice record')
    expect(recordBox.checked).toBe(true)
    // The copies are the one box that starts unticked, and it says what it costs.
    const copiesBox = within(bar.querySelector('[data-lien-affidavit-notice-copies]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(bar.querySelector('[data-lien-affidavit-notice-copies]')?.textContent).toBe('Add a copy of each notice (1 more page)')
    expect(copiesBox.checked).toBe(false)
    fireEvent.click(within(bar).getByRole('button', { name: 'Print 2 for notarization' }))
    let html = openPrintMock.mock.calls[0]![0]
    expect(html.indexOf('data-lien-help="batch"')).toBeLessThan(html.indexOf('data-lien-help="records"'))
    expect(html.indexOf('data-lien-help="records"')).toBeLessThan(html.indexOf('<div class="filing-paper'))
    expect(html.match(/data-lien-record-paper="/g)).toHaveLength(2)
    expect(html).toContain('9407 0000 0000 0000 0000 11')
    expect(html).toContain('<strong>No number on record</strong>')
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
    // j652's owner turned out to be a public body after the paper was approved: it stays in Ready to file with a gate closed.
    d.affidavitRows = d.affidavitRows.map((r) => (r.job_id === 'j652' ? { ...r, owner_public: true } : r))
    d.affidavits = buildLienAffidavitQueue(d.affidavitRows, [ready('aff1', 'j650'), ready('aff2', 'j651'), ready('aff3', 'j652')], TODAY)
    expect(d.affidavits.entries.find((e) => e.jobId === 'j652')).toMatchObject({ pile: 'ready', ready: false })
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    const bar = document.querySelector('[data-lien-affidavit-print-all]') as HTMLElement
    expect(bar.textContent).toContain('2 affidavits on the short form are ready to file.')
    expect(bar.querySelector('[data-lien-affidavit-print-all-foot]')?.textContent).toBe('1 ready affidavit is held by a gate and is left out. Its row says why.')
    // The county box opens blank with no county in Settings, and says the notary writes it.
    const county = bar.querySelector('[data-lien-signing-county] input') as HTMLInputElement
    expect(county.value).toBe('')
    expect(bar.querySelector('[data-lien-signing-county-hint]')?.textContent).toBe('Left blank, the notary writes both county lines by hand. Type the county where it is signed to print it.')
    fireEvent.change(county, { target: { value: 'Travis' } })
    expect(bar.querySelector('[data-lien-signing-county-hint]')?.textContent).toBe('Both county lines print Travis County. Signing somewhere else? Type that county for this print.')
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
    // The envelope line (v2.3776) sits above the paper, not in the footer; the cover-note switch rides with it.
    const send = document.querySelector('[data-lien-desk-send-line]') as HTMLElement
    expect(send.textContent).toContain('by certified mail')
    expect(send.textContent).toContain('Lowbeck Contracting')
    expect(send.textContent).toContain('courtesy PDF to office@lowbeck.test')
    // Ready (v2.3776): ONE row — the state and its why, then Save draft and the one primary (Skip left in v2.4743).
    const next = document.querySelector('[data-lien-desk-next]') as HTMLElement
    expect(next.getAttribute('data-blocked')).toBe('no')
    expect(next.textContent).toContain('Goes to the leader')
    expect(next.textContent).not.toContain('Blocked until')
    expect(next.textContent).not.toContain('give up the lien right')
    expect(screen.queryByRole('button', { name: /Go to gate/ })).toBeNull()
    // v2.4743: no Skip — a month nobody sends closes on its own and is noted as missed.
    expect(screen.queryByRole('button', { name: /^Skip / })).toBeNull()
    expect(screen.getByLabelText(/Include counsel's cover letter/)).toBeTruthy()
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(gatesBox.getAttribute('data-ready')).toBe('yes')
    // The verdict row is the pane's stacked head now (v2.4733).
    expect(document.querySelector('[data-lien-pane-head="gates"]')?.textContent).toBe('The four gates✓ Ready to go out · 1 to check')
    expect(gatesBox.querySelector('.lienGatesHead')).toBeNull()
    expect([...gatesBox.querySelectorAll('[data-gate]')].map((g) => `${g.getAttribute('data-n')}:${g.getAttribute('data-tone')}`)).toEqual(['1:ok', '2:ok', '3:check', '4:ok'])
    expect((gatesBox.querySelector('[data-gate-detail="kind"]') as HTMLElement).textContent).toContain('3Property kind')
    // The sections fold (v2.4718): the clear gates' rows wait behind Details ∨; the one to check is open on its own.
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
    expect(field('noticeDate').getAttribute('title')).toBe('The day it is drafted or sent — nothing to change')
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
    // This notice is the last column, lettered after the papers (none here).
    expect((box.querySelector('[data-lien-grid-paper="this"]') as HTMLElement).textContent).toContain('AThis notice')
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
    expect(may.textContent).toContain('lien right gone · the money still rides')
    expect(within(may).getByRole('button', { name: 'Note it as missed' })).toBeTruthy()
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
    fireEvent.click(screen.getByLabelText(/Include counsel's cover letter/))
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
    expect(screen.getByRole('tab', { name: /Retainage · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    const list = document.querySelector('[data-lien-retainage-list]') as HTMLElement
    expect(list.textContent).toContain('complete Sep 3')
    expect(list.textContent).toContain('not yet in a § 53.056 claim')
    expect(screen.getByText(/Before this notice can go/)).toBeTruthy()
    expect((document.querySelector('[data-lien-retainage-in-claim]') as HTMLElement).getAttribute('data-lien-retainage-in-claim')).toBe('no')
    expect(screen.getAllByText(/§ 53\.081\(c\)/).length).toBeGreaterThan(0)
    const paper = (document.querySelector('[data-lien-retainage-pane]') as HTMLElement).textContent ?? ''
    expect(paper).toContain('Notice of Claim for Unpaid Retainage')
    expect(paper).toContain('Total retainage unpaid:')
    expect(paper).toContain('$1,760.00')
    expect(paper).toContain('Tex. Prop. Code § 53.057')
    fireEvent.click(screen.getAllByRole('button', { name: 'Change ›' })[0]!)
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
    expect(((await screen.findByRole('button', { name: /Send for approval/ })) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a job whose contract is still open sits in Clock not started with the door to set the day', async () => {
    const d = data([], [], true)
    d.retainageRows = [retRow({ contract_ended_on: null, contract_ended_how: null, deadline: null })]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="retainage" />)
    await settle()
    expect(screen.getByRole('button', { name: /Clock not started/ }).textContent).toContain('1')
    expect(screen.getByText(/§ 53\.057 · clock not started/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Set the day our contract ended/ }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
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
      expect(strip.textContent).toContain(kind === 'affidavit' ? 'Blocked until every gate above is clear' : 'Goes to the leader')
    })
  }
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
      fireEvent.click(screen.getByLabelText(/Include counsel's cover letter/))
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

  it('a sent job with a new month due sits in To draft, its row saying when the notice went, its footer carrying the attorney’s letter door beside Send for approval (v2.6624, punch list #248)', async () => {
    // June and July noticed by the Sep 2 packet; August's window is still open, so the next notice drafts while letter two's clock runs.
    const d = data([row('j650', '2026-06', '2026-09-15', { has_owner: true, noticed: true }), row('j650', '2026-07', '2026-10-15', { has_owner: true, noticed: true }), row('j650', '2026-08', '2026-11-16', { has_owner: true })], [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={d} />)
    await settle()
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    expect(document.querySelector('[data-lien-pile-rows="sent"]')).toBeNull()
    const row650 = document.querySelector('[data-lien-pile-rows="to_draft"]') as HTMLElement
    expect((row650.querySelector('[data-lien-desk-sent-words]') as HTMLElement).textContent).toBe('· sent Sep 2')
    expect((row650.querySelector('[data-lien-letter-two]') as HTMLElement).textContent).toBe('day 12 · the attorney’s letter')
    const doors = document.querySelector('[data-lien-desk-sent-doors]') as HTMLElement
    expect(doors.textContent).toContain('Sent')
    expect(doors.textContent).toContain('day 12 · the attorney’s letter')
    expect(doors.querySelector('[data-lien-letter-two-door]')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(document.querySelector('[data-lien-since-sent]')).toBeNull()
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
    const tick = screen.getByLabelText(/Name the supply house owed · \$9,612/) as HTMLInputElement
    expect(tick.checked).toBe(true)
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).toContain('You should also know that Reece sold materials for this job and is still owed $9,612.40. We expect Reece’s own notice by October 15. That notice is Reece’s own claim for materials. It is not covered by our release, and it is not included in the $33,500.00. Paying us the $33,500.00 is what lets us clear that account.')
    expect(document.querySelector('[data-lien-desk-houses-counsel]')?.textContent).toBe('Counsel has not read the supply house paragraph yet.')
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
    const tick = screen.getByLabelText(/Enclose a conditional release · \$33,500/) as HTMLInputElement
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
    expect(document.querySelector('[data-lien-desk-houses-counsel]')?.textContent).toBe('Counsel has not read the release paragraph yet.')
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
    expect(heads.map((h) => h.getAttribute('data-lien-pane-head'))).toEqual(['path', 'gates', 'houses', 'months', 'envelope'])
    expect(heads.map((h) => h.querySelector('.lienPaneHeadLabel')?.textContent)).toEqual(['Where this notice is', 'The four gates', 'Supply houses', 'Months on this job', 'In the envelope'])
    expect(heads[1]!.textContent).toContain('✓ Ready to go out · All 4 clear')
    expect(heads[2]!.textContent).toBe('Supply houses1 house owed · $9,612 · from our books · Sep 14')
    expect(heads[3]!.textContent).toBe('Months on this jobJun + Jul + Aug · $33,500')
    expect(heads[4]!.textContent).toBe('In the envelope2 pages · owner + GC · courtesy PDF to the GC')
    // Stacked: passed heads at the top, coming ones at the bottom; the first is lit at the top of the pane.
    expect(heads.map((h) => [h.style.top, h.style.bottom])).toEqual([['0px', '120px'], ['30px', '90px'], ['60px', '60px'], ['90px', '30px'], ['120px', '0px']])
    expect(heads.map((h) => h.getAttribute('data-on'))).toEqual(['yes', 'no', 'no', 'no', 'no'])
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
    // i bars from the top, n-1-i from the bottom, 30 px each (`lienPhoneLists.test.ts` holds a list of five).
    expect(heads.map((h) => parseFloat(h.style.top))).toEqual(heads.map((_, i) => i * 30))
    expect(heads.map((h) => parseFloat(h.style.bottom))).toEqual(heads.map((_, i) => (heads.length - 1 - i) * 30))
    expect(heads.every((h) => h.style.height === '30px')).toBe(true)
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
    // The desk re-reads after the approval: the item is in Ready to send, the awaiting pile is empty.
    const approved = { ...awaiting, status: 'approved', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader' } as LienDeskItemRow
    rerender(<LienDesk {...baseProps} authRole="master_technician" data={data(J650, [approved], true)} initialPile="awaiting" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-empty-pile]')).toBeNull()
    expect(document.querySelector('[data-lien-pile-head="ready"]')).toBeTruthy()
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
  })
  it('a list narrowed to one pile offers show every pile on its title, and widens on it', async () => {
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" data={data(J650)} initialPile="needs_owner" />)
    await settle()
    expect(document.querySelectorAll('[data-lien-pile-head]')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-lien-pile-all]') as HTMLElement)
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
    const headCount = document.querySelectorAll('[data-lien-pane-head]').length
    expect(headCount).toBe(4)
    expect(labels.map((l) => l.style.top)).toEqual(labels.map((_, i) => `${(headCount + i) * 30}px`))
    expect(labels.map((l) => l.style.bottom)).toEqual(labels.map(() => 'auto'))
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
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
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
    expect(screen.getByRole('button', { name: /Go to gate 5/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
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

  it('with no code set the line opens on the pad and says where he sets one; the office’s awaiting footer carries the same line and its own press', async () => {
    codeState.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
    renderWithProviders(<LienDesk {...baseProps} authRole="assistant" authName="Wendi" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Wendi')} data={awaitingOn({ master_user_id: 'u-malachi' })} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-lien-sign-code-words]')).toBeTruthy())
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('Malachi has not set a signing code yet. He sets it under Settings, Your account. He can draw here instead.')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
    expect(document.querySelector('[data-lien-desk-office-sign-press]')).toBeTruthy()
    // The spoken word is still a door.
    expect(screen.getByRole('button', { name: /Leader here, Approve/ })).toBeTruthy()
    codeState.status = { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
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
    expect(foot.querySelector('[data-lien-desk-sign]')).toBeNull()
    expect(foot.querySelector('[data-lien-desk-pen]')).toBeTruthy()
    const press = foot.querySelector('[data-lien-desk-office-sign-press]') as HTMLButtonElement
    expect(press.textContent).toBe('Sign ▸')
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '1357' } })
    fireEvent.click(press)
    await waitFor(() => expect(codeState.signs).toHaveLength(1))
    expect(codeState.signs[0]).toMatchObject({ itemId: 'it1', signerUserId: 'u-malachi', code: '1357', approve: false })
  })

  it('a dev on another master’s job reads To do as the office does (v2.6734): the row waits on Malachi, out of his count, and his code signature’s confirm group is not drawn on the dev’s Ready footer', async () => {
    const d = awaitingOn({ master_user_id: 'u-malachi' })
    renderWithProviders(<LienDesk {...baseProps} authRole="dev" authUserId="u-robert" authName="Robert" leaderNameFor={(id) => (id === 'u-malachi' ? 'Malachi Whites' : 'Robert')} data={d} initialKind="next" />)
    await settle()
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Waiting on Malachi Whites · 1'])
    expect((document.querySelector('[data-lien-next-up-row="notice:j650"]') as HTMLElement).textContent).toContain('Waiting on Malachi Whites · since Sep 14')
    expect(screen.getByRole('tab', { name: /^To do/ }).textContent).toBe('To do · 0')
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
