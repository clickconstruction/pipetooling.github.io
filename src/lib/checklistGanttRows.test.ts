import { describe, expect, it } from 'vitest'
import { checklistGanttAxis, checklistGanttRows, ganttFraction } from './checklistGanttRows'

const TODAY = '2026-08-26'
const item = (id: string, start: string, due: string | null, complete = false) => ({ id, title: id, start_date: start, due_date: due, complete })
const push = (from: string | null, to: string | null) => ({ changed_at: '2026-08-26T10:00:00Z', changed_by: null, from_due: from, to_due: to })

describe('checklistGanttAxis', () => {
  it('spans a week before the earliest start through the 30-day runway (or past the latest due, whichever is later)', () => {
    const axis = checklistGanttAxis([item('a', '2026-08-25', '2026-09-04')], TODAY)
    expect(axis.startYmd).toBe('2026-08-18')
    expect(axis.endYmd).toBe('2026-10-09')
    expect(axis.todayLeft).toBeGreaterThan(0)
    expect(axis.todayLeft).toBeLessThan(1)
    expect(axis.months[0]!.label).toBe('AUG')
    expect(axis.months[1]!.label).toBe('SEP')
    expect(axis.weekends.length).toBeGreaterThan(3)
  })
  it('empty list still yields a today-anchored axis', () => {
    const axis = checklistGanttAxis([], TODAY)
    expect(axis.startYmd < TODAY && axis.endYmd > TODAY).toBe(true)
  })
})

describe('checklistGanttRows', () => {
  const items = [
    item('windowed', '2026-08-25', '2026-09-04'),
    item('undated', '2026-08-25', null),
    item('doneRecent', '2026-08-10', '2026-08-20', true),
    item('doneOld', '2026-06-01', '2026-06-10', true),
  ]
  const axis = checklistGanttAxis(items, TODAY)

  it('only dated rows; stale done rows drop; done sorts after open', () => {
    const rows = checklistGanttRows(items, new Map(), axis, TODAY)
    expect(rows.map((r) => r.id)).toEqual(['windowed', 'doneRecent'])
    expect(rows[1]!.done).toBe(true)
  })

  it('a pushed task grows a trail from the original promise, tick never moves', () => {
    const pushes = new Map([['windowed', [push('2026-08-30', '2026-09-04')]]])
    const rows = checklistGanttRows(items, pushes, axis, TODAY)
    const w = rows.find((r) => r.id === 'windowed')!
    expect(w.badge).toBe('→ pushed ×1 · +5d')
    expect(w.origTickLeft).toBeCloseTo(ganttFraction(axis, '2026-08-30') + axis.dayWidth, 5)
    expect(w.trail!.left).toBe(w.origTickLeft)
    expect(w.trail!.width).toBeGreaterThan(0)
    expect(w.bar.left).toBeCloseTo(ganttFraction(axis, '2026-08-25'), 5)
  })

  it('unpushed tasks carry no trail, tick, or badge', () => {
    const rows = checklistGanttRows(items, new Map(), axis, TODAY)
    const w = rows.find((r) => r.id === 'windowed')!
    expect(w.trail).toBeNull()
    expect(w.origTickLeft).toBeNull()
    expect(w.badge).toBeNull()
  })
})
