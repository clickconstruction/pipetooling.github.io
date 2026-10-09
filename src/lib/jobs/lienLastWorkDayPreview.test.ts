import { describe, expect, it } from 'vitest'
import { filingDeadlineForMonth, suitDeadlineFor } from './lienDeadlines'
import { lienLastWorkDayWords, lienLastWorkMonthsFor, lienLastWorkPreview, lienLastWorkShiftSize, type LienLastWorkPreviewInput } from './lienLastWorkDayPreview'

/** Job 922 from the owner's screenshot: hours in Jul and Sep, the last on Sep 2, residential, today Oct 6. */
const job922 = (candidate: string, over: Partial<LienLastWorkPreviewInput> = {}): LienLastWorkPreviewInput => ({
  candidate,
  currentDay: '2026-09-02',
  currentSource: 'hours',
  lastSessionDay: '2026-09-02',
  clockMonths: ['2026-07', '2026-09'],
  noticedMonths: [],
  propertyKind: 'residential',
  todayYmd: '2026-10-06',
  ...over,
})

describe('lienLastWorkPreview (v2.4717) — the verdict and the shift', () => {
  it('the slip: July for October is refused as two months earlier than the clock hours, with the month-number hint', () => {
    const p = lienLastWorkPreview(job922('2026-07-02'))
    expect(p.verdict).toBe('refused')
    expect(p.shiftWords).toBe('Last day of work Jul 2 — two months earlier than the clock hours say (Sep 2).')
    expect(p.sayWords).toBe('The clock hours already show work on Sep 2, so the last day cannot be earlier. If you meant a later month, check the month number.')
    expect(p.after).toBeNull()
    expect(p.rows.every((r) => !r.changed)).toBe(true)
  })
  it('a day after today, and the same day the job reads, are refused in their own words', () => {
    expect(lienLastWorkPreview(job922('2026-10-20'))).toMatchObject({ verdict: 'refused', shiftWords: 'Last day of work Oct 20 — after today.', sayWords: 'A last day of work has to be a day that has happened. Today is Oct 6.' })
    expect(lienLastWorkPreview(job922('2026-09-02'))).toMatchObject({ verdict: 'refused', shiftWords: 'Last day of work Sep 2 — the same day the job reads today.' })
  })
  it('a day far past the hours asks for a second look; a day in reach is fine', () => {
    expect(lienLastWorkPreview(job922('2026-12-01', { todayYmd: '2027-01-20' }))).toMatchObject({ verdict: 'look', shiftWords: 'Last day of work Dec 1, 2026 — three months later than the clock hours say (Sep 2, 2026).' })
    expect(lienLastWorkPreview(job922('2026-10-02'))).toMatchObject({ verdict: 'fine', shiftWords: 'Last day of work Oct 2 — 30 days later than the clock hours say (Sep 2).', sayWords: 'The hours end Sep 2 and the day is in reach of them. The dates below move with it.' })
    expect(lienLastWorkShiftSize(1)).toBe('1 day')
    expect(lienLastWorkShiftSize(-62)).toBe('two months')
    expect(lienLastWorkShiftSize(61)).toBe('two months')
    expect(lienLastWorkShiftSize(400)).toBe('13 months')
  })
})

describe('lienLastWorkPreview — the dates that move', () => {
  it('Oct 2 adds October: the notice names it, its window is Dec 15, the affidavit moves to Jan 15, 2027 and the suit a year on', () => {
    const p = lienLastWorkPreview(job922('2026-10-02'))
    expect(p.rows.map((r) => [r.what, r.before, r.after, r.changed])).toEqual([
      ['Last day of work', 'Sep 2 · clock hours', 'Oct 2 · set by hand', true],
      ['Months the notice names', 'Jul 2026, Sep 2026', 'Jul 2026, Sep 2026, Oct 2026', true],
      ['§ 53.056 for the last month', 'Sep 2026 · mail by Nov 16', 'Oct 2026 · mail by Dec 15', true],
      ['§ 53.052 affidavit', 'file by Dec 15', 'file by Jan 15, 2027', true],
      ['§ 53.158 suit', `by ${lienLastWorkDayWords(suitDeadlineFor(filingDeadlineForMonth('2026-09-01', 'residential')), '2026-10-06')}`, `by ${lienLastWorkDayWords(suitDeadlineFor('2027-01-15'), '2026-10-06')}`, true],
    ])
    expect(p.after).toMatchObject({ day: '2026-10-02', months: ['2026-07', '2026-09', '2026-10'], lastMonth: '2026-10', noticeDue: '2026-12-15', affidavitDue: '2027-01-15' })
  })
  it('a later day in the same month moves nothing but the day itself', () => {
    const p = lienLastWorkPreview(job922('2026-09-20'))
    expect(p.verdict).toBe('fine')
    expect(p.rows[0]).toMatchObject({ after: 'Sep 20 · set by hand', changed: true })
    expect(p.rows.slice(1).every((r) => !r.changed)).toBe(true)
    expect(p.rows[3]).toMatchObject({ before: 'file by Dec 15', after: 'file by Dec 15' })
  })
  it('a month whose window already closed is named as one that would read as missed', () => {
    const p = lienLastWorkPreview(job922('2026-10-02', { todayYmd: '2027-01-20' }))
    expect(p.verdict).toBe('fine')
    expect(p.rows[2]!.after).toBe('Oct 2026 · mail by Dec 15, 2026 · window closed, would read as missed')
    expect(p.sayWords).toContain('Oct 2026 would join the notice with its window already closed, so it would read as missed.')
  })
  it('a job with no hours is measured from its creation day, and its one month is the new day’s', () => {
    const p = lienLastWorkPreview(job922('2026-08-14', { currentDay: '2026-07-01', currentSource: 'created', lastSessionDay: null, clockMonths: [], propertyKind: 'non_residential' }))
    expect(p).toMatchObject({ verdict: 'fine', shiftWords: "Last day of work Aug 14 — 44 days later than the job's creation (Jul 1).", sayWords: 'The job has no clock hours, so this day is the one the lien dates hang on.' })
    expect(p.rows[1]).toMatchObject({ before: 'Jul 2026', after: 'Aug 2026', changed: true })
    expect(p.rows[2]).toMatchObject({ before: 'Jul 2026 · mail by Oct 15', after: 'Aug 2026 · mail by Nov 16' })
    expect(lienLastWorkMonthsFor('2026-08-14', [])).toEqual(['2026-08'])
    expect(lienLastWorkMonthsFor('2026-08-14', ['2026-09'])).toEqual(['2026-09'])
  })
  it('with no property kind on record the words stand and the table does not', () => {
    const p = lienLastWorkPreview(job922('2026-10-02', { propertyKind: '' }))
    expect(p.verdict).toBe('fine')
    expect(p.rows).toEqual([])
    expect(p.sayWords).toContain('The property kind is not on record, so the dates cannot be drawn here; the Lien desk shows them.')
  })
})
