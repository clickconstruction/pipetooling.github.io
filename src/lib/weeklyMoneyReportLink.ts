import { mondayOfWeekYmd } from './jobs/stagesWeeklyMovement'

/**
 * Moneyfill → the Weekly Money Movement report, pinned to the close week.
 *
 * The report is a modal on Jobs → Pipeline (`JobsWeeklyMoneyModal`), reached
 * by the `?stagesMoney=1` deep link (v2.1443). Moneyfill's tagline named the
 * report but had no button (journey map J5-2); the report links back to
 * Moneyfill but nothing linked forward. This pair adds the forward door and a
 * `stagesMoneyWeek=<monday>` companion so the report opens ON the week the
 * picker was showing — not this week.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/

export const STAGES_MONEY_WEEK_PARAM = 'stagesMoneyWeek'

/** `/jobs?tab=stages&stagesMoney=1&stagesMoneyWeek=2026-08-31` */
export function weeklyMoneyReportHref(weekMonday: string): string {
  const base = '/jobs?tab=stages&stagesMoney=1'
  const monday = parseStagesMoneyWeekParam(weekMonday)
  return monday ? `${base}&${STAGES_MONEY_WEEK_PARAM}=${monday}` : base
}

/**
 * Validate the companion param: a real `YYYY-MM-DD`, normalized to the Monday
 * of its week (the report's week key). Anything else → null (the report keeps
 * its own default week).
 */
export function parseStagesMoneyWeekParam(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!YMD.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // Reject impossible dates such as 2026-02-31 that Date silently rolls over.
  if (d.toISOString().slice(0, 10) !== v) return null
  return mondayOfWeekYmd(v)
}
