/**
 * Dashboard Accounts Receivable for a customer on a Pay calendar (punch list #323, v2.7127): the
 * rollup, the call opener and the call summary read each bill's due day, not its wait.
 */
import { describe, expect, it } from 'vitest'
import { buildArCustomerRollup } from './arCustomerRollup'
import { arCallOpener, buildArCallSummary } from './arCustomerChase'
import type { FinancialItem } from './dashboardFinancials'
import type { PayReceipt, PaySpeedData } from './jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from './jobs/payCalendar'

const TODAY = '2026-11-22'

const receipt = (billedYmd: string, paidYmd: string): PayReceipt => ({ billedYmd, paidYmd, gapDays: 0, jobId: null, jobName: null, address: null })

const speeds: PaySpeedData = {
  company: { medianDays: 6, samples: 150 },
  customers: { lark: { medianDays: 41, samples: 3 } },
  segments: { residential: null, commercial: null },
  customerTypes: { lark: 'commercial' },
  // Paid the 10th of the next month, each of the last three landing 6 days after it.
  receipts: { lark: [receipt('2026-07-10', '2026-08-16'), receipt('2026-08-06', '2026-09-16'), receipt('2026-09-03', '2026-10-16')] },
  quality: null,
}

const item = (key: string, label: string, amount: number, dateYmd: string, jobId: string): FinancialItem => ({ key, label, sublabel: 'Billed invoice', amount, dateYmd, jobId, address: null, customerId: 'lark', customerName: 'Larkfield Construction' })

const ITEMS = [item('a', '1441 · Lot 4', 9000, '2026-09-28', 'j1441'), item('b', '1442 · Lot 5', 4000, '2026-10-05', 'j1442'), item('c', '1443 · Lot 6', 2500, '2026-11-03', 'j1443')]

const calRow = (over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: 'lark', jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
const CALENDARS = indexPayCalendars([calRow()])

describe('the Dashboard’s receivables for a customer on a Pay calendar', () => {
  it('judges each bill by its expected day', () => {
    const row = buildArCustomerRollup(ITEMS, speeds, TODAY, CALENDARS).rows[0]!
    expect(row.bills.map((b) => [b.item.key, b.tone, b.calendar?.dueYmd])).toEqual([
      ['a', 'late', '2026-10-10'],
      ['b', 'warn', '2026-11-10'],
      ['c', 'ok', '2026-12-10'],
    ])
    expect(row).toMatchObject({ pastPace: true, worstTone: 'late', pastExpectedDays: 37 })
    expect(row.calendar).toEqual(PAY_CALENDAR_DEFAULT)
  })

  it('reads the same bills by their wait with no calendar, as before', () => {
    const rollup = buildArCustomerRollup(ITEMS, speeds, TODAY)
    const row = rollup.rows[0]!
    expect(row.bills.map((b) => b.tone)).toEqual(['warn', 'warn', 'ok'])
    expect(row).toMatchObject({ pastPace: true, worstTone: 'warn', calendar: null, pastExpectedDays: null })
    expect(rollup.pastPace).toEqual({ count: 1, open: 15500 })
  })

  it('files a customer under on pace when no bill is past its expected day, however long it has waited', () => {
    const rollup = buildArCustomerRollup([ITEMS[2]!, item('d', '1444 · Lot 7', 1000, '2026-10-31', 'j1444')], speeds, TODAY, CALENDARS)
    // Lot 7 went in Oct 31, the cutoff's last day, so it is due Nov 10: 12 days past due and 6 past expected.
    expect(rollup.rows[0]!.bills.map((b) => [b.item.key, b.tone])).toEqual([
      ['d', 'warn'],
      ['c', 'ok'],
    ])
    const onlyAhead = buildArCustomerRollup([ITEMS[2]!], speeds, TODAY, CALENDARS)
    expect(onlyAhead.rows[0]).toMatchObject({ pastPace: false, worstTone: 'ok', pastExpectedDays: null })
    expect(onlyAhead.onPace).toEqual({ count: 1, open: 2500 })
  })

  it('opens the call on the due day, not a count of days', () => {
    const row = buildArCustomerRollup(ITEMS, speeds, TODAY, CALENDARS).rows[0]!
    expect(arCallOpener(row)).toBe('2 bills past expected on their pay calendar — 1441 · Lot 4, $9,000, due Oct 10 · 37d past expected. $15,500 open on 3 bills.')
    const ahead = buildArCustomerRollup([ITEMS[2]!], speeds, TODAY, CALENDARS).rows[0]!
    expect(arCallOpener(ahead)).toBe('Nothing past its expected day on their pay calendar. $2,500 open on 1 bill.')
  })

  it('writes the calendar and each bill’s due day into the call summary', () => {
    const row = buildArCustomerRollup(ITEMS, speeds, TODAY, CALENDARS).rows[0]!
    const text = buildArCallSummary(row, null)
    expect(text).toContain('Pays on a calendar.')
    expect(text).not.toContain('Usually pays in')
    expect(text).toContain('• 1441 · Lot 4 — $9,000.00 (due Oct 10 · 37d past expected)')
    expect(text).toContain('• 1443 · Lot 6 — $2,500.00 (due Dec 10)')
  })
})
