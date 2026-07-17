/**
 * Dismiss state for the dev "someone is trying to become a dev" notice.
 *
 * Mirrors bulkDeleteAlertDismiss.ts / devRejectedNotificationDismiss.ts. Same reasoning as the
 * bulk-deletion notice: a refused claim-dev attempt is a historical event that never drains to zero, so
 * without a dismiss it would pin itself to the dashboard forever. "Dismiss until count increases" keeps
 * it quiet until someone tries AGAIN.
 */
const PREFIX = 'pipetooling.claimDevAlert.'

export type ClaimDevAlertDismissState = {
  /** Hide while the refused-attempt count stays at or below this. */
  dismissedCount?: number
  /** Hide until this timestamp (ms since epoch). */
  snoozeUntil?: number
}

export function loadClaimDevAlertDismissState(userId: string): ClaimDevAlertDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as ClaimDevAlertDismissState
  } catch {
    return {}
  }
}

export function saveClaimDevAlertDismissState(userId: string, state: ClaimDevAlertDismissState): void {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(state))
  } catch {
    /* quota/private-mode: a lost dismiss just means the notice reappears — never break the dashboard */
  }
}

/**
 * Whether to show the notice. `now` is injected so the snooze window is testable without faking the clock.
 */
export function shouldShowClaimDevAlert(
  count: number | null,
  state: ClaimDevAlertDismissState,
  now: number = Date.now(),
): boolean {
  if (count === null || count <= 0) return false
  if (state.snoozeUntil !== undefined && now < state.snoozeUntil) return false
  if (state.dismissedCount !== undefined && count <= state.dismissedCount) return false
  return true
}
