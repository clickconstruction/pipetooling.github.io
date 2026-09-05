import { recordNavClick } from './navClickTelemetry'

/**
 * `hours_approved{surface, role, count}` (journey-map Tier-1 #15): payroll
 * approvals were invisible — nine surfaces could approve and nothing said
 * which ones people actually use. Rides the existing `ui_nav_clicks` helper
 * (one row per approve, `control = 'hours_approved'`, `role` column, the
 * surface + count in `target`) so no schema change is needed.
 */
export type HoursApprovedSurface =
  | 'strip-pill'
  | 'strip-actions'
  | 'cell-popover'
  | 'bulk-modal'
  | 'approvals-queue'
  | 'users-row-queue'
  | 'desk-queue'
  | 'moneyfill-queue'
  | 'sessions-list'

export const HOURS_APPROVED_CONTROL = 'hours_approved'

/** Pure: the `target` string — `<surface>?count=<n>`, parseable by the Usage panel later. */
export function hoursApprovedTarget(surface: HoursApprovedSurface, count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  return `${surface}?count=${n}`
}

/** Fire-and-forget; skipped when nothing was approved (the RPC reports zero on all-skipped batches). */
export function recordHoursApproved(
  userId: string | null | undefined,
  role: string | null | undefined,
  surface: HoursApprovedSurface,
  count: number,
): void {
  if (!(count > 0)) return
  recordNavClick(userId, role ?? null, HOURS_APPROVED_CONTROL, hoursApprovedTarget(surface, count))
}
