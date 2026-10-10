// Punch list #61: ZZ test jobs off the office's screens (PR 1 the Pipeline, PR 2a the dev's switch and
// the Dashboard's money). The rule is `isZzTestJob` (the job's
// own name or its customer's name starts with ZZ, `zzTestJobSweep.ts`); this file says who it hides
// them from and drops a ZZ job's rows, bills and payments together. It is a view rule, not RLS: the
// digital twins and the live passes run as non-dev roles and must keep reading the ZZ jobs they make.
// Pure: the reads are `zzTestJobRows.ts` and the jobs cache (`JobsListCacheContext.tsx`); the dev's
// switch is `zzTestJobSwitch.ts`.

import { isZzTestJob } from './zzTestJobSweep'

type NamedJob = { job_name?: string | null; customer_name?: string | null }

/**
 * Whether ZZ test jobs are hidden: for every role but dev always, and for a dev unless their switch
 * shows them (Hide groups…, hidden by default, v2.5120). A role still loading (null) hides them, and
 * a dev's rows come back the moment the role lands, because the cache keeps them in state and hides
 * them only where it hands rows out.
 */
export function hidesZzTestJobs(role: string | null | undefined, devShowsZz = false): boolean {
  return role !== 'dev' || !devShowsZz
}

/** The rows without ZZ test jobs; the same array when there is none, so a memo stays put. */
export function withoutZzTestJobs<T extends NamedJob>(rows: T[]): T[] {
  return rows.some(isZzTestJob) ? rows.filter((r) => !isZzTestJob(r)) : rows
}

/**
 * Rows that point at a job (a bill, an RPC's job row): drop the ones whose job is a ZZ test job, by the
 * row's own names when it carries them, or by the shared ids (`zzTestJobRows.ts`) when it carries only
 * an id or no customer name. The same array when nothing is dropped, so a memo stays put.
 */
export function withoutZzTestJobRows<T extends NamedJob>(
  rows: T[],
  jobIdOf: (row: T) => string | null | undefined,
  zzJobIds: ReadonlySet<string> | null,
): T[] {
  const isZz = (r: T) => {
    const id = jobIdOf(r)
    return isZzTestJob(r) || (id != null && zzJobIds != null && zzJobIds.has(id))
  }
  return rows.some(isZz) ? rows.filter((r) => !isZz(r)) : rows
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
 * not carry, such as a paid one, or every one when the rows carry no names (the shared id read). A
 * payment goes with its job, or with its bill when the read selected no job id.
 */
export function withoutZzTestJobMoney<
  J extends NamedJob & { id: string },
  I extends { id: string; job_id: string },
  P extends { job_id?: string | null; invoice_id?: string | null },
>(
  input: ZzTestJobMoney<J, I, P>,
  extraZzJobIds: Iterable<string> = [],
): ZzTestJobMoney<J, I, P> & { zzJobIds: Set<string> } {
  const zzJobIds = zzTestJobIds(input.jobs)
  for (const id of extraZzJobIds) zzJobIds.add(id)
  if (zzJobIds.size === 0) return { ...input, zzJobIds }
  const droppedInvoiceIds = new Set(input.invoices.filter((i) => zzJobIds.has(i.job_id)).map((i) => i.id))
  return {
    jobs: input.jobs.filter((j) => !zzJobIds.has(j.id)),
    invoices: input.invoices.filter((i) => !zzJobIds.has(i.job_id)),
    payments: input.payments.filter(
      (p) => !(p.job_id && zzJobIds.has(p.job_id)) && !(p.invoice_id && droppedInvoiceIds.has(p.invoice_id)),
    ),
    zzJobIds,
  }
}
