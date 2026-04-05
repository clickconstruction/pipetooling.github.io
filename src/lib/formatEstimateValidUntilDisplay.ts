const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Display-only formatting for estimate `valid_until` (calendar YYYY-MM-DD).
 * Returns e.g. "Sun Apr 19, 2026" (weekday + short month + day + year).
 * Fallback: original string if not a valid ISO date.
 */
export function formatValidUntilForDisplay(isoDate: string): string {
  const trimmed = isoDate.trim()
  const m = ISO_YMD.exec(trimmed)
  if (!m) return trimmed

  const y = Number(m[1])
  const mon = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) return trimmed

  const dt = new Date(y, mon - 1, d)
  if (!Number.isFinite(dt.getTime())) return trimmed
  if (dt.getFullYear() !== y || dt.getMonth() !== mon - 1 || dt.getDate() !== d) return trimmed

  const s = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dt)
  // en-US yields "Sun, Apr 19, 2026"; product copy wants no comma after weekday
  return s.replace(/^([^,]+),\s*/, '$1 ')
}
