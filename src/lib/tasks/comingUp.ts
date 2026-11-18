/**
 * Coming up (punch list #381): what is dated ahead for a person, beside the look at their Task Mode. A task is not on
 * a phone before its day, so a look at today alone hides the week. Repeating tasks keep their coming days as rows
 * already (`checklistMaterialize.ts`, topped up each night), so this reads rows and works out no rule.
 *
 * This file is the part with no read in it: the days, in order, and the words. The read is `readPersonComingUp` in
 * `personDayIo.ts`.
 */
import { ymdAddDays } from '../../utils/dateUtils'
import { dayLabel } from '../checklistDueDates'
import { taskTitlePlain } from './taskPlace'
import { lookFirstName } from './taskLook'

/** How far ahead Coming up looks, the owner's call of 2026-11-17. */
export const COMING_UP_DAYS = 7

/** The last day Coming up shows, counted from today. */
export function comingUpLastDay(todayYmd: string, days: number = COMING_UP_DAYS): string {
  return ymdAddDays(todayYmd, days)
}

export type ComingUpRow = { id: string; checklist_item_id: string; scheduled_date: string; completed_at?: string | null; checklist_items?: { title?: string | null; repeat_type?: string | null } | null }

export type ComingUpTask = { id: string; title: string; repeats: boolean }

export type ComingUpDay = {
  ymd: string
  /** *Tomorrow, Wed, Nov 18* for the first day after today, and *Thu, Nov 19* after it. */
  label: string
  /** Tasks named on this day: every one-time task, and a repeating task the first time it comes up. */
  tasks: ComingUpTask[]
  /** Repeating tasks on this day that an earlier day already named. */
  again: number
}

/**
 * The open tasks dated after today and no later than the last day, a day at a time. A repeating task is named once,
 * on the first day it comes up. After that it is counted, so a daily round does not fill the list seven times.
 */
export function comingUpDays(rows: readonly ComingUpRow[], todayYmd: string, days: number = COMING_UP_DAYS): ComingUpDay[] {
  const last = comingUpLastDay(todayYmd, days)
  const tomorrow = ymdAddDays(todayYmd, 1)
  const inWindow = rows.filter((r) => !r.completed_at && r.scheduled_date > todayYmd && r.scheduled_date <= last)
  const byDay = new Map<string, ComingUpRow[]>()
  for (const r of [...inWindow].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))) byDay.set(r.scheduled_date, [...(byDay.get(r.scheduled_date) ?? []), r])
  const named = new Set<string>()
  const out: ComingUpDay[] = []
  for (const [ymd, dayRows] of byDay) {
    const tasks: ComingUpTask[] = []
    let again = 0
    for (const r of dayRows) {
      const repeats = (r.checklist_items?.repeat_type ?? 'once') !== 'once'
      if (repeats && named.has(r.checklist_item_id)) {
        again += 1
        continue
      }
      if (repeats) named.add(r.checklist_item_id)
      tasks.push({ id: r.id, title: taskTitlePlain(r.checklist_items?.title), repeats })
    }
    out.push({ ymd, label: ymd === tomorrow ? `Tomorrow, ${dayLabel(ymd)}` : dayLabel(ymd), tasks, again })
  }
  return out
}

export const COMING_UP_TITLE = 'Coming up'
export const COMING_UP_REPEATS = 'repeats'

/** The quiet line under the title. */
export function comingUpHint(name: string | null | undefined, days: number = COMING_UP_DAYS): string {
  return `The next ${days} days. A task shows on ${lookFirstName(name)}’s phone on its day.`
}

/** The line that counts the repeating tasks an earlier day named. */
export function comingUpAgainWords(again: number): string {
  return again === 1 ? '1 repeating task again' : `${again} repeating tasks again`
}

/** A week with nothing dated. The press that follows it adds a task for the person. */
export function comingUpEmptyMain(days: number = COMING_UP_DAYS): string {
  return `Nothing is dated in the next ${days} days.`
}
export function comingUpAddLabel(name: string | null | undefined): string {
  return `＋ Add task for ${lookFirstName(name)}`
}
export const COMING_UP_EMPTY_TAIL = 'puts one on the list.'

/** The two looks of the window on a phone, where one shows at a time. */
export const LOOK_BAR_SCREEN = 'Their screen'
export const LOOK_BAR_AHEAD = 'Coming up'
