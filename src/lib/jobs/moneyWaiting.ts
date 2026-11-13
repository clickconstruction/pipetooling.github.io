/**
 * Money-waiting view-model (v2.2382, replaces the drift dumbbell chart):
 * per customer, every open bill on the board — which job, how many dollars,
 * and how long each bill has waited against what that customer usually does.
 * The dumbbell's shared 60-day axis clipped exactly the customers the chart
 * existed for (a 164-day wait rendered as a full-width bar with the number
 * struck through by it); these rows have no shared axis to clip.
 *
 * A customer is "off pace" when their longest-waiting open bill has waited
 * PAST their baseline (their own 12-mo median, or the company's for thin
 * history) — a young bill can't prove anyone slow. Everyone else with open
 * money collapses into the on-pace line. Unlike the old drift model, recent
 * completed payments don't move this view — it is strictly about money
 * sitting on the board today; payment form still shows in each customer's
 * history drill-down.
 *
 * A payer on a Pay calendar (punch list #323) is not judged by a count of days: a bill in on
 * the 1st and one in on the 30th are paid the same day, so their waits differ by a month and
 * prove nothing. Each of their bills is read against its expected day instead, the due day
 * plus how late that payer usually runs (`calendarBillRead`), and the payer is off pace once
 * a bill is past it.
 */
import type { StageRow } from '../jobsStagesBoard'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import { listPayer } from './billToParty'
import { jobIsScheduledInKind } from '../inKind/inKindLedger'
import { formatUsdNoCents } from './jobFormatting'
import {
  PAY_SPEED_MIN_SAMPLES,
  billedReferenceYmd,
  daysBetweenYmd,
  type CustomerSegment,
  type PaySpeedData,
} from './billedExpectedPay'
import { payClockFor } from './billedDuePay'
import {
  calendarBasisWords,
  calendarBillRead,
  calendarFor,
  latenessAgainst,
  type CalendarBillRead,
  type PayCalendar,
  type PayCalendarIndex,
  type PayCalendarLateness,
} from './payCalendar'

/** How one bill's wait reads against the customer's baseline. */
export type OpenBillTone = 'ok' | 'warn' | 'late' | 'undated'

export type OpenBill = {
  jobId: string | null
  jobName: string
  address: string | null
  billedYmd: string | null
  /** Days the bill has waited (null when it carries no usable date). */
  waitDays: number | null
  /** Open dollars remaining on this bill. */
  open: number
  tone: OpenBillTone
  /** The bill against its payer's Pay calendar; null or absent when it has none, and the tone reads the wait. */
  calendar?: CalendarBillRead | null
}

export type MoneyWaitingRow = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** Their own 12-mo median; null = thin history (baseline is the company median). */
  ownMedianDays: number | null
  baselineDays: number
  /** The longest-waiting open bill's days (never null in off-pace rows). */
  oldestWaitDays: number
  /** Open billed dollars on the board (the header chips' sum rule). */
  open: number
  /** Longest wait first; undated bills last. */
  bills: OpenBill[]
  /** The worst tone among the bills: what colours the row's lead. */
  worstTone: OpenBillTone
  /** The payer's Pay calendar; null when they have none. */
  calendar: PayCalendar | null
  /** Their record against that calendar; null with no calendar or nothing measured. */
  lateness: PayCalendarLateness | null
  /** The most days any bill is past its expected day; null when none is, or with no calendar. */
  pastExpectedDays: number | null
}

/** What the lists read beside the pay speeds for a payer on a Pay calendar. Absent, every bill reads its wait as before. */
export type MoneyWaitingCalendars = {
  payCalendars?: PayCalendarIndex | null
  /** The day a payer accepted each bill that has one, by the bill's id. */
  acceptedByInvoice?: ReadonlyMap<string, string> | null
}

export type MoneyWaiting = {
  /** Customers whose oldest open bill has waited past their baseline — slowest first. */
  rows: MoneyWaitingRow[]
  onPaceCount: number
  onPaceOpen: number
  companyMedianDays: number
  /** Bills an in-kind deal pays (punch list #301): open, never late, so under no customer here. */
  inKind: { count: number; dollars: number }
}

/** ok at/under baseline · warn over it · late at twice it or more · undated when the bill has no date. */
export function billWaitTone(waitDays: number | null, baselineDays: number): OpenBillTone {
  if (waitDays == null) return 'undated'
  if (baselineDays > 0 && waitDays >= baselineDays * 2) return 'late'
  if (waitDays > baselineDays) return 'warn'
  return 'ok'
}

type RawBill = Omit<OpenBill, 'tone'>

/** One open bill as the lists read it: its wait, and its read against the payer's calendar when there is one. */
function rawBillOf(r: Exclude<StageRow, { kind: 'job' }>, payerId: string, open: number, paySpeeds: PaySpeedData | null, todayYmd: string, calendars: MoneyWaitingCalendars | null | undefined): RawBill {
  const dates = { billedAtIso: r.inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(r.inv) }
  const refYmd = billedReferenceYmd(dates)
  const rawWait = refYmd ? daysBetweenYmd(refYmd, todayYmd) : null
  const cal = calendarFor(calendars?.payCalendars, { payerId, jobId: r.job.id })
  const clock = cal ? payClockFor({ ...dates, customerId: payerId, acceptedYmd: calendars?.acceptedByInvoice?.get(r.inv.id) ?? null }) : null
  return {
    jobId: r.job.id ?? null,
    jobName: (r.job.job_name ?? '').trim() || '—',
    address: (r.job.job_address ?? '').trim() || null,
    billedYmd: refYmd,
    waitDays: rawWait != null && rawWait >= 0 ? rawWait : null,
    open,
    calendar: cal && clock ? calendarBillRead(clock.ymd, cal, latenessAgainst(paySpeeds?.receipts[payerId], cal), todayYmd) : null,
  }
}

/** A bill on a calendar reads its expected day; any other reads its wait against the baseline. */
const toneOf = (b: RawBill, baselineDays: number | null): OpenBillTone => (b.calendar ? b.calendar.tone : baselineDays != null ? billWaitTone(b.waitDays, baselineDays) : 'undated')

const offPace = (tone: OpenBillTone): boolean => tone === 'warn' || tone === 'late'

export function buildMoneyWaiting(rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string, calendars?: MoneyWaitingCalendars | null): MoneyWaiting | null {
  const company = paySpeeds?.company
  if (!paySpeeds || !company) return null

  type Acc = { name: string; open: number; bills: RawBill[] }
  const byCustomer = new Map<string, Acc>()
  const inKind = { count: 0, dollars: 0 }
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    // Scheduled in kind is not waiting money: no pace judges it and nobody chases it.
    if (jobIsScheduledInKind(r.job)) {
      inKind.count += 1
      inKind.dollars += open
      continue
    }
    // v2.4367: filed under whoever the bill went to (the builder on a GC-billed bill).
    const payer = listPayer(r.job, r.inv)
    const customerId = payer.id
    if (!customerId) continue
    const acc = byCustomer.get(customerId) ?? {
      name: payer.name || '—',
      open: 0,
      bills: [],
    }
    acc.open += open
    acc.bills.push(rawBillOf(r, customerId, open, paySpeeds, todayYmd, calendars))
    byCustomer.set(customerId, acc)
  }

  const slow: MoneyWaitingRow[] = []
  let onPaceCount = 0
  let onPaceOpen = 0
  for (const [customerId, acc] of byCustomer) {
    const own = paySpeeds.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company.medianDays
    const bills = acc.bills
      .map((b) => ({ ...b, tone: toneOf(b, baselineDays) }))
      .sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.open - a.open)
    // Off pace is one bill past its yardstick: the wait past the baseline, or the expected day gone by.
    if (!bills.some((b) => offPace(b.tone))) {
      onPaceCount++
      onPaceOpen += acc.open
      continue
    }
    const oldestWaitDays = bills.reduce((max, b) => (b.waitDays != null && b.waitDays > max ? b.waitDays : max), 0)
    const calendar = calendarFor(calendars?.payCalendars, { payerId: customerId })
    const pastExpected = bills.reduce((max, b) => Math.max(max, b.calendar?.daysPastExpected ?? 0), 0)
    slow.push({
      customerId,
      name: acc.name,
      segment: paySpeeds.customerTypes[customerId] ?? null,
      ownMedianDays: hasOwn ? own.medianDays : null,
      baselineDays,
      oldestWaitDays,
      open: acc.open,
      bills,
      worstTone: bills.some((b) => b.tone === 'late') ? 'late' : 'warn',
      calendar,
      lateness: calendar ? latenessAgainst(paySpeeds.receipts[customerId], calendar) : null,
      pastExpectedDays: calendar && pastExpected > 0 ? pastExpected : null,
    })
  }

  slow.sort((a, b) => b.oldestWaitDays - a.oldestWaitDays || b.open - a.open)
  return { rows: slow, onPaceCount, onPaceOpen, companyMedianDays: company.medianDays, inKind }
}

/** A row reads its calendar once a bill of theirs is past its expected day; a calendar payer held up by a job with no calendar reads its wait. */
const readsCalendar = (row: Pick<MoneyWaitingRow, 'calendar' | 'pastExpectedDays'>): boolean => row.calendar != null && row.pastExpectedDays != null

/** The row's lead: "55d waiting", or for a payer on a Pay calendar "12d past expected". */
export function moneyWaitingLead(row: Pick<MoneyWaitingRow, 'calendar' | 'pastExpectedDays' | 'oldestWaitDays'>): string {
  return readsCalendar(row) ? `${row.pastExpectedDays}d past expected` : `${row.oldestWaitDays}d waiting`
}

/** What the lead is measured against: "usually ~41d" · "no history — vs company ~33d" · "pay calendar · lands ~6d after the pay day". */
export function moneyWaitingBasis(row: Pick<MoneyWaitingRow, 'calendar' | 'pastExpectedDays' | 'lateness' | 'ownMedianDays'>, companyMedianDays: number): string {
  if (readsCalendar(row)) return calendarBasisWords(row.lateness)
  return row.ownMedianDays != null ? `usually ~${row.ownMedianDays}d` : `no history — vs company ~${companyMedianDays}d`
}

/** The list's word on the bills it left out, so its money does not shrink with no word. Null when no bill is paid in kind. */
export function moneyWaitingInKindLine(inKind: { count: number; dollars: number }): string | null {
  if (inKind.count <= 0) return null
  return `${formatUsdNoCents(inKind.dollars)} on ${inKind.count} ${inKind.count === 1 ? 'bill' : 'bills'} is scheduled in kind, not money waiting`
}

/**
 * Open bills grouped for ANY customer with open money (off-pace or not), for
 * the "By customer" list's expansion — tones read against that customer's
 * baseline exactly as above.
 */
export function openBillsForCustomers(rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string, calendars?: MoneyWaitingCalendars | null): Map<string, OpenBill[]> {
  const out = new Map<string, OpenBill[]>()
  const company = paySpeeds?.company
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const customerId = listPayer(r.job, r.inv).id
    if (!customerId) continue
    const own = paySpeeds?.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company?.medianDays ?? 0
    const bill = rawBillOf(r, customerId, open, paySpeeds, todayYmd, calendars)
    const list = out.get(customerId) ?? []
    list.push({ ...bill, tone: toneOf(bill, baselineDays) })
    out.set(customerId, list)
  }
  for (const list of out.values()) {
    list.sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.open - a.open)
  }
  return out
}
