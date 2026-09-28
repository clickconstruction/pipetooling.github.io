import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_DISPATCH_CELL_PREFIX,
  parseScheduleDispatchCellDroppableId,
  scheduleDispatchCellDroppableId,
} from './scheduleDispatchDnd'

/**
 * The drag contract: every person × day cell registers a droppable id built
 * here, and the drag-end handler reads the drop target back through the parser.
 */
const USER = '3f2b8c1e-0d4a-4e6b-9a57-1c2d3e4f5a6b'

describe('scheduleDispatchCellDroppableId', () => {
  it('puts the day before the person, behind the cell prefix', () => {
    expect(scheduleDispatchCellDroppableId('2026-09-28', USER)).toBe(`sd-cell:2026-09-28:${USER}`)
    expect(SCHEDULE_DISPATCH_CELL_PREFIX).toBe('sd-cell:')
  })
})

describe('parseScheduleDispatchCellDroppableId', () => {
  it('reads back what the builder wrote', () => {
    const id = scheduleDispatchCellDroppableId('2026-09-28', USER)
    expect(parseScheduleDispatchCellDroppableId(id)).toEqual({ workDate: '2026-09-28', assigneeUserId: USER })
  })

  it('keeps everything after the day as the person, colons included', () => {
    expect(parseScheduleDispatchCellDroppableId('sd-cell:2026-09-28:lane:7')).toEqual({
      workDate: '2026-09-28',
      assigneeUserId: 'lane:7',
    })
  })

  it('refuses an id that is not a string or not a cell', () => {
    expect(parseScheduleDispatchCellDroppableId(null)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(undefined)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(42)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId('')).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(`block:2026-09-28:${USER}`)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(` sd-cell:2026-09-28:${USER}`)).toBeNull()
  })

  it('refuses a cell with no day, no person, or no separator', () => {
    expect(parseScheduleDispatchCellDroppableId('sd-cell:')).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(`sd-cell::${USER}`)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId('sd-cell:2026-09-28')).toBeNull()
    expect(parseScheduleDispatchCellDroppableId('sd-cell:2026-09-28:')).toBeNull()
  })

  it('refuses a day that is not YYYY-MM-DD', () => {
    expect(parseScheduleDispatchCellDroppableId(`sd-cell:09/28/2026:${USER}`)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(`sd-cell:2026-9-28:${USER}`)).toBeNull()
    expect(parseScheduleDispatchCellDroppableId(`sd-cell:2026-09-28T00:${USER}`)).toBeNull()
  })
})
