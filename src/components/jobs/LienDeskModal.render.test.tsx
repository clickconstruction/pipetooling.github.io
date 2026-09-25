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
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskModal from './LienDeskModal'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from '../../lib/jobs/lienDesk'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { buildLienAffidavitQueue, type LienAffidavitRow } from '../../lib/jobs/lienDeskAffidavits'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import { resetPropertyLookupCache } from '../../lib/customers/propertyLookupCache'

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
vi.mock('../../lib/jobs/propertyKindWrite', () => ({
  savePropertyKind: (...args: unknown[]) => savePropertyKindMock(...args),
  savePropertyHomestead: vi.fn(),
}))
const startTwoMock = vi.fn()
const gcOkayMock = vi.fn()
const ownerCallMock = vi.fn()
vi.mock('../../lib/jobs/lienDeskIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/lienDeskIo')>('../../lib/jobs/lienDeskIo')
  return { ...actual, startLetterTwo: (input: unknown) => startTwoMock(input), noteGcAuthorizedDirectPay: (...args: unknown[]) => gcOkayMock(...args), noteOwnerCall: (...args: unknown[]) => ownerCallMock(...args) }
})
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({
  confirmOwnerForProperty: (input: unknown) => confirmMock(input),
  stampOwnerConfirmed: (id: string, userId: string | null) => stampMock(id, userId),
}))

afterEach(cleanup)
beforeEach(() => {
  resetPropertyLookupCache()
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
  it('lists the job under Needs the owner, blocks the send, and offers the Find the owner door', () => {
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} onOpenEditJob={onOpenEditJob} />)
    expect(screen.getByRole('dialog', { name: 'Lien desk' })).toBeTruthy()
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
    expect(onOpenEditJob).toHaveBeenCalledWith('j650')
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Owner of record missing')
    // The gates (v2.3657): the verdict is the headline, gate 1 is the one blocker, and its detail is numbered to match.
    const gatesBox = document.querySelector('[data-lien-desk-gates]') as HTMLElement
    expect(gatesBox.textContent).toContain("Can't go out yet1 blocker · 1 to check")
    expect((gatesBox.querySelector('[data-gate="owner"]') as HTMLElement).getAttribute('data-tone')).toBe('blocker')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1 · Owner of record')
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

  it('with the owner on file the office can send for approval or record the leader’s spoken word', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
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

  it('a "send" rule with no notice recorded to the GC still sends the first one to the leader (v2.3469)', () => {
    const d = data(J650.map((r) => ({ ...r, has_owner: true })), [], true)
    const loberg = { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'send' as const, policyNote: '' }
    const withRule: LienDeskData = { ...d, gcsById: { loberg }, queue: buildLienDeskQueue(d.rows, d.items, { loberg: 'send' }, TODAY) }
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={withRule} />)
    expect(screen.getByRole('button', { name: /Send for approval/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Put it in the run/ })).toBeNull()
    expect((document.querySelector('[data-lien-desk-next]') as HTMLElement).textContent).toContain('Goes to the leader · first notice to this GC — the rule starts with the next one')
  })

  it('the leader sees what he is deciding, the standing rule, and Approve & next / Hold on an awaiting item', () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    expect(screen.getByRole('button', { name: /Awaiting approval/ }).textContent).toContain('1')
    expect(screen.getByText("What you're deciding")).toBeTruthy()
    expect(screen.getByText(/Open with Loberg Contracting/)).toBeTruthy()
    expect(screen.getByText(/Jun 2026's lien right ends September 15, 2026/)).toBeTruthy()
    expect(screen.getByText(/Standing rule for Loberg Contracting/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Send notices without asking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve & next/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hold — I'll call first/ }))
    expect(screen.getByText(/then asks again/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hold' })).toBeTruthy()
  })

  it('the office sees an awaiting item as waiting on the leader, and nothing due reads calm', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="controller" data={data([])} />)
    expect(screen.getByText(/Nothing is due/)).toBeTruthy()
  })

  it('“he is here” (v2.3813): the office’s awaiting footer records the leader’s word at the desk, with the presence line', () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" authName="Wendi" data={data(J650, [awaiting], true)} />)
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

  it('the leader’s own awaiting footer has no “he is here” — he approves', () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    expect(screen.queryByRole('button', { name: /He is here/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Approve & next/ })).toBeTruthy()
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

  it('a public owner on the record reads the bond-claim sentence and is not draftable', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true, { owner_company: 'CITY OF ROUND ROCK', owner_mailing_address: '221 E Main St, Round Rock, TX', owner_confirmed_at: '2026-09-14T00:00:00Z' })} />)
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
  it('switches to the affidavit kind, lists the window with its missing gates, and offers the property door', () => {
    const affRow: LienAffidavitRow = { job_id: 'j650', last_month: '2026-05', deadline: '2026-09-15', is_sub: true, noticed: false, filed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null }
    const d = data([])
    d.affidavitRows = [affRow]
    d.affidavits = buildLienAffidavitQueue([affRow], [], TODAY)
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={d} onOpenEditJob={onOpenEditJob} initialKind="affidavit" />)
    expect(screen.getByRole('tab', { name: /Affidavits · 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Needs the property facts/ }).textContent).toContain('1')
    expect(screen.getByText(/missing owner, legal, notice/)).toBeTruthy()
    const timeline = document.querySelector('[data-lien-desk-timeline]') as HTMLElement
    expect(timeline.textContent).toContain('File the affidavit — tomorrow · owner of record, legal description, the notice missing.')
    expect(timeline.textContent).toContain('Commercial dates shown — a residential property is a month earlier.')
    expect(screen.getByText(/Before this affidavit can be generated/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Property record ›' })[0]!)
    expect(onOpenEditJob).toHaveBeenCalledWith('j650')
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

  it('the paper is the editor (v2.3694): a shaded value becomes a box in place, Enter keeps it, the label counts it, Back puts the job’s wording back', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={officeWithOwner()} />)
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
    expect((gatesBox.querySelector('[data-gate-detail="kind"]') as HTMLElement).textContent).toContain('3 · Property kind')
    // Every gate has its section (v2.3670): the clear ones say the fact the notice will use.
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('1 · Owner of recordElbel Holdings LLC4 Example Way, Schertz, TXCheck on Guadalupe CAD ↗Change ›')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).textContent).toContain('From the property record')
    expect((gatesBox.querySelector('[data-gate-detail="gc"]') as HTMLElement).textContent).toContain('2 · Original contractorLoberg Contracting · 2904 Corporate Cr, Flower Mound, TX')
    expect((gatesBox.querySelector('[data-gate-detail="months"]') as HTMLElement).textContent).toContain('4 · Approved hoursJun 2026 · 82.6 approved hours · on this notice')
    expect(screen.getByRole('button', { name: 'Change the GC ›' })).toBeTruthy()
    // A cell is a button that brings its section up: both wear the ring.
    fireEvent.click(gatesBox.querySelector('[data-gate="gc"]') as HTMLElement)
    expect((gatesBox.querySelector('[data-gate="gc"]') as HTMLElement).getAttribute('data-active')).toBe('yes')
    expect((gatesBox.querySelector('[data-gate-detail="gc"]') as HTMLElement).getAttribute('data-active')).toBe('yes')
    expect((gatesBox.querySelector('[data-gate-detail="owner"]') as HTMLElement).getAttribute('data-active')).toBe('no')
    // Gate 3 on a linked property is the switch itself (v2.3667's, set in place): a pick writes the property's kind and re-reads.
    expect(screen.queryByRole('button', { name: /Set property kind/ })).toBeNull()
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
    expect(jul.textContent).toContain('mail by Oct 15')
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
  it('is page 3 of 3 under the notice when the job has unpaid bills, with the count and the total, and the count moves with the cover note', () => {
    payPageState.rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
    payPageState.assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }
    try {
      renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
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
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }))
    fireEvent.change(within(dialog).getByLabelText('How much they still owe the GC'), { target: { value: '14,000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reserved · still held' }))
    expect(dialog.querySelector('[data-lien-owner-call-pile]')!.getAttribute('data-lien-owner-call-pile')).toBe('A')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the call' }))
    await waitFor(() => expect(ownerCallMock).toHaveBeenCalled())
    expect(ownerCallMock.mock.calls[0]![0]).toMatchObject({ id: 'sent1' })
    expect(ownerCallMock.mock.calls[0]![1]).toMatchObject({ name: 'Taunya', owesGc: 'yes', owesAmount: 14_000, reserved: 'held', originalContractCompletedOn: null })
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
})
