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

/** The Bids page and anything under it. */
export function isBidsPagePath(pathname: string): boolean {
  return pathname === '/bids' || pathname.startsWith('/bids/')
}

/**
 * The header's **Bid** press: New Bid, on the Bids page alone (v2.6839; from any page since
 * v2.6167, and the owner, 2026-11-10: *I would only like for it to be visible on the bids page*).
 * Every role that can make a bid has it there, and Farm Mode (the checklist-only lens) hides it
 * with the header's other presses. The Bids page reads the same rule: below its wide header its
 * own New Bid used to wrap onto a row of its own under the trades, so with the header's press on,
 * the page draws none of its own there.
 */
export function showHeaderNewBidButton(role: UserRole | null, farmModeActive: boolean, pathname: string): boolean {
  return isBidsPagePath(pathname) && !farmModeActive && canOpenBids(role) && role !== 'primary'
}
