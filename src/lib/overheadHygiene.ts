/**
 * Maintenance-hygiene classification for the People → Overhead tab's
 * attention strip (2026-08-02 labor audit). Every labor hour/dollar in the
 * 90-day overhead pool and the Method A/C denominators requires an APPROVED,
 * CLOSED clock session — so three classes of maintenance debt silently skew
 * the numbers with no indicator anywhere near them:
 *
 * 1. Pending approvals — unapproved sessions are excluded entirely, so they
 *    undercount the pool AND the field denominators (office/bid time
 *    especially: no payroll pressure forces its approval).
 * 2. Unpriced hours — sessions whose person has no pay-config wage match
 *    price at $0: hours still count (Method A denominator full) but dollars
 *    vanish (pool + Method C deflated). The daily-labor builders already
 *    flag this per detail line (`missingWage`); this kernel just aggregates
 *    those lines per person.
 * 3. Unassigned salary time — salary-schedule-materialized sessions carry
 *    `job_ledger_id = bid_id = NULL`, so salaried office staff time is
 *    invisible to the pool unless hand-assigned.
 *
 * Pure module — the strip's math lives here (tested), not inline in the tab.
 */
import { approvedClosedSessionHours, type OverheadClockSessionRow } from './overheadDailyLabor'

/** Minimal session shape the hygiene classifiers need (subset of the tab's fetch rows). */
export type OverheadHygieneSessionInput = Pick<
  OverheadClockSessionRow,
  'id' | 'clocked_in_at' | 'clocked_out_at' | 'approved_at' | 'rejected_at' | 'revoked_at' | 'users'
>

/** Minimal detail-line shape for the unpriced-hours aggregation (both daily-labor builders' lines satisfy it). */
export type OverheadHygieneWageLine = {
  sessionId: string
  userName: string
  hours: number
  missingWage: boolean
}

export type OverheadHygienePendingSummary = {
  /** Pending sessions that are clocked out (approvable as-is). */
  closedCount: number
  /** Total hours across the closed pending sessions. */
  closedHours: number
  /** Pending sessions still open (no clock-out yet — hours unknown). */
  openCount: number
}

export type OverheadHygieneUnpricedSummary = {
  /** Distinct display names with $0-priced hours, sorted. */
  personNames: string[]
  sessionCount: number
  hours: number
}

export type OverheadHygieneUnassignedSalarySummary = {
  sessionCount: number
  /** Hours across CLOSED unassigned sessions (open ones contribute count only). */
  hours: number
  /** Distinct display names, sorted. */
  personNames: string[]
}

export type OverheadHygieneSummary = {
  pending: OverheadHygienePendingSummary
  unpriced: OverheadHygieneUnpricedSummary
  /** `null` when the unassigned-salary fetch failed (indicator hidden, not zero). */
  unassignedSalary: OverheadHygieneUnassignedSalarySummary | null
  /** True when any indicator has something to show — the strip hides entirely otherwise. */
  anyAttention: boolean
}

/**
 * Pending approvals across the given session arrays: no `approved_at`, no
 * `rejected_at`, no `revoked_at`. Sessions are deduped by id — the tab's
 * office-or-bid query and field query can both return a session that has a
 * field `job_ledger_id` AND a `bid_id`.
 */
export function summarizeOverheadPendingApprovals(
  sessionArrays: ReadonlyArray<readonly OverheadHygieneSessionInput[]>,
): OverheadHygienePendingSummary {
  const seen = new Set<string>()
  let closedCount = 0
  let closedHours = 0
  let openCount = 0
  for (const arr of sessionArrays) {
    for (const s of arr) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      if (s.approved_at != null || s.rejected_at != null || s.revoked_at != null) continue
      if (s.clocked_out_at == null) {
        openCount += 1
        continue
      }
      const hours = approvedClosedSessionHours(s)
      closedCount += 1
      if (hours != null && hours > 0) closedHours += hours
    }
  }
  return { closedCount, closedHours, openCount }
}

/**
 * Aggregates the daily-labor builders' `missingWage` detail lines (already
 * restricted to approved+closed sessions that count toward the numbers) into
 * a per-person $0-priced summary. Deduped by sessionId across groups for the
 * same field-job-with-bid overlap as the pending classifier.
 */
export function summarizeOverheadUnpricedHours(
  lineGroups: ReadonlyArray<readonly OverheadHygieneWageLine[]>,
): OverheadHygieneUnpricedSummary {
  const seen = new Set<string>()
  const names = new Set<string>()
  let sessionCount = 0
  let hours = 0
  for (const lines of lineGroups) {
    for (const l of lines) {
      if (!l.missingWage) continue
      if (seen.has(l.sessionId)) continue
      seen.add(l.sessionId)
      names.add(l.userName)
      sessionCount += 1
      hours += l.hours
    }
  }
  return { personNames: [...names].sort((a, b) => a.localeCompare(b)), sessionCount, hours }
}

/**
 * Unassigned salary-schedule time: the caller fetches sessions with
 * `origin = 'salary_schedule'` AND `job_ledger_id IS NULL` AND
 * `bid_id IS NULL` in the window; this classifier drops rejected/revoked
 * rows and sums the rest (hours from closed sessions only). Approval status
 * is deliberately ignored — an unassigned session is invisible to the pool
 * either way.
 */
export function summarizeOverheadUnassignedSalary(
  sessions: readonly OverheadHygieneSessionInput[],
): OverheadHygieneUnassignedSalarySummary {
  const names = new Set<string>()
  let sessionCount = 0
  let hours = 0
  for (const s of sessions) {
    if (s.rejected_at != null || s.revoked_at != null) continue
    sessionCount += 1
    names.add((s.users?.name ?? '').trim() || 'Unknown')
    const h = approvedClosedSessionHours(s)
    if (h != null && h > 0) hours += h
  }
  return { sessionCount, hours, personNames: [...names].sort((a, b) => a.localeCompare(b)) }
}

export function buildOverheadHygieneSummary(args: {
  /** The 90-day effect's office-or-bid session fetch, as-is. */
  officeAndBidSessions: readonly OverheadHygieneSessionInput[]
  /** The 90-day effect's field (non-office jobs-ledger) session fetch, as-is. */
  fieldSessions: readonly OverheadHygieneSessionInput[]
  /** Unassigned salary-schedule sessions in the window; `null` = fetch failed. */
  unassignedSalarySessions: readonly OverheadHygieneSessionInput[] | null
  /** Flattened detail lines from `buildOverheadDailyLabor` (office/bid buckets). */
  overheadDetailLines: readonly OverheadHygieneWageLine[]
  /** Flattened detail lines from `buildOtherJobsLaborByDay` (field labor). */
  otherJobsDetailLines: readonly OverheadHygieneWageLine[]
}): OverheadHygieneSummary {
  const pending = summarizeOverheadPendingApprovals([args.officeAndBidSessions, args.fieldSessions])
  const unpriced = summarizeOverheadUnpricedHours([args.overheadDetailLines, args.otherJobsDetailLines])
  const unassignedSalary =
    args.unassignedSalarySessions == null ? null : summarizeOverheadUnassignedSalary(args.unassignedSalarySessions)
  const anyAttention =
    pending.closedCount + pending.openCount > 0 ||
    unpriced.sessionCount > 0 ||
    (unassignedSalary?.sessionCount ?? 0) > 0
  return { pending, unpriced, unassignedSalary, anyAttention }
}

/** "A, B, C and N more" — distinct display names capped for the strip (cap 3 by default). */
export function formatOverheadHygienePersonNames(names: readonly string[], cap = 3): string {
  if (names.length === 0) return ''
  if (names.length <= cap) return names.join(', ')
  const shown = names.slice(0, cap)
  return `${shown.join(', ')} and ${names.length - cap} more`
}
