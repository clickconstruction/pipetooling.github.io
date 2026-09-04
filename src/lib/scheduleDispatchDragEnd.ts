import type { DragEndEvent } from '@dnd-kit/core'
import {
  fetchScheduleBlocksForAssigneesOnDay,
  moveJobScheduleBlockGroupViaRpc,
  updateJobScheduleBlock,
  type JobScheduleBlockRow,
} from './jobScheduleBlocks'
import { scheduleBlockToRange, scheduleOverlapsAny } from './jobScheduleOverlap'
import { parseScheduleDispatchCellDroppableId } from './scheduleDispatchDnd'

/** Rows sharing the same non-null `shared_block_group_id` within `blockById` (loaded week scope). */
export function scheduleBlockGroupPeerCountInMap(
  block: JobScheduleBlockRow,
  blockById: Map<string, JobScheduleBlockRow>,
): number {
  const g = block.shared_block_group_id
  if (g == null || g === '') return 0
  let n = 0
  for (const b of blockById.values()) {
    if (b.shared_block_group_id === g) n += 1
  }
  return n
}

function blockHasLinkedGroup(block: JobScheduleBlockRow): boolean {
  const g = block.shared_block_group_id
  return g != null && String(g).trim() !== ''
}

export type ScheduleDispatchDragShowToast = (
  message: string,
  type?: 'info' | 'warning' | 'error' | 'success',
) => void

export type ScheduleDispatchMoveTarget = { workDate: string; assigneeUserId: string }

export type ScheduleDispatchMoveDeps = {
  blockById: Map<string, JobScheduleBlockRow>
  canEdit: boolean
  showToast: ScheduleDispatchDragShowToast
  onSuccess: () => Promise<void>
}

/**
 * Drop handler for the schedule grids: decodes the cell the block landed on
 * and hands off to `moveScheduleDispatchBlockTo`, so a drag, a tap-to-move
 * placement, and the Move sheet all put a block somewhere through one path.
 */
export async function executeScheduleDispatchBlockReassign(
  event: DragEndEvent,
  deps: ScheduleDispatchMoveDeps,
): Promise<void> {
  if (!deps.canEdit) return
  const { active, over } = event
  if (!over) return
  const parsed = parseScheduleDispatchCellDroppableId(over.id)
  if (!parsed) return
  await moveScheduleDispatchBlockTo(String(active.id), parsed, deps)
}

/**
 * Put `blockId` on `target` (a person + day). Linked crew blocks move as a
 * group when the day changes and re-home just this person's copy when only
 * the person changes; solo blocks patch in place. Every path runs the
 * same-person-same-day overlap check. Resolves `true` only when something
 * was written and `onSuccess` ran; errors surface through `showToast`.
 */
export async function moveScheduleDispatchBlockTo(
  blockId: string,
  target: ScheduleDispatchMoveTarget,
  deps: ScheduleDispatchMoveDeps,
): Promise<boolean> {
  if (!deps.canEdit) return false
  const block = deps.blockById.get(blockId)
  if (!block) return false

  if (blockHasLinkedGroup(block)) {
    const gid = String(block.shared_block_group_id)
    if (block.work_date === target.workDate) {
      if (block.assignee_user_id === target.assigneeUserId) return false
      const excludeIds = [blockId]
      for (const row of deps.blockById.values()) {
        if (
          row.id !== blockId &&
          row.shared_block_group_id === gid &&
          row.work_date === block.work_date &&
          row.job_id === block.job_id &&
          row.assignee_user_id === target.assigneeUserId
        ) {
          excludeIds.push(row.id)
        }
      }
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
        [target.assigneeUserId],
        target.workDate,
      )
      if (dayErr) {
        deps.showToast(dayErr, 'error')
        return false
      }
      const candidate = scheduleBlockToRange(block.time_start, block.time_end)
      if (scheduleOverlapsAny(candidate, dayBlocks, excludeIds)) {
        deps.showToast('That time overlaps another block for this person on this day.', 'error')
        return false
      }
      const { error: upErr } = await updateJobScheduleBlock(blockId, {
        assignee_user_id: target.assigneeUserId,
      })
      if (upErr) {
        deps.showToast(upErr, 'error')
        return false
      }
      await deps.onSuccess()
      return true
    }
    const { error: rpcErr } = await moveJobScheduleBlockGroupViaRpc(block.job_id, gid, target.workDate)
    if (rpcErr) {
      deps.showToast(rpcErr, 'error')
      return false
    }
    await deps.onSuccess()
    return true
  }

  const patch: {
    assignee_user_id?: string
    work_date?: string
  } = {}
  if (block.assignee_user_id !== target.assigneeUserId) {
    patch.assignee_user_id = target.assigneeUserId
  }
  if (block.work_date !== target.workDate) {
    patch.work_date = target.workDate
  }
  if (Object.keys(patch).length === 0) return false

  const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
    [target.assigneeUserId],
    target.workDate,
  )
  if (dayErr) {
    deps.showToast(dayErr, 'error')
    return false
  }
  const candidate = scheduleBlockToRange(block.time_start, block.time_end)
  if (scheduleOverlapsAny(candidate, dayBlocks, [blockId])) {
    deps.showToast('That time overlaps another block for this person on this day.', 'error')
    return false
  }
  const { error: upErr } = await updateJobScheduleBlock(blockId, patch)
  if (upErr) {
    deps.showToast(upErr, 'error')
    return false
  }
  await deps.onSuccess()
  return true
}
