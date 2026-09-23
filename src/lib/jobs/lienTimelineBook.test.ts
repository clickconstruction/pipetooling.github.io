import { describe, expect, it } from 'vitest'
import { buildLienTimelineBook, filterLienTimelineBook, lienGridHtml, lienGridRows, type LienBookJob, type LienTimelineBookInput } from './lienTimelineBook'
import type { LienNoticeMonthRow } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'

const TODAY = '2026-09-23'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<LienNoticeMonthRow> = {}): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 40, noticed: false, open_balance: 10_000, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, ...extra }
}

function job(id: string, over: Partial<LienBookJob> = {}): LienBookJob {
  return { id, label: `${id.slice(1)} · Job ${id}`, address: `${id} Main St`, gcId: 'gc1', gcName: 'Loberg Contracting', propertyKind: 'non_residential', homestead: false, county: 'Comal', ownerName: 'Elbel Holdings LLC', openBalance: 10_000, lastWorkDate: '2026-08-20', isSub: true, ...over }
}

const filing = (over: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f1', job_id: 'j707', kind: 'affidavit', amount: 12_400, county: 'Comal', created_at: '2026-07-14T12:00:00Z', created_by: null, fields: {}, filed_at: '2026-07-14', invoice_ids: [], months_covered: ['2026-02', '2026-03'], recording_number: '2026-0412', sends: [], serve_due: '2026-07-20', served_at: '2026-07-16', voided_at: null, ...over }) as JobLienFilingRow

function input(): LienTimelineBookInput {
  const rows: LienNoticeMonthRow[] = [
    // 891: two open months, the first inside 30 days → due
    row('j891', '2026-07', '2026-10-15', { open_balance: 27_199 }),
    row('j891', '2026-08', '2026-11-16', { open_balance: 27_199 }),
    // 650: one closed month, unnoted → lien gone, still due (the note)
    row('j650', '2026-06', '2026-09-15', { open_balance: 21_800, gc_customer_id: 'gc2' }),
    // 912: a month whose notice is 50 days out → later
    row('j912', '2026-09', '2026-12-15', { open_balance: 4_000 }),
  ]
  const affidavitRows: LienAffidavitRow[] = [
    { job_id: 'j707', last_month: '2026-03', deadline: '2026-07-15', is_sub: true, noticed: true, filed: true, open_balance: 12_400, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null },
  ]
  return {
    rows,
    affidavitRows,
    items: [],
    filingsByJob: { j707: [filing({})] },
    jobs: {
      j891: job('j891', { openBalance: 27_199 }),
      j650: job('j650', { openBalance: 21_800, gcId: 'gc2', gcName: 'Burd & Assoc.' }),
      j912: job('j912', { openBalance: 4_000, lastWorkDate: '2026-09-10' }),
      j707: job('j707', { openBalance: 12_400, lastWorkDate: '2026-03-28' }),
    },
    policyByCustomer: { gc1: 'ask', gc2: 'ask' },
    todayYmd: TODAY,
  }
}

describe('buildLienTimelineBook', () => {
  const book = buildLienTimelineBook(input())
  it('lists every job with a lien month, sorted by the next date, with a lens each', () => {
    expect(book.rows.map((r) => `${r.jobId}:${r.lens}:${r.sortDate}`)).toEqual(['j891:due:2026-10-15', 'j912:later:2026-12-15', 'j707:later:2027-07-15', 'j650:due:'])
    expect(book.counts).toEqual({ due: 2, later: 2, dead: 0, all: 4 })
  })
  it('names the GCs with their counts', () => {
    expect(book.gcs).toEqual([
      { id: 'gc2', name: 'Burd & Assoc.', count: 1 },
      { id: 'gc1', name: 'Loberg Contracting', count: 3 },
    ])
  })
  it('the filed job reads the tail from its filing', () => {
    const t = book.rows.find((r) => r.jobId === 'j707')!.timeline
    expect(t.steps.find((s) => s.kind === 'affidavit')?.dateWords).toBe('filed Jul 14')
    expect(t.steps.find((s) => s.kind === 'serve')?.state).toBe('done')
    expect(t.next.kind).toBe('suit')
  })
  it('filters by GC and by lens', () => {
    expect(filterLienTimelineBook(book, { gcId: 'gc1', show: 'due' }).map((r) => r.jobId)).toEqual(['j891'])
    expect(filterLienTimelineBook(book, { gcId: 'gc1', show: 'all' }).map((r) => r.jobId)).toEqual(['j891', 'j912', 'j707'])
    expect(filterLienTimelineBook(book, { gcId: null, show: 'due' }).map((r) => r.jobId)).toEqual(['j891', 'j650'])
  })
  it('a lien gone and noted is dead, not due', () => {
    const noted = buildLienTimelineBook({
      ...input(),
      items: [
        { id: 'i1', job_id: 'j650', kind: 'notice_53_056', status: 'missed', months: ['2026-06'], fields: { notice: {}, windowClosed: { name: 'Taunya', at: '2026-09-21T15:00:00Z' } }, created_at: '2026-09-21T15:00:00Z', updated_at: '2026-09-21T15:00:00Z', drafted_at: '2026-09-21T15:00:00Z', drafted_by: null, approval_mode: null, approved_at: null, approved_by: null, cover_note: false, held_at: null, held_by: null, hold_reason: '', hold_until: null, pulled_back_at: null, pulled_back_by: null, sent_at: null, sent_filing_id: null, submitted_at: null, voided_at: null, word_channel: '', word_note: '' },
      ],
    })
    expect(noted.rows.find((r) => r.jobId === 'j650')?.lens).toBe('dead')
    expect(noted.counts.dead).toBe(1)
  })
})

describe('the grid', () => {
  const book = buildLienTimelineBook(input())
  it('has counsel’s columns, with blanks where the app holds no fact', () => {
    const g = lienGridRows(filterLienTimelineBook(book, { gcId: 'gc1', show: 'all' }), TODAY)
    expect(g.map((r) => r.job)).toEqual(['891 · Job j891', '912 · Job j912', '707 · Job j707'])
    expect(g[0]!).toMatchObject({ owner: 'Elbel Holdings LLC', kind: 'Com · —', lastOnSite: 'Aug 2026', unpaid: 'Jul, Aug · $27,199', notices: 'Jul: Oct 15 · Aug: Nov 16', affidavit: 'Dec 15', bond: '', paidOut: '', reserved: '', contractCompleted: '' })
    expect(g[2]!.affidavit).toBe('filed Jul 14')
    expect(g[2]!.notices).toBe('')
  })
  it('prints as one landscape page per GC with the footnote on the blanks', () => {
    const html = lienGridHtml(filterLienTimelineBook(book, { gcId: 'gc1', show: 'all' }), { title: 'Loberg Contracting', todayYmd: TODAY, companyName: 'Click Plumbing' })
    expect(html).toContain('<title>Lien grid — Loberg Contracting</title>')
    expect(html).toContain('size: letter landscape')
    expect(html).toContain('3 jobs · $43,599 open')
    expect(html).toContain('<th>Paid out to GC</th>')
    expect(html).toContain('891 · Job j891')
    expect(html).toContain('Blank columns are facts the app does not hold')
    expect(html).toContain('Click Plumbing')
  })
})

describe('the lien clock on a book row (v2.3786)', () => {
  it('a job with a contract-end date lights the § 53.057 step and the grid prints the bond and the date', () => {
    const src = input()
    src.jobs = { ...src.jobs, j912: { ...src.jobs['j912']!, contractEndedOn: '2026-09-10', paymentBond: 'yes' } }
    const book = buildLienTimelineBook(src)
    const row = book.rows.find((r) => r.jobId === 'j912')!
    const ret = row.timeline.steps.find((s) => s.kind === 'retainage')!
    expect(ret.state).toBe('due')
    expect(ret.date).toBe('2026-10-12')
    const g = lienGridRows([row], TODAY)[0]!
    expect(g.bond).toBe('Y')
    expect(g.contractCompleted).toBe('Sep 10')
  })
})
