/**
 * Billed Awaiting Payment for a payer on a Pay calendar (punch list #323, v2.7140): their bill is past due the day
 * after the calendar's due day, not 30 days after it was billed. A payer with no calendar reads exactly as before.
 */
import { describe, expect, it } from 'vitest'
import type { BilledBreakdownBill, BilledBreakdownCustomerGroup } from '../jobs/billedByCustomerBreakdown'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from '../jobs/payCalendar'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { leanBillKey, leanDueByBill, leanRows, leanSince, type LeanInput } from './leanRead'

/** Paid the 10th of the month after a bill is in. */
const calRow = (payer: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: payer, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })

/** One open bill on the board's lean spine. */
function stageRow(customerId: string, invoiceId: string, billedYmd: string, jobId = `j-${invoiceId}`): StageRow {
  const job = { id: jobId, customer_id: customerId, customer_name: customerId, job_name: jobId, payments: [], invoices: [] } as unknown as JobWithDetails
  return { kind: 'invoice', job, inv: { id: invoiceId, job_id: jobId, amount: 1000, status: 'billed', sequence_order: 1, billed_at: `${billedYmd}T18:00:00Z` } } as unknown as StageRow
}

const billOf = (invoiceId: string | null, ageDays: number | null, customerId: string | null, over: Partial<BilledBreakdownBill> = {}): BilledBreakdownBill => ({
  invoiceId,
  jobId: `j-${invoiceId ?? 'shell'}`,
  jobName: 'Job',
  jobNumber: '1',
  jobAddress: '',
  amount: 1000,
  settled: false,
  ageDays,
  ageHandSet: false,
  lineItems: [],
  customerId,
  customerEmail: null,
  stripeInvoiceId: null,
  stripePaid: false,
  sentAtIso: null,
  externalSendChannel: null,
  billToEmail: null,
  ...over,
})

function group(name: string, customerId: string, bills: BilledBreakdownBill[]): BilledBreakdownCustomerGroup {
  const ages = bills.map((b) => b.ageDays).filter((a): a is number => a != null)
  return { key: customerId, customerName: name, total: bills.reduce((s, b) => s + b.amount, 0), count: bills.length, worstAgeDays: ages.length ? Math.max(...ages) : null, worstAgeHandSet: false, bills }
}

const input = (todayYmd: string, groups: BilledBreakdownCustomerGroup[], dueByBill?: ReadonlyMap<string, string> | null): LeanInput => ({ groups, touches: [], promises: null, todayYmd, leanDays: 7, dueByBill })

describe('leanDueByBill', () => {
  const rows = [stageRow('lark', 'i-oct', '2026-10-06'), stageRow('lark', 'i-nov', '2026-11-03'), stageRow('sable', 'i-sable', '2026-10-06')]

  it('gives each bill of a calendar payer its due day, and no other bill one', () => {
    const due = leanDueByBill(rows, { payCalendars: indexPayCalendars([calRow('lark')]) })
    expect([...due]).toEqual([['i-oct', '2026-11-10'], ['i-nov', '2026-12-10']])
  })

  it('counts from the day they accepted the bill, and honours a job that switched its calendar off', () => {
    const accepted = leanDueByBill(rows, { payCalendars: indexPayCalendars([calRow('lark')]), acceptedByInvoice: new Map([['i-oct', '2026-11-02']]) })
    expect(accepted.get('i-oct')).toBe('2026-12-10')
    const off = leanDueByBill(rows, { payCalendars: indexPayCalendars([calRow('lark'), calRow('lark', { jobId: 'j-i-oct', off: true, calendar: null })]) })
    expect([...off.keys()]).toEqual(['i-nov'])
  })

  it('is empty with no calendars read', () => {
    expect(leanDueByBill(rows, null).size).toBe(0)
    expect(leanDueByBill(rows, { payCalendars: null, acceptedByInvoice: new Map() }).size).toBe(0)
    expect(leanDueByBill(rows, { payCalendars: indexPayCalendars([]) }).size).toBe(0)
  })

  it('keys a bill by its own id, and a job balance by nothing', () => {
    expect(leanBillKey({ invoiceId: 'i-oct' })).toBe('i-oct')
    expect(leanBillKey({ invoiceId: null })).toBeNull()
  })
})

describe('leanRows for a payer on a Pay calendar', () => {
  // Larkfield's bill went in Oct 6 and is due Nov 10. Sable has no calendar and was billed the same day.
  const groups = (today: string) => {
    const age = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse('2026-10-06T12:00:00Z')) / 86_400_000)
    return [group('Larkfield Construction', 'lark', [billOf('i-oct', age, 'lark')]), group('Sable Homes', 'sable', [billOf('i-sable', age, 'sable')])]
  }
  const DUE = new Map([['i-oct', '2026-11-10']])
  const byName = (today: string, due: ReadonlyMap<string, string> | null = DUE) => Object.fromEntries(leanRows(input(today, groups(today), due)).map((r) => [r.group.customerName, r]))

  it('is not past due on the due day, 35 days after the bill', () => {
    const rows = byName('2026-11-10')
    expect(rows['Larkfield Construction']).toMatchObject({ state: 'current', why: 'due Nov 10 · pay calendar', pastDueDays: 0 })
    // Sable, billed the same day with no calendar, has been past due since day 30.
    expect(rows['Sable Homes']).toMatchObject({ state: 'needs', why: 'never leaned on', pastDueDays: 6 })
  })

  it('is past due the day after the due day', () => {
    expect(byName('2026-11-11')['Larkfield Construction']).toMatchObject({ state: 'needs', why: 'never leaned on', pastDueDays: 1 })
  })

  it('is past due after its due day even when the bill is under 30 days old', () => {
    // In Oct 28, due Nov 10: 16 days old on Nov 13 and three days past due.
    const young = [group('Larkfield Construction', 'lark', [billOf('i-late', 16, 'lark')])]
    expect(leanRows(input('2026-11-13', young, new Map([['i-late', '2026-11-10']])))[0]).toMatchObject({ state: 'needs', pastDueDays: 3 })
    expect(leanRows(input('2026-11-13', young))[0]).toMatchObject({ state: 'current', why: '14 days until past due' })
  })

  it('reads a customer by their worst bill: one on a job with no calendar still ages by its days', () => {
    // Two Larkfield bills: one on the calendar and not yet due, one on a job whose row switched the calendar off, 40 days old.
    const mixed = [group('Larkfield Construction', 'lark', [billOf('i-oct', 35, 'lark'), billOf('i-off', 40, 'lark')])]
    expect(leanRows(input('2026-11-10', mixed, DUE))[0]).toMatchObject({ state: 'needs', pastDueDays: 11 })
  })

  it('leaves a payer with no calendar exactly as before', () => {
    for (const today of ['2026-10-20', '2026-11-04', '2026-11-05', '2026-11-10']) {
      const before = byName(today, null)
      expect(byName(today, new Map())).toEqual(before)
      expect(byName(today)['Sable Homes']).toEqual(before['Sable Homes'])
    }
    // Day 29 and day 30 of the flat rule.
    expect(byName('2026-11-04', null)['Sable Homes']).toMatchObject({ state: 'current', why: '1 days until past due', pastDueDays: 0 })
    expect(byName('2026-11-05', null)['Sable Homes']).toMatchObject({ state: 'needs', pastDueDays: 1 })
  })

  it('counts a calendar customer as new past due when their due day passed since the last look', () => {
    const since = (today: string, lookIso: string) => leanSince(leanRows(input(today, [groups(today)[0]!], DUE)), lookIso, today, (iso) => iso.slice(0, 10), () => 'then')
    // Looked on Nov 9, a day before the due day; today is Nov 12, two days past it.
    expect(since('2026-11-12', '2026-11-09T15:00:00Z')?.newPastDue).toBe(1)
    // Looked on Nov 11, when it was already past due: not new.
    expect(since('2026-11-12', '2026-11-11T15:00:00Z')?.newPastDue).toBe(0)
    // Not past due yet: nothing crossed.
    expect(since('2026-11-10', '2026-11-01T15:00:00Z')?.newPastDue).toBe(0)
  })
})
