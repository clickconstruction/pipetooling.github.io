import { denverCalendarDayKey } from '../utils/dateUtils'

function ymdToUtcNoonMs(ymd: string): number {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return Date.UTC(y, m - 1, d, 12, 0, 0)
}

function calendarDaysFromTo(earlierYmd: string, laterYmd: string): number {
  return Math.round((ymdToUtcNoonMs(laterYmd) - ymdToUtcNoonMs(earlierYmd)) / 86400000)
}

/**
 * Calendar days from invoice `created_at` to today (`denverCalendarDayKey`), clamped at 0.
 * `0` = created today, `1` = yesterday, etc. `null` if `created_at` is missing or invalid.
 */
export function invoiceCreatedCalendarDayOffset(createdAt: string | null | undefined): number | null {
  if (createdAt == null || !String(createdAt).trim()) return null
  const ms = Date.parse(String(createdAt))
  if (Number.isNaN(ms)) return null
  const createdYmd = denverCalendarDayKey(ms)
  const todayYmd = denverCalendarDayKey(Date.now())
  const n = calendarDaysFromTo(createdYmd, todayYmd)
  return n < 0 ? 0 : n
}

/**
 * Label from invoice `created_at` using company calendar days (`denverCalendarDayKey`).
 * `T+0` = created today, `T+1` = calendar yesterday, `T+2` = two days ago, etc.
 */
export function formatInvoiceCreatedRelativePhrase(createdAt: string | null | undefined): string | null {
  const days = invoiceCreatedCalendarDayOffset(createdAt)
  if (days === null) return null
  return `T+${days}`
}
