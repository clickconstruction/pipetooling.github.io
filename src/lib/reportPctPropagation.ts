import { reportCompletionPercent } from './jobChargesTimeline'

/**
 * The note appended to the "N% complete — <note>" thread body when a report's
 * completion percent is mirrored into jobs_ledger.pct_complete (v2.1833).
 */
export const REPORT_PCT_PROPAGATION_NOTE = 'from field report'

/**
 * After a job report saves, decide what to write to jobs_ledger.pct_complete.
 * Returns the percent to propagate, or null to skip: the report carries no
 * completion percent (or it doesn't parse), or it matches the job's current
 * value — an unchanged write would still post a redundant "N% complete"
 * thread note. Downward corrections DO propagate (the report is the field's
 * newest statement, same rule as the My Schedule stepper).
 */
export function reportPctToPropagate(
  fieldValues: Record<string, unknown> | null | undefined,
  currentPct: number | null | undefined,
): number | null {
  const pct = reportCompletionPercent(fieldValues)
  if (pct == null) return null
  if (currentPct != null && Number(currentPct) === pct) return null
  return pct
}
