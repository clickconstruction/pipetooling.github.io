/**
 * GC mode, the real build, the schedule's PR 1a: baselines (G-41), moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcBaseline.ts`). The plan at Start, a new one after a signed
 * change order, and the old ones kept and named.
 */
import { changeOrdersOnChart } from './changeOrderDays'
import type { ProjectSchedule, ScheduleBaseline } from './types'
import type { GcProject } from '../types'
import { shortDate, weekdayDate } from '../words'

export const FIRST_BASELINE_NAME = 'At Start'

/** The baseline's name: the one at Start has none written on it. */
export function baselineName(b: ScheduleBaseline): string {
  return b.name ?? FIRST_BASELINE_NAME
}

/** "At Start, locked Jul 1." · "After change order 2, set Oct 2 by Robert: the curb was signed." */
export function baselineWords(b: ScheduleBaseline): string {
  return `${baselineName(b)}, ${b.name ? 'set' : 'locked'} ${shortDate(b.lockedOn)}${b.by ? ` by ${b.by}` : ''}${b.why ? `: ${b.why}` : '.'}`
}

/** Every baseline the schedule has had, oldest first, the current one last. Empty before Start. */
export function baselineHistory(schedule: ProjectSchedule): ScheduleBaseline[] {
  return [...(schedule.baselines ?? []), ...(schedule.baseline ? [schedule.baseline] : [])]
}

/** The name a new baseline is offered with: after the newest signed change order whose days are on the schedule, or by its count. */
export function nextBaselineName(project: GcProject, today: string): string {
  const landed = changeOrdersOnChart(project, today).filter((r) => r.landed)
  const last = landed[landed.length - 1]
  if (last) return `After change order ${last.co.number}`
  return `Baseline ${(project.schedule?.baselines?.length ?? 0) + 2}`
}

/**
 * Why a new baseline is due, if it is: a signed change order's days went on the schedule since
 * the current baseline was set. Null: nothing calls for one.
 */
export function baselineDue(project: GcProject, today: string): string | null {
  const current = project.schedule?.baseline
  if (!current) return null
  // A landing on the day the baseline was set is taken as covered by it.
  const since = changeOrdersOnChart(project, today).filter((r) => r.landed && r.landed.on > current.lockedOn)
  if (since.length === 0) return null
  const names = since.map((r) => `change order ${r.co.number}`)
  const list = names.length === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} put ${since.reduce((s, r) => s + r.days, 0)} days on the schedule since the baseline of ${weekdayDate(current.lockedOn)}. A new baseline after a signed change order is usual.`
}

/** The schedule with the plan as it stands as the new baseline and the old one kept. Null: not locked yet, or no name. */
export function withNewBaseline(schedule: ProjectSchedule, name: string, why: string, by: string, today: string): ProjectSchedule | null {
  if (!schedule.baseline || !name.trim()) return null
  const next: ScheduleBaseline = {
    lockedOn: today,
    activities: Object.fromEntries(schedule.activities.map((a) => [a.lineId, { start: a.start, finish: a.finish }])),
    name: name.trim(),
    by,
    ...(why.trim() ? { why: why.trim() } : {}),
  }
  return { ...schedule, baseline: next, baselines: [...(schedule.baselines ?? []), schedule.baseline] }
}
