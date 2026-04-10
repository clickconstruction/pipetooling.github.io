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
 * Lowercase phrase from invoice `created_at`, using company calendar days (`denverCalendarDayKey`).
 * E.g. `created today`, `created yesterday`, `created 15 days ago`.
 */
export function formatInvoiceCreatedRelativePhrase(createdAt: string | null | undefined): string | null {
  if (createdAt == null || !String(createdAt).trim()) return null
  const ms = Date.parse(String(createdAt))
  if (Number.isNaN(ms)) return null
  const createdYmd = denverCalendarDayKey(ms)
  const todayYmd = denverCalendarDayKey(Date.now())
  const n = calendarDaysFromTo(createdYmd, todayYmd)
  if (n <= 0) return 'created today'
  if (n === 1) return 'created yesterday'
  return `created ${n} days ago`
}
