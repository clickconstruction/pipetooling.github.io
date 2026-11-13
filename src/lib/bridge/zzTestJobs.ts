/**
 * The Bridge's ZZ test jobs (v2.6807): the loader's reads that return jobs, bills or payments drop a ZZ test job's
 * rows by the rule the Pipeline hides it by (`src/lib/jobs/zzTestJobVisibility.ts`), so a test job a live pass left
 * in a stage counts in none of the owner's figures. `zzTestJobIds` is the shared id read (`zzTestJobRows.ts` on the
 * page, the service role's own read on the edge); null keeps every row, for a dev whose switch shows them. A row
 * that carries its job's names is dropped by them too, so a ZZ job made since the ids were read still leaves. Pure:
 * `loadBridgeData.ts` and `bill/loadBillDesk.ts` make the reads, and since v2.6813 so do the Build pace, the people's
 * reads (`loadBridgeVectors.ts`, `loadVectorDays.ts`), the demand read, the Market and Sales desks and the Collect
 * scorecard: `bridgeZzJobIds` names the ZZ jobs a read's rows show, and `withoutZzJobKeyedRows` drops the rows keyed to
 * one. Since v2.6823 the bids follow their own rule for the same viewer (`withoutZzBridgeBids`, the bid picker's
 * `isZzBidName`: a project name that starts with the word ZZ, the robots' shadow and backtest bids and the office's
 * test bids; the rule sits beside the jobs' in `_shared/zzTestJob.ts`), so a robot's bid is no ask on Market, no bid sent, won or awaiting on Sales, nobody's on Vectors and no
 * bid due; the shared ids stand for the viewer's switch, null keeping them. Since v2.7119 the estimates behind the won
 * rate follow the same switch (`isZzEstimate` in `loadEstimateWins.ts`); the count of asks still reads every estimate.
 */
import { isZzBidName } from '../jobs/zzTestJobSweep'
import { withoutZzTestJobMoney, withoutZzTestJobRows, zzTestJobIds as zzIdsAmong } from '../jobs/zzTestJobVisibility'

/** The ZZ test jobs to leave out, or null to keep them (a dev whose switch shows them). */
export type BridgeZzTestJobIds = ReadonlySet<string> | null

type NamedJobRow = { id: string; job_name?: string | null; customer_name?: string | null }

/** Job rows without the ZZ test jobs, by their own names or the shared ids. The same array when none is dropped. */
export function withoutZzBridgeJobs<T extends NamedJobRow>(rows: T[], zzTestJobIds: BridgeZzTestJobIds): T[] {
  return zzTestJobIds ? withoutZzTestJobRows(rows, (r) => r.id, zzTestJobIds) : rows
}

/** The Ready to Bill read: the count is the Pipeline section's rows for the same viewer. */
export function bridgeReadyToBill(rows: Array<NamedJobRow & { revenue: number | null }>, zzTestJobIds: BridgeZzTestJobIds): { count: number; revenueUsd: number } {
  const kept = withoutZzBridgeJobs(rows, zzTestJobIds)
  return { count: kept.length, revenueUsd: kept.reduce((sum, r) => sum + Number(r.revenue ?? 0), 0) }
}

/** The Collections read: the jobs in collections and what is still open on them. */
export function bridgeCollections(rows: Array<NamedJobRow & { revenue: number | null; payments_made: number | null }>, zzTestJobIds: BridgeZzTestJobIds): { count: number; openUsd: number } {
  const kept = withoutZzBridgeJobs(rows, zzTestJobIds)
  return { count: kept.length, openUsd: kept.reduce((sum, r) => sum + Math.max(0, Number(r.revenue ?? 0) - Number(r.payments_made ?? 0)), 0) }
}

/**
 * Every ZZ test job a read knows: the shared ids, and the jobs its own rows name as ZZ (one made since the ids were
 * read). Null when the viewer keeps them, so it passes straight on as the next read's `zzTestJobIds`.
 */
export function bridgeZzJobIds(namedRows: ReadonlyArray<NamedJobRow>, zzTestJobIds: BridgeZzTestJobIds): BridgeZzTestJobIds {
  if (!zzTestJobIds) return null
  const named = zzIdsAmong(namedRows)
  if (named.size === 0) return zzTestJobIds
  for (const id of zzTestJobIds) named.add(id)
  return named
}

/**
 * Rows keyed to a job by an id alone (a clock session, a percent point, a report, an activity event, a payment),
 * without a ZZ test job's. A row on no job stays. The same array when none is dropped.
 */
export function withoutZzJobKeyedRows<T>(rows: T[], jobIdOf: (row: T) => string | null | undefined, zzTestJobIds: BridgeZzTestJobIds): T[] {
  if (!zzTestJobIds || zzTestJobIds.size === 0) return rows
  const isZz = (r: T) => {
    const id = jobIdOf(r)
    return id != null && zzTestJobIds.has(id)
  }
  return rows.some(isZz) ? rows.filter((r) => !isZz(r)) : rows
}

/**
 * Bid rows without the ZZ bids (`isZzBidName` on the project name), for the viewer who leaves ZZ test jobs out:
 * `zzTestJobIds` is that viewer's switch here, null keeping every bid for a dev who shows them. The picker keeps a ZZ
 * bid marked by or for the person; the Bridge reads for no person, so every ZZ bid leaves. The same array when none
 * is dropped.
 */
export function withoutZzBridgeBids<T extends { project_name?: string | null }>(rows: T[], zzTestJobIds: BridgeZzTestJobIds): T[] {
  if (!zzTestJobIds) return rows
  const isZz = (b: T) => isZzBidName(b.project_name)
  return rows.some(isZz) ? rows.filter((b) => !isZz(b)) : rows
}

/** Field sessions without the ones clocked on a ZZ test job, so it is no job worked and earns nothing. */
export function withoutZzFieldSessions<T extends { job_ledger_id: string | null }>(sessions: T[], zzTestJobIds: BridgeZzTestJobIds): T[] {
  return withoutZzJobKeyedRows(sessions, (s) => s.job_ledger_id, zzTestJobIds)
}

/**
 * The bills sent and the payments in, without a ZZ test job's: a bill goes with its job, a payment with its job or
 * with its bill (`withoutZzTestJobMoney`).
 */
export function withoutZzBridgeMoney<I extends { id: string; job_id: string }, P extends { job_id?: string | null; invoice_id?: string | null }>(
  money: { bills: I[]; payments: P[] },
  zzTestJobIds: BridgeZzTestJobIds,
): { bills: I[]; payments: P[] } {
  if (!zzTestJobIds) return money
  const kept = withoutZzTestJobMoney({ jobs: [] as NamedJobRow[], invoices: money.bills, payments: money.payments }, zzTestJobIds)
  return { bills: kept.invoices, payments: kept.payments }
}

/**
 * The Bill desk's reads: the label rows carry the jobs' names, so a ZZ test job leaves by its own name or its
 * customer's as well as by the shared ids, and its bills leave with it. `zzJobIds` names every job dropped, for the
 * reads keyed by job (the ready days).
 */
export function withoutZzBillDeskRows<J extends NamedJobRow, I extends { id: string; job_id: string }>(
  rows: { jobs: J[]; invoices: I[] },
  zzTestJobIds: BridgeZzTestJobIds,
): { jobs: J[]; invoices: I[]; zzJobIds: ReadonlySet<string> } {
  if (!zzTestJobIds) return { ...rows, zzJobIds: new Set() }
  const kept = withoutZzTestJobMoney({ jobs: rows.jobs, invoices: rows.invoices, payments: [] }, zzTestJobIds)
  return { jobs: kept.jobs, invoices: kept.invoices, zzJobIds: kept.zzJobIds }
}
