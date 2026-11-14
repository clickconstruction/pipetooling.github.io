import { describe, expect, it } from 'vitest'
import { DATED_FROM_CREATION_WORDS } from './lienDesk'
import { DATED_FROM_BILL_WORDS, lienBillDay, lienBillMonths, lienStandInLine, lienStandInMonth, lienStandInWords, MONTH_FROM_BILL_LINE, MONTH_FROM_CREATION_LINE } from './lienBillMonths'

const bill = (billed_at: string | null, sent_to_customer_at: string | null = null, status = 'billed') => ({ status, billed_at, sent_to_customer_at })

describe('a bill’s day is the earlier of its billed day and its sent day', () => {
  it('reads each instant in the company calendar', () => {
    // 05:42 UTC on the 18th is still the 18th in Chicago; 03:10 UTC on the 1st is the 31st of the month before.
    expect(lienBillDay(bill('2026-08-18T05:42:45Z'))).toBe('2026-08-18')
    expect(lienBillDay(bill('2026-09-01T03:10:00Z'))).toBe('2026-08-31')
  })

  it('a bill sent again later keeps its first day, and a typed earlier sent day wins', () => {
    expect(lienBillDay(bill('2026-08-18T17:13:00Z', '2026-09-04T14:28:00Z'))).toBe('2026-08-18')
    expect(lienBillDay(bill('2026-08-18T06:01:00Z', '2026-07-24T17:00:00Z'))).toBe('2026-07-24')
  })

  it('takes whichever day there is, and none when there is neither', () => {
    expect(lienBillDay(bill(null, '2026-10-02T15:00:00Z'))).toBe('2026-10-02')
    expect(lienBillDay(bill('2026-10-02'))).toBe('2026-10-02')
    expect(lienBillDay(bill(null))).toBe('')
    expect(lienBillDay(bill('not a day'))).toBe('')
  })
})

describe('the months come from the sent, unpaid bills', () => {
  it('a paid bill and a bill not yet sent give no month', () => {
    const got = lienBillMonths([bill('2026-06-10T15:00:00Z', null, 'paid'), bill('2026-07-02T15:00:00Z', null, 'ready_to_bill'), bill('2026-09-23T20:10:00Z')])
    expect(got).toEqual({ months: ['2026-09'], lastMonth: '2026-09', lastDay: '2026-09-23' })
  })

  it('each month once, oldest first, and the latest is the last month', () => {
    const got = lienBillMonths([bill('2026-09-23T20:10:00Z'), bill('2026-07-01T20:19:00Z'), bill('2026-09-01T20:19:00Z')])
    expect(got.months).toEqual(['2026-07', '2026-09'])
    expect(got.lastMonth).toBe('2026-09')
    expect(got.lastDay).toBe('2026-09-23')
  })

  it('nothing in, nothing out', () => {
    expect(lienBillMonths(null)).toEqual({ months: [], lastMonth: '', lastDay: '' })
    expect(lienBillMonths([bill(null)])).toEqual({ months: [], lastMonth: '', lastDay: '' })
  })
})

describe('the stand-in month of a job nobody clocked on', () => {
  it('a job typed in after its work takes the bill’s month, not the month it was made', () => {
    // Made in August (the import), its bill marked sent through the earlier system in July.
    const got = lienStandInMonth({ createdAt: '2026-08-18T05:59:40Z', bills: [bill('2026-08-18T06:01:00Z', '2026-07-24T17:00:00Z')] })
    expect(got).toEqual({ day: '2026-07-24', month: '2026-07', months: ['2026-07'], source: 'bill' })
  })

  it('a job made early and billed later takes the bill’s month too', () => {
    const got = lienStandInMonth({ createdAt: '2026-02-26T17:55:00Z', bills: [bill('2026-08-24T17:00:00Z', '2026-09-04T14:19:00Z')] })
    expect(got.month).toBe('2026-08')
    expect(got.source).toBe('bill')
  })

  it('a job with no dated unpaid bill keeps its creation month, so it never falls out of the readers', () => {
    const made = '2026-08-18T05:59:40Z'
    expect(lienStandInMonth({ createdAt: made, bills: [] })).toEqual({ day: '2026-08-18', month: '2026-08', months: ['2026-08'], source: 'job_created' })
    expect(lienStandInMonth({ createdAt: made, bills: [bill('2026-06-01T15:00:00Z', null, 'paid')] }).source).toBe('job_created')
    expect(lienStandInMonth({ createdAt: made, bills: [bill(null)] }).source).toBe('job_created')
  })

  it('neither a bill nor a creation day is no month at all', () => {
    expect(lienStandInMonth({})).toEqual({ day: '', month: '', months: [], source: null })
  })
})

describe('the words say where the month came from', () => {
  it('one short wording per source, and one plain line', () => {
    expect(DATED_FROM_BILL_WORDS).toBe('dated from the bill · no clock hours')
    expect(lienStandInWords(true)).toBe(DATED_FROM_BILL_WORDS)
    expect(lienStandInWords(false)).toBe(DATED_FROM_CREATION_WORDS)
    expect(lienStandInLine('bill')).toBe(MONTH_FROM_BILL_LINE)
    expect(lienStandInLine('job_created')).toBe(MONTH_FROM_CREATION_LINE)
    expect(lienStandInLine(null)).toBe('')
    expect(MONTH_FROM_BILL_LINE).toBe('The month comes from the bill, not from recorded work.')
  })
})
