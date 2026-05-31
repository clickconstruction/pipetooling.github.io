/** Format decimal hours as "H:MM" or "H:MM:SS" (seconds only when nonzero). Returns '' for zero/negative. */
export function decimalToHms(decimal: number): string {
  if (!decimal || decimal <= 0) return ''
  const total = Math.round(decimal * 3600)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Parse a user-entered hours string to decimal hours.
 * "8.5" (one digit after dot) = 8.5 decimal hours. "8.30" (two digits, ≤59) = 8:30.
 * Colons/dots/spaces separate H:M:S. */
export function hmsToDecimal(str: string): number {
  const trimmed = str.trim()
  if (!trimmed) return 0
  if (!trimmed.includes(':') && /^\d+\.(\d+)$/.test(trimmed)) {
    const m = trimmed.match(/^\d+\.(\d+)$/)!
    const frac = m[1]!
    if (frac.length === 1) return parseFloat(trimmed) // 8.5 → 8.5 hrs
    if (parseInt(frac, 10) > 59) return parseFloat(trimmed) // 8.75 → 8.75 hrs
  }
  const normalized = trimmed.replace(/\./g, ':').replace(/\s+/g, ':')
  const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0)
  const [h = 0, m = 0, s = 0] = parts
  return h + m / 60 + s / 3600
}
