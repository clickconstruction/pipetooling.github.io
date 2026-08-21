import { companyWeekStartSundayContaining, ymdAddDays } from '../../utils/dateUtils'

/**
 * Statements-tab close-card kernel: decides which completed Sun–Sat week the
 * "Close week" card should target, given the statement archive. The card used
 * to hardcode "last week" — a dead-end button once that week was generated,
 * and no path back to older uncovered weeks.
 *
 * Scope: gaps are only reported inside the archive's own span (earliest
 * loaded statement → last completed week); weeks before the first statement
 * are not the card's business.
 */

export type StatementClosePlan = {
  /** Sunday of the last completed week (currentWeekStart − 7). */
  prevWeek: string
  /** Last completed week when it has no statement yet, else null. */
  target: string | null
  /** Last completed week already has a statement. */
  prevWeekClosed: boolean
  /** The Sunday when the next close becomes available. */
  nextOpensOn: string
  /** Older completed weeks inside the archive span with no statement, oldest first. */
  olderUncovered: string[]
}

const MAX_SCAN_WEEKS = 156

export function planStatementClose(stubStarts: string[], currentWeekStart: string): StatementClosePlan {
  const prevWeek = ymdAddDays(currentWeekStart, -7)
  const covered = new Set<string>()
  for (const raw of stubStarts) {
    const sunday = companyWeekStartSundayContaining(raw)
    if (sunday) covered.add(sunday)
  }

  const prevWeekClosed = covered.has(prevWeek)
  const olderUncovered: string[] = []
  const earliest = [...covered].sort()[0]
  if (earliest) {
    let week = earliest
    for (let i = 0; i < MAX_SCAN_WEEKS && week < prevWeek; i++) {
      if (!covered.has(week)) olderUncovered.push(week)
      week = ymdAddDays(week, 7)
    }
  }

  return {
    prevWeek,
    target: prevWeekClosed ? null : prevWeek,
    prevWeekClosed,
    nextOpensOn: ymdAddDays(currentWeekStart, 7),
    olderUncovered,
  }
}
