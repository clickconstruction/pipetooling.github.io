// The order Sort mode offers a purchase's day jobs in (punch list #72): the swipe day's clocked
// jobs, then its scheduled jobs, then the day before's and the day after's, clocked before
// scheduled. Each job once, at its first place. Until 2026-10-06 the clocked jobs of all three days
// came in database order, so the day before's job could lead. Pure.

export type SortModeSessionRow = { work_date: string; job_ledger_id: string | null }

export function orderSortModeDayJobIds(args: {
  anchorYmd: string
  beforeYmd: string
  afterYmd: string
  sessions: readonly SortModeSessionRow[]
  /** Scheduled job ids per day, each in schedule order. */
  scheduledByDay: ReadonlyMap<string, readonly string[]>
}): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (id: string | null | undefined) => {
    if (id && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  const clockedOn = (ymd: string) => {
    for (const s of args.sessions) if (s.work_date === ymd) push(s.job_ledger_id)
  }
  const scheduledOn = (ymd: string) => {
    for (const id of args.scheduledByDay.get(ymd) ?? []) push(id)
  }
  clockedOn(args.anchorYmd)
  scheduledOn(args.anchorYmd)
  clockedOn(args.beforeYmd)
  clockedOn(args.afterYmd)
  scheduledOn(args.beforeYmd)
  scheduledOn(args.afterYmd)
  return ordered
}
