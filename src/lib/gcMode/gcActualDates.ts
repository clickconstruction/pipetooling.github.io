/**
 * GC mode design spike: actual start and finish, the Gantt's Phase 2 (G-55). The planned dates
 * are what the chart draws; the days work really started and finished are kept beside them, set
 * by the walk ("it started Monday") or on the opened activity. A trade's report setting them is
 * the real build's (the owner's call: it moves the golden walk's snapshots). The pair is what a
 * trade's record and a time extension ask are read from later.
 *
 * Its own file, out of the barrel.
 */
import type { ScheduleActivity } from './gcTypes'
import { daysBetween } from './gcBuildingSchedule'
import { shortDate, weekdayDate } from './gcWords'

/** "Started Mon Sep 21, as planned." · "Started Wed Sep 23, 2 days late; not finished." · "Sep 23 to Oct 10, 1 day longer than planned." Null: nothing recorded. */
export function actualWords(a: ScheduleActivity): string | null {
  const { actualStart: s, actualFinish: f } = a
  if (!s && !f) return null
  const lateStart = s ? daysBetween(a.start, s) : 0
  const startWords = s ? `Started ${weekdayDate(s)}${lateStart === 0 ? ', as planned' : `, ${Math.abs(lateStart)} ${Math.abs(lateStart) === 1 ? 'day' : 'days'} ${lateStart > 0 ? 'late' : 'early'}`}` : 'Start not recorded'
  if (!f) return `${startWords}; not finished.`
  const lateFinish = daysBetween(a.finish, f)
  return `${s ? `${shortDate(s)} to ${shortDate(f)}` : `Finished ${weekdayDate(f)}`}, ${lateFinish === 0 ? 'on the planned finish' : `${Math.abs(lateFinish)} ${Math.abs(lateFinish) === 1 ? 'day' : 'days'} ${lateFinish > 0 ? 'past' : 'before'} the planned finish`}.`
}

/** What is wrong with a pair of actual dates, or null. */
export function actualProblem(actualStart: string | undefined, actualFinish: string | undefined, today: string): string | null {
  if (actualStart && actualStart > today) return 'A start cannot be after today.'
  if (actualFinish && actualFinish > today) return 'A finish cannot be after today.'
  if (actualStart && actualFinish && actualFinish < actualStart) return 'It has to finish on or after it started.'
  if (actualFinish && !actualStart) return 'Say when it started first.'
  return null
}
