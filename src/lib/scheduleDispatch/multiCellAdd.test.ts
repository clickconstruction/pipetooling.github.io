import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchScheduleBlocksForAssigneesOnDay: vi.fn(),
  insertJobScheduleBlock: vi.fn(),
  newJobScheduleSharedBlockGroupId: vi.fn(),
}))
vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../jobScheduleBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../jobScheduleBlocks')>()),
  ...mocks,
}))

import { hubPersonDayKey } from '../scheduleDispatchHub'
import {
  MULTI_CELL_ADD_TIME_END,
  MULTI_CELL_ADD_TIME_START,
  addJobToHubCells,
  summarizeMultiCellAddResult,
} from './multiCellAdd'

const none = { added: 0, skippedOverlap: 0, failed: 0 }

describe('summarizeMultiCellAddResult', () => {
  it('counts the blocks it added, one or many', () => {
    expect(summarizeMultiCellAddResult({ ...none, added: 1 })).toEqual({ message: 'Added 1 block.', tone: 'success' })
    expect(summarizeMultiCellAddResult({ ...none, added: 4 })).toEqual({ message: 'Added 4 blocks.', tone: 'success' })
  })

  it('names all three outcomes in order: added, skipped, failed', () => {
    expect(summarizeMultiCellAddResult({ added: 3, skippedOverlap: 1, failed: 2 })).toEqual({
      message: 'Added 3 blocks. Skipped 1 (overlap). 2 failed.',
      tone: 'success',
    })
  })

  it('reads as a success whenever anything was added, whatever else happened', () => {
    expect(summarizeMultiCellAddResult({ added: 1, skippedOverlap: 0, failed: 5 })).toEqual({
      message: 'Added 1 block. 5 failed.',
      tone: 'success',
    })
    expect(summarizeMultiCellAddResult({ added: 1, skippedOverlap: 5, failed: 0 })).toEqual({
      message: 'Added 1 block. Skipped 5 (overlap).',
      tone: 'success',
    })
  })

  it('reads as an error when nothing was added and something failed', () => {
    expect(summarizeMultiCellAddResult({ ...none, failed: 2 })).toEqual({ message: '2 failed.', tone: 'error' })
    expect(summarizeMultiCellAddResult({ added: 0, skippedOverlap: 3, failed: 1 })).toEqual({
      message: 'Skipped 3 (overlap). 1 failed.',
      tone: 'error',
    })
  })

  it('reads as plain information when every cell was skipped', () => {
    expect(summarizeMultiCellAddResult({ ...none, skippedOverlap: 2 })).toEqual({
      message: 'Skipped 2 (overlap).',
      tone: 'info',
    })
  })

  it('says "No blocks added." when nothing happened at all', () => {
    expect(summarizeMultiCellAddResult(none)).toEqual({ message: 'No blocks added.', tone: 'info' })
  })

  it('does not pluralize the skipped or failed counts', () => {
    expect(summarizeMultiCellAddResult({ added: 0, skippedOverlap: 1, failed: 1 }).message).toBe(
      'Skipped 1 (overlap). 1 failed.',
    )
  })
})

describe('addJobToHubCells', () => {
  const cell = (userId: string, ymd: string) => hubPersonDayKey(userId, ymd)
  const existing = (time_start: string, time_end: string) => ({ id: 'x', time_start, time_end })
  const run = (selectionKeys: string[], targetJobId = 'job-1') =>
    addJobToHubCells({ targetJobId, selectionKeys, createdBy: 'taunya' })

  let nextGroup = 0
  beforeEach(() => {
    nextGroup = 0
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockReset().mockResolvedValue({ data: [], error: null })
    mocks.insertJobScheduleBlock.mockReset().mockResolvedValue({ data: null, error: null })
    mocks.newJobScheduleSharedBlockGroupId.mockReset().mockImplementation(() => `grp-${++nextGroup}`)
  })

  it('writes an 8-to-4 block with no note on the cell', async () => {
    expect(await run([cell('abraham', '2026-09-28')])).toEqual({ added: 1, skippedOverlap: 0, failed: 0 })
    expect(mocks.insertJobScheduleBlock).toHaveBeenCalledWith({
      job_id: 'job-1',
      bid_id: null,
      assignee_user_id: 'abraham',
      work_date: '2026-09-28',
      time_start: '08:00:00',
      time_end: '16:00:00',
      note: null,
      created_by: 'taunya',
      shared_block_group_id: 'grp-1',
    })
    expect([MULTI_CELL_ADD_TIME_START, MULTI_CELL_ADD_TIME_END]).toEqual(['08:00', '16:00'])
  })

  it('writes a bid visit onto the bid', async () => {
    await run([cell('abraham', '2026-09-28')], 'bid:bid-9')
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({ job_id: null, bid_id: 'bid-9' })
  })

  it('gives each block a group of its own — the selection is not linked together', async () => {
    await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-28'), cell('abraham', '2026-09-29')])
    expect(mocks.insertJobScheduleBlock.mock.calls.map((c) => c[0].shared_block_group_id)).toEqual([
      'grp-1',
      'grp-2',
      'grp-3',
    ])
  })

  it('reads each person on each day before it writes', async () => {
    await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-29')])
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay.mock.calls).toEqual([
      [['abraham'], '2026-09-28'],
      [['paige'], '2026-09-29'],
    ])
  })

  it('skips a cell whose person already has something in the window, and writes the rest', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockImplementation(async (ids: string[]) => ({
      data: ids[0] === 'paige' ? [existing('15:00:00', '17:00:00')] : [],
      error: null,
    }))
    expect(await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-28'), cell('cruz', '2026-09-28')])).toEqual({
      added: 2,
      skippedOverlap: 1,
      failed: 0,
    })
    expect(mocks.insertJobScheduleBlock.mock.calls.map((c) => c[0].assignee_user_id)).toEqual(['abraham', 'cruz'])
  })

  it('does not count a block that only touches the window as an overlap', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValue({
      data: [existing('06:00:00', '08:00:00'), existing('16:00:00', '18:00:00')],
      error: null,
    })
    expect(await run([cell('abraham', '2026-09-28')])).toEqual({ added: 1, skippedOverlap: 0, failed: 0 })
  })

  it('counts a cell it cannot read as failed, writes nothing there, and goes on', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay
      .mockResolvedValueOnce({ data: [], error: 'network down' })
      .mockResolvedValue({ data: [], error: null })
    expect(await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-28')])).toEqual({
      added: 1,
      skippedOverlap: 0,
      failed: 1,
    })
    expect(mocks.insertJobScheduleBlock.mock.calls.map((c) => c[0].assignee_user_id)).toEqual(['paige'])
  })

  it('counts a refused insert as failed and goes on', async () => {
    mocks.insertJobScheduleBlock
      .mockResolvedValueOnce({ data: null, error: 'permission denied' })
      .mockResolvedValue({ data: null, error: null })
    expect(await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-28')])).toEqual({
      added: 1,
      skippedOverlap: 0,
      failed: 1,
    })
  })

  it('counts a key it cannot parse as failed without reading or writing', async () => {
    expect(await run(['not a cell', '\t2026-09-28'])).toEqual({ added: 0, skippedOverlap: 0, failed: 2 })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('works the cells one at a time, in selection order', async () => {
    const order: string[] = []
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockImplementation(async (ids: string[]) => {
      order.push(`read ${ids[0]}`)
      return { data: [], error: null }
    })
    mocks.insertJobScheduleBlock.mockImplementation(async (row: { assignee_user_id: string }) => {
      order.push(`write ${row.assignee_user_id}`)
      return { data: null, error: null }
    })
    await run([cell('paige', '2026-09-28'), cell('abraham', '2026-09-28')])
    expect(order).toEqual(['read paige', 'write paige', 'read abraham', 'write abraham'])
  })

  it('does nothing for an empty selection', async () => {
    expect(await run([])).toEqual({ added: 0, skippedOverlap: 0, failed: 0 })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).not.toHaveBeenCalled()
  })

  it('hands its counts straight to the summary', async () => {
    mocks.insertJobScheduleBlock.mockResolvedValueOnce({ data: null, error: 'permission denied' })
    const counts = await run([cell('abraham', '2026-09-28'), cell('paige', '2026-09-28')])
    expect(summarizeMultiCellAddResult(counts)).toEqual({ message: 'Added 1 block. 1 failed.', tone: 'success' })
  })
})
