import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike } from './subcontractorLikeRole'

/**
 * The audiences the dev gates opened to (punch list #188, 2026-11-08): the owner took every recommendation of the
 * audit table in `to-dos/dev-gates/README.md` as written, and each door that was a dev's, a dev's and the
 * controller's, or the owner's and a dev's now reads one of these predicates instead of an inline `role === 'dev'`.
 * The names are the table's words — *role: owner*, *role: controller*, *role: office*, *role: estimator* — so a row
 * of the table and the line that gates its door say the same thing.
 *
 * The database side of each door uses the SQL helper the predicate mirrors: `isOwnerOrDev` ↔ `is_master_or_dev()`,
 * `isControllerOrDev` ↔ `is_dev() OR is_controller()`, `isOfficeRole` ↔ `is_office_staff()`, `isEstimatorOrDev` ↔
 * `is_dev() OR is_estimator()`. A door whose policy or RPC widens does so in the same PR as its client line.
 *
 * Pure: no React, no supabase.
 */

/** *role: owner* — the owner (master_technician) or a dev. The one copy lives in `gc/access.ts` (punch list #140). */
export { isOwnerOrDev } from './gc/access'

/** *role: controller* — the controller or a dev; the books' doors. */
export function isControllerOrDev(role: UserRole | string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}

/** *role: office* — a dev, the owner or an assistant-like role (assistant, controller); the office's filing. */
export function isOfficeRole(role: UserRole | string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** *role: estimator* — an estimator or a dev; the estimators' own words and catalog. */
export function isEstimatorOrDev(role: UserRole | string | null | undefined): boolean {
  return role === 'dev' || role === 'estimator'
}
