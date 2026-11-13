/**
 * Dashboard AR modal "Customers" view-model (v2.2571, mockup Variant A):
 * the AR bucket's invoice items regrouped by the customer you'd call, with
 * lateness judged against that customer's own pay speed — the same baseline
 * rule as the Pipeline's Money waiting list (moneyWaiting.ts), sourced from
 * the modal's own FinancialItems so the view can never disagree with the
 * card total.
 *
 * A customer is "past pace" when their longest-waiting bill has waited past
 * their baseline (their own 12-mo median with enough samples, else the
 * company median). Without pay-speed data (RPC gated/failed) every row is
 * neutral: no pace split, tones grey, sorted by open dollars.
 *
 * A customer on a Pay calendar (punch list #323) is judged by each bill's expected day, the
 * due day plus how late they usually run, as the Money waiting list judges them. The modal's
 * items carry the job's customer and its own bill clock, so the calendar read here is that
 * customer's, counted from that clock; the day a payer accepted a bill is not read.
 */
import type { FinancialItem } from './dashboardFinancials'
import { billWaitTone, type OpenBillTone } from './jobs/moneyWaiting'
import { PAY_SPEED_MIN_SAMPLES, daysBetweenYmd, type CustomerSegment, type PaySpeedData } from './jobs/billedExpectedPay'
import { calendarBillRead, calendarFor, latenessAgainst, type CalendarBillRead, type PayCalendar, type PayCalendarIndex, type PayCalendarLateness } from './jobs/payCalendar'

export type ArCustomerBill = {
  item: FinancialItem
  /** Days since the modal's own bill clock (item.dateYmd); null = undated. */
  waitDays: number | null
  tone: OpenBillTone
  /** The bill against its customer's Pay calendar; null or absent when it has none, and the tone reads the wait. */
  calendar?: CalendarBillRead | null
}

export type ArCustomerRow = {
  /** Null = bills whose job carries no customer — grouped under one "No customer" row. */
  customerId: string | null
  name: string
  segment: CustomerSegment | null
  /** Their own 12-mo median; null = thin history or no pay-speed data. */
  ownMedianDays: number | null
  /** Own median or the company fallback; null when pay-speed data is missing entirely. */
  baselineDays: number | null
  oldestWaitDays: number | null
  open: number
  /** A bill is past its yardstick: the wait past the baseline, or on a Pay calendar its expected day gone by. */
  pastPace: boolean
  /** The worst tone among the bills: what colours the row's wait. */
  worstTone: OpenBillTone
  /** The customer's Pay calendar; null when they have none. */
  calendar: PayCalendar | null
  /** Their record against that calendar; null with no calendar or nothing measured. */
  lateness: PayCalendarLateness | null
  /** The most days any bill is past its expected day; null when none is, or with no calendar. */
  pastExpectedDays: number | null
  /** Longest wait first, undated last; amount breaks ties. */
  bills: ArCustomerBill[]
}

export type ArCustomerRollup = {
  rows: ArCustomerRow[]
  pastPace: { count: number; open: number }
  onPace: { count: number; open: number }
  customerCount: number
  billCount: number
  /** False when pay-speed data was unavailable — the view hides the pace lens. */
  hasPace: boolean
}

export type ArCustomerSort = 'slowest' | 'biggest'

export function buildArCustomerRollup(
  items: FinancialItem[],
  paySpeeds: PaySpeedData | null,
  todayYmd: string,
  payCalendars?: PayCalendarIndex | null,
): ArCustomerRollup {
  const company = paySpeeds?.company ?? null
  type Acc = { name: string; open: number; bills: Array<Omit<ArCustomerBill, 'tone'>> }
  const byCustomer = new Map<string | null, Acc>()
  for (const item of items) {
    const customerId = item.customerId ?? null
    const rawWait = item.dateYmd ? daysBetweenYmd(item.dateYmd, todayYmd) : null
    const waitDays = rawWait != null && rawWait >= 0 ? rawWait : null
    const acc = byCustomer.get(customerId) ?? {
      name: customerId ? (item.customerName ?? '').trim() || '—' : 'No customer on the job',
      open: 0,
      bills: [],
    }
    acc.open += item.amount
    const cal = customerId ? calendarFor(payCalendars, { payerId: customerId, jobId: item.jobId }) : null
    acc.bills.push({ item, waitDays, calendar: cal && customerId ? calendarBillRead(item.dateYmd, cal, latenessAgainst(paySpeeds?.receipts[customerId], cal), todayYmd) : null })
    byCustomer.set(customerId, acc)
  }

  const rows: ArCustomerRow[] = []
  const pastPace = { count: 0, open: 0 }
  const onPace = { count: 0, open: 0 }
  let billCount = 0
  for (const [customerId, acc] of byCustomer) {
    const own = customerId && paySpeeds ? paySpeeds.customers[customerId] : undefined
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company?.medianDays ?? null
    const oldestWaitDays = acc.bills.reduce<number | null>(
      (max, b) => (b.waitDays != null && (max == null || b.waitDays > max) ? b.waitDays : max),
      null,
    )
    const bills: ArCustomerBill[] = acc.bills
      .map((b) => ({
        ...b,
        tone: b.calendar ? b.calendar.tone : baselineDays != null ? billWaitTone(b.waitDays, baselineDays) : ('undated' as OpenBillTone),
      }))
      .sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.item.amount - a.item.amount)
    // Past pace is one bill past its yardstick. For waits that is the oldest past the baseline, as it always was.
    const isPastPace = bills.some((b) => b.tone === 'warn' || b.tone === 'late')
    const calendar = customerId ? calendarFor(payCalendars, { payerId: customerId }) : null
    const pastExpected = bills.reduce((max, b) => Math.max(max, b.calendar?.daysPastExpected ?? 0), 0)
    billCount += bills.length
    if (isPastPace) {
      pastPace.count++
      pastPace.open += acc.open
    } else {
      onPace.count++
      onPace.open += acc.open
    }
    rows.push({
      customerId,
      name: acc.name,
      segment: customerId ? paySpeeds?.customerTypes[customerId] ?? null : null,
      ownMedianDays: hasOwn ? own.medianDays : null,
      baselineDays,
      oldestWaitDays,
      open: acc.open,
      pastPace: isPastPace,
      bills,
      worstTone: bills.some((b) => b.tone === 'late') ? 'late' : isPastPace ? 'warn' : oldestWaitDays != null && (baselineDays != null || calendar) ? 'ok' : 'undated',
      calendar,
      lateness: calendar && customerId ? latenessAgainst(paySpeeds?.receipts[customerId], calendar) : null,
      pastExpectedDays: calendar && pastExpected > 0 ? pastExpected : null,
    })
  }

  return {
    rows,
    pastPace,
    onPace,
    customerCount: rows.length,
    billCount,
    hasPace: company != null,
  }
}

/**
 * 'slowest' (default): past-pace customers first by oldest wait, on-pace after
 * by open dollars — the call order. 'biggest': open dollars, pace ignored.
 */
export function sortArCustomerRows(rows: ArCustomerRow[], sort: ArCustomerSort): ArCustomerRow[] {
  const sorted = [...rows]
  if (sort === 'biggest') {
    sorted.sort((a, b) => b.open - a.open)
    return sorted
  }
  sorted.sort((a, b) => {
    if (a.pastPace !== b.pastPace) return a.pastPace ? -1 : 1
    if (a.pastPace) return (b.oldestWaitDays ?? -1) - (a.oldestWaitDays ?? -1) || b.open - a.open
    return b.open - a.open
  })
  return sorted
}

/**
 * Customer-level search: a row matches when the customer name, or any bill's
 * label/sublabel/address, contains the query (matching rows keep ALL their
 * bills — searching a job number should surface the whole customer).
 */
export function filterArCustomerRows(rows: ArCustomerRow[], query: string): ArCustomerRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.bills.some((b) =>
        `${b.item.label} ${b.item.sublabel ?? ''} ${b.item.address ?? ''}`.toLowerCase().includes(q),
      ),
  )
}
