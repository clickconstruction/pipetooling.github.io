/**
 * Papers before a job opens, step 6: the lock on a sub's own page, as the two edge functions ask it and apply it. The
 * database's answers are faked here. Made-up names only: job J2391 Cedar Bluff Lofts at 1200 Quarry Rd for Ridgeway
 * Builders, job J2402 Marsh water heater at 88 Linden Ct, and the sub Tall Pine Excavating.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
// Deno edge modules (supabase/functions/_shared), tested here.
import {
  JOB_PAPERS_FIRST_WORDS,
  JOB_PAPERS_UNREAD_WORDS,
  PAPERS_FIRST_LINE,
  blankShutBooking,
  blankShutOffer,
  blankShutPaperSheet,
  blankShutPapers,
  blankShutPaymentMemos,
  blankShutSheet,
  blankShutSubPortalRows,
  commitmentJobId,
  jobShutByPapers,
  jobShutToPerson,
  jobsRequiringPapers,
  jobsWaitingOnPerson,
  personJobPapers,
  personJobPapersFrom,
  readSubPortalJobIds,
  sheetJobMap,
  shutJobRefusal,
  subPortalJobIds,
  type JobPapersAdmin,
  type JobPapersQuery,
} from '../../../supabase/functions/_shared/subPortalJobPapers'
import {
  attachSheetAgreements,
  buildSubOffers,
  buildSubPaymentLines,
  buildSubSheets,
  buildSubTotals,
  type SubAgreementRow,
  type SubItemRow,
  type SubOfferRow,
  type SubPaymentRow,
  type SubPortalBooking,
  type SubSheetRow,
} from '../../../supabase/functions/_shared/subPortalStatement'
import { buildSubPortalPapers, type SubPortalPapers } from '../../../supabase/functions/_shared/subPortalPapers'
import { harlanRows } from './subPortalPapersFixture'

const TODAY = '2026-11-17'
const CEDAR = 'job-cedar'
const MARSH = 'job-marsh'
const TALL_PINE = 'person-tall-pine'

const NDA = { id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, document_id: null, status: 'none', signed_at: null }
const SITE = { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, document_id: null, status: 'none', signed_at: null }

afterEach(() => vi.restoreAllMocks())

// ── A faked service-role client ──────────────────────────────────────────────────────────────────────────────

type Rows = Record<string, Array<Record<string, unknown>>>
type Call = { fn: string; args: Record<string, unknown> }

/**
 * `tables` answers `from(table)` with its rows, filtered by the `eq`, `in` and `is` the code asks for. `papers`
 * answers `job_papers_for_person` per job. A table or a job named in `broken` answers with an error.
 */
function adminOf(tables: Rows, papers: Record<string, unknown> = {}, broken: { tables?: string[]; jobs?: string[] } = {}, calls: Call[] = []): JobPapersAdmin {
  const query = (table: string, rows: Array<Record<string, unknown>>): JobPapersQuery => ({
    eq: (column, value) => query(table, rows.filter((r) => r[column] === value)),
    in: (column, values) => query(table, rows.filter((r) => values.includes(String(r[column])))),
    is: (column, value) => query(table, rows.filter((r) => (r[column] ?? null) === value)),
    limit: () => query(table, rows),
    then: (onfulfilled, onrejected) => Promise.resolve(broken.tables?.includes(table) ? { data: null, error: { message: `${table} refused` } } : { data: rows, error: null }).then(onfulfilled, onrejected),
  })
  return {
    rpc: (fn, args = {}) => {
      calls.push({ fn, args })
      const jobId = String(args.p_job_id)
      if (fn !== 'job_papers_for_person' || broken.jobs?.includes(jobId)) return Promise.resolve({ data: null, error: { message: `no answer for ${fn}` } })
      return Promise.resolve({ data: papers[jobId] ?? { job_number: '', papers: [] }, error: null })
    },
    from: (table) => ({ select: () => query(table, tables[table] ?? []) }),
  }
}

const REQUIRED = { job_required_papers: [{ id: 'nda', job_id: CEDAR, removed_at: null }, { id: 'site', job_id: CEDAR, removed_at: null }, { id: 'old', job_id: MARSH, removed_at: '2026-11-01T00:00:00Z' }] }
const CEDAR_OWED = { job_number: 'J2391', papers: [NDA, SITE] }

// ── The rule ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('the rule: shut while a paper is not signed', () => {
  it('reads the database’s answer, and anything missing reads as owed, never as signed', () => {
    expect(personJobPapersFrom(CEDAR, CEDAR_OWED)).toEqual({
      job_id: CEDAR,
      job_number: 'J2391',
      papers: [
        { id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, status: 'none', signed_at: null },
        { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, status: 'none', signed_at: null },
      ],
    })
    expect(personJobPapersFrom(CEDAR, { papers: [{ id: 'nda', status: 'approved', signed_at: '2026-11-15' }] }).papers[0]).toMatchObject({ status: 'none', signed_at: null })
    expect(personJobPapersFrom(CEDAR, null)).toEqual({ job_id: CEDAR, job_number: '', papers: [] })
    // The copy's id is the office's, not the page's.
    expect(JSON.stringify(personJobPapersFrom(CEDAR, { papers: [{ ...NDA, document_id: 'doc-1' }] }))).not.toContain('doc-1')
  })

  it('a job is shut with one paper not signed, open with every paper signed, and open with no paper at all', () => {
    const papers = personJobPapersFrom(CEDAR, CEDAR_OWED).papers
    expect(jobShutByPapers({ papers })).toBe(true)
    expect(jobShutByPapers({ papers: [{ ...papers[0]!, status: 'signed' }, { ...papers[1]!, status: 'sent' }] })).toBe(true)
    expect(jobShutByPapers({ papers: papers.map((p) => ({ ...p, status: 'signed' as const })) })).toBe(false)
    expect(jobShutByPapers({ papers: [] })).toBe(false)
  })

  it('a job whose papers could not be read is shut', () => {
    expect(jobShutByPapers({ papers: [], unread: true })).toBe(true)
  })
})

// ── Which job a row belongs to ───────────────────────────────────────────────────────────────────────────────

describe('which Pipeline job a row belongs to', () => {
  const sheets = [{ id: 'sheet-1', job_ledger_id: CEDAR }, { id: 'sheet-2', job_ledger_id: null }, { id: 'sheet-3', job_ledger_id: MARSH }]

  it('a sheet by its own link, a work order by its job and else by its sheet', () => {
    const sheetJob = sheetJobMap(sheets)
    expect(sheetJob).toEqual({ 'sheet-1': CEDAR, 'sheet-3': MARSH })
    expect(commitmentJobId({ job_id: MARSH, labor_job_id: 'sheet-1' }, sheetJob)).toBe(MARSH)
    expect(commitmentJobId({ job_id: null, labor_job_id: 'sheet-1' }, sheetJob)).toBe(CEDAR)
    expect(commitmentJobId({ job_id: null, labor_job_id: 'sheet-2' }, sheetJob)).toBeNull()
    expect(commitmentJobId({ job_id: null, labor_job_id: null }, sheetJob)).toBeNull()
  })

  it('every job once, from the sheets and the work orders together', () => {
    expect(subPortalJobIds(sheets, [{ id: 'o1', job_id: null, labor_job_id: 'sheet-1' }, { id: 'o2', job_id: 'job-other', labor_job_id: null }, { id: 'o3', job_id: null, labor_job_id: null }]).sort()).toEqual([CEDAR, MARSH, 'job-other'].sort())
    expect(subPortalJobIds([], [])).toEqual([])
  })

  it('a press reads the same jobs: the person’s sheets and their live work orders, a stray order through its sheet', async () => {
    const admin = adminOf({
      people_labor_job_assignees: [{ labor_job_id: 'sheet-1', person_id: TALL_PINE }, { labor_job_id: 'sheet-9', person_id: 'person-ortega' }],
      step_commitments: [
        { id: 'o1', person_id: TALL_PINE, status: 'offered', job_id: 'job-other', labor_job_id: null },
        { id: 'o2', person_id: TALL_PINE, status: 'accepted', job_id: null, labor_job_id: 'sheet-3' },
        { id: 'o3', person_id: TALL_PINE, status: 'declined', job_id: 'job-declined', labor_job_id: null },
        { id: 'o4', person_id: 'person-ortega', status: 'offered', job_id: 'job-ortega', labor_job_id: null },
      ],
      people_labor_jobs: [{ id: 'sheet-1', job_ledger_id: CEDAR }, { id: 'sheet-3', job_ledger_id: MARSH }, { id: 'sheet-9', job_ledger_id: 'job-ortega' }],
    })
    expect((await readSubPortalJobIds(admin, TALL_PINE)).sort()).toEqual([CEDAR, MARSH, 'job-other'].sort())
  })
})

// ── Asking the database ──────────────────────────────────────────────────────────────────────────────────────

describe('asking the database about a person', () => {
  it('only a job that requires a paper is asked about, each once, and the waiting jobs come back with their papers', async () => {
    const calls: Call[] = []
    const admin = adminOf(REQUIRED, { [CEDAR]: CEDAR_OWED }, {}, calls)
    const waiting = await jobsWaitingOnPerson(admin, TALL_PINE, [CEDAR, MARSH, CEDAR, 'job-other'])
    expect(waiting.map((j) => [j.job_id, j.job_number, j.papers.length])).toEqual([[CEDAR, 'J2391', 2]])
    // Marsh requires nothing live (its one paper was taken off), so nobody asks about it.
    expect(calls).toEqual([{ fn: 'job_papers_for_person', args: { p_job_id: CEDAR, p_person_id: TALL_PINE } }])
  })

  it('a sub whose jobs require no paper is asked about nothing, and nothing waits', async () => {
    const calls: Call[] = []
    expect(await jobsWaitingOnPerson(adminOf({ job_required_papers: [] }, {}, {}, calls), TALL_PINE, [CEDAR, MARSH])).toEqual([])
    expect(await jobsWaitingOnPerson(adminOf({}, {}, {}, calls), TALL_PINE, [])).toEqual([])
    expect(calls).toEqual([])
  })

  it('a job with every paper signed does not wait', async () => {
    const signed = { job_number: 'J2391', papers: [{ ...NDA, status: 'signed', signed_at: '2026-11-15' }, { ...SITE, status: 'signed', signed_at: '2026-11-17' }] }
    expect(await jobsWaitingOnPerson(adminOf(REQUIRED, { [CEDAR]: signed }), TALL_PINE, [CEDAR])).toEqual([])
  })

  it('fails closed: a job whose papers cannot be read waits, marked unread, under the number the page already has', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const waiting = await jobsWaitingOnPerson(adminOf(REQUIRED, {}, { jobs: [CEDAR] }), TALL_PINE, [CEDAR], { [CEDAR]: 'J2391' })
    expect(waiting).toEqual([{ job_id: CEDAR, job_number: 'J2391', papers: [], unread: true }])
    expect(await personJobPapers(adminOf(REQUIRED, {}, { jobs: [CEDAR] }), CEDAR, TALL_PINE)).toEqual({ job_id: CEDAR, job_number: '', papers: [], unread: true })
  })

  it('a failed look at the required papers opens nothing: every job is asked about', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls: Call[] = []
    const admin = adminOf(REQUIRED, { [CEDAR]: CEDAR_OWED }, { tables: ['job_required_papers'] }, calls)
    expect(await jobsRequiringPapers(admin, [CEDAR, MARSH])).toBeNull()
    const waiting = await jobsWaitingOnPerson(admin, TALL_PINE, [CEDAR, MARSH])
    expect(waiting.map((j) => j.job_id)).toEqual([CEDAR])
    expect(calls.map((c) => c.args.p_job_id)).toEqual([CEDAR, MARSH])
  })

  it('one job for a press: open, shut, or unread, and the words each is refused with', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await jobShutToPerson(adminOf(REQUIRED, { [CEDAR]: CEDAR_OWED }), CEDAR, TALL_PINE)).toBe('shut')
    expect(await jobShutToPerson(adminOf(REQUIRED, { [CEDAR]: CEDAR_OWED }), MARSH, TALL_PINE)).toBe('open')
    expect(await jobShutToPerson(adminOf(REQUIRED, {}, { jobs: [CEDAR] }), CEDAR, TALL_PINE)).toBe('unread')
    expect(await jobShutToPerson(adminOf(REQUIRED, {}, { tables: ['job_required_papers'], jobs: [MARSH] }), MARSH, TALL_PINE)).toBe('unread')
    // A sheet tied to no Pipeline job has no papers to owe.
    expect(await jobShutToPerson(adminOf(REQUIRED), null, TALL_PINE)).toBe('open')
    expect(shutJobRefusal('open')).toBeNull()
    expect(shutJobRefusal('shut')).toEqual({ status: 403, error: JOB_PAPERS_FIRST_WORDS })
    expect(shutJobRefusal('unread')).toEqual({ status: 503, error: JOB_PAPERS_UNREAD_WORDS })
    expect(JOB_PAPERS_FIRST_WORDS).toBe('Sign this job’s papers first.')
  })
})

// ── Holding a shut job's rows back ───────────────────────────────────────────────────────────────────────────

function sheetRow(over: Partial<SubSheetRow> & { id: string }): SubSheetRow {
  return { address: '1200 Quarry Rd', job_number: 'J2391', job_ledger_id: CEDAR, job_date: '2026-11-20', labor_rate: 60, stage: null, stage_changed_at: null, stage_source: null, payable_after: '2026-12-01', pay_hold_reason: 'Held until the Quarry Rd inspection passes', plans_url: 'https://plans.example.test/cedar-bluff', progress_pct: 50, progress_note: 'Trench open to the east wall', progress_at: '2026-11-16T15:00:00Z', ...over }
}
const item = (job_id: string, fixture: string, amount: number): SubItemRow => ({ job_id, fixture, count: 1, hrs_per_unit: 0, is_fixed: true, labor_rate: null, direct_labor_amount: amount, sequence_order: 0 })
const payment = (job_id: string, amount: number, memo: string): SubPaymentRow => ({ job_id, amount, memo, payment_date: '2026-11-10', created_at: '2026-11-10T15:00:00Z', hidden_from_sub: false, sequence_order: 0 })

const SHEET_ROWS = [sheetRow({ id: 'sheet-cedar' }), sheetRow({ id: 'sheet-marsh', address: '88 Linden Ct', job_number: 'J2402', job_ledger_id: MARSH, pay_hold_reason: null, plans_url: null, progress_pct: null, progress_note: null })]
const ITEM_ROWS = [item('sheet-cedar', 'Trench and bed the sewer main', 4200), item('sheet-cedar', 'Backfill and compact', 1800), item('sheet-marsh', 'Swap the water heater', 950)]
const PAYMENT_ROWS = [payment('sheet-cedar', 1500, 'Draw one, Cedar Bluff trench'), payment('sheet-marsh', 400, 'Deposit, Linden Ct')]
const AGREEMENTS: SubAgreementRow[] = [
  {
    id: 'order-cedar',
    labor_job_id: 'sheet-cedar',
    amount: 6000,
    signed_at: '2026-11-05T15:00:00Z',
    accepted_at: '2026-11-05T15:00:00Z',
    signer_printed_name: 'Tall Pine Excavating',
    offer_scope_snapshot: { anchor: 'sheet', sheetLabel: 'J2391 · 1200 Quarry Rd', lines: [{ label: 'Trench and bed the sewer main', amount: 4200 }], exclusions: ['Rock excavation at Quarry Rd'], references: [{ kind: 'book', name: 'Ridgeway Builders site plan' }], acknowledgements: ['I walked 1200 Quarry Rd'] },
    signer_acknowledgements: null,
    picked_start: '2026-11-20',
    picked_end: '2026-11-24',
    window_start: '2026-11-18',
    window_end: '2026-11-28',
    work_days: 3,
    change_requested_at: '2026-11-16T15:00:00Z',
    change_requested_note: 'The crane at Cedar Bluff Lofts moved a week',
  },
]
const OFFER_ROWS: SubOfferRow[] = [
  { id: 'offer-cedar', amount: 2600, notes: 'Storm line at Cedar Bluff Lofts', offer_scope_snapshot: { anchor: 'sheet', sheetLabel: 'J2391 · 1200 Quarry Rd', startsLabel: 'Starts at 1200 Quarry Rd on Monday', lines: [{ label: 'Storm line to the pond', amount: 2600 }], exclusions: ['Dewatering'], references: [{ kind: 'book', name: 'Ridgeway Builders NDA' }], acknowledgements: ['I read the site rules'], specialProvisions: 'Gate code from Ridgeway Builders' }, offer_expires_at: '2026-11-30', proposed_start: '2026-11-25', proposed_end: '2026-11-27', step_name: null, labor_job_id: null, window_start: '2026-11-24', window_end: '2026-11-28', work_days: 2 },
  { id: 'offer-marsh', amount: 300, notes: null, offer_scope_snapshot: { anchor: 'sheet', sheetLabel: 'J2402 · 88 Linden Ct', lines: [{ label: 'Haul the old heater', amount: 300 }] }, offer_expires_at: null, proposed_start: null, proposed_end: null, step_name: null, labor_job_id: null },
]
const BOOKINGS: SubPortalBooking[] = [
  { start: '2026-11-20', end: '2026-11-24', label: 'Sewer main · #J2391', address: '1200 Quarry Rd', jobNumber: 'J2391', source: 'pick', commitmentId: 'order-cedar', note: null },
  { start: '2026-11-19', end: '2026-11-19', label: '#J2402', address: '88 Linden Ct', jobNumber: 'J2402', source: 'office', commitmentId: null, note: null },
]

function reply() {
  const sheets = attachSheetAgreements(buildSubSheets(SHEET_ROWS, ITEM_ROWS, PAYMENT_ROWS), AGREEMENTS, TODAY)
  return { sheets, offers: buildSubOffers(OFFER_ROWS, TODAY), bookings: BOOKINGS.map((b) => ({ ...b })), papers: null as SubPortalPapers | null }
}
const TIES = { sheets: { 'sheet-cedar': CEDAR, 'sheet-marsh': MARSH }, offers: { 'offer-cedar': CEDAR, 'offer-marsh': MARSH }, bookings: [CEDAR, MARSH] }
/** Everything of Cedar Bluff Lofts a shut page must not carry. */
const CEDAR_WORDS = ['Quarry', 'Cedar Bluff', 'Ridgeway', 'Trench', 'Backfill', 'Storm line', 'Sewer main', 'Dewatering', 'Rock excavation', 'crane', 'Gate code', 'site rules', 'east wall', 'inspection', 'plans.example.test']

describe('holding a shut job’s rows back', () => {
  it('nothing changes for a sub whose jobs require no paper: the same rows come back, untouched', () => {
    const rows = reply()
    const before = JSON.stringify(rows)
    const shown = blankShutSubPortalRows(rows, TIES, new Set())
    expect(shown).toBe(rows)
    expect(JSON.stringify(shown)).toBe(before)
    expect(blankShutPaymentMemos(PAYMENT_ROWS, TIES.sheets, new Set())).toBe(PAYMENT_ROWS)
    // A job that is shut to somebody else, or that the sub has no row on, changes nothing either.
    const other = blankShutSubPortalRows(rows, TIES, new Set(['job-other']))
    expect(JSON.stringify(other)).toBe(before)
    expect(other.sheets[0]).toBe(rows.sheets[0])
    expect(blankShutPaymentMemos(PAYMENT_ROWS, TIES.sheets, new Set(['job-other']))).toBe(PAYMENT_ROWS)
  })

  it('a shut job keeps its number, its days and its money, and nothing that says where it is or what the work is', () => {
    const rows = reply()
    const shown = blankShutSubPortalRows(rows, TIES, new Set([CEDAR]))
    const [cedar, marsh] = shown.sheets
    expect(cedar).toMatchObject({ id: 'sheet-cedar', jobNumber: 'J2391', address: null, items: [], payHoldReason: null, plansUrl: null, papersFirstJobId: CEDAR })
    // The money is the sub's own to read.
    expect(cedar).toMatchObject({ agreed: 6000, paid: 1500, open: 4500, payableAfter: '2026-12-01', stage: 'working' })
    expect(cedar!.agreement).toMatchObject({ amount: 6000, signerName: 'Tall Pine Excavating', signedOn: '2026-11-05', lines: [], exclusions: [], references: [], acknowledgements: [] })
    expect(cedar!.dates).toMatchObject({ commitmentId: 'order-cedar', start: '2026-11-20', end: '2026-11-24', window: { start: '2026-11-18', end: '2026-11-28' }, changeRequested: { note: null, at: '2026-11-16T15:00:00Z' } })
    expect(cedar!.progress).toMatchObject({ pct: 50, note: null })
    // The open job beside it is the very row it was.
    expect(marsh).toBe(rows.sheets[1])
    expect(marsh).toMatchObject({ address: '88 Linden Ct', items: [{ label: 'Swap the water heater (fixed price)', amount: 950 }] })
    expect('papersFirstJobId' in marsh!).toBe(false)

    const [cedarOffer, marshOffer] = shown.offers
    expect(cedarOffer).toMatchObject({ id: 'offer-cedar', title: 'Work order', lines: [], startsLabel: null, exclusions: [], references: [], acknowledgements: [], specialProvisions: null, total: 2600, expiresOn: '2026-11-30', window: { start: '2026-11-24', end: '2026-11-28' }, workDays: 2, papersFirstJobId: CEDAR })
    expect(marshOffer).toBe(rows.offers[1])

    const [cedarDay, marshDay] = shown.bookings
    expect(cedarDay).toEqual({ start: '2026-11-20', end: '2026-11-24', label: '#J2391', address: null, jobNumber: 'J2391', source: 'pick', commitmentId: 'order-cedar', note: null, papersFirstJobId: CEDAR })
    expect(marshDay).toBe(rows.bookings[1])

    const carried = JSON.stringify(shown)
    for (const word of CEDAR_WORDS) expect(carried, word).not.toContain(word)
    // The totals are read from the true sheets, and a held-back sheet still carries the figures they sum: they are money.
    expect(buildSubTotals(shown.sheets)).toEqual(buildSubTotals(rows.sheets))
    expect(buildSubTotals(shown.sheets)).toEqual({ earned: 6950, paid: 1900, open: 5050 })
  })

  it('a booking with no number reads as a work order or a sheet, never as its stage', () => {
    expect(blankShutBooking({ label: 'Sewer main', address: '1200 Quarry Rd', jobNumber: null, commitmentId: 'order-cedar', note: 'Meet the super at the gate' }, CEDAR)).toEqual({ label: 'Work order', address: null, jobNumber: null, commitmentId: 'order-cedar', note: null, papersFirstJobId: CEDAR })
    expect(blankShutBooking({ label: 'Sheet', address: '1200 Quarry Rd', jobNumber: null, commitmentId: null, note: null }, CEDAR).label).toBe('Sheet')
  })

  it('a shut job’s payments keep their amounts and days in the ledger, and lose the memo', () => {
    const held = blankShutPaymentMemos(PAYMENT_ROWS, TIES.sheets, new Set([CEDAR]))
    expect(held[0]).toEqual({ ...PAYMENT_ROWS[0], memo: null })
    expect(held[1]).toBe(PAYMENT_ROWS[1])
    const lines = buildSubPaymentLines(held, new Map(SHEET_ROWS.map((s) => [s.id, s])), '2026-08-01')
    expect(lines).toEqual([
      { date: '2026-11-10', jobNumber: 'J2391', memo: null, amount: 1500 },
      { date: '2026-11-10', jobNumber: 'J2402', memo: 'Deposit, Linden Ct', amount: 400 },
    ])
  })

  it('the single-row functions hold a row back whatever else it carries', () => {
    const [cedar] = reply().sheets
    const held = blankShutSheet(cedar!, CEDAR)
    expect(held.id).toBe('sheet-cedar')
    expect(held.backcharges).toBe(cedar!.backcharges)
    const [offer] = reply().offers
    expect(blankShutOffer(offer!, CEDAR).bond).toBe('none')
  })
})

describe('the Statements view’s papers', () => {
  const who = { subName: 'Harlan Drywall', company: { name: 'Click Plumbing and Electrical', lines: [] }, officePhone: '(512) 555-0100', now: new Date('2026-11-17T18:00:00Z') }
  const rows = harlanRows()
  const built = buildSubPortalPapers(rows, who)
  const first = rows.sheets[0]!
  const sheetJob: Record<string, string> = { [first.id]: CEDAR }

  it('the fixture builds papers that add up, with a sheet to hold back', () => {
    expect(built.ok).toBe(true)
    expect(first.id).toBeTruthy()
  })

  it('with no job shut the block is the very block it was', () => {
    expect(blankShutPapers(built, sheetJob, new Set())).toBe(built)
    expect(blankShutPapers(built, sheetJob, new Set(['job-other']))).toBe(built)
    expect(blankShutPapers(null, sheetJob, new Set([CEDAR]))).toBeNull()
    const checking: SubPortalPapers = { ok: false, officePhone: '(512) 555-0100' }
    expect(blankShutPapers(checking, sheetJob, new Set([CEDAR]))).toBe(checking)
  })

  it('a shut job’s statement keeps every amount and loses its name, address, line labels, memos and the office’s number', () => {
    if (!built.ok) throw new Error('the fixture did not build')
    const held = blankShutPapers(built, sheetJob, new Set([CEDAR]))
    if (!held.ok) throw new Error('the block was dropped')
    const before = built.sheets.find((s) => s.id === first.id)!
    const after = held.sheets.find((s) => s.id === first.id)!
    expect(after.jobName).toBe(PAPERS_FIRST_LINE)
    expect(after.address).toBe('')
    expect(after.number).toBe('')
    expect(after.jobNumber).toBe(before.jobNumber)
    expect(after.day).toBe(before.day)
    expect(after.lines.map((l) => l.amount)).toEqual(before.lines.map((l) => l.amount))
    expect(after.lines.map((l) => l.label)).toEqual(before.lines.map((_, i) => `Line ${i + 1}`))
    expect(after.money.map((m) => [m.id, m.amount, m.ymd, m.how])).toEqual(before.money.map((m) => [m.id, m.amount, m.ymd, m.how]))
    expect(after.money.every((m) => m.memo === '')).toBe(true)
    expect(held.numbers).not.toHaveProperty(first.id)
    // Every other sheet is the very sheet it was, and the block's own figures do not move.
    for (const s of held.sheets) if (s.id !== first.id) expect(s).toBe(built.sheets.find((b) => b.id === s.id))
    expect(held.stillOpen).toBe(built.stillOpen)
    expect(held.received).toBe(built.received)
  })

  it('one sheet alone', () => {
    expect(blankShutPaperSheet({ id: 's', number: 'WS-2041-1', jobName: 'Cedar Bluff Lofts', address: '1200 Quarry Rd', lines: [{ label: 'Trench', amount: 10 }], money: [{ memo: 'Draw one' }] })).toEqual({ id: 's', number: '', jobName: 'Papers to sign first', address: '', lines: [{ label: 'Line 1', amount: 10 }], money: [{ memo: '' }] })
  })
})
