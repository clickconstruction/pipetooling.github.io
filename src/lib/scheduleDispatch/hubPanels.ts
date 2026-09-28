/**
 * What the Schedule Dispatch hub's Jobs and People tabs list for a search,
 * and the People tab's count of cards with no job instructions.
 */
import type { DispatchNoteRequirement } from '../dispatchNoteRequirements'
import { personMatchesLaneQuery } from '../dispatchSwimLaneSections'
import type { DispatchSwimLanesData } from '../dispatchSwimLanes'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../jobScheduleBlocks'
import { hubPersonDayKey } from '../scheduleDispatchHub'

/**
 * Jobs tab, job rows: the search reads the HCP number, the job name and the
 * identity line; "only with blocks" then drops the jobs with nothing this week.
 * With neither, the list comes back as it was handed in.
 */
export function filterHubJobsPanelRows<
  T extends { hcp_number: string | null; job_name: string | null; displayTitle: string; totalBlocks: number },
>(rows: T[], search: string, onlyWithBlocks: boolean): T[] {
  const q = search.trim().toLowerCase()
  let list = rows
  if (q) {
    list = list.filter(
      (r) =>
        (r.hcp_number ?? '').toLowerCase().includes(q) ||
        (r.job_name ?? '').toLowerCase().includes(q) ||
        r.displayTitle.toLowerCase().includes(q),
    )
  }
  if (onlyWithBlocks) {
    list = list.filter((r) => r.totalBlocks > 0)
  }
  return list
}

/**
 * Jobs tab, bid rows: the search reads the identity line. A bid row exists
 * only because it has a block, so "only with blocks" does not apply.
 */
export function filterHubJobsPanelBidRows<T extends { displayTitle: string }>(bidRows: T[], search: string): T[] {
  const q = search.trim().toLowerCase()
  if (!q) return bidRows
  return bidRows.filter((r) => r.displayTitle.toLowerCase().includes(q))
}

/** People tab, first pass: everyone, or only the people with a block this week. */
export function filterHubPeopleWithBlocks<T extends { userId: string }>(
  allPeopleRows: T[],
  onlyWithBlocksThisWeek: boolean,
  userIdsWithBlocksThisWeek: ReadonlySet<string>,
): T[] {
  if (!onlyWithBlocksThisWeek) return allPeopleRows
  return allPeopleRows.filter((row) => userIdsWithBlocksThisWeek.has(row.userId))
}

export type HubPeopleSearchContext = {
  visibleDayKeys: readonly string[]
  personDayBlocks: ReadonlyMap<string, readonly JobScheduleBlockRow[]>
  getJobDisplayTitle: (anchorId: string) => string
  swimLanes?: DispatchSwimLanesData | null
}

/**
 * People tab, second pass: a person stays when the search is in their name,
 * in their crew's name, or in the title of a job or bid they are on in a
 * visible day.
 */
export function filterHubPeopleBySearch<T extends { userId: string; displayName: string }>(
  rows: T[],
  search: string,
  ctx: HubPeopleSearchContext,
): T[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    if (row.displayName.toLowerCase().includes(q)) return true
    if (ctx.swimLanes && personMatchesLaneQuery(row.userId, q, ctx.swimLanes)) return true
    for (const dk of ctx.visibleDayKeys) {
      const blocks = ctx.personDayBlocks.get(hubPersonDayKey(row.userId, dk)) ?? []
      for (const b of blocks) {
        if (ctx.getJobDisplayTitle(scheduleBlockAnchorId(b)).toLowerCase().includes(q)) return true
      }
    }
    return false
  })
}

/**
 * Cards on `dayYmd` with no job instructions, among the people listed. A past
 * day counts nothing — history never lights up — and so does a block whose
 * person or job is set to skip the note.
 */
export function countBlocksMissingNoteForDay(
  dayYmd: string,
  todayYmd: string,
  people: readonly { userId: string }[],
  personDayBlocks: ReadonlyMap<string, readonly Pick<JobScheduleBlockRow, 'note' | 'job_id'>[]>,
  requirementForBlock: (input: {
    userId: string | null | undefined
    jobId: string | null | undefined
  }) => DispatchNoteRequirement,
): number {
  if (!dayYmd) return 0
  if (dayYmd < todayYmd) return 0
  let n = 0
  for (const person of people) {
    const blocks = personDayBlocks.get(hubPersonDayKey(person.userId, dayYmd)) ?? []
    for (const b of blocks) {
      if (b.note) continue
      const req = requirementForBlock({
        userId: person.userId,
        jobId: b.job_id,
      })
      if (req === 'skip') continue
      n++
    }
  }
  return n
}
