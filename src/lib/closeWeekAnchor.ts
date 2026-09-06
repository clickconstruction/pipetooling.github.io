/**
 * Close-week anchor (journey-map Tier-2 #18, cluster C3 — "the week" meant
 * different things two surfaces apart).
 *
 * Sibling of `payWeekAnchor.ts`. The app has exactly TWO week families and
 * each gets one helper file:
 *
 *   - **Pay week** — Sunday through Saturday, the company payroll calendar
 *     (`payWeekAnchor.ts`: Hours grid, Draft Payroll, the people-hours queue).
 *   - **Close week** — Monday through Sunday, Central calendar, the week the
 *     Weekly Money Movement report scores and Moneyfill closes. Its default is
 *     the PREVIOUS COMPLETE week — the week you close Monday morning — never
 *     the current one. Before this file Moneyfill opened on the previous
 *     complete week while the report opened on the current week, so the two
 *     halves of one close disagreed by seven days on every cold open.
 *
 * `moneyfillWeekClose.ts` re-exports `previousCompleteWeekMonday` from here so
 * its many existing callers keep working; the Weekly Money report resolves its
 * opening week through `resolveWeeklyMoneyReportWeek`.
 */
import { mondayOfWeekYmd, weekLabel } from './jobs/stagesWeeklyMovement'
import { addDaysYmd } from './emailSchedule/emailScheduleWeek'
import { chicagoYmdOf } from './gcStatementStandingCopies'

/** Inclusive Monday→Sunday range, YYYY-MM-DD. */
export type CloseWeek = { monday: string; sunday: string }

/** Monday on or before `ymd` (the close week's key). */
export function closeWeekMonday(ymd: string): string {
  return mondayOfWeekYmd(ymd)
}

/** The Mon–Sun close week containing `ymd`. */
export function closeWeekContaining(ymd: string): CloseWeek {
  const monday = mondayOfWeekYmd(ymd)
  return { monday, sunday: addDaysYmd(monday, 6) }
}

/**
 * The last COMPLETE Mon–Sun close week as of `now` (Central calendar) — the
 * default for Moneyfill's picker AND the Weekly Money Movement report. On a
 * Monday this is the week that ended yesterday; on a Sunday it is still the
 * week before (the current week has one day left).
 */
export function previousCompleteCloseWeek(now: Date = new Date()): CloseWeek {
  const monday = addDaysYmd(mondayOfWeekYmd(chicagoYmdOf(now)), -7)
  return { monday, sunday: addDaysYmd(monday, 6) }
}

/** Monday (YYYY-MM-DD) of the previous complete close week — the picker's default key. */
export function previousCompleteCloseWeekMonday(now: Date = new Date()): string {
  return previousCompleteCloseWeek(now).monday
}

/**
 * The week the Weekly Money Movement report opens on. An opener that names a
 * week (Moneyfill's "See the week's report", `?stagesMoneyWeek=`) wins; any
 * other open — the Pipeline Section-tools menu, a bare `?stagesMoney=1` — lands
 * on the previous complete close week, the same week Moneyfill's picker shows.
 * The pinned value is normalized to its Monday so a mid-week ymd still keys
 * the right week.
 */
export function resolveWeeklyMoneyReportWeek(pinnedMondayYmd: string | null | undefined, now: Date = new Date()): string {
  return parseCloseWeekParam(pinnedMondayYmd) ?? previousCompleteCloseWeekMonday(now)
}

/** "Aug 24 – 30" / "Aug 31 – Sep 6". */
export function formatCloseWeekLabel(weekMondayYmd: string): string {
  return weekLabel(weekMondayYmd)
}

/** True when `weekMondayYmd` IS the default close week (the previous complete one) as of `now`. */
export function isDefaultCloseWeek(weekMondayYmd: string, now: Date = new Date()): boolean {
  return weekMondayYmd === previousCompleteCloseWeekMonday(now)
}

/** True when the picked week has not ended yet (Central) — the close can't be final. */
export function closeWeekStillRunning(weekMondayYmd: string, now: Date = new Date()): boolean {
  return addDaysYmd(weekMondayYmd, 6) >= chicagoYmdOf(now)
}

/**
 * Moneyfill's own week companion: `/moneyfill?week=<monday>` opens the picker
 * on that close week (the Quickfill close-week chip uses it so the station
 * lands on the week it was quoting). Anything but a real `YYYY-MM-DD` → null
 * and the picker keeps its default.
 */
export const MONEYFILL_WEEK_PARAM = 'week'

export function moneyfillHref(weekMondayYmd?: string | null): string {
  const monday = parseCloseWeekParam(weekMondayYmd)
  return monday ? `/moneyfill?${MONEYFILL_WEEK_PARAM}=${monday}` : '/moneyfill'
}

export function parseCloseWeekParam(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // Reject rollovers such as 2026-02-31 that Date silently normalizes.
  if (d.toISOString().slice(0, 10) !== v) return null
  return mondayOfWeekYmd(v)
}
