/**
 * GC mode — design spike: finishing late against the owner contract (Owner Billing lane, owner's
 * go-ahead 2026-10-04). The contract's date is substantial completion with the signed change
 * orders' days (`substantialCompletionOn`, the Building lane's). A late fee a day (liquidated
 * damages) is ours to enter from the owner contract, per job.
 *
 * The schedule's finish is the Building lane's (`projectedFinish`), with the sentence that says why.
 * Import from `./gcModel`.
 */
import type { GcProject, GcState } from './gcTypes'
import { daysBetween, projectedFinish, substantialCompletionOn, type ProjectedFinish } from './gcBuildingSchedule'

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
