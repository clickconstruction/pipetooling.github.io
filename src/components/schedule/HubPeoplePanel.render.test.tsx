// @vitest-environment jsdom
/**
 * Render smoke for the Schedule Dispatch hub's People tab: who is listed and
 * in what groups, the search and the View menu, the toolbar's doors, the
 * missing-notes badge, the empty states, and the sections it draws under the
 * grid.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
const phone = vi.hoisted(() => ({ isMobile: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone.isMobile }))

import { HubPeoplePanel, type HubPeoplePanelProps } from './HubPeoplePanel'
import type { DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { buildPersonDayBlockMap } from '../../lib/scheduleDispatchHub'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30']
const MON = '2026-09-28'
const SORT_KEY = 'pipetooling_dispatch_people_sort_v1'

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk-1',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: MON,
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: 'Set the water heater',
    shared_block_group_id: null,
    created_by: null,
    created_at: '2026-09-25T15:00:00Z',
    updated_at: '2026-09-25T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
    ...over,
  }
}

const PEOPLE = [
  { userId: 'abraham', displayName: 'Abraham' },
  { userId: 'cruz', displayName: 'Cruz' },
  { userId: 'paige', displayName: 'Paige' },
]
const WEEK = [
  block({ id: 'blk-1', assignee_user_id: 'abraham', note: null }),
  block({ id: 'blk-2', assignee_user_id: 'paige', job_id: 'job-2', work_date: '2026-09-29' }),
]
const TITLES: Record<string, string> = { 'job-1': 'J927 · Berg AirBnb', 'job-2': 'J412 · Rough-in' }
const LANES: DispatchSwimLanesData = {
  lanes: [{ id: 'lane-1', name: 'Underground crew' }] as DispatchSwimLanesData['lanes'],
  memberIdsByLaneId: new Map([['lane-1', ['paige', 'cruz']]]),
  laneIdByUserId: new Map([
    ['paige', 'lane-1'],
    ['cruz', 'lane-1'],
  ]),
}

function makeProps(over: Partial<HubPeoplePanelProps> = {}): HubPeoplePanelProps {
  return {
    visibleDayKeys: DAYS,
    hideWeekend: true,
    onHideWeekendChange: vi.fn(),
    allPeopleRows: PEOPLE,
    userIdsWithBlocksThisWeek: new Set(['abraham', 'paige']),
    salariedUserIds: new Set(['cruz']),
    personDayBlocks: buildPersonDayBlockMap(WEEK),
    getJobDisplayTitle: (id) => TITLES[id] ?? '— · Job',
    groupMemberCountByGroupId: new Map(),
    scheduleTodayYmd: MON,
    canEdit: true,
    loading: false,
    jobsError: null,
    summariesError: null,
    onOpenJob: vi.fn(),
    onOpenHubJobDetail: vi.fn(),
    cardPlacementMode: null,
    placementSourceWorkDate: null,
    plusMenuBlockId: null,
    onPlusMenuBlockIdChange: vi.fn(),
    onStartCardPlacement: vi.fn(),
    onCardPlacementCellPick: vi.fn(),
    highlightLinkedGroups: false,
    onHighlightLinkedGroupsChange: vi.fn(),
    linkedGroupAccentByGroupId: new Map(),
    onOpenLinkedGroup: vi.fn(),
    hubWeekBlocks: WEEK,
    hubExpectedManpowerDayKey: MON,
    onHubExpectedManpowerDayChange: vi.fn(),
    hubPeopleNameById: new Map(PEOPLE.map((p) => [p.userId, p.displayName])),
    canShowExpectedManpowerPayroll: false,
    hubHourlyWageByUserId: new Map(),
    hubAssignJobPlacement: null,
    onHubAssignJobCellPick: vi.fn(),
    onDeleteBlock: vi.fn(),
    onEmptyCellClick: vi.fn(),
    onAddJobToScheduleForCell: vi.fn(),
    hubMultiCellAddActive: false,
    hubMultiCellAddSelectedKeys: new Set<string>(),
    onHubMultiCellAddToggle: vi.fn(),
    onRequestHubAddJob: vi.fn(),
    onRequestHubMultiCellAddMode: vi.fn(),
    columnFocusDayYmd: '',
    columnScrollKey: 'k',
    showExpectedManpower: false,
    ...over,
  }
}

async function renderPanel(over: Partial<HubPeoplePanelProps> = {}) {
  const props = makeProps(over)
  const view = renderWithProviders(
    <DndContext>
      <HubPeoplePanel {...props} />
    </DndContext>,
  )
  await settle()
  return { ...view, props }
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
/** The person rows, in order, by the id the page scrolls to. */
const personRows = (container: HTMLElement) =>
  [...container.querySelectorAll('tr[id^="hub-person-row-"]')].map((r) => r.id.replace('hub-person-row-', ''))

/**
 * jsdom has no `scrollTo` on an element. The panel scrolls the focused day's column into view one
 * animation frame after it renders, so without these the call throws after the test that caused it
 * has already passed — an unhandled error in the run, not a failure in the case.
 */
const scrollTo = vi.fn()
const scrollIntoView = vi.fn()
const nextFrame = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

beforeEach(() => {
  phone.isMobile = false
  localStorage.clear()
  scrollTo.mockReset()
  scrollIntoView.mockReset()
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
})

describe('HubPeoplePanel — who is listed', () => {
  it('draws a row per person and a column per visible day', async () => {
    const { container } = await renderPanel()
    expect(personRows(container)).toEqual(['abraham', 'cruz', 'paige'])
    const heads = [...container.querySelectorAll('thead th')].map((h) => text(h))
    expect(heads.slice(1).map((h) => h.slice(0, 11))).toEqual(['Mon (09/28)', 'Tue (09/29)', 'Wed (09/30)'])
    expect(text(container)).toContain('J927 · Berg AirBnb')
    expect(text(container)).toContain('J412 · Rough-in')
  })

  it('marks a salaried person', async () => {
    const { container } = await renderPanel()
    const cruz = container.querySelector('#hub-person-row-cruz')
    expect(cruz?.querySelector('[aria-label="Salaried (Pay settings)"]')).toBeTruthy()
    expect(container.querySelector('#hub-person-row-abraham [aria-label="Salaried (Pay settings)"]')).toBeNull()
  })

  it('groups people under their crew, the crew first and everyone else after', async () => {
    const { container } = await renderPanel({ swimLanes: LANES })
    expect(personRows(container)).toEqual(['paige', 'cruz', 'abraham'])
    expect(text(container)).toContain('Underground crew')
  })

  it('cycles the sort from crews to the alphabet to roles, and remembers it on the device', async () => {
    const { container } = await renderPanel({
      swimLanes: LANES,
      roleByUserId: new Map([
        ['abraham', 'helpers'],
        ['cruz', 'master_technician'],
        ['paige', 'helpers'],
      ]),
    })
    fireEvent.click(screen.getByRole('button', { name: 'People grouped by swim lanes. Click to sort alphabetically.' }))
    expect(personRows(container)).toEqual(['abraham', 'cruz', 'paige'])
    expect(localStorage.getItem(SORT_KEY)).toBe('alpha')

    fireEvent.click(screen.getByRole('button', { name: 'People sorted alphabetically. Click to group by role.' }))
    expect(personRows(container)).toEqual(['cruz', 'abraham', 'paige'])
    expect(text(container)).toContain('Leaders')
    expect(localStorage.getItem(SORT_KEY)).toBe('role')

    fireEvent.click(screen.getByRole('button', { name: 'People grouped by role. Click to group by swim lanes.' }))
    expect(localStorage.getItem(SORT_KEY)).toBe('lanes')
  })

  it('opens on the sort the device remembers', async () => {
    localStorage.setItem(SORT_KEY, 'alpha')
    await renderPanel({ swimLanes: LANES })
    expect(screen.getByRole('button', { name: 'People sorted alphabetically. Click to group by role.' })).toBeTruthy()
  })
})

describe('HubPeoplePanel — the search and the View menu', () => {
  it('narrows the rows to a name, or to a job someone is on', async () => {
    const { container } = await renderPanel()
    const search = screen.getByRole('searchbox', { name: 'Search person or job' })
    fireEvent.change(search, { target: { value: 'pai' } })
    expect(personRows(container)).toEqual(['paige'])
    fireEvent.change(search, { target: { value: 'berg' } })
    expect(personRows(container)).toEqual(['abraham'])
  })

  it('says nobody matches the search', async () => {
    const { container } = await renderPanel()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search person or job' }), { target: { value: 'zzz' } })
    expect(personRows(container)).toEqual([])
    expect(text(container)).toContain('No people match your search.')
  })

  it('hides the people with nothing this week, and reports the other two switches to the page', async () => {
    const { container, props } = await renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'View options: hide inactive, hide weekend, highlight linked' }))
    fireEvent.click(screen.getByLabelText('Hide Inactive'))
    expect(personRows(container)).toEqual(['abraham', 'paige'])
    fireEvent.click(screen.getByLabelText('Hide Saturday and Sunday columns'))
    expect(props.onHideWeekendChange).toHaveBeenCalledWith(false)
    fireEvent.click(
      screen.getByLabelText('Highlight linked: matching border and background on mirrored crew blocks'),
    )
    expect(props.onHighlightLinkedGroupsChange).toHaveBeenCalledWith(true)
  })

  it('leaves Hide weekend out of the menu for an embed that turns it off', async () => {
    await renderPanel({ showHideWeekendToggle: false })
    fireEvent.click(screen.getByRole('button', { name: 'View options: hide inactive, hide weekend, highlight linked' }))
    expect(screen.getByLabelText('Hide Inactive')).toBeTruthy()
    expect(screen.queryByLabelText('Hide Saturday and Sunday columns')).toBeNull()
  })

  it('says so when Hide Inactive leaves nobody', async () => {
    const { container } = await renderPanel({ userIdsWithBlocksThisWeek: new Set() })
    fireEvent.click(screen.getByRole('button', { name: 'View options: hide inactive, hide weekend, highlight linked' }))
    fireEvent.click(screen.getByLabelText('Hide Inactive'))
    expect(text(container)).toContain('No people have schedule blocks this week.')
  })
})

describe('HubPeoplePanel — the toolbar and the grid', () => {
  it('sends Add job and the multi-cell mode to the page', async () => {
    const { props } = await renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Add job' }))
    expect(props.onRequestHubAddJob).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /multiple|several|cells/i }))
    expect(props.onRequestHubMultiCellAddMode).toHaveBeenCalledTimes(1)
  })

  it('offers no way to add to someone who cannot edit', async () => {
    await renderPanel({ canEdit: false })
    expect(screen.queryByRole('button', { name: 'Add job' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add job to schedule for this person and day' })).toBeNull()
  })

  it('hands an empty cell’s click to the page with the person and the day', async () => {
    const { container, props } = await renderPanel()
    const cell = container.querySelectorAll('#hub-person-row-cruz td')[2] as HTMLElement
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).toHaveBeenCalledWith('cruz', '2026-09-29')
  })

  it('counts the cards missing job instructions over today’s column', async () => {
    await renderPanel()
    expect(screen.getByLabelText('1 card missing job instructions for Mon (09/28)')).toBeTruthy()
  })

  it('counts none over a day that has passed', async () => {
    await renderPanel({ scheduleTodayYmd: '2026-09-29', columnFocusDayYmd: MON })
    await nextFrame()
    expect(screen.queryByLabelText(/missing job instructions/)).toBeNull()
  })

  it('brings the focused day’s column into view, scrolling the grid and nothing above it', async () => {
    await renderPanel({ columnFocusDayYmd: '2026-09-30' })
    await nextFrame()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls nowhere with no day in focus, or while the week is loading', async () => {
    const idle = await renderPanel()
    await nextFrame()
    idle.unmount()
    await renderPanel({ columnFocusDayYmd: '2026-09-30', loading: true })
    await nextFrame()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('offers each person as a target while linked copies are being applied', async () => {
    const onLinkedCopyApplyToPerson = vi.fn()
    await renderPanel({
      linkedCopyMode: { stage: 2, selectedBlockIds: new Set(['blk-1']) },
      onLinkedCopyApplyToPerson,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply linked copies to Paige' }))
    expect(onLinkedCopyApplyToPerson).toHaveBeenCalledWith('paige')
  })
})

describe('HubPeoplePanel — around the grid', () => {
  it('shows the two load errors and the right empty line', async () => {
    const { container } = await renderPanel({
      allPeopleRows: [],
      jobsError: 'Could not load jobs.',
      summariesError: 'timeout',
    })
    expect(text(container)).toContain('Could not load jobs.')
    expect(text(container)).toContain('Could not load schedule blocks for this week (timeout). People grid is empty.')
    expect(text(container)).toContain('No people to show.')
  })

  it('draws Expected Manpower under the grid, and none of it for an embed that turns it off', async () => {
    const on = await renderPanel({ showExpectedManpower: true })
    expect(screen.getByRole('heading', { name: 'Expected Manpower' })).toBeTruthy()
    expect(text(on.container)).toContain('Mon (09/28): 4 person-hours · 1 job · 1 person')
    on.unmount()
    await renderPanel({ showExpectedManpower: false })
    expect(screen.queryByRole('heading', { name: 'Expected Manpower' })).toBeNull()
  })

  it('draws the week navigation it is handed', async () => {
    await renderPanel({ weekNav: <span>week nav here</span> })
    expect(screen.getByText('week nav here')).toBeTruthy()
  })

  it('on a phone, puts the search behind a magnifier', async () => {
    phone.isMobile = true
    const { container } = await renderPanel()
    expect(screen.queryByRole('searchbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Search person or job' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search person or job' }), { target: { value: 'pai' } })
    expect(personRows(container)).toEqual(['paige'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and close' }))
    expect(personRows(container)).toEqual(['abraham', 'cruz', 'paige'])
  })
})

describe('HubPeoplePanel — the phone board and the grid', () => {
  const board = () => screen.queryByTestId('hub-people-phone-board')
  const toGrid = () => screen.queryByRole('button', { name: '▦ Show the desktop view' })
  const toBoard = () => screen.queryByRole('button', { name: '📱 Back to the phone view' })

  it('draws the board in place of the grid and its toolbar', async () => {
    const { container } = await renderPanel({ phonePeopleView: 'board', onPhonePeopleViewChange: vi.fn() })
    expect(board()).toBeTruthy()
    expect(personRows(container)).toEqual([])
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'View options: hide inactive, hide weekend, highlight linked' }),
    ).toBeNull()
  })

  it('draws the grid when the page picks it, with the way back to the board under it', async () => {
    const onPhonePeopleViewChange = vi.fn()
    const { container } = await renderPanel({ phonePeopleView: 'grid', onPhonePeopleViewChange })
    expect(board()).toBeNull()
    expect(personRows(container)).toEqual(['abraham', 'cruz', 'paige'])
    fireEvent.click(toBoard()!)
    expect(onPhonePeopleViewChange).toHaveBeenCalledWith('board')
  })

  it('offers the desktop view from the board, and reports the pick to the page', async () => {
    const onPhonePeopleViewChange = vi.fn()
    await renderPanel({ phonePeopleView: 'board', onPhonePeopleViewChange })
    fireEvent.click(toGrid()!)
    expect(onPhonePeopleViewChange).toHaveBeenCalledWith('grid')
  })

  it('draws the grid and no switch for an embed, which hands it neither', async () => {
    const { container } = await renderPanel()
    expect(board()).toBeNull()
    expect(toGrid()).toBeNull()
    expect(toBoard()).toBeNull()
    expect(personRows(container)).toHaveLength(3)
  })

  it('draws the grid when it is told "board" but given no way to change it', async () => {
    const { container } = await renderPanel({ phonePeopleView: 'board' })
    expect(board()).toBeNull()
    expect(personRows(container)).toHaveLength(3)
  })

  it('puts the switch away while something is being placed', async () => {
    const onPhonePeopleViewChange = vi.fn()
    for (const over of [
      { cardPlacementMode: { sourceBlockId: 'blk-1', variant: 'move' as const }, placementSourceWorkDate: MON },
      { hubAssignJobPlacement: { jobId: 'job-2' } },
      { linkedCopyMode: { stage: 1 as const, selectedBlockIds: new Set<string>() } },
      { hubMultiCellAddActive: true },
    ]) {
      const view = await renderPanel({ phonePeopleView: 'grid', onPhonePeopleViewChange, ...over })
      expect(toBoard()).toBeNull()
      view.unmount()
    }
  })

  it('drops a search and Hide Inactive left on in the grid, so the board is not thinned by them', async () => {
    const onPhonePeopleViewChange = vi.fn()
    const props = makeProps({ phonePeopleView: 'grid', onPhonePeopleViewChange })
    const view = renderWithProviders(
      <DndContext>
        <HubPeoplePanel {...props} />
      </DndContext>,
    )
    await settle()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search person or job' }), { target: { value: 'pai' } })
    fireEvent.click(screen.getByRole('button', { name: 'View options: hide inactive, hide weekend, highlight linked' }))
    fireEvent.click(screen.getByLabelText('Hide Inactive'))
    expect(personRows(view.container)).toEqual(['paige'])

    view.rerender(
      <DndContext>
        <HubPeoplePanel {...props} phonePeopleView="board" />
      </DndContext>,
    )
    await settle()
    expect(board()).toBeTruthy()
    // Everyone is on the board again — Cruz has no block this week and does not match "pai".
    expect(screen.getAllByText('Cruz').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Abraham').length).toBeGreaterThan(0)

    view.rerender(
      <DndContext>
        <HubPeoplePanel {...props} phonePeopleView="grid" />
      </DndContext>,
    )
    await settle()
    expect(personRows(view.container)).toEqual(['abraham', 'cruz', 'paige'])
    expect((screen.getByRole('searchbox', { name: 'Search person or job' }) as HTMLInputElement).value).toBe('')
  })

  it('keeps Expected Manpower under the board', async () => {
    await renderPanel({ phonePeopleView: 'board', onPhonePeopleViewChange: vi.fn(), showExpectedManpower: true })
    expect(board()).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Expected Manpower' })).toBeTruthy()
  })
})
