import {
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
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
