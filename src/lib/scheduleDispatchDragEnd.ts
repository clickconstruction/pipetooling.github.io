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

export async function executeScheduleDispatchBlockReassign(
  event: DragEndEvent,
  deps: {
    blockById: Map<string, JobScheduleBlockRow>
    canEdit: boolean
    showToast: ScheduleDispatchDragShowToast
    onSuccess: () => Promise<void>
  },
): Promise<void> {
  if (!deps.canEdit) return
  const { active, over } = event
  if (!over) return
  const parsed = parseScheduleDispatchCellDroppableId(over.id)
  if (!parsed) return
  const blockId = String(active.id)
  const block = deps.blockById.get(blockId)
  if (!block) return

  if (blockHasLinkedGroup(block)) {
    const gid = String(block.shared_block_group_id)
    if (block.work_date === parsed.workDate) {
      if (block.assignee_user_id === parsed.assigneeUserId) return
      const excludeIds = [blockId]
      for (const row of deps.blockById.values()) {
        if (
          row.id !== blockId &&
          row.shared_block_group_id === gid &&
          row.work_date === block.work_date &&
          row.job_id === block.job_id &&
          row.assignee_user_id === parsed.assigneeUserId
        ) {
          excludeIds.push(row.id)
        }
      }
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
        [parsed.assigneeUserId],
        parsed.workDate,
      )
      if (dayErr) {
        deps.showToast(dayErr, 'error')
        return
      }
      const candidate = scheduleBlockToRange(block.time_start, block.time_end)
      if (scheduleOverlapsAny(candidate, dayBlocks, excludeIds)) {
        deps.showToast('That time overlaps another block for this person on this day.', 'error')
        return
      }
      const { error: upErr } = await updateJobScheduleBlock(blockId, {
        assignee_user_id: parsed.assigneeUserId,
      })
      if (upErr) {
        deps.showToast(upErr, 'error')
        return
      }
      await deps.onSuccess()
      return
    }
    const { error: rpcErr } = await moveJobScheduleBlockGroupViaRpc(block.job_id, gid, parsed.workDate)
    if (rpcErr) {
      deps.showToast(rpcErr, 'error')
      return
    }
    await deps.onSuccess()
    return
  }

  const patch: {
    assignee_user_id?: string
    work_date?: string
  } = {}
  if (block.assignee_user_id !== parsed.assigneeUserId) {
    patch.assignee_user_id = parsed.assigneeUserId
  }
  if (block.work_date !== parsed.workDate) {
    patch.work_date = parsed.workDate
  }
  if (Object.keys(patch).length === 0) return

  const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
    [parsed.assigneeUserId],
    parsed.workDate,
  )
  if (dayErr) {
    deps.showToast(dayErr, 'error')
    return
  }
  const candidate = scheduleBlockToRange(block.time_start, block.time_end)
  if (scheduleOverlapsAny(candidate, dayBlocks, [blockId])) {
    deps.showToast('That time overlaps another block for this person on this day.', 'error')
    return
  }
  const { error: upErr } = await updateJobScheduleBlock(blockId, patch)
  if (upErr) {
    deps.showToast(upErr, 'error')
    return
  }
  await deps.onSuccess()
}
