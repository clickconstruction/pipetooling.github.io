import type { UserRole } from '../../hooks/useAuth'
import { isControllerOrDev, isOwnerOrDev } from '../doorRoles'

/**
 * The People page's doors punch list #188 opened (PR 4, v2.6757): each gate the page, its tabs and the header read,
 * as one function with the row it answers. The owner took every recommendation of the audit table on 2026-11-08.
 * `isDev` arrives from `usePeopleAccess`, which resolves it after the role; the role itself is sync, so a door the
 * owner holds opens on the first paint and a dev's opens when the hook settles, as before.
 *
 * Pure: no React, no supabase.
 */

/** Row 2: People → Review and the header's Review icon — the owner or a dev (a dev's alone before). */
export function canSeeReviewTab(isDev: boolean, role: UserRole | null | undefined): boolean {
  return isDev || isOwnerOrDev(role)
}

/** Row 3: People → Scoreboard — the owner or a dev, and whoever holds payroll access (punch list #234 kept the pay-approved read). */
export function canSeeScoreboardTab(isDev: boolean, canAccessPay: boolean, role: UserRole | null | undefined): boolean {
  return isDev || canAccessPay || isOwnerOrDev(role)
}

/** Row 55: Payroll → the Balances and Payments views — the controller with a dev, over payroll access. */
export function canSeePayrollViews(canAccessPay: boolean, role: UserRole | null | undefined): boolean {
  return canAccessPay && isControllerOrDev(role)
}

/** Row 56: Overhead → choose the office job — the owner or a dev. */
export function canPickOfficeJob(isDev: boolean, role: UserRole | null | undefined): boolean {
  return isDev || isOwnerOrDev(role)
}

/** Row 57: Users → the Tags switch and the tag org panel — the owner or a dev. */
export function canUseUsersTags(isDev: boolean, role: UserRole | null | undefined): boolean {
  return isDev || isOwnerOrDev(role)
}

/** Row 58: Activity → the viewer grants, and the tab itself without a grant — the owner or a dev. */
export function canManageActivityGrants(isDev: boolean, role: UserRole | null | undefined): boolean {
  return isDev || isOwnerOrDev(role)
}

/** Row 59: Vehicles → Check-in settings and Wheels — the owner or a dev (the tab itself keeps its own gate). */
export function canSetFleetRules(role: UserRole | string | null | undefined): boolean {
  return isOwnerOrDev(role as UserRole | null | undefined)
}
