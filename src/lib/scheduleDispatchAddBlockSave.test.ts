import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SCHEDULE_MULTI_DAY_GROUP_MOVE_ERROR,
  saveEditedScheduleBlockTimes,
} from './scheduleDispatchAddBlockSave'
import {
  fetchJobScheduleBlockGroupLegs,
  fetchScheduleBlocksForAssigneesOnDay,
  moveJobScheduleBlockGroupViaRpc,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
} from './jobScheduleBlocks'

vi.mock('./jobScheduleBlocks', () => ({
  fetchJobScheduleBlockGroupLegs: vi.fn(),
  fetchScheduleBlocksForAssigneesOnDay: vi.fn(),
  insertJobScheduleBlock: vi.fn(),
  moveJobScheduleBlockGroupViaRpc: vi.fn(),
  newJobScheduleSharedBlockGroupId: vi.fn(() => 'gid-new'),
  updateJobScheduleBlock: vi.fn(),
  updateJobScheduleBlockGroup: vi.fn(),
}))

const mockGroupLegs = vi.mocked(fetchJobScheduleBlockGroupLegs)
const mockDayBlocks = vi.mocked(fetchScheduleBlocksForAssigneesOnDay)
const mockMoveGroup = vi.mocked(moveJobScheduleBlockGroupViaRpc)
const mockUpdateBlock = vi.mocked(updateJobScheduleBlock)
const mockUpdateGroup = vi.mocked(updateJobScheduleBlockGroup)

type DayBlockRow = Awaited<ReturnType<typeof fetchScheduleBlocksForAssigneesOnDay>>['data'][number]

const dayRow = (id: string, assignee: string, start: string, end: string): DayBlockRow =>
  ({
    id,
    assignee_user_id: assignee,
    time_start: start,
    time_end: end,
  }) as DayBlockRow

const soloParams = {
  blockId: 'b1',
  jobId: 'j1',
  assigneeUserId: 'u1',
  workDate: '2026-08-04',
  sharedBlockGroupId: null,
  timeStart: '08:00',
  timeEnd: '11:00',
  note: '',
}

describe('saveEditedScheduleBlockTimes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateBlock.mockResolvedValue({ error: null })
    mockUpdateGroup.mockResolvedValue({ error: null })
  })

  it('rejects an invalid range without touching the network', async () => {
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, timeEnd: '08:00' })
    expect(res).toEqual({ ok: false, error: 'End time must be after start time.' })
    expect(mockDayBlocks).not.toHaveBeenCalled()
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })

  it('solo block: rejects an overlap with another block that day', async () => {
    mockDayBlocks.mockResolvedValue({
      data: [dayRow('b1', 'u1', '08:00:00', '10:00:00'), dayRow('b2', 'u1', '10:30:00', '12:00:00')],
      error: null,
    })
    const res = await saveEditedScheduleBlockTimes(soloParams)
    expect(res).toEqual({
      ok: false,
      error: 'That time overlaps another block for this person on this day.',
    })
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })

  it('solo block: excludes itself from the overlap check and updates with pg times', async () => {
    mockDayBlocks.mockResolvedValue({
      data: [dayRow('b1', 'u1', '08:00:00', '10:00:00')],
      error: null,
    })
    const res = await saveEditedScheduleBlockTimes(soloParams)
    expect(res).toEqual({ ok: true })
    expect(mockUpdateBlock).toHaveBeenCalledWith('b1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: null,
    })
    expect(mockUpdateGroup).not.toHaveBeenCalled()
  })

  it('solo block: trims the note and keeps non-blank text', async () => {
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    await saveEditedScheduleBlockTimes({ ...soloParams, note: '  bring the big auger  ' })
    expect(mockUpdateBlock).toHaveBeenCalledWith('b1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: 'bring the big auger',
    })
  })

  it('linked block: overlap-checks every leg assignee, then updates the whole group', async () => {
    mockGroupLegs.mockResolvedValue({
      data: [dayRow('b1', 'u1', '08:00:00', '10:00:00'), dayRow('b9', 'u2', '08:00:00', '10:00:00')],
      error: null,
    })
    mockDayBlocks
      .mockResolvedValueOnce({ data: [dayRow('b1', 'u1', '08:00:00', '10:00:00')], error: null })
      .mockResolvedValueOnce({ data: [dayRow('b9', 'u2', '08:00:00', '10:00:00')], error: null })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, sharedBlockGroupId: 'g1' })
    expect(res).toEqual({ ok: true })
    expect(mockDayBlocks).toHaveBeenCalledTimes(2)
    expect(mockUpdateGroup).toHaveBeenCalledWith('j1', 'g1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: null,
    })
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })

  it("linked block: another leg assignee's conflicting block rejects the whole move", async () => {
    mockGroupLegs.mockResolvedValue({
      data: [dayRow('b1', 'u1', '08:00:00', '10:00:00'), dayRow('b9', 'u2', '08:00:00', '10:00:00')],
      error: null,
    })
    mockDayBlocks
      .mockResolvedValueOnce({ data: [dayRow('b1', 'u1', '08:00:00', '10:00:00')], error: null })
      .mockResolvedValueOnce({
        data: [dayRow('b9', 'u2', '08:00:00', '10:00:00'), dayRow('b10', 'u2', '10:30:00', '12:00:00')],
        error: null,
      })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, sharedBlockGroupId: 'g1' })
    expect(res).toEqual({
      ok: false,
      error: 'That time overlaps another block for this person on this day.',
    })
    expect(mockUpdateGroup).not.toHaveBeenCalled()
  })

  it('linked block: falls back to the tapped leg when no group legs are visible', async () => {
    mockGroupLegs.mockResolvedValue({ data: [], error: null })
    mockDayBlocks.mockResolvedValue({
      data: [dayRow('b1', 'u1', '08:00:00', '10:00:00')],
      error: null,
    })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, sharedBlockGroupId: 'g1' })
    expect(res).toEqual({ ok: true })
    expect(mockUpdateGroup).toHaveBeenCalledWith('j1', 'g1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: null,
    })
  })

  it('surfaces fetch errors instead of writing', async () => {
    mockDayBlocks.mockResolvedValue({ data: [], error: 'network down' })
    const res = await saveEditedScheduleBlockTimes(soloParams)
    expect(res).toEqual({ ok: false, error: 'network down' })
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })
})

describe('saveEditedScheduleBlockTimes — moving the day', () => {
  const legRow = (
    id: string,
    assignee: string,
    workDate: string,
    start = '08:00:00',
    end = '10:00:00',
  ): DayBlockRow =>
    ({
      id,
      assignee_user_id: assignee,
      work_date: workDate,
      time_start: start,
      time_end: end,
    }) as DayBlockRow

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateBlock.mockResolvedValue({ error: null })
    mockUpdateGroup.mockResolvedValue({ error: null })
    mockMoveGroup.mockResolvedValue({ error: null })
  })

  it('treats an omitted, blank, or unchanged newWorkDate as no move', async () => {
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    for (const newWorkDate of [undefined, '', '   ', '2026-08-04']) {
      vi.clearAllMocks()
      mockUpdateBlock.mockResolvedValue({ error: null })
      mockDayBlocks.mockResolvedValue({ data: [], error: null })
      const res = await saveEditedScheduleBlockTimes({ ...soloParams, newWorkDate })
      expect(res).toEqual({ ok: true })
      expect(mockUpdateBlock).toHaveBeenCalledWith('b1', {
        time_start: '08:00:00',
        time_end: '11:00:00',
        note: null,
      })
      expect(mockMoveGroup).not.toHaveBeenCalled()
    }
  })

  it('solo block: patches work_date alongside the times', async () => {
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, newWorkDate: '2026-08-01' })
    expect(res).toEqual({ ok: true })
    expect(mockUpdateBlock).toHaveBeenCalledWith('b1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: null,
      work_date: '2026-08-01',
    })
  })

  it('solo block: overlap-checks the TARGET day, not the original', async () => {
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    await saveEditedScheduleBlockTimes({ ...soloParams, newWorkDate: '2026-08-01' })
    expect(mockDayBlocks).toHaveBeenCalledWith(['u1'], '2026-08-01')
  })

  it('solo block: a conflict on the target day blocks the move', async () => {
    mockDayBlocks.mockResolvedValue({
      data: [dayRow('other', 'u1', '09:00:00', '12:00:00')],
      error: null,
    })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, newWorkDate: '2026-08-01' })
    expect(res).toEqual({
      ok: false,
      error: 'That time overlaps another block for this person on this day.',
    })
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })

  it('linked block: moves via the RPC, then syncs times for the group', async () => {
    mockGroupLegs.mockResolvedValue({
      data: [legRow('b1', 'u1', '2026-08-04'), legRow('b9', 'u2', '2026-08-04')],
      error: null,
    })
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    const res = await saveEditedScheduleBlockTimes({
      ...soloParams,
      sharedBlockGroupId: 'g1',
      newWorkDate: '2026-08-01',
    })
    expect(res).toEqual({ ok: true })
    expect(mockMoveGroup).toHaveBeenCalledWith('j1', 'g1', '2026-08-01')
    expect(mockUpdateGroup).toHaveBeenCalledWith('j1', 'g1', {
      time_start: '08:00:00',
      time_end: '11:00:00',
      note: null,
    })
    expect(mockDayBlocks).toHaveBeenCalledWith(['u1'], '2026-08-01')
    expect(mockDayBlocks).toHaveBeenCalledWith(['u2'], '2026-08-01')
  })

  it('linked block: refuses to move a group that spans several days', async () => {
    mockGroupLegs.mockResolvedValue({
      data: [legRow('b1', 'u1', '2026-08-04'), legRow('b9', 'u1', '2026-08-05')],
      error: null,
    })
    const res = await saveEditedScheduleBlockTimes({
      ...soloParams,
      sharedBlockGroupId: 'g1',
      newWorkDate: '2026-08-01',
    })
    expect(res).toEqual({ ok: false, error: SCHEDULE_MULTI_DAY_GROUP_MOVE_ERROR })
    expect(mockMoveGroup).not.toHaveBeenCalled()
    expect(mockUpdateGroup).not.toHaveBeenCalled()
    expect(mockDayBlocks).not.toHaveBeenCalled()
  })

  it('linked block: a multi-day group still accepts a time-only edit', async () => {
    mockGroupLegs.mockResolvedValue({
      data: [legRow('b1', 'u1', '2026-08-04'), legRow('b9', 'u1', '2026-08-05')],
      error: null,
    })
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    const res = await saveEditedScheduleBlockTimes({ ...soloParams, sharedBlockGroupId: 'g1' })
    expect(res).toEqual({ ok: true })
    expect(mockUpdateGroup).toHaveBeenCalled()
    expect(mockMoveGroup).not.toHaveBeenCalled()
  })

  it('linked block: a failed RPC move leaves the times untouched', async () => {
    mockGroupLegs.mockResolvedValue({ data: [legRow('b1', 'u1', '2026-08-04')], error: null })
    mockDayBlocks.mockResolvedValue({ data: [], error: null })
    mockMoveGroup.mockResolvedValue({
      error: 'That time overlaps another block for this person on this day.',
    })
    const res = await saveEditedScheduleBlockTimes({
      ...soloParams,
      sharedBlockGroupId: 'g1',
      newWorkDate: '2026-08-01',
    })
    expect(res).toEqual({
      ok: false,
      error: 'That time overlaps another block for this person on this day.',
    })
    expect(mockUpdateGroup).not.toHaveBeenCalled()
  })

  it('rejects an invalid time range before attempting any move', async () => {
    const res = await saveEditedScheduleBlockTimes({
      ...soloParams,
      timeEnd: '08:00',
      newWorkDate: '2026-08-01',
    })
    expect(res).toEqual({ ok: false, error: 'End time must be after start time.' })
    expect(mockMoveGroup).not.toHaveBeenCalled()
    expect(mockUpdateBlock).not.toHaveBeenCalled()
  })
})
