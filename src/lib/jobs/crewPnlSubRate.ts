/**
 * Crew P&L "org-wide sub rate" save rule (journey-map Tier-2 #42, J8-F3).
 * The field used to save on blur and write NULL (→ the $50 default) when
 * tabbed through empty. Now: empty means "no change", an unchanged value
 * means "no change", and only an explicit Save writes a positive number.
 */
export type SubRateDecision = { kind: 'keep' } | { kind: 'invalid' } | { kind: 'save'; value: number }

export function subRateSaveDecision(raw: string, current: number): SubRateDecision {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'keep' }
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return { kind: 'invalid' }
  if (n === current) return { kind: 'keep' }
  return { kind: 'save', value: n }
}
