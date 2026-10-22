import { pushDismissal } from './dismissalStore'

/**
 * Snooze / dismiss state for the owner's "The robots have not made a round" Needs You item
 * (Robot rounds PR 4, punch list #142). Mirrors robotBacklogDismiss.ts: snooze 24h, or dismiss
 * until the next round (the fleet's last call moves). Per device.
 */
const PREFIX = 'pipetooling.robotSilence.'

export type RobotSilenceDismissState = {
  /** Hide while the fleet's newest call is still this one. */
  dismissedSeenAt?: string
  /** Hide until this timestamp (ms since epoch). */
  snoozeUntil?: number
}

export function loadRobotSilenceDismissState(userId: string): RobotSilenceDismissState {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return {}
    return JSON.parse(raw) as RobotSilenceDismissState
  } catch {
    return {}
  }
}

export function saveRobotSilenceDismissState(userId: string, state: RobotSilenceDismissState): void {
  pushDismissal(PREFIX, userId, state)
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(state))
  } catch {
    /* quota/private-mode: a lost dismiss just means the item reappears */
  }
}

export function shouldShowRobotSilence(state: RobotSilenceDismissState, lastSeenAt: string | null, nowMs: number): boolean {
  if (state.snoozeUntil != null && nowMs < state.snoozeUntil) return false
  if (state.dismissedSeenAt && lastSeenAt && state.dismissedSeenAt === lastSeenAt) return false
  return true
}
