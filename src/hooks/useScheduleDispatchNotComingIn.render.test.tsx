// @vitest-environment jsdom
/**
 * The Schedule Dispatch hub's not-coming-in flows (punch list #46 row 7, the SCHEDULE_DISPATCH
 * map's step 4): marking a person-day off (and the empty cell's confirm in front of it), a
 * no-call-no-show, and the chip's undo — what each writes, in what order, the toasts it raises,
 * the quiet reload after, and what a refusal leaves alone. The writes themselves are the tested
 * kernels; these pin the flags, targets and reloads around them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import type { UserTimeOffCellInfo } from '../lib/userTimeOffByCell'

const io = vi.hoisted(() => ({
  recordNotComingInForUserAsStaff: vi.fn(),
  removeNotComingInForUserAsStaff: vi.fn(),
  removePersonDayBlocks: vi.fn(),
  recordNcnsForPersonDay: vi.fn(),
  order: [] as string[],
}))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/notComingInTimeOff', () => ({
  recordNotComingInForUserAsStaff: io.recordNotComingInForUserAsStaff,
  removeNotComingInForUserAsStaff: io.removeNotComingInForUserAsStaff,
}))
vi.mock('../lib/scheduleDispatch/removePersonDayBlocks', () => ({ removePersonDayBlocks: io.removePersonDayBlocks }))
vi.mock('../lib/scheduleDispatch/recordNcns', () => ({ recordNcnsForPersonDay: io.recordNcnsForPersonDay }))

import { useScheduleDispatchNotComingIn, type ScheduleDispatchNotComingInInput } from './useScheduleDispatchNotComingIn'
import { hubPersonDayKey } from '../lib/scheduleDispatchHub'
import { userTimeOffCellKey } from '../lib/userTimeOffByCell'
import { scheduleFormatWeekdayLong } from '../lib/jobScheduleChicago'

const MON = '2026-10-05'

function block(id: string): JobScheduleBlockRow {
  return {
    id,
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'kyle',
    work_date: MON,
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: null,
    shared_block_group_id: null,
    created_by: null,
    created_at: '2026-10-01T15:00:00Z',
    updated_at: '2026-10-01T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
  }
}

const showToast = vi.fn()
const loadHub = vi.fn()
const refreshHubUserTimeOff = vi.fn()
const load = vi.fn()

function input(over: Partial<ScheduleDispatchNotComingInInput> = {}): ScheduleDispatchNotComingInInput {
  return {
    jobId: '',
    load,
    canEdit: true,
    showToast,
    hubPeopleNameById: new Map([['kyle', 'Kyle']]),
    hubPersonDayBlocks: new Map([[hubPersonDayKey('kyle', MON), [block('blk-1'), block('blk-2')]]]),
    hubUserTimeOffByCell: new Map<string, UserTimeOffCellInfo>(),
    loadHub,
    refreshHubUserTimeOff,
    ...over,
  }
}

function mount(over: Partial<ScheduleDispatchNotComingInInput> = {}) {
  return renderHook((p: ScheduleDispatchNotComingInInput) => useScheduleDispatchNotComingIn(p), { initialProps: input(over) })
}

const toasts = () => showToast.mock.calls.map(([message, tone]) => `${tone}: ${message}`)

beforeEach(() => {
  vi.clearAllMocks()
  io.order = []
  io.recordNotComingInForUserAsStaff.mockImplementation(async () => {
    io.order.push('time off')
    return { ok: true, alreadyMarked: false }
  })
  io.removePersonDayBlocks.mockImplementation(async (ids: string[]) => {
    io.order.push(`blocks ${ids.join(',')}`)
    return { removed: ids.length, failed: 0 }
  })
  io.recordNcnsForPersonDay.mockResolvedValue({
    ok: true,
    rejectedCount: 1,
    hadApprovedSessions: true,
    timeOff: { ok: true, alreadyMarked: false },
    removed: 2,
    failed: 0,
  })
  io.removeNotComingInForUserAsStaff.mockResolvedValue({ ok: true, deleted: 1 })
  loadHub.mockImplementation(async () => {
    io.order.push('reload')
  })
  refreshHubUserTimeOff.mockImplementation(async () => {
    io.order.push('time-off refresh')
  })
})
afterEach(cleanup)

describe('useScheduleDispatchNotComingIn — mark not coming in', () => {
  it('records the time off, then removes that day’s blocks, says so, and reloads quietly', async () => {
    const { result } = mount()
    let pending!: Promise<void>
    act(() => {
      pending = result.current.markNotComingInForPersonDay('kyle', MON)
    })
    expect(result.current.notComingInBusy).toBe(true)
    await act(async () => {
      await pending
    })
    expect(io.recordNotComingInForUserAsStaff).toHaveBeenCalledWith({ subjectUserId: 'kyle', workDateYmd: MON })
    expect(io.order).toEqual(['time off', 'blocks blk-1,blk-2', 'reload', 'time-off refresh'])
    expect(loadHub).toHaveBeenCalledWith({ quiet: true })
    expect(load).not.toHaveBeenCalled()
    expect(toasts()).toEqual([expect.stringMatching(/^success: Marked Kyle as not coming in \(2026-10-05\)\./)])
    expect(result.current.notComingInBusy).toBe(false)
  })

  it('a refusal is an error toast and nothing else: no block removed, no reload', async () => {
    io.recordNotComingInForUserAsStaff.mockResolvedValue({ ok: false, message: 'Not allowed for this person' })
    const { result } = mount()
    await act(async () => {
      await result.current.markNotComingInForPersonDay('kyle', MON)
    })
    expect(toasts()).toEqual(['error: Not allowed for this person'])
    expect(io.removePersonDayBlocks).not.toHaveBeenCalled()
    expect(loadHub).not.toHaveBeenCalled()
    expect(result.current.notComingInBusy).toBe(false)
  })

  it('a day already off still clears its blocks and warns instead of claiming the mark', async () => {
    io.recordNotComingInForUserAsStaff.mockResolvedValue({ ok: true, alreadyMarked: true })
    const { result } = mount()
    await act(async () => {
      await result.current.markNotComingInForPersonDay('kyle', MON)
    })
    expect(io.removePersonDayBlocks).toHaveBeenCalledWith(['blk-1', 'blk-2'])
    expect(toasts()[0]).toMatch(/^warning: Kyle already had unpaid time off on 2026-10-05\./)
  })

  it('the empty cell’s off asks first: the confirm names the person and day, cancel writes nothing, confirm marks', async () => {
    const { result } = mount()
    act(() => result.current.onMarkNotComingInForCell('kyle', MON))
    expect(result.current.markOffConfirmTarget).toEqual({
      personUserId: 'kyle',
      workDate: MON,
      personLabel: 'Kyle',
      workDateLabel: scheduleFormatWeekdayLong(MON),
    })
    act(() => result.current.cancelMarkOffForCell())
    expect(result.current.markOffConfirmTarget).toBeNull()
    expect(io.recordNotComingInForUserAsStaff).not.toHaveBeenCalled()

    act(() => result.current.onMarkNotComingInForCell('kyle', MON))
    await act(async () => {
      result.current.confirmMarkOffForCell()
    })
    expect(result.current.markOffConfirmTarget).toBeNull()
    expect(io.recordNotComingInForUserAsStaff).toHaveBeenCalledTimes(1)
  })

  it('while a mark is running the off button opens no second confirm', async () => {
    let finish!: () => void
    io.recordNotComingInForUserAsStaff.mockReturnValue(
      new Promise((r) => {
        finish = () => r({ ok: true, alreadyMarked: false })
      }),
    )
    const { result } = mount()
    let pending!: Promise<void>
    act(() => {
      pending = result.current.markNotComingInForPersonDay('kyle', MON)
    })
    act(() => result.current.onMarkNotComingInForCell('kyle', MON))
    expect(result.current.markOffConfirmTarget).toBeNull()
    await act(async () => {
      finish()
      await pending
    })
  })
})

describe('useScheduleDispatchNotComingIn — no call, no show', () => {
  it('sends the day’s blocks with the details, raises the incident’s toasts and reloads quietly', async () => {
    const { result } = mount()
    await act(async () => {
      await result.current.recordNcnsOnPersonDay('kyle', MON, 'No answer at 7:30')
    })
    expect(io.recordNcnsForPersonDay).toHaveBeenCalledWith({
      subjectUserId: 'kyle',
      workDateYmd: MON,
      details: 'No answer at 7:30',
      existingBlockIds: ['blk-1', 'blk-2'],
    })
    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatch(/^success: .*1 clock session rejected\. Approved hours were unwound\. Removed 2 /)
    expect(loadHub).toHaveBeenCalledWith({ quiet: true })
    expect(refreshHubUserTimeOff).toHaveBeenCalledTimes(1)
    expect(result.current.notComingInBusy).toBe(false)
  })

  it('a refusal is one error toast and no reload', async () => {
    io.recordNcnsForPersonDay.mockResolvedValue({ ok: false, message: 'Clock time exists for that day' })
    const { result } = mount()
    await act(async () => {
      await result.current.recordNcnsOnPersonDay('kyle', MON, '')
    })
    expect(toasts()).toEqual(['error: Clock time exists for that day'])
    expect(loadHub).not.toHaveBeenCalled()
    expect(result.current.notComingInBusy).toBe(false)
  })

  it('a throw is an error toast with its message, and the busy flag still clears', async () => {
    io.recordNcnsForPersonDay.mockRejectedValue(new Error('network gone'))
    const { result } = mount()
    await act(async () => {
      await result.current.recordNcnsOnPersonDay('kyle', MON, '')
    })
    expect(toasts()).toEqual(['error: network gone'])
    expect(result.current.notComingInBusy).toBe(false)
  })
})

describe('useScheduleDispatchNotComingIn — undo from the chip', () => {
  it('a chip asks first, sterner for NCNS; confirming clears it, says so, and reloads quietly', async () => {
    const { result } = mount({
      hubUserTimeOffByCell: new Map<string, UserTimeOffCellInfo>([[userTimeOffCellKey('kyle', MON), { variant: 'ncns', label: 'NCNS' } as UserTimeOffCellInfo]]),
    })
    act(() => result.current.handleRequestUndoNotComingIn('kyle', MON))
    expect(result.current.undoNotComingInTarget).toEqual({
      personUserId: 'kyle',
      personLabel: 'Kyle',
      workDate: MON,
      workDateLabel: scheduleFormatWeekdayLong(MON),
      isNcns: true,
    })
    await act(async () => {
      await result.current.handleConfirmUndoNotComingIn()
    })
    expect(io.removeNotComingInForUserAsStaff).toHaveBeenCalledWith({ subjectUserId: 'kyle', workDateYmd: MON })
    expect(toasts()).toEqual(['success: NCNS schedule mark cleared for Kyle (2026-10-05). The attendance incident stays on record.'])
    expect(result.current.undoNotComingInTarget).toBeNull()
    expect(loadHub).toHaveBeenCalledWith({ quiet: true })
    expect(result.current.undoNotComingInBusy).toBe(false)
  })

  it('a day someone else already cleared warns; a salary-sync problem is its own warning', async () => {
    io.removeNotComingInForUserAsStaff.mockResolvedValueOnce({ ok: true, deleted: 0 })
    const { result } = mount()
    act(() => result.current.handleRequestUndoNotComingIn('kyle', MON))
    await act(async () => {
      await result.current.handleConfirmUndoNotComingIn()
    })
    expect(toasts()).toEqual(['warning: Kyle was already cleared for 2026-10-05.'])

    showToast.mockClear()
    io.removeNotComingInForUserAsStaff.mockResolvedValueOnce({ ok: true, deleted: 1, syncWarning: 'payroll locked' })
    act(() => result.current.handleRequestUndoNotComingIn('kyle', MON))
    await act(async () => {
      await result.current.handleConfirmUndoNotComingIn()
    })
    expect(toasts()).toEqual(['success: Kyle is no longer marked Not coming in (2026-10-05).', 'warning: Salary sync: payroll locked'])
  })

  it('a refusal keeps the window open with an error and no reload', async () => {
    io.removeNotComingInForUserAsStaff.mockResolvedValue({ ok: false, message: 'Not allowed' })
    const { result } = mount()
    act(() => result.current.handleRequestUndoNotComingIn('kyle', MON))
    await act(async () => {
      await result.current.handleConfirmUndoNotComingIn()
    })
    expect(toasts()).toEqual(['error: Not allowed'])
    expect(result.current.undoNotComingInTarget).not.toBeNull()
    expect(loadHub).not.toHaveBeenCalled()
    expect(result.current.undoNotComingInBusy).toBe(false)
  })

  it('a viewer who cannot edit gets no window; cancel is ignored while the undo runs', async () => {
    const viewer = mount({ canEdit: false })
    act(() => viewer.result.current.handleRequestUndoNotComingIn('kyle', MON))
    expect(viewer.result.current.undoNotComingInTarget).toBeNull()
    viewer.unmount()

    let finish!: () => void
    io.removeNotComingInForUserAsStaff.mockReturnValue(
      new Promise((r) => {
        finish = () => r({ ok: true, deleted: 1 })
      }),
    )
    const { result } = mount()
    act(() => result.current.handleRequestUndoNotComingIn('kyle', MON))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.handleConfirmUndoNotComingIn()
    })
    expect(result.current.undoNotComingInBusy).toBe(true)
    act(() => result.current.handleCancelUndoNotComingIn())
    expect(result.current.undoNotComingInTarget).not.toBeNull()
    await act(async () => {
      finish()
      await pending
    })
    expect(result.current.undoNotComingInTarget).toBeNull()
  })
})
