/**
 * Human hours label for confirm copy and summaries: one decimal, with a "≈"
 * when rounding hid anything ("22.773756" → "≈ 22.8 hrs"; "8" → "8 hrs";
 * "0.02" → "< 0.1 hrs"). Pure — v2.2909 (J9-F4).
 */
export function approxHoursLabel(hours: number): string {
  const h = Number(hours)
  if (!Number.isFinite(h) || h <= 0) return '0 hrs'
  const rounded = Math.round(h * 10) / 10
  if (rounded === 0) return '< 0.1 hrs'
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  const exact = Math.abs(rounded - h) < 1e-9
  return exact ? `${text} hrs` : `≈ ${text} hrs`
}
