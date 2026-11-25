/**
 * The due day a Stripe bill is made with (punch list #343, the live walk of 2026-11-24). Pure: the clock is handed in.
 *
 * `create-stripe-invoice` used to send Stripe a count of days, worked out from noon UTC of the due day and never
 * under 1. Stripe adds that count to the minute the bill is made. So a bill due today came out due tomorrow at any
 * hour, and a bill made between midnight and 6 AM Central came out a day late whatever its due day.
 *
 * The function now sends the due day itself, as one instant on that day (`due_date`). Which instant:
 *
 * 1. **23:59:59 UTC of the due day**, when that is still ahead. In Central that is about 6 PM on the due day, so the
 *    app reads it as the due day, and so does any page that prints the instant in UTC or in another US zone.
 * 2. Else **the last second of the due day in the company's zone**, when that is still ahead. That is an evening
 *    press of a bill due today. The app's own pages print in the company's zone and read it as today.
 * 3. Else the day is over, or about to be: Stripe takes no due day in the past, so the bill is due one day from
 *    now, as it was before. A recorded bill turned into a Stripe bill long after its billed day lands here.
 *
 * "Still ahead" leaves `STRIPE_BILL_DUE_MARGIN_MS` for the function to add the lines and finalize.
 */
import { APP_CALENDAR_TZ, todayYmdInAppTz, ymdAddDays } from './appTimeZone.ts'

/** How far ahead of the clock an instant must be before it is sent as the due day. */
export const STRIPE_BILL_DUE_MARGIN_MS = 10 * 60_000

export type StripeBillDue =
  /** The due day itself, as Unix seconds. `rule` says which instant of the day it is. */
  | { due_date: number; rule: 'utc_day_end' | 'app_day_end' }
  /** The day is over: a count of days from now, as before. */
  | { days_until_due: number; rule: 'day_is_over' }

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Minutes the company's zone is ahead of UTC at `ms` (negative in the US). */
function appTzOffsetMinutesAt(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  const wallAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  return Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / 60_000)
}

/** UTC ms of the last second of the civil day `ymd` in the company's zone (DST-aware). NaN when malformed. */
export function lastSecondOfYmdInAppTzMs(ymd: string): number {
  const next = ymdAddDays(ymd, 1)
  const m = YMD_RE.exec(next)
  if (!m) return NaN
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Two passes: the offset at the naive instant is wrong only across a DST switch, and the second lands on the right side.
  const first = naive - appTzOffsetMinutesAt(naive) * 60_000
  return naive - appTzOffsetMinutesAt(first) * 60_000 - 1000
}

/** What `stripe.invoices.create` is given for the due day `dueYmd` (YYYY-MM-DD, the company's calendar) at `nowMs`. */
export function stripeBillDue(dueYmd: string, nowMs: number): StripeBillDue {
  const over: StripeBillDue = { days_until_due: 1, rule: 'day_is_over' }
  const ymd = dueYmd.trim()
  const m = YMD_RE.exec(ymd)
  if (!m || !Number.isFinite(nowMs)) return over
  const earliest = nowMs + STRIPE_BILL_DUE_MARGIN_MS

  const utcEnd = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
  // Held to the company's day too, so the rule stays true if the company's zone ever sits east of UTC.
  if (utcEnd >= earliest && todayYmdInAppTz(new Date(utcEnd)) === ymd) return { due_date: Math.floor(utcEnd / 1000), rule: 'utc_day_end' }

  const appEnd = lastSecondOfYmdInAppTzMs(ymd)
  if (Number.isFinite(appEnd) && appEnd >= earliest) return { due_date: Math.floor(appEnd / 1000), rule: 'app_day_end' }

  return over
}

/**
 * The count of days a bill is made with when Stripe refuses the due day: the civil days from the company's today to
 * the due day, never under 1. That is the rule every bill was made on before #343, with the day counted in the
 * company's zone, so a refusal costs at worst what the old rule cost.
 */
export function stripeBillDueFallbackDays(dueYmd: string, nowMs: number): number {
  const m = YMD_RE.exec(dueYmd.trim())
  const t = YMD_RE.exec(todayYmdInAppTz(new Date(nowMs)))
  if (!m || !t) return 1
  const days = Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]))) / 86_400_000)
  return Math.max(1, days)
}

/** True when a Stripe error is about the due day we sent, by its `param` or by its words. */
export function isStripeDueDateRefusal(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { param?: unknown; message?: unknown }
  if (err.param === 'due_date') return true
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : ''
  return msg.includes('due_date') || msg.includes('due date')
}
