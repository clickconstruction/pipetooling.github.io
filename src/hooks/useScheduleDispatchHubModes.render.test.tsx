// @vitest-environment jsdom
/**
 * The Dispatch hub's modes (the SCHEDULE_DISPATCH map's step 6), on the hook: every way into a
 * mode, from every other mode; every way out; Escape; the ?placeJob= arm; and each writer the
 * page keeps (the add-block window, the tabs, the week arrows, the picker's pick, the new-job
 * path) through the intents it calls. The expectations are literal, gaps d to f named (a to c
 * fixed in v2.4989), so a row changed in `lib/scheduleDispatch/hubModes.ts` fails here as well as
 * in its table test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { SetURLSearchParams } from 'react-router-dom'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'

const h = vi.hoisted(() => ({
  insertLeg: vi.fn(async () => ({ error: null as string | null })),
  moveTo: vi.fn(async () => true),
  addToCells: vi.fn(async () => ({ added: 1, skippedOverlap: 0, failed: 0 })),
}))
vi.mock('../lib/scheduleDispatchMirrorInsert', () => ({ insertScheduleDispatchCopiedLeg: h.insertLeg }))
vi.mock('../lib/scheduleDispatchDragEnd', () => ({ moveScheduleDispatchBlockTo: h.moveTo }))
vi.mock('../lib/scheduleDispatch/multiCellAdd', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/scheduleDispatch/multiCellAdd')>()),
  addJobToHubCells: h.addToCells,
}))

import { useScheduleDispatchHubModes, type UseScheduleDispatchHubModesInput } from './useScheduleDispatchHubModes'

const WEEK = '2026-10-04'
const BLOCK = {
  id: 'blk-1',
  job_id: 'job-1004',
  bid_id: null,
  assignee_user_id: 'u-dana',
  work_date: '2026-10-07',
  time_start: '08:00:00',
  time_end: '16:00:00',
} as unknown as JobScheduleBlockRow

let url: URLSearchParams
let input: UseScheduleDispatchHubModesInput

beforeEach(() => {
  h.insertLeg.mockClear()
  h.moveTo.mockClear()
  h.addToCells.mockClear()
  url = new URLSearchParams(`week=${WEEK}`)
  const setSearchParams = vi.fn((next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
    url = typeof next === 'function' ? next(url) : new URLSearchParams(next)
  })
  input = {
    jobId: '',
    isTomorrow: false,
    hubTab: 'people',
    weekStart: WEEK,
    hubLoading: false,
    searchParams: url,
    setSearchParams: setSearchParams as unknown as SetURLSearchParams,
    canEdit: true,
    authUser: { id: 'u-lead' },
    showToast: vi.fn(),
    blockById: new Map(),
    blocks: [],
    hubBlockById: new Map([[BLOCK.id, BLOCK]]),
    hubWeekBlocks: [BLOCK],
    hubPeopleNameById: new Map([['u-dana', 'Dana Ruiz']]),
    load: vi.fn(async () => {}),
    loadHub: vi.fn(async () => {}),
    onPickerOpened: vi.fn(),
    closeAddBlockWindow: vi.fn(),
  }
})

function mount(over: Partial<UseScheduleDispatchHubModesInput> = {}) {
  return renderHook((props: UseScheduleDispatchHubModesInput) => useScheduleDispatchHubModes(props), {
    initialProps: { ...input, ...over },
  })
}
type Modes = ReturnType<typeof useScheduleDispatchHubModes>
type Mode = 'placement' | 'linkedCopy' | 'assignPlacement' | 'multiCell' | 'picker'
const MODES: Mode[] = ['placement', 'linkedCopy', 'assignPlacement', 'multiCell', 'picker']

/** One way into each mode, through the hook's own intents. */
const ENTER: Record<Mode, (m: Modes) => void> = {
  placement: (m) => m.onStartCardPlacement(BLOCK, 'linked'),
  linkedCopy: (m) => m.onStartLinkedCopyMode(),
  assignPlacement: (m) => m.pickJobToPlace('job-7'),
  multiCell: (m) => m.onRequestHubMultiCellAddMode(),
  picker: (m) => m.onRequestHubAddJob(),
}
const IS_ON: Record<Mode, (m: Modes) => boolean> = {
  placement: (m) => m.cardPlacementMode != null,
  linkedCopy: (m) => m.linkedCopyMode != null,
  assignPlacement: (m) => m.hubAssignJobPlacement != null,
  multiCell: (m) => m.hubMultiCellAddActive,
  picker: (m) => m.hubAssignJobPickerOpen,
}
const on = (m: Modes) => MODES.filter((mode) => IS_ON[mode](m))

describe('entering a mode', () => {
  /** What each way in leaves on, of the modes that were on before it (literal; gap e named). */
  const WAYS_IN: Record<string, { run: (m: Modes) => void; turnsOn: Mode; keeps: Mode[] }> = {
    'a block’s Linked copy (startPlacement)': { run: ENTER.placement, turnsOn: 'placement', keeps: ['picker'] },
    'Copy jobs linked (startLinkedCopy)': { run: ENTER.linkedCopy, turnsOn: 'linkedCopy', keeps: [] },
    'Select multiple cells (startMultiCell)': { run: ENTER.multiCell, turnsOn: 'multiCell', keeps: [] },
    '+ Add job (openToolbarPicker)': { run: ENTER.picker, turnsOn: 'picker', keeps: [] },
    'a cell’s + (openCellPicker, gap e)': {
      run: (m) => m.onHubEmptyCellOpenChoice('u-dana', '2026-10-07'),
      turnsOn: 'picker',
      keeps: ['placement', 'linkedCopy', 'assignPlacement', 'multiCell'],
    },
  }

  for (const [name, way] of Object.entries(WAYS_IN)) {
    for (const before of MODES.filter((mode) => mode !== way.turnsOn)) {
      it(`${name} from ${before}`, () => {
        const { result } = mount()
        act(() => ENTER[before](result.current))
        expect(on(result.current)).toEqual([before])
        act(() => way.run(result.current))
        expect(on(result.current).sort()).toEqual([way.turnsOn, ...(way.keeps.includes(before) ? [before] : [])].sort())
      })
    }
  }

  it('placement closes the add-block window and takes ?placeJob= off the URL; the picker resets its search', () => {
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const { result } = mount({ searchParams: url })
    act(() => result.current.onStartCardPlacement(BLOCK, 'move'))
    expect(input.closeAddBlockWindow).toHaveBeenCalledTimes(1)
    expect(url.get('placeJob')).toBeNull()
    expect(result.current.cardPlacementMode).toEqual({ sourceBlockId: 'blk-1', variant: 'move' })
    expect(result.current.placementSourceBlock).toBe(BLOCK)

    act(() => result.current.onRequestHubAddJob())
    expect(input.onPickerOpened).toHaveBeenCalledTimes(1)
    expect(result.current.hubAssignJobPickerIntent).toBe('toolbar')
  })

  it('the multi-cell bar’s Choose job opens the picker for the cells and keeps the cells', () => {
    const { result } = mount()
    act(() => result.current.onRequestHubMultiCellAddMode())
    act(() => result.current.onHubMultiCellAddToggle('u-dana', '2026-10-07'))
    act(() => result.current.onRequestHubMultiCellAddChooseJob())
    expect(result.current.hubAssignJobPickerOpen).toBe(true)
    expect(result.current.hubAssignJobPickerIntent).toBe('multi')
    expect(result.current.hubMultiCellAddActive).toBe(true)
    expect(result.current.hubMultiCellAddSelection.size).toBe(1)
    expect(input.onPickerOpened).toHaveBeenCalledTimes(1)
  })
})

describe('leaving a mode', () => {
  it('the toolbar buttons pressed again end their own mode', () => {
    const { result } = mount()
    act(() => result.current.onStartLinkedCopyMode())
    act(() => result.current.onStartLinkedCopyMode())
    expect(on(result.current)).toEqual([])
    act(() => result.current.onRequestHubMultiCellAddMode())
    act(() => result.current.onRequestHubMultiCellAddMode())
    expect(on(result.current)).toEqual([])
  })

  it('Cancel on placement ends it and the + menu; the banners’ clearers end one flag each', () => {
    const { result } = mount()
    act(() => result.current.onPlusMenuBlockIdChange('blk-1'))
    act(() => ENTER.placement(result.current))
    act(() => result.current.onPlusMenuBlockIdChange('blk-1'))
    act(() => result.current.onCancelCardPlacement())
    expect(result.current.cardPlacementMode).toBeNull()
    expect(result.current.plusMenuBlockId).toBeNull()

    act(() => ENTER.linkedCopy(result.current))
    act(() => result.current.setLinkedCopyMode(null))
    expect(on(result.current)).toEqual([])
  })

  it('Cancel on the placing strip ends it and takes ?placeJob= off the URL', () => {
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const { result } = mount({ searchParams: url })
    expect(result.current.hubAssignJobPlacement).toEqual({ jobId: 'job-9' })
    act(() => result.current.onCancelHubAssignJobPlacement())
    expect(result.current.hubAssignJobPlacement).toBeNull()
    expect(url.get('placeJob')).toBeNull()
  })

  it('a copy that lands ends placement; the + menu stays as it was', async () => {
    const { result } = mount()
    act(() => ENTER.placement(result.current))
    act(() => result.current.onPlusMenuBlockIdChange('blk-1'))
    await act(async () => {
      await result.current.onCardPlacementPickCell('u-lee', '2026-10-07')
    })
    expect(h.insertLeg).toHaveBeenCalledTimes(1)
    expect(result.current.cardPlacementMode).toBeNull()
    expect(result.current.plusMenuBlockId).toBe('blk-1')
  })

  it('the multi-cell add, once written, ends multi-cell and the picker', async () => {
    const { result } = mount()
    act(() => result.current.onRequestHubMultiCellAddMode())
    act(() => result.current.onHubMultiCellAddToggle('u-dana', '2026-10-07'))
    act(() => result.current.onRequestHubMultiCellAddChooseJob())
    await act(async () => {
      await result.current.applyHubMultiCellJob('job-1004', [...result.current.hubMultiCellAddSelection])
    })
    expect(h.addToCells).toHaveBeenCalledTimes(1)
    expect(on(result.current)).toEqual([])
    expect(result.current.hubAssignJobPickerIntent).toBe('toolbar')
  })

  it('the picker’s close ends the picker, its cell and multi-cell', () => {
    const { result } = mount()
    act(() => result.current.onHubEmptyCellOpenChoice('u-dana', '2026-10-07'))
    expect(result.current.hubCellAddContext).toEqual({ assigneeUserId: 'u-dana', workDate: '2026-10-07' })
    act(() => result.current.closeHubAssignJobPicker())
    expect(on(result.current)).toEqual([])
    expect(result.current.hubCellAddContext).toBeNull()
    expect(result.current.hubAssignJobPickerIntent).toBe('toolbar')
  })

  it('a new week ends multi-cell', () => {
    const { result, rerender } = mount()
    act(() => result.current.onRequestHubMultiCellAddMode())
    rerender({ ...input, weekStart: '2026-10-11' })
    expect(on(result.current)).toEqual([])
  })
})

describe('Escape', () => {
  const esc = () => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))

  it('ends placement, and with it the placing strip, the cell and ?placeJob= (gap f)', () => {
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const { result } = mount({ searchParams: url })
    expect(on(result.current)).toEqual(['assignPlacement'])
    esc()
    expect(on(result.current)).toEqual([])
    expect(url.get('placeJob')).toBeNull()

    act(() => ENTER.placement(result.current))
    esc()
    expect(on(result.current)).toEqual([])
  })

  it('ends linked copy alone, and multi-cell alone', () => {
    const { result } = mount()
    act(() => ENTER.linkedCopy(result.current))
    esc()
    expect(on(result.current)).toEqual([])
    act(() => ENTER.multiCell(result.current))
    act(() => result.current.onHubMultiCellAddToggle('u-dana', '2026-10-07'))
    esc()
    expect(on(result.current)).toEqual([])
    expect(result.current.hubMultiCellAddSelection.size).toBe(0)
  })

  it('does nothing with no mode on', () => {
    const { result } = mount()
    act(() => result.current.onHubEmptyCellOpenChoice('u-dana', '2026-10-07'))
    const setSearchParams = input.setSearchParams as unknown as ReturnType<typeof vi.fn>
    setSearchParams.mockClear()
    esc()
    expect(on(result.current)).toEqual(['picker'])
    expect(setSearchParams).not.toHaveBeenCalled()
  })
})

describe('the ?placeJob= arm', () => {
  it('waits for the board, then arms the placing strip and ends linked copy (gap a, fixed v2.4989)', () => {
    url = new URLSearchParams(`week=${WEEK}`)
    const { result, rerender } = mount()
    act(() => ENTER.linkedCopy(result.current))
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    rerender({ ...input, searchParams: url, hubLoading: true })
    expect(result.current.hubAssignJobPlacement).toBeNull()
    rerender({ ...input, searchParams: url, hubLoading: false })
    expect(result.current.hubAssignJobPlacement).toEqual({ jobId: 'job-9' })
    expect(on(result.current)).toEqual(['assignPlacement'])
  })

  it('shuts the picker when Back or Forward lands on a placing link (gap a, fixed v2.4989)', () => {
    const { result, rerender } = mount()
    act(() => ENTER.picker(result.current))
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    rerender({ ...input, searchParams: url })
    expect(on(result.current)).toEqual(['assignPlacement'])
  })

  it('arms once per job and week, and again after the week arrows forget it', () => {
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const { result, rerender } = mount({ searchParams: url })
    act(() => result.current.leaveModesFor('assignCellPick'))
    rerender({ ...input, searchParams: url, hubLoading: true })
    rerender({ ...input, searchParams: url, hubLoading: false })
    expect(result.current.hubAssignJobPlacement).toBeNull()

    act(() => result.current.leaveModesFor('weekNav'))
    rerender({ ...input, searchParams: url, hubLoading: true })
    rerender({ ...input, searchParams: url, hubLoading: false })
    expect(result.current.hubAssignJobPlacement).toEqual({ jobId: 'job-9' })
  })

  it('on the Jobs tab moves the link to the People tab first; the tomorrow embed never arms', () => {
    url = new URLSearchParams(`week=${WEEK}&hubTab=jobs&placeJob=job-9`)
    const jobs = mount({ searchParams: url, hubTab: 'jobs' })
    expect(jobs.result.current.hubAssignJobPlacement).toBeNull()
    expect(url.get('hubTab')).toBeNull()
    expect(url.get('placeJob')).toBe('job-9')

    const tomorrow = mount({ searchParams: new URLSearchParams(`placeJob=job-9`), isTomorrow: true })
    expect(tomorrow.result.current.hubAssignJobPlacement).toBeNull()
  })
})

describe('the writers the page keeps, through the hook', () => {
  /** What each leaves on, of a mode that was on before it (literal; gaps b, c and d named). */
  const PAGE_WRITERS: Record<string, { run: (m: Modes) => void; keeps: Mode[]; turnsOn?: Mode }> = {
    'openAddBlock (gap b fixed: linked copy ends too)': { run: (m) => m.leaveModesFor('openAddBlock'), keeps: [] },
    closeAdd: { run: (m) => m.leaveModesFor('closeAddBlock'), keeps: [...MODES] },
    onHubAssignJobCellPick: { run: (m) => m.leaveModesFor('assignCellPick'), keeps: ['placement', 'linkedCopy', 'multiCell', 'picker'] },
    onCreateNewJobFromHubJobPicker: { run: (m) => m.leaveModesFor('newJob'), keeps: ['linkedCopy', 'assignPlacement', 'multiCell'] },
    'setHubTab, Jobs or Day (gap c fixed: linked copy and the picker end too)': { run: (m) => m.leaveModesFor('tabAway'), keeps: [] },
    'shiftWeek and goThisWeek (gap d: multi-cell waits for the new week)': { run: (m) => m.leaveModesFor('weekNav'), keeps: ['multiCell', 'picker'] },
    'the picker’s pick (pickJobToPlace)': { run: (m) => m.pickJobToPlace('job-8'), keeps: ['linkedCopy', 'multiCell'], turnsOn: 'assignPlacement' },
    'the new job with no cell (placeNewJob)': { run: (m) => m.placeNewJob('job-9'), keeps: ['placement', 'linkedCopy', 'multiCell', 'picker'], turnsOn: 'assignPlacement' },
  }

  for (const [name, writer] of Object.entries(PAGE_WRITERS)) {
    for (const before of MODES) {
      it(`${name}, over ${before}`, () => {
        const { result } = mount()
        act(() => ENTER[before](result.current))
        act(() => writer.run(result.current))
        const want = new Set<Mode>(writer.turnsOn ? [writer.turnsOn] : [])
        if (writer.keeps.includes(before)) want.add(before)
        expect(on(result.current).sort()).toEqual([...want].sort())
      })
    }
  }

  it('openAddBlock, closeAdd and the tabs take ?placeJob= off the URL (gap b fixed); closeAdd shuts the window', () => {
    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const { result } = mount({ searchParams: url })
    act(() => result.current.leaveModesFor('openAddBlock'))
    expect(url.get('placeJob')).toBeNull()
    expect(input.closeAddBlockWindow).not.toHaveBeenCalled()

    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const add = mount({ searchParams: url })
    act(() => add.result.current.leaveModesFor('closeAddBlock'))
    expect(url.get('placeJob')).toBeNull()
    expect(input.closeAddBlockWindow).toHaveBeenCalledTimes(1)

    url = new URLSearchParams(`week=${WEEK}&placeJob=job-9`)
    const tab = mount({ searchParams: url })
    act(() => tab.result.current.leaveModesFor('tabAway'))
    expect(url.get('placeJob')).toBeNull()
  })

  it('the new-job path leaves the picker’s intent as it was', () => {
    const { result } = mount()
    act(() => result.current.onRequestHubMultiCellAddMode())
    act(() => result.current.onHubMultiCellAddToggle('u-dana', '2026-10-07'))
    act(() => result.current.onRequestHubMultiCellAddChooseJob())
    act(() => result.current.leaveModesFor('newJob'))
    expect(result.current.hubAssignJobPickerOpen).toBe(false)
    expect(result.current.hubAssignJobPickerIntent).toBe('multi')
  })
})
