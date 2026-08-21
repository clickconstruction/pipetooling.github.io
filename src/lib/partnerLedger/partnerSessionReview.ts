/**
 * Session drill-down kernel for the Partnerships → Job review tab: shapes a
 * partner's clock sessions on one job for the expandable panel — duration,
 * status chip, statement-week detection — and totals the checkbox selection
 * for the bulk move-hours bar. Pure view/summary logic; the component owns
 * fetching and the actual job_ledger_id update.
 */

export type ReviewSessionRow = {
  id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

export type StatementWeek = { period_start: string; period_end: string }

export type ShapedReviewSession = {
  id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  /** decimal hours; null while the session is still open */
  hours: number | null
  note: string
  status: 'approved' | 'pending' | 'open'
  /** period_start of the generated statement week covering work_date, else null */
  statement_week: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function sessionHours(s: Pick<ReviewSessionRow, 'clocked_in_at' | 'clocked_out_at'>): number | null {
  if (!s.clocked_out_at) return null
  const ms = new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return round1(ms / 3_600_000)
}

/** The generated statement week (its period_start) covering a work date. */
export function statementWeekFor(workDate: string, weeks: StatementWeek[]): string | null {
  for (const w of weeks) {
    if (workDate >= w.period_start && workDate <= w.period_end) return w.period_start
  }
  return null
}

/**
 * Shape raw session rows for the panel: rejected/revoked sessions are dropped
 * (they don't count toward the queue's hours and moving them is noise), the
 * rest sort newest-first by work date then clock-in.
 */
export function shapeReviewSessions(rows: ReviewSessionRow[], weeks: StatementWeek[]): ShapedReviewSession[] {
  return rows
    .filter((r) => r.rejected_at == null && r.revoked_at == null)
    .map((r) => ({
      id: r.id,
      work_date: r.work_date,
      clocked_in_at: r.clocked_in_at,
      clocked_out_at: r.clocked_out_at,
      hours: sessionHours(r),
      note: r.notes.trim(),
      status: (r.clocked_out_at == null ? 'open' : r.approved_at != null ? 'approved' : 'pending') as ShapedReviewSession['status'],
      statement_week: statementWeekFor(r.work_date, weeks),
    }))
    .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.clocked_in_at.localeCompare(a.clocked_in_at))
}

/** Totals for the action bar; open sessions contribute 0 hours. */
export function summarizeSelection(
  sessions: ShapedReviewSession[],
  selected: ReadonlySet<string>,
): { count: number; hours: number; onStatementCount: number } {
  let count = 0
  let hours = 0
  let onStatementCount = 0
  for (const s of sessions) {
    if (!selected.has(s.id)) continue
    count += 1
    hours += s.hours ?? 0
    if (s.statement_week != null) onStatementCount += 1
  }
  return { count, hours: round1(hours), onStatementCount }
}
