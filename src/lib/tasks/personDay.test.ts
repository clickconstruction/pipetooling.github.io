import { describe, expect, it } from 'vitest'
import type { ChecklistCardEvent } from '../checklistCardEvents'
import { NO_ORDER, olderOpenParts, olderRowsToRead, orderTodayRows } from './personDay'

const TODAY = '2026-11-17'

function row(id: string, scheduled: string, item: { repeat_type?: string; show_until_completed?: boolean; due_date?: string | null } = {}) {
  return { id, checklist_item_id: `item-${id}`, scheduled_date: scheduled, checklist_items: { repeat_type: 'day_of_week', show_until_completed: false, due_date: null, ...item } }
}

function line(instanceId: string, type: string, at: string): ChecklistCardEvent {
  return { id: `${instanceId}-${type}-${at}`, instance_id: instanceId, event_type: type, actor_user_id: 'u-1', body: '', created_at: at }
}

describe('orderTodayRows', () => {
  it('takes the order the office set for the person', () => {
    const rows = [row('a', TODAY), row('b', TODAY), row('c', TODAY)]
    const order = new Map([
      ['item-a', 3],
      ['item-b', 1],
      ['item-c', 2],
    ])
    expect(orderTodayRows(rows, order).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('puts a task with no order last, and keeps the read order between two of them', () => {
    const rows = [row('new-1', TODAY), row('placed', TODAY), row('new-2', TODAY)]
    const order = new Map([['item-placed', 5]])
    expect(orderTodayRows(rows, order).map((r) => r.id)).toEqual(['placed', 'new-1', 'new-2'])
    expect(NO_ORDER).toBeGreaterThan(5)
  })

  it('does not change the list it was given', () => {
    const rows = [row('a', TODAY), row('b', TODAY)]
    orderTodayRows(rows, new Map([['item-b', 1]]))
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('olderRowsToRead', () => {
  it('names the repeating days alone, since a one-off is wanted whatever its thread says', () => {
    const rows = [row('once', '2026-11-10', { repeat_type: 'once' }), row('kept', '2026-11-11', { show_until_completed: true }), row('daily', '2026-11-16')]
    expect(olderRowsToRead(rows)).toEqual(['daily'])
  })
})

describe('olderOpenParts', () => {
  it('keeps one-offs and show-until-done tasks as still open, oldest first', () => {
    const rows = [row('newer', '2026-11-10', { repeat_type: 'once' }), row('older', '2026-08-20', { show_until_completed: true })]
    const parts = olderOpenParts(rows, [], TODAY)
    expect(parts.stillOpen.map((r) => r.id)).toEqual(['older', 'newer'])
    expect(parts.missed).toEqual([])
  })

  it('leads with a task whose due day has passed', () => {
    const rows = [row('old', '2026-08-20', { repeat_type: 'once' }), row('late', '2026-11-01', { repeat_type: 'once', due_date: '2026-11-12' })]
    expect(olderOpenParts(rows, [], TODAY).stillOpen.map((r) => r.id)).toEqual(['late', 'old'])
  })

  it('counts a repeating day as missed, and as still open once someone sent it back', () => {
    const rows = [row('unticked', '2026-11-16'), row('sent-back', '2026-11-15')]
    const lines = [line('sent-back', 'completed', '2026-11-15T15:00:00Z'), line('sent-back', 'reopened', '2026-11-16T09:00:00Z')]
    const parts = olderOpenParts(rows, lines, TODAY)
    expect(parts.stillOpen.map((r) => r.id)).toEqual(['sent-back'])
    expect(parts.missed.map((r) => r.id)).toEqual(['unticked'])
  })

  it('does not bring back a day that was reopened and then finished again', () => {
    const rows = [row('day', '2026-11-15')]
    const lines = [line('day', 'reopened', '2026-11-15T09:00:00Z'), line('day', 'completed', '2026-11-15T15:00:00Z')]
    const parts = olderOpenParts(rows, lines, TODAY)
    expect(parts.stillOpen).toEqual([])
    expect(parts.missed.map((r) => r.id)).toEqual(['day'])
  })

  it('names the missed days already answered as skipped', () => {
    const rows = [row('asked', '2026-11-16'), row('answered', '2026-11-16')]
    const parts = olderOpenParts(rows, [line('answered', 'skipped', '2026-11-17T08:00:00Z')], TODAY)
    expect([...parts.skippedIds]).toEqual(['answered'])
    expect(parts.missed.map((r) => r.id)).toEqual(['asked', 'answered'])
  })
})
