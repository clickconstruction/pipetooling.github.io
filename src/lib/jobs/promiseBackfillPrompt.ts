/**
 * "Did they promise a date for this?" — the backfill prompt on Record payment
 * ("Their Word" PR 2). A late payment is the one moment the office always
 * visits, so it's where a promise made over the phone weeks ago gets written
 * down from memory. Pure: decides whether to ask and what to offer.
 */

/** A payment this many days after the bill is "late enough" to ask about. */
export const PROMISE_BACKFILL_MIN_DAYS_LATE = 14

const YMD = /^\d{4}-\d{2}-\d{2}$/

function ymdToUtcMs(ymd: string): number | null {
  const m = YMD.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 12)
}

export type PromiseBackfillInput = {
  /** The bill's reference date (billed_at day / est bill date), YYYY-MM-DD. */
  billedYmd: string | null | undefined
  /** The payment date being recorded, YYYY-MM-DD. */
  paidOnYmd: string
  /** A promise already on the job — then there's nothing to backfill. */
  existingPromiseYmd: string | null | undefined
}

/** Ask only for a payment that is late against its bill and has no promise on record. */
export function shouldAskPromiseBackfill(input: PromiseBackfillInput): boolean {
  if (input.existingPromiseYmd) return false
  if (!input.billedYmd) return false
  const a = ymdToUtcMs(input.billedYmd)
  const b = ymdToUtcMs(input.paidOnYmd)
  if (a == null || b == null) return false
  return Math.round((b - a) / 86_400_000) >= PROMISE_BACKFILL_MIN_DAYS_LATE
}

export type PromiseBackfillChoice = { ymd: string; label: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? '?'} ${Number(ymd.slice(8, 10))}`
}

/**
 * Quick picks around the payment: the paid-on day itself ("they said this
 * week and it came"), and the two Fridays before it. Dedupes and keeps
 * everything after the bill date.
 */
export function promiseBackfillChoices(paidOnYmd: string, billedYmd: string | null | undefined): PromiseBackfillChoice[] {
  const paid = ymdToUtcMs(paidOnYmd)
  if (paid == null) return []
  const billed = billedYmd ? ymdToUtcMs(billedYmd) : null
  const out: PromiseBackfillChoice[] = []
  const push = (ms: number) => {
    if (billed != null && ms <= billed) return
    const ymd = new Date(ms).toISOString().slice(0, 10)
    if (out.some((c) => c.ymd === ymd)) return
    out.push({ ymd, label: label(ymd) })
  }
  push(paid)
  const dow = new Date(paid).getUTCDay()
  const backToFriday = ((dow - 5 + 7) % 7) || 7
  const friday = paid - backToFriday * 86_400_000
  push(friday)
  push(friday - 7 * 86_400_000)
  return out
}
