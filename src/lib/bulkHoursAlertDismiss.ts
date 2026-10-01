import { pushDismissal } from './dismissalStore'
import { shouldShowBulkDeleteAlert, type BulkDeleteAlertDismissState } from './bulkDeleteAlertDismiss'

/**
 * Dismiss state for the "Hours added in bulk" Needs You item (v2.4281) — the same shape and rule
 * as the bulk-deletion notice (`bulkDeleteAlertDismiss.ts`): a burst is historical and never
 * drains, so without a dismiss it would pin itself to the card; "dismiss until the count
 * increases" keeps it quiet until NEW bursts arrive. Per-device (localStorage).
 */
const PREFIX = 'pipetooling.bulkHoursAlert.'

export type BulkHoursAlertDismissState = BulkDeleteAlertDismissState

export function loadBulkHoursAlertDismissState(userId: string): BulkHoursAlertDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as BulkHoursAlertDismissState
  } catch {
    return {}
  }
}

export function saveBulkHoursAlertDismissState(userId: string, state: BulkHoursAlertDismissState): void {
  pushDismissal(PREFIX, userId, state)
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(state))
  } catch {
    /* quota/private-mode: a lost dismiss just means the notice reappears — never break the dashboard */
  }
}

/** Same rule as the deletion notice: a non-zero count that is neither snoozed nor dismissed at this level. */
export const shouldShowBulkHoursAlert = shouldShowBulkDeleteAlert
