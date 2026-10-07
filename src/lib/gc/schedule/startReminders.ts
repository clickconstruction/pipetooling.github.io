/**
 * GC mode, the real build, the schedule's PR 1b: the start reminders (G-114), moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcStartReminders.ts`). The reminders themselves read Start's checklist and the portal's words, and wait for them.
 */
import { scheduleLinesOf } from './schedule'
import type { GcProject, TradePackage } from '../types'

/** Days before the first day the two reminders go: two weeks, then three days. */
export const START_REMINDER_DAYS = [14, 3] as const

/** A company's first planned day on a job, by its lines on the schedule. Null: nothing of theirs drawn. */
export function firstStartOf(project: GcProject, pkg: TradePackage): string | null {
  const ids = new Set(scheduleLinesOf(pkg).map((l) => l.lineId))
  const starts = (project.schedule?.activities ?? []).filter((a) => ids.has(a.lineId) && !a.inspection).map((a) => a.start)
  return starts.length === 0 ? null : starts.reduce((m, d) => (d < m ? d : m))
}
