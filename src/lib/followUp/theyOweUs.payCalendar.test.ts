/**
 * They owe us for a payer on a Pay calendar (punch list #323, v2.7140): a bill of theirs is late the day after the
 * calendar's due day, not once the payer's pace has run out. A payer with no calendar reads exactly as before.
 */
import { describe, expect, it } from 'vitest'
import type { PaySpeedData } from '../jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from '../jobs/payCalendar'
import { billDueDay, theyOweUs, theyOweUsCount, type BillInvoiceRow, type BillJobRow, type TheyOweContact, type TheyOweUsBills } from './theyOweUs'

const LARK_BILL = '11111111-1111-4111-8111-111111111312'
const DANA_BILL = '22222222-2222-4222-8222-222222221288'

const speeds: PaySpeedData = { company: { medianDays: 14, samples: 40 }, customers: {}, segments: { residential: null, commercial: null }, customerTypes: {}, receipts: {}, quality: null }

const job = (over: Partial<BillJobRow> & Pick<BillJobRow, 'id'>): BillJobRow => ({
  status: 'billed',
  job_name: '',
  hcp_number: '',
  click_number: '',
  revenue: 0,
  payments_made: 0,
  collections_at: null,
  uncollectible_at: null,
  billing_only: false,
  customer_id: null,
  gc_customer_id: null,
  bill_to_party: 'customer',
  last_bill_date: null,
  ...over,
})

const bill = (over: Partial<BillInvoiceRow> & Pick<BillInvoiceRow, 'id' | 'job_id'>): BillInvoiceRow => ({
  status: 'billed',
  amount: 0,
  sequence_order: 1,
  billed_at: null,
  estimated_bill_date: null,
  bill_to_party: null,
  bill_to_email: null,
  stripe_invoice_id: null,
  ...over,
})

const person = (id: string, name: string, customerId: string): TheyOweContact => ({ id, kind: 'customer', name, goesBy: null, record: { table: 'customers', id: customerId }, customerId })
const CONTACTS = [person('lark', 'Larkfield Construction', 'c-lark'), person('dana', 'Dana Whitfield', 'c-dana')]

/** Paid the 10th of the month after a bill is in. */
const calRow = (payer: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: payer, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
const LARK_CALENDAR = indexPayCalendars([calRow('c-lark')])

/** Larkfield's bill and Dana's, both billed Tue Oct 6: due Oct 20 at the company's 14 days. */
function demo(over: Partial<TheyOweUsBills> = {}): TheyOweUsBills {
  return {
    jobs: [job({ id: 'j-lark', job_name: 'Lot 4', hcp_number: '1312', revenue: 9000, customer_id: 'c-lark' }), job({ id: 'j-dana', job_name: 'Oakridge sewer line', hcp_number: '1288', revenue: 640, customer_id: 'c-dana' })],
    invoices: [bill({ id: LARK_BILL, job_id: 'j-lark', amount: 9000, billed_at: '2026-10-06T15:00:00Z' }), bill({ id: DANA_BILL, job_id: 'j-dana', amount: 640, billed_at: '2026-10-06T15:00:00Z' })],
    payments: [],
    sends: [],
    paySpeeds: speeds,
    promises: null,
    ...over,
  }
}

const at = (ymd: string) => new Date(`${ymd}T17:00:00Z`)
const rowsOn = (ymd: string, over: Partial<TheyOweUsBills> = {}) => Object.fromEntries(theyOweUs(demo(over), CONTACTS, at(ymd)).map((r) => [r.contactId, r]))

describe('They owe us for a payer on a Pay calendar', () => {
  it('is not late on the due day, three weeks after the pace ran out', () => {
    const rows = rowsOn('2026-11-10', { payCalendars: LARK_CALENDAR })
    expect(rows.lark).toMatchObject({ dueYmd: '2026-11-10', late: false, daysLate: 0, daysBilled: 35 })
    // Dana has no calendar: late since Oct 20.
    expect(rows.dana).toMatchObject({ dueYmd: '2026-10-20', late: true, daysLate: 21 })
    expect(theyOweUsCount(Object.values(rows))).toBe(1)
  })

  it('is late the day after the due day', () => {
    const rows = rowsOn('2026-11-11', { payCalendars: LARK_CALENDAR })
    expect(rows.lark).toMatchObject({ dueYmd: '2026-11-10', late: true, daysLate: 1 })
    expect(theyOweUsCount(Object.values(rows))).toBe(2)
  })

  it('leaves a payer with no calendar exactly as before', () => {
    for (const today of ['2026-10-19', '2026-10-21', '2026-11-11']) {
      const before = rowsOn(today)
      expect(rowsOn(today, { payCalendars: null, acceptedByInvoice: null })).toEqual(before)
      expect(rowsOn(today, { payCalendars: indexPayCalendars([]) })).toEqual(before)
      expect(rowsOn(today, { payCalendars: LARK_CALENDAR, acceptedByInvoice: new Map([[DANA_BILL, '2026-11-02']]) }).dana).toEqual(before.dana)
    }
    // With no calendar Larkfield is late by the pace, as Dana is.
    expect(rowsOn('2026-10-21').lark).toMatchObject({ dueYmd: '2026-10-20', late: true, daysLate: 1 })
  })

  it('counts from the day they accepted the bill, and a promise still wins', () => {
    // Accepted Nov 2: in for the November cutoff, due Dec 10.
    expect(rowsOn('2026-11-11', { payCalendars: LARK_CALENDAR, acceptedByInvoice: new Map([[LARK_BILL, '2026-11-02']]) }).lark).toMatchObject({ dueYmd: '2026-12-10', late: false })
    expect(rowsOn('2026-11-11', { payCalendars: LARK_CALENDAR, promises: { 'j-lark': { promisedYmd: '2026-11-05', markedByName: 'Rosa' } } }).lark).toMatchObject({ dueYmd: '2026-11-05', late: true, daysLate: 6 })
  })

  it('reads the pace on a job whose own row switches the calendar off', () => {
    const off = indexPayCalendars([calRow('c-lark'), calRow('c-lark', { jobId: 'j-lark', off: true, calendar: null })])
    expect(rowsOn('2026-11-10', { payCalendars: off }).lark).toMatchObject({ dueYmd: '2026-10-20', late: true })
  })
})

describe('billDueDay with a Pay calendar', () => {
  const j = { customer_id: 'c-lark', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Larkfield Construction' }
  const inv = { billed_at: '2026-10-06T15:00:00Z', estimated_bill_date: null, bill_to_party: null, bill_to_email: null }

  it('carries the contract day beside the expected day, and is the pace guess with none', () => {
    expect(billDueDay(j, inv, speeds, null, '2026-11-10', { calendar: PAY_CALENDAR_DEFAULT })).toMatchObject({ source: 'terms', dueYmd: '2026-11-10', daysPastDue: 0 })
    expect(billDueDay(j, inv, speeds, null, '2026-11-10')).toMatchObject({ source: 'company', expectedYmd: '2026-10-20', dueYmd: null })
    expect(billDueDay(j, inv, speeds, null, '2026-11-10', { calendar: null, acceptedYmd: '2026-11-02' })).toMatchObject({ source: 'company', expectedYmd: '2026-10-20', dueYmd: null })
  })

  it('needs no pay speeds to read a calendar', () => {
    expect(billDueDay(j, inv, null, null, '2026-11-12', { calendar: PAY_CALENDAR_DEFAULT })).toMatchObject({ source: 'terms', dueYmd: '2026-11-10', daysPastDue: 2 })
    expect(billDueDay(j, inv, null, null, '2026-11-12')).toBeNull()
  })
})
