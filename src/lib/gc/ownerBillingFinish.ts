/**
 * GC mode, the real build, Owner Billing's O2a: finishing late against the contract with the customer, moved word for word
 * from the GC mode prototype (branch spike/gc-mode, `gcOwnerBillingFinish.ts`). It reads the schedule's kernels; nothing in
 * `schedule/` reads billing.
 */
import type { ProjectedFinish } from './schedule/schedule'
import { daysBetween, isSubstantial, projectedFinish, substantialCompletionOn } from './schedule/schedule'
import type { GcProject, GcState } from './types'
import { money, weekdayDate } from './words'

export interface OwnerFinishRisk {
  /** The contract's day: substantial completion with change orders' days. Null: no milestone for it. */
  contract: { planned: string; days: number; on: string } | null
  /** When the schedule finishes, with why (the Building lane's `projectedFinish`). Null: no schedule. */
  schedule: ProjectedFinish | null
  /** The day we reached substantial completion: Building's dates to meet, the milestone's `metOn`. Null: not yet. */
  metOn: string | null
  /**
   * The finish counted against the contract (O6b-3): the day we reached substantial completion once Building has it,
   * the schedule's projected finish until then. Null: neither.
   */
  finish: { on: string; from: 'met' | 'projected' } | null
  /** Days the finish runs past the contract's day (negative: days to spare). Null: one of them is missing. */
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
  const metOn = project.schedule?.milestones.find(isSubstantial)?.metOn ?? null
  const finish = metOn ? { on: metOn, from: 'met' as const } : schedule ? { on: schedule.on, from: 'projected' as const } : null
  const past = contract && finish ? daysBetween(contract.on, finish.on) : null
  const perDay = project.ownerLateFinish?.perDay ?? null
  return { contract, schedule, metOn, finish, past, perDay, atRisk: past !== null && past > 0 && perDay ? past * perDay : 0 }
}

function dayCount(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/**
 * The job's finish against the contract in a line (O6b-3): which day counts, and how far it is from the contract's day.
 * "We reached substantial completion Fri Oct 30, 3 days past the contract's Tue Oct 27."
 */
export function ownerFinishWords(risk: OwnerFinishRisk): string {
  if (!risk.contract) return 'Substantial completion is not on the schedule yet.'
  if (!risk.finish) return 'No schedule yet, so no finish to count.'
  const lead = risk.finish.from === 'met' ? `We reached substantial completion ${weekdayDate(risk.finish.on)}` : `The schedule finishes ${weekdayDate(risk.finish.on)}`
  const past = risk.past ?? 0
  const against = past > 0 ? `${dayCount(past)} past` : past < 0 ? `${dayCount(-past)} before` : 'on'
  return `${lead}, ${against} the contract's ${weekdayDate(risk.contract.on)}.`
}

/** The contract's late fee in Bill the customer's terms (O6b-3), or that none is typed. */
export function ownerLateFeeWords(perDay: number | null | undefined): string {
  return perDay == null ? 'No late fee is entered from the contract.' : `${money(perDay)} a day past the contract's substantial completion.`
}
