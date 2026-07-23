import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** Job Summary cost breakdown: substring match on person name; empty query shows all. */
export function personMatchesJobSummaryBreakdownFilter(
  name: string | null | undefined,
  queryRaw: string,
): boolean {
  const q = queryRaw.trim().toLowerCase()
  if (!q) return true
  return (name ?? '').toLowerCase().includes(q)
}

export function formatJobSummaryInvoiceDate(iso: string): string {
  try {
    return new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Mercury posted_at in Job Summary Card charges: weekday + date in company calendar TZ (Chicago). */
export function formatJobSummaryMercuryPostedAt(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

export function formatJobSummarySessionDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

/** Job Summary Team Labor "By work date" table: In/Out column (work date is in the first column). */
export function formatJobSummarySessionTimeOnly(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', { timeStyle: 'short' })
  } catch {
    return '—'
  }
}

export function formatJobSummaryDurationMinutes(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const m = Math.round(ms / 60000)
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h > 0) return `${h}h ${min}m`
  return `${min}m`
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Abbreviated money for the Stages section headers (v2.973): "144.8k", "1.2m",
 * "950" — TRUNCATED, never rounded ($144,869.25 → 144.8k, not 144.9k), sign
 * preserved, trailing ".0" trimmed. Caller prefixes the "$".
 */
export function formatCurrencyAbbrevTruncated(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs < 1000) return `${sign}${Math.trunc(abs).toLocaleString('en-US')}`
  const scaled = abs < 1_000_000 ? Math.trunc(abs / 100) / 10 : Math.trunc(abs / 100_000) / 10
  const unit = abs < 1_000_000 ? 'k' : 'm'
  const numText = (scaled % 1 === 0 ? String(Math.trunc(scaled)) : scaled.toFixed(1))
  return `${sign}${numText}${unit}`
}

export function jobSummaryPartsCostIsZero(n: number): boolean {
  const x = Number(n)
  return Number.isFinite(x) && Math.abs(x) < 1e-6
}

export function formatCurrencyNoCents(n: number): string {
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Integer USD for Stages Paid / Left / Bid lines (leading $, no cents). */
export function formatUsdNoCents(n: number): string {
  return `$${formatCurrencyNoCents(n)}`
}

/** Calendar whole days from an ISO date/timestamp to now in UTC (avoids DST edge cases). */
export function calendarDaysSinceDateUtc(dateIso: string, now = new Date()): number {
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return -1
  const fromUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const toUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((toUtc - fromUtc) / 86400000)
}

export function formatTimeSince(iso: string | null, now = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''}`
}

export function formatEstimatedCompletionDisplay(
  estimatedCompletionDate: string | null,
  now = new Date(),
): string | null {
  if (!estimatedCompletionDate?.trim()) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(estimatedCompletionDate.trim() + 'T12:00:00')
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  const dayOfWeek = target.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
  if (diffDays > 0) return `T-${diffDays} (${dayOfWeek})`
  if (diffDays < 0) return `T+${Math.abs(diffDays)} (${dayOfWeek})`
  return `Today (${dayOfWeek})`
}

export function addDaysToDate(dateStr: string | null, deltaDays: number): string {
  const base = dateStr?.trim() ? new Date(dateStr.trim() + 'T12:00:00') : new Date()
  base.setDate(base.getDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

export function formatYmdOrIsoDateForPrintDisplay(ymdOrIso: string): string {
  const trimmed = ymdOrIso.trim()
  const datePart = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed
  const d = new Date(`${datePart}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatPrintDaysSince(ageDays: number | null): string {
  if (ageDays == null) return '—'
  if (ageDays === 1) return '1 day'
  return `${ageDays} days`
}

/** Sub Labor modal crew search: empty query leaves list unchanged. */
export function filterLaborCrewNames(names: string[], queryLower: string): string[] {
  if (!queryLower) return names
  return names.filter((n) => n.toLowerCase().includes(queryLower))
}

export function formatJobNameTwoLines(name: string | null): { line1: string; line2?: string } | null {
  const a = (name ?? '').trim()
  if (!a) return null
  const commaIdx = a.indexOf(',')
  if (commaIdx !== -1) {
    const line1 = a.slice(0, commaIdx).trim()
    const line2 = a.slice(commaIdx + 1).trim()
    return { line1, line2: line2 || undefined }
  }
  return { line1: a }
}
