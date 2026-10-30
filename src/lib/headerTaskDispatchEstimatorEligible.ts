import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'

/** Header Task Dispatch icon (send dispatch request). */
export function showTaskDispatchButton(role: UserRole | null): boolean {
  if (!role) return false
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    isAssistantLike(role) ||
    role === 'estimator' ||
    isSubcontractorLikeRole(role)
  )
}

/**
 * Title / aria-label for the header's purple estimator-request button (desktop
 * text pair and mobile icon pair in `Layout.tsx`). It *sends* an
 * `estimator_requests` row; it is not an inbox, and field roles that see the
 * button have no estimator inbox anywhere (J2-F7 / J30-N3 / J30-adj-1). One
 * constant so the two pairs cannot drift apart again.
 */
export const HEADER_ASK_ESTIMATING_LABEL = 'Ask estimating'

/** Header "Ask estimating" button (send estimator request). Same roles as Task Dispatch. */
export function showEstimatorInboxButton(role: UserRole | null): boolean {
  return showTaskDispatchButton(role)
}

/** Header Task icon (add checklist item modal). */
export function showHeaderTaskChecklistButton(role: UserRole | null): boolean {
  if (!role) return false
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    isAssistantLike(role) ||
    role === 'primary' ||
    role === 'estimator' ||
    isSubcontractorLikeRole(role)
  )
}

/**
 * The header's **Bid** press, the estimator's New Bid from any page; Farm Mode (the checklist-only
 * lens) hides every header press. The Bids page reads it too (v2.6167): below its wide header its
 * own New Bid shares a row with the trades, and an estimator on a phone saw New Bid twice, a
 * thumb apart. With the header's press on, the page draws none of its own on a phone.
 */
export function showHeaderNewBidButton(role: UserRole | null, farmModeActive: boolean): boolean {
  return role === 'estimator' && !farmModeActive
}
