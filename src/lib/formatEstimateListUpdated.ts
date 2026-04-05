/** Browser-local pieces for Estimates list "Updated" column: short date-time + compact relative line. */

export function formatEstimateUpdatedShort(iso: string): string {
  const d = new Date(iso)
  const s = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
  // Typical: "4/5, 1:26 AM" — drop comma for "4/5 1:26 AM"
  return s.replace(/^([^,]+),\s*/, '$1 ')
}

/** Parenthesized relative suffix only, e.g. `(15m ago)`. After 7d, weeks until 8w+, then months. */
export function formatEstimateUpdatedRelativeCompact(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime()
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (sec < 60) return '(just now)'
  const min = Math.floor(sec / 60)
  if (min < 60) return `(${min}m ago)`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `(${hr}h ago)`
  const day = Math.floor(hr / 24)
  if (day < 7) return `(${day}d ago)`
  const wk = Math.floor(day / 7)
  if (wk < 8) return `(${wk}w ago)`
  const mo = Math.floor(day / 30)
  return `(${Math.max(1, mo)}mo ago)`
}

export function formatEstimateListUpdatedLines(
  iso: string | null,
): { short: string; relative: string } | null {
  if (!iso?.trim()) return null
  return {
    short: formatEstimateUpdatedShort(iso),
    relative: formatEstimateUpdatedRelativeCompact(iso),
  }
}
