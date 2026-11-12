import { describe, expect, it } from 'vitest'
import {
  PAY_CALENDAR_DEFAULT,
  calendarFor,
  cutoffWordsFor,
  dueDayFor,
  expectedFromDue,
  indexPayCalendars,
  latenessAgainst,
  latenessWords,
  nextCutoff,
  normalizePayCalendar,
  ordinalDay,
  parsePayCalendarRow,
  payCalendarPreview,
  payCalendarShort,
  payCalendarWords,
  usuallyLandsWords,
  type PayCalendar,
} from './payCalendar'

const cal = (over: Partial<PayCalendar> = {}): PayCalendar => ({ ...PAY_CALENDAR_DEFAULT, ...over })

/** Paid the 10th of the month after it is received. */
const TENTH = cal()
/** In by the 25th, paid the 30th of the next month. */
const BY_25TH = cal({ cutoffDay: 25, payDay: 30 })

describe('dueDayFor', () => {
  it('pays the 10th of the month after the month a bill is in', () => {
    expect(dueDayFor('2026-11-01', TENTH)).toBe('2026-12-10')
    expect(dueDayFor('2026-11-30', TENTH)).toBe('2026-12-10')
  })

  it('costs a whole month one day past the cutoff', () => {
    expect(dueDayFor('2026-12-01', TENTH)).toBe('2027-01-10')
    expect(dueDayFor('2026-11-25', BY_25TH)).toBe('2026-12-30')
    expect(dueDayFor('2026-11-26', BY_25TH)).toBe('2027-01-30')
  })

  it('reads the common contracts with three numbers', () => {
    // In by the 20th, paid by the 10th.
    expect(dueDayFor('2026-11-20', cal({ cutoffDay: 20 }))).toBe('2026-12-10')
    expect(dueDayFor('2026-11-21', cal({ cutoffDay: 20 }))).toBe('2027-01-10')
    // Net 30 after the month closes: the last day of the next month.
    expect(dueDayFor('2026-11-12', cal({ payDay: 31 }))).toBe('2026-12-31')
    // In by the 5th, paid the 20th of the same month.
    expect(dueDayFor('2026-11-05', cal({ cutoffDay: 5, payDay: 20, monthsAfter: 0 }))).toBe('2026-11-20')
    expect(dueDayFor('2026-11-06', cal({ cutoffDay: 5, payDay: 20, monthsAfter: 0 }))).toBe('2026-12-20')
    // Two months on.
    expect(dueDayFor('2026-11-12', cal({ monthsAfter: 2 }))).toBe('2027-01-10')
  })

  it('takes the last day of a month that has no such day', () => {
    expect(dueDayFor('2027-01-15', cal({ payDay: 31 }))).toBe('2027-02-28')
    expect(dueDayFor('2027-01-15', cal({ payDay: 30 }))).toBe('2027-02-28')
    expect(dueDayFor('2028-01-15', cal({ payDay: 30 }))).toBe('2028-02-29')
    expect(dueDayFor('2026-03-31', cal({ payDay: 31 }))).toBe('2026-04-30')
  })

  it('never names a day before the bill was in', () => {
    // The same month's 10th has passed when the bill goes in on the 25th: it is the next month's.
    expect(dueDayFor('2026-11-25', cal({ monthsAfter: 0 }))).toBe('2026-12-10')
    expect(dueDayFor('2026-11-10', cal({ monthsAfter: 0 }))).toBe('2026-11-10')
  })

  it('reads a timestamp by its day and refuses a bad day', () => {
    expect(dueDayFor('2026-11-03T15:00:00Z', TENTH)).toBe('2026-12-10')
    expect(dueDayFor('', TENTH)).toBeNull()
    expect(dueDayFor(null, TENTH)).toBeNull()
    expect(dueDayFor('2026-02-30', TENTH)).toBeNull()
  })
})

describe('nextCutoff', () => {
  it('names the last day to send and what one day late costs', () => {
    expect(nextCutoff('2026-11-12', TENTH)).toEqual({ cutoffYmd: '2026-11-30', daysLeft: 18, dueYmd: '2026-12-10', nextDueYmd: '2027-01-10' })
    expect(nextCutoff('2026-11-12', BY_25TH)).toEqual({ cutoffYmd: '2026-11-25', daysLeft: 13, dueYmd: '2026-12-30', nextDueYmd: '2027-01-30' })
  })

  it('is today on the cutoff day and next month the day after', () => {
    expect(nextCutoff('2026-11-25', BY_25TH)?.daysLeft).toBe(0)
    expect(nextCutoff('2026-11-26', BY_25TH)).toEqual({ cutoffYmd: '2026-12-25', daysLeft: 29, dueYmd: '2027-01-30', nextDueYmd: '2027-02-28' })
    expect(nextCutoff('2026-02-28', TENTH)?.cutoffYmd).toBe('2026-02-28')
    expect(nextCutoff('2028-02-28', TENTH)?.cutoffYmd).toBe('2028-02-29')
  })

  it('says it in the words a row carries', () => {
    expect(cutoffWordsFor(nextCutoff('2026-11-12', TENTH)!)).toEqual({ sendBy: 'Send by Nov 30 to be due Dec 10.', after: 'After that, Jan 10.' })
  })

  it('refuses a bad day', () => {
    expect(nextCutoff('nope', TENTH)).toBeNull()
  })
})

describe('the words', () => {
  it('says a calendar in one sentence of twenty words or fewer', () => {
    expect(payCalendarWords(TENTH)).toBe('A bill in by the last day of the month is paid the 10th of the next month.')
    expect(payCalendarWords(BY_25TH)).toBe('A bill in by the 25th is paid the 30th of the next month.')
    expect(payCalendarWords(cal({ cutoffDay: 5, payDay: 31, monthsAfter: 0 }))).toBe('A bill in by the 5th is paid the last day of the same month.')
    expect(payCalendarWords(cal({ monthsAfter: 2 }))).toBe('A bill in by the last day of the month is paid the 10th of the month after that.')
    for (const c of [TENTH, BY_25TH, cal({ monthsAfter: 2, cutoffDay: 22, payDay: 23 })]) expect(payCalendarWords(c).split(' ').length).toBeLessThanOrEqual(20)
  })

  it('has a short form', () => {
    expect(payCalendarShort(TENTH)).toBe('In by month end, paid the 10th')
    expect(payCalendarShort(BY_25TH)).toBe('In by the 25th, paid the 30th')
  })

  it('says the preview back in plain dates', () => {
    expect(payCalendarPreview(TENTH, '2026-11-12')).toEqual({ inBy: 'A bill in by Nov 30 is due Dec 10.', dayLate: 'A bill in on Dec 1 is due Jan 10.' })
    expect(payCalendarPreview(BY_25TH, '2026-11-12')).toEqual({ inBy: 'A bill in by Nov 25 is due Dec 30.', dayLate: 'A bill in on Nov 26 is due Jan 30.' })
  })

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 30, 31].map(ordinalDay)).toEqual(['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '30th', '31st'])
  })
})

describe('normalizePayCalendar', () => {
  it('needs a pay day a month can hold', () => {
    expect(normalizePayCalendar(null)).toBeNull()
    expect(normalizePayCalendar({ payDay: 0 })).toBeNull()
    expect(normalizePayCalendar({ payDay: 32 })).toBeNull()
    expect(normalizePayCalendar({ payDay: '10' })).toBeNull()
  })

  it('reads the rest defensively', () => {
    expect(normalizePayCalendar({ payDay: 10 })).toEqual(TENTH)
    expect(normalizePayCalendar({ payDay: 30, cutoffDay: 25, monthsAfter: 1, payWhenPaid: true, clause: ' § 5.2 ', words: ' Paid the 30th. ' })).toEqual({
      cutoffDay: 25,
      payDay: 30,
      monthsAfter: 1,
      payWhenPaid: true,
      clause: '§ 5.2',
      words: 'Paid the 30th.',
    })
    // A cutoff past the 28th is the last day of the month; a wild month count is the next month.
    expect(normalizePayCalendar({ payDay: 10, cutoffDay: 30, monthsAfter: 9 })).toEqual(TENTH)
  })
})

describe('parsePayCalendarRow and calendarFor', () => {
  const payerRow = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: null, off: false, cutoff_day: null, pay_day: 10, months_after: 1, pay_when_paid: false, clause: '§ 5.2', words: '', set_at: '2026-11-12T18:00:00Z' }, ' Rosa ')!
  const jobOwn = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: 'j2', off: false, cutoff_day: 25, pay_day: 30, months_after: 1 })!
  const jobOff = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: 'j3', off: true })!

  it('reads a payer row, a job row and a job off switch', () => {
    expect(payerRow).toMatchObject({ payerCustomerId: 'p1', jobId: null, off: false, setByName: 'Rosa', setAt: '2026-11-12T18:00:00Z' })
    expect(payerRow.calendar).toEqual({ ...TENTH, clause: '§ 5.2' })
    expect(jobOwn.calendar).toEqual(BY_25TH)
    expect(jobOff).toMatchObject({ jobId: 'j3', off: true, calendar: null })
  })

  it('drops a row that is neither', () => {
    expect(parsePayCalendarRow(null)).toBeNull()
    expect(parsePayCalendarRow({ job_id: 'j1', pay_day: 10 })).toBeNull()
    expect(parsePayCalendarRow({ payer_customer_id: 'p1', pay_day: null })).toBeNull()
    // The payer's own row cannot be an off switch: no row is how a payer has none.
    expect(parsePayCalendarRow({ payer_customer_id: 'p1', job_id: null, off: true })).toBeNull()
  })

  it("reads a job's own row, else the payer's, else none", () => {
    const index = indexPayCalendars([payerRow, jobOwn, jobOff])
    expect(calendarFor(index, { payerId: 'p1', jobId: 'j1' })).toEqual({ ...TENTH, clause: '§ 5.2' })
    expect(calendarFor(index, { payerId: 'p1' })).toEqual({ ...TENTH, clause: '§ 5.2' })
    expect(calendarFor(index, { payerId: 'p1', jobId: 'j2' })).toEqual(BY_25TH)
    expect(calendarFor(index, { payerId: 'p1', jobId: 'j3' })).toBeNull()
    expect(calendarFor(index, { payerId: 'p2', jobId: 'j1' })).toBeNull()
    expect(calendarFor(index, { payerId: null, jobId: 'j2' })).toBeNull()
    expect(calendarFor(null, { payerId: 'p1' })).toBeNull()
  })

  it("holds a job's row for a payer with no calendar of its own", () => {
    const index = indexPayCalendars([parsePayCalendarRow({ payer_customer_id: 'p9', job_id: 'j9', pay_day: 15 })!])
    expect(calendarFor(index, { payerId: 'p9', jobId: 'j9' })?.payDay).toBe(15)
    expect(calendarFor(index, { payerId: 'p9', jobId: 'other' })).toBeNull()
  })
})

describe('the record against the calendar', () => {
  // Bills in during October are due Nov 10; these landed on it, 6 days after and 14 days after.
  const receipts = [
    { billedYmd: '2026-10-06', paidYmd: '2026-11-10' },
    { billedYmd: '2026-10-27', paidYmd: '2026-11-16' },
    { billedYmd: '2026-09-03', paidYmd: '2026-10-24' },
    { billedYmd: '2026-08-20', paidYmd: '2026-09-16' },
  ]

  it('measures each payment against its own due day', () => {
    expect(latenessAgainst(receipts, TENTH)).toEqual({ count: 4, medianDays: 6, minDays: 0, maxDays: 14, onTime: 1 })
  })

  it('never reads a payer as early', () => {
    const early = latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-11-02' }], TENTH)
    expect(early).toEqual({ count: 1, medianDays: 0, minDays: -8, maxDays: -8, onTime: 1 })
    expect(expectedFromDue('2026-12-10', early)).toBe('2026-12-10')
  })

  it('has nothing to say with nothing measured', () => {
    expect(latenessAgainst([], TENTH)).toBeNull()
    expect(latenessAgainst(null, TENTH)).toBeNull()
    expect(latenessAgainst([{ billedYmd: 'x', paidYmd: '2026-11-02' }], TENTH)).toBeNull()
  })

  it('expects the due day plus the usual lateness, and the due day alone with no record', () => {
    expect(expectedFromDue('2026-12-10', latenessAgainst(receipts, TENTH))).toBe('2026-12-16')
    expect(expectedFromDue('2026-12-10', null)).toBe('2026-12-10')
  })

  it('says the record in the words the window shows', () => {
    expect(latenessWords(latenessAgainst(receipts, TENTH))).toBe('Their last 4 payments landed 0 to 14 days after the due day. Usually about 6. 1 of 4 were on time.')
    expect(latenessWords(null)).toBe('No payment on record yet. The due day is the best guess there is.')
    expect(latenessWords(latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-12-09' }], TENTH))).toBe('Their one payment on record landed 29 days after its due day.')
    expect(latenessWords(latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-11-09' }], TENTH))).toBe('Their one payment on record landed by its due day.')
    expect(
      latenessWords(
        latenessAgainst(
          [
            { billedYmd: '2026-10-06', paidYmd: '2026-11-09' },
            { billedYmd: '2026-09-06', paidYmd: '2026-10-10' },
          ],
          TENTH,
        ),
      ),
    ).toBe('Their last 2 payments all landed by the due day.')
    // A payer who runs far past: the words say so plainly.
    const far = latenessAgainst(
      [
        { billedYmd: '2026-07-06', paidYmd: '2026-10-13' },
        { billedYmd: '2026-08-31', paidYmd: '2026-10-27' },
        { billedYmd: '2026-09-23', paidYmd: '2026-10-20' },
      ],
      TENTH,
    )
    expect(far).toEqual({ count: 3, medianDays: 47, minDays: 10, maxDays: 64, onTime: 0 })
    expect(latenessWords(far)).toBe('Their last 3 payments landed 10 to 64 days after the due day. Usually about 47.')
  })

  it('says it short for the line under a dates row', () => {
    expect(usuallyLandsWords('2026-12-10', latenessAgainst(receipts, TENTH))).toBe('Usually lands about 6d after. About Dec 16.')
    expect(usuallyLandsWords('2026-12-10', latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-11-09' }], TENTH))).toBe('Usually lands by the due day.')
    expect(usuallyLandsWords('2026-12-10', null)).toBeNull()
  })
})
