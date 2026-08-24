/**
 * Payment forecast bucketing — Deno port of the client kernels for the
 * payment-forecast-email-dispatch edge function (v2.2225).
 *
 * SOURCE OF TRUTH: src/lib/jobs/billedExpectedPay.ts (expected-pay model) and
 * src/lib/jobs/billedPaymentForecast.ts (bucketing). This file reproduces
 * their math over the get_payment_forecast_email_payload() JSON so the email
 * shows exactly what the Stages "Payment forecast" modal shows. If the client
 * kernels change, change this port in the same train.
 *
 * Deliberate identities kept from the client:
 *   - billedReferenceYmd slices the RAW billed_at ISO (UTC date), falling
 *     back to the est. bill date — NOT the Chicago conversion the billed
 *     report SQL uses.
 *   - A customer's own median only counts with >= 3 samples
 *     (PAY_SPEED_MIN_SAMPLES); otherwise the company median ("company avg").
 *   - A promised date overrides the statistical estimate entirely.
 *   - Weeks start Sunday; buckets: past / thisWeek / nextWeek /
 *     following (2 weeks) / later / unknown (no reference date or no speeds).
 *   - Rows with no open money are skipped and counted (skippedNoMoney).
 */

export type PaySpeedStat = { medianDays: number; samples: number }

export type PayloadPaySpeeds = {
  company: PaySpeedStat | null
  customers: Record<string, PaySpeedStat>
  segments: { residential: PaySpeedStat | null; commercial: PaySpeedStat | null }
  customerTypes: Record<string, 'residential' | 'commercial'>
}

export type PayloadPromise = { promisedYmd: string; markedByName: string }

export type PayloadRow = {
  invoice_id: string
  job_id: string
  display_number: string | null
  job_name: string | null
  customer_id: string | null
  customer_name: string | null
  billed_at: string | null
  est_bill_ymd: string | null
  remaining: number
}

export type ForecastEmailPayload = {
  generated_at: string
  /** Chicago calendar date at build time (YYYY-MM-DD) — the kernel's todayYmd. */
  today: string
  rows: PayloadRow[]
  pay_speeds: PayloadPaySpeeds | null
  promises: Record<string, PayloadPromise>
}

export const PAY_SPEED_MIN_SAMPLES = 3

const MS_PER_DAY = 86_400_000

function ymdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
}

export function ymdAddDays(ymd: string, days: number): string | null {
  const ms = ymdToUtcMs(ymd)
  if (ms == null) return null
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10)
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtcMs(fromYmd)
  const b = ymdToUtcMs(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / MS_PER_DAY)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function formatYmdMonthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

/** The row's bill reference date (billedReferenceYmd: billed_at UTC slice, else est. bill date). */
export function billedReferenceYmd(row: Pick<PayloadRow, 'billed_at' | 'est_bill_ymd'>): string | null {
  const billed = row.billed_at?.trim()
  if (billed && billed.length >= 10) return billed.slice(0, 10)
  const est = row.est_bill_ymd?.trim()
  if (est && ymdToUtcMs(est) != null) return est
  return null
}

export type ExpectedPayModel = {
  expectedYmd: string
  state: 'upcoming' | 'late'
  source: 'customer' | 'company' | 'promised'
  medianDays: number
  daysLate: number
}

/** billedExpectedPayModel, minus the label/title strings (render builds its own). */
export function expectedPayModel(
  row: PayloadRow,
  speeds: PayloadPaySpeeds | null,
  todayYmd: string,
  promise: PayloadPromise | null,
): ExpectedPayModel | null {
  if (promise) {
    const sincePromise = daysBetweenYmd(promise.promisedYmd, todayYmd)
    if (sincePromise == null) return null
    return {
      expectedYmd: promise.promisedYmd,
      state: sincePromise > 0 ? 'late' : 'upcoming',
      source: 'promised',
      medianDays: 0,
      daysLate: Math.max(0, sincePromise),
    }
  }
  if (!speeds) return null
  const refYmd = billedReferenceYmd(row)
  if (!refYmd) return null
  const own = row.customer_id ? speeds.customers[row.customer_id] : undefined
  const useOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
  const stat = useOwn ? own : speeds.company
  if (!stat) return null
  const expectedYmd = ymdAddDays(refYmd, stat.medianDays)
  if (!expectedYmd) return null
  const sinceExpected = daysBetweenYmd(expectedYmd, todayYmd)
  if (sinceExpected == null) return null
  return {
    expectedYmd,
    state: sinceExpected > 0 ? 'late' : 'upcoming',
    source: useOwn ? 'customer' : 'company',
    medianDays: stat.medianDays,
    daysLate: Math.max(0, sinceExpected),
  }
}

export type ForecastBucketKey = 'past' | 'thisWeek' | 'nextWeek' | 'following' | 'later' | 'unknown'

function ymdWeekday(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay()
}

/** Sunday starting the company week containing `ymd`. */
export function forecastWeekStart(ymd: string): string {
  const wd = ymdWeekday(ymd)
  return wd == null ? ymd : (ymdAddDays(ymd, -wd) ?? ymd)
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
  const start = ymdAddDays(forecastWeekStart(todayYmd), 14) ?? todayYmd
  const end = ymdAddDays(start, 13) ?? start
  return `${formatYmdMonthDay(start)} – ${formatYmdMonthDay(end)}`
}

export type ForecastRow = {
  invoiceId: string
  jobId: string
  /** "964 · Pondhill demo" */
  label: string
  customerName: string | null
  segment: 'residential' | 'commercial' | null
  open: number
  model: ExpectedPayModel | null
  promisedBy: string | null
}

export type ForecastBucket = { key: ForecastBucketKey; title: string; sum: number; rows: ForecastRow[] }

export type PaymentForecast = {
  buckets: ForecastBucket[]
  openTotal: number
  rowCount: number
  skippedNoMoney: number
}

export function buildForecastFromPayload(p: ForecastEmailPayload): PaymentForecast {
  const byKey: Record<ForecastBucketKey, ForecastRow[]> = {
    past: [],
    thisWeek: [],
    nextWeek: [],
    following: [],
    later: [],
    unknown: [],
  }
  let skippedNoMoney = 0
  for (const r of p.rows) {
    const open = Number(r.remaining ?? 0)
    if (open <= 0) {
      skippedNoMoney++
      continue
    }
    const number = (r.display_number ?? '').trim() || '—'
    const name = (r.job_name ?? '').trim()
    const promise = p.promises[r.job_id] ?? null
    const model = expectedPayModel(r, p.pay_speeds, p.today, promise)
    const row: ForecastRow = {
      invoiceId: r.invoice_id,
      jobId: r.job_id,
      label: name ? `${number} · ${name}` : number,
      customerName: (r.customer_name ?? '').trim() || null,
      segment: (r.customer_id && p.pay_speeds?.customerTypes[r.customer_id]) || null,
      open,
      model,
      promisedBy: promise?.markedByName ?? null,
    }
    byKey[model ? bucketKeyForExpected(model.expectedYmd, p.today) : 'unknown'].push(row)
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
    following: followingBucketTitle(p.today),
    later: 'Later',
    unknown: 'No pay history',
  }
  const order: ForecastBucketKey[] = ['past', 'thisWeek', 'nextWeek', 'following', 'later', 'unknown']
  const buckets: ForecastBucket[] = order.map((key) => {
    const list = byKey[key].slice().sort(byExpectedThenOpen)
    return { key, title: titles[key], sum: list.reduce((s, x) => s + x.open, 0), rows: list }
  })
  return {
    buckets,
    openTotal: buckets.reduce((s, b) => s + b.sum, 0),
    rowCount: buckets.reduce((s, b) => s + b.rows.length, 0),
    skippedNoMoney,
  }
}
