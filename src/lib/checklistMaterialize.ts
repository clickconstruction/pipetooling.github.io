/**
 * Checklist instance materialization kernel (v2.2055): the ONE place that
 * decides which dates an item should have occurrence rows on. Used by the
 * Add modal, the Edit modal's future-regeneration, and the nightly cron
 * top-up (the Deno copy in send-scheduled-reminders mirrors this — keep in
 * sync). All math is string-based YMD in the company calendar — no UTC
 * `new Date('YYYY-MM-DD')` parses (that anchor-shift bug created weekly
 * instances a day before their chosen start).
 */

import { ymdAddDays } from '../utils/dateUtils'

export type MaterializeConfig = {
  repeat_type: 'once' | 'day_of_week' | 'days_after_completion'
  repeat_days_of_week: number[] | null
  start_date: string
  repeat_end_date: string | null
}

/** Day-of-week of a YMD string, timezone-inert (noon anchor). */
export function dowOfYmd(ymd: string): number {
  return new Date(ymd + 'T12:00:00').getDay()
}

/** How far ahead weekly items keep materialized occurrences (5 weeks). */
export const MATERIALIZE_HORIZON_DAYS = 35

/**
 * Dates this item should have instances on within [windowStart, windowEnd]
 * (inclusive), respecting start/end dates. `once` and `days_after_completion`
 * contribute only their start date (the chain's next link is created at
 * completion time); `day_of_week` contributes every matching weekday.
 * Returns ascending, deduped.
 */
export function materializeDates(
  cfg: MaterializeConfig,
  windowStart: string,
  windowEnd: string,
): string[] {
  if (windowEnd < windowStart) return []
  if (cfg.repeat_type === 'once' || cfg.repeat_type === 'days_after_completion') {
    const d = cfg.start_date
    return d >= windowStart && d <= windowEnd ? [d] : []
  }
  const days = new Set(cfg.repeat_days_of_week ?? [])
  if (days.size === 0) return []
  const from = cfg.start_date > windowStart ? cfg.start_date : windowStart
  const to = cfg.repeat_end_date && cfg.repeat_end_date < windowEnd ? cfg.repeat_end_date : windowEnd
  const out: string[] = []
  for (let d = from; d <= to; d = ymdAddDays(d, 1)) {
    if (days.has(dowOfYmd(d))) out.push(d)
  }
  return out
}

export type RegenInstanceLite = {
  id: string
  scheduled_date: string
  completed_at: string | null
  /** True when any checklist_instance_events row exists (conversation history). */
  hasEvents: boolean
}

export type EditRegenerationPlan = {
  /** Future, incomplete, event-less occurrences that no longer fit the config. */
  deleteIds: string[]
  /** Dates needing a fresh occurrence. */
  createDates: string[]
  /** One-off reschedule: move this instance to the new start date. */
  moveInstanceId: string | null
  moveTo: string | null
}

/**
 * What an edit should do to existing occurrences (v2.2055 — before this,
 * edits changed the template and left every occurrence on the old schedule).
 * Rules: the past and anything completed or discussed never moves. For
 * one-offs (and never-completed after-completion chains) the single open
 * occurrence is MOVED to the new date, preserving its notes. For weeklies,
 * future clean occurrences are re-derived from the new config within the
 * horizon window.
 */
export function planEditRegeneration(
  cfg: MaterializeConfig,
  instances: RegenInstanceLite[],
  todayStr: string,
  horizonDays: number = MATERIALIZE_HORIZON_DAYS,
): EditRegenerationPlan {
  const windowEnd = ymdAddDays(todayStr, horizonDays)
  if (cfg.repeat_type === 'once' || cfg.repeat_type === 'days_after_completion') {
    const anyCompleted = instances.some((i) => i.completed_at != null)
    const open = instances.filter((i) => i.completed_at == null)
    // In-flight after-completion chains keep their own cadence.
    if (cfg.repeat_type === 'days_after_completion' && anyCompleted) {
      return { deleteIds: [], createDates: [], moveInstanceId: null, moveTo: null }
    }
    const target = open[0] ?? null
    if (target && target.scheduled_date !== cfg.start_date) {
      return { deleteIds: [], createDates: [], moveInstanceId: target.id, moveTo: cfg.start_date }
    }
    if (!target && !anyCompleted) {
      // Every occurrence vanished (shouldn't happen) — restore one.
      return { deleteIds: [], createDates: [cfg.start_date], moveInstanceId: null, moveTo: null }
    }
    return { deleteIds: [], createDates: [], moveInstanceId: null, moveTo: null }
  }
  // Weekly: reconcile the future window against the new config.
  const wanted = new Set(materializeDates(cfg, ymdAddDays(todayStr, 1), windowEnd))
  const deleteIds: string[] = []
  const kept = new Set<string>()
  for (const inst of instances) {
    if (inst.scheduled_date <= todayStr) continue
    if (inst.completed_at != null || inst.hasEvents) {
      kept.add(inst.scheduled_date)
      continue
    }
    if (wanted.has(inst.scheduled_date)) kept.add(inst.scheduled_date)
    else deleteIds.push(inst.id)
  }
  const createDates = [...wanted].filter((d) => !kept.has(d)).sort()
  return { deleteIds, createDates, moveInstanceId: null, moveTo: null }
}
