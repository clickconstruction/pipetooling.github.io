/**
 * The residential flow's Paid round for a payer on a Pay calendar (punch list #323, v2.7140): the round is due on the
 * calendar's due day, the day a reminder may go, not the day the payer's pace says. With no calendar the pace stands.
 */
import { describe, expect, it } from 'vitest'
import type { PaySpeedData } from '../jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from '../jobs/payCalendar'
import type { ContactRow } from './load'
import { paidRounds, type PipelineInvoiceRow, type PipelineJobRow, type ResidentialRows } from './residentialLoad'
import { NO_PIPELINE_ROWS, PIPELINE_SELECTS, residentialRowsOf, type PipelineRows } from './residentialRows'

const NOW = new Date('2026-10-12T17:00:00Z')
const DANA: ContactRow = { id: 'c-dana', kind: 'customer', off_since: null, off_why: null, off_by: null }

const PAY_SPEEDS: PaySpeedData = {
  company: { medianDays: 21, samples: 40 },
  customers: { 'cust-dana': { medianDays: 9, samples: 2 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}

const JOB: PipelineJobRow = { id: 'job-1312', created_at: '2026-10-03T13:00:00Z', status: 'billed', revenue: 1850, customer_id: 'cust-dana', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Dana Whitfield' }
/** Billed Fri Oct 9: due Oct 18 at her own 9 days. */
const BILL: PipelineInvoiceRow = {
  id: 'inv-1312',
  job_id: 'job-1312',
  status: 'billed',
  amount: 1850,
  sequence_order: 1,
  billed_at: '2026-10-09T15:00:00Z',
  sent_to_customer_at: null,
  estimated_bill_date: null,
  created_at: '2026-10-08T22:00:00Z',
  sent_by_user_id: 'u-rosa',
  bill_to_party: null,
  bill_to_email: null,
}

const rows = (over: Partial<ResidentialRows> = {}): ResidentialRows => ({ contact: DANA, firstName: 'Dana', jobs: [JOB], invoices: [BILL], payments: [], paySpeeds: PAY_SPEEDS, ...over })

/** Paid the 10th of the month after a bill is in. */
const calRow = (payer: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: payer, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
const dues = (r: ResidentialRows, now = NOW) => paidRounds(r, 'job-1312', now).map((x) => x.due)

describe('a Paid round for a payer on a Pay calendar', () => {
  it('is due on the calendar’s due day, not the day the pace says', () => {
    expect(dues(rows())).toEqual(['2026-10-18'])
    expect(dues(rows({ payCalendars: indexPayCalendars([calRow('cust-dana')]) }))).toEqual(['2026-11-10'])
    // The day does not move once it has passed: the round reads late from the day after it.
    expect(dues(rows({ payCalendars: indexPayCalendars([calRow('cust-dana')]) }), new Date('2026-11-20T17:00:00Z'))).toEqual(['2026-11-10'])
  })

  it('leaves a payer with no calendar exactly as before', () => {
    const before = paidRounds(rows(), 'job-1312', NOW)
    expect(paidRounds(rows({ payCalendars: null, acceptedByInvoice: null }), 'job-1312', NOW)).toEqual(before)
    expect(paidRounds(rows({ payCalendars: indexPayCalendars([]) }), 'job-1312', NOW)).toEqual(before)
    // Another payer's calendar, and an accepted day with no calendar to count from it.
    expect(paidRounds(rows({ payCalendars: indexPayCalendars([calRow('cust-evan')]), acceptedByInvoice: new Map([['inv-1312', '2026-11-02']]) }), 'job-1312', NOW)).toEqual(before)
  })

  it('reads the GC’s calendar on a bill the GC pays', () => {
    const gcJob = { ...JOB, gc_customer_id: 'cust-gc', bill_to_party: 'gc' }
    expect(dues(rows({ jobs: [gcJob], payCalendars: indexPayCalendars([calRow('cust-gc')]) }))).toEqual(['2026-11-10'])
    expect(dues(rows({ jobs: [gcJob], payCalendars: indexPayCalendars([calRow('cust-dana')]) }))).toEqual(['2026-10-30'])
  })

  it('counts from the day they accepted the bill, honours a job’s off switch, and lets a promise win', () => {
    const cal = indexPayCalendars([calRow('cust-dana')])
    expect(dues(rows({ payCalendars: cal, acceptedByInvoice: new Map([['inv-1312', '2026-11-02']]) }))).toEqual(['2026-12-10'])
    expect(dues(rows({ payCalendars: indexPayCalendars([calRow('cust-dana'), calRow('cust-dana', { jobId: 'job-1312', off: true, calendar: null })]) }))).toEqual(['2026-10-18'])
    expect(dues(rows({ payCalendars: cal, promisedPay: { 'job-1312': { promisedYmd: '2026-10-15', markedByName: 'Rosa' } } }))).toEqual(['2026-10-15'])
  })

  it('needs no pay speeds to read a calendar', () => {
    expect(dues(rows({ paySpeeds: null }))).toEqual([null])
    expect(dues(rows({ paySpeeds: null, payCalendars: indexPayCalendars([calRow('cust-dana')]) }))).toEqual(['2026-11-10'])
  })
})

describe('residentialRowsOf carries the calendars to the loader', () => {
  const READ: PipelineRows = {
    ...NO_PIPELINE_ROWS,
    jobs: [{ ...JOB, job_name: 'the water heater' }],
    invoices: [BILL],
    paySpeeds: PAY_SPEEDS,
  }
  const who = { contact: DANA, firstName: 'Dana', customerId: 'cust-dana' }

  it('indexes the calendars and keys the accepted days by the bill', () => {
    const dana = residentialRowsOf({ ...READ, payCalendars: [calRow('cust-dana')], acceptedDays: { 'inv-1312': '2026-11-02T00:00:00' } }, who)
    expect(dana.payCalendars?.byPayer.get('cust-dana')?.calendar).toEqual(PAY_CALENDAR_DEFAULT)
    expect([...(dana.acceptedByInvoice ?? [])]).toEqual([['inv-1312', '2026-11-02']])
    expect(dues(dana)).toEqual(['2026-12-10'])
  })

  it('reads the pace when neither was read, as a reader from before them does', () => {
    for (const read of [READ, { ...READ, payCalendars: null, acceptedDays: null }, { ...READ, payCalendars: [], acceptedDays: {} }]) {
      const dana = residentialRowsOf(read, who)
      expect(dana.payCalendars).toBeNull()
      expect(dana.acceptedByInvoice).toBeNull()
      expect(dues(dana)).toEqual(['2026-10-18'])
    }
  })

  it('names the columns the morning run selects', () => {
    expect(PIPELINE_SELECTS.payCalendars).toBe('payer_customer_id, job_id, off, cutoff_day, pay_day, months_after, pay_when_paid, clause, words, set_at')
    expect(PIPELINE_SELECTS.acceptedDays).toBe('invoice_id, accepted_on')
  })
})
