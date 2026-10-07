/**
 * GC mode, the real build, Owner Billing's O2a: finishing late against the contract with the customer, moved word for word
 * from the GC mode prototype (branch spike/gc-mode, `gcOwnerBillingFinish.ts`). It reads the schedule's kernels; nothing in
 * `schedule/` reads billing.
 */
import type { ProjectedFinish } from './schedule/schedule'
import { daysBetween, projectedFinish, substantialCompletionOn } from './schedule/schedule'
import type { GcProject, GcState } from './types'

export interface OwnerFinishRisk {
  /** The contract's day: substantial completion with change orders' days. Null: no milestone for it. */
  contract: { planned: string; days: number; on: string } | null
  /** When the schedule finishes, with why (the Building lane's `projectedFinish`). Null: no schedule. */
  schedule: ProjectedFinish | null
  /** Days the schedule finishes past the contract's day (negative: days to spare). Null: one of them is missing. */
  past: number | null
  /** The contract's late fee a day, as we entered it. Null: none entered. */
  perDay: number | null
  /** Days past times the fee a day. 0 when on time or no fee. */
  atRisk: number
}

/** Where the job's finish stands against the owner contract, and what finishing late would cost. */
export function ownerFinishRisk(state: GcState, project: GcProject): OwnerFinishRisk {
  const contract = substantialCompletionOn(project)
  const schedule = projectedFinish(project, state.today)
  const past = contract && schedule ? daysBetween(contract.on, schedule.on) : null
  const perDay = project.ownerLateFinish?.perDay ?? null
  return { contract, schedule, past, perDay, atRisk: past !== null && past > 0 && perDay ? past * perDay : 0 }
}
