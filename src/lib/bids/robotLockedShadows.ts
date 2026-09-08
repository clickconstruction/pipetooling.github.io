import type { ShadowRunRow } from './shadowStory'

/**
 * A robot shadow that has sealed its number on a live bid (v2.3126): the twin
 * locked blind, our bid has not gone out yet, so the scorecard is waiting on
 * our Send. The Dashboard's Needs-you card shows these as a head start — no
 * action, just the fact that the robot already has a number down.
 */
export type RobotLockedShadow = {
  shadowBid: string
  referenceBid: string
  project: string | null
  lockedAt: string
  teacher: string | null
}

/** How far back a sealed shadow still counts as "live" on the card. */
export const ROBOT_LOCKED_SHADOW_WINDOW_DAYS = 14

/**
 * Pure selection over `list_shadow_runs()` rows: status 'locked', reference
 * not yet sent, locked within the window, newest lock first. Rows missing a
 * lock time or a bid number are dropped (nothing to name on the card).
 */
export function selectRobotLockedShadows(
  rows: ReadonlyArray<Pick<ShadowRunRow, 'status' | 'locked_at' | 'shadow_bid_number' | 'reference_bid_number' | 'project_name' | 'reference_sent_at' | 'teacher_name'>>,
  now: Date = new Date(),
): RobotLockedShadow[] {
  const floor = now.getTime() - ROBOT_LOCKED_SHADOW_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return rows
    .filter((r) => r.status === 'locked' && r.reference_sent_at == null && r.locked_at != null && r.shadow_bid_number && r.reference_bid_number)
    .filter((r) => {
      const t = Date.parse(r.locked_at as string)
      return Number.isFinite(t) && t >= floor
    })
    .map((r) => ({
      shadowBid: r.shadow_bid_number as string,
      referenceBid: r.reference_bid_number as string,
      project: r.project_name ?? null,
      lockedAt: r.locked_at as string,
      teacher: r.teacher_name ?? null,
    }))
    .sort((a, b) => Date.parse(b.lockedAt) - Date.parse(a.lockedAt))
}
