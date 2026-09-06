/**
 * "You are here" ordering for the Dispatch-schedule quick picks in the Update
 * Focus and Clock Out review modals (J2-F9).
 *
 * `buildDispatchScheduledJobsForAssign` sorts today's picks by job number
 * descending, so the job the tech is currently clocked into landed wherever its
 * number fell — usually last — and rendered only as the greyed "selected" row,
 * which read as disabled. This kernel puts the current job first and flags it so
 * the row can carry an explicit label; every other pick keeps its incoming order.
 *
 * Pure and shape-agnostic: anything with a `jobId` works.
 */

export const YOU_ARE_HERE_LABEL = 'You are here'

export type ScheduledPickWithHere<T> = {
  pick: T
  /** True for the pick matching the open session's job — rendered first with the label. */
  isCurrent: boolean
}

export function orderScheduledPicksCurrentFirst<T extends { jobId: string }>(
  picks: readonly T[],
  currentJobId: string | null | undefined,
): ScheduledPickWithHere<T>[] {
  if (!currentJobId) return picks.map((pick) => ({ pick, isCurrent: false }))
  const current: ScheduledPickWithHere<T>[] = []
  const rest: ScheduledPickWithHere<T>[] = []
  for (const pick of picks) {
    if (pick.jobId === currentJobId) current.push({ pick, isCurrent: true })
    else rest.push({ pick, isCurrent: false })
  }
  return [...current, ...rest]
}
