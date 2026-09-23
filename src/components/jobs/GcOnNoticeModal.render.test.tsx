// @vitest-environment jsdom
/**
 * Render smokes for Put a GC on notice (v2.3470): the strip and the deciding
 * box, Step 1's owner rows (on file · public excluded · a miss the roll
 * answers with Use / Use all found), Step 2's month chips with a closed window
 * named, the reason and the three ticks, and the footer buttons by role.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_LIEN_RETAINAGE_QUEUE } from '../../lib/jobs/lienDeskRetainage'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
const savePropertyKindMock = vi.fn(async (..._args: unknown[]) => {})
vi.mock('../../lib/jobs/propertyKindWrite', () => ({ savePropertyKind: (...args: unknown[]) => savePropertyKindMock(...args) }))
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

type OwnerStates = Record<'j994' | 'j1016' | 'j1002' | 'j1031', 'on_file' | 'missing' | 'public' | 'unconfirmed'>

function data(owners: OwnerStates = { j994: 'on_file', j1016: 'missing', j1002: 'public', j1031: 'on_file' }): GcOnNoticeData {
  const rows = [
    row('j994', '2026-05', '2026-07-15', { open_balance: 18750, property_kind: 'residential' }),
    row('j994', '2026-08', '2026-10-15', { open_balance: 18750, property_kind: 'residential', last_work_month: '2026-08' }),
    row('j1016', '2026-07', '2026-10-15', { open_balance: 12400, has_owner: false }),
    row('j1002', '2026-07', '2026-10-15', { open_balance: 11300 }),
    row('j1031', '2026-07', '2026-10-15', { open_balance: 9800, is_billed: false, job_status: 'working' }),
  ]
  const folded = buildGcOnNotice(rows, [], (id) => owners[id as keyof OwnerStates], TODAY)
  const queue = buildLienDeskQueue(rows, [], { harborline: 'ask' }, TODAY)
  const job = (id: string, hcp: string, name: string, addr: string, addressId: string | null = null) => ({ id, hcp_number: hcp, click_number: null, job_name: name, job_address: addr, customer_id: 'c1', customer_name: 'Owner', gc_customer_id: 'harborline', customer_address_id: addressId, revenue: 10000, payments_made: 0, master_user_id: null, last_work_date: null })
  const jobsById = {
    j994: job('j994', '994', 'Miller residence', '212 Kettle Dr, Buda, TX', 'addr-kettle'),
    j1016: job('j1016', '1016', 'Lot 9 Harbor Ridge', '1388 Ridgeline Ct, Kyle, TX', 'addr-ridge'),
    j1002: job('j1002', '1002', 'Kyle fire station 3', '800 W Center St, Kyle, TX'),
    j1031: job('j1031', '1031', 'Lot 14 Harbor Ridge', '1401 Ridgeline Ct, Kyle, TX', 'addr-ridge'),
  }
  const ownerRow = (jobId: string) => {
    const j = jobsById[jobId as keyof typeof jobsById]
    return { jobId, hcpNumber: j.hcp_number, clickNumber: '', jobAddress: j.job_address, status: 'billed', customerId: 'c1', customerName: 'Owner', gcCustomerId: 'harborline', gcName: 'Harborline Builders', customerAddressId: null, hasOwner: jobId !== 'j1016', ownerConfirmed: jobId !== 'j1016', propertyKind: '', firstWorkMonth: '2026-07', firstDeadline: '2026-10-15', firstMonthFromCreation: false }
  }
  return {
    gc: { id: 'harborline', name: 'Harborline Builders', address: '1900 Kohlers Crossing, Kyle TX', email: 'ap@harborline.test', policy: 'ask', policyNote: '' },
    gcTerms: 'standard',
    rows,
    jobs: folded.jobs,
    summary: folded.summary,
    desk: { queue, summary: summarizeLienDeskForNeedsYou(queue), rows, items: [], affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } }, affidavitRows: [],
    retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
    retainageRows: [], letterTwoByJob: {}, jobsById, gcsById: {}, addressesById: {}, ownerByJob: {}, promisesByJob: {}, gcsWithPriorNotice: new Set(), gcsHeldBefore: new Set() , claimCorrectionsByJob: {}, filingsByJob: {},},
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
  it('reads the brief and the step bar, lists the owners with the roll’s answer, names a closed window, and offers the leader Approve all', async () => {
    hookState.data = data()
    renderWithProviders(<GcOnNoticeModal {...baseProps} authRole="master_technician" />)
    expect(screen.getByRole('dialog', { name: 'Put a GC on notice' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Put Harborline Builders on notice/ })).toBeTruthy()
    // the brief says the money once: 4 jobs, 3 billed · 1 not yet billed
    const brief = screen.getByTestId('gc-notice-brief')
    expect(brief.textContent).toContain('across 4 jobs')
    expect(brief.textContent).toContain('open on bills · 3 jobs')
    expect(brief.textContent).toContain('not yet billed · 1 job')
    expect(screen.getByText(/first notice we've sent them/)).toBeTruthy()
    // the step bar (v2.3665): four steps, each with its live status; owners still wants someone (1016 is missing)
    const bar = screen.getAllByTestId('gc-notice-stepbar-step')
    expect(bar.map((b) => b.textContent?.replace(/^[✓\d]/, ''))).toEqual([
      expect.stringMatching(/^Owners3 of 4 on file/),
      expect.stringMatching(/^Claims2 notices · /),
      'Cover letterincluded',
      'DecisionGC is not paying its subs · 3 changes',
    ])
    expect(bar[0]!.dataset.tone).toBe('attention')
    expect(bar[0]!.getAttribute('aria-current')).toBe('step')
    expect(screen.getByTestId('gc-notice-owners-pill').textContent).toBe('3 of 4 on file')
    expect(screen.getByRole('region', { name: 'Step 2 · What each notice claims' })).toBeTruthy()
    // Step 1 opens by itself while an owner is wanted, the rows that want someone first; the public owner is excluded; the roll answers 1016
    const rows = screen.getAllByTestId('gc-notice-owner-row')
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.dataset.ownerState).lastIndexOf('on_file')).toBe(3)
    expect(rows[0]!.dataset.ownerState).not.toBe('on_file')
    expect(screen.getByText(/public owner — bond claim, not a lien/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Harbor Ridge Homes Lp/)).toBeTruthy())
    expect(screen.getByRole('button', { name: /Use all found · 1/ })).toBeTruthy()
    // Step 2: 994's May window is closed and named as information; 1031 claims its contract balance
    // — a closed month is a quiet column with its date in the tooltip; the windows still open carry the color; the table totals
    expect(screen.getByTitle(/^May · was due Jul 15 · window closed/).textContent).toContain('May')
    expect(screen.getAllByTestId('gc-notice-open-month').length).toBeGreaterThan(0)
    expect(screen.getByText(/still named as information: its lien is gone/)).toBeTruthy()
    expect(screen.getByTestId('gc-notice-claim-total').textContent).toContain('3 notices')
    expect(screen.getByText('unbilled · contract balance')).toBeTruthy()
    expect(screen.getAllByTestId('gc-notice-claim-row')).toHaveLength(3)
    // Step 3: the letter, seeded for the GC, with its fills and the attorney note
    const letter = screen.getByLabelText(/^Cover letter — /) as HTMLTextAreaElement
    expect(letter.value).toContain('working under Harborline Builders')
    expect(letter.value).toContain('{{months}}')
    expect(screen.getByText(/Counsel's wording/)).toBeTruthy()
    // Step 4: the reason and the ticks
    expect(screen.getByText('GC is not paying its subs')).toBeTruthy()
    expect(screen.getByText(/Starts the moment this run is recorded/)).toBeTruthy()
    // — each tick is a named change with its before and after
    expect(screen.getAllByTestId('gc-notice-change').map((c) => c.textContent)).toEqual([
      expect.stringContaining('Send future notices without askingStanding rule: ask each time → send without asking'),
      expect.stringContaining('Wind the account down'),
      expect.stringContaining('Open a Legal desk matter with all 4 jobs'),
    ])
    // the footer: 2 ready (994, 1031), 1 waits on the roll, 1 public
    expect(screen.getByText(/2 ready now · 1 more the moment Use all found is pressed · 1 left out \(public owner\)/)).toBeTruthy()
    // the spoken-word door is the secondary button beside it (the leader may use it too)
    expect(screen.getByTestId('gc-notice-approve-all').textContent).toContain('Approve all 2 and send the run')
    expect(screen.queryByRole('button', { name: /Send all .* to the leader/ })).toBeNull()
    // the fill is a literal that holds in dark mode (v2.3664), and the overlay ends above the Dispatch / Job mode footer
    expect(screen.getByTestId('gc-notice-approve-all').style.background).toBe('rgb(22, 101, 52)')
    expect(screen.getByRole('dialog', { name: 'Put a GC on notice' }).style.bottom).toBe('var(--app-bottom-chrome, 0px)')
    // Use on the roll's row writes the property and re-reads
    fireEvent.click(screen.getByTestId('gc-notice-use'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(refetch).toHaveBeenCalled()
  })

  it('folds Step 1 to one line once every owner is on the job, and says the unknown property kind once', async () => {
    hookState.data = data({ j994: 'on_file', j1016: 'on_file', j1002: 'on_file', j1031: 'on_file' })
    renderWithProviders(<GcOnNoticeModal {...baseProps} authRole="master_technician" />)
    const bar = screen.getAllByTestId('gc-notice-stepbar-step')
    expect(bar[0]!.dataset.tone).toBe('done')
    expect(bar[0]!.textContent).toBe('✓Owners4 of 4 on file')
    expect(screen.getByText('Every job has an owner of record on the job. Nothing to do here.')).toBeTruthy()
    expect(screen.queryAllByTestId('gc-notice-owner-row')).toHaveLength(0)
    expect(screen.queryByTestId('gc-notice-use-all')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show the 4 owners/ }))
    expect(screen.getAllByTestId('gc-notice-owner-row')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /Hide the owners/ }))
    expect(screen.queryAllByTestId('gc-notice-owner-row')).toHaveLength(0)
    // 994 is residential; the other three have no kind — one sentence, and the answer is asked on the row (v2.3667)
    expect(screen.getByTestId('gc-notice-kind-callout').textContent).toContain("Property kind isn't set on 3 of these 4 jobs.")
    const rows = screen.getAllByTestId('gc-notice-claim-row')
    const rowOf = (n: string) => rows.find((r) => r.textContent?.startsWith(n))!
    // — answered: the word and a way back in
    expect(rowOf('994').textContent).toContain('residential · change')
    // — 1016 and 1031 sit at one saved property: a switch each, and each says so
    expect(screen.getAllByTestId('property-kind-switch')).toHaveLength(2)
    expect(rowOf('1016').textContent).toContain('same property as 1031')
    expect(rowOf('1031').textContent).toContain('same property as 1016')
    // — 1002 has no saved property to keep the answer on: Edit Job's Property record row links one
    expect(within(rowOf('1002')).getByRole('button', { name: 'link a property ›' })).toBeTruthy()
    fireEvent.click(within(rowOf('1016')).getByRole('button', { name: 'Commercial' }))
    await waitFor(() => expect(savePropertyKindMock).toHaveBeenCalledWith('addr-ridge', 'non_residential'))
    expect(refetch).toHaveBeenCalled()
    // change re-opens the switch with the answer pressed
    fireEvent.click(within(rowOf('994')).getByRole('button', { name: 'change' }))
    expect(within(rowOf('994')).getByRole('button', { name: 'Residential' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('gc-notice-claim-total').textContent).toContain('4 notices')
  })

  it('reads a notice before approving it: a month, a row or Preview all open the job’s notice over the window; ‹ › walk the run; Esc closes only the preview (v2.3668)', async () => {
    hookState.data = data({ j994: 'on_file', j1016: 'on_file', j1002: 'public', j1031: 'on_file' })
    const onClose = vi.fn()
    renderWithProviders(<GcOnNoticeModal {...baseProps} onClose={onClose} authRole="master_technician" />)
    // a notice per job with months and a private owner: 994, 1016, 1031 — the city's fire station has none
    expect(screen.getByTestId('gc-notice-preview-all').textContent).toBe('Preview all 3 ›')
    expect(screen.queryByTestId('gc-notice-preview')).toBeNull()
    // — a month opens its job's notice, and the month is ringed in the side list
    const rows = screen.getAllByTestId('gc-notice-claim-row')
    fireEvent.click(within(rows.find((r) => r.textContent?.startsWith('994'))!).getByTestId('gc-notice-open-month'))
    const preview = screen.getByTestId('gc-notice-preview')
    expect(within(preview).getByRole('heading', { name: '994 · Miller residence' })).toBeTruthy()
    expect(screen.getByTestId('gc-notice-preview-count').textContent).toBe('1 of 3')
    expect(screen.getByTestId('gc-notice-preview-to').textContent).toContain('D. & A. Miller')
    // one notice names both of 994's months — the closed May and the open August, which was the one clicked
    expect(screen.getAllByTestId('gc-notice-preview-month').map((m) => `${m.dataset.on}:${m.textContent}`)).toEqual(['no:Maywindow closed', expect.stringMatching(/^yes:Augby Oct 15/)])
    // the owner's copy: the letter filled for this job, then the form
    expect(screen.getAllByTestId('gc-notice-preview-page-label').map((l) => l.textContent)).toEqual(['Page 1 of 2 · cover letter', 'Page 2 of 2 · the notice'])
    expect(preview.textContent).toContain('To the owner of 212 Kettle Dr, Buda, TX')
    expect(preview.textContent).not.toContain('{{')
    expect(preview.textContent).toContain('Notice of Claim for Unpaid Labor or Materials')
    // the GC's copy is the form alone
    fireEvent.click(within(preview).getByRole('button', { name: "GC's copy" }))
    expect(screen.getAllByTestId('gc-notice-preview-page-label').map((l) => l.textContent)).toEqual(['Page 1 of 1 · the notice'])
    expect(screen.getByTestId('gc-notice-preview-to').textContent).toContain('Harborline Builders')
    // › walks the run without closing; it stops at the end
    fireEvent.click(within(preview).getByRole('button', { name: 'Next notice' }))
    expect(screen.getByTestId('gc-notice-preview-count').textContent).toBe('2 of 3')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('gc-notice-preview-count').textContent).toBe('3 of 3')
    expect((within(preview).getByRole('button', { name: 'Next notice' }) as HTMLButtonElement).disabled).toBe(true)
    // Esc closes the preview and never the window under it
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('gc-notice-preview')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Put a GC on notice' })).toBeTruthy()
    // — the row and its Preview door open it too; the row's own controls keep their clicks
    fireEvent.click(within(rows.find((r) => r.textContent?.startsWith('1031'))!).getByTestId('gc-notice-preview-row'))
    expect(within(screen.getByTestId('gc-notice-preview')).getByRole('heading', { name: '1031 · Lot 14 Harbor Ridge' })).toBeTruthy()
    // clicking the backdrop closes the preview only
    fireEvent.click(screen.getByTestId('gc-notice-preview'))
    expect(screen.queryByTestId('gc-notice-preview')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(within(rows.find((r) => r.textContent?.startsWith('1016'))!).getByRole('button', { name: 'Residential' }))
    expect(screen.queryByTestId('gc-notice-preview')).toBeNull()
    // untick the letter in Step 3 and the owner reads the standard cover note instead — the preview is the window's live state
    fireEvent.click(screen.getByLabelText(/Include the cover letter/))
    fireEvent.click(screen.getByTestId('gc-notice-preview-all'))
    expect(screen.getAllByTestId('gc-notice-preview-page-label')[0]!.textContent).toBe('Page 1 of 2 · cover note')
    expect(screen.getByTestId('gc-notice-preview').textContent).not.toContain('To the owner of')
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
    expect(screen.getByText(/No job with unpaid work names Harborline Builders/)).toBeTruthy()
  })
})
