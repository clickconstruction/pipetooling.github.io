/**
 * GC mode design spike: schedules not walked lately, for the dashboard's Needs you (the Gantt,
 * G-59; the owner's OK 2026-10-06). A chart is only true on the day someone last went through it;
 * a job being built whose schedule nobody has walked in a week is our move, so it has its own
 * line, like change requests, and stays out of the people count.
 *
 * Its own file, out of the barrel: the dashboard's hook reads it through the barrel's store.
 */
import type { GcProject, GcState } from './gcTypes'
import { walkStanding, WALK_STALE_DAYS } from './gcScheduleWalk'

/** A schedule never walked, or not walked in twice the stale days, reads late. */
export const WALK_LATE_DAYS = WALK_STALE_DAYS * 2

export interface StaleSchedule {
  project: GcProject
  /** Days since the last walk. Null: never walked. */
  days: number | null
  words: string
}

/** The jobs being built whose schedule is stale, the longest unwalked first. */
export function staleSchedules(state: GcState): StaleSchedule[] {
  return state.projects
    .filter((p) => p.stage === 'building' && !p.closedOn && p.schedule && p.schedule.activities.length > 0)
    .map((project) => {
      const w = walkStanding(project, state.today)
      return { project, days: w.days, stale: w.stale, words: w.words }
    })
    .filter((x) => x.stale)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
    .map(({ project, days, words }) => ({ project, days, words }))
}

export interface GcStaleSchedulesNeedsYou {
  count: number
  late: boolean
  title: string
  detail: string
  projectId: string
}

/** The dashboard's line, or null when every schedule was walked this week. */
export function gcStaleSchedulesNeedsYou(state: GcState): GcStaleSchedulesNeedsYou | null {
  const stale = staleSchedules(state)
  const first = stale[0]
  if (!first) return null
  const late = stale.some((s) => s.days === null || s.days >= WALK_LATE_DAYS)
  return {
    count: stale.length,
    late,
    title: stale.length === 1 ? '1 schedule not walked this week in GC mode' : `${stale.length} schedules not walked this week in GC mode`,
    detail: stale.map((s) => `${s.project.name}: ${s.words}`).join(' · '),
    projectId: first.project.id,
  }
}
