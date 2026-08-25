/**
 * Billed Awaiting Payment — expected-payment chip kernel.
 *
 * Answers "when should we expect payment?" per billed row:
 * expected date = the row's bill reference date (billed_at, falling back to
 * the est. bill date — the same clock the board's aging uses) + the
 * customer's median days-to-pay from get_billed_customer_pay_speeds (the
 * server-side mirror of customerProfileStats.customerDaysToPay).
 *
 * Customers with fewer than PAY_SPEED_MIN_SAMPLES measurable payments fall
 * back to the company-wide median and the chip says so ("company avg") —
 * a low-sample median is an anecdote, not a norm. A row is "late" once
 * today is past the expected date: the customer is now slower than their
 * own history, which is a sharper follow-up signal than a flat 30/90 bucket.
 */

export type PaySpeedStat = { medianDays: number; samples: number }

export type CustomerSegment = 'residential' | 'commercial'

/** One measurable payment behind a customer's median: billed date → the day money hit. */
export type PayReceipt = {
  billedYmd: string
  paidYmd: string
  gapDays: number
  /** Job identity (v2.2288) — null on pre-v7 payloads or payments with no job link. */
  jobId: string | null
  jobName: string | null
  address: string | null
}

/** Data-health counts for the breakdown's health line (v6 RPC). */
export type PaySpeedQuality = {
  payments12mo: number
  measurable: number
  unlinked: number
  undatedInvoices: number
  quarantined: number
}

export type PaySpeedData = {
  company: PaySpeedStat | null
  customers: Record<string, PaySpeedStat>
  /** Residential/commercial medians over the same samples (v2 RPC; null pre-v2 or when a segment has no samples). */
  segments: { residential: PaySpeedStat | null; commercial: PaySpeedStat | null }
  /** Every typed customer's classification (v2 RPC) — forecast rows wear the Res/Comm tag from this. */
  customerTypes: Record<string, CustomerSegment>
  /** Customer id → their measurable payments, newest paid first, capped at 12 (v3 RPC; empty pre-v3). */
  receipts: Record<string, PayReceipt[]>
  /** Measurability health counts (v6 RPC; null pre-v6). */
  quality: PaySpeedQuality | null
}

/** Below this many samples a customer's own median is ignored for the company fallback. */
export const PAY_SPEED_MIN_SAMPLES = 3

function asStat(v: unknown): PaySpeedStat | null {
  if (v == null || typeof v !== 'object') return null
  const m = (v as { medianDays?: unknown }).medianDays
  const s = (v as { samples?: unknown }).samples
  if (typeof m !== 'number' || !Number.isFinite(m)) return null
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return null
  return { medianDays: Math.max(0, Math.round(m)), samples: Math.round(s) }
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function asReceipt(v: unknown): PayReceipt | null {
  if (v == null || typeof v !== 'object') return null
  const billed = (v as { billedYmd?: unknown }).billedYmd
  const paid = (v as { paidYmd?: unknown }).paidYmd
  const gap = (v as { gapDays?: unknown }).gapDays
  if (typeof billed !== 'string' || !YMD_RE.test(billed)) return null
  if (typeof paid !== 'string' || !YMD_RE.test(paid)) return null
  if (typeof gap !== 'number' || !Number.isFinite(gap) || gap < 0) return null
  const jobId = (v as { jobId?: unknown }).jobId
  const jobName = (v as { jobName?: unknown }).jobName
  const address = (v as { address?: unknown }).address
  return {
    billedYmd: billed,
    paidYmd: paid,
    gapDays: Math.round(gap),
    jobId: typeof jobId === 'string' && jobId !== '' ? jobId : null,
    jobName: typeof jobName === 'string' && jobName.trim() !== '' ? jobName : null,
    address: typeof address === 'string' && address.trim() !== '' ? address : null,
  }
}

/** Defensive parse of the RPC's jsonb (null on gate-refused or malformed payloads; v1/v2 payloads get empty segments/types/receipts). */
export function parsePaySpeedsRpc(raw: unknown): PaySpeedData | null {
  if (raw == null || typeof raw !== 'object') return null
  const company = asStat((raw as { company?: unknown }).company)
  const customersRaw = (raw as { customers?: unknown }).customers
  const customers: Record<string, PaySpeedStat> = {}
  if (customersRaw != null && typeof customersRaw === 'object') {
    for (const [id, v] of Object.entries(customersRaw as Record<string, unknown>)) {
      const stat = asStat(v)
      if (stat) customers[id] = stat
    }
  }
  const segmentsRaw = (raw as { segments?: unknown }).segments
  const segments = {
    residential:
      segmentsRaw != null && typeof segmentsRaw === 'object'
        ? asStat((segmentsRaw as { residential?: unknown }).residential)
        : null,
    commercial:
      segmentsRaw != null && typeof segmentsRaw === 'object'
        ? asStat((segmentsRaw as { commercial?: unknown }).commercial)
        : null,
  }
  const typesRaw = (raw as { customerTypes?: unknown }).customerTypes
  const customerTypes: Record<string, CustomerSegment> = {}
  if (typesRaw != null && typeof typesRaw === 'object') {
    for (const [id, v] of Object.entries(typesRaw as Record<string, unknown>)) {
      if (v === 'residential' || v === 'commercial') customerTypes[id] = v
    }
  }
  const receiptsRaw = (raw as { receipts?: unknown }).receipts
  const receipts: Record<string, PayReceipt[]> = {}
  if (receiptsRaw != null && typeof receiptsRaw === 'object') {
    for (const [id, v] of Object.entries(receiptsRaw as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue
      const list = v.map(asReceipt).filter((r): r is PayReceipt => r != null)
      if (list.length > 0) receipts[id] = list
    }
  }
  return { company, customers, segments, customerTypes, receipts, quality: asQuality((raw as { quality?: unknown }).quality) }
}

function asQuality(v: unknown): PaySpeedQuality | null {
  if (v == null || typeof v !== 'object') return null
  const n = (key: string): number | null => {
    const x = (v as Record<string, unknown>)[key]
    return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : null
  }
  const payments12mo = n('payments12mo')
  const measurable = n('measurable')
  const unlinked = n('unlinked')
  const undatedInvoices = n('undatedInvoices')
  const quarantined = n('quarantined')
  if (payments12mo == null || measurable == null || unlinked == null || undatedInvoices == null || quarantined == null) {
    return null
  }
  return { payments12mo, measurable, unlinked, undatedInvoices, quarantined }
}

/** A customer-promised payment date on a job (list_job_promised_pay_dates). */
export type PromisedPayDate = { promisedYmd: string; markedByName: string }

/** Defensive parse of list_job_promised_pay_dates' jsonb (job id → promise). */
export function parsePromisedPayDatesRpc(raw: unknown): Record<string, PromisedPayDate> | null {
  if (raw == null || typeof raw !== 'object') return null
  const out: Record<string, PromisedPayDate> = {}
  for (const [jobId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null || typeof v !== 'object') continue
    const ymd = (v as { promisedYmd?: unknown }).promisedYmd
    const name = (v as { markedByName?: unknown }).markedByName
    if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    out[jobId] = { promisedYmd: ymd, markedByName: typeof name === 'string' && name.trim() ? name.trim() : 'office' }
  }
  return out
}

const MS_PER_DAY = 86_400_000

function ymdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
}

function ymdAddDays(ymd: string, days: number): string | null {
  const ms = ymdToUtcMs(ymd)
  if (ms == null) return null
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Whole calendar days from `fromYmd` to `toYmd` (positive when `toYmd` is later). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtcMs(fromYmd)
  const b = ymdToUtcMs(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / MS_PER_DAY)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Sep 8" (drops the year — the chip's late state covers stale dates). */
export function formatYmdMonthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

export type ExpectedPayModel = {
  expectedYmd: string
  state: 'upcoming' | 'late'
  /**
   * 'customer' = this customer's own median; 'company' = low-history
   * fallback; 'promised' = a real date the customer named (overrides the
   * statistical estimate entirely).
   */
  source: 'customer' | 'company' | 'promised'
  medianDays: number
  /** Calendar days past the expected date (0 while upcoming). */
  daysLate: number
  /** Full chip text. */
  label: string
  /** Hover text spelling out the math. */
  title: string
}

export type ExpectedPayRowInput = {
  /** jobs_ledger_invoices.billed_at (ISO timestamptz) — the primary bill clock. */
  billedAtIso: string | null
  /** Effective est. bill date (YYYY-MM-DD) — the board's aging fallback clock. */
  estBillYmd: string | null
  customerId: string | null
}

/** The row's bill reference date as YYYY-MM-DD (same precedence as printBilledRowReferenceDate). */
export function billedReferenceYmd(input: Pick<ExpectedPayRowInput, 'billedAtIso' | 'estBillYmd'>): string | null {
  const billed = input.billedAtIso?.trim()
  if (billed && billed.length >= 10) return billed.slice(0, 10)
  const est = input.estBillYmd?.trim()
  if (est && ymdToUtcMs(est) != null) return est
  return null
}

export function billedExpectedPayModel(
  input: ExpectedPayRowInput,
  data: PaySpeedData | null,
  todayYmd: string,
  promise?: PromisedPayDate | null,
): ExpectedPayModel | null {
  if (promise) {
    const sincePromise = daysBetweenYmd(promise.promisedYmd, todayYmd)
    if (sincePromise == null) return null
    const late = sincePromise > 0
    const daysLate = Math.max(0, sincePromise)
    return {
      expectedYmd: promise.promisedYmd,
      state: late ? 'late' : 'upcoming',
      source: 'promised',
      medianDays: 0,
      daysLate,
      label: late
        ? `${daysLate}d past promise · ${promise.markedByName}`
        : `✓ Promised ${formatYmdMonthDay(promise.promisedYmd)} · ${promise.markedByName}`,
      title: `Customer promised payment by ${formatYmdMonthDay(promise.promisedYmd)} (marked by ${promise.markedByName}) — overrides the statistical estimate`,
    }
  }
  if (!data) return null
  const refYmd = billedReferenceYmd(input)
  if (!refYmd) return null

  const own = input.customerId ? data.customers[input.customerId] : undefined
  const useOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
  const stat = useOwn ? own : data.company
  if (!stat) return null
  const source: ExpectedPayModel['source'] = useOwn ? 'customer' : 'company'

  const expectedYmd = ymdAddDays(refYmd, stat.medianDays)
  if (!expectedYmd) return null
  const sinceExpected = daysBetweenYmd(expectedYmd, todayYmd)
  if (sinceExpected == null) return null

  const state: ExpectedPayModel['state'] = sinceExpected > 0 ? 'late' : 'upcoming'
  const daysLate = Math.max(0, sinceExpected)
  const speedPart = source === 'customer' ? `pays in ~${stat.medianDays}d` : 'company avg'
  const label =
    state === 'late'
      ? `${daysLate}d past expected · ${speedPart}`
      : `Expect pay ~${formatYmdMonthDay(expectedYmd)} · ${speedPart}`
  const title =
    source === 'customer'
      ? `Billed ${formatYmdMonthDay(refYmd)} + this customer's median pay speed (~${stat.medianDays} days over ${stat.samples} payments, last 12 months) → expected ${formatYmdMonthDay(expectedYmd)}`
      : `Billed ${formatYmdMonthDay(refYmd)} + the company-wide median pay speed (~${stat.medianDays} days — this customer has too little payment history) → expected ${formatYmdMonthDay(expectedYmd)}`

  return { expectedYmd, state, source, medianDays: stat.medianDays, daysLate, label, title }
}
