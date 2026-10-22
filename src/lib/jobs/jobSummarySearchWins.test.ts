import { describe, expect, it } from 'vitest'
import { JOB_SUMMARY_VIEW_DEFAULTS, enrichJobSummaryRows, filterAndSortJobSummaryRows, type JobSummaryLedgerRowInput } from './jobSummaryLedgerView'
import { jobSummarySearchIsExactNumber, jobSummarySearchNote, jobSummarySearchReaches, jobSummaryUnderFloorMatches } from './jobSummarySearchWins'
import { plainWordsFailures } from '../plainWords'

/**
 * The search wins (v2.5745): the owner typed 891 on the default view and saw no row.
 * A finished match, an in-progress match, a match outside the window, a match under
 * the HCP # floor, no match and a name match — each drawn, each named in plain words.
 */
type Row = JobSummaryLedgerRowInput & { job: { job_address?: string | null } }
const row = (id: string, hcp: string, over: Omit<Partial<Row>, 'job'> & { job?: Partial<Row['job']> } = {}): Row => ({
  job: { id, hcp_number: hcp, click_number: null, job_name: `Job ${hcp}`, pct_complete: null, invoices: [], last_work_date: null, created_at: '2026-01-15T00:00:00Z', job_address: null, ...(over.job ?? {}) },
  subLaborCost: over.subLaborCost ?? 0,
  teamLaborCost: over.teamLaborCost ?? 0,
  partsCost: over.partsCost ?? 0,
  totalBill: over.totalBill ?? 0,
})

// A 90-day window ending 2026-10-22. j931 finished (paid in full) and worked inside it; j891 in
// progress inside it; j827 finished but last worked in March, outside it.
const rows: Row[] = [
  row('j931', '931', { totalBill: 48_700, job: { invoices: [{ status: 'paid', amount: 48_700 }], job_name: 'Lavender Springs', job_address: '501 Ranch Rd, Wimberley', last_work_date: '2026-10-01' } }),
  row('j891', '891', { totalBill: 10_000, teamLaborCost: 2_000, job: { pct_complete: 40, job_name: 'Oak Hill repipe', last_work_date: '2026-10-20' } }),
  row('j827', '827', { totalBill: 5_983, job: { pct_complete: 100, last_work_date: '2026-03-02' } }),
]
const enriched = enrichJobSummaryRows({ rows, reportPctByJobId: new Map(), ledger: null, method: 'day' })
const ctx = { startYmd: '2026-07-24', endYmd: '2026-10-22' }
const prefs = { ...JOB_SUMMARY_VIEW_DEFAULTS, window: '90d' as const }
const drawn = (search: string, p = prefs) => filterAndSortJobSummaryRows({ rows: enriched, prefs: p, search, ...ctx })
const ids = (search: string, p = prefs) => drawn(search, p).map((r) => r.row.job.id)
const note = (search: string, extra: Partial<Parameters<typeof jobSummarySearchNote>[0]> = {}, p = prefs) =>
  jobSummarySearchNote({ search, rows: drawn(search, p), prefs: p, ...ctx, floor: 500, ...extra })

describe('the search wins over the chips (v2.5745)', () => {
  it('with nothing typed the chips rule: Finished · 90d draws j931 alone', () => {
    expect(ids('')).toEqual(['j931'])
    expect(note('').on).toBe(false)
    expect(note('').sentence).toBe('')
  })

  it('a finished match is drawn and the note says only that it matched', () => {
    expect(ids('931')).toEqual(['j931'])
    const n = note('931')
    expect(n).toMatchObject({ on: true, matched: 1, heldByStatus: 0, heldByWindow: 0, heldByBudget: 0, lifted: 0 })
    expect(n.sentences).toEqual(['1 job matches your search.'])
  })

  it('an in-progress match is drawn under Finished, and the note says the Show chip stepped aside', () => {
    expect(ids('891')).toEqual(['j891'])
    const n = note('891')
    expect(n).toMatchObject({ matched: 1, heldByStatus: 1, heldByWindow: 0 })
    expect(n.sentences).toEqual(['1 job matches your search.', 'Job 891 is still in progress, so the Show chip stepped aside.'])
  })

  it('a match worked outside the window is drawn, and the note names the Worked in chip', () => {
    expect(ids('827')).toEqual(['j827'])
    const n = note('827')
    expect(n).toMatchObject({ matched: 1, heldByStatus: 0, heldByWindow: 1 })
    expect(n.sentences).toEqual(['1 job matches your search.', 'Job 827 was not worked in this window, so the Worked in chip stepped aside.'])
  })

  it('a name or an address finds the job the same way', () => {
    expect(ids('oak hill')).toEqual(['j891'])
    expect(note('oak hill').sentences[1]).toBe('Job 891 is still in progress, so the Show chip stepped aside.')
    expect(ids('wimberley')).toEqual(['j931'])
  })

  it('both chips in the way: one sentence names both', () => {
    const p = { ...prefs, status: 'in_progress' as const }
    expect(ids('827', p)).toEqual(['j827'])
    expect(note('827', {}, p).sentences).toEqual(['1 job matches your search.', 'Job 827 is finished already and was not worked in this window, so both chips stepped aside.'])
  })

  it('the Budget chip steps aside too, and the note says so', () => {
    const p = { ...prefs, budgetFilter: 'bid' as const }
    expect(ids('', p)).toEqual([])
    expect(ids('931', p)).toEqual(['j931'])
    expect(note('931', {}, p).sentences).toEqual(['1 job matches your search.', "Job 931 is not on the Budget chip's footing, so that chip stepped aside."])
  })

  it('no match: the note says so and offers the way back', () => {
    expect(ids('zzz')).toEqual([])
    expect(note('zzz').sentences).toEqual(['No job matches zzz.', 'Check the number, or clear the search box to see the list again.'])
  })

  it('several matches: counts per chip and one closing line', () => {
    expect(ids('8').sort()).toEqual(['j827', 'j891'])
    expect(note('8').sentences).toEqual([
      '2 jobs match your search.',
      '1 is still in progress.',
      '1 was not worked in this window.',
      'The chips and the floor step aside while you search.',
    ])
  })
})

describe('the HCP # floor steps aside for an exact job number (v2.5745)', () => {
  const pool = [
    { id: 'j432', hcp_number: '432', click_number: null, job_name: 'Old import', job_address: '9 Elm St' },
    { id: 'j410', hcp_number: '410', click_number: null, job_name: 'Elm St service', job_address: null },
    { id: 'jc77', hcp_number: null, click_number: '77', job_name: 'Click job', job_address: null },
  ]

  it('an exact HCP or Click number lifts its row; a looser match is counted with the floor as its door', () => {
    expect(jobSummaryUnderFloorMatches(pool, '432')).toEqual({ lift: [pool[0]], alsoMatch: 0 })
    expect(jobSummaryUnderFloorMatches(pool, ' 77 ')).toEqual({ lift: [pool[2]], alsoMatch: 0 })
    expect(jobSummaryUnderFloorMatches(pool, 'elm')).toEqual({ lift: [], alsoMatch: 2 })
    expect(jobSummaryUnderFloorMatches(pool, '41')).toEqual({ lift: [], alsoMatch: 1 })
    expect(jobSummaryUnderFloorMatches(pool, '')).toEqual({ lift: [], alsoMatch: 0 })
    expect(jobSummarySearchIsExactNumber(pool[0]!, '43')).toBe(false)
    expect(jobSummarySearchReaches(pool[0]!, '43')).toBe(true)
  })

  it('a lifted row is drawn and the note says the floor stepped aside', () => {
    const lifted = enrichJobSummaryRows({ rows: [row('j432', '432', { totalBill: 900, job: { pct_complete: 100, last_work_date: '2026-10-02' } })], reportPctByJobId: new Map(), ledger: null, method: 'day' })
    const n = jobSummarySearchNote({ search: '432', rows: lifted, prefs, ...ctx, floor: 500, liftedJobIds: new Set(['j432']) })
    expect(n).toMatchObject({ matched: 1, lifted: 1, heldByStatus: 0 })
    expect(n.sentences).toEqual(['1 job matches your search.', 'Job 432 sits under the HCP # 500 floor, so the floor stepped aside.'])
    // In progress as well: the floor first, then the chip, the job named once.
    const open = enrichJobSummaryRows({ rows: [row('j432', '432', { totalBill: 900, job: { pct_complete: 30, last_work_date: '2026-10-02' } })], reportPctByJobId: new Map(), ledger: null, method: 'day' })
    expect(jobSummarySearchNote({ search: '432', rows: open, prefs, ...ctx, floor: 500, liftedJobIds: new Set(['j432']) }).sentences).toEqual([
      '1 job matches your search.',
      'Job 432 sits under the HCP # 500 floor, so the floor stepped aside.',
      'The job is still in progress, so the Show chip stepped aside.',
    ])
  })

  it('while the lifted row is still being read, the note says it is looking', () => {
    expect(note('432', { liftPending: 1 }).sentences).toEqual(['Looking under the HCP # 500 floor for 432.'])
    expect(note('931', { liftPending: 1 }).sentences).toEqual(['1 job matches your search.', 'Still looking under the HCP # 500 floor for 1 more.'])
  })

  it('name matches under the floor are counted, with show all as the door', () => {
    expect(note('elm', { underFloorAlso: 2 }).sentences).toEqual([
      'No job matches elm.',
      '2 more older jobs under the HCP # 500 floor match by name or address.',
      'Press show all under the table to see them.',
    ])
    expect(note('931', { underFloorAlso: 1 }).sentences.slice(1)).toEqual([
      '1 more older job under the HCP # 500 floor matches by name or address.',
      'Press show all under the table to see them.',
    ])
  })
})

describe('plain words', () => {
  it('every sentence the note can write is one idea, under 20 words, with no glue', () => {
    const p2 = { ...prefs, status: 'in_progress' as const, budgetFilter: 'bid' as const }
    const all = [
      note(''),
      note('931'),
      note('891'),
      note('827'),
      note('827', {}, p2),
      note('931', {}, { ...prefs, budgetFilter: 'bid' as const }),
      note('zzz'),
      note('8'),
      note('8', { underFloorAlso: 3, liftPending: 2 }, p2),
      note('432', { liftPending: 1 }),
      note('elm', { underFloorAlso: 1 }),
    ].flatMap((n) => n.sentences)
    expect(all.length).toBeGreaterThan(10)
    for (const s of all) expect(plainWordsFailures(s)).toEqual([])
  })
})
