/** Must stay aligned with `src/utils/dateUtils.ts` (`APP_CALENDAR_TZ`). */
export const APP_CALENDAR_TZ = 'America/Chicago' as const

/**
 * Today's civil YYYY-MM-DD in the app calendar zone — the one "today" for anything written to
 * a `date` column (signed_at, expiry checks, due dates). Never `new Date().toISOString().slice(0, 10)`:
 * that is the UTC day, i.e. tomorrow's date every evening after 7 PM Central. Twin of
 * `todayYmdInAppTz` in `src/utils/dateUtils.ts`; `src/lib/appTimeZoneSharedParity.test.ts` pins parity (v2.2703).
 */
export function todayYmdInAppTz(now: Date = new Date()): string {
  // formatToParts, not format(): the en-CA short-date shape differs across ICU builds.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** Civil-date arithmetic on a YYYY-MM-DD (no zone involved — a day is a day). Returns '' if malformed. */
export function ymdAddDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ''
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10)
}
