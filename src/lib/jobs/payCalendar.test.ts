import { describe, expect, it } from 'vitest'
import {
  PAY_CALENDAR_DEFAULT,
  PAY_CALENDAR_MISSED_RUN_DAYS,
  BILL_OWN_DUE_PRESS,
  JOB_RECORD_MIN_PAYMENTS,
  PAY_CALENDAR_DAYS_AFTER_MAX,
  PAY_CALENDAR_DAYS_AFTER_OFFERED,
  payTermsKindsWords,
  showsHowTheyPay,
  asPayCalendarRead,
  billCalendarRead,
  billOwnDuePreview,
  billOwnDueShort,
  billOwnDueWords,
  calendarBasisWords,
  calendarBillRead,
  calendarBillWords,
  calendarFor,
  calendarSourceFor,
  cutoffWordsFor,
  dueDayFor,
  expectedFromDue,
  indexPayCalendars,
  jobPayCalendarWords,
  latenessAgainst,
  latenessWords,
  nextCutoff,
  nextCutoffChip,
  normalizePayCalendar,
  ordinalDay,
  parseBillDueDayRow,
  parsePayCalendarRow,
  payCalendarPreview,
  payCalendarSavePayload,
  payCalendarShort,
  payCalendarShortFor,
  payCalendarWords,
  payCutoffLine,
  payTermsNoun,
  payerCalendarLead,
  paysDaysAfter,
  payerCalendarSummary,
  recordFor,
  recordLandsShort,
  recordLandsWords,
  recordOfShort,
  recordWords,
  sendTodayCutoffWords,
  usuallyLandsShort,
  usuallyLandsWords,
  type BillOwnDue,
  type PayCalendar,
  type PayCalendarRead,
  type PayCalendarReceipt,
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

describe('whose calendar a job reads (punch list #341)', () => {
  const payerRow = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: null, pay_day: 10, months_after: 1 })!
  const jobOwn = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: 'j2', cutoff_day: 25, pay_day: 30, months_after: 1 })!
  const jobOff = parsePayCalendarRow({ payer_customer_id: 'p1', job_id: 'j3', off: true })!
  const loneJob = parsePayCalendarRow({ payer_customer_id: 'p9', job_id: 'j9', pay_day: 15 })!
  const loneOff = parsePayCalendarRow({ payer_customer_id: 'p9', job_id: 'j8', off: true })!
  const index = indexPayCalendars([payerRow, jobOwn, jobOff, loneJob, loneOff])

  it("says the job's own, the payer's, switched off or none", () => {
    expect(calendarSourceFor(index, { payerId: 'p1', jobId: 'j1' })).toEqual({ calendar: TENTH, from: 'payer', payerCalendar: TENTH })
    expect(calendarSourceFor(index, { payerId: 'p1', jobId: 'j2' })).toEqual({ calendar: BY_25TH, from: 'job', payerCalendar: TENTH, jobId: 'j2' })
    expect(calendarSourceFor(index, { payerId: 'p1', jobId: 'j3' })).toEqual({ calendar: null, from: 'off', payerCalendar: TENTH, jobId: 'j3' })
    expect(calendarSourceFor(index, { payerId: 'p9', jobId: 'j9' })).toMatchObject({ from: 'job', payerCalendar: null })
    expect(calendarSourceFor(index, { payerId: 'p9', jobId: 'j8' })).toEqual({ calendar: null, from: 'off', payerCalendar: null, jobId: 'j8' })
    expect(calendarSourceFor(index, { payerId: 'p9', jobId: 'other' })).toEqual({ calendar: null, from: 'none', payerCalendar: null })
    expect(calendarSourceFor(index, { payerId: null, jobId: 'j2' }).from).toBe('none')
    expect(calendarSourceFor(null, { payerId: 'p1' }).from).toBe('none')
  })

  it("reads past a job's row when another party pays the bill", () => {
    // j2's own calendar is held for p1. A bill on j2 that p2 pays reads p2's, which has none.
    expect(calendarSourceFor(index, { payerId: 'p2', jobId: 'j2' })).toEqual({ calendar: null, from: 'none', payerCalendar: null })
  })

  it('agrees with calendarFor on every bill', () => {
    for (const bill of [{ payerId: 'p1', jobId: 'j1' }, { payerId: 'p1', jobId: 'j2' }, { payerId: 'p1', jobId: 'j3' }, { payerId: 'p9', jobId: 'j9' }, { payerId: 'p2', jobId: 'j2' }]) {
      expect(calendarFor(index, bill)).toEqual(calendarSourceFor(index, bill).calendar)
    }
  })

  it("says it in the job window's words", () => {
    const words = (payerId: string, jobId: string, canSet = true) => jobPayCalendarWords(calendarSourceFor(index, { payerId, jobId }), ' Larkfield Construction ', canSet)
    expect(words('p1', 'j1')).toMatchObject({ lead: 'Follows Larkfield Construction', press: 'In by month end, paid the 10th', tail: null })
    expect(words('p1', 'j2')).toMatchObject({ lead: 'This job’s own', press: 'In by the 25th, paid the 30th', tail: null })
    expect(words('p1', 'j3')).toMatchObject({ lead: null, press: 'No pay calendar on this job', tail: 'Larkfield Construction has one' })
    expect(words('p9', 'j8')).toMatchObject({ lead: null, press: 'No pay calendar on this job', tail: null })
    expect(words('p9', 'other')).toMatchObject({ lead: null, press: 'Set a pay calendar…', tail: null })
  })

  it("marks a job's own calendar wherever a row says its calendar, and takes a bare calendar as the payer's", () => {
    expect(payCalendarShortFor(calendarSourceFor(index, { payerId: 'p1', jobId: 'j2' }))).toBe('This job’s own · In by the 25th, paid the 30th')
    expect(payCalendarShortFor(calendarSourceFor(index, { payerId: 'p1', jobId: 'j1' }))).toBe(payCalendarShort(TENTH))
    expect(payCalendarShortFor(calendarSourceFor(index, { payerId: 'p1', jobId: 'j3' }))).toBeNull()
    expect(asPayCalendarRead(BY_25TH)).toEqual({ calendar: BY_25TH, from: 'payer', payerCalendar: BY_25TH })
    expect(asPayCalendarRead(null)).toEqual({ calendar: null, from: 'none', payerCalendar: null })
    const read = calendarSourceFor(index, { payerId: 'p1', jobId: 'j2' })
    expect(asPayCalendarRead(read)).toBe(read)
  })

  it('says nothing to a reader who may not set one when none is set, and still names one that is', () => {
    expect(jobPayCalendarWords(calendarSourceFor(index, { payerId: 'p9', jobId: 'other' }), 'Larkfield Construction', false)).toBeNull()
    expect(jobPayCalendarWords(calendarSourceFor(index, { payerId: 'p1', jobId: 'j2' }), 'Larkfield Construction', false)?.lead).toBe('This job’s own')
    expect(jobPayCalendarWords(calendarSourceFor(index, { payerId: 'p1', jobId: 'j1' }), null, true)?.lead).toBe('Follows this customer')
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
    // The fewest words, the day first, for a row that cuts the tail.
    expect(usuallyLandsShort('2026-12-10', latenessAgainst(receipts, TENTH))).toBe('Usually lands about Dec 16')
    expect(usuallyLandsShort('2026-12-10', latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-11-09' }], TENTH))).toBe('Usually lands by the due day')
    expect(usuallyLandsShort('2026-12-10', null)).toBeNull()
  })
})

describe('the cutoff as a row and the send window say it (PR 3)', () => {
  it('says the two days, blue while the cutoff is far and amber in its last week', () => {
    expect(payCutoffLine('2026-11-12', TENTH)).toEqual({
      sendBy: 'Send by Nov 30 to be due Dec 10.',
      after: 'After that, Jan 10.',
      soon: false,
      daysLeft: 18,
      cutoffYmd: '2026-11-30',
      title: 'A bill in by the last day of the month is paid the 10th of the next month. The cutoff is in 18 days.',
    })
    expect(payCutoffLine('2026-11-23', TENTH)).toMatchObject({ soon: true, daysLeft: 7 })
    expect(payCutoffLine('2026-11-22', TENTH)).toMatchObject({ soon: false, daysLeft: 8 })
    expect(payCutoffLine('2026-11-29', TENTH)?.title).toContain('The cutoff is tomorrow.')
    expect(payCutoffLine('2026-11-30', TENTH)).toMatchObject({ soon: true, daysLeft: 0, sendBy: 'Send by Nov 30 to be due Dec 10.' })
    expect(payCutoffLine('2026-11-30', TENTH)?.title).toContain('The cutoff is today.')
    // The day after the cutoff the line is next month's.
    expect(payCutoffLine('2026-12-01', TENTH)).toMatchObject({ sendBy: 'Send by Dec 31 to be due Jan 10.', after: 'After that, Feb 10.', soon: false })
    expect(payCutoffLine('nope', TENTH)).toBeNull()
  })

  it('says at the moment of sending what today makes the bill and what waiting costs', () => {
    expect(sendTodayCutoffWords('2026-11-12', BY_25TH)).toEqual({ due: 'Sent today, this bill is due Dec 30.', cutoff: 'Their cutoff is Nov 25. After that, Jan 30.', soon: false })
    // One day past the 25th: sent today it is already next month's.
    expect(sendTodayCutoffWords('2026-11-26', BY_25TH)).toEqual({ due: 'Sent today, this bill is due Jan 30.', cutoff: 'Their cutoff is Dec 25. After that, Feb 28.', soon: false })
    expect(sendTodayCutoffWords('2026-11-25', BY_25TH)?.soon).toBe(true)
  })

  it('names the nearest cutoff among the bills waiting to go, and how many it holds', () => {
    const lark = payCutoffLine('2026-11-12', TENTH)!
    const sable = payCutoffLine('2026-11-12', BY_25TH)!
    expect(nextCutoffChip([lark, sable, lark])).toEqual({ label: 'Next cutoff Nov 25 · 1 bill', soon: false, count: 1, cutoffYmd: '2026-11-25' })
    expect(nextCutoffChip([lark, lark])).toMatchObject({ label: 'Next cutoff Nov 30 · 2 bills', count: 2 })
    expect(nextCutoffChip([payCutoffLine('2026-11-20', BY_25TH)!])).toMatchObject({ soon: true })
    expect(nextCutoffChip([])).toBeNull()
  })
})

describe('the cutoff on a job still being worked (PR 5)', () => {
  it('says Bill by in place of Send by', () => {
    expect(payCutoffLine('2026-11-22', TENTH, 'Bill')).toMatchObject({ sendBy: 'Bill by Nov 30 to be due Dec 10.', after: 'After that, Jan 10.', daysLeft: 8 })
    expect(cutoffWordsFor(nextCutoff('2026-11-12', BY_25TH)!, 'Bill').sendBy).toBe('Bill by Nov 25 to be due Dec 30.')
  })
})

describe('one open bill against the calendar, for the waiting lists (v2.7127)', () => {
  const six = latenessAgainst([{ billedYmd: '2026-09-03', paidYmd: '2026-10-16' }], TENTH)

  it('is fine until its expected day, amber once past it, and red once a whole run was missed', () => {
    // In Nov 3, due Dec 10, expected Dec 16.
    expect(calendarBillRead('2026-11-03', TENTH, six, '2026-11-22')).toEqual({ dueYmd: '2026-12-10', expectedYmd: '2026-12-16', daysPastDue: 0, daysPastExpected: 0, tone: 'ok' })
    // Past due, and still inside how late this payer usually runs.
    expect(calendarBillRead('2026-11-03', TENTH, six, '2026-12-14')).toMatchObject({ daysPastDue: 4, daysPastExpected: 0, tone: 'ok' })
    expect(calendarBillRead('2026-11-03', TENTH, six, '2026-12-17')).toMatchObject({ daysPastDue: 7, daysPastExpected: 1, tone: 'warn' })
    expect(calendarBillRead('2026-11-03', TENTH, six, '2027-01-14')).toMatchObject({ daysPastExpected: 29, tone: 'warn' })
    expect(calendarBillRead('2026-11-03', TENTH, six, '2027-01-15')).toMatchObject({ daysPastExpected: PAY_CALENDAR_MISSED_RUN_DAYS, tone: 'late' })
  })

  it('reads the due day as the expected day with no payment on record, and nothing with no usable day', () => {
    expect(calendarBillRead('2026-11-03', TENTH, null, '2026-12-11')).toMatchObject({ expectedYmd: '2026-12-10', daysPastExpected: 1, tone: 'warn' })
    expect(calendarBillRead(null, TENTH, six, '2026-11-22')).toBeNull()
    expect(calendarBillRead('not a day', TENTH, six, '2026-11-22')).toBeNull()
  })

  it('says the due day, and how far past it or past expected the bill is', () => {
    expect(calendarBillWords(calendarBillRead('2026-11-03', TENTH, six, '2026-11-22')!)).toBe('due Dec 10')
    expect(calendarBillWords(calendarBillRead('2026-11-03', TENTH, six, '2026-12-14')!)).toBe('due Dec 10 · 4d past due')
    expect(calendarBillWords(calendarBillRead('2026-11-03', TENTH, six, '2026-12-28')!)).toBe('due Dec 10 · 12d past expected')
  })

  it('says what a calendar payer is measured against', () => {
    expect(calendarBasisWords(six)).toBe('pay calendar · lands ~6d after the pay day')
    expect(calendarBasisWords(latenessAgainst([{ billedYmd: '2026-10-06', paidYmd: '2026-11-09' }], TENTH))).toBe('pay calendar · lands by the pay day')
    expect(calendarBasisWords(null)).toBe('pay calendar · no payment on record yet')
  })
})

describe("the job's own record (punch list #341, PR 3)", () => {
  /** Larkfield on its other jobs: 37, 30 and 37 days after the 10th. Job 1431 on its own calendar: two payments, each on its due day. */
  const paid = (billedYmd: string, paidYmd: string, jobId: string | null = null): PayCalendarReceipt => ({ billedYmd, paidYmd, jobId })
  const OTHER_JOBS = [paid('2026-07-10', '2026-09-16', 'j1406'), paid('2026-08-06', '2026-10-10', 'j1406'), paid('2026-06-03', '2026-08-16', 'j1418')]
  const OWN_TWO = [paid('2026-08-20', '2026-09-30', 'j1431'), paid('2026-09-22', '2026-10-30', 'j1431')]
  const own = (jobId: string | null = 'j1431'): PayCalendarRead => ({ calendar: BY_25TH, from: 'job', payerCalendar: TENTH, jobId })
  const payers: PayCalendarRead = { calendar: TENTH, from: 'payer', payerCalendar: TENTH }

  it("scores the payer's calendar on the payer's payments on every job, as before", () => {
    const r = recordFor([...OTHER_JOBS, ...OWN_TWO], payers)!
    expect(r).toMatchObject({ of: 'payer', jobPayments: 0 })
    expect(r.lateness).toEqual(latenessAgainst([...OTHER_JOBS, ...OWN_TWO], TENTH))
    expect(recordWords(r, 'Larkfield Construction')).toBe(latenessWords(r.lateness))
    expect(recordOfShort(r)).toBeNull()
  })

  it("scores a job's own calendar on that job's payments once it has two, and says so", () => {
    expect(JOB_RECORD_MIN_PAYMENTS).toBe(2)
    const r = recordFor([...OTHER_JOBS, ...OWN_TWO], own())!
    expect(r).toMatchObject({ of: 'job', jobPayments: 2 })
    expect(r.lateness).toEqual(latenessAgainst(OWN_TWO, BY_25TH))
    expect(r.lateness?.medianDays).toBe(0)
    expect(recordWords(r, 'Larkfield Construction')).toBe('This job’s last 2 payments all landed by the due day.')
    expect(recordOfShort(r)).toBe('this job’s record')
    expect(recordLandsShort('2026-12-30', r)).toBe('Usually lands by the due day · this job’s record')
    expect(recordLandsWords('2026-12-30', r, 'Larkfield Construction')).toBe('Usually lands by the due day. That is this job’s own 2 payments, not Larkfield Construction’s other jobs.')
  })

  it("stands on the payer's record until the job has two, and says whose it is", () => {
    const none = recordFor(OTHER_JOBS, own())!
    expect(none).toMatchObject({ of: 'borrowed', jobPayments: 0 })
    expect(none.lateness).toEqual(latenessAgainst(OTHER_JOBS, BY_25TH))
    expect(recordWords(none, 'Larkfield Construction')).toBe(`No payment on this job yet. The record is Larkfield Construction’s on other jobs. ${latenessWords(none.lateness)}`)
    expect(recordOfShort(none)).toBe('their record on other jobs')

    const one = recordFor([...OTHER_JOBS, OWN_TWO[0]!], own())!
    expect(one).toMatchObject({ of: 'borrowed', jobPayments: 1 })
    expect(one.lateness?.count).toBe(4)
    expect(recordWords(one, 'Larkfield Construction')).toContain('One payment on this job so far. Until it has 2, the record is Larkfield Construction’s on all their jobs.')
    expect(recordLandsWords('2026-12-30', one, 'Larkfield Construction')).toContain('That is Larkfield Construction’s record on all their jobs. This job is scored on its own once it has 2 payments.')
  })

  it('says so when neither the job nor the payer has a payment', () => {
    const r = recordFor([], own())!
    expect(r).toEqual({ lateness: null, of: 'borrowed', jobPayments: 0 })
    expect(recordWords(r, 'Larkfield Construction')).toBe('No payment on this job yet, and none on record for Larkfield Construction. The due day is the best guess there is.')
    expect(recordLandsShort('2026-12-30', r)).toBe('No payment on this job yet')
    expect(recordLandsShort('2026-12-10', recordFor([], payers))).toBe('No payment on record yet')
    expect(recordLandsWords('2026-12-10', recordFor([], payers))).toBe('No payment of theirs is measured yet, so the due day is the best guess there is.')
  })

  it("reads a job's own calendar handed over with no job as the payer's, and nothing with no calendar", () => {
    expect(recordFor(OWN_TWO, own(null))?.of).toBe('payer')
    expect(recordFor(OWN_TWO, asPayCalendarRead(BY_25TH))?.of).toBe('payer')
    expect(recordFor(OWN_TWO, { calendar: null, from: 'off', payerCalendar: TENTH, jobId: 'j1431' })).toBeNull()
  })

  it('carries the job on the read the index answers', () => {
    const index = indexPayCalendars([
      { payerCustomerId: 'lark', jobId: null, off: false, calendar: TENTH, setByName: null, setAt: null },
      { payerCustomerId: 'lark', jobId: 'j1431', off: false, calendar: BY_25TH, setByName: null, setAt: null },
    ])
    expect(calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431' })).toMatchObject({ from: 'job', jobId: 'j1431' })
    expect(calendarSourceFor(index, { payerId: 'lark', jobId: 'j1406' })).toEqual({ calendar: TENTH, from: 'payer', payerCalendar: TENTH })
  })

  it('reads one bill against its own calendar and its own record', () => {
    // Job 1431's bill in Oct 22: due Nov 30 on its own calendar, and its two payments landed on the day.
    const bill = billCalendarRead(own(), '2026-10-22', [...OTHER_JOBS, ...OWN_TWO], '2026-12-05')!
    expect(bill).toMatchObject({ dueYmd: '2026-11-30', expectedYmd: '2026-11-30', daysPastExpected: 5, tone: 'warn' })
    expect(bill.of).toMatchObject({ calendar: BY_25TH, own: true, record: { of: 'job', jobPayments: 2 } })
    // The same bill scored on the payer's record would not be past its day yet.
    expect(calendarBillRead('2026-10-22', BY_25TH, latenessAgainst(OTHER_JOBS, BY_25TH), '2026-12-05')?.daysPastExpected).toBe(0)
    expect(billCalendarRead({ calendar: null, from: 'none', payerCalendar: null }, '2026-10-22', OWN_TWO, '2026-12-05')).toBeNull()
  })

  it("lends a payer's summary line the calendar of the bill furthest past its day", () => {
    const ownBill = billCalendarRead(own(), '2026-10-22', [...OTHER_JOBS, ...OWN_TWO], '2026-12-05')
    const ahead = billCalendarRead(payers, '2026-11-03', OTHER_JOBS, '2026-12-05')
    // A payer with no calendar of their own, and one job on its own that is past its day.
    expect(payerCalendarSummary({ calendar: null, lateness: null }, [null, ownBill])).toEqual({ calendar: BY_25TH, own: true, lateness: ownBill!.of!.record.lateness, recordOf: 'job', pastExpectedDays: 5 })
    // The payer's own calendar, with nothing past: the line reads the payer's, as before.
    const slow = latenessAgainst(OTHER_JOBS, TENTH)
    expect(payerCalendarSummary({ calendar: TENTH, lateness: slow }, [ahead])).toEqual({ calendar: TENTH, own: false, lateness: slow, recordOf: 'payer', pastExpectedDays: null })
    // Neither: a pace payer.
    expect(payerCalendarSummary({ calendar: null, lateness: null }, [null, undefined])).toEqual({ calendar: null, own: false, lateness: null, recordOf: null, pastExpectedDays: null })
    // A read built bare is the payer's.
    const bare = calendarBillRead('2026-08-05', TENTH, slow, '2026-12-05')
    expect(payerCalendarSummary({ calendar: TENTH, lateness: slow }, [bare])).toMatchObject({ calendar: TENTH, own: false, pastExpectedDays: 49 })
  })

  it("says whose calendar a summary line reads", () => {
    expect(calendarBasisWords(null, true)).toBe('a job’s own pay calendar · no payment on record yet')
    expect(calendarBasisWords(latenessAgainst([paid('2026-09-03', '2026-10-16')], TENTH), true)).toBe('a job’s own pay calendar · lands ~6d after the pay day')
    expect(payerCalendarLead('Larkfield Construction', false)).toBe('Larkfield Construction pays on a calendar.')
    expect(payerCalendarLead('Larkfield Construction', true)).toBe('One of Larkfield Construction’s jobs is on its own pay calendar.')
    expect(payerCalendarLead(null, false)).toBe('Pays on a calendar.')
    expect(payerCalendarLead(null, true)).toBe('One of their jobs is on its own pay calendar.')
  })
})

describe("one bill's own due day (punch list #341, PR 4)", () => {
  const RELEASE: BillOwnDue = { dueYmd: '2027-02-15', clause: '§ 9.4', words: 'Retainage is released 60 days after final acceptance', setByName: 'Rosa', setAt: '2026-11-15T18:00:00Z' }
  const rows = [
    { payerCustomerId: 'lark', jobId: null, off: false, calendar: TENTH, setByName: null, setAt: null },
    { payerCustomerId: 'lark', jobId: 'j1431', off: false, calendar: BY_25TH, setByName: null, setAt: null },
    parseBillDueDayRow({ invoice_id: 'inv-release', due_on: '2027-02-15', clause: ' § 9.4 ', words: ' Retainage is released 60 days after final acceptance ', marked_at: '2026-11-15T18:00:00Z' }, 'Rosa')!,
  ]
  const index = indexPayCalendars(rows)

  it('reads a stored row, and nothing from one with no bill or no day', () => {
    expect(rows[2]).toEqual({ payerCustomerId: '', jobId: null, off: false, calendar: null, setByName: 'Rosa', setAt: '2026-11-15T18:00:00Z', invoiceId: 'inv-release', ownDue: RELEASE })
    expect(parseBillDueDayRow({ invoice_id: 'inv-release', due_on: '2027-02-15T00:00:00Z' })?.ownDue).toEqual({ dueYmd: '2027-02-15', clause: '', words: '', setByName: null, setAt: null })
    expect(parseBillDueDayRow({ invoice_id: 'inv-release', due_on: 'soon' })).toBeNull()
    expect(parseBillDueDayRow({ invoice_id: 'inv-release', due_on: '2027-02-30' })).toBeNull()
    expect(parseBillDueDayRow({ due_on: '2027-02-15' })).toBeNull()
    expect(parseBillDueDayRow(null)).toBeNull()
  })

  it("rides with the calendars and leaves the payer's and the job's rows as they were", () => {
    expect(index.byInvoice?.get('inv-release')).toEqual(RELEASE)
    expect(index.byPayer.size).toBe(1)
    expect(index.byPayerJob.size).toBe(1)
    // A reader that hands over no bill reads the job's calendar, as before.
    expect(calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431' })).toEqual({ calendar: BY_25TH, from: 'job', payerCalendar: TENTH, jobId: 'j1431' })
    expect(calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431', invoiceId: 'inv-other' })).toMatchObject({ from: 'job' })
  })

  it('sits at the top of the ladder: the bill, the job, the payer, the guess', () => {
    const onJob = calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431', invoiceId: 'inv-release' })
    expect(onJob).toEqual({ calendar: null, from: 'bill', payerCalendar: TENTH, ownDue: RELEASE, under: { calendar: BY_25TH, from: 'job' } })
    expect(calendarSourceFor(index, { payerId: 'lark', jobId: 'j1406', invoiceId: 'inv-release' }).under).toEqual({ calendar: TENTH, from: 'payer' })
    // A payer with no calendar, and a bill typed to an email with no payer on file: the day still holds.
    expect(calendarSourceFor(index, { payerId: 'newco', jobId: 'j9', invoiceId: 'inv-release' })).toMatchObject({ from: 'bill', ownDue: RELEASE, under: { calendar: null, from: 'none' } })
    expect(calendarSourceFor(index, { payerId: null, invoiceId: 'inv-release' })).toMatchObject({ from: 'bill', ownDue: RELEASE, payerCalendar: null })
    // No calendar is handed on for it, so a reader that only knows calendars reads none.
    expect(calendarFor(index, { payerId: 'lark', jobId: 'j1431', invoiceId: 'inv-release' })).toBeNull()
    expect(payCalendarShortFor(onJob)).toBeNull()
    expect(recordFor([], onJob)).toBeNull()
  })

  it('reads one open bill against its own day: no clock, no record, the day itself', () => {
    const read = calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431', invoiceId: 'inv-release' })
    expect(billCalendarRead(read, null, null, '2026-11-15')).toEqual({ dueYmd: '2027-02-15', expectedYmd: '2027-02-15', daysPastDue: 0, daysPastExpected: 0, tone: 'ok', billOwn: true })
    expect(billCalendarRead(read, '2026-11-02', [{ billedYmd: '2026-09-03', paidYmd: '2026-10-16' }], '2027-02-20')).toMatchObject({ daysPastDue: 5, daysPastExpected: 5, tone: 'warn' })
    expect(billCalendarRead(read, null, null, '2027-03-17')).toMatchObject({ daysPastDue: PAY_CALENDAR_MISSED_RUN_DAYS, tone: 'late' })
    expect(calendarBillWords(billCalendarRead(read, null, null, '2026-11-15')!)).toBe('due Feb 15')
    expect(calendarBillWords(billCalendarRead(read, null, null, '2027-02-20')!)).toBe('due Feb 15 · 5d past due')
  })

  it("lends a payer's summary line its own day when it is the bill furthest past", () => {
    const read = calendarSourceFor(index, { payerId: 'lark', jobId: 'j1431', invoiceId: 'inv-release' })
    const late = billCalendarRead(read, null, null, '2027-02-20')
    const six = latenessAgainst([{ billedYmd: '2026-09-03', paidYmd: '2026-10-16' }], TENTH)
    expect(payerCalendarSummary({ calendar: TENTH, lateness: six }, [late])).toEqual({ calendar: null, own: false, lateness: null, recordOf: null, pastExpectedDays: 5, billOwn: true })
    expect(calendarBasisWords(null, false, true)).toBe('a bill’s own due day')
    // Ahead of its day, the line reads the payer's calendar, as before.
    expect(payerCalendarSummary({ calendar: TENTH, lateness: six }, [billCalendarRead(read, null, null, '2026-11-15')])).toMatchObject({ calendar: TENTH, pastExpectedDays: null })
  })

  it('says the day, its clause and what it replaces', () => {
    expect(BILL_OWN_DUE_PRESS).toBe('This bill is due on…')
    expect(billOwnDueShort(RELEASE)).toBe('This bill’s own day · § 9.4')
    expect(billOwnDueShort({ dueYmd: '2027-02-15', clause: '', words: '' })).toBe('This bill’s own day')
    expect(billOwnDueWords(RELEASE)).toBe('§ 9.4: Retainage is released 60 days after final acceptance. No pay calendar is read for this bill.')
    expect(billOwnDueWords({ dueYmd: '2027-02-15', clause: '', words: '' })).toBe('The contract names this date for this one bill. No pay calendar is read for this bill.')
    expect(billOwnDuePreview('2027-02-15', { dueYmd: '2026-12-30', own: true })).toEqual({ otherwise: 'By this job’s own pay calendar it is due Dec 30.', own: 'On its own day it is due Feb 15.', picked: true })
    expect(billOwnDuePreview('', { dueYmd: '2026-12-10', own: false })).toEqual({ otherwise: 'By the pay calendar it is due Dec 10.', own: 'Pick the day to see what it makes the bill.', picked: false })
    expect(billOwnDuePreview('2027-02-15', null).otherwise).toBe('With no pay calendar it reads the usual guess.')
  })
})

describe('terms in days are hidden until a contract needs them (punch list #341, call 4)', () => {
  it('the window does not offer them: no contract here pays a number of days after the bill', () => {
    expect(PAY_CALENDAR_DAYS_AFTER_OFFERED).toBe(false)
  })

  it('the choice of how they pay is drawn only for terms that are in days, or were while the fields were open', () => {
    expect(showsHowTheyPay({ days: false, hadDays: false })).toBe(false)
    expect(showsHowTheyPay({ days: true, hadDays: false })).toBe(true)
    // Switched to a set day: the choice stays, so the way back is one press.
    expect(showsHowTheyPay({ days: false, hadDays: true })).toBe(true)
    // The day a contract needs it, the switch brings the choice back for everyone.
    expect(showsHowTheyPay({ days: false, hadDays: false, offered: true })).toBe(true)
  })

  it('a line that introduces the calendar names the second kind only where it can be picked', () => {
    expect(payTermsKindsWords()).toBe('a set day of the month')
    expect(payTermsKindsWords(true)).toBe('a set day of the month, or a number of days after the bill')
    // A job with no calendar anywhere, read by someone who may set one: the press's hover words.
    const none = calendarSourceFor(indexPayCalendars([]), { payerId: 'p9', jobId: 'j9' })
    expect(jobPayCalendarWords(none, 'Larkfield Construction', true)?.title).toBe('For a job whose contract says when its payer pays: a set day of the month')
  })
})

describe('a number of days after the bill (punch list #341, PR 5)', () => {
  /** Paid 45 days after the bill is accepted. */
  const NET_45 = normalizePayCalendar({ daysAfter: 45, clause: ' § 7.1 ', words: 'Paid 45 days after an approved application.' })!

  it('reads the second shape with no pay day, and keeps the first shape as it was', () => {
    expect(NET_45).toEqual({ cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 7.1', words: 'Paid 45 days after an approved application.', daysAfter: 45 })
    expect(paysDaysAfter(NET_45)).toBe(true)
    expect([paysDaysAfter(TENTH), paysDaysAfter(null), paysDaysAfter({ ...TENTH, daysAfter: null })]).toEqual([false, false, false])
    // A calendar of the first shape carries no days key at all, so everything that compared one still does.
    expect('daysAfter' in normalizePayCalendar({ payDay: 10 })!).toBe(false)
    // Days out of range are not terms: with a pay day the row is a calendar, with none it is nothing.
    expect(normalizePayCalendar({ daysAfter: 0, payDay: 15 })).toMatchObject({ payDay: 15 })
    expect(normalizePayCalendar({ daysAfter: PAY_CALENDAR_DAYS_AFTER_MAX + 1 })).toBeNull()
    expect(normalizePayCalendar({ daysAfter: 30.5 })).toBeNull()
  })

  it('reads a stored row, and a row read before the column as no calendar', () => {
    const row = parsePayCalendarRow({ payer_customer_id: 'lark', job_id: 'j1431', off: false, cutoff_day: null, pay_day: null, months_after: 1, pay_when_paid: true, clause: '§ 7.1', words: '', days_after: 45 })!
    expect(row.calendar).toMatchObject({ daysAfter: 45, payWhenPaid: true, clause: '§ 7.1' })
    // A reader from before the push selects no days_after: such a row has no pay day, so it is skipped and the bill reads the pace guess.
    expect(parsePayCalendarRow({ payer_customer_id: 'lark', job_id: null, off: false, cutoff_day: null, pay_day: null, months_after: 1 })).toBeNull()
  })

  it('makes a bill due the day it was accepted plus the days, with no cutoff to miss', () => {
    expect(dueDayFor('2026-11-03', NET_45)).toBe('2026-12-18')
    expect(dueDayFor('2026-11-30', NET_45)).toBe('2027-01-14')
    expect(dueDayFor('2026-12-01', NET_45)).toBe('2027-01-15')
    expect(dueDayFor('not a day', NET_45)).toBeNull()
    expect(nextCutoff('2026-11-12', NET_45)).toBeNull()
    expect(payCutoffLine('2026-11-12', NET_45)).toBeNull()
    expect(payCutoffLine('2026-11-12', NET_45, 'Bill')).toBeNull()
  })

  it('says the terms in a sentence, in a few words, and in dates', () => {
    expect(payCalendarWords(NET_45)).toBe('A bill is paid 45 days after it is accepted.')
    expect(payCalendarWords({ ...NET_45, daysAfter: 1 })).toBe('A bill is paid 1 day after it is accepted.')
    expect(payCalendarShort(NET_45)).toBe('Paid 45 days after the bill')
    expect(payCalendarShortFor({ calendar: NET_45, from: 'job', payerCalendar: TENTH, jobId: 'j1431' })).toBe('This job’s own · Paid 45 days after the bill')
    expect(payCalendarPreview(NET_45, '2026-11-12')).toEqual({ inBy: 'A bill accepted today, Nov 12, is due Dec 27.', dayLate: 'Each bill has its own due day. No cutoff decides a month.' })
    expect(sendTodayCutoffWords('2026-11-12', NET_45)).toEqual({ due: 'Sent today, this bill is due Dec 27.', cutoff: 'They pay 45 days after they accept it.', soon: false })
    expect(jobPayCalendarWords({ calendar: NET_45, from: 'job', payerCalendar: null, jobId: 'j1431' }, 'Larkfield Construction', true)).toMatchObject({ lead: 'This job’s own', press: 'Paid 45 days after the bill' })
  })

  it('names them terms, not a calendar, where a line names them', () => {
    expect([payTermsNoun(NET_45), payTermsNoun(TENTH), payTermsNoun(null)]).toEqual(['pay terms', 'pay calendar', 'pay calendar'])
    const late = latenessAgainst([{ billedYmd: '2026-08-01', paidYmd: '2026-09-21' }], NET_45)
    expect(late).toMatchObject({ count: 1, medianDays: 6 })
    expect(calendarBasisWords(late, false, false, NET_45)).toBe('pay terms · lands ~6d after the due day')
    expect(calendarBasisWords(null, true, false, NET_45)).toBe('a job’s own pay terms · no payment on record yet')
    expect(calendarBasisWords(late)).toBe('pay calendar · lands ~6d after the pay day')
    expect(payerCalendarLead('Larkfield Construction', false, NET_45)).toBe('Larkfield Construction pays a set number of days after a bill.')
    expect(payerCalendarLead('Larkfield Construction', true, NET_45)).toBe('One of Larkfield Construction’s jobs is on its own pay terms.')
  })

  it('replays the record and reads an open bill as any calendar does', () => {
    // Billed Aug 1 and Sep 1, due Sep 15 and Oct 16: paid 6 days after each.
    const late = latenessAgainst([{ billedYmd: '2026-08-01', paidYmd: '2026-09-21' }, { billedYmd: '2026-09-01', paidYmd: '2026-10-22' }], NET_45)
    expect(late).toMatchObject({ count: 2, medianDays: 6, onTime: 0 })
    expect(expectedFromDue('2026-12-18', late)).toBe('2026-12-24')
    expect(calendarBillRead('2026-11-03', NET_45, late, '2026-12-20')).toMatchObject({ dueYmd: '2026-12-18', expectedYmd: '2026-12-24', daysPastDue: 2, daysPastExpected: 0, tone: 'ok' })
    expect(calendarBillRead('2026-11-03', NET_45, late, '2026-12-26')).toMatchObject({ daysPastExpected: 2, tone: 'warn' })
  })

  it('sends a save the days with no pay day, and a calendar as it always went', () => {
    expect(payCalendarSavePayload({ ...NET_45, clause: ' § 7.1 ' })).toEqual({ daysAfter: 45, payWhenPaid: false, clause: '§ 7.1', words: 'Paid 45 days after an approved application.' })
    expect(payCalendarSavePayload(BY_25TH)).toEqual({ cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' })
    // A form switched back to a set day carries a null days key, and goes as a calendar.
    expect(payCalendarSavePayload({ ...BY_25TH, daysAfter: null })).toEqual({ cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' })
  })
})
