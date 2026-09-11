/**
 * "Their Word" PR 2 — the customer's own pay-by date from the portal.
 *
 * Pure rules shared by the portal page (which offers the dates) and
 * submit-portal-request (which refuses anything the page wouldn't offer).
 * No Deno, no DOM, no supabase — unit-tested from src/lib/portal.
 */

/** A bill has to be at least this old before the page asks "when?" — the first invoice asks for money, not a date. */
export const PROMISE_ASK_MIN_BILL_AGE_DAYS = 7
/** The furthest ahead a customer may promise from the portal. */
export const PROMISE_MAX_DAYS_AHEAD = 60
/** Portal promises per customer per hour before the function refuses more. */
export const PROMISE_MAX_PER_HOUR = 5

const YMD = /^\d{4}-\d{2}-\d{2}$/

function ymdToUtcMs(ymd: string): number | null {
  if (!YMD.test(ymd)) return null
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const t = Date.UTC(y, m - 1, d, 12)
  const back = new Date(t)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null
  return t
}

function utcMsToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

/** Whole days from `fromYmd` to `toYmd` (positive when `toYmd` is later); null on a bad date. */
export function promiseDaysBetween(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtcMs(fromYmd)
  const b = ymdToUtcMs(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / DAY_MS)
}

/**
 * Why a promised date can't be accepted, or null when it can. Today counts
 * ("we're sending it today"); the past and anything past the horizon don't.
 */
export function promiseDateProblem(dateYmd: string, todayYmd: string): string | null {
  const days = promiseDaysBetween(todayYmd, dateYmd)
  if (days == null) return 'Please pick a date.'
  if (days < 0) return 'That date has already passed — pick today or later.'
  if (days > PROMISE_MAX_DAYS_AHEAD) return `Please pick a date within the next ${PROMISE_MAX_DAYS_AHEAD} days, or call our office.`
  return null
}

export type PromiseDateChoice = { ymd: string; label: string }

/** "Sep 12" style label (no year — these are all within two months). */
function shortLabel(ymd: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(ymd.slice(5, 7)) - 1] ?? '?'} ${Number(ymd.slice(8, 10))}`
}

/**
 * The one-tap choices the page offers: this Friday (or next, when today is
 * Friday or the weekend), the Friday after, and two weeks on from that —
 * cheque runs are Fridays for most offices. Labels are "Fri Sep 12".
 */
export function promiseDateChoices(todayYmd: string): PromiseDateChoice[] {
  const t = ymdToUtcMs(todayYmd)
  if (t == null) return []
  const dow = new Date(t).getUTCDay() // 0 Sun … 6 Sat
  // Days until the next Friday strictly after today (a Friday today → next week).
  const untilFriday = ((5 - dow + 7) % 7) || 7
  const first = t + untilFriday * DAY_MS
  return [first, first + 7 * DAY_MS, first + 21 * DAY_MS].map((ms) => {
    const ymd = utcMsToYmd(ms)
    return { ymd, label: `Fri ${shortLabel(ymd)}` }
  })
}

/**
 * Whether the statement should offer "tell us when": there is money due and
 * at least one open bill is old enough that the ask is a step up from silence.
 */
export function promiseAskVisible(bills: ReadonlyArray<{ billedOn: string | null; amount: number }>, todayYmd: string): boolean {
  let due = 0
  let oldEnough = false
  for (const b of bills) {
    if (!(b.amount > 0)) continue
    due += b.amount
    if (b.billedOn) {
      const age = promiseDaysBetween(b.billedOn, todayYmd)
      if (age != null && age >= PROMISE_ASK_MIN_BILL_AGE_DAYS) oldEnough = true
    }
  }
  return due > 0 && oldEnough
}
