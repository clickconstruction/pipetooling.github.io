/**
 * Whether the job window's History tab draws the lien timeline above its day grid
 * (v2.3879, punch list #32 PR 3). The strip is for money still owed or paper already
 * out; a paid job with no filing and no letter has nothing on the path to read.
 */
export function showJobHistoryLienTimeline(args: { openBalance: number; hasPaper: boolean }): boolean {
  return args.hasPaper || args.openBalance > 0
}

/** The job's open balance the way the Lien window reads it: revenue less payments, never below zero. */
export function jobOpenBalance(job: { revenue?: number | null; payments_made?: number | null }): number {
  return Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
}
