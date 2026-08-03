import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveEditedScheduleBlockTimes } from './scheduleDispatchAddBlockSave'
import {
  fetchJobScheduleBlockGroupLegs,
  fetchScheduleBlocksForAssigneesOnDay,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
} from './jobScheduleBlocks'

vi.mock('./jobScheduleBlocks', () => ({
  fetchJobScheduleBlockGroupLegs: vi.fn(),
  fetchScheduleBlocksForAssigneesOnDay: vi.fn(),
  insertJobScheduleBlock: vi.fn(),
  newJobScheduleSharedBlockGroupId: vi.fn(() => 'gid-new'),
  updateJobScheduleBlock: vi.fn(),
  updateJobScheduleBlockGroup: vi.fn(),
}))

const mockGroupLegs = vi.mocked(fetchJobScheduleBlockGroupLegs)
const mockDayBlocks = vi.mocked(fetchScheduleBlocksForAssigneesOnDay)
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
