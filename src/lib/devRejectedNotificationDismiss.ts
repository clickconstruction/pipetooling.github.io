const PREFIX = 'pipetooling.devRejectedNotification.'

export type DevRejectedDismissState = {
  /** Hide while count stays at or below this until new rejects arrive. */
  dismissedCount?: number
  /** Hide until this timestamp (ms since epoch). */
  snoozeUntil?: number
}

export function loadDevRejectedDismissState(userId: string): DevRejectedDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as DevRejectedDismissState
  } catch {
    return {}
  }
}

export function saveDevRejectedDismissState(userId: string, state: DevRejectedDismissState): void {
  localStorage.setItem(PREFIX + userId, JSON.stringify(state))
}

/**
 * Whether to show the prominent dev rejected banner (non-zero count and not snoozed/dismissed).
 */
export function shouldShowDevRejectedBanner(
  count: number | null,
  state: DevRejectedDismissState,
): boolean {
  if (count === null || count <= 0) return false
  const now = Date.now()
  if (state.snoozeUntil !== undefined && now < state.snoozeUntil) return false
  if (state.dismissedCount !== undefined && count <= state.dismissedCount) return false
  return true
}
