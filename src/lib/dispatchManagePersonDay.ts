import { timeInputToMinutesSafe } from './dispatchAddBlockTime'
import { QUICK_ASSIGN_DAY_END_MIN } from './quickAssignFreeWindows'

/**
 * Pure kernel for the Manage day modal (Assign work sheet → click a person's
 * name): summarizes one person's schedule blocks for a day into the header
 * line — "2 blocks · 6 h · free after 3:00 PM".
 */

export interface ManageDayBlockLike {
  timeStart: string
  timeEnd: string
}

export interface ManageDaySummary {
  count: number
  totalMinutes: number
  /**
   * Minute-of-day the person's last block ends, when it ends before the
   * scheduling day's end (QUICK_ASSIGN_DAY_END_MIN, 6 PM — the same scale the
   * sheet's ribbons draw on) — the header renders it as "free after X".
   * Null when nothing is scheduled or the day is booked to the end.
   */
  freeAfterMin: number | null
}

export interface CrewLegLike {
  shared_block_group_id: string | null
  /** Assignee display name (users join); null/blank legs are skipped. */
  name: string | null
}

/**
 * groupId → deduped member names in query order (v2.1601 — the linked-crew
 * chip names its crew). Legs without a group or a usable name are dropped;
 * a group whose every name is blank simply has no entry.
 */
export function crewNamesByGroup(legs: CrewLegLike[]): Map<string, string[]> {
  const byGroup = new Map<string, string[]>()
  for (const leg of legs) {
    if (!leg.shared_block_group_id) continue
    const name = (leg.name ?? '').trim()
    if (!name) continue
    const list = byGroup.get(leg.shared_block_group_id)
    if (!list) byGroup.set(leg.shared_block_group_id, [name])
    else if (!list.includes(name)) list.push(name)
  }
  return byGroup
}

export function computeManageDaySummary(blocks: ManageDayBlockLike[]): ManageDaySummary {
  let totalMinutes = 0
  let latestEnd: number | null = null
  for (const b of blocks) {
    const s = timeInputToMinutesSafe(b.timeStart)
    const e = timeInputToMinutesSafe(b.timeEnd)
    if (e > s) totalMinutes += e - s
    if (latestEnd == null || e > latestEnd) latestEnd = e
  }
  return {
    count: blocks.length,
    totalMinutes,
    freeAfterMin: latestEnd != null && latestEnd < QUICK_ASSIGN_DAY_END_MIN ? latestEnd : null,
  }
}
