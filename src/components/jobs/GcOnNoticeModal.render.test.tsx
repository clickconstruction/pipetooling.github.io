// @vitest-environment jsdom
/**
 * Render smokes for Put a GC on notice (v2.3470): the strip and the deciding
 * box, Step 1's owner rows (on file · public excluded · a miss the roll
 * answers with Use / Use all found), Step 2's month chips with a closed window
 * named, the reason and the three ticks, and the footer buttons by role.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import GcOnNoticeModal from './GcOnNoticeModal'
import { buildGcOnNotice, type GcUnpaidMonthRow } from '../../lib/jobs/gcOnNotice'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou } from '../../lib/jobs/lienDesk'
import type { GcOnNoticeData } from '../../hooks/useGcOnNoticeData'
import { resetPropertyLookupCache } from '../../lib/customers/propertyLookupCache'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const confirmMock = vi.fn(async (_input: unknown) => ({ updated: ['addr-1016'], inserted: [], skipped: [] }))
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({ confirmOwnerForProperty: (input: unknown) => confirmMock(input), stampOwnerConfirmed: vi.fn() }))
vi.mock('../../lib/customers/propertyLookupClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/customers/propertyLookupClient')>('../../lib/customers/propertyLookupClient')
  return {
    ...actual,
    lookupPropertyRecord: async (address: string) => ({
      ok: true,
      parcel: { propId: 'R1388', ownerName: 'HARBOR RIDGE HOMES LP', nameCare: '', legalDescription: 'Lot 9 Harbor Ridge', situsAddress: address, mailingAddress: 'PO BOX 1180, KYLE TX 78640', county: 'Hays', source: 'Hays CAD', taxYear: '2025' },
      parcelError: null,
      proposal: { found: true, county: { county: 'Hays', source: 'parcel', confidence: 'high' }, legalDescription: 'Lot 9 Harbor Ridge', ownerName: '', ownerCompany: 'HARBOR RIDGE HOMES LP', ownerMode: 'building_owner', ownerMailingAddress: 'PO BOX 1180, KYLE TX 78640', homestead: 'no', provenance: { source: 'Hays CAD', taxYear: '2025', propId: 'R1388' } },
    }),
  }
})
const hookState: { data: GcOnNoticeData | null; loading: boolean } = { data: null, loading: false }
const refetch = vi.fn()
vi.mock('../../hooks/useGcOnNoticeData', () => ({ useGcOnNoticeData: () => ({ data: hookState.data, loading: hookState.loading, refetch }) }))

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<GcUnpaidMonthRow> = {}): GcUnpaidMonthRow {
  return { job_id, work_month, approved_hours: 8, deadline, noticed: false, open_balance: 12400, customer_id: 'c1', gc_customer_id: 'harborline', property_kind: '', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, is_billed: true, job_status: 'billed', last_work_month: work_month, ...extra }
}

function data(): GcOnNoticeData {
  const rows = [
    row('j994', '2026-05', '2026-07-15', { open_balance: 18750, property_kind: 'residential' }),
    row('j994', '2026-08', '2026-10-15', { open_balance: 18750, property_kind: 'residential', last_work_month: '2026-08' }),
    row('j1016', '2026-07', '2026-10-15', { open_balance: 12400, has_owner: false }),
    row('j1002', '2026-07', '2026-10-15', { open_balance: 11300 }),
    row('j1031', '2026-07', '2026-10-15', { open_balance: 9800, is_billed: false, job_status: 'working' }),
  ]
  const owners = { j994: 'on_file', j1016: 'missing', j1002: 'public', j1031: 'on_file' } as const
  const folded = buildGcOnNotice(rows, [], (id) => owners[id as keyof typeof owners], TODAY)
  const queue = buildLienDeskQueue(rows, [], { harborline: 'ask' }, TODAY)
  const job = (id: string, hcp: string, name: string, addr: string) => ({ id, hcp_number: hcp, click_number: null, job_name: name, job_address: addr, customer_id: 'c1', customer_name: 'Owner', gc_customer_id: 'harborline', customer_address_id: null, revenue: 10000, payments_made: 0, master_user_id: null })
  const jobsById = {
    j994: job('j994', '994', 'Miller residence', '212 Kettle Dr, Buda, TX'),
    j1016: job('j1016', '1016', 'Lot 9 Harbor Ridge', '1388 Ridgeline Ct, Kyle, TX'),
    j1002: job('j1002', '1002', 'Kyle fire station 3', '800 W Center St, Kyle, TX'),
    j1031: job('j1031', '1031', 'Lot 14 Harbor Ridge', '1401 Ridgeline Ct, Kyle, TX'),
  }
  const ownerRow = (jobId: string) => {
    const j = jobsById[jobId as keyof typeof jobsById]
    return { jobId, hcpNumber: j.hcp_number, clickNumber: '', jobAddress: j.job_address, status: 'billed', customerId: 'c1', customerName: 'Owner', gcCustomerId: 'harborline', gcName: 'Harborline Builders', customerAddressId: null, hasOwner: jobId !== 'j1016', ownerConfirmed: jobId !== 'j1016', propertyKind: '', firstWorkMonth: '2026-07', firstDeadline: '2026-10-15' }
  }
  return {
    gc: { id: 'harborline', name: 'Harborline Builders', address: '1900 Kohlers Crossing, Kyle TX', email: 'ap@harborline.test', policy: 'ask', policyNote: '' },
    gcTerms: 'standard',
    rows,
    jobs: folded.jobs,
    summary: folded.summary,
    desk: { queue, summary: summarizeLienDeskForNeedsYou(queue), rows, items: [], affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } }, affidavitRows: [], jobsById, gcsById: {}, addressesById: {}, ownerByJob: {}, promisesByJob: {}, gcsWithPriorNotice: new Set(), gcsHeldBefore: new Set() },
    ownerRowByJob: { j994: ownerRow('j994'), j1016: ownerRow('j1016'), j1002: ownerRow('j1002'), j1031: ownerRow('j1031') },
    countyByJob: { j994: 'Hays' },
    ownerLineByJob: { j994: 'D. & A. Miller · mail to 212 Kettle Dr, Buda', j1002: 'City of Kyle · mail to PO Box 40, Kyle', j1031: 'Harbor Ridge Homes LP · mail to PO Box 1180, Kyle' },
    gcHasPriorNotice: false,
    gcHeldBefore: false,
    promise: null,
    legalMatterJobIds: [],
    legalMatterExists: false,
  }
}

const baseProps = { open: true, gcId: 'harborline', onClose: () => {}, todayYmd: TODAY, authUserId: 'u1', authName: 'Taunya', issuer: null, signerNameFor: () => 'Malachi Whites, Master Plumber', onOpenEditJob: () => {}, onChanged: () => {} }

afterEach(() => {
  cleanup()
  resetPropertyLookupCache()
  confirmMock.mockClear()
})

describe('GcOnNoticeModal', () => {
  it('reads the strip and the deciding box, lists the owners with the roll’s answer, names a closed window, and offers the leader Approve all', async () => {
    hookState.data = data()
    renderWithProviders(<GcOnNoticeModal {...baseProps} authRole="master_technician" />)
    expect(screen.getByRole('dialog', { name: 'Put a GC on notice' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Put Harborline Builders on notice/ })).toBeTruthy()
    // the strip: 4 jobs, 3 billed · 1 not yet billed; owners 3 of 4 on file (994, 1002 public, 1031)
    expect(screen.getByText('3 billed · 1 not yet billed')).toBeTruthy()
    expect(screen.getByText('3 of 4 on file')).toBeTruthy()
    expect(screen.getByText(/first notice we've sent them/)).toBeTruthy()
    // Step 1: the public owner is excluded; the roll answers 1016
    const rows = screen.getAllByTestId('gc-notice-owner-row')
    expect(rows).toHaveLength(4)
    expect(screen.getByText(/public owner — bond claim, not a lien/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Harbor Ridge Homes Lp/)).toBeTruthy())
    expect(screen.getByRole('button', { name: /Use all found · 1/ })).toBeTruthy()
    // Step 2: 994's May window is closed and named as information; 1031 claims its contract balance
    expect(screen.getByText(/May · was due Jul 15 · window closed/)).toBeTruthy()
    expect(screen.getByText(/May is named as information/)).toBeTruthy()
    expect(screen.getByText('unbilled · contract balance')).toBeTruthy()
    expect(screen.getAllByTestId('gc-notice-claim-row')).toHaveLength(3)
    // Step 3: the letter, seeded for the GC, with its fills and the attorney note
    const letter = screen.getByLabelText('Cover letter') as HTMLTextAreaElement
    expect(letter.value).toContain('working under Harborline Builders')
    expect(letter.value).toContain('{{months}}')
    expect(screen.getByText(/Attorney wording pending/)).toBeTruthy()
    // Step 4: the reason and the ticks
    expect(screen.getByText('GC is not paying its subs')).toBeTruthy()
    expect(screen.getByText(/starts the moment this run is recorded/)).toBeTruthy()
    // the footer: 2 ready (994, 1031), 1 waits on the roll, 1 public
    expect(screen.getByText(/2 ready now · 1 more the moment Use all found is pressed · 1 left out \(public owner\)/)).toBeTruthy()
    expect(screen.getByTestId('gc-notice-approve-all').textContent).toContain('Approve all 2 and send the run')
    expect(screen.queryByRole('button', { name: /Send all .* to the leader/ })).toBeNull()
    // Use on the roll's row writes the property and re-reads
    fireEvent.click(screen.getByTestId('gc-notice-use'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(refetch).toHaveBeenCalled()
  })

  it('the office sees Send all to the leader and the spoken-word door, not Approve all; an empty GC reads calm', () => {
    hookState.data = data()
    renderWithProviders(<GcOnNoticeModal {...baseProps} authRole="assistant" />)
    expect(screen.getByRole('button', { name: /Send all 2 to the leader/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /The leader said to send them/ })).toBeTruthy()
    expect(screen.queryByTestId('gc-notice-approve-all')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /The leader said to send them/ }))
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Record it and send all 2/ })).toBeTruthy()
    cleanup()
    hookState.data = { ...data(), jobs: [], summary: { ...data().summary, jobs: 0 } }
    renderWithProviders(<GcOnNoticeModal {...baseProps} authRole="assistant" />)
    expect(screen.getByText(/No job with unpaid work and approved hours names Harborline Builders/)).toBeTruthy()
  })
})
