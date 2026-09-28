// @vitest-environment jsdom
/**
 * Render smoke for the Schedule Dispatch hub's People tab: who is listed and
 * in what groups, the search and the View menu, the toolbar's doors, the
 * missing-notes badge, the empty states, and the sections it draws under the
 * grid.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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

beforeEach(() => {
  phone.isMobile = false
  localStorage.clear()
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
    expect(screen.queryByLabelText(/missing job instructions/)).toBeNull()
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
