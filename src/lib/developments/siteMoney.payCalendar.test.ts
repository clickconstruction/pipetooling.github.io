/**
 * The Development page's Money look for a payer on a Pay calendar (punch list #323, v2.7140): a billed job is past
 * due the day after its calendar's due day and not before, whatever the payer's pace says. A payer with no calendar
 * reads exactly as before.
 */
import { describe, expect, it } from 'vitest'
import type { PayReceipt, PaySpeedData } from '../jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from '../jobs/payCalendar'
import type { MemberJob } from './overview'
import { buildSiteMoney, moneyLookWords, moneyPastDays, sortMoneyRows, type SiteMoneyInputs } from './siteMoney'

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'harlow', bid_id: null, status: 'billed', revenue: 10_000, payments_made: 0, last_work_date: null, last_bill_date: null,
    job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over,
  }
}

const receipt = (billedYmd: string, paidYmd: string): PayReceipt => ({ billedYmd, paidYmd, gapDays: 0, jobId: null, jobName: null, address: null })

/** Larkfield and Sable each pay in about 20 days by their median. Larkfield's last three payments each landed 6 days after its pay day. */
const paySpeed: PaySpeedData = {
  company: { medianDays: 14, samples: 100 },
  customers: { lark: { medianDays: 20, samples: 6 }, sable: { medianDays: 20, samples: 6 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: { lark: [receipt('2026-07-10', '2026-08-16'), receipt('2026-08-06', '2026-09-16'), receipt('2026-09-03', '2026-10-16')] },
  quality: null,
}

/** Paid the 10th of the month after a bill is in. */
const calRow = (payer: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: payer, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
const LARK_CALENDAR = indexPayCalendars([calRow('lark')])

const bill = (id: string, jobId: string, billedAt: string) => ({ id, job_id: jobId, amount: 10_000, status: 'billed', billed_at: billedAt, sent_to_customer_at: null })

/** One Larkfield job billed Oct 6 and one Sable job billed the same day. */
function inputs(todayYmd: string, over: Partial<SiteMoneyInputs> = {}): SiteMoneyInputs {
  return {
    members: {
      bids: [],
      jobs: [job({ id: 'L1', gc_customer_id: 'lark', customer_name: 'Larkfield Construction' }), job({ id: 'S1', customer_id: 'sable', customer_name: 'Sable Homes' })],
    },
    invoices: [bill('inv-L1', 'L1', '2026-10-06T17:00:00Z'), bill('inv-S1', 'S1', '2026-10-06T17:00:00Z')],
    names: new Map(),
    teamMembers: [],
    jobLabel: (j) => j.click_number ?? j.id,
    paySpeed,
    todayYmd,
    ...over,
  }
}

const rowsOf = (inp: SiteMoneyInputs) => Object.fromEntries(buildSiteMoney(inp).sections.flatMap((s) => s.rows).map((r) => [r.number, r]))

describe('the Money look for a payer on a Pay calendar', () => {
  it('is not past due on the due day, though the pace guess passed two weeks ago', () => {
    const by = rowsOf(inputs('2026-11-10', { payCalendars: LARK_CALENDAR }))
    expect(by.L1!.dates!.due).toEqual({ ymd: '2026-11-10', daysPast: 0, daysTo: 0, basis: 'pay calendar · lands ~6d after the pay day' })
    expect(by.L1!.next.askForDate).toBe(false)
    // With no calendar the same bill was 15 days past its expected day.
    const before = rowsOf(inputs('2026-11-10'))
    expect(before.L1!.dates).toMatchObject({ due: null, expected: { source: 'customer', expectedYmd: '2026-10-26', state: 'late', daysLate: 15 } })
    expect(before.L1!.next.askForDate).toBe(true)
  })

  it('is past due the day after the due day, before the money is even expected', () => {
    const model = buildSiteMoney(inputs('2026-11-11', { payCalendars: LARK_CALENDAR }))
    const lark = model.sections.flatMap((s) => s.rows).find((r) => r.number === 'L1')!
    expect(lark.dates!.due).toMatchObject({ ymd: '2026-11-10', daysPast: 1, daysTo: 0 })
    // Their money usually lands Nov 16, so the model itself still reads upcoming. The count goes by the due day.
    expect(lark.dates!.expected).toMatchObject({ source: 'terms', expectedYmd: '2026-11-16', state: 'upcoming' })
    expect(lark.next.askForDate).toBe(true)
    expect(moneyPastDays(lark.dates)).toBe(1)
    // Sable has no calendar and has been past its pace since Oct 26: both count.
    expect(model.band.pastDue).toBe(2)
    expect(moneyLookWords(model, (n) => `$${n}`).need).toBe('2 bills past due')
  })

  it('counts down to the due day while it is ahead', () => {
    expect(rowsOf(inputs('2026-10-20', { payCalendars: LARK_CALENDAR })).L1!.dates!.due).toMatchObject({ ymd: '2026-11-10', daysPast: 0, daysTo: 21 })
  })

  it('leaves a payer with no calendar exactly as before', () => {
    for (const today of ['2026-10-20', '2026-11-10', '2026-11-11']) {
      const before = rowsOf(inputs(today))
      const after = rowsOf(inputs(today, { payCalendars: LARK_CALENDAR, acceptedByInvoice: new Map([['inv-S1', '2026-11-02']]) }))
      expect(after.S1).toEqual(before.S1)
      // No calendars read at all, or an empty index: every row as before.
      expect(rowsOf(inputs(today, { payCalendars: null }))).toEqual(before)
      expect(rowsOf(inputs(today, { payCalendars: indexPayCalendars([]) }))).toEqual(before)
    }
  })

  it('counts from the day they accepted the bill, when one is recorded', () => {
    // In Oct 28, accepted Nov 2: a month later under the contract.
    const inp = inputs('2026-11-11', { payCalendars: LARK_CALENDAR, invoices: [bill('inv-L1', 'L1', '2026-10-28T17:00:00Z')], acceptedByInvoice: new Map([['inv-L1', '2026-11-02']]) })
    expect(rowsOf(inp).L1!.dates!.due).toMatchObject({ ymd: '2026-12-10', daysPast: 0, daysTo: 29 })
    expect(rowsOf({ ...inp, acceptedByInvoice: null }).L1!.dates!.due).toMatchObject({ ymd: '2026-11-10', daysPast: 1 })
  })

  it('reads the pace for a job whose own row switches the calendar off', () => {
    const off = indexPayCalendars([calRow('lark'), calRow('lark', { jobId: 'L1', off: true, calendar: null })])
    const row = rowsOf(inputs('2026-11-10', { payCalendars: off })).L1!
    expect(row.dates).toMatchObject({ due: null, expected: { source: 'customer', state: 'late', daysLate: 15 } })
  })

  it('orders tightest by the days past the due day', () => {
    const inp = inputs('2026-11-15', { payCalendars: LARK_CALENDAR })
    // Larkfield is 5 days past its due day, Sable 20 past its expected day: Sable leads.
    const billed = buildSiteMoney(inp).sections.find((s) => s.key === 'billed')!
    expect(sortMoneyRows(billed.rows, 'tightest', 'billed').map((r) => [r.number, moneyPastDays(r.dates)])).toEqual([['S1', 20], ['L1', 5]])
  })
})
