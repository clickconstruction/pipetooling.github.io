// Punch list #61, PR 1: ZZ test jobs off the office's Pipeline. The rule is `isZzTestJob` (the job's
// own name or its customer's name starts with ZZ, `zzTestJobSweep.ts`); this file says who it hides
// them from and drops a ZZ job's rows, bills and payments together. It is a view rule, not RLS: the
// digital twins and the live passes run as non-dev roles and must keep reading the ZZ jobs they make.
// Pure: the reads are `fetchStagesHeaderStats.ts` and the jobs cache (`JobsListCacheContext.tsx`).

import { isZzTestJob } from './zzTestJobSweep'

type NamedJob = { job_name?: string | null; customer_name?: string | null }

/**
 * Whether ZZ test jobs are hidden for this role: for every role but dev. A role still loading
 * (null) hides them too, and a dev's rows come back the moment the role lands, because the cache
 * keeps them in state and hides them only where it hands rows out.
 */
export function hidesZzTestJobs(role: string | null | undefined): boolean {
  return role !== 'dev'
}

/** The rows without ZZ test jobs; the same array when there is none, so a memo stays put. */
export function withoutZzTestJobs<T extends NamedJob>(rows: T[]): T[] {
  return rows.some(isZzTestJob) ? rows.filter((r) => !isZzTestJob(r)) : rows
}

/** The ids of the ZZ test jobs among the rows. */
export function zzTestJobIds(rows: ReadonlyArray<NamedJob & { id: string }>): Set<string> {
  const ids = new Set<string>()
  for (const r of rows) if (isZzTestJob(r)) ids.add(r.id)
  return ids
}

export type ZzTestJobMoney<J, I, P> = { jobs: J[]; invoices: I[]; payments: P[] }

/**
 * Drops ZZ test jobs together with their bills and payments. Dropping the job alone would leave its
 * bills behind for `computeBillTruth` to file as orphans. `extraZzJobIds` names ZZ jobs the rows do
 * not carry, such as a paid one read by name on the server, whose bills and payments still arrive.
 */
export function withoutZzTestJobMoney<J extends NamedJob & { id: string }, I extends { job_id: string }, P extends { job_id: string }>(
  input: ZzTestJobMoney<J, I, P>,
  extraZzJobIds: Iterable<string> = [],
): ZzTestJobMoney<J, I, P> & { zzJobIds: Set<string> } {
  const zzJobIds = zzTestJobIds(input.jobs)
  for (const id of extraZzJobIds) zzJobIds.add(id)
  if (zzJobIds.size === 0) return { ...input, zzJobIds }
  return {
    jobs: input.jobs.filter((j) => !zzJobIds.has(j.id)),
    invoices: input.invoices.filter((i) => !zzJobIds.has(i.job_id)),
    payments: input.payments.filter((p) => !zzJobIds.has(p.job_id)),
    zzJobIds,
  }
}
