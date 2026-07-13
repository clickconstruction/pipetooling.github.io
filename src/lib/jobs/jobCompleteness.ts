/** Kernel for the Job Detail completeness mark (0–100%). */

/** Clamp arbitrary input to an integer percent 0–100; null for unparseable. */
export function clampCompletenessPct(value: number | string | null | undefined): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'string' ? Number(value.trim()) : value
  if (n == null || typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** "Marked by <name> · <short date>" sub-line; parts drop out when unknown. */
export function completenessMarkedLine(
  markedByName: string | null,
  markedAtIso: string | null,
): string | null {
  const name = markedByName?.trim() || null
  let dateLabel: string | null = null
  if (markedAtIso) {
    const d = new Date(markedAtIso)
    if (!Number.isNaN(d.getTime())) {
      dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
  }
  if (name && dateLabel) return `Marked by ${name} · ${dateLabel}`
  if (name) return `Marked by ${name}`
  if (dateLabel) return `Marked ${dateLabel}`
  return null
}
