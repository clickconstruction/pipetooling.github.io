/**
 * Pay-week anchor (journey-map Tier-1 #15, J7-2).
 *
 * People-hours approval surfaces used to count "pending" on three different
 * windows — the Hours grid on this Sun–Sat week, Draft Payroll on the prior
 * Sun–Sat week, and Moneyfill's "Sessions pending approval" on the prior
 * **Mon–Sun** close week — so three counts of one backlog never agreed, and
 * the Monday-anchored queue could approve half a pay week and leave the
 * runner thinking it was done.
 *
 * ONE rule, here: **the pay week is Sunday through Saturday** (company
 * calendar, matching `getPriorWeekPayStubRangeEnCa` in People.tsx and the
 * approvals queue's `weekStartYmd`). Bank-money queues on Moneyfill stay on
 * the Mon–Sun close week (they pair with the Weekly Money Movement report —
 * WEEKLY_MONEY_PLAN.md); only the people-hours queue re-anchors, via
 * `payWeekForCloseWeek`.
 */
import { formatWeekRangeLabel, weekEndYmd, weekStartYmd } from './people/approvalsQueue'
import { addDaysYmd } from './emailSchedule/emailScheduleWeek'
import { chicagoYmdOf } from './gcStatementStandingCopies'

/** Inclusive Sunday→Saturday range, YYYY-MM-DD. */
export type PayWeek = { start: string; end: string }

/** Sunday on or before `ymd`. */
export function payWeekStart(ymd: string): string {
  return weekStartYmd(ymd)
}

/** The Sun–Sat pay week containing `ymd`. */
export function payWeekContaining(ymd: string): PayWeek {
  const start = weekStartYmd(ymd)
  return { start, end: weekEndYmd(start) }
}

/** The last COMPLETE Sun–Sat pay week as of `now` (company calendar) — Draft Payroll's default period. */
export function previousCompletePayWeek(now: Date = new Date()): PayWeek {
  const thisStart = weekStartYmd(chicagoYmdOf(now))
  const start = addDaysYmd(thisStart, -7)
  return { start, end: weekEndYmd(start) }
}

/**
 * The pay week Moneyfill's people-hours queue shows for a Mon–Sun close week:
 * the Sun–Sat week that ENDS inside the close week (Sunday before the Monday →
 * the following Saturday). Closing "week of Aug 24–30" reviews pay week
 * Aug 23–29 — exactly what Draft Payroll opens to on the same Monday.
 */
export function payWeekForCloseWeek(weekMondayYmd: string): PayWeek {
  const start = addDaysYmd(weekMondayYmd, -1)
  return { start, end: weekEndYmd(start) }
}

/** "Aug 23–29" / "Aug 30 – Sep 5". */
export function formatPayWeekLabel(week: PayWeek): string {
  return formatWeekRangeLabel(week.start, week.end)
}

/**
 * Pending closed sessions the visible week's banner cannot see: company-wide
 * pending (the all-weeks RPC, v2.2694) minus the closed pending sessions
 * loaded for the visible range. Null when the company-wide count is unknown
 * (RPC failed or the viewer's role gets the zero row); never negative — the
 * visible range can hold sessions the RPC excludes (a revoked row still loads
 * as pending), so the floor is 0, not an error.
 */
export function pendingOutsideVisibleWeek(
  allWeeksPendingSessions: number | null | undefined,
  visibleWeekClosedPendingSessions: number,
): number | null {
  if (allWeeksPendingSessions == null) return null
  return Math.max(0, allWeeksPendingSessions - Math.max(0, visibleWeekClosedPendingSessions))
}

/**
 * Closed pending sessions in the loaded range — the same inclusion rule as the
 * count RPC (closed, not rejected, not revoked), so the subtraction above is
 * apples to apples.
 */
export function countClosedPendingSessions(
  sessions: ReadonlyArray<{ clocked_out_at: string | null; rejected_at?: string | null; revoked_at?: string | null }>,
): number {
  let n = 0
  for (const s of sessions) {
    if (s.clocked_out_at == null) continue
    if (s.rejected_at || s.revoked_at) continue
    n += 1
  }
  return n
}

/**
 * Banner suffix for the count above. When the visible range reaches today the
 * rest of the backlog can only be older ("earlier weeks"); when the viewer has
 * paged back, the rest may be newer too ("other weeks"). Empty string at 0/null.
 */
export function describePendingOutsideVisibleWeek(
  outside: number | null,
  visibleRangeEndYmd: string,
  todayYmd: string,
): string {
  if (outside == null || outside <= 0) return ''
  const where = visibleRangeEndYmd >= todayYmd ? 'earlier weeks' : 'other weeks'
  return `+${outside} session${outside === 1 ? '' : 's'} in ${where}`
}
