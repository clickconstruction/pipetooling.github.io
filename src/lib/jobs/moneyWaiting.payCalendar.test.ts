/**
 * Money waiting for a payer on a Pay calendar (punch list #323, v2.7127): each bill is read against
 * its expected day, the due day plus how late that payer usually runs, and not against a count of days.
 */
import { describe, expect, it } from 'vitest'
import { buildMoneyWaiting, moneyWaitingBasis, moneyWaitingLead, openBillsForCustomers } from './moneyWaiting'
import { buildPaySpeedsPayerFocus } from './paySpeedsPayerFocus'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from './payCalendar'
import type { PayReceipt, PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const TODAY = '2026-11-22'

const receipt = (billedYmd: string, paidYmd: string): PayReceipt => ({ billedYmd, paidYmd, gapDays: 0, jobId: null, jobName: null, address: null })

/** Larkfield pays the 10th of the month after a bill is in, and its last three payments each landed 6 days after that. */
const LARK_RECEIPTS = [receipt('2026-07-10', '2026-08-16'), receipt('2026-08-06', '2026-09-16'), receipt('2026-09-03', '2026-10-16')]

function speeds(): PaySpeedData {
  return {
    company: { medianDays: 6, samples: 150 },
    customers: { lark: { medianDays: 41, samples: 3 }, sable: { medianDays: 20, samples: 4 } },
    segments: { residential: null, commercial: null },
    customerTypes: { lark: 'commercial', sable: 'commercial' },
    receipts: { lark: LARK_RECEIPTS },
    quality: null,
  }
}

const calRow = (payer: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: payer, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })

/** One open bill: `amount` open, billed `billedYmd`, on the job named. */
function bill(customerId: string, name: string, amount: number, billedYmd: string, jobName: string): StageRow {
  const job = { id: `j-${jobName}`, customer_id: customerId, customer_name: name, job_name: jobName, job_address: '12 Larkfield Way', payments: [], invoices: [] } as unknown as JobWithDetails
  return { kind: 'invoice', job, inv: { id: `inv-${jobName}`, job_id: job.id, amount, status: 'billed', sequence_order: 1, billed_at: `${billedYmd}T18:00:00Z` } } as unknown as StageRow
}

const LARK_ROWS = [
  bill('lark', 'Larkfield Construction', 9000, '2026-09-28', 'Lot 4'), // due Oct 10, expected Oct 16
  bill('lark', 'Larkfield Construction', 4000, '2026-10-05', 'Lot 5'), // due Nov 10, expected Nov 16
  bill('lark', 'Larkfield Construction', 2500, '2026-11-03', 'Lot 6'), // due Dec 10
]

describe('Money waiting for a payer on a Pay calendar', () => {
  it('reads each bill against its expected day: a missed run is red, past expected is amber, not yet due is fine', () => {
    const m = buildMoneyWaiting(LARK_ROWS, speeds(), TODAY, { payCalendars: indexPayCalendars([calRow('lark')]) })!
    expect(m.rows).toHaveLength(1)
    const row = m.rows[0]!
    expect(row.bills.map((b) => [b.jobName, b.tone, b.calendar?.dueYmd, b.calendar?.daysPastExpected])).toEqual([
      ['Lot 4', 'late', '2026-10-10', 37],
      ['Lot 5', 'warn', '2026-11-10', 6],
      ['Lot 6', 'ok', '2026-12-10', 0],
    ])
    expect(row.worstTone).toBe('late')
    expect(row.pastExpectedDays).toBe(37)
    expect(row.lateness?.medianDays).toBe(6)
    expect(moneyWaitingLead(row)).toBe('37d past expected')
    expect(moneyWaitingBasis(row, m.companyMedianDays)).toBe('pay calendar · lands ~6d after the pay day')
  })

  it('reads the same bills by their wait when no calendar is passed, as before', () => {
    const m = buildMoneyWaiting(LARK_ROWS, speeds(), TODAY)!
    const row = m.rows[0]!
    expect(row.bills.map((b) => [b.jobName, b.tone, b.waitDays])).toEqual([
      ['Lot 4', 'warn', 55],
      ['Lot 5', 'warn', 48],
      ['Lot 6', 'ok', 19],
    ])
    expect(row.calendar).toBeNull()
    expect(moneyWaitingLead(row)).toBe('55d waiting')
    expect(moneyWaitingBasis(row, m.companyMedianDays)).toBe('usually ~41d')
  })

  it('keeps a payer on pace whose bill has waited past their median but is not yet due', () => {
    // In by the 25th, paid the 30th of the next month: a bill in Oct 20 is due Nov 30, eight days ahead.
    const rows = [bill('sable', 'Sable Ridge Builders', 7000, '2026-10-20', 'Unit 2')]
    const calendars = { payCalendars: indexPayCalendars([calRow('sable', { calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 25, payDay: 30 } })]) }
    expect(buildMoneyWaiting(rows, speeds(), TODAY)!.rows.map((r) => r.name)).toEqual(['Sable Ridge Builders'])
    const m = buildMoneyWaiting(rows, speeds(), TODAY, calendars)!
    expect(m.rows).toEqual([])
    expect(m.onPaceCount).toBe(1)
    expect(m.onPaceOpen).toBe(7000)
  })

  it('counts from the day they accepted the bill when the office recorded one', () => {
    // Lot 5 went in Oct 5 and was accepted Nov 2: due Dec 10, no longer past anything.
    const calendars = { payCalendars: indexPayCalendars([calRow('lark')]), acceptedByInvoice: new Map([['inv-Lot 5', '2026-11-02']]) }
    const lot5 = buildMoneyWaiting(LARK_ROWS, speeds(), TODAY, calendars)!.rows[0]!.bills.find((b) => b.jobName === 'Lot 5')!
    expect(lot5.calendar?.dueYmd).toBe('2026-12-10')
    expect(lot5.tone).toBe('ok')
  })

  it('reads a job with no pay calendar by its wait, beside the payer’s other bills', () => {
    const calendars = { payCalendars: indexPayCalendars([calRow('lark'), calRow('lark', { jobId: 'j-Lot 6', off: true, calendar: null })]) }
    const bills = buildMoneyWaiting(LARK_ROWS, speeds(), TODAY, calendars)!.rows[0]!.bills
    expect(bills.find((b) => b.jobName === 'Lot 6')).toMatchObject({ calendar: null, tone: 'ok', waitDays: 19 })
    expect(bills.find((b) => b.jobName === 'Lot 4')?.tone).toBe('late')
  })

  it('says so when a calendar payer has no payment on record', () => {
    const data = { ...speeds(), receipts: {} }
    const m = buildMoneyWaiting(LARK_ROWS, data, TODAY, { payCalendars: indexPayCalendars([calRow('lark')]) })!
    const row = m.rows[0]!
    // With no record the expected day is the due day itself: Oct 10 and Nov 10.
    expect(row.pastExpectedDays).toBe(43)
    expect(moneyWaitingBasis(row, m.companyMedianDays)).toBe('pay calendar · no payment on record yet')
  })

  it('reads the calendar in the By customer bills and on the payer’s own card', () => {
    const calendars = { payCalendars: indexPayCalendars([calRow('lark')]) }
    const open = openBillsForCustomers(LARK_ROWS, speeds(), TODAY, calendars).get('lark')!
    expect(open.map((b) => b.tone)).toEqual(['late', 'warn', 'ok'])
    const focus = buildPaySpeedsPayerFocus({ id: 'lark', name: 'Larkfield Construction' }, LARK_ROWS, speeds(), TODAY, calendars)
    expect(focus.bills.map((b) => b.calendar?.dueYmd)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10'])
  })
})
