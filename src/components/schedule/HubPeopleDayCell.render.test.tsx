// @vitest-environment jsdom
/**
 * Render smoke for one person × day cell of the Schedule Dispatch hub's People
 * grid: what an empty cell offers, what a card carries, and which of the page's
 * modes takes a click on the cell.
 */
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { HubPeopleDayCell } from './HubPeopleDayCell'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { hubPersonDayKey } from '../../lib/scheduleDispatchHub'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

type CellProps = ComponentProps<typeof HubPeopleDayCell>
const DAY = '2026-09-28'

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk-1',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: DAY,
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

function makeProps(over: Partial<CellProps> = {}): CellProps {
  return {
    personUserId: 'abraham',
    workDate: DAY,
    scheduleTodayYmd: DAY,
    columnFocusDayYmd: '',
    cellBlocks: [],
    canEdit: true,
    cardPlacementMode: null,
    placementSourceWorkDate: null,
    plusMenuBlockId: null,
    onPlusMenuBlockIdChange: vi.fn(),
    onStartCardPlacement: vi.fn(),
    onCardPlacementCellPick: vi.fn(),
    groupMemberCountByGroupId: new Map(),
    getJobDisplayTitle: (id) => (id === 'job-1' ? 'J927 · Berg AirBnb' : 'Bid visit · B375 · Tower West'),
    getJobAddress: () => '',
    onOpenJob: vi.fn(),
    onOpenHubJobDetail: vi.fn(),
    highlightLinkedGroups: false,
    linkedGroupAccentByGroupId: new Map(),
    onOpenLinkedGroup: vi.fn(),
    hubAssignJobPlacement: null,
    onHubAssignJobCellPick: vi.fn(),
    onDeleteBlock: vi.fn(),
    onEmptyCellClick: vi.fn(),
    onAddJobToScheduleForCell: vi.fn(),
    hubMultiCellAddActive: false,
    hubMultiCellAddSelectedKeys: new Set<string>(),
    onHubMultiCellAddToggle: vi.fn(),
    onRequestEditBlockNote: vi.fn(),
    onOpenPersonDay: vi.fn(),
    onRequestUndoNotComingIn: vi.fn(),
    onMarkNotComingInForCell: vi.fn(),
    ...over,
  }
}

/** The cell is a drop target and its cards are draggable, so it only renders inside a DndContext and a table row. */
async function renderCell(over: Partial<CellProps> = {}) {
  const props = makeProps(over)
  const view = renderWithProviders(
    <DndContext>
      <table>
        <tbody>
          <tr>
            <HubPeopleDayCell {...props} />
          </tr>
        </tbody>
      </table>
    </DndContext>,
  )
  await settle()
  const cell = view.container.querySelector('td') as HTMLTableCellElement
  return { ...view, props, cell }
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('HubPeopleDayCell — an empty cell', () => {
  it('offers Add and off, and both go to the page with the person and the day', async () => {
    const { props } = await renderCell()
    fireEvent.click(screen.getByRole('button', { name: 'Add job to schedule for this person and day' }))
    expect(props.onEmptyCellClick).toHaveBeenCalledWith('abraham', DAY)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as not coming in this day' }))
    expect(props.onMarkNotComingInForCell).toHaveBeenCalledWith('abraham', DAY)
  })

  it('takes a click anywhere on the cell as Add', async () => {
    const { props, cell } = await renderCell()
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).toHaveBeenCalledWith('abraham', DAY)
  })

  it('offers nothing to someone who cannot edit', async () => {
    const { props, cell } = await renderCell({ canEdit: false })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
  })

  it('leaves off out when the page does not hand it the write', async () => {
    await renderCell({ onMarkNotComingInForCell: undefined })
    expect(screen.getByRole('button', { name: 'Add job to schedule for this person and day' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark as not coming in this day' })).toBeNull()
  })
})

describe('HubPeopleDayCell — a cell with blocks', () => {
  it('draws a card per block with its job, and the card’s tools', async () => {
    const { cell } = await renderCell({
      cellBlocks: [block(), block({ id: 'blk-2', job_id: null, bid_id: 'bid-9', time_start: '13:00:00', time_end: '15:00:00' })],
    })
    expect(text(cell)).toContain('J927 · Berg AirBnb')
    expect(text(cell)).toContain('Bid visit · B375 · Tower West')
    expect(screen.getAllByRole('button', { name: 'Remove block' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Edit job instructions' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: "See this person's whole day" })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Copy block to another cell' })).toHaveLength(2)
  })

  it('sends Remove, the note and the whole day to the page with the block', async () => {
    const b = block()
    const { props } = await renderCell({ cellBlocks: [b] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove block' }))
    expect(props.onDeleteBlock).toHaveBeenCalledWith('blk-1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit job instructions' }))
    expect(props.onRequestEditBlockNote).toHaveBeenCalledWith(b)
    fireEvent.click(screen.getByRole('button', { name: "See this person's whole day" }))
    expect(props.onOpenPersonDay).toHaveBeenCalledWith(b)
  })

  it('asks the page to open the copy menu for that block', async () => {
    const { props } = await renderCell({ cellBlocks: [block()] })
    fireEvent.click(screen.getByRole('button', { name: 'Copy block to another cell' }))
    expect(props.onPlusMenuBlockIdChange).toHaveBeenCalledWith('blk-1')
  })

  it('keeps the add door as a corner button, and does not take a click on the cell', async () => {
    const { props, cell } = await renderCell({ cellBlocks: [block()] })
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Add job to schedule for this person and day' }))
    expect(props.onAddJobToScheduleForCell).toHaveBeenCalledWith('abraham', DAY)
  })

  it('takes the tools away from someone who cannot edit', async () => {
    await renderCell({ cellBlocks: [block()], canEdit: false })
    expect(screen.queryByRole('button', { name: 'Remove block' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit job instructions' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy block to another cell' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add job to schedule for this person and day' })).toBeNull()
  })

  it('marks a block nobody on it can run', async () => {
    await renderCell({ cellBlocks: [block()], blockCoverageByKey: new Map([['blk-1', 'unsupervised']]) })
    expect(screen.queryByTestId('hub-unsupervised-pill')).toBeTruthy()
  })
})

describe('HubPeopleDayCell — the page’s modes take the click', () => {
  it('while a job is being placed, a click picks the cell', async () => {
    const { props, cell } = await renderCell({ hubAssignJobPlacement: { jobId: 'job-2' } })
    fireEvent.click(cell)
    expect(props.onHubAssignJobCellPick).toHaveBeenCalledWith('abraham', DAY)
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Add job to schedule for this person and day' })).toBeNull()
  })

  it('while a copy is being placed, a click picks the cell', async () => {
    const { props, cell } = await renderCell({
      cardPlacementMode: { sourceBlockId: 'blk-9', variant: 'unlinked' },
      placementSourceWorkDate: '2026-09-29',
    })
    fireEvent.click(cell)
    expect(props.onCardPlacementCellPick).toHaveBeenCalledWith('abraham', DAY)
  })

  it('a linked copy only lands on the day of the block it copies', async () => {
    const { props, cell } = await renderCell({
      cardPlacementMode: { sourceBlockId: 'blk-9', variant: 'linked' },
      placementSourceWorkDate: '2026-09-29',
    })
    fireEvent.click(cell)
    expect(props.onCardPlacementCellPick).not.toHaveBeenCalled()
  })

  it('while cells are being selected, a click toggles the cell, blocks or not', async () => {
    const { props, cell } = await renderCell({
      cellBlocks: [block()],
      hubMultiCellAddActive: true,
      hubMultiCellAddSelectedKeys: new Set([hubPersonDayKey('abraham', DAY)]),
    })
    fireEvent.click(cell)
    expect(props.onHubMultiCellAddToggle).toHaveBeenCalledWith('abraham', DAY)
    expect(cell.style.border).toContain('2px solid')
    expect(screen.queryByRole('button', { name: 'Add job to schedule for this person and day' })).toBeNull()
  })
})

describe('HubPeopleDayCell — time off and hidden blocks', () => {
  const notComingIn = { variant: 'not_coming_in' as const, label: 'Not coming in', note: null, kind: 'unpaid' }

  it('shows the day off as a chip that asks the page to undo it, and takes no other click', async () => {
    const { props, cell } = await renderCell({ timeOffInfo: notComingIn })
    expect(text(cell)).toContain('Not coming in')
    expect(screen.queryByRole('button', { name: 'Add job to schedule for this person and day' })).toBeNull()
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Click to mark as coming in' }))
    expect(props.onRequestUndoNotComingIn).toHaveBeenCalledWith('abraham', DAY)
  })

  it('does not pick a cell with time off while a job is being placed', async () => {
    const { props, cell } = await renderCell({ timeOffInfo: notComingIn, hubAssignJobPlacement: { jobId: 'job-2' } })
    fireEvent.click(cell)
    expect(props.onHubAssignJobCellPick).not.toHaveBeenCalled()
  })

  it('draws a grey box per hidden block, six at most, and is not an empty cell', async () => {
    const { props, cell } = await renderCell({ hiddenInfo: { count: 8, hours: 20 } })
    const busy = screen.getByTestId('hub-hidden-busy')
    expect(text(busy)).toBe('busybusybusybusybusybusy+2 more')
    expect(busy.getAttribute('title')).toBe('Busy on work outside your projects (8 blocks) — details are hidden')
    fireEvent.click(cell)
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Mark as not coming in this day' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add job to schedule for this person and day' }))
    expect(props.onAddJobToScheduleForCell).toHaveBeenCalledWith('abraham', DAY)
  })

  it('shows how many subs are on the person’s job that day', async () => {
    await renderCell({ cellBlocks: [block()], subBadge: { count: 2, titles: ['Rough-in · #1004', 'Trim · #1004'] } })
    expect(screen.getByTestId('hub-sub-badge').getAttribute('title')).toBe('Rough-in · #1004\nTrim · #1004')
  })
})
