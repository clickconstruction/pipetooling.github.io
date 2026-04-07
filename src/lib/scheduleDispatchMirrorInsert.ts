import {
  ensureSharedBlockGroupForRow,
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
  type JobScheduleBlockRow,
} from './jobScheduleBlocks'
import { scheduleBlockToRange, scheduleOverlapsAny } from './jobScheduleOverlap'

export type ScheduleDispatchCopiedLegLinkMode = 'linked' | 'unlinked'

export type InsertScheduleDispatchCopiedLegArgs = {
  jobId: string
  createdBy: string
  source: JobScheduleBlockRow
  targetAssigneeUserId: string
  targetWorkDate: string
  linkMode: ScheduleDispatchCopiedLegLinkMode
  /** Job-scoped block list (e.g. week load) for “already in group” checks when linked. */
  allJobBlocks: JobScheduleBlockRow[]
}

/**
 * Insert a copy of `source` onto `targetAssigneeUserId` / `targetWorkDate`.
 * Linked: joins `source`’s group (after ensureSharedBlockGroupForRow when solo); unlinked: new solo row.
 */
export async function insertScheduleDispatchCopiedLeg(
  args: InsertScheduleDispatchCopiedLegArgs,
): Promise<{ error: string | null }> {
  const { jobId, createdBy, source, targetAssigneeUserId, targetWorkDate, linkMode, allJobBlocks } = args

  if (source.job_id !== jobId) {
    return { error: 'Block is not on this job.' }
  }

  if (linkMode === 'linked') {
    if (source.assignee_user_id === targetAssigneeUserId) {
      return { error: 'Pick another team member for a linked copy.' }
    }

    const gidExisting = source.shared_block_group_id
    if (gidExisting) {
      const targetInGroup = allJobBlocks.some(
        (x) => x.shared_block_group_id === gidExisting && x.assignee_user_id === targetAssigneeUserId,
      )
      if (targetInGroup) {
        return { error: 'That person is already linked to this block.' }
      }
    }

    let groupId = source.shared_block_group_id
    if (!groupId) {
      const { data: newGid, error: enErr } = await ensureSharedBlockGroupForRow(source.id)
      if (enErr || !newGid) {
        return { error: enErr ?? 'Could not link block.' }
      }
      groupId = newGid
    }

    const candidate = scheduleBlockToRange(source.time_start, source.time_end)
    const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
      [targetAssigneeUserId],
      targetWorkDate,
    )
    if (dayErr) {
      return { error: dayErr }
    }
    if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
      return { error: 'That time overlaps another block for this person on this day.' }
    }

    const { error: insErr } = await insertJobScheduleBlock({
      job_id: jobId,
      assignee_user_id: targetAssigneeUserId,
      work_date: targetWorkDate,
      time_start: source.time_start,
      time_end: source.time_end,
      note: source.note,
      created_by: createdBy,
      shared_block_group_id: groupId,
    })
    return { error: insErr }
  }

  // unlinked
  const candidate = scheduleBlockToRange(source.time_start, source.time_end)
  const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
    [targetAssigneeUserId],
    targetWorkDate,
  )
  if (dayErr) {
    return { error: dayErr }
  }
  if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
    return { error: 'That time overlaps another block for this person on this day.' }
  }

  const { error: insErr } = await insertJobScheduleBlock({
    job_id: jobId,
    assignee_user_id: targetAssigneeUserId,
    work_date: targetWorkDate,
    time_start: source.time_start,
    time_end: source.time_end,
    note: source.note,
    created_by: createdBy,
    shared_block_group_id: null,
  })
  return { error: insErr }
}
