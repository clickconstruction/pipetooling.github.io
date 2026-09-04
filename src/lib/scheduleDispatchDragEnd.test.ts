import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'

const mocks = vi.hoisted(() => ({
  fetchDay: vi.fn(),
  moveGroup: vi.fn(),
  update: vi.fn(),
}))

vi.mock('./jobScheduleBlocks', () => ({
  fetchScheduleBlocksForAssigneesOnDay: mocks.fetchDay,
  moveJobScheduleBlockGroupViaRpc: mocks.moveGroup,
  updateJobScheduleBlock: mocks.update,
}))

import { executeScheduleDispatchBlockReassign, moveScheduleDispatchBlockTo } from './scheduleDispatchDragEnd'
import { scheduleDispatchCellDroppableId } from './scheduleDispatchDnd'

const block = (over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow =>
  ({
    id: 'b1',
    job_id: 'j1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: '2026-09-03',
    time_start: '16:00:00',
    time_end: '17:30:00',
    note: null,
    shared_block_group_id: null,
    ...over,
  }) as JobScheduleBlockRow

function deps(rows: JobScheduleBlockRow[], canEdit = true) {
  return {
    blockById: new Map(rows.map((r) => [r.id, r])),
    canEdit,
    showToast: vi.fn(),
    onSuccess: vi.fn(async () => {}),
  }
}

beforeEach(() => {
  mocks.fetchDay.mockReset().mockResolvedValue({ data: [], error: null })
  mocks.moveGroup.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockResolvedValue({ error: null })
})

describe('moveScheduleDispatchBlockTo', () => {
  it('patches work_date for a solo block moved to another day and reports success', async () => {
    const d = deps([block()])
    const ok = await moveScheduleDispatchBlockTo('b1', { workDate: '2026-09-04', assigneeUserId: 'abraham' }, d)
    expect(ok).toBe(true)
    expect(mocks.update).toHaveBeenCalledWith('b1', { work_date: '2026-09-04' })
    expect(d.onSuccess).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the target is where the block already is', async () => {
    const d = deps([block()])
    const ok = await moveScheduleDispatchBlockTo('b1', { workDate: '2026-09-03', assigneeUserId: 'abraham' }, d)
    expect(ok).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(d.onSuccess).not.toHaveBeenCalled()
  })

  it('refuses without edit rights or for an unknown block', async () => {
    expect(await moveScheduleDispatchBlockTo('b1', { workDate: '2026-09-04', assigneeUserId: 'a' }, deps([block()], false))).toBe(false)
    expect(await moveScheduleDispatchBlockTo('nope', { workDate: '2026-09-04', assigneeUserId: 'a' }, deps([block()]))).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('stops on an overlap for that person on that day and toasts', async () => {
    mocks.fetchDay.mockResolvedValue({
      data: [block({ id: 'other', time_start: '16:30:00', time_end: '18:00:00' })],
      error: null,
    })
    const d = deps([block()])
    const ok = await moveScheduleDispatchBlockTo('b1', { workDate: '2026-09-04', assigneeUserId: 'abraham' }, d)
    expect(ok).toBe(false)
    expect(d.showToast).toHaveBeenCalledWith(expect.stringContaining('overlaps'), 'error')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('moves a linked crew block to another day through the group RPC', async () => {
    const d = deps([block({ shared_block_group_id: 'g1' })])
    const ok = await moveScheduleDispatchBlockTo('b1', { workDate: '2026-09-04', assigneeUserId: 'abraham' }, d)
    expect(ok).toBe(true)
    expect(mocks.moveGroup).toHaveBeenCalledWith('j1', 'g1', '2026-09-04')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('executeScheduleDispatchBlockReassign', () => {
  it('decodes the cell id and delegates', async () => {
    const d = deps([block()])
    await executeScheduleDispatchBlockReassign(
      { active: { id: 'b1' }, over: { id: scheduleDispatchCellDroppableId('2026-09-04', 'paige') } } as never,
      d,
    )
    expect(mocks.update).toHaveBeenCalledWith('b1', { assignee_user_id: 'paige', work_date: '2026-09-04' })
  })

  it('ignores drops outside a cell', async () => {
    const d = deps([block()])
    await executeScheduleDispatchBlockReassign({ active: { id: 'b1' }, over: { id: 'somewhere-else' } } as never, d)
    await executeScheduleDispatchBlockReassign({ active: { id: 'b1' }, over: null } as never, d)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
