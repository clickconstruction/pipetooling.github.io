/**
 * Parse a user-typed percent-complete value (0-100) from a free-text input into the
 * canonical shape we persist to `project_workflow_steps.percent_complete`:
 *
 *   - empty / whitespace-only      -> null   (== "not tracked")
 *   - non-numeric (e.g. "abc")     -> null   (defensive; user cleared the field)
 *   - 0 (explicit or rounded /     -> null   (treated as "clear" — a 0% progress
 *     clamped from below)                     estimate is functionally identical to
 *                                             "not tracked", and the user explicitly
 *                                             asked that typing `0` clear the cell on
 *                                             the Forecast Specific gutter; we apply
 *                                             the rule here so the Workflow `Complete:`
 *                                             input behaves identically with no
 *                                             per-call-site logic.)
 *   - > 100                        -> 100    (clamp; matches the DB CHECK upper bound)
 *   - fractional                   -> rounded to the nearest integer (DB column is INT)
 *
 * Shared by the Forecast Specific gutter cell and the Workflow expanded-card input so
 * both surfaces produce identical values for identical keystrokes (no drift between
 * "75.4 saves as 75 in one place but 75.4 in the other").
 */
export function parsePercentCompleteInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  const clamped = Math.max(0, Math.min(100, Math.round(n)))
  return clamped === 0 ? null : clamped
}
