/**
 * What the New task window sends (v2.7584). The window's Send was a function inside the component: its refusals,
 * the `checklist_items` row, the people's rows and the days to make were written there and nowhere else. The dev
 * seat gives a task too (`plan_task` → `apply_task` on dev-mcp), and a second copy of these rules would drift from
 * the window's. So they live here once, and both run them.
 *
 * Pure: no clock, no network, no browser. The caller passes today and now. The edge reads this file through the
 * kernel copy (`scripts/edge-kernels.mjs`), so it imports nothing a function cannot run.
 */
import { MATERIALIZE_HORIZON_DAYS, materializeDates } from '../checklistMaterialize'
import { dayBeforeApplicable, scopeFromDaily } from '../checklistReminderOptions'
import { ymdAddDays } from '../../utils/dateUtils'
import { taskPlaceColumns, type TaskPlaceDraft } from './taskPlace'

/** The When bar's three answers, as the window holds them. */
export type NewTaskWhen = 'today' | 'date' | 'repeat'
/** A repeat is on weekdays, or so many days after the last one was done. */
export type NewTaskRepeatMode = 'weekly' | 'after_done'
export type NewTaskRepeatType = 'once' | 'day_of_week' | 'days_after_completion'

/** The window's draft at the moment of Send. Dates are YYYY-MM-DD, a blank string where the window holds a blank. */
export type NewTaskDraft = {
  /** The words as typed. An empty box is refused whatever the job bar adds to it. */
  typed: string
  /** The words as they are stored: the typed words, or the job bar's token composed around them by the window. */
  title: string
  /** The links as they are stored: the job's link already first. */
  links: string[]
  assigneeIds: string[]
  when: NewTaskWhen
  repeatMode: NewTaskRepeatMode
  startDate: string
  repeatDaysOfWeek: number[]
  repeatDaysAfter: number
  repeatEndDate: string
  dueDate: string
  showUntilCompleted: boolean
  notifyOnCompleteUserId: string
  notifyCreatorOnComplete: boolean
  reminderTime: string
  reminderDaily: boolean
  remindDayBefore: boolean
  escalateEnabled: boolean
  escalateDays: number
  asksForPhoto: boolean
  place: TaskPlaceDraft | null
  /** The task's painted map, by id. The window's own: it overrides the map a place chip carried. */
  map: { id: string } | null
}

/** The schedule a sent task stands on, as the row holds it. */
export type NewTaskSchedule = {
  repeat_type: NewTaskRepeatType
  repeat_days_of_week: number[] | null
  start_date: string
  repeat_end_date: string | null
}

export type NewTaskSend =
  | { ok: false; error: string }
  | {
      ok: true
      /** The `checklist_items` row, column for column as the window inserts it. */
      row: Record<string, unknown>
      schedule: NewTaskSchedule
      /** The days that get a row at once. A weekly task gets five weeks, and the nightly top-up keeps it stocked. */
      instanceDates: string[]
    }

/**
 * The send: the window's refusals in the window's words and order, then the row. `today` is the company's calendar
 * day and `now` the instant of the write, which stamps a place.
 */
export function newTaskSend(draft: NewTaskDraft, me: { userId: string }, clock: { today: string; now: string }): NewTaskSend {
  if (!draft.typed.trim()) return { ok: false, error: 'Enter a title.' }
  if (draft.assigneeIds.length === 0) return { ok: false, error: 'Select at least one assignee.' }
  const repeatType: NewTaskRepeatType = draft.when === 'repeat' ? (draft.repeatMode === 'weekly' ? 'day_of_week' : 'days_after_completion') : 'once'
  const startDate = draft.when === 'today' ? clock.today : draft.startDate
  // A due date implies staying on the list: a deadline means nothing on a task that leaves the list first.
  const dueDate = draft.when !== 'repeat' && draft.dueDate ? draft.dueDate : null
  const showUntil = draft.when === 'repeat' ? false : dueDate ? true : draft.showUntilCompleted
  if (draft.when === 'date' && !draft.startDate) return { ok: false, error: 'Pick a date.' }
  if (dueDate && dueDate < startDate) return { ok: false, error: 'The due date can’t be before the task starts.' }
  if (repeatType === 'day_of_week' && draft.repeatDaysOfWeek.length === 0) return { ok: false, error: 'Pick at least one weekday.' }
  const schedule: NewTaskSchedule = {
    repeat_type: repeatType,
    repeat_days_of_week: repeatType === 'day_of_week' && draft.repeatDaysOfWeek.length ? draft.repeatDaysOfWeek : null,
    start_date: startDate,
    repeat_end_date: repeatType === 'day_of_week' ? draft.repeatEndDate || null : null,
  }
  const row: Record<string, unknown> = {
    remind_day_before: Boolean(draft.reminderTime) && draft.remindDayBefore && dayBeforeApplicable(draft.when, startDate, clock.today),
    escalate_after_days: draft.reminderTime && draft.escalateEnabled ? Math.max(1, draft.escalateDays) : null,
    title: draft.title,
    links: draft.links,
    asks_for_photo: draft.asksForPhoto,
    // A place is written only when one is set, so a task with none sends the row it always sent.
    ...(draft.place ? taskPlaceColumns(draft.place, me.userId, clock.now) : {}),
    // The task's map is the window's own: it overrides what a place chip carried.
    ...(draft.place || draft.map ? { painted_map_id: draft.map?.id?.trim() || null } : {}),
    created_by_user_id: me.userId,
    repeat_type: schedule.repeat_type,
    repeat_days_of_week: schedule.repeat_days_of_week,
    repeat_days_after: repeatType === 'days_after_completion' ? draft.repeatDaysAfter : null,
    repeat_end_date: schedule.repeat_end_date,
    start_date: schedule.start_date,
    due_date: dueDate,
    show_until_completed: showUntil,
    notify_on_complete_user_id: draft.notifyOnCompleteUserId || null,
    notify_creator_on_complete: draft.notifyCreatorOnComplete,
    reminder_time: draft.reminderTime || null,
    reminder_scope: draft.reminderTime ? scopeFromDaily(draft.reminderDaily) : null,
  }
  return { ok: true, row, schedule, instanceDates: newTaskInstanceDates(schedule) }
}

/** The days a new task gets a row on at once: from its start, the rolling window ahead. */
export function newTaskInstanceDates(schedule: NewTaskSchedule): string[] {
  return materializeDates(schedule, schedule.start_date, ymdAddDays(schedule.start_date, MATERIALIZE_HORIZON_DAYS))
}

/**
 * Each person's next place in their own list: one past the highest they hold, so a new task goes to the bottom.
 * `held` is the `checklist_item_assignees` rows read for these people, whole or only each person's highest.
 */
export function nextDisplayOrders(held: ReadonlyArray<{ user_id: string; display_order: number | null }>, userIds: ReadonlyArray<string>): Map<string, number> {
  const maxByUser = new Map<string, number>()
  for (const row of held) maxByUser.set(row.user_id, Math.max(maxByUser.get(row.user_id) ?? 0, row.display_order ?? 0))
  const out = new Map<string, number>()
  for (const uid of userIds) out.set(uid, (maxByUser.get(uid) ?? 0) + 1)
  return out
}

/** The people's rows on a new task, in the order they were picked. */
export function newTaskAssigneeRows(itemId: string, assigneeIds: ReadonlyArray<string>, orders: ReadonlyMap<string, number>): Array<{ checklist_item_id: string; user_id: string; display_order: number }> {
  return assigneeIds.map((uid) => ({ checklist_item_id: itemId, user_id: uid, display_order: orders.get(uid) ?? 1 }))
}
