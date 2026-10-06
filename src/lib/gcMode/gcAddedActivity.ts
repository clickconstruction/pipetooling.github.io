/**
 * GC mode design spike: an activity that is no trade's line, the Gantt's Phase 2 (G-38): mobilize,
 * cure time, the customer's own work, a punch walk. Until now every bar was a line of a statement of
 * work or an inspection, so a week of concrete cure had nowhere to go but a gap nobody could see.
 * An added activity is the job's own: no dollars, nobody reports it, the office marks it done. It
 * waits on work and work waits on it like any other bar, and it counts on the critical path.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it.
 */
import type { GcProject, ScheduleActivity } from './gcTypes'
import { daysBetween } from './gcBuildingSchedule'

/** Who an added activity belongs to, as offered. The last takes typed words. */
export const ADDED_WHO = ['Our own crew', 'The customer', 'Cure time', 'Someone else'] as const

export function nextOwnId(project: GcProject): string {
  const n = (project.schedule?.activities ?? []).reduce((m, a) => {
    const tail = a.lineId.startsWith(`${project.id}-own-`) ? Number(a.lineId.slice(`${project.id}-own-`.length)) : 0
    return Math.max(m, Number.isFinite(tail) ? tail : 0)
  }, 0)
  return `${project.id}-own-${n + 1}`
}

/** What is wrong with a new activity, or null. */
export function addedActivityProblem(label: string, who: string, start: string, finish: string): string | null {
  if (!label.trim()) return 'Give it a name.'
  if (!who.trim()) return 'Say whose it is.'
  if (!start || !finish) return 'It needs a start and a finish.'
  if (finish < start) return 'It has to finish on or after it starts.'
  return null
}

/** "Slab cure, Cure time, 7 days from Mon Aug 31." */
export function addedActivityWords(a: ScheduleActivity): string | null {
  if (!a.added) return null
  const days = daysBetween(a.start, a.finish) + 1
  return `${a.added.label}, ${a.added.who}, ${days} ${days === 1 ? 'day' : 'days'}${a.added.doneOn ? ', done' : ''}.`
}
