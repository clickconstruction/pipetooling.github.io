/**
 * Jobs → Schedule → several people → *Add to schedule*, the split (punch list #184, sweep A,
 * PR 2). The window inserts one linked group, one row per person sharing a
 * `shared_block_group_id`, in one atomic insert so a failure never leaves half a crew. The link is
 * what keeps their times and note together afterwards; it does not need the whole pick. Legs are
 * unlinked and removed one by one elsewhere, and the Dispatch board's linked copy already skips a
 * person whose day overlaps. So a person whose day already has a block in that window is held,
 * with the block it overlaps and the door to that job, and the rest are added as the group:
 * *Add 2 to schedule · 1 held: overlaps ▸*. Before this one overlap returned before the insert
 * and nobody was scheduled.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { scheduleBlockToRange, scheduleOverlapsAny } from '../jobScheduleOverlap'
import { scheduleFormatWindow } from '../jobScheduleChicago'

/** A block already on a picked person's day (`job_schedule_blocks`, the fields the split reads). */
export type ScheduleDayBlock = { id: string; assignee_user_id: string; job_id: string | null; bid_id?: string | null; time_start: string; time_end: string }

/** A picked person held out of the add: whose, why, and the job the overlapping block is on. */
export type ScheduleAddHeld = { userId: string; name: string; why: string; otherJobId: string | null }

/** Who is added now and who is held for an overlap, in pick order. Times are Postgres `HH:MM:SS`. */
export function scheduleAddSplit(input: {
  ids: readonly string[]
  timeStart: string
  timeEnd: string
  dayBlocks: ReadonlyArray<ScheduleDayBlock>
  nameOf: (userId: string) => string
  currentJobId: string
}): { ready: string[]; held: ScheduleAddHeld[] } {
  const candidate = scheduleBlockToRange(input.timeStart, input.timeEnd)
  const ready: string[] = []
  const held: ScheduleAddHeld[] = []
  for (const uid of input.ids) {
    const theirs = input.dayBlocks.filter((b) => b.assignee_user_id === uid)
    const hit = theirs.find((b) => scheduleOverlapsAny(candidate, [b]))
    if (!hit) {
      ready.push(uid)
      continue
    }
    const onThis = hit.job_id != null && hit.job_id === input.currentJobId
    const where = onThis ? 'on this job' : hit.job_id ? 'on another job' : 'on a bid visit'
    held.push({ userId: uid, name: input.nameOf(uid), why: `overlaps ${scheduleFormatWindow(hit.time_start, hit.time_end)} ${where}`, otherJobId: onThis ? null : hit.job_id })
  }
  return { ready, held }
}

/** The button: *Add 2 to schedule · 1 held: overlaps ▸*, *Add 3 to schedule*; dead while nobody picked is free. */
export function scheduleAddWords(split: { ready: readonly string[]; held: readonly unknown[] }): BatchWords {
  if (split.ready.length === 0 && split.held.length === 0) return { button: 'Add to schedule', foot: null, dead: true }
  const w = batchWords({ verb: 'Add', noun: ['to schedule', 'to schedule'], ready: split.ready.length, held: split.held.length, heldWhy: 'held: overlaps' })
  // Every pick overlaps: the press keeps its name, dead, and the ▸ points at the held list.
  return split.ready.length === 0 ? { ...w, button: 'Add to schedule ▸' } : w
}
