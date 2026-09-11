import { pushDismissal } from './dismissalStore'
/**
 * Snooze / dismiss state for the dev "Robots have work waiting" Needs You item
 * (v2.3287). Mirrors bulkDeleteAlertDismiss.ts. The backlog does drain on its
 * own, but a dev deliberately letting work pile up for a batch should not be
 * nagged in the meantime: snooze 24h, or dismiss until the count rises.
 * Per-device (localStorage), like its siblings.
 */
const PREFIX = 'pipetooling.robotBacklog.'

export type RobotBacklogDismissState = {
  /** Hide while the backlog total stays at or below this. */
  dismissedCount?: number
  /** Hide until this timestamp (ms since epoch). */
  snoozeUntil?: number
}

export function loadRobotBacklogDismissState(userId: string): RobotBacklogDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as RobotBacklogDismissState
  } catch {
    return {}
  }
}

export function saveRobotBacklogDismissState(userId: string, state: RobotBacklogDismissState): void {
  pushDismissal(PREFIX, userId, state)
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(state))
  } catch {
    /* quota/private-mode: a lost dismiss just means the item reappears — never break the dashboard */
  }
}

export function shouldShowRobotBacklog(count: number | null, state: RobotBacklogDismissState, now: number = Date.now()): boolean {
  if (count === null || count <= 0) return false
  if (state.snoozeUntil !== undefined && now < state.snoozeUntil) return false
  if (state.dismissedCount !== undefined && count <= state.dismissedCount) return false
  return true
}
