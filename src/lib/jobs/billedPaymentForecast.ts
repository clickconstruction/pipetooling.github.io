import type { StageRow } from '../jobsStagesBoard'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import {
  billedExpectedPayModel,
  daysBetweenYmd,
  formatYmdMonthDay,
  type ExpectedPayModel,
  type PaySpeedData,
  type PromisedPayDate,
} from './billedExpectedPay'

/**
 * Billed Awaiting Payment — payment forecast (pure kernel).
 *
 * Buckets every open billed row by its expected payment date (bill date +
 * customer pay speed, the expected-pay chips' model) into a when-does-cash-
 * arrive view: past expected / this week / next week / the following two
 * weeks / later / no pay history. Company weeks start Sunday (the
 * dateUtils convention). Rows with no open money are skipped and counted so
 * the modal never silently hides dollars.
 */

export type ForecastRow = {
  /** Stable row key: the invoice id (only invoice-bearing rows forecast). */
  invoiceId: string
  jobId: string
  /** "964 PLUM · Pondhill demo" */
  label: string
  customerName: string | null
  /** Open dollars on the row (the header chips' sum rule). */
  open: number
  /** Null only in the 'unknown' bucket (no reference date or no pay-speed data). */
  model: ExpectedPayModel | null
}

export type ForecastBucketKey = 'past' | 'thisWeek' | 'nextWeek' | 'following' | 'later' | 'unknown'

export type ForecastBucket = {
  key: ForecastBucketKey
  title: string
  sum: number
  rows: ForecastRow[]
}

export type PaymentForecast = {
  buckets: ForecastBucket[]
  openTotal: number
  rowCount: number
  /** Rows dropped for having no open money (paid down to $0 but still on the board). */
  skippedNoMoney: number
}

function ymdWeekday(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay()
}

function ymdShift(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** Sunday starting the company week containing `ymd`. */
export function forecastWeekStart(ymd: string): string {
  const wd = ymdWeekday(ymd)
  return wd == null ? ymd : ymdShift(ymd, -wd)
}

export function bucketKeyForExpected(expectedYmd: string, todayYmd: string): Exclude<ForecastBucketKey, 'unknown'> {
  const sinceExpected = daysBetweenYmd(expectedYmd, todayYmd)
  if (sinceExpected != null && sinceExpected > 0) return 'past'
  const weekStart = forecastWeekStart(todayYmd)
  const intoWeeks = daysBetweenYmd(weekStart, expectedYmd)
  if (intoWeeks == null) return 'later'
  if (intoWeeks < 7) return 'thisWeek'
  if (intoWeeks < 14) return 'nextWeek'
  if (intoWeeks < 28) return 'following'
  return 'later'
}

/** "Sep 7 – Sep 20" — the following-two-weeks bucket's date-range title. */
export function followingBucketTitle(todayYmd: string): string {
  const start = ymdShift(forecastWeekStart(todayYmd), 14)
  const end = ymdShift(start, 13)
  return `${formatYmdMonthDay(start)} – ${formatYmdMonthDay(end)}`
}

export function buildBilledPaymentForecast(
  rows: StageRow[],
  paySpeeds: PaySpeedData | null,
  todayYmd: string,
  promises?: Record<string, PromisedPayDate> | null,
): PaymentForecast {
  const byKey: Record<ForecastBucketKey, ForecastRow[]> = {
    past: [],
    thisWeek: [],
    nextWeek: [],
    following: [],
    later: [],
    unknown: [],
  }
  let skippedNoMoney = 0
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) {
      skippedNoMoney++
      continue
    }
    const job = r.job
    const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
    const name = (job.job_name ?? '').trim()
    const model = billedExpectedPayModel(
      {
        billedAtIso: r.inv.billed_at,
        estBillYmd: effectiveInvoiceEstBillDate(r.inv),
        customerId: job.customer_id,
      },
      paySpeeds,
      todayYmd,
      promises?.[job.id] ?? null,
    )
    const row: ForecastRow = {
      invoiceId: r.inv.id,
      jobId: job.id,
      label: name ? `${number} · ${name}` : number,
      customerName: (job.customer_name ?? '').trim() || null,
      open,
      model,
    }
    byKey[model ? bucketKeyForExpected(model.expectedYmd, todayYmd) : 'unknown'].push(row)
  }

  const byExpectedThenOpen = (a: ForecastRow, b: ForecastRow) => {
    if (a.model && b.model && a.model.expectedYmd !== b.model.expectedYmd) {
      return a.model.expectedYmd < b.model.expectedYmd ? -1 : 1
    }
    return b.open - a.open
  }
  const titles: Record<ForecastBucketKey, string> = {
    past: 'Past expected',
    thisWeek: 'This week',
    nextWeek: 'Next week',
    following: followingBucketTitle(todayYmd),
    later: 'Later',
    unknown: 'No pay history',
  }
  const order: ForecastBucketKey[] = ['past', 'thisWeek', 'nextWeek', 'following', 'later', 'unknown']
  const buckets: ForecastBucket[] = order.map((key) => {
    const list = byKey[key].slice().sort(byExpectedThenOpen)
    return {
      key,
      title: titles[key],
      sum: list.reduce((s, x) => s + x.open, 0),
      rows: list,
    }
  })
  return {
    buckets,
    openTotal: buckets.reduce((s, b) => s + b.sum, 0),
    rowCount: buckets.reduce((s, b) => s + b.rows.length, 0),
    skippedNoMoney,
  }
}
