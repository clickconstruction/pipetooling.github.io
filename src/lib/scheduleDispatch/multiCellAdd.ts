/**
 * The Schedule Dispatch hub's multi-cell add: one job dropped onto every
 * selected person × day cell — the writes, and what the hub says when they
 * are done.
 */
import { timeInputToPg } from '../dispatchAddBlockTime'
import {
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
  scheduleBlockAnchorFromId,
} from '../jobScheduleBlocks'
import { scheduleBlockToRange, scheduleOverlapsAny } from '../jobScheduleOverlap'
import { parseHubPersonDayKey } from '../scheduleDispatchHub'

/** Every block a multi-cell add writes has this window; the person's own times are set afterwards. */
export const MULTI_CELL_ADD_TIME_START = '08:00'
export const MULTI_CELL_ADD_TIME_END = '16:00'

export type MultiCellAddCounts = {
  /** Cells that got a block. */
  added: number
  /** Cells left alone because the person already had something in that window. */
  skippedOverlap: number
  /** Cells that could not be read or written, or whose key could not be parsed. */
  failed: number
}

export type MultiCellAddSummary = {
  message: string
  tone: 'success' | 'error' | 'info'
}

/**
 * One toast for the whole selection: "Added 3 blocks. Skipped 1 (overlap). 2 failed."
 * — each part only when it happened. It reads as a success whenever anything
 * was added, as an error when nothing was and something failed, and as plain
 * information when every cell was skipped or there was nothing to do.
 */
export function summarizeMultiCellAddResult(counts: MultiCellAddCounts): MultiCellAddSummary {
  const { added, skippedOverlap, failed } = counts
  const parts: string[] = []
  if (added > 0) parts.push(`Added ${added} block${added === 1 ? '' : 's'}`)
  if (skippedOverlap > 0) parts.push(`Skipped ${skippedOverlap} (overlap)`)
  if (failed > 0) parts.push(`${failed} failed`)
  return {
    message: parts.length > 0 ? `${parts.join('. ')}.` : 'No blocks added.',
    tone: added > 0 ? 'success' : failed > 0 ? 'error' : 'info',
  }
}

/**
 * Put `targetJobId` (a job uuid or a `bid:<uuid>` anchor) on every selected
 * cell, one cell at a time in selection order. A cell whose person already has
 * something in the window is skipped, not failed; a cell that cannot be read,
 * written or parsed is counted and the rest still run. Each block gets a group
 * of its own — the selection is not linked together.
 */
export async function addJobToHubCells(args: {
  targetJobId: string
  selectionKeys: readonly string[]
  createdBy: string
}): Promise<MultiCellAddCounts> {
  const { targetJobId, selectionKeys, createdBy } = args
  const ts = timeInputToPg(MULTI_CELL_ADD_TIME_START)
  const te = timeInputToPg(MULTI_CELL_ADD_TIME_END)
  const candidate = scheduleBlockToRange(ts, te)

  let added = 0
  let skippedOverlap = 0
  let failed = 0

  for (const key of selectionKeys) {
    const parsed = parseHubPersonDayKey(key)
    if (!parsed) {
      failed++
      continue
    }
    const { assigneeUserId, workDate } = parsed
    const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
      [assigneeUserId],
      workDate,
    )
    if (dayErr) {
      failed++
      continue
    }
    if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
      skippedOverlap++
      continue
    }
    const { error: insErr } = await insertJobScheduleBlock({
      ...scheduleBlockAnchorFromId(targetJobId),
      assignee_user_id: assigneeUserId,
      work_date: workDate,
      time_start: ts,
      time_end: te,
      note: null,
      created_by: createdBy,
      shared_block_group_id: newJobScheduleSharedBlockGroupId(),
    })
    if (insErr) {
      failed++
    } else {
      added++
    }
  }

  return { added, skippedOverlap, failed }
}
