import {
  fetchJobScheduleBlockGroupLegs,
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
  moveJobScheduleBlockGroupViaRpc,
  newJobScheduleSharedBlockGroupId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
} from './jobScheduleBlocks'
import {
  MIN_MIN,
  MAX_MIN,
  timeInputToPg,
} from './dispatchAddBlockTime'
import {
  scheduleBlockToRange,
  scheduleHasInternalOverlap,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from './jobScheduleOverlap'
import { virtualDayBlocksForOverlap } from './scheduleDispatchAddBlockTimeline'

function validateAddRange(timeStart: string, timeEnd: string): string | null {
  const ts = timeInputToPg(timeStart)
  const te = timeInputToPg(timeEnd)
  const sm = scheduleTimeToMinutesFromMidnight(ts)
  const em = scheduleTimeToMinutesFromMidnight(te)
  return validateJobScheduleBlockMinuteRange({
    startMin: sm,
    endMin: em,
    minWallMin: MIN_MIN,
    maxWallMin: MAX_MIN,
  })
}

/**
 * Error surfaced when a linked group spans more than one day and the caller
 * asked to move it. `move_job_schedule_block_group` keys on (job, group) with
 * no date predicate, so it would drag every day of the group onto one date —
 * and multi-day groups are routine since "Add person to crew" (v2.1371) writes
 * one leg per distinct job/date/window.
 */
export const SCHEDULE_MULTI_DAY_GROUP_MOVE_ERROR =
  'This crew block is scheduled across several days, so it can’t be moved from here. Open the linked crew to change its days.'

/**
 * Edit an existing block's start/end/note, and optionally move it to another
 * day. Linked blocks (shared `shared_block_group_id`) move every leg together —
 * each leg's assignee is overlap-checked against their other blocks on the
 * *target* day before any write. Times arrive in "HH:mm" input form; the
 * fresh-fetched legs are the authority (not caller state), so stale UI can't
 * skip a leg's overlap check.
 *
 * `newWorkDate` omitted, blank, or equal to `workDate` keeps the pre-existing
 * behavior exactly — no day move is attempted and no extra query runs.
 */
export async function saveEditedScheduleBlockTimes(params: {
  blockId: string
  jobId: string
  assigneeUserId: string
  workDate: string
  sharedBlockGroupId: string | null
  timeStart: string
  timeEnd: string
  note: string
  newWorkDate?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateAddRange(params.timeStart, params.timeEnd)
  if (v) return { ok: false, error: v }

  const requestedDate = (params.newWorkDate ?? '').trim()
  const targetDate = requestedDate || params.workDate
  const movingDay = targetDate !== params.workDate

  const ts = timeInputToPg(params.timeStart)
  const te = timeInputToPg(params.timeEnd)
  const candidate = scheduleBlockToRange(ts, te)
  const noteVal = params.note.trim() || null

  if (params.sharedBlockGroupId) {
    const { data: legs, error: legsErr } = await fetchJobScheduleBlockGroupLegs(
      params.jobId,
      params.sharedBlockGroupId,
    )
    if (legsErr) return { ok: false, error: legsErr }

    if (movingDay) {
      const distinctDays = new Set(legs.map((l) => l.work_date))
      if (distinctDays.size > 1) {
        return { ok: false, error: SCHEDULE_MULTI_DAY_GROUP_MOVE_ERROR }
      }
    }

    const assigneeIds = [...new Set(legs.map((l) => l.assignee_user_id))]
    if (assigneeIds.length === 0) assigneeIds.push(params.assigneeUserId)
    for (const uid of assigneeIds) {
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
        [uid],
        targetDate,
      )
      if (dayErr) return { ok: false, error: dayErr }
      const excludeIds = legs.filter((l) => l.assignee_user_id === uid).map((l) => l.id)
      if (excludeIds.length === 0) excludeIds.push(params.blockId)
      if (scheduleOverlapsAny(candidate, dayBlocks, excludeIds)) {
        return { ok: false, error: 'That time overlaps another block for this person on this day.' }
      }
    }

    // Move first: the RPC re-checks overlap under a row lock, so a day that
    // filled up between the read above and the write still fails safely.
    if (movingDay) {
      const { error: moveErr } = await moveJobScheduleBlockGroupViaRpc(
        params.jobId,
        params.sharedBlockGroupId,
        targetDate,
      )
      if (moveErr) return { ok: false, error: moveErr }
    }

    const { error: upErr } = await updateJobScheduleBlockGroup(params.jobId, params.sharedBlockGroupId, {
      time_start: ts,
      time_end: te,
      note: noteVal,
    })
    if (upErr) return { ok: false, error: upErr }
    return { ok: true }
  }

  const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
    [params.assigneeUserId],
    targetDate,
  )
  if (dayErr) return { ok: false, error: dayErr }
  if (scheduleOverlapsAny(candidate, dayBlocks, [params.blockId])) {
    return { ok: false, error: 'That time overlaps another block for this person on this day.' }
  }
  const { error: upErr } = await updateJobScheduleBlock(params.blockId, {
    time_start: ts,
    time_end: te,
    note: noteVal,
    ...(movingDay ? { work_date: targetDate } : {}),
  })
  if (upErr) return { ok: false, error: upErr }
  return { ok: true }
}

export async function saveNewScheduleBlockForPersonDay(params: {
  authUserId: string
  assigneeUserId: string
  workDate: string
  targetJobId: string
  addTimeStart: string
  addTimeEnd: string
  addNote: string
  addBlockDraftByBlockId: Record<string, { time_start: string; time_end: string }>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateAddRange(params.addTimeStart, params.addTimeEnd)
  if (v) return { ok: false, error: v }

  const ts = timeInputToPg(params.addTimeStart)
  const te = timeInputToPg(params.addTimeEnd)
  const candidate = scheduleBlockToRange(ts, te)
  const noteVal = params.addNote.trim() || null

  const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
    [params.assigneeUserId],
    params.workDate,
  )
  if (dayErr) return { ok: false, error: dayErr }

  const virtualBlocks = virtualDayBlocksForOverlap(dayBlocks, params.addBlockDraftByBlockId)
  if (scheduleHasInternalOverlap(virtualBlocks)) {
    return {
      ok: false,
      error: 'Draft block moves overlap each other or leave invalid gaps for this person.',
    }
  }
  if (scheduleOverlapsAny(candidate, virtualBlocks, undefined)) {
    return { ok: false, error: 'That time overlaps another block for this person on this day.' }
  }

  const processedGroup = new Set<string>()
  const groupPatches: Array<{
    jobId: string
    groupId: string
    time_start: string
    time_end: string
    note: string | null
  }> = []
  const soloPatches: Array<{ id: string; time_start: string; time_end: string }> = []

  for (const row of dayBlocks) {
    const d = params.addBlockDraftByBlockId[row.id]
    if (!d) continue
    const dts = timeInputToPg(d.time_start)
    const dte = timeInputToPg(d.time_end)
    if (dts === row.time_start && dte === row.time_end) continue
    const gid = row.shared_block_group_id
    if (gid) {
      if (processedGroup.has(gid)) continue
      processedGroup.add(gid)
      const legWithDraft =
        dayBlocks.find((b) => b.shared_block_group_id === gid && params.addBlockDraftByBlockId[b.id]) ?? row
      const d0 = params.addBlockDraftByBlockId[legWithDraft.id]
      if (!d0) continue
      const noteLeg = dayBlocks.find((b) => b.shared_block_group_id === gid) ?? row
      groupPatches.push({
        jobId: legWithDraft.job_id,
        groupId: gid,
        time_start: timeInputToPg(d0.time_start),
        time_end: timeInputToPg(d0.time_end),
        note: noteLeg.note ?? null,
      })
    } else {
      soloPatches.push({ id: row.id, time_start: dts, time_end: dte })
    }
  }

  for (const p of groupPatches) {
    const { error: upErr } = await updateJobScheduleBlockGroup(p.jobId, p.groupId, {
      time_start: p.time_start,
      time_end: p.time_end,
      note: p.note,
    })
    if (upErr) return { ok: false, error: upErr }
  }
  for (const p of soloPatches) {
    const { error: upErr } = await updateJobScheduleBlock(p.id, {
      time_start: p.time_start,
      time_end: p.time_end,
    })
    if (upErr) return { ok: false, error: upErr }
  }

  const { error: insErr } = await insertJobScheduleBlock({
    job_id: params.targetJobId,
    assignee_user_id: params.assigneeUserId,
    work_date: params.workDate,
    time_start: ts,
    time_end: te,
    note: noteVal,
    created_by: params.authUserId,
    shared_block_group_id: newJobScheduleSharedBlockGroupId(),
  })
  if (insErr) return { ok: false, error: insErr }

  return { ok: true }
}
