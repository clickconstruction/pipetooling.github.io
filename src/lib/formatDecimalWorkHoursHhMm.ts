/**
 * Format decimal work hours (e.g. crew splits) as "8h 15m" or "45m", matching Job Summary punch-style labels.
 * Returns "—" for invalid or non-positive values.
 */
export function formatDecimalWorkHoursToHhMm(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—'
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes <= 0) return '—'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
