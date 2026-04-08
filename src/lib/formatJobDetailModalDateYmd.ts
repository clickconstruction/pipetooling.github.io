/**
 * Job Detail modal: short ordinal month/day + signed offset from Chicago "today" (t±N).
 */

import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../utils/dateUtils'

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function normalizeToYmd(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  const head = t.length >= 10 ? t.slice(0, 10) : t
  return YMD_RE.test(head) ? head : null
}

export function todayYmdChicago(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function parseYmdToEpochDay(ymd: string): number {
  const parts = ymd.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return Date.UTC(y, m - 1, d) / 86400000
}

export function ordinalDay(n: number): string {
  const teenth = n % 100
  if (teenth >= 11 && teenth <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Canonical YYYY-MM-DD for hover when input is already validated elsewhere. */
export function formatJobDetailModalDateTitleFromYmd(ymd: string | null | undefined): string | null {
  return normalizeToYmd(ymd)
}

/**
 * e.g. `Mar 24th (t+14)` in Chicago vs `now`; same calendar day → `Mar 24th (today)`.
 */
export function formatJobDetailModalDateFromYmd(
  ymd: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const canon = normalizeToYmd(ymd)
  if (!canon) return null

  const todayYmd = todayYmdChicago(now)
  const delta = Math.round(parseYmdToEpochDay(canon) - parseYmdToEpochDay(todayYmd))

  const dayNum = Number(canon.slice(8, 10))
  const monthShort = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
  }).format(referenceDateForWorkDateYmd(canon))

  const head = `${monthShort} ${ordinalDay(dayNum)}`
  const qualifier =
    delta === 0 ? '(today)' : delta > 0 ? `(t+${delta})` : `(t${delta})`

  return `${head} ${qualifier}`
}
