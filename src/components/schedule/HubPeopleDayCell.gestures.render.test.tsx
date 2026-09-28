// @vitest-environment jsdom
/**
 * The gestures on a block card in the Schedule Dispatch hub's People grid:
 * a real drag from one cell to another (through the sensor and the collision
 * rule the page uses), press-and-hold, the phone's tap on the grip, and the
 * grip of a card that cannot be dragged.
 */
import type { ComponentProps } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'

const writes = vi.hoisted(() => ({
  fetchScheduleBlocksForAssigneesOnDay: vi.fn(),
  updateJobScheduleBlock: vi.fn(),
}))
const toast = vi.hoisted(() => ({ showToast: vi.fn(), showActionToast: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
// The card's own toast is read off the call, not off the screen: waiting for it to paint is a race on a busy machine.
vi.mock('../../contexts/ToastContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../contexts/ToastContext')>()),
  useToastContext: () => toast,
}))
vi.mock('../../lib/jobScheduleBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/jobScheduleBlocks')>()),
  ...writes,
}))

import { HubPeopleDayCell } from './HubPeopleDayCell'
import { LONG_PRESS_MS } from '../../hooks/useLongPress'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { parseScheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { executeScheduleDispatchBlockReassign } from '../../lib/scheduleDispatchDragEnd'
import { SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE } from '../../lib/scheduleDispatchDragHelp'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

type CellProps = ComponentProps<typeof HubPeopleDayCell>

/**
 * jsdom has no PointerEvent, and without one a pointer press arrives as a bare Event: no button, no
 * position, not primary — the drag sensor and the long-press both ignore it. This is the part of the
 * real thing they read.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
    this.pointerType = init.pointerType ?? 'mouse'
  }
}
const realPointerEvent = (globalThis as { PointerEvent?: unknown }).PointerEvent
beforeAll(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent
})
afterAll(() => {
  vi.unstubAllGlobals()
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = realPointerEvent
})
const MON = '2026-09-28'
const TUE = '2026-09-29'
const CELL_W = 200
const CELL_H = 100

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

function makeProps(over: Partial<CellProps> = {}): CellProps {
  return {
    personUserId: 'abraham',
    workDate: MON,
    scheduleTodayYmd: MON,
    columnFocusDayYmd: '',
    cellBlocks: [],
    canEdit: true,
    cardPlacementMode: null,
    placementSourceWorkDate: null,
    plusMenuBlockId: null,
    onPlusMenuBlockIdChange: vi.fn(),
    onStartCardPlacement: vi.fn(),
    onCardPlacementCellPick: vi.fn(),
    onRequestMoveBlock: vi.fn(),
    groupMemberCountByGroupId: new Map(),
    getJobDisplayTitle: () => 'J927 · Berg AirBnb',
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
    ...over,
  }
}

/** The grid the drag tests use: two people down, two days across. jsdom lays nothing out, so each cell is given its box. */
const GRID: Array<{ personUserId: string; workDate: string }> = [
  { personUserId: 'abraham', workDate: MON },
  { personUserId: 'abraham', workDate: TUE },
  { personUserId: 'paige', workDate: MON },
  { personUserId: 'paige', workDate: TUE },
]

function boxOf(el: Element): DOMRect {
  const td = el.closest('td')
  const cells = td ? [...(td.closest('table')?.querySelectorAll('td') ?? [])] : []
  const i = td ? cells.indexOf(td) : -1
  if (i < 0) return new DOMRect(0, 0, 0, 0)
  const col = i % 2
  const row = Math.floor(i / 2)
  // A card sits inside its cell, a little smaller; the cell is the whole box.
  return el === td
    ? new DOMRect(col * CELL_W, row * CELL_H, CELL_W, CELL_H)
    : new DOMRect(col * CELL_W + 10, row * CELL_H + 10, CELL_W - 20, CELL_H - 20)
}

function Grid({ onDragEnd, over = {} }: { onDragEnd: (e: DragEndEvent) => void; over?: Partial<CellProps> }) {
  // The page's own setup: a pointer has to travel 8px before a press becomes a drag, and the drop lands on the nearest cell.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const cells = GRID.map((c) => (
    <HubPeopleDayCell
      key={`${c.personUserId}-${c.workDate}`}
      {...makeProps({
        ...over,
        ...c,
        cellBlocks: c.personUserId === 'abraham' && c.workDate === MON ? [block()] : [],
      })}
    />
  ))
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <table>
        <tbody>
          <tr>{cells.slice(0, 2)}</tr>
          <tr>{cells.slice(2, 4)}</tr>
        </tbody>
      </table>
    </DndContext>
  )
}

const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1, bubbles: true })

/**
 * When a press on a draggable ends, dnd-kit keeps its listeners on the document for another 50 ms —
 * among them one that swallows clicks, so a card that was just dropped does not also open. A case
 * that starts inside that window loses its first click, so every press waits the window out.
 */
const DND_CLICK_GUARD_MS = 50
async function afterTheClickGuard() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, DND_CLICK_GUARD_MS + 20))
  })
}

async function drag(from: Element, to: { x: number; y: number }) {
  const start = { x: 20, y: 20 }
  await act(async () => {
    fireEvent.pointerDown(from, pointer(start.x, start.y))
  })
  // Two moves: the first crosses the 8px threshold and starts the drag, the second carries the card.
  await act(async () => {
    fireEvent.pointerMove(document, pointer(start.x + 12, start.y))
  })
  await settle()
  await act(async () => {
    fireEvent.pointerMove(document, pointer(to.x, to.y))
  })
  await settle()
  await act(async () => {
    fireEvent.pointerUp(document, pointer(to.x, to.y))
  })
  await settle()
  await afterTheClickGuard()
}

const grip = () => screen.getByLabelText('Drag to move block to another day or person row')

describe('a block card — dragging', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return boxOf(this)
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drops on the cell it is carried to, and the page can read which person and day that is', async () => {
    const onDragEnd = vi.fn()
    renderWithProviders(<Grid onDragEnd={onDragEnd} />)
    await settle()
    // From Abraham · Monday to Paige · Tuesday: one column right, one row down.
    await drag(grip(), { x: 20 + CELL_W, y: 20 + CELL_H })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
    const event = onDragEnd.mock.calls[0]![0] as DragEndEvent
    expect(event.active.id).toBe('blk-1')
    expect(parseScheduleDispatchCellDroppableId(event.over?.id)).toEqual({ workDate: TUE, assigneeUserId: 'paige' })
  })

  it('drops on the same person’s next day when carried straight across', async () => {
    const onDragEnd = vi.fn()
    renderWithProviders(<Grid onDragEnd={onDragEnd} />)
    await settle()
    await drag(grip(), { x: 20 + CELL_W, y: 20 })
    const event = onDragEnd.mock.calls[0]![0] as DragEndEvent
    expect(parseScheduleDispatchCellDroppableId(event.over?.id)).toEqual({ workDate: TUE, assigneeUserId: 'abraham' })
  })

  it('does not start a drag for a press that barely moves', async () => {
    const onDragEnd = vi.fn()
    renderWithProviders(<Grid onDragEnd={onDragEnd} />)
    await settle()
    await act(async () => {
      fireEvent.pointerDown(grip(), pointer(20, 20))
    })
    await act(async () => {
      fireEvent.pointerMove(document, pointer(24, 20))
    })
    await act(async () => {
      fireEvent.pointerUp(document, pointer(24, 20))
    })
    await settle()
    expect(onDragEnd).not.toHaveBeenCalled()
    await afterTheClickGuard()
  })

  it('swallows the click that lands with the drop, so a dropped card does not also open', async () => {
    const onDragEnd = vi.fn()
    const onOpenHubJobDetail = vi.fn()
    renderWithProviders(<Grid onDragEnd={onDragEnd} over={{ onOpenHubJobDetail }} />)
    await settle()
    const title = () => screen.getByRole('button', { name: /J927 · Berg AirBnb/ })
    await act(async () => {
      fireEvent.pointerDown(grip(), pointer(20, 20))
    })
    await act(async () => {
      fireEvent.pointerMove(document, pointer(32, 20))
    })
    await settle()
    await act(async () => {
      fireEvent.pointerMove(document, pointer(20 + CELL_W, 20))
    })
    await settle()
    // The guard is a 50 ms timer; the clock is held from the drop so the case cannot outrun it on a busy machine.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await act(async () => {
        fireEvent.pointerUp(document, pointer(20 + CELL_W, 20))
      })
      expect(onDragEnd).toHaveBeenCalledTimes(1)
      fireEvent.click(title())
      expect(onOpenHubJobDetail).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(DND_CLICK_GUARD_MS)
      })
      fireEvent.click(title())
      expect(onOpenHubJobDetail).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not land on a cell whose person has the day off', async () => {
    const onDragEnd = vi.fn()
    const off = { variant: 'not_coming_in' as const, label: 'Not coming in', note: null, kind: 'unpaid' }
    function GridWithDayOff() {
      const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table>
            <tbody>
              <tr>
                <HubPeopleDayCell {...makeProps({ cellBlocks: [block()] })} />
                <HubPeopleDayCell {...makeProps({ workDate: TUE, timeOffInfo: off })} />
              </tr>
            </tbody>
          </table>
        </DndContext>
      )
    }
    renderWithProviders(<GridWithDayOff />)
    await settle()
    await drag(grip(), { x: 20 + CELL_W, y: 20 })
    const event = onDragEnd.mock.calls[0]![0] as DragEndEvent
    // The only cell left to land on is the one the card came from.
    expect(parseScheduleDispatchCellDroppableId(event.over?.id)).toEqual({ workDate: MON, assigneeUserId: 'abraham' })
  })
})

describe('a block card — a drag, all the way to the write', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return boxOf(this)
    })
    writes.fetchScheduleBlocksForAssigneesOnDay.mockReset().mockResolvedValue({ data: [], error: null })
    writes.updateJobScheduleBlock.mockReset().mockResolvedValue({ error: null })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** The page's drag-end handler, as `ScheduleDispatchHubPage` wires it. */
  function pageDragEnd(deps: { canEdit?: boolean; showToast?: () => void; onSuccess?: () => Promise<void> } = {}) {
    const showToast = deps.showToast ?? vi.fn()
    const onSuccess = deps.onSuccess ?? vi.fn(async () => {})
    const handler = (event: DragEndEvent) =>
      void executeScheduleDispatchBlockReassign(event, {
        blockById: new Map([['blk-1', block()]]),
        canEdit: deps.canEdit ?? true,
        showToast,
        onSuccess,
      })
    return { handler, showToast, onSuccess }
  }

  it('moves the block to the person and day it was dropped on, then reloads', async () => {
    const { handler, onSuccess } = pageDragEnd()
    renderWithProviders(<Grid onDragEnd={handler} />)
    await settle()
    await drag(grip(), { x: 20 + CELL_W, y: 20 + CELL_H })
    await settle()
    expect(writes.fetchScheduleBlocksForAssigneesOnDay).toHaveBeenCalledWith(['paige'], TUE)
    expect(writes.updateJobScheduleBlock).toHaveBeenCalledWith('blk-1', { assignee_user_id: 'paige', work_date: TUE })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('changes only the day when the person is the same', async () => {
    const { handler } = pageDragEnd()
    renderWithProviders(<Grid onDragEnd={handler} />)
    await settle()
    await drag(grip(), { x: 20 + CELL_W, y: 20 })
    await settle()
    expect(writes.updateJobScheduleBlock).toHaveBeenCalledWith('blk-1', { work_date: TUE })
  })

  it('writes nothing when the card is put back where it was', async () => {
    const { handler, onSuccess } = pageDragEnd()
    renderWithProviders(<Grid onDragEnd={handler} />)
    await settle()
    await drag(grip(), { x: 20 + 30, y: 20 })
    await settle()
    expect(writes.updateJobScheduleBlock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('refuses a drop onto a time the person is already booked, and says why', async () => {
    writes.fetchScheduleBlocksForAssigneesOnDay.mockResolvedValue({
      data: [{ id: 'blk-9', time_start: '10:00:00', time_end: '14:00:00' }],
      error: null,
    })
    const { handler, showToast, onSuccess } = pageDragEnd()
    renderWithProviders(<Grid onDragEnd={handler} />)
    await settle()
    await drag(grip(), { x: 20 + CELL_W, y: 20 + CELL_H })
    await settle()
    expect(showToast).toHaveBeenCalledWith('That time overlaps another block for this person on this day.', 'error')
    expect(writes.updateJobScheduleBlock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('a block card — a card that cannot be dragged', () => {
  const stuck = () =>
    screen.getByRole('button', {
      name: 'Cannot drag: you do not have permission to reassign schedule blocks. Click for an explanation.',
    })

  async function renderOne(over: Partial<CellProps>) {
    const props = makeProps({ cellBlocks: [block()], ...over })
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
    return { ...view, props }
  }

  beforeEach(() => {
    toast.showToast.mockReset()
  })

  it('keeps the grip and explains itself on a click, for someone who cannot edit', async () => {
    const { props } = await renderOne({ canEdit: false })
    fireEvent.click(stuck())
    expect(toast.showToast).toHaveBeenCalledWith(SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE, 'info')
    expect(props.onEmptyCellClick).not.toHaveBeenCalled()
  })

  it('explains itself from the keyboard too, on Enter and on Space and on nothing else', async () => {
    await renderOne({ canEdit: false })
    fireEvent.keyDown(stuck(), { key: 'Tab' })
    expect(toast.showToast).not.toHaveBeenCalled()
    fireEvent.keyDown(stuck(), { key: 'Enter' })
    fireEvent.keyDown(stuck(), { key: ' ' })
    expect(toast.showToast).toHaveBeenCalledTimes(2)
    expect(toast.showToast).toHaveBeenLastCalledWith(SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE, 'info')
  })

  it('cannot be dragged while cells are being selected or linked copies picked', async () => {
    const multi = await renderOne({ hubMultiCellAddActive: true })
    expect(stuck()).toBeTruthy()
    multi.unmount()
    await renderOne({ linkedCopyMode: { stage: 1, selectedBlockIds: new Set<string>() } })
    expect(stuck()).toBeTruthy()
  })

  it('does not start a drag', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return boxOf(this)
    })
    const onDragEnd = vi.fn()
    renderWithProviders(<Grid onDragEnd={onDragEnd} over={{ canEdit: false }} />)
    await settle()
    await drag(stuck(), { x: 20 + CELL_W, y: 20 })
    expect(onDragEnd).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('a block card — press and hold', () => {
  let now = 1_000_000
  beforeEach(() => {
    now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function renderOne(over: Partial<CellProps> = {}) {
    const props = makeProps({ cellBlocks: [block()], ...over })
    renderWithProviders(
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
    return props
  }
  const title = () => screen.getByRole('button', { name: /J927 · Berg AirBnb/ })
  function press(ms: number, travel = 0) {
    fireEvent.pointerDown(title(), pointer(50, 50))
    if (travel > 0) fireEvent.pointerMove(title(), pointer(50 + travel, 50))
    now += ms
    fireEvent.pointerUp(title(), pointer(50 + travel, 50))
  }

  it('opens the Move sheet for the block on release, and the click that follows opens nothing', async () => {
    const props = await renderOne()
    press(LONG_PRESS_MS)
    expect(props.onRequestMoveBlock).toHaveBeenCalledWith(block())
    fireEvent.click(title())
    expect(props.onOpenHubJobDetail).not.toHaveBeenCalled()
    // The next plain tap is a tap again.
    fireEvent.click(title())
    expect(props.onOpenHubJobDetail).toHaveBeenCalledTimes(1)
  })

  it('swallows the click that follows on the card’s second button too', async () => {
    const props = await renderOne()
    press(LONG_PRESS_MS)
    fireEvent.click(screen.getByTitle("Open this job's week"))
    expect(props.onOpenJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTitle("Open this job's week"))
    expect(props.onOpenJob).toHaveBeenCalledWith('job-1')
  })

  it('treats a short press as a tap: the job opens', async () => {
    const props = await renderOne()
    press(LONG_PRESS_MS - 1)
    expect(props.onRequestMoveBlock).not.toHaveBeenCalled()
    fireEvent.click(title())
    expect(props.onOpenHubJobDetail).toHaveBeenCalledWith(block(), MON)
  })

  it('treats a hold that travels as a scroll', async () => {
    const props = await renderOne()
    press(LONG_PRESS_MS * 2, 11)
    expect(props.onRequestMoveBlock).not.toHaveBeenCalled()
  })

  it('forgives a finger that drifts a little', async () => {
    const props = await renderOne()
    press(LONG_PRESS_MS, 10)
    expect(props.onRequestMoveBlock).toHaveBeenCalledTimes(1)
  })

  it('ignores a hold with anything but the main button', async () => {
    const props = await renderOne()
    fireEvent.pointerDown(title(), { ...pointer(50, 50), button: 2 })
    now += LONG_PRESS_MS
    fireEvent.pointerUp(title(), pointer(50, 50))
    expect(props.onRequestMoveBlock).not.toHaveBeenCalled()
  })

  it('lets go of a hold the browser cancels or that leaves the card', async () => {
    const props = await renderOne()
    fireEvent.pointerDown(title(), pointer(50, 50))
    fireEvent.pointerCancel(title(), pointer(50, 50))
    now += LONG_PRESS_MS
    fireEvent.pointerUp(title(), pointer(50, 50))
    expect(props.onRequestMoveBlock).not.toHaveBeenCalled()
  })

  it('is off for someone who cannot edit, while something is being placed, and during linked copies', async () => {
    for (const over of [
      { canEdit: false },
      { cardPlacementMode: { sourceBlockId: 'blk-9', variant: 'unlinked' as const }, placementSourceWorkDate: MON },
      { linkedCopyMode: { stage: 1 as const, selectedBlockIds: new Set<string>() } },
    ]) {
      const props = makeProps({ cellBlocks: [block()], ...over })
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
      press(LONG_PRESS_MS)
      expect(props.onRequestMoveBlock).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('is off when the page does not offer the Move sheet', async () => {
    const props = await renderOne({ onRequestMoveBlock: undefined })
    press(LONG_PRESS_MS)
    fireEvent.click(title())
    expect(props.onOpenHubJobDetail).toHaveBeenCalledTimes(1)
  })
})

describe('a block card — the phone’s tap on the grip', () => {
  async function renderOne(over: Partial<CellProps> = {}) {
    const props = makeProps({ cellBlocks: [block()], tapGripToMove: true, ...over })
    renderWithProviders(
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
    return props
  }

  it('arms the move for that block, and leaves the cell’s own click alone', async () => {
    const props = await renderOne()
    fireEvent.click(screen.getByLabelText('Move block: tap, then tap a day or a person row'))
    expect(props.onStartCardPlacement).toHaveBeenCalledWith(block(), 'move')
    expect(props.onAddJobToScheduleForCell).not.toHaveBeenCalled()
  })

  it('is a drag handle only, off a phone', async () => {
    const props = await renderOne({ tapGripToMove: false })
    fireEvent.click(screen.getByLabelText('Drag to move block to another day or person row'))
    expect(props.onStartCardPlacement).not.toHaveBeenCalled()
  })

  it('does not arm a second move while one is being placed', async () => {
    const props = await renderOne({
      cardPlacementMode: { sourceBlockId: 'blk-1', variant: 'move' },
      placementSourceWorkDate: MON,
    })
    fireEvent.click(screen.getByLabelText('Drag to move block to another day or person row'))
    expect(props.onStartCardPlacement).not.toHaveBeenCalled()
  })

  it('does not arm a move on a card that cannot be dragged', async () => {
    const props = await renderOne({ canEdit: false })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cannot drag: you do not have permission to reassign schedule blocks. Click for an explanation.',
      }),
    )
    expect(props.onStartCardPlacement).not.toHaveBeenCalled()
  })
})
