import { describe, expect, it } from 'vitest'
import {
  assessLienWatch,
  computeJobLienClock,
  filingDeadlineForMonth,
  noticeDeadlineForMonth,
  serveDueForFiling,
  statutoryFifteenth,
  type JobLienFilingRow,
  type LienWatchJob,
} from './lienDeadlines'

function filing(partial: Partial<JobLienFilingRow>): JobLienFilingRow {
  return {
    id: 'f1',
    job_id: 'j1',
    kind: 'notice_53_056',
    invoice_ids: [],
    amount: 1000,
    months_covered: [],
    fields: {},
    sends: [],
    filed_at: null,
    county: '',
    recording_number: '',
    serve_due: null,
    served_at: null,
    created_by: null,
    created_at: '2026-09-02T12:00:00Z',
    voided_at: null,
    ...partial,
  } as JobLienFilingRow
}

function job(partial: Partial<LienWatchJob>): LienWatchJob {
  return { id: 'j1', isSub: true, lastWorkYmd: '2026-07-20', openBalance: 2711.5, propertyKind: 'non_residential', ...partial }
}

describe('statutory dates', () => {
  it('notice: 15th of 2nd (res) / 3rd (non-res) month after, weekend-rolled', () => {
    expect(noticeDeadlineForMonth('2026-07-20', 'non_residential')).toBe('2026-10-15')
    expect(noticeDeadlineForMonth('2026-07-20', 'residential')).toBe('2026-09-15')
    // Aug res notice: 2026-10-15 is a Thursday.
    expect(noticeDeadlineForMonth('2026-08-01', 'residential')).toBe('2026-10-15')
    // 2026-08-15 is a Saturday: June res notice rolls to Monday Aug 17.
    expect(noticeDeadlineForMonth('2026-06-10', 'residential')).toBe('2026-08-17')
  })
  it('filing: 15th of 3rd/4th month; serve: 5th calendar day, weekend-rolled', () => {
    expect(filingDeadlineForMonth('2026-07-20', 'non_residential')).toBe('2026-11-16') // Nov 15 is a Sunday
    expect(filingDeadlineForMonth('2026-07-20', 'residential')).toBe('2026-10-15')
    expect(serveDueForFiling('2026-09-04')).toBe('2026-09-09') // Fri +5 = Wed
    expect(serveDueForFiling('2026-09-07')).toBe('2026-09-14') // Mon +5 = Sat → Mon
    expect(serveDueForFiling('')).toBe('')
  })
  it('statutoryFifteenth tolerates YYYY-MM input and rejects junk', () => {
    expect(statutoryFifteenth('2026-07', 3)).toBe('2026-10-15')
    expect(statutoryFifteenth('July', 3)).toBe('')
  })
})

describe('computeJobLienClock', () => {
  it('subs get both deadlines; originals skip the notice', () => {
    const sub = computeJobLienClock({ lastWorkYmd: '2026-07-20', propertyKind: 'non_residential', isSub: true })
    expect(sub).toEqual({ workMonth: '2026-07', noticeDeadline: '2026-10-15', filingDeadline: '2026-11-16' })
    const orig = computeJobLienClock({ lastWorkYmd: '2026-07-20', propertyKind: 'non_residential', isSub: false })
    expect(orig.noticeDeadline).toBe('')
    expect(orig.filingDeadline).toBe('2026-11-16')
  })
  it('no work date → empty clock', () => {
    expect(computeJobLienClock({ lastWorkYmd: null, propertyKind: '', isSub: true }).workMonth).toBe('')
  })
})

describe('assessLienWatch', () => {
  it('notice watch: sub job, open ≥ $500, window inside 14 days, no covering notice', () => {
    const r = assessLienWatch([job({})], [], '2026-10-05')
    expect(r.noticeDue).toEqual([{ jobId: 'j1', deadline: '2026-10-15', openBalance: 2711.5 }])
    // Too far out (window opens 14 days before Oct 15).
    expect(assessLienWatch([job({})], [], '2026-09-10').noticeDue).toEqual([])
    // Missed window → dropped (can't fix).
    expect(assessLienWatch([job({})], [], '2026-10-16').noticeDue).toEqual([])
    // Covered by a recorded notice for the month → quiet.
    const covered = filing({ months_covered: ['2026-07'] })
    expect(assessLienWatch([job({})], [covered], '2026-10-05').noticeDue).toEqual([])
    // Below the money floor → quiet.
    expect(assessLienWatch([job({ openBalance: 300 })], [], '2026-10-05').noticeDue).toEqual([])
  })
  it('filing watch needs the notice satisfied (or original contractor) and no affidavit yet', () => {
    const covered = filing({ months_covered: ['2026-07'] })
    const r = assessLienWatch([job({})], [covered], '2026-11-01')
    expect(r.filingDue).toEqual([{ jobId: 'j1', deadline: '2026-11-16', openBalance: 2711.5 }])
    // Sub with no notice → no filing nag (the gate blocks the affidavit anyway).
    expect(assessLienWatch([job({})], [], '2026-11-01').filingDue).toEqual([])
    // Original contractor needs no notice.
    expect(assessLienWatch([job({ isSub: false })], [], '2026-11-01').filingDue.length).toBe(1)
    // Affidavit already recorded → quiet.
    const affidavit = filing({ id: 'f2', kind: 'affidavit' })
    expect(assessLienWatch([job({})], [covered, affidavit], '2026-11-01').filingDue).toEqual([])
  })
  it('serve watch: filed, unserved, due within 3 days or overdue — and it never drops until served', () => {
    const filed = filing({ id: 'f3', kind: 'affidavit', filed_at: '2026-09-04', serve_due: '2026-09-09' })
    expect(assessLienWatch([], [filed], '2026-09-07').serveDue.length).toBe(1)
    expect(assessLienWatch([], [filed], '2026-09-20').serveDue.length).toBe(1)
    expect(assessLienWatch([], [filed], '2026-09-01').serveDue).toEqual([])
    const served = filing({ id: 'f4', kind: 'affidavit', filed_at: '2026-09-04', serve_due: '2026-09-09', served_at: '2026-09-08' })
    expect(assessLienWatch([], [served], '2026-09-20').serveDue).toEqual([])
  })
})
