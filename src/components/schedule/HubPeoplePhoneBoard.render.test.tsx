// @vitest-environment jsdom
/**
 * Render smoke for the People board on a phone (v2.3156): cards for the selected day, the day
 * strip, the placement target in a copy mode, the Copy to techs sheet, and the bottom switch.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { hubPersonDayKey } from '../../lib/scheduleDispatchHub'
import { HubPeoplePhoneBoard, type HubPeoplePhoneBoardProps } from './HubPeoplePhoneBoard'

function block(id: string, assignee: string, workDate: string, start: string, end: string, extra: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id,
    assignee_user_id: assignee,
    work_date: workDate,
    time_start: start,
    time_end: end,
    job_id: `job-${id}`,
    bid_id: null,
    note: null,
    shared_block_group_id: null,
    created_at: '2026-09-07T00:00:00Z',
    created_by: 'u0',
    field_moved_at: null,
    field_moved_from: null,
    updated_at: '2026-09-07T00:00:00Z',
    ...extra,
  } as JobScheduleBlockRow
}

const week = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
const blocks = [
  block('b1', 'abraham', '2026-09-08', '08:00', '12:00', { shared_block_group_id: 'g1' }),
  block('b2', 'abraham', '2026-09-08', '12:00', '16:00'),
  block('b3', 'paige', '2026-09-08', '08:00', '12:00', { shared_block_group_id: 'g1' }),
  block('b4', 'taunya', '2026-09-08', '08:00', '17:00'),
  block('b5', 'paige', '2026-09-09', '09:00', '11:00'),
]
const personDayBlocks = new Map<string, JobScheduleBlockRow[]>()
for (const b of blocks) {
  const k = hubPersonDayKey(b.assignee_user_id, b.work_date)
  personDayBlocks.set(k, [...(personDayBlocks.get(k) ?? []), b])
}
const titles: Record<string, string> = { 'job-b1': 'J650 · ATI Schertz', 'job-b2': 'J927 · Mike Holub', 'job-b3': 'J650 · ATI Schertz', 'job-b4': 'J000 · Office', 'job-b5': 'J700 · Later' }

function baseProps(overrides: Partial<HubPeoplePhoneBoardProps> = {}): HubPeoplePhoneBoardProps {
  return {
    visibleDayKeys: week,
    scheduleTodayYmd: '2026-09-08',
    columnFocusDayYmd: '2026-09-08',
    peopleDisplayRows: [
      { kind: 'heading', key: 'lane-1', label: 'Team Abraham', laneMemberUserIds: ['abraham', 'paige'] },
      { kind: 'person', person: { userId: 'abraham', displayName: 'Abraham' } },
      { kind: 'person', person: { userId: 'paige', displayName: 'Paige' } },
      { kind: 'heading', key: 'lane-2', label: 'Office', laneMemberUserIds: ['taunya'] },
      { kind: 'person', person: { userId: 'taunya', displayName: 'Taunya' } },
    ],
    personDayBlocks,
    hubWeekBlocks: blocks,
    hubPeopleNameById: new Map([
      ['abraham', 'Abraham'],
      ['paige', 'Paige'],
      ['taunya', 'Taunya'],
    ]),
    getJobDisplayTitle: (id) => titles[id] ?? id,
    getJobAddress: () => '5498 Cibolo Valley Dr',
    salariedUserIds: new Set(['abraham']),
    missingNoteCount: 2,
    missingNoteDayYmd: '2026-09-08',
    canEdit: true,
    loading: false,
    cardPlacementMode: null,
    hubAssignJobPlacement: null,
    linkedCopyMode: null,
    hubMultiCellAddActive: false,
    hubMultiCellAddSelectedKeys: new Set(),
    onCardPlacementCellPick: vi.fn(),
    onHubAssignJobCellPick: vi.fn(),
    onStartCardPlacement: vi.fn(),
    onOpenHubJobDetail: vi.fn(),
    onOpenJob: vi.fn(),
    onDeleteBlock: vi.fn(),
    onShowDesktopView: vi.fn(),
    onAddJobToScheduleForCell: vi.fn(),
    onCopyBlockToPeople: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('HubPeoplePhoneBoard (v2.3156)', () => {
  it('shows the day strip with counts, a card per tech for the selected day, and the bottom switch', () => {
    const props = baseProps()
    render(<HubPeoplePhoneBoard {...props} />)
    expect(screen.getByRole('tab', { name: /Tue 8 \(today\): 4 · 2 no note/ })).toBeTruthy()
    expect(screen.getByText('Abraham')).toBeTruthy()
    expect(screen.getByText('J927 · Mike Holub')).toBeTruthy()
    expect(screen.getByText(/linked with Paige/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Add a job for/ })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Add a job for Paige' }))
    expect(props.onAddJobToScheduleForCell).toHaveBeenCalledWith('paige', '2026-09-08')
    fireEvent.click(screen.getByText('▦ Show the desktop view'))
    expect(props.onShowDesktopView).toHaveBeenCalledTimes(1)
    // switch day
    fireEvent.click(screen.getByRole('tab', { name: /Wed 9/ }))
    expect(screen.getByText('J700 · Later')).toBeTruthy()
    expect(screen.queryByText('J927 · Mike Holub')).toBeNull()
  })

  it('in a copy mode every tech card is the button and says what will land; the source is not', () => {
    const props = baseProps({ cardPlacementMode: { sourceBlockId: 'b2', variant: 'linked' } })
    render(<HubPeoplePhoneBoard {...props} />)
    const paige = screen.getByRole('button', { name: /Paige: Tap to add J927 · Mike Holub · 12–4 here/ })
    fireEvent.click(paige)
    expect(props.onCardPlacementCellPick).toHaveBeenCalledWith('paige', '2026-09-08')
    expect(screen.getByRole('button', { name: /Taunya: Busy 8–5 · J000 · Office/ })).toBeTruthy()
    const abraham = screen.getByRole('button', { name: /Abraham: Already on J927/ }) as HTMLButtonElement
    expect(abraham.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Copying J927 · Mike Holub · 12–4 to…')
  })

  it('tapping a block opens its sheet; Copy to techs lists the other techs with availability and sends the pick', async () => {
    const props = baseProps()
    render(<HubPeoplePhoneBoard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^J927 · Mike Holub 12–4$/ }))
    const sheet = screen.getByRole('dialog', { name: 'J927 · Mike Holub' })
    fireEvent.click(within(sheet).getByText('Copy to techs'))
    expect(screen.getByRole('dialog', { name: /Copy J927 · Mike Holub · 12–4 to…/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Paige — free 12–4' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Taunya — busy 8–5' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /Abraham/ })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paige — free 12–4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to 1 tech' }))
    await Promise.resolve()
    expect(props.onCopyBlockToPeople).toHaveBeenCalledWith({ blockId: 'b2', userIds: ['paige'], linked: true })
  })

  it('linked-copy stage 1 turns block rows into checkboxes; stage 2 makes cards and team bands the targets', () => {
    const toggle = vi.fn()
    const apply = vi.fn()
    const lane = vi.fn()
    const { rerender } = render(<HubPeoplePhoneBoard {...baseProps({ linkedCopyMode: { stage: 1, selectedBlockIds: new Set() }, onLinkedCopyToggleBlock: toggle })} />)
    fireEvent.click(screen.getByRole('button', { name: /J927 · Mike Holub 12–4 \(tap to select\)/ }))
    expect(toggle).toHaveBeenCalledWith('b2')
    rerender(<HubPeoplePhoneBoard {...baseProps({ linkedCopyMode: { stage: 2, selectedBlockIds: new Set(['b2']) }, onLinkedCopyApplyToPerson: apply, onLinkedCopyApplyToLane: lane })} />)
    fireEvent.click(screen.getByRole('button', { name: /Paige: Tap to add/ }))
    expect(apply).toHaveBeenCalledWith('paige')
    fireEvent.click(screen.getAllByRole('button', { name: 'Whole team' })[1]!)
    expect(lane).toHaveBeenCalledWith('Office', ['taunya'])
  })
})
