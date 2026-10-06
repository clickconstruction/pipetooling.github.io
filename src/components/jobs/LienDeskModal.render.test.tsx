// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk (v2.3405): the piles and the list from a
 * built queue, the office pane's readiness gate (owner of record blocks the
 * send and offers the door), months checkboxes, the document preview, the
 * spoken-word form, and the leader's decision footer. Wiring-level only —
 * the queue math lives in src/lib/jobs/lienDesk.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_LIEN_RETAINAGE_QUEUE, buildLienRetainageQueue, type LienRetainageRow } from '../../lib/jobs/lienDeskRetainage'
import { letterTwoByJobFrom } from '../../lib/jobs/lienLetterTwo'
import { ownerCallByJobFrom } from '../../lib/jobs/lienOwnerCall'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskModal from './LienDeskModal'
import { LienJobSuppliersCard } from './LienJobSuppliers'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from '../../lib/jobs/lienDesk'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { buildLienAffidavitQueue, type LienAffidavitRow } from '../../lib/jobs/lienDeskAffidavits'
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
const payPageState: { rows: Array<{ invoiceId: string; label: string; description: string; openAmount: number; payable: boolean }>; assets: Record<string, { svg: string; png: string | null }>; loading: boolean } = { rows: [], assets: {}, loading: false }
vi.mock('../../hooks/useNoticePayPage', () => ({ useNoticePayPage: () => payPageState }))
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
const clearPrintedMock = vi.fn()
vi.mock('../../lib/jobs/lienDeskIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/lienDeskIo')>('../../lib/jobs/lienDeskIo')
  return { ...actual, clearLienDeskItemPrinted: (id: string) => clearPrintedMock(id), startLetterTwo: (input: unknown) => startTwoMock(input), noteGcAuthorizedDirectPay: (...args: unknown[]) => gcOkayMock(...args), noteOwnerCall: (...args: unknown[]) => ownerCallMock(...args) }
})
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
})

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<LienNoticeMonthRow> = {}): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 82.6, noticed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, desk_item_id: null, desk_status: null, desk_months: null, ...extra }
}

function data(rows: LienNoticeMonthRow[], items: LienDeskItemRow[] = [], hasOwnerAddress = false, addr: Record<string, unknown> = {}): LienDeskData {
  const queue = buildLienDeskQueue(rows, items, { loberg: 'ask' }, TODAY)
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
      j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'ATI Schertz', job_address: '1204 Elbel Rd, Schertz, TX', customer_id: 'ati', customer_name: 'ATI Schertz', gc_customer_id: 'loberg', customer_address_id: hasOwnerAddress ? 'addr1' : null, revenue: 33_500, payments_made: 0, master_user_id: null, last_work_date: null },
    },
    gcsById: { loberg: { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'ask', policyNote: '' } },
    addressesById: hasOwnerAddress
      ? ({ addr1: { id: 'addr1', address: '1204 Elbel Rd, Schertz, TX', county: 'Guadalupe', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: 'Elbel Holdings LLC', owner_mailing_address: '4 Example Way, Schertz, TX', ...addr } } as unknown as LienDeskData['addressesById'])
      : {},
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(), claimCorrectionsByJob: {}, filingsByJob: {},
  }
}

const J650 = [row('j650', '2026-06', '2026-09-15'), row('j650', '2026-07', '2026-10-15'), row('j650', '2026-08', '2026-11-16')]

const baseProps = {
  open: true,
  onClose: () => {},
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

describe('LienDeskModal', () => {
  it('the title bar’s Share opens where the liens stand, from the same place on every tab (v2.4311)', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const share = document.querySelector('[data-lien-desk-share]') as HTMLButtonElement
    expect(share.textContent).toContain('Share')
    expect(share.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('tab', { name: 'Deadlines' }))
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
    const view = renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    const door = screen.getByTestId('lien-owner-records-door')
    // On All filings: at the right end of the title bar's second line, after the paper tabs (v2.4629, v2.4740).
    expect(door.closest('[data-lien-desk-right]')).toBeTruthy()
    expect(door.textContent).toBe('An owner asked for records ›')
    fireEvent.click(door)
    expect(onOpenOwnerRecords).toHaveBeenCalledTimes(1)
    view.unmount()
    // v2.4740: on Deadlines it moves up to the title line, just before § Rules, and the title bar is one line.
    const deadlines = renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialKind="calendar" onOpenOwnerRecords={onOpenOwnerRecords} />)
    await settle()
    const up = screen.getByTestId('lien-owner-records-door')
    expect(up.closest('[data-lien-desk-right]')).toBeNull()
    expect(up.parentElement!.querySelector('[data-lien-desk-share]')).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-header-break]')).toBeNull()
    deadlines.unmount()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    expect(screen.queryByTestId('lien-owner-records-door')).toBeNull()
  })

  it('a printed notice has a footer: the run to record the mailing, and Back to ready; the header counts it (v2.4568)', async () => {
    clearPrintedMock.mockReset()
    clearPrintedMock.mockResolvedValue(undefined)
    const printed = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: 'u-malachi', approved_at: '2026-09-14T15:00:00Z', approval_mode: 'leader', word_note: '', word_channel: '', printed_at: '2026-09-14T16:00:00Z',
    } as unknown as LienDeskItemRow
    const onChanged = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650, [printed], true)} initialJobId="j650" initialKind="notice" onChanged={onChanged} />)
    await settle()
    // Nothing is Ready to send, one is printed: the header still offers the run, counting what the run lists.
    expect(screen.getByRole('button', { name: 'Send the run · 1' })).toBeTruthy()
    // v2.4740: the run sits on the title line, right after the views; on All filings the paper tabs lead the second line.
    expect(document.querySelector('[data-lien-desk-kinds]')!.nextElementSibling!.hasAttribute('data-lien-desk-run')).toBe(true)
    expect(document.querySelector('[data-lien-desk-header-break]')!.nextElementSibling!.hasAttribute('data-lien-desk-paper-kinds')).toBe(true)
    const footer = document.querySelector('[data-lien-desk-printed-footer]') as HTMLElement
    expect(footer.textContent).toContain('Printed September 14, 2026 · in the mail.')
    expect(within(footer).getByRole('button', { name: /Record the mailing · 1/ })).toBeTruthy()
    fireEvent.click(within(footer).getByRole('button', { name: 'Back to ready' }))
    await waitFor(() => expect(clearPrintedMock).toHaveBeenCalledWith('it1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('Do now is the first tab (punch list #82; Next up until v2.4630): its count, and a row\u2019s button opens the Notices pane on that job and pile', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs[0]).toBe('Do now · 1')
    expect(screen.getByRole('tab', { name: 'Do now · 1' }).getAttribute('aria-selected')).toBe('true')
    // J650 has no owner on file: its one move is Find the owner.
    const row = document.querySelector('[data-lien-next-up-row="notice:j650"]') as HTMLElement
    expect(row.textContent).toContain('650 · ATI Schertz')
    fireEvent.click(within(row).getByRole('button', { name: 'Find the owner' }))
    await settle()
    expect(screen.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-lien-next-up="list"]')).toBeNull()
  })

  it('a door re-aims an open desk at the same job when its aim key changes (v2.4612)', async () => {
    const view = renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={1} />)
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'Deadlines' }))
    await settle()
    expect(screen.getByRole('tab', { name: 'Deadlines' }).getAttribute('aria-selected')).toBe('true')
    // The same job, pressed again from its Lien window: the tab is applied again.
    view.rerender(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={2} />)
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    // A re-render with the same aim changes nothing.
    fireEvent.click(screen.getByRole('tab', { name: 'Deadlines' }))
    await settle()
    view.rerender(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialJobId="j650" initialKind="notice" aimKey={2} />)
    await settle()
    expect(screen.getByRole('tab', { name: 'Deadlines' }).getAttribute('aria-selected')).toBe('true')
  })

  it('three views (punch list #82, PR 5; renamed v2.4630): Do now, Deadlines, All filings; All filings holds Notices, Affidavits, Retainage and Timeline and reopens on the last one', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialKind="next" />)
    await settle()
    const views = () => within(screen.getByRole('tablist', { name: 'View' })).getAllByRole('tab').map((t) => t.textContent)
    expect(views()).toEqual(['Do now · 1', 'Deadlines', 'All filings'])
    // On Do now and on Deadlines the four lists are not drawn.
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'All filings' }))
    await settle()
    const paper = within(screen.getByRole('tablist', { name: 'Kind of paper' }))
    expect(paper.getAllByRole('tab').map((t) => t.textContent?.replace(/ · \d+$/, ''))).toEqual(['Notices', 'Affidavits', 'Retainage', 'Timeline'])
    expect(paper.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'All filings' }).getAttribute('aria-selected')).toBe('true')
    // Retainage keeps its named place; leaving and coming back lands on it again.
    fireEvent.click(paper.getByRole('tab', { name: /^Retainage/ }))
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'Deadlines' }))
    await settle()
    expect(screen.queryByRole('tablist', { name: 'Kind of paper' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'All filings' }))
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Retainage/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('a door that names a kind still lands on its list, inside All filings (punch list #82, PR 5)', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialKind="affidavit" />)
    await settle()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /^All filings/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('lists the job under Needs the owner, blocks the send, and offers the Find the owner door', async () => {
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} onOpenEditJob={onOpenEditJob} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Lien desk' })).toBeTruthy()
    // the backdrop leaves room for an iPhone's status bar, so the title bar is never under the clock (v2.4397)
    expect(screen.getByRole('dialog', { name: 'Lien desk' }).style.paddingTop).toBe('var(--app-top-chrome, 0px)')
    // the tab row is the sideways scroller that fades a cut end (v2.4441); a row that fits carries no fade
    const kinds = document.querySelector('[data-lien-desk-kinds]') as HTMLElement
    expect(kinds.getAttribute('role')).toBe('tablist')
    expect(kinds.style.maskImage ?? '').toBe('')
    expect(screen.getByRole('button', { name: /Needs the owner/ }).textContent).toContain('1')
    expect(screen.getAllByText(/650 · ATI Schertz/).length).toBeGreaterThan(0)
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
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Owner of record missing')
    // The gates (v2.3657): the verdict is the headline, gate 1 is the one blocker, and its detail is numbered to match.
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(gatesBox.textContent).toContain("Can't go out yet1 blocker · 1 to check")
    expect((gatesBox.querySelector('[data-gate="owner"]') as HTMLElement).getAttribute('data-tone')).toBe('blocker')
    // A gate that is not clear opens on its own (v2.4718); the clear ones stay folded until asked.
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1Owner of record')
    expect(gatesBox.querySelector('[data-gate-detail="gc"]')).toBeNull()
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Owner of record missing')
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    // The passing gate is a chip; the whole sentence rides in its tooltip (v2.3522).
    expect(screen.getByTitle(/Owner of record with a mailing address — Elbel Holdings LLC/)).toBeTruthy()
    expect((document.querySelector('[data-gate="owner"]') as HTMLElement).textContent).toBe('1Owner of record✓ Elbel Holdings LLC')
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain("Goes to the leader · first notice we've sent this GC")
    fireEvent.click(screen.getByRole('button', { name: /The leader said to send it/ }))
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByText('by phone')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Record it and send/ })).toBeTruthy()
  })

  it('a "send" rule with no notice recorded to the GC still sends the first one to the leader (v2.3469)', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    const loberg = { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'send' as const, policyNote: '' }
    const withRule: LienDeskData = { ...d, gcsById: { loberg }, queue: buildLienDeskQueue(d.rows, d.items, { loberg: 'send' }, TODAY) }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={withRule} />)
    await settle()
    expect(screen.getByRole('button', { name: /Send for approval/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Put it in the run/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Goes to the leader · first notice to this GC — the rule starts with the next one')
  })

  it('the leader sees what he is deciding, the standing rule, and Approve & next / Hold on an awaiting item', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.getByRole('button', { name: /Awaiting approval/ }).textContent).toContain('1')
    expect(screen.getByText("What you're deciding")).toBeTruthy()
    expect(screen.getByText(/Open with Loberg Contracting/)).toBeTruthy()
    expect(screen.getByText(/Jun 2026's lien right ends September 15, 2026/)).toBeTruthy()
    expect(screen.getByText(/Standing rule for Loberg Contracting/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Send notices without asking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve & next/ })).toBeTruthy()
    // The pay offer (v2.4713): the leader's box above the footer, off until he ticks it, then the sentence as the page prints it.
    expect(screen.getByTestId('lien-offer-box').getAttribute('data-on')).toBe('no')
    fireEvent.click(screen.getByTestId('lien-offer-switch'))
    expect(screen.getByTestId('lien-offer-box').getAttribute('data-on')).toBe('yes')
    expect(screen.getByTestId('lien-offer-prints').textContent).toContain('and it is 10% less')
    fireEvent.click(screen.getByTestId('lien-offer-pct-15'))
    expect(screen.getByTestId('lien-offer-prints').textContent).toContain('and it is 15% less')
    fireEvent.click(screen.getByRole('button', { name: /Hold — I'll call first/ }))
    expect(screen.getByText(/then asks again/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hold' })).toBeTruthy()
  })

  it('the office sees an awaiting item as waiting on the leader, and nothing due reads calm', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="controller" data={data([])} />)
    await settle()
    expect(screen.getByText(/Nothing is due/)).toBeTruthy()
  })

  it('“he is here” (v2.3813): the office’s awaiting footer records the leader’s word at the desk, with the presence line', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" authName="Wendi" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.getByText(/Waiting on the leader since/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve & next/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /He is here — record it/ }))
    // The row opens with the presence channel picked and says what the record will read.
    expect(screen.getByText('He is here — who, when, and how:')).toBeTruthy()
    expect((screen.getByLabelText('Who said it and when') as HTMLInputElement).value).toMatch(/^the leader, /)
    expect((screen.getByLabelText('he is standing over me') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(/Recorded by Wendi: the leader was standing here and said to send it/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('he is typing it in'))
    expect(screen.getByText(/Recorded by Wendi: the leader typed this in himself, at this desk/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Record it and send/ }) as HTMLButtonElement).disabled).toBe(false)
    // The remembered three are still there; a remembered word shows no presence line.
    fireEvent.click(screen.getByLabelText('by phone'))
    expect(screen.queryByText(/Recorded by Wendi/)).toBeNull()
  })

  it('the leader’s own awaiting footer has no “he is here” — he approves', async () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    await settle()
    expect(screen.queryByRole('button', { name: /He is here/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Approve & next/ })).toBeTruthy()
  })
})

describe('LienDeskModal · the demand letter on the panes’ strips (v2.3880, punch list #32)', () => {
  const letter = { id: 'd1', job_id: 'j650', amount: 8_940, created_at: '2026-09-08T16:00:00Z', created_by: null, deadline_date: '2026-09-22', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Loberg Contracting', sent_at: '2026-09-08T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null } as unknown as NonNullable<LienDeskData['demandLettersByJob']>[string][number]

  it('the notice pane draws the letter the desk loaded, and says who is waited on; without letters there is no node', async () => {
    const d = data(J650)
    d.demandLettersByJob = { j650: [letter] }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
    await settle()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    expect(timeline.querySelector('[data-lien-timeline-step="demand"]')?.textContent).toContain('reply by Sep 22')
    expect(timeline.textContent).toContain('Waiting on')
    cleanup()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="demand"]')).toBeNull()
  })

  it('the affidavit pane draws it too', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.demandLettersByJob = { j650: [letter] }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} initialKind="affidavit" />)
    await settle()
    expect(document.querySelector('[data-lien-desk-timeline] [data-lien-timeline-step="demand"]')?.textContent).toContain('reply by Sep 22')
  })
})

describe('LienDeskModal reads the roll (v2.3450)', () => {
  function payload(owner: string, mailing: string) {
    return { ok: true, county_geocoder: 'Guadalupe', parcel: { propId: '12345', ownerName: owner, nameCare: '', legalDescription: 'LOT 1', situsAddress: '1204 ELBEL RD, SCHERTZ, TX', mailingAddress: mailing, county: 'Guadalupe', source: 'Guadalupe Appraisal District', taxYear: '2025' } }
  }

  it('an ownerless item shows the roll’s answer with its chips and Use, keeps the door, and Use writes the property and re-reads', async () => {
    lookupMock.mockImplementation(async (address: string) => proposalFromLookupPayload(address, payload('SCHERTZ STATION LTD', '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209')))
    const onChanged = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} onChanged={onChanged} />)
    await waitFor(() => expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('found'))
    expect(screen.getByText('Schertz Station Ltd')).toBeTruthy()
    expect(screen.getByText(/landlord · ATI Schertz is the tenant/)).toBeTruthy()
    expect(screen.getByText(/Guadalupe Appraisal District 2025/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Find the owner ›' })).toBeTruthy()
    // Still blocked until Use — the roll's answer is a proposal, not the record.
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Owner of record missing')
    expect(screen.getByRole('button', { name: /Go to gate 1/ })).toBeTruthy()
    fireEvent.click(screen.getByTestId('lien-desk-owner-use'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    const input = confirmMock.mock.calls[0]![0] as { address: string; jobs: { jobId: string; customerId: string | null; gcCustomerId: string | null }[]; source: { kind: string }; userId: string | null }
    expect(input.address).toBe('1204 Elbel Rd, Schertz, TX')
    expect(input.jobs).toEqual([{ jobId: 'j650', customerId: 'ati', gcCustomerId: 'loberg', customerAddressId: null }])
    expect(input.source.kind).toBe('proposal')
    expect(input.userId).toBe('u-taunya')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a public owner on the record reads the bond-claim sentence and is not draftable', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true, { owner_company: 'CITY OF ROUND ROCK', owner_mailing_address: '221 E Main St, Round Rock, TX', owner_confirmed_at: '2026-09-14T00:00:00Z' })} />)
    await settle()
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    expect(screen.getByTestId('lien-desk-owner-pane').getAttribute('data-state')).toBe('public')
    expect(screen.getAllByText(/a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond/).length).toBeGreaterThanOrEqual(2)
    // Blocked (v2.3662): no dead Send button — the next step names the gate, and the primary goes to it.
    expect(screen.queryByRole('button', { name: /Send for approval/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).getAttribute('data-blocked')).toBe('yes')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Owner of record · public property')
    expect(screen.getByRole('button', { name: /Go to gate 1/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /The leader said to send it/ })).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('an owner the nightly run saved from the roll drafts, shows the provenance and the CAD check, and Confirm stamps the record', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true, { owner_confirmed_at: null, parcel_source: 'Guadalupe Appraisal District', parcel_tax_year: '2025', parcel_id: '12345' })} onChanged={onChanged} />)
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

describe('LienDeskModal affidavits (v2.3412)', () => {
  it('switches to the affidavit kind, lists the window with its missing gates, and offers the property door', async () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="affidavit" />)
    await settle()
    expect(screen.getByRole('tab', { name: /Affidavits · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Needs the property facts/ }).textContent).toContain('1')
    expect(screen.getByText(/missing owner, legal, notice/)).toBeTruthy()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    expect(timeline.textContent).toContain('File the affidavit — tomorrow · owner of record, legal description, the notice missing.')
    expect(timeline.textContent).toContain('Commercial dates shown — a residential property is a month earlier.')
    expect(screen.getByText(/Before this affidavit can be generated/)).toBeTruthy()
    // v2.4724: the door opens the property record in a window over the desk, not Edit Job.
    fireEvent.click(screen.getAllByRole('button', { name: 'Fill in the record ›' })[0]!)
    expect(await screen.findByTestId('lien-paper-property-window')).toBeTruthy()
    expect(onOpenEditJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    expect(screen.getByRole('button', { name: 'Send the notice first ›' })).toBeTruthy()
  })

  it('the pane says which months the affidavit claims, and a missed month is worked but unsecured (v2.3681)', () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const workMonths = {
      j650: { jobId: 'j650', role: 'sub' as const, propertyKind: '', months: [{ key: '2026-05', label: 'May 2026', weeks: [], people: ['Malachi'], hours: 20, pendingHours: 0, dayCount: 3, hoursShare: 100, notice: { due: '2026-08-17', daysLeft: -28, state: 'closed' as const } }], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-05', affidavitDue: '2026-09-15' },
    }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} workMonths={workMonths} initialKind="affidavit" />)
    const card = document.querySelector('[data-lien-affidavit-months]') as HTMLElement
    expect(card.textContent).toContain('Months the affidavit claims')
    expect(card.textContent).toContain('Worked, not noticedMay 202620 approved hours · window closed Aug 17 with no notice — the lien does not cover itunsecured')
    expect(card.textContent).toContain("No month has a notice on record — the affidavit cannot claim this work. May 2026's share of the balance stays an ordinary receivable")
  })
})

// ---------- v2.3522: the paper is the pane; wording; the preview window ----------

describe('LienDeskModal · wording and the preview (v2.3522)', () => {
  const officeWithOwner = () => data(J650.map((r) => ({ ...r, has_owner: true })), [], true)

  it('the paper is the editor (v2.3694): a shaded value becomes a box in place, Enter keeps it, the label counts it, Back puts the job’s wording back', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={officeWithOwner()} />)
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
    fireEvent.change(screen.getByLabelText('Party contracted with, if different from the GC'), { target: { value: 'Loberg Contracting of Texas LLC' } })
    fireEvent.keyDown(screen.getByLabelText('Party contracted with, if different from the GC'), { key: 'Enter' })
    expect((paper.querySelector('[data-field="contractedWithIfDifferent"]') as HTMLElement).getAttribute('data-ghost')).toBeNull()
    expect((paper.querySelector('[data-field="contractedWithIfDifferent"] [data-field-text]') as HTMLElement).textContent).toBe('Loberg Contracting of Texas LLC')
  })

  it('the footer says who gets it and carries the cover note; every gate has its section, a cell click brings it up, and gate 3 sets the kind in place', async () => {
    const onOpenEditJob = vi.fn()
    const onChanged = vi.fn()
    // Owner on file, property kind blank → it can go out, gate 3 is a check with its switch.
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    d.addressesById = { addr1: { ...(d.addressesById.addr1 as Record<string, unknown>), property_kind: '' } as never }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} onChanged={onChanged} />)
    // The envelope line (v2.3776) sits above the paper, not in the footer; the cover-note switch rides with it.
    const send = document.querySelector('[data-lien-desk-send-line]') as HTMLElement
    expect(send.textContent).toContain('by certified mail')
    expect(send.textContent).toContain('Loberg Contracting')
    expect(send.textContent).toContain('courtesy PDF to office@loberg.test')
    // Ready (v2.3776): ONE row — the state and its why, then Save draft, a quiet Skip, and the one primary.
    const next = document.querySelector('[data-lien-desk-next]') as HTMLElement
    expect(next.getAttribute('data-blocked')).toBe('no')
    expect(next.textContent).toContain('Goes to the leader')
    expect(next.textContent).not.toContain('Blocked until')
    expect(next.textContent).not.toContain('give up the lien right')
    expect(screen.queryByRole('button', { name: /Go to gate/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Skip Jun \+ Jul \+ Aug…$/ }))
    expect(screen.getByText(/Skipping gives up the lien right on/)).toBeTruthy()
    expect(screen.getByLabelText('Skip reason')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText(/Include counsel's cover letter/)).toBeTruthy()
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(gatesBox.getAttribute('data-ready')).toBe('yes')
    expect(gatesBox.textContent).toContain('Ready to go out1 to check')
    expect([...gatesBox.querySelectorAll('[data-gate]')].map((g) => `${g.getAttribute('data-n')}:${g.getAttribute('data-tone')}`)).toEqual(['1:ok', '2:ok', '3:check', '4:ok'])
    expect((gatesBox.querySelector('[data-gate-detail="kind"]') as HTMLElement).textContent).toContain('3Property kind')
    // The sections fold (v2.4718): the clear gates' rows wait behind Details ∨; the one to check is open on its own.
    expect(gatesBox.querySelector('[data-gate-detail="owner"]')).toBeNull()
    expect(gatesBox.querySelector('[data-gate-detail="gc"]')).toBeNull()
    fireEvent.click(gatesBox.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    // Every gate has its section (v2.3670): a row — the number, the label, the fact with its doors first, one muted line under it.
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1Owner of recordElbel Holdings LLCCheck on Guadalupe CAD ↗Change ›4 Example Way, Schertz, TX')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('From the property record · every job here uses it.')
    expect((gatesBox.querySelector('[data-gate-detail="gc"]') as HTMLElement).textContent).toContain('2Original contractorLoberg ContractingChange the GC ›2904 Corporate Cr, Flower Mound, TX')
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
    const { rerender } = renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} onOpenCompanySettings={onOpenCompanySettings} />)
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
    d2.gcsById = { loberg: { ...d2.gcsById.loberg!, name: 'Loberg Contracting of Texas LLC' } }
    rerender(<LienDeskModal {...baseProps} authRole="assistant" data={d2} onOpenEditJob={onOpenEditJob} onOpenCompanySettings={onOpenCompanySettings} />)
    expect((paper().querySelector('[data-field="originalContractorName"] [data-field-text]') as HTMLElement).textContent).toBe('Loberg Contracting of Texas LLC')
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
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={officeWithOwner()} />)
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
      fields: { notice: { noticeDate: TODAY, projectDescription: '', claimantName: '', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '', contactPerson: '', claimantAddress: '' }, gcEmail: '', skipReason: 'Loberg paid the May invoice in full', skippedBy: { name: 'Taunya', at: '2026-08-11T15:00:00Z' } },
      cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, sent_at: null, approved_at: null, approved_by: null, held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-08-11T15:00:00Z', created_at: '2026-08-11T15:00:00Z', updated_at: '2026-08-11T15:00:00Z', voided_at: null,
    } as unknown as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [skippedMay], true)} />)
    const box = document.querySelector('[data-lien-desk-month-grid]') as HTMLElement
    expect(box.textContent).toContain('Months on this job')
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
    expect(may.textContent).toContain('Taunya: “Loberg paid the May invoice in full”')
    expect((screen.getByRole('checkbox', { name: 'May 2026' }) as HTMLInputElement).disabled).toBe(true)
    // This notice is the last column, lettered after the papers (none here).
    expect((box.querySelector('[data-lien-grid-paper="this"]') as HTMLElement).textContent).toContain('AThis notice')
  })

  it('the claim box is the editor (v2.3682): one figure, one reason, one tick — and the notice claims the rest', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={officeWithOwner()} onChanged={onChanged} />)
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={d} />)
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
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
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={officeWithOwner()} />)
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
      fields: { notice: { noticeDate: TODAY, projectDescription: 'ATI Schertz — 1204 Elbel Rd, Schertz, TX', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Electrical labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '' }, gcEmail: '', wording: { editedBy: 'Taunya', editedAt: '2026-09-14T14:59:00Z' } },
      cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, sent_at: null, approved_at: null, approved_by: null, held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-14T14:00:00Z',
    } as unknown as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650.map((r) => ({ ...r, has_owner: true })), [awaiting], true)} />)
    expect(document.body.textContent).toContain('1 value changed by Taunya from the job’s wording — the notice below carries it')
    // The paper is locked once the item has left drafted (v2.3694): dotted boxes, and a click opens nothing.
    const paper = document.querySelector('[data-lien-desk-paper]') as HTMLElement
    expect((paper.querySelector('[data-field="laborMaterialsType"]') as HTMLElement).getAttribute('data-editable')).toBe('locked')
    expect(paper.querySelector('[data-ghost]')).toBeNull()
    fireEvent.click(paper.querySelector('[data-field="laborMaterialsType"] [data-field-text]') as HTMLElement)
    expect(screen.queryByLabelText('Type of labor or materials')).toBeNull()
  })
})

describe('LienDeskModal · the cover page in the pane (v2.3540)', () => {
  it('shows counsel’s cover letter as page 1 while it is ticked, and only the notice when it is not', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    const cover = document.querySelector('[data-lien-desk-cover]') as HTMLElement
    expect(cover).toBeTruthy()
    expect(cover.textContent).toContain('Re: 650 · ATI Schertz')
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

describe('LienDeskModal retainage (v2.3753)', () => {
  const retRow = (partial: Partial<LienRetainageRow> = {}): LienRetainageRow => ({ job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null, ...partial })

  it('switches to the retainage kind, lists the job with its clock, shows the gates, the trap warning and the two forms, and sends for approval', async () => {
    const d = data([], [], true)
    d.retainageRows = [retRow()]
    d.retainage = buildLienRetainageQueue(d.retainageRows, [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="retainage" />)
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="retainage" />)
    await settle()
    expect(screen.getByRole('button', { name: /Clock not started/ }).textContent).toContain('1')
    expect(screen.getByText(/§ 53\.057 · clock not started/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Set the day our contract ended/ }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })

  it('the notice pane names the retainage inside the claim once the job records it, and offers the door when it does not', () => {
    const withRetainage = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    withRetainage.jobsById.j650!.lien_retainage_held = 1_760
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={withRetainage} />)
    expect((document.querySelector('[data-lien-claim-retainage]') as HTMLElement).getAttribute('data-lien-claim-retainage')).toBe('yes')
    expect(screen.getByText(/Of which, unpaid retainage:/)).toBeTruthy()
    cleanup()
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} onOpenEditJob={onOpenEditJob} />)
    expect((document.querySelector('[data-lien-claim-retainage]') as HTMLElement).getAttribute('data-lien-claim-retainage')).toBe('unset')
    fireEvent.click(screen.getByRole('button', { name: 'Set on the job ›' }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })
})

describe('LienDeskModal footer hand-off (v2.3753)', () => {
  const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
  const retRow: LienRetainageRow = { job_id: 'j650', retainage_held: 1_760, contract_ended_on: '2026-09-03', contract_ended_how: 'complete', deadline: '2026-10-05', noticed: false, in_claim: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: 'non_residential', has_owner: true, payment_bond: 'unknown', desk_item_id: null, desk_status: null }

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
        renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} initialKind={kind} />)
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

describe('LienDeskModal · the pay page in the pane (punch list #35, PR 3)', () => {
  it('is page 3 of 3 under the notice when the job has unpaid bills, with the count and the total, and the count moves with the cover note', async () => {
    payPageState.rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
    payPageState.assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }
    try {
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
      await settle()
      expect(screen.getByText('Page 1 of 3 · cover letter')).toBeTruthy()
      const labels = () => [...document.querySelectorAll('[data-lien-desk-page-label]')].map((n) => n.textContent ?? '')
      expect(labels().find((t) => t.includes('the notice'))).toContain('Page 2 of 3 · the notice · the pay codes and the invoice follow it in the packet')
      expect(labels().find((t) => t.includes('· pay codes'))).toContain('Page 3 of 3 · pay codes · 1 bill · $33,500.00 still owed')
      const pay = document.querySelector('[data-lien-desk-pay]') as HTMLElement
      expect(pay.textContent).toContain('Once these bills are paid, there will be no lien filed.')
      expect(pay.textContent).toContain('only if Loberg Contracting has told you in writing')
      expect(pay.querySelector('svg[data-code]')).toBeTruthy()
      fireEvent.click(screen.getByLabelText(/Include counsel's cover letter/))
      expect(labels().find((t) => t.includes('· pay codes'))).toContain('Page 2 of 2 · pay codes')
    } finally {
      payPageState.rows = []
      payPageState.assets = {}
    }
  })
})

describe('LienDeskModal · the pay page lines are typed in place (v2.4724)', () => {
  it('a shaded line opens a box; Enter keeps it on this page only, the label counts it, and Back puts the bill’s line back', async () => {
    payPageState.rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
    payPageState.assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }
    try {
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
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

describe('LienDeskModal · a notice that already went out (#35 PR 2)', () => {
  it('the draft footer offers "Already mailed? Record it…" and opens the by-hand pane prefilled with the desk’s months', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    const door = document.querySelector('[data-lien-desk-by-hand]') as HTMLButtonElement | null
    expect(door).toBeTruthy()
    fireEvent.click(door!)
    const pane = await screen.findByTestId('lien-notice-by-hand')
    expect(pane.textContent).toContain('Record a notice that already went out')
    expect((screen.getByLabelText('Months as printed') as HTMLInputElement).value).not.toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByTestId('lien-notice-by-hand')).toBeNull()
  })

  it('on a phone the by-hand step is a sheet over the desk’s card (v2.4446): the same fields, Back to the notice, × closes the desk', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const onClose = vi.fn()
      renderWithProviders(<LienDeskModal {...baseProps} onClose={onClose} authRole="assistant" initialJobId="j650" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
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
      fireEvent.click(sheet.querySelector('[aria-label="Close"]')!)
      expect(onClose).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(document.querySelector('[data-lien-record-sheet]')).toBeNull()
    } finally {
      window.matchMedia = before
    }
  })
})

describe('LienDeskModal letter two (v2.3760)', () => {
  const sentPacket = {
    id: 'sent1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T14:00:00Z', sent_at: '2026-09-02T15:00:00Z',
    fields: { notice: { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }, gcEmail: 'office@loberg.test' },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_at: '2026-09-02T14:30:00Z', approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: 'f1', pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-02T15:00:00Z', voided_at: null,
  } as unknown as LienDeskItemRow

  function sentDesk() {
    // Every month noticed, the packet 12 days old, the balance still open.
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    return d
  }

  it('the sent row and footer count the days, and Send letter two drafts counsel’s paid-out letter on the job', async () => {
    startTwoMock.mockReset()
    startTwoMock.mockResolvedValue('two1')
    const onChanged = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={sentDesk()} onChanged={onChanged} />)
    expect((document.querySelector('[data-lien-letter-two]') as HTMLElement).textContent).toBe('day 12 · letter two')
    const since = document.querySelector('[data-lien-since-sent]') as HTMLElement
    expect(since.textContent).toContain('Day 12')
    expect(since.textContent).toContain('GC paid: no')
    expect(since.textContent).toContain('GC authorized direct pay: no')
    fireEvent.click(screen.getByRole('button', { name: 'Send letter two ▸' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /We believe the owner paid the GC out/ }))
    await waitFor(() => expect(startTwoMock).toHaveBeenCalled())
    const input = startTwoMock.mock.calls[0]![0] as { first: { id: string }; fields: { letterTwo?: { kind: string; afterItemId: string }; coverLetter?: string; notice: { claimAmount: string } } }
    expect(input.first.id).toBe('sent1')
    expect(input.fields.letterTwo).toMatchObject({ kind: 'paid_out', afterItemId: 'sent1' })
    expect(input.fields.coverLetter).toContain('reason to believe you may already have paid Loberg Contracting in full')
    expect(input.fields.notice.claimAmount).toBe('33500.00')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('the GC’s written okay is recorded on the first packet and turns letter two off', async () => {
    gcOkayMock.mockReset()
    gcOkayMock.mockResolvedValue(undefined)
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={sentDesk()} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'The GC authorized direct pay…' }))
    fireEvent.change(screen.getByLabelText("The GC's okay — where and when"), { target: { value: 'email from Loberg, Sep 12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record it ▸' }))
    await waitFor(() => expect(gcOkayMock).toHaveBeenCalled())
    expect(gcOkayMock.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(gcOkayMock.mock.calls[0]![1]).toEqual({ name: 'Taunya', note: 'email from Loberg, Sep 12' })
  })

  it('a letter-two draft wears its mark in the list and on the pane heading', () => {
    const twoDraft = { ...sentPacket, id: 'two1', status: 'drafted', sent_at: null, sent_filing_id: null, approval_mode: null, created_at: '2026-09-14T09:00:00Z', fields: { ...(sentPacket.fields as object), letterTwo: { kind: 'unresponsive', afterItemId: 'sent1', afterSentAt: '2026-09-02T15:00:00Z' } } } as unknown as LienDeskItemRow
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket, twoDraft], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
    expect((document.querySelector('[data-lien-letter-two="draft"]') as HTMLElement).textContent).toBe('letter two · unresponsive')
    expect((document.querySelector('[data-lien-letter-two-heading]') as HTMLElement).textContent).toContain('letter two · unresponsive · after the Sep 2 packet')
  })
})

describe('LienDeskModal the owner’s call and the piles (v2.3767)', () => {
  const sentPacket = {
    id: 'sent1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T14:00:00Z', sent_at: '2026-09-02T15:00:00Z',
    fields: { notice: { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }, gcEmail: '' },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_at: '2026-09-02T14:30:00Z', approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: 'f1', pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-02T15:00:00Z', voided_at: null,
  } as unknown as LienDeskItemRow
  const answered = { ...sentPacket, fields: { ...(sentPacket.fields as object), ownerCall: { at: '2026-09-10T15:00:00Z', name: 'Taunya', owesGc: 'no', owesAmount: null, reserved: 'never', originalContractCompletedOn: '2026-08-20', note: 'paid Loberg in full' } } } as unknown as LienDeskItemRow

  it('the sent footer records the owner’s call — the three questions — on the first packet, and reads back the pile', async () => {
    ownerCallMock.mockReset()
    ownerCallMock.mockResolvedValue(undefined)
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
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
    expect(dialog.querySelector('[data-lien-owner-call-say]')!.textContent).toContain('Please don’t send Loberg Contracting that money until this is cleared.')
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-reply="ten_held"]') as HTMLElement)
    fireEvent.click(within(dialog).getByLabelText('still going'))
    fireEvent.click(dialog.querySelector('[data-lien-owner-call-next]') as HTMLElement)
    expect(dialog.querySelector('[data-lien-owner-call-pile]')!.getAttribute('data-lien-owner-call-pile')).toBe('A')
    expect(dialog.querySelector('[data-lien-owner-call-sentence]')!.textContent).toContain('still owes Loberg Contracting about $14,000. The 10% is still with them. Loberg Contracting is still on the job.')
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'An owner is calling' }))
    const script = screen.getByTestId('lien-call-script')
    expect(script.getAttribute('data-has-job')).toBe('yes')
    expect(screen.getByTestId('lien-call-script-sub').textContent).toContain('650 · ATI Schertz · GC Loberg Contracting · § 53.056 notice mailed')
    expect(screen.getByTestId('lien-call-script-open').textContent).toContain('you did nothing wrong by paying Loberg Contracting')
    // nothing to type: the search that lived here is gone
    expect(screen.queryByLabelText('Find a job on the Lien desk')).toBeNull()
    fireEvent.click(document.querySelector('[data-lien-call-script-opening="sued"]') as HTMLElement)
    expect(screen.getByTestId('lien-call-script-next').textContent).toContain('this isn’t a lawsuit')
    fireEvent.click(screen.getByTestId('lien-call-script-record'))
    const dialog = document.querySelector('[data-lien-owner-call-dialog]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('data-lien-owner-call-step')).toBe('open')
    expect(dialog.querySelector('[data-lien-owner-call-holding]')!.textContent).toContain('Elbel Holdings LLC is holding')
    expect(screen.queryByTestId('lien-call-script')).toBeNull()
  })

  it('the find box reaches every notice the desk ever sent (v2.4731): a letter not on the piles shows under Also sent and opens the call sheet', async () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [sentPacket], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} initialPile="to_draft" />)
    await settle()
    expect(document.querySelector('[data-lien-also-sent]')).toBeNull()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: 'elbel' } })
    const head = document.querySelector('[data-lien-pile-head="also_sent"]') as HTMLElement
    expect(head.textContent).toContain('Also sent · every notice out')
    const row = document.querySelector('[data-lien-also-sent="j650"]') as HTMLElement
    expect(row.textContent).toContain('Elbel Holdings LLC')
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
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
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-07', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([], [answered], true)
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    d.ownerCallByJob = ownerCallByJobFrom(d.items)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="affidavit" />)
    expect((document.querySelector('[data-lien-affidavit-pile]') as HTMLElement).textContent).toBe('B · paid, never reserved the 10%')
    const box = document.querySelector('[data-lien-affidavit-owner-answers]') as HTMLElement
    expect(box.getAttribute('data-pile')).toBe('B')
    expect(box.textContent).toContain('owner called Sep 10 · owes the GC nothing · never reserved the 10% · their contract completed Aug 20 · the 10% hold (§ 53.101) ends Sep 21')
    expect(box.textContent).toContain('reserved-funds lien')
    expect((document.querySelector('[data-lien-affidavit-bond]') as HTMLElement).getAttribute('data-lien-affidavit-bond')).toBe('unknown')
    fireEvent.click(screen.getByRole('button', { name: 'Check the project ›' }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650', 'lien-contract')
  })

  it('the title-bar toggle fills the screen and remembers it; a second press restores the window (v2.4065)', async () => {
    window.localStorage.removeItem('modal_full_screen_lien-desk')
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    const panel = document.querySelector('[data-lien-desk-panel]') as HTMLElement
    expect(panel.style.borderRadius).toBe('10px')
    const toggle = await screen.findByRole('button', { name: 'Full screen' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(panel.style.borderRadius).toBe('0')
    expect(screen.getByRole('button', { name: 'Back to a window' }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem('modal_full_screen_lien-desk')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to a window' }))
    expect(panel.style.borderRadius).toBe('10px')
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy()
    expect(window.localStorage.getItem('modal_full_screen_lien-desk')).toBeNull()
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
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const mark = document.querySelector('[data-lien-supplier-mark]')
    expect(mark?.textContent).toContain('1 house owed $9,612')
    const card = document.querySelector<HTMLElement>('[data-lien-suppliers-card="owed"]')!
    expect(card).toBeTruthy()
    expect(within(card).getByText('July materials')).toBeTruthy()
    // July on a commercial clock is due Oct 15; today is Sep 14.
    expect(within(card).getByText('by Oct 15')).toBeTruthy()
    expect(card.querySelector('[data-lien-suppliers-verdict]')?.textContent).toBe('The $33,500.00 Loberg Contracting owes us covers what the houses are owed.')
    fireEvent.click(within(card).getByRole('button', { name: 'Copy for an email' }))
    await settle()
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = String(writeText.mock.calls[0]![0])
    expect(text).toContain('Supply houses on 650 · ATI Schertz')
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
        { id: 'rel-1', formType: 'conditional_progress', amount: 33500, signature: null, fields: { companyName: 'Click Plumbing', checkFrom: 'Loberg Contracting', amount: '33500.00', projectDescription: 'ATI Schertz, 1204 Elbel Rd, Schertz, TX', throughDate: '2026-07-31', signedDate: '', signerName: 'Robert Douglas', signerTitle: '' } },
      ],
    ])
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
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
    expect(input.fields).toMatchObject({ checkFrom: 'Loberg Contracting', amount: '33500.00', throughDate: '2026-08-31', signedDate: '' })
    expect(tick.checked).toBe(true)
    const cover = document.querySelector('[data-lien-desk-cover]')!
    expect(cover.textContent).toContain('A conditional release of lien is enclosed. This release is not effective today. It becomes effective only after $33,500.00 is received and the funds have cleared. Until then, the notice stands.')
    expect(cover.textContent).toContain(', and a conditional release of lien.')
    expect(screen.getByText('Page 2 of 3 · conditional release', { exact: false })).toBeTruthy()
    expect(screen.getByText('Page 3 of 3 · the notice', { exact: false })).toBeTruthy()
    expect(document.querySelector('[data-lien-desk-release]')?.textContent).toContain('a check from Loberg Contracting in the sum of $33,500.00 payable to Click Plumbing')
    expect(document.querySelector('[data-lien-desk-houses-counsel]')?.textContent).toBe('Counsel has not read the release paragraph yet.')
    fireEvent.click(tick)
    await settle()
    expect(voidReleaseMock).toHaveBeenCalledWith('rel-1', expect.anything())
    expect(tick.checked).toBe(false)
    expect(document.querySelector('[data-lien-desk-cover]')?.textContent).not.toContain('conditional release')
  })

  it('draws no card and no mark on a job that bought nothing (v2.4404)', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
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
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
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
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
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
      renderWithProviders(<LienJobSuppliersCard job={job} propertyKind="" todayYmd={TODAY} openBalance={33_500} payerName="Loberg Contracting" jobLabel="650 · ATI Schertz" isMobile={false} />)
      await settle()
      expect(screen.getByText('notice goes out Oct 14')).toBeTruthy()
      expect(screen.getByText('Reece said so · noted Sep 12 by Grace')).toBeTruthy()
      expect(screen.getByText('“on their list”')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /told us/ })).toBeNull()
    })
  })
})

describe('LienDeskModal · an evening stamp keeps its day (v2.4468)', () => {
  // 00:30 UTC on Sep 3 is 7:30 pm CDT on Sep 2; 01:00 UTC on Sep 11 is 8 pm CDT on Sep 10.
  const notice = { noticeDate: '2026-09-02', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '' }
  const packet = {
    id: 'sentE', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'sent', approval_mode: 'leader', drafted_by: 'u-taunya', submitted_at: '2026-09-02T20:00:00Z', approved_at: '2026-09-02T21:00:00Z', sent_at: '2026-09-03T00:30:00Z',
    fields: { notice, gcEmail: 'office@loberg.test', gcAuthorizedDirectPay: { at: '2026-09-11T01:00:00Z', name: 'Taunya', note: 'email from Loberg' } },
    cover_note: true, word_note: '', word_channel: '', hold_reason: '', hold_until: null, approved_by: 'u-robert', held_by: null, held_at: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, drafted_at: '2026-09-02T14:00:00Z', created_at: '2026-09-02T14:00:00Z', updated_at: '2026-09-03T00:30:00Z', voided_at: null,
  } as unknown as LienDeskItemRow

  it('the sent row, the sent footer, its day count and the GC’s okay read the Central day', () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true, noticed: true })), [packet], true)
    d.letterTwoByJob = letterTwoByJobFrom(d.items, () => 33_500, TODAY, formatYmdMonthDay)
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} />)
    const since = document.querySelector('[data-lien-since-sent]') as HTMLElement
    expect(since.textContent).toContain('Sent September 2, 2026')
    expect(since.textContent).toContain('Day 12')
    expect(since.textContent).toContain('GC authorized direct pay: yes · Sep 10 · email from Loberg')
    expect(document.body.textContent).toContain('sent Sep 2')
  })

  it('a correction set in the evening is carried from its Central day', () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    d.claimCorrectionsByJob = { j650: { jobId: 'j650', amountOff: 1_500, perMonth: null, reason: 'GC disputes the 8/14 change order', carry: true, setByName: 'Taunya', setAt: '2026-09-11T01:00:00Z', lookedAt: null, lookedByName: '' } }
    d.items = [{ ...packet, fields: { notice, gcEmail: '' }, sent_at: '2026-09-12T15:00:00Z' } as LienDeskItemRow]
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={d} />)
    expect((document.querySelector('[data-lien-claim-carry-strip]') as HTMLElement).textContent).toContain('Carrying Taunya’s correction from Sep 10:')
    expect((document.querySelector('[data-lien-claim-box]') as HTMLElement).textContent).toContain('Taunya · Sep 10 · “GC disputes the 8/14 change order”')
  })
})

describe('LienDeskModal · the pile titles stack (v2.4672)', () => {
  it('draws a sticky title per pile with its count and its place, no chip row; a press scrolls the list and lights the title', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} />)
    await settle()
    const head = document.querySelector('[data-lien-pile-head="needs_owner"]') as HTMLElement
    expect(head).toBeTruthy()
    expect(head.className).toBe('lienPileHead')
    expect(head.style.top).toBe('0px')
    expect(head.querySelector('[data-lien-pile-count="needs_owner"]')!.textContent).toBe('1')
    expect(screen.getAllByRole('button', { name: /Needs the owner/ })).toHaveLength(1)
    expect(document.querySelector('[data-lien-pile-rows="needs_owner"]')!.textContent).toContain('650 · ATI Schertz')
    const host = document.querySelector('[data-lien-desk-list]') as HTMLElement & { scrollTo: (o: unknown) => void }
    const scrollTo = vi.fn()
    host.scrollTo = scrollTo
    fireEvent.click(screen.getByRole('button', { name: /Needs the owner/ }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(head.getAttribute('data-on')).toBe('yes')
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
  })
  it('a list narrowed to one pile offers show every pile on its title, and widens on it', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} initialPile="needs_owner" />)
    await settle()
    expect(document.querySelectorAll('[data-lien-pile-head]')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-lien-pile-all]') as HTMLElement)
    expect(document.querySelector('[data-lien-pile-all]')).toBeNull()
    expect(document.querySelector('[data-lien-pile-head="needs_owner"]')).toBeTruthy()
  })
})

describe('LienDeskModal — the page labels stick (v2.4726)', () => {
  it('the page labels stack under the strip and at the foot like the pile titles, the one under the reader lit, each a button to its page', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const labels = Array.from(document.querySelectorAll('[data-lien-desk-page-label]')) as HTMLElement[]
    expect(labels.length).toBeGreaterThanOrEqual(2)
    // Stacked like the pile titles: the i-th label sits i bars from the top once passed and n-1-i bars from the bottom while ahead.
    expect(labels.map((l) => l.style.top)).toEqual(labels.map((_, i) => `${i * 30}px`))
    expect(labels.map((l) => l.style.bottom)).toEqual(labels.map((_, i) => `${(labels.length - 1 - i) * 30}px`))
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

describe('LienDeskModal — find on the list (v2.4721)', () => {
  it('narrows the piles as you type, writes the hidden fact that matched into the row, counts, says what to try when nothing matches, and the one match selects itself', async () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    await settle()
    const box = screen.getByTestId('lien-desk-find')
    expect(box.getAttribute('data-finding')).toBe('no')
    const input = screen.getByTestId('lien-desk-find-input') as HTMLInputElement
    // The owner's name is not on the row; the find still lands on it and says so.
    fireEvent.change(input, { target: { value: 'elbel' } })
    expect(screen.getByTestId('lien-desk-find-count').textContent).toBe('1 job')
    const list = document.querySelector('[data-lien-desk-list]') as HTMLElement
    expect(list.querySelector('[data-lien-find-hit="owner"]')?.textContent).toContain('owner Elbel Holdings LLC')
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
})
