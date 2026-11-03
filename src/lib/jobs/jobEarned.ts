/**
 * What a job has earned of its contract (v2.6407, punch list #250): the whole contract when the
 * caller says it is finished, the percent's share while it works, and half when no percent is on
 * record yet. Job Summary's rule since v2.2692, lifted out of `enrichJobSummaryRows` so the
 * Development page's scoreboard and the Job Summary table earn by one kernel. A window's share by
 * hours (`earnedRevenueInWindow`) sits on top of this for a caller with a day ledger. Pure.
 */
export type JobEarnedFlag = 'assumed-50' | 'earned'

export type JobEarned = { usd: number; flags: JobEarnedFlag[] }

export function jobEarned(args: { contractUsd: number; pct: number | null; finished: boolean }): JobEarned {
  const { contractUsd, pct, finished } = args
  if (finished) return { usd: contractUsd, flags: [] }
  const flags: JobEarnedFlag[] = []
  let usd: number
  if (pct == null) {
    usd = contractUsd * 0.5
    flags.push('assumed-50')
  } else usd = contractUsd * (pct / 100)
  if (contractUsd > 0) flags.push('earned')
  return { usd, flags }
}
