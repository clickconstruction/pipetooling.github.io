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
 */
import type { StageRow } from '../jobsStagesBoard'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import {
  PAY_SPEED_MIN_SAMPLES,
  billedReferenceYmd,
  daysBetweenYmd,
  type CustomerSegment,
  type PaySpeedData,
} from './billedExpectedPay'

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
}

export type MoneyWaiting = {
  /** Customers whose oldest open bill has waited past their baseline — slowest first. */
  rows: MoneyWaitingRow[]
  onPaceCount: number
  onPaceOpen: number
  companyMedianDays: number
}

/** ok at/under baseline · warn over it · late at twice it or more · undated when the bill has no date. */
export function billWaitTone(waitDays: number | null, baselineDays: number): OpenBillTone {
  if (waitDays == null) return 'undated'
  if (baselineDays > 0 && waitDays >= baselineDays * 2) return 'late'
  if (waitDays > baselineDays) return 'warn'
  return 'ok'
}

export function buildMoneyWaiting(rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string): MoneyWaiting | null {
  const company = paySpeeds?.company
  if (!paySpeeds || !company) return null

  type RawBill = Omit<OpenBill, 'tone'>
  type Acc = { name: string; open: number; bills: RawBill[] }
  const byCustomer = new Map<string, Acc>()
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const customerId = r.job.customer_id
    if (!customerId) continue
    const refYmd = billedReferenceYmd({
      billedAtIso: r.inv.billed_at,
      estBillYmd: effectiveInvoiceEstBillDate(r.inv),
    })
    const rawWait = refYmd ? daysBetweenYmd(refYmd, todayYmd) : null
    const waitDays = rawWait != null && rawWait >= 0 ? rawWait : null
    const acc = byCustomer.get(customerId) ?? {
      name: (r.job.customer_name ?? '').trim() || '—',
      open: 0,
      bills: [],
    }
    acc.open += open
    acc.bills.push({
      jobId: r.job.id ?? null,
      jobName: (r.job.job_name ?? '').trim() || '—',
      address: (r.job.job_address ?? '').trim() || null,
      billedYmd: refYmd,
      waitDays,
      open,
    })
    byCustomer.set(customerId, acc)
  }

  const offPace: MoneyWaitingRow[] = []
  let onPaceCount = 0
  let onPaceOpen = 0
  for (const [customerId, acc] of byCustomer) {
    const own = paySpeeds.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company.medianDays
    const oldestWaitDays = acc.bills.reduce<number | null>(
      (max, b) => (b.waitDays != null && (max == null || b.waitDays > max) ? b.waitDays : max),
      null,
    )
    if (oldestWaitDays == null || oldestWaitDays <= baselineDays) {
      onPaceCount++
      onPaceOpen += acc.open
      continue
    }
    const bills = acc.bills
      .map((b) => ({ ...b, tone: billWaitTone(b.waitDays, baselineDays) }))
      .sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.open - a.open)
    offPace.push({
      customerId,
      name: acc.name,
      segment: paySpeeds.customerTypes[customerId] ?? null,
      ownMedianDays: hasOwn ? own.medianDays : null,
      baselineDays,
      oldestWaitDays,
      open: acc.open,
      bills,
    })
  }

  offPace.sort((a, b) => b.oldestWaitDays - a.oldestWaitDays || b.open - a.open)
  return { rows: offPace, onPaceCount, onPaceOpen, companyMedianDays: company.medianDays }
}

/**
 * Open bills grouped for ANY customer with open money (off-pace or not), for
 * the "By customer" list's expansion — tones read against that customer's
 * baseline exactly as above.
 */
export function openBillsForCustomers(rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string): Map<string, OpenBill[]> {
  const out = new Map<string, OpenBill[]>()
  const company = paySpeeds?.company
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const customerId = r.job.customer_id
    if (!customerId) continue
    const own = paySpeeds?.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company?.medianDays ?? 0
    const refYmd = billedReferenceYmd({
      billedAtIso: r.inv.billed_at,
      estBillYmd: effectiveInvoiceEstBillDate(r.inv),
    })
    const rawWait = refYmd ? daysBetweenYmd(refYmd, todayYmd) : null
    const waitDays = rawWait != null && rawWait >= 0 ? rawWait : null
    const list = out.get(customerId) ?? []
    list.push({
      jobId: r.job.id ?? null,
      jobName: (r.job.job_name ?? '').trim() || '—',
      address: (r.job.job_address ?? '').trim() || null,
      billedYmd: refYmd,
      waitDays,
      open,
      tone: billWaitTone(waitDays, baselineDays),
    })
    out.set(customerId, list)
  }
  for (const list of out.values()) {
    list.sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.open - a.open)
  }
  return out
}
