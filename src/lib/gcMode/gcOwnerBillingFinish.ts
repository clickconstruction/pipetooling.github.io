/**
 * GC mode — design spike: finishing late against the owner contract (Owner Billing lane, owner's
 * go-ahead 2026-10-04). The contract's date is substantial completion with the signed change
 * orders' days (`substantialCompletionOn`, the Building lane's). The schedule's finish is the later
 * of the current plan's last finish and the baseline's last finish moved by the days the work runs
 * behind. A late fee a day (liquidated damages) is ours to enter from the owner contract, per job.
 *
 * The schedule's finish is a stand-in until the Building lane's `projectedFinish` lands; then this
 * reads theirs. Import from `./gcModel`.
 */
import type { GcProject, GcState } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleRows, substantialCompletionOn, workVsPlan } from './gcBuildingSchedule'

export interface ScheduleFinish {
  on: string
  /** Days the work runs behind the baseline. 0: on plan or ahead. */
  behind: number
  /** 'plan': the current plan's last finish. 'pace': the baseline's last finish moved by the days behind. */
  from: 'plan' | 'pace'
}

/** When the schedule finishes at today's pace. Null: no schedule. */
function scheduleFinish(state: GcState, project: GcProject): ScheduleFinish | null {
  const schedule = project.schedule
  if (!schedule || schedule.activities.length === 0) return null
  const last = (dates: string[]) => dates.reduce((m, d) => (d > m ? d : m), '')
  const planEnd = last(schedule.activities.map((a) => a.finish))
  const baseEnd = schedule.baseline ? last(Object.values(schedule.baseline.activities).map((a) => a.finish)) : planEnd
  const behind = Math.max(0, workVsPlan(scheduleRows(state, project), state.today).daysBehind)
  const paceEnd = behind > 0 ? addDays(baseEnd, behind) : baseEnd
  return paceEnd > planEnd ? { on: paceEnd, behind, from: 'pace' } : { on: planEnd, behind, from: 'plan' }
}

export interface OwnerFinishRisk {
  /** The contract's day: substantial completion with change orders' days. Null: no milestone for it. */
  contract: { planned: string; days: number; on: string } | null
  /** When the schedule finishes. Null: no schedule. */
  schedule: ScheduleFinish | null
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
  const schedule = scheduleFinish(state, project)
  const past = contract && schedule ? daysBetween(contract.on, schedule.on) : null
  const perDay = project.ownerLateFinish?.perDay ?? null
  return { contract, schedule, past, perDay, atRisk: past !== null && past > 0 && perDay ? past * perDay : 0 }
}
