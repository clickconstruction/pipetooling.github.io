/** What the New task window sends (v2.7584): its refusals, its row, its people's rows and its days, held in one kernel. */
import { describe, expect, it } from 'vitest'
import { newTaskAssigneeRows, newTaskInstanceDates, newTaskSend, nextDisplayOrders, type NewTaskDraft } from './newTaskSend'
import { taskMapColumn } from './taskMapPick'
import { taskPlaceColumns } from './taskPlace'

const ME = { userId: 'me-1' }
// 2026-11-17 is a Tuesday.
const CLOCK = { today: '2026-11-17', now: '2026-11-17T15:00:00.000Z' }

/** The window as it opens: a task for today, nothing added. */
function draft(over: Partial<NewTaskDraft> = {}): NewTaskDraft {
  return {
    typed: 'Check the pump',
    title: 'Check the pump',
    links: [],
    assigneeIds: ['u-1'],
    when: 'today',
    repeatMode: 'weekly',
    startDate: '2026-11-17',
    repeatDaysOfWeek: [],
    repeatDaysAfter: 1,
    repeatEndDate: '',
    dueDate: '',
    showUntilCompleted: true,
    notifyOnCompleteUserId: '',
    notifyCreatorOnComplete: true,
    reminderTime: '',
    reminderDaily: true,
    remindDayBefore: false,
    escalateEnabled: false,
    escalateDays: 3,
    asksForPhoto: false,
    place: null,
    map: null,
    ...over,
  }
}

function sent(over: Partial<NewTaskDraft> = {}) {
  const s = newTaskSend(draft(over), ME, CLOCK)
  if (!s.ok) throw new Error(s.error)
  return s
}

describe('newTaskSend — the refusals, in the window\'s words and order', () => {
  it('refuses an empty box, even when the job bar would have composed words around it', () => {
    expect(newTaskSend(draft({ typed: '   ', title: '{{1:J100 · A job}} — ' }), ME, CLOCK)).toEqual({ ok: false, error: 'Enter a title.' })
  })

  it('refuses a task for nobody, after the words', () => {
    expect(newTaskSend(draft({ assigneeIds: [] }), ME, CLOCK)).toEqual({ ok: false, error: 'Select at least one assignee.' })
    expect(newTaskSend(draft({ typed: '', assigneeIds: [] }), ME, CLOCK)).toEqual({ ok: false, error: 'Enter a title.' })
  })

  it('refuses a dated task with no date, a due day before the start, and a weekly repeat with no weekday', () => {
    expect(newTaskSend(draft({ when: 'date', startDate: '' }), ME, CLOCK)).toEqual({ ok: false, error: 'Pick a date.' })
    expect(newTaskSend(draft({ when: 'date', startDate: '2026-11-20', dueDate: '2026-11-19' }), ME, CLOCK)).toEqual({ ok: false, error: 'The due date can’t be before the task starts.' })
    expect(newTaskSend(draft({ when: 'repeat', repeatMode: 'weekly', repeatDaysOfWeek: [] }), ME, CLOCK)).toEqual({ ok: false, error: 'Pick at least one weekday.' })
  })

  it('a due day on a repeat is dropped, so it cannot refuse', () => {
    expect(sent({ when: 'repeat', repeatDaysOfWeek: [2], dueDate: '2020-01-01' }).row.due_date).toBeNull()
  })
})

describe('newTaskSend — the row', () => {
  it('a plain task for today is the row the window always sent, whole', () => {
    expect(sent().row).toEqual({
      remind_day_before: false,
      escalate_after_days: null,
      title: 'Check the pump',
      links: [],
      asks_for_photo: false,
      created_by_user_id: 'me-1',
      repeat_type: 'once',
      repeat_days_of_week: null,
      repeat_days_after: null,
      repeat_end_date: null,
      start_date: '2026-11-17',
      due_date: null,
      show_until_completed: true,
      notify_on_complete_user_id: null,
      notify_creator_on_complete: true,
      reminder_time: null,
      reminder_scope: null,
    })
  })

  it('today is the clock\'s day, whatever day the window was opened on', () => {
    expect(sent({ when: 'today', startDate: '2026-11-01' }).row.start_date).toBe('2026-11-17')
  })

  it('a due day keeps the task on the list, and a task with none keeps the giver\'s answer', () => {
    const due = sent({ when: 'date', startDate: '2026-11-18', dueDate: '2026-11-20', showUntilCompleted: false })
    expect(due.row).toMatchObject({ start_date: '2026-11-18', due_date: '2026-11-20', show_until_completed: true })
    expect(sent({ showUntilCompleted: false }).row.show_until_completed).toBe(false)
  })

  it('a weekly repeat carries its weekdays and its end, never a due day or a stay', () => {
    const weekly = sent({ when: 'repeat', repeatMode: 'weekly', repeatDaysOfWeek: [1, 3], repeatEndDate: '2026-12-31', startDate: '2026-11-18', repeatDaysAfter: 4 })
    expect(weekly.row).toMatchObject({ repeat_type: 'day_of_week', repeat_days_of_week: [1, 3], repeat_end_date: '2026-12-31', repeat_days_after: null, due_date: null, show_until_completed: false, start_date: '2026-11-18' })
  })

  it('a repeat after it is done carries its gap alone', () => {
    const after = sent({ when: 'repeat', repeatMode: 'after_done', repeatDaysAfter: 7, repeatDaysOfWeek: [1], repeatEndDate: '2026-12-31' })
    expect(after.row).toMatchObject({ repeat_type: 'days_after_completion', repeat_days_after: 7, repeat_days_of_week: null, repeat_end_date: null })
  })

  it('the reminder columns stand only on a reminder time', () => {
    expect(sent({ remindDayBefore: true, escalateEnabled: true }).row).toMatchObject({ reminder_time: null, reminder_scope: null, remind_day_before: false, escalate_after_days: null })
    const on = sent({ when: 'date', startDate: '2026-11-19', reminderTime: '08:00', reminderDaily: false, remindDayBefore: true, escalateEnabled: true, escalateDays: 0 })
    expect(on.row).toMatchObject({ reminder_time: '08:00', reminder_scope: 'today_only', remind_day_before: true, escalate_after_days: 1 })
    // The day before a task for today has already gone.
    expect(sent({ reminderTime: '08:00', remindDayBefore: true }).row).toMatchObject({ reminder_scope: 'today_and_overdue', remind_day_before: false })
  })

  it('who hears when it is done, the links and the photo switch go through as given', () => {
    expect(sent({ notifyOnCompleteUserId: 'u-9', notifyCreatorOnComplete: false, links: ['https://example.test/a'], asksForPhoto: true }).row).toMatchObject({
      notify_on_complete_user_id: 'u-9',
      notify_creator_on_complete: false,
      links: ['https://example.test/a'],
      asks_for_photo: true,
    })
  })

  it('a place writes the place kernel\'s columns, stamped with the writer and the moment', () => {
    const place = { lat: 30.1, lng: -97.7, name: '  Pump   house ', accuracyM: null }
    const row = sent({ place }).row
    expect(row).toMatchObject({ ...taskPlaceColumns(place, 'me-1', CLOCK.now), painted_map_id: null })
    expect(row.place_name).toBe('Pump house')
  })

  it('the map column is the window\'s own rule: written with a place or a map, the window\'s map over the place\'s', () => {
    const place = { lat: 30.1, lng: -97.7, name: 'Gate', accuracyM: 12, mapId: 'map-of-the-place' }
    for (const map of [null, { id: 'map-picked', name: null }, { id: '  ', name: null }]) {
      expect(sent({ place, map }).row.painted_map_id).toBe(taskMapColumn(map).painted_map_id)
      if (map) expect(sent({ map }).row.painted_map_id).toBe(taskMapColumn(map).painted_map_id)
    }
    expect('painted_map_id' in sent().row).toBe(false)
    expect('place_lat' in sent({ map: { id: 'map-picked' } }).row).toBe(false)
  })
})

describe('the days and the people\'s rows', () => {
  it('a one-off gets its one day, and a repeat after done its first', () => {
    expect(sent({ when: 'date', startDate: '2026-11-20' }).instanceDates).toEqual(['2026-11-20'])
    expect(sent({ when: 'repeat', repeatMode: 'after_done', startDate: '2026-11-21' }).instanceDates).toEqual(['2026-11-21'])
  })

  it('a weekly task gets five weeks of its weekdays from its start, held to its end', () => {
    const tuesdays = sent({ when: 'repeat', repeatDaysOfWeek: [2], startDate: '2026-11-17' })
    expect(tuesdays.instanceDates).toEqual(['2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22'])
    expect(sent({ when: 'repeat', repeatDaysOfWeek: [2], startDate: '2026-11-17', repeatEndDate: '2026-11-30' }).instanceDates).toEqual(['2026-11-17', '2026-11-24'])
    expect(newTaskInstanceDates(tuesdays.schedule)).toEqual(tuesdays.instanceDates)
  })

  it('a new task goes to the bottom of each person\'s own list', () => {
    const orders = nextDisplayOrders([{ user_id: 'u-1', display_order: 4 }, { user_id: 'u-1', display_order: 9 }, { user_id: 'u-2', display_order: null }], ['u-1', 'u-2', 'u-3'])
    expect([...orders]).toEqual([['u-1', 10], ['u-2', 1], ['u-3', 1]])
    expect(newTaskAssigneeRows('item-1', ['u-2', 'u-1', 'u-4'], orders)).toEqual([
      { checklist_item_id: 'item-1', user_id: 'u-2', display_order: 1 },
      { checklist_item_id: 'item-1', user_id: 'u-1', display_order: 10 },
      { checklist_item_id: 'item-1', user_id: 'u-4', display_order: 1 },
    ])
  })
})
