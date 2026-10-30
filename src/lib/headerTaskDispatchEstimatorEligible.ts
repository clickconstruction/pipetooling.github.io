import type { UserRole } from '../hooks/useAuth'
import { canOpenBids } from './bids/bidsTabAccess'
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
 * The header's **Bid** press, New Bid from any page (v2.6167). It was the estimator's alone; now
 * every role that can make a bid has it, the way the estimator always did, and Farm Mode (the
 * checklist-only lens) hides it with the header's other presses. The Bids page reads the same
 * rule: below its wide header its own New Bid used to wrap onto a row of its own under the trades
 * (the owner, 2026-10-30: *instead of new bid wrapping at this viewport … move it to the header*),
 * so with the header's press on, the page draws none of its own there.
 */
export function showHeaderNewBidButton(role: UserRole | null, farmModeActive: boolean): boolean {
  return !farmModeActive && canOpenBids(role) && role !== 'primary'
}
