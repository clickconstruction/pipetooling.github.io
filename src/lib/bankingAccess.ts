import type { UserRole } from '../hooks/useAuth'

/**
 * Who opens Banking (v2.3305): controller and above — dev, master_technician,
 * controller. Plain assistants are out: the bank feed, the accounting labels
 * and the reconcile receipts are bookkeeping, not office work. Mirror of the
 * DB's `is_banking_staff()`; the two Banking edge functions carry the same set
 * in `ALLOWED_ROLES`.
 *
 * Every Banking door reads this — the gear-menu link, the route allow-list,
 * the page, the label-approvals Needs You cards (Dashboard + Quickfill) and
 * the Quickfill Banking sorting snapshot — so widening or narrowing the
 * audience is one edit.
 */
export const BANKING_ROLES: readonly UserRole[] = ['dev', 'master_technician', 'controller']

export function canAccessBanking(role: UserRole | string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}

/**
 * The non-dev Banking view (Mercury staff tabs, default User Sort slice, no
 * Ledger / Configuration / Stripe): master_technician and controller.
 */
export function isStaffBankingRole(role: UserRole | string | null | undefined): boolean {
  return role === 'master_technician' || role === 'controller'
}
