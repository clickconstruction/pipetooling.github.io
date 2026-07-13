/** Compact "who + when" stamp for Quickfill jump buttons (e.g. T · 4h, T · 7/6). */

/** First letter of the marker's name, uppercased; '?' when unknown. */
export function markStampInitial(name: string | null | undefined): string {
  const m = (name ?? '').trim().match(/[A-Za-z]/)
  return m ? m[0]!.toUpperCase() : '?'
}

/**
 * Compact age: same buckets as the Quickfill relative formatter (m / h / d),
 * switching to numeric M/D once older than a week.
 */
export function markStampTime(markedAtIso: string, nowMs: number): string {
  const t = new Date(markedAtIso).getTime()
  if (!Number.isFinite(t)) return ''
  const ms = nowMs - t
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  const d = new Date(markedAtIso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
