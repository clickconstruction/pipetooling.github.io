/**
 * Pay-speed drift view-model: is each customer above or below their own
 * average right now, and by how much — the question behind the breakdown's
 * dumbbell chart (owner-approved mockup: hollow dot = their 12-mo median,
 * filled dot = where they are today, dashed line = company median).
 *
 * "Where they are today" reads two honest sources:
 * - live: the longest-waiting open bill, once it has waited PAST the
 *   baseline — a young bill can't prove anyone is fast, so live waits
 *   below baseline say nothing;
 * - recent: the median of the last 3 completed payments vs their own
 *   median — the only source that can show a customer running BELOW
 *   their average.
 * Whichever is worse wins. Thin-history customers (fewer than
 * PAY_SPEED_MIN_SAMPLES measured payments) baseline on the company median
 * and only ever move via live waits.
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

export type PayDriftSource = 'live' | 'recent'

export type PayDriftRow = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** Their own 12-mo median; null = thin history (baseline is the company median). */
  ownMedianDays: number | null
  /** What the delta measures against: their median, or the company's for thin history. */
  baselineDays: number
  /** Where they are now (baseline + delta), for plotting on the days axis. */
  currentDays: number
  /** Days above (+) or below (−) their baseline. Never 0 in `rows`. */
  deltaDays: number
  /** currentDays − the company median. */
  deltaVsCompanyDays: number
  /** Which source moved the needle. */
  source: PayDriftSource
  samples: number
  /** Open billed dollars on the board (the header chips' sum rule). */
  open: number
}

export type PayDrift = {
  /** Customers off their pace, worst drift first (ties: biggest open $ first). */
  rows: PayDriftRow[]
  /** Customers with open money sitting at their baseline — collapsed to one line. */
  onPaceCount: number
  onPaceOpen: number
  companyMedianDays: number
}

/** Middle value of up to the 3 newest receipt gaps (receipts arrive newest-paid first). */
function recentMedianGap(gaps: number[]): number | null {
  const three = gaps.slice(0, 3)
  if (three.length < 3) return null
  const sorted = [...three].sort((a, b) => a - b)
  return sorted[1] ?? null
}

export function buildPayDrift(rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string): PayDrift | null {
  const company = paySpeeds?.company
  if (!paySpeeds || !company) return null

  type Acc = { name: string; open: number; maxWaitDays: number | null }
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
    const wait = refYmd ? daysBetweenYmd(refYmd, todayYmd) : null
    const acc = byCustomer.get(customerId) ?? {
      name: (r.job.customer_name ?? '').trim() || '—',
      open: 0,
      maxWaitDays: null,
    }
    acc.open += open
    if (wait != null && wait >= 0 && (acc.maxWaitDays == null || wait > acc.maxWaitDays)) {
      acc.maxWaitDays = wait
    }
    byCustomer.set(customerId, acc)
  }

  const offPace: PayDriftRow[] = []
  let onPaceCount = 0
  let onPaceOpen = 0
  for (const [customerId, acc] of byCustomer) {
    const own = paySpeeds.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company.medianDays

    const liveDelta =
      acc.maxWaitDays != null && acc.maxWaitDays > baselineDays ? acc.maxWaitDays - baselineDays : null
    const recent = hasOwn ? recentMedianGap((paySpeeds.receipts[customerId] ?? []).map((x) => x.gapDays)) : null
    const recentDelta = recent != null ? recent - baselineDays : null

    let deltaDays = 0
    let source: PayDriftSource | null = null
    if (liveDelta != null && (recentDelta == null || liveDelta >= recentDelta)) {
      deltaDays = liveDelta
      source = 'live'
    } else if (recentDelta != null && recentDelta !== 0) {
      deltaDays = recentDelta
      source = 'recent'
    }

    if (source == null || deltaDays === 0) {
      onPaceCount++
      onPaceOpen += acc.open
      continue
    }
    const currentDays = baselineDays + deltaDays
    offPace.push({
      customerId,
      name: acc.name,
      segment: paySpeeds.customerTypes[customerId] ?? null,
      ownMedianDays: hasOwn ? own.medianDays : null,
      baselineDays,
      currentDays,
      deltaDays,
      deltaVsCompanyDays: currentDays - company.medianDays,
      source,
      samples: own?.samples ?? 0,
      open: acc.open,
    })
  }

  offPace.sort((a, b) => b.deltaDays - a.deltaDays || b.open - a.open)
  return { rows: offPace, onPaceCount, onPaceOpen, companyMedianDays: company.medianDays }
}
