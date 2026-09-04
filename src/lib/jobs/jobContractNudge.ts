/**
 * The contract backlog, counted (Contract Desk PR 4): which live jobs have
 * nothing on file, and which sent contracts have gone quiet. Pure; fed by
 * useJobContractsNudge and rendered as two Needs You items + the sweep list.
 */
import { buildJobContractCoverage, daysSinceIso, type JobContractCoverage, type JobContractRowLike, type SignedEstimateLike } from './jobContractCoverage'

/** Owner decision 2 (proposed): every non-paid stage is in scope. */
export const CONTRACT_NUDGE_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed'] as const
export const CONTRACT_STALE_DAYS = 7

export type ContractNudgeJob = { id: string; bid_id: string | null; status: string | null; revenue: number | null; collections_at?: string | null }

export const CONTRACT_STAGES = ['waiting', 'working', 'ready_to_bill', 'billed', 'collections'] as const
export type ContractStage = (typeof CONTRACT_STAGES)[number]
export const CONTRACT_STAGE_LABELS: Record<ContractStage, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed',
  collections: 'Collections',
}

/** Board stage for a live job: Collections is a billed job flagged collections_at (jobInCollections). */
export function contractStageOf(job: Pick<ContractNudgeJob, 'status' | 'collections_at'>): ContractStage | null {
  const s = job.status ?? ''
  if (s === 'billed') return job.collections_at ? 'collections' : 'billed'
  return s === 'waiting' || s === 'working' || s === 'ready_to_bill' ? s : null
}

export type ContractStageCounts = Record<ContractStage, { total: number; missing: number; revenueMissing: number }>

export type ContractNudgeSummary = {
  /** Live jobs with no agreement on file (none or draft). */
  missing: { count: number; jobIds: string[]; revenueTotal: number }
  /** Sent contracts unsigned for CONTRACT_STALE_DAYS or more. */
  stale: { count: number; jobIds: string[]; oldestDays: number | null }
  /** Per board stage (Paid excluded): how many live jobs, how many without an agreement. */
  byStage: ContractStageCounts
  /** Live jobs in scope (every stage but Paid). */
  liveTotal: number
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
  const byStage = Object.fromEntries(CONTRACT_STAGES.map((k) => [k, { total: 0, missing: 0, revenueMissing: 0 }])) as ContractStageCounts
  for (const j of live) {
    const cov = coverage.get(j.id)
    const stage = contractStageOf(j)
    if (stage) byStage[stage].total++
    if (!cov || cov.kind === 'none' || cov.kind === 'draft') {
      missingIds.push(j.id)
      const rev = Number(j.revenue ?? 0) || 0
      revenueTotal += rev
      if (stage) {
        byStage[stage].missing++
        byStage[stage].revenueMissing += rev
      }
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
    byStage,
    liveTotal: live.length,
    coverage,
  }
}
