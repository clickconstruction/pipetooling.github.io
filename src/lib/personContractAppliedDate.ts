import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../utils/dateUtils'

/**
 * Applied-version date helpers for People → Contracts.
 *
 * `person_contract_documents.applied_version_date` is a plain DATE column: a
 * manually set "Applied version" date that overrides the derived
 * Contract-Book-last-edited date. Plain dates must never round-trip through
 * `new Date('YYYY-MM-DD')` + a timeZone-aware formatter — that parses as UTC
 * midnight and renders as the previous day in America/Chicago.
 */

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** 'YYYY-MM-DD' → 'Apr 20, 2026' with no timezone math; null when absent/invalid. */
export function formatAppliedVersionPlainDate(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${MONTH_LABELS[month - 1]} ${day}, ${year}`
}

/** ISO timestamp → 'YYYY-MM-DD' in the app calendar timezone (seeds the custom-date input); null on invalid. */
export function isoToPlainDateInAppTz(iso: string | null | undefined, timeZone: string = APP_CALENDAR_TZ): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

/** Today's 'YYYY-MM-DD' in the app calendar timezone (fallback seed for the custom-date input). */
export function todayPlainDateInAppTz(timeZone: string = APP_CALENDAR_TZ): string {
  return isoToPlainDateInAppTz(new Date().toISOString(), timeZone) ?? todayYmdInAppTz()
}
