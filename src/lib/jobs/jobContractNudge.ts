/**
 * The contract backlog, counted (Contract Desk PR 4): which live jobs have
 * nothing on file, and which sent contracts have gone quiet. Pure; fed by
 * useJobContractsNudge and rendered as two Needs You items + the sweep list.
 */
import { buildJobContractCoverage, daysSinceIso, type JobContractCoverage, type JobContractRowLike, type SignedEstimateLike } from './jobContractCoverage'

/** Owner decision 2 (proposed): every non-paid stage is in scope. */
export const CONTRACT_NUDGE_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed'] as const
export const CONTRACT_STALE_DAYS = 7

export type ContractNudgeJob = { id: string; bid_id: string | null; status: string | null; revenue: number | null }

export type ContractNudgeSummary = {
  /** Live jobs with no agreement on file (none or draft). */
  missing: { count: number; jobIds: string[]; revenueTotal: number }
  /** Sent contracts unsigned for CONTRACT_STALE_DAYS or more. */
  stale: { count: number; jobIds: string[]; oldestDays: number | null }
  coverage: Map<string, JobContractCoverage>
}

export function summarizeContractNudge(
  jobs: ReadonlyArray<ContractNudgeJob>,
  contracts: ReadonlyArray<JobContractRowLike>,
  estimates: ReadonlyArray<SignedEstimateLike>,
  now: Date = new Date(),
): ContractNudgeSummary {
  const live = jobs.filter((j) => (CONTRACT_NUDGE_STATUSES as ReadonlyArray<string>).includes(j.status ?? ''))
  const coverage = buildJobContractCoverage(live, contracts, estimates)
  const missingIds: string[] = []
  let revenueTotal = 0
  const staleIds: string[] = []
  let oldest: number | null = null
  for (const j of live) {
    const cov = coverage.get(j.id)
    if (!cov || cov.kind === 'none' || cov.kind === 'draft') {
      missingIds.push(j.id)
      revenueTotal += Number(j.revenue ?? 0) || 0
      continue
    }
    if (cov.kind === 'sent') {
      const days = daysSinceIso(cov.sentAt, now)
      if (days != null && days >= CONTRACT_STALE_DAYS) {
        staleIds.push(j.id)
        oldest = oldest == null ? days : Math.max(oldest, days)
      }
    }
  }
  return {
    missing: { count: missingIds.length, jobIds: missingIds, revenueTotal },
    stale: { count: staleIds.length, jobIds: staleIds, oldestDays: oldest },
    coverage,
  }
}
