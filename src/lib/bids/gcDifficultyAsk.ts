/**
 * GC difficulty rating (punch list #357, PR 5): the ask at the end of a job.
 *
 * The owner's call 7 of 2026-11-14: the master is asked at the end of a job with that GC, once, on the same phone
 * sheet. A job has no closed status; the work-done moment is its first move to Ready to bill
 * (`job_status_events`). The open asks are derived from those moves by `gc_difficulty_open_asks()`: the job's
 * master, a GC on the job, no rating of that GC since the job closed, and no answer on record. An answer is one row
 * of `gc_difficulty_asks`: the rating that answered it, or the day it was put away. Either way the job never asks
 * again.
 *
 * Several jobs with one GC can close in a week, so the asks fold by GC: one line, the newest job named, and one
 * answer settles them all. Pure: no React, no supabase.
 */
export type GcDifficultyOpenAsk = {
  jobId: string
  customerId: string
  customerName: string
  /** "1042 Riverside Lofts", as the app labels a job. */
  jobLabel: string
  /** When the job first moved to Ready to bill. */
  closedAt: string
}

export type GcDifficultyAskGroup = {
  customerId: string
  customerName: string
  /** The job that closed last: the one the sheet names. */
  newest: GcDifficultyOpenAsk
  /** Every open ask for this GC, newest first. One answer settles them all. */
  asks: GcDifficultyOpenAsk[]
}

/** The asks folded by GC, the GC whose job closed last first. */
export function gcDifficultyAskGroups(asks: readonly GcDifficultyOpenAsk[]): GcDifficultyAskGroup[] {
  const sorted = [...asks].sort((a, b) => b.closedAt.localeCompare(a.closedAt) || a.jobId.localeCompare(b.jobId))
  const by = new Map<string, GcDifficultyAskGroup>()
  for (const a of sorted) {
    const g = by.get(a.customerId)
    if (g) g.asks.push(a)
    else by.set(a.customerId, { customerId: a.customerId, customerName: a.customerName, newest: a, asks: [a] })
  }
  return [...by.values()]
}

/** The ask a job's window shows: this job's own, whatever else is open for its GC. */
export function gcDifficultyAskForJob(asks: readonly GcDifficultyOpenAsk[], jobId: string | null | undefined): GcDifficultyOpenAsk | null {
  if (!jobId) return null
  return asks.find((a) => a.jobId === jobId) ?? null
}

const gcName = (name: string) => name.trim() || 'this GC'

export const GC_DIFFICULTY_ASK_WORDS = {
  /** The line in the job's window. */
  jobLine: (customerName: string) => `This job is done. How was ${gcName(customerName)} to work with?`,
  rate: 'Rate them',
  notNow: 'Not now',
  /** The Bid Board's press: it draws only with something to rate. */
  boardPress: (groups: number) => (groups === 1 ? 'Rate a GC after a job · 1' : `Rate GCs after a job · ${groups}`),
  listTitle: 'Rate after a job',
  listLead: 'A job with each of these GCs is done. Say how they were to work with while it is fresh. Every new bid to them reads it.',
  /** One row of the list: "Seguin Ridge Builders · 1042 Riverside Lofts and 2 more jobs". */
  groupLine: (g: GcDifficultyAskGroup) => {
    const more = g.asks.length - 1
    return `${g.newest.jobLabel}${more > 0 ? ` and ${more} more job${more === 1 ? '' : 's'}` : ''}`
  },
  putAway: (customerName: string) => `Put away. This job will not ask about ${gcName(customerName)} again.`,
  putAwayFailed: 'The ask could not be put away.',
  listEmpty: 'Nothing waiting on a rating.',
} as const
