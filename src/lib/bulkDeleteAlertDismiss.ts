/**
 * Dismiss state for the dev "bulk deletion detected" dashboard notice.
 *
 * Mirrors devRejectedNotificationDismiss.ts. Why this notice is dismissible at all when the other
 * dashboard notices are not: those wrap work queues that drain to zero, so they clear themselves. A
 * deletion is historical and never drains — without a dismiss it would pin itself to the dashboard
 * forever. "Dismiss until count increases" is the right semantic: quiet until NEW deletions arrive.
 *
 * Per-device (localStorage), like the notice it mirrors. A table-backed ack would be cross-device and
 * auditable; not built.
 */
const PREFIX = 'pipetooling.bulkDeleteAlert.'

export type BulkDeleteAlertDismissState = {
  /** Hide while the alert count stays at or below this, until new bursts arrive. */
  dismissedCount?: number
  /** Hide until this timestamp (ms since epoch). */
  snoozeUntil?: number
}

export function loadBulkDeleteAlertDismissState(userId: string): BulkDeleteAlertDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as BulkDeleteAlertDismissState
  } catch {
    return {}
  }
}

export function saveBulkDeleteAlertDismissState(userId: string, state: BulkDeleteAlertDismissState): void {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(state))
  } catch {
    /* quota/private-mode: a lost dismiss just means the notice reappears — never break the dashboard */
  }
}

/**
 * Whether to show the notice: a non-zero count that is neither snoozed nor dismissed-at-this-level.
 * `now` is injected so the snooze window is testable without faking the clock.
 */
export function shouldShowBulkDeleteAlert(
  count: number | null,
  state: BulkDeleteAlertDismissState,
  now: number = Date.now(),
): boolean {
  if (count === null || count <= 0) return false
  if (state.snoozeUntil !== undefined && now < state.snoozeUntil) return false
  if (state.dismissedCount !== undefined && count <= state.dismissedCount) return false
  return true
}
