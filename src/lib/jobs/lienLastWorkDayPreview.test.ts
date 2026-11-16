import { describe, expect, it } from 'vitest'
import { filingDeadlineForMonth, suitDeadlineFor } from './lienDeadlines'
import { lienLastWorkAffidavitMonths, lienLastWorkDayWords, lienLastWorkMonthsFor, lienLastWorkPreview, lienLastWorkShiftSize, type LienLastWorkPreviewInput } from './lienLastWorkDayPreview'

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
  it('the slip: July for October is no longer refused (v2.7447). It asks for a second look, since a notice names September', () => {
    const p = lienLastWorkPreview(job922('2026-07-02', { noticedMonths: ['2026-09'] }))
    expect(p.verdict).toBe('look')
    expect(p.shiftWords).toBe('Last day of work Jul 2 — two months earlier than the clock hours say (Sep 2).')
    expect(p.sayWords).toBe('The hours run to Sep 2, after this day. They stay as they are and do not move it. Sep 2026 has clock hours and is off the lien clock with this day. That is a long way before the last clocked hour. Sep 2026 is named on a notice already recorded. The notice stays on record, and the lien clock stops counting that month. Make sure the day is right before you set it.')
    expect(p.after).toMatchObject({ day: '2026-07-02', months: ['2026-07'], lastMonth: '2026-07' })
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
    // v2.7193, punch list #335, row 1: the day set by hand counts, so a month of hours after it is off the clock. It read ['2026-09'].
    expect(lienLastWorkMonthsFor('2026-08-14', ['2026-09'])).toEqual(['2026-08'])
    expect(lienLastWorkMonthsFor('2026-08-14', ['2026-06', '2026-08', '2026-09'])).toEqual(['2026-06', '2026-08'])
  })
  it('with no property kind on record the words stand and the table does not', () => {
    const p = lienLastWorkPreview(job922('2026-10-02', { propertyKind: '' }))
    expect(p.verdict).toBe('fine')
    expect(p.rows).toEqual([])
    expect(p.sayWords).toContain('The property kind is not on record, so the dates cannot be drawn here; the Lien desk shows them.')
  })
})

describe('lienLastWorkPreview — a day earlier than the clock hours (v2.7447, punch list #335)', () => {
  it('a few days earlier in the same month is fine: the hours stay, nothing leaves the clock', () => {
    const p = lienLastWorkPreview(job922('2026-08-28', { lastSessionDay: '2026-09-02', clockMonths: ['2026-07', '2026-08', '2026-09'] }))
    expect(p.verdict).toBe('fine')
    expect(p.shiftWords).toBe('Last day of work Aug 28 — 5 days earlier than the clock hours say (Sep 2).')
    expect(p.sayWords).toBe('The hours run to Sep 2, after this day. They stay as they are and do not move it. Sep 2026 has clock hours and is off the lien clock with this day. The dates below move with it.')
    expect(p.rows.map((r) => [r.what, r.before, r.after, r.changed])).toEqual([
      ['Last day of work', 'Sep 2 · clock hours', 'Aug 28 · set by hand', true],
      ['Months the notice names', 'Jul 2026, Aug 2026, Sep 2026', 'Jul 2026, Aug 2026', true],
      ['Months off the clock', 'none', 'Sep 2026', true],
      ['§ 53.056 for the last month', 'Sep 2026 · mail by Nov 16', 'Aug 2026 · mail by Oct 15', true],
      ['§ 53.052 affidavit', 'file by Dec 15', 'file by Nov 16', true],
      ['§ 53.158 suit', `by ${lienLastWorkDayWords(suitDeadlineFor(filingDeadlineForMonth('2026-09-01', 'residential')), '2026-10-06')}`, `by ${lienLastWorkDayWords(suitDeadlineFor(filingDeadlineForMonth('2026-08-01', 'residential')), '2026-10-06')}`, true],
    ])
  })
  it('an earlier day in the month the hours end in takes no month off, and the table has no off-the-clock row', () => {
    const p = lienLastWorkPreview(job922('2026-09-01'))
    expect(p.verdict).toBe('fine')
    expect(p.sayWords).toBe('The hours run to Sep 2, after this day. They stay as they are and do not move it. The dates below move with it.')
    expect(p.rows.map((r) => r.what)).toEqual(['Last day of work', 'Months the notice names', '§ 53.056 for the last month', '§ 53.052 affidavit', '§ 53.158 suit'])
  })
  it('a day before the first month with hours asks for a second look and says no clocked month stays', () => {
    const p = lienLastWorkPreview(job922('2026-06-20'))
    expect(p.verdict).toBe('look')
    expect(p.sayWords).toBe("The hours run to Sep 2, after this day. They stay as they are and do not move it. Jul 2026 and Sep 2026 have clock hours and are off the lien clock with this day. The day is before the first month with clock hours, so no month with hours stays on the lien clock. With this day the affidavit's last day to file was Sep 15, so the lien right would read as gone. Make sure the day is right before you set it. Jun 2026 would join the notice with its window already closed, so it would read as missed.")
    expect(p.after?.months).toEqual(['2026-06'])
  })
  it('a month the affidavit names, taken away, asks for a second look in its own words', () => {
    const p = lienLastWorkPreview(job922('2026-08-30', { clockMonths: ['2026-08', '2026-09'], affidavitMonths: ['2026-09'] }))
    expect(p.verdict).toBe('look')
    expect(p.sayWords).toContain("Sep 2026 is named on the job's affidavit. Read the affidavit again before it is filed.")
  })
  it('an earlier day that puts the affidavit day in the past says the lien right would read as gone', () => {
    // Hours through Sep 2 (file by Dec 15). A day in July moves the affidavit day to Oct 15, and today is Oct 20.
    const p = lienLastWorkPreview(job922('2026-07-30', { todayYmd: '2026-10-20' }))
    expect(p.verdict).toBe('look')
    expect(p.sayWords).toContain("With this day the affidavit's last day to file was Oct 15, so the lien right would read as gone.")
    expect(p.rows.find((r) => r.what === '§ 53.052 affidavit')).toMatchObject({ before: 'file by Dec 15', after: 'file by Oct 15 · already past', changed: true })
  })
  it('a hand day that later hours already follow can be corrected to another earlier day', () => {
    const p = lienLastWorkPreview(job922('2026-08-20', { currentDay: '2026-08-25', currentSource: 'hand', clockMonths: ['2026-07', '2026-09'] }))
    expect(p.verdict).toBe('fine')
    expect(p.rows.find((r) => r.what === 'Months off the clock')).toMatchObject({ before: 'Sep 2026', after: 'Sep 2026', changed: false })
  })
  it('with no property kind the earlier day still says what leaves the clock', () => {
    const p = lienLastWorkPreview(job922('2026-08-28', { propertyKind: '', clockMonths: [] }))
    expect(p.verdict).toBe('fine')
    expect(p.rows).toEqual([])
    expect(p.sayWords).toContain('Sep 2026 has clock hours and is off the lien clock with this day.')
  })
})

describe('lienLastWorkAffidavitMonths (v2.7447)', () => {
  it('the last month of an approved or filed affidavit, and nothing for any other paper', () => {
    expect(lienLastWorkAffidavitMonths({ lastMonth: '2026-09', item: { status: 'approved' } })).toEqual(['2026-09'])
    expect(lienLastWorkAffidavitMonths({ lastMonth: '2026-09', item: { status: 'sent', voided_at: null } })).toEqual(['2026-09'])
    expect(lienLastWorkAffidavitMonths({ lastMonth: '2026-09', item: { status: 'drafted' } })).toEqual([])
    expect(lienLastWorkAffidavitMonths({ lastMonth: '2026-09', item: { status: 'approved', voided_at: '2026-10-01T00:00:00Z' } })).toEqual([])
    expect(lienLastWorkAffidavitMonths({ lastMonth: '2026-09', item: null })).toEqual([])
    expect(lienLastWorkAffidavitMonths(undefined)).toEqual([])
  })
})
