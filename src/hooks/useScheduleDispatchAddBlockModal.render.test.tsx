// @vitest-environment jsdom
/**
 * The Dispatch hub's add-block window (the SCHEDULE_DISPATCH map's step 6), on the hook: it opens
 * for a person, day and job through the mode rule, lays the day's blocks out in time order and
 * seeds the first free gap, edits its fields and the timeline's drafts, saves (the block, a toast,
 * the window shut through the rule, a quiet reload) or keeps the window open with the reason, and
 * shuts through the rule on Cancel or through its closer when a placement starts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import { hubPersonDayKey } from '../lib/scheduleDispatchHub'

type SaveResult = { ok: true } | { ok: false; error: string }
const h = vi.hoisted(() => ({
  saveNew: vi.fn<(args: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>>(),
}))
vi.mock('../lib/scheduleDispatchAddBlockSave', () => ({
  saveNewScheduleBlockForPersonDay: h.saveNew,
  saveEditedScheduleBlockTimes: vi.fn(),
}))

import { useScheduleDispatchAddBlockModal, type UseScheduleDispatchAddBlockModalInput } from './useScheduleDispatchAddBlockModal'

const DAY = '2026-10-07'
const block = (id: string, jobId: string, start: string, end: string) =>
  ({ id, job_id: jobId, bid_id: null, assignee_user_id: 'u-dana', work_date: DAY, time_start: start, time_end: end, shared_block_group_id: null }) as unknown as JobScheduleBlockRow
const TITLES = new Map([
  ['job-1004', 'J1004 · Ridgeway Builders'],
  ['job-1010', 'J1010 · Maple Court'],
  ['job-1011', 'J1011 · Alder Lane'],
])
const OPEN_FOR = { assigneeUserId: 'u-dana', workDate: DAY, jobId: 'job-1004' }

let input: UseScheduleDispatchAddBlockModalInput
/** The mode rule as the page wires it: 'closeAddBlock' ends the window through its closer. */
let ruleClosesWindow: () => void

beforeEach(() => {
  h.saveNew.mockReset()
  ruleClosesWindow = () => {}
  input = {
    jobId: '',
    jobTitle: '',
    blocks: [],
    blockById: new Map(),
    nameByUserId: new Map(),
    hubPersonDayBlocks: new Map([
      [hubPersonDayKey('u-dana', DAY), [block('b-late', 'job-1011', '12:00:00', '16:00:00'), block('b-early', 'job-1010', '08:00:00', '10:00:00')]],
    ]) as UseScheduleDispatchAddBlockModalInput['hubPersonDayBlocks'],
    hubJobTitleById: TITLES,
    hubPeopleNameById: new Map([['u-dana', 'Dana Ruiz']]),
    hubPersonById: new Map([['u-dana', { role: 'helpers', needsSupervision: true }]]) as unknown as UseScheduleDispatchAddBlockModalInput['hubPersonById'],
    hubBlockCoverageByKey: new Map(),
    getHubJobDisplayTitle: (id: string) => TITLES.get(id) ?? `? ${id}`,
    authUser: { id: 'u-lead' },
    showToast: vi.fn(),
    load: vi.fn(async () => {}),
    loadHub: vi.fn(async () => {}),
    leaveModesFor: vi.fn((entry: string) => {
      if (entry === 'closeAddBlock') ruleClosesWindow()
    }),
  }
})

function mount(over: Partial<UseScheduleDispatchAddBlockModalInput> = {}) {
  const hook = renderHook((props: UseScheduleDispatchAddBlockModalInput) => useScheduleDispatchAddBlockModal(props), {
    initialProps: { ...input, ...over },
  })
  ruleClosesWindow = () => hook.result.current.closeAddBlockWindow()
  return hook
}

describe('opening the window', () => {
  it('opens for the person, day and job through the mode rule, the day’s blocks in time order, and seeds the first free gap', () => {
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    expect(input.leaveModesFor).toHaveBeenCalledWith('openAddBlock')
    const p = result.current.addBlockModalProps
    expect(p).toMatchObject({ open: true, mode: 'add', jobTitle: 'J1004 · Ridgeway Builders', personLabel: 'Dana Ruiz', workDate: DAY, note: '', error: null, saving: false })
    expect(p.addTimeline?.segments.map((s) => [s.blockId, s.label, s.time_start])).toEqual([
      ['b-early', 'J1010 · Maple Court', '08:00:00'],
      ['b-late', 'J1011 · Alder Lane', '12:00:00'],
    ])
    expect([p.timeStart, p.timeEnd]).toEqual(['04:00', '08:00'])
  })

  it('an empty day starts at 8:00 to 4:00, and a full day falls back to the same', () => {
    const empty = mount({ hubPersonDayBlocks: new Map() as UseScheduleDispatchAddBlockModalInput['hubPersonDayBlocks'] })
    act(() => empty.result.current.openAddBlock(OPEN_FOR))
    expect([empty.result.current.addBlockModalProps.timeStart, empty.result.current.addBlockModalProps.timeEnd]).toEqual(['08:00', '16:00'])

    const full = mount({
      hubPersonDayBlocks: new Map([[hubPersonDayKey('u-dana', DAY), [block('b-all', 'job-1010', '00:00:00', '23:59:00')]]]) as UseScheduleDispatchAddBlockModalInput['hubPersonDayBlocks'],
    })
    act(() => full.result.current.openAddBlock(OPEN_FOR))
    expect([full.result.current.addBlockModalProps.timeStart, full.result.current.addBlockModalProps.timeEnd]).toEqual(['08:00', '16:00'])
  })

  it('warns when the person needs supervision and nobody on the block can run it', () => {
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    expect(result.current.addBlockModalProps.warning).toBe(
      'Dana Ruiz needs supervision — nobody on this block can run it yet. Add a master, or someone who can run a job, as a linked copy. You can still save it.',
    )
    const master = mount({ hubPersonById: new Map([['u-dana', { role: 'master_technician', needsSupervision: false }]]) as unknown as UseScheduleDispatchAddBlockModalInput['hubPersonById'] })
    act(() => master.result.current.openAddBlock(OPEN_FOR))
    expect(master.result.current.addBlockModalProps.warning).toBeNull()
  })
})

describe('saving', () => {
  it('sends the fields and the timeline’s drafts', async () => {
    h.saveNew.mockResolvedValue({ ok: true })
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    act(() => {
      result.current.addBlockModalProps.onChangeStart('09:00')
      result.current.addBlockModalProps.onChangeEnd('11:00')
      result.current.addBlockModalProps.onChangeNote('Bring the long ladder')
      result.current.addBlockModalProps.addTimeline!.setDraftByBlockId({ 'b-early': { time_start: '07:00:00', time_end: '09:00:00' } })
    })
    await act(async () => {
      result.current.addBlockModalProps.onSave()
    })
    expect(h.saveNew.mock.calls).toEqual([
      [
        {
          authUserId: 'u-lead',
          assigneeUserId: 'u-dana',
          workDate: DAY,
          targetJobId: 'job-1004',
          addTimeStart: '09:00',
          addTimeEnd: '11:00',
          addNote: 'Bring the long ladder',
          addBlockDraftByBlockId: { 'b-early': { time_start: '07:00:00', time_end: '09:00:00' } },
        },
      ],
    ])
  })

  it('a save that lands says so, shuts the window through the mode rule and reloads the board quietly', async () => {
    h.saveNew.mockResolvedValue({ ok: true })
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    await act(async () => {
      result.current.addBlockModalProps.onSave()
    })
    expect(input.showToast).toHaveBeenCalledWith('Block added.', 'success')
    expect(input.leaveModesFor).toHaveBeenLastCalledWith('closeAddBlock')
    expect(result.current.addBlockModalProps.open).toBe(false)
    expect(input.loadHub).toHaveBeenCalledWith({ quiet: true })
    expect(input.load).not.toHaveBeenCalled()
  })

  it('a refused save keeps the window open with the reason', async () => {
    h.saveNew.mockResolvedValue({ ok: false, error: 'That overlaps 8:00 AM–10:00 AM.' })
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    await act(async () => {
      result.current.addBlockModalProps.onSave()
    })
    expect(result.current.addBlockModalProps).toMatchObject({ open: true, saving: false, error: 'That overlaps 8:00 AM–10:00 AM.' })
    expect(input.showToast).not.toHaveBeenCalled()
    expect(input.leaveModesFor).not.toHaveBeenCalledWith('closeAddBlock')
    expect(input.loadHub).not.toHaveBeenCalled()
  })

  it('shows saving while the write is out', async () => {
    let land!: (r: SaveResult) => void
    h.saveNew.mockReturnValue(new Promise<SaveResult>((r) => (land = r)))
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    act(() => result.current.addBlockModalProps.onSave())
    expect(result.current.addBlockModalProps.saving).toBe(true)
    await act(async () => {
      land({ ok: true })
    })
    expect(result.current.addBlockModalProps.saving).toBe(false)
  })
})

describe('shutting the window', () => {
  it('Cancel goes through the mode rule, which shuts it', () => {
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    act(() => result.current.addBlockModalProps.onClose())
    expect(input.leaveModesFor).toHaveBeenLastCalledWith('closeAddBlock')
    expect(result.current.addBlockModalProps.open).toBe(false)
    expect(result.current.addBlockModalProps.addTimeline).toBeUndefined()
  })

  it('Cancel clears the day’s timeline and its drafts itself', () => {
    const { result } = mount()
    ruleClosesWindow = () => {}
    act(() => result.current.openAddBlock(OPEN_FOR))
    act(() => result.current.addBlockModalProps.addTimeline!.setDraftByBlockId({ 'b-early': { time_start: '07:00:00', time_end: '09:00:00' } }))
    act(() => result.current.addBlockModalProps.onClose())
    expect(result.current.addBlockModalProps.addTimeline).toEqual({
      segments: [],
      draftByBlockId: {},
      setDraftByBlockId: expect.any(Function),
    })
  })

  it('the modes shut it through its closer when a placement starts, and the error goes with it', async () => {
    h.saveNew.mockResolvedValue({ ok: false, error: 'That overlaps 8:00 AM–10:00 AM.' })
    const { result } = mount()
    act(() => result.current.openAddBlock(OPEN_FOR))
    await act(async () => {
      result.current.addBlockModalProps.onSave()
    })
    act(() => result.current.closeAddBlockWindow())
    expect(result.current.addBlockModalProps).toMatchObject({ open: false, error: null })
    expect(result.current.blockModalState).toBeNull()
  })
})
