import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every copy the hub writes — Copy, linked copy, Copy to techs — goes through
 * `insertScheduleDispatchCopiedLeg`. Pins what it refuses, the order it reads
 * and writes in, and the row it inserts.
 */
const mocks = vi.hoisted(() => ({
  ensureSharedBlockGroupForRow: vi.fn(),
  fetchScheduleBlocksForAssigneesOnDay: vi.fn(),
  insertJobScheduleBlock: vi.fn(),
}))
vi.mock('./supabase', () => ({ supabase: {} }))
vi.mock('./jobScheduleBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./jobScheduleBlocks')>()),
  ...mocks,
}))

import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import { insertScheduleDispatchCopiedLeg } from './scheduleDispatchMirrorInsert'

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk-1',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: '2026-09-28',
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: 'Set the water heater',
    shared_block_group_id: null,
    created_by: 'taunya',
    created_at: '2026-09-25T15:00:00Z',
    updated_at: '2026-09-25T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
    ...over,
  }
}

function args(over: Partial<Parameters<typeof insertScheduleDispatchCopiedLeg>[0]> = {}) {
  return {
    jobId: 'job-1',
    createdBy: 'taunya',
    source: block(),
    targetAssigneeUserId: 'paige',
    targetWorkDate: '2026-09-28',
    linkMode: 'unlinked' as const,
    allJobBlocks: [],
    ...over,
  }
}

beforeEach(() => {
  mocks.ensureSharedBlockGroupForRow.mockReset().mockResolvedValue({ data: 'grp-new', error: null })
  mocks.fetchScheduleBlocksForAssigneesOnDay.mockReset().mockResolvedValue({ data: [], error: null })
  mocks.insertJobScheduleBlock.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('insertScheduleDispatchCopiedLeg — what it refuses before reading anything', () => {
  it('refuses a source block that is on another job', async () => {
    const r = await insertScheduleDispatchCopiedLeg(args({ jobId: 'job-2' }))
    expect(r).toEqual({ error: 'Block is not on this job.' })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('refuses a job id for a bid block, and a bid anchor for a job block', async () => {
    const bidBlock = block({ job_id: null, bid_id: 'bid-9' })
    expect(await insertScheduleDispatchCopiedLeg(args({ source: bidBlock, jobId: 'bid-9' }))).toEqual({
      error: 'Block is not on this job.',
    })
    expect(await insertScheduleDispatchCopiedLeg(args({ jobId: 'bid:job-1' }))).toEqual({
      error: 'Block is not on this job.',
    })
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('refuses a linked copy onto the person the block already belongs to', async () => {
    const r = await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked', targetAssigneeUserId: 'abraham' }))
    expect(r).toEqual({ error: 'Pick another team member for a linked copy.' })
    expect(mocks.ensureSharedBlockGroupForRow).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('refuses a linked copy onto someone already in the group', async () => {
    const source = block({ shared_block_group_id: 'grp-1' })
    const r = await insertScheduleDispatchCopiedLeg(
      args({
        linkMode: 'linked',
        source,
        allJobBlocks: [source, block({ id: 'blk-2', assignee_user_id: 'paige', shared_block_group_id: 'grp-1' })],
      }),
    )
    expect(r).toEqual({ error: 'That person is already linked to this block.' })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('reads membership from the group id, not from the person alone', async () => {
    const source = block({ shared_block_group_id: 'grp-1' })
    const r = await insertScheduleDispatchCopiedLeg(
      args({
        linkMode: 'linked',
        source,
        allJobBlocks: [source, block({ id: 'blk-2', assignee_user_id: 'paige', shared_block_group_id: 'grp-other' })],
      }),
    )
    expect(r).toEqual({ error: null })
    expect(mocks.insertJobScheduleBlock).toHaveBeenCalledTimes(1)
  })
})

describe('insertScheduleDispatchCopiedLeg — linked', () => {
  it('gives a solo source a group, then inserts the copy into it', async () => {
    const r = await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))
    expect(r).toEqual({ error: null })
    expect(mocks.ensureSharedBlockGroupForRow).toHaveBeenCalledWith('blk-1')
    expect(mocks.insertJobScheduleBlock).toHaveBeenCalledWith({
      job_id: 'job-1',
      bid_id: null,
      assignee_user_id: 'paige',
      work_date: '2026-09-28',
      time_start: '08:00:00',
      time_end: '12:00:00',
      note: 'Set the water heater',
      created_by: 'taunya',
      shared_block_group_id: 'grp-new',
    })
  })

  it('joins the group the source is already in, without minting another', async () => {
    const source = block({ shared_block_group_id: 'grp-1' })
    await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked', source, allJobBlocks: [source] }))
    expect(mocks.ensureSharedBlockGroupForRow).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({ shared_block_group_id: 'grp-1' })
  })

  it('passes the group error through, and says so when no group id comes back', async () => {
    mocks.ensureSharedBlockGroupForRow.mockResolvedValueOnce({ data: null, error: 'Block not found.' })
    expect(await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))).toEqual({ error: 'Block not found.' })

    mocks.ensureSharedBlockGroupForRow.mockResolvedValueOnce({ data: null, error: null })
    expect(await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))).toEqual({
      error: 'Could not link block.',
    })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('groups a solo source before it checks the overlap, so a refused copy leaves the source grouped', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValueOnce({
      data: [block({ id: 'blk-9', assignee_user_id: 'paige', time_start: '10:00:00', time_end: '14:00:00' })],
      error: null,
    })
    const r = await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))
    expect(r).toEqual({ error: 'That time overlaps another block for this person on this day.' })
    expect(mocks.ensureSharedBlockGroupForRow).toHaveBeenCalledWith('blk-1')
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })
})

describe('insertScheduleDispatchCopiedLeg — unlinked', () => {
  it('inserts a solo row even when the source is in a group', async () => {
    const source = block({ shared_block_group_id: 'grp-1' })
    const r = await insertScheduleDispatchCopiedLeg(args({ source, allJobBlocks: [source] }))
    expect(r).toEqual({ error: null })
    expect(mocks.ensureSharedBlockGroupForRow).not.toHaveBeenCalled()
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({ shared_block_group_id: null })
  })

  it('lets the same person take a copy on another day', async () => {
    const r = await insertScheduleDispatchCopiedLeg(
      args({ targetAssigneeUserId: 'abraham', targetWorkDate: '2026-09-29' }),
    )
    expect(r).toEqual({ error: null })
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).toHaveBeenCalledWith(['abraham'], '2026-09-29')
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({
      assignee_user_id: 'abraham',
      work_date: '2026-09-29',
    })
  })

  it('writes a bid block back onto its bid', async () => {
    const source = block({ job_id: null, bid_id: 'bid-9' })
    const r = await insertScheduleDispatchCopiedLeg(args({ source, jobId: 'bid:bid-9' }))
    expect(r).toEqual({ error: null })
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({ job_id: null, bid_id: 'bid-9' })
  })

  it('carries a missing note as it is', async () => {
    await insertScheduleDispatchCopiedLeg(args({ source: block({ note: null }) }))
    expect(mocks.insertJobScheduleBlock.mock.calls[0]?.[0]).toMatchObject({ note: null })
  })
})

describe('insertScheduleDispatchCopiedLeg — the overlap check and the write', () => {
  it('reads the target person on the target day', async () => {
    await insertScheduleDispatchCopiedLeg(args({ targetWorkDate: '2026-09-30' }))
    expect(mocks.fetchScheduleBlocksForAssigneesOnDay).toHaveBeenCalledWith(['paige'], '2026-09-30')
  })

  it('refuses a copy that overlaps what the person already has', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValueOnce({
      data: [block({ id: 'blk-9', assignee_user_id: 'paige', time_start: '11:30:00', time_end: '13:00:00' })],
      error: null,
    })
    const r = await insertScheduleDispatchCopiedLeg(args())
    expect(r).toEqual({ error: 'That time overlaps another block for this person on this day.' })
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('allows blocks that only touch end to start', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValueOnce({
      data: [
        block({ id: 'blk-8', assignee_user_id: 'paige', time_start: '06:00:00', time_end: '08:00:00' }),
        block({ id: 'blk-9', assignee_user_id: 'paige', time_start: '12:00:00', time_end: '16:00:00' }),
      ],
      error: null,
    })
    expect(await insertScheduleDispatchCopiedLeg(args())).toEqual({ error: null })
    expect(mocks.insertJobScheduleBlock).toHaveBeenCalledTimes(1)
  })

  it('passes a failed day read through and writes nothing', async () => {
    mocks.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValue({ data: [], error: 'Could not load the day.' })
    expect(await insertScheduleDispatchCopiedLeg(args())).toEqual({ error: 'Could not load the day.' })
    expect(await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))).toEqual({
      error: 'Could not load the day.',
    })
    expect(mocks.insertJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('passes a failed insert through', async () => {
    mocks.insertJobScheduleBlock.mockResolvedValue({ data: null, error: 'Could not save the block.' })
    expect(await insertScheduleDispatchCopiedLeg(args())).toEqual({ error: 'Could not save the block.' })
    expect(await insertScheduleDispatchCopiedLeg(args({ linkMode: 'linked' }))).toEqual({
      error: 'Could not save the block.',
    })
  })
})
