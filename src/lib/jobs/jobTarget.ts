/**
 * A job's target, on the job window (punch list #255, v2.6585). The project board (v2.6321) set expected hours on
 * working projects alone; a service job carried none, so the lead's signal, the crew's hours against the target, had
 * nothing to count on most jobs. The job window's Job tab now carries a Target line for any job: the open expected
 * hours (`job_expected_hours`), else the labor budget's hours, with the press that sets or clears it.
 *
 * Pure: the line's words and the editor's checks. The reads and writes are `useExpectedHours`.
 */
import type { ExpectedHoursTarget } from './expectedHours'
import { targetWords } from './superintendentLine'
import { targetOf } from '../techWeek/crewTarget'

export type JobTargetWords = {
  /** "Target 96 h", "Target 110 h from the labor budget", "No target yet" */
  head: string
  /** "Expected 96 h, set by Robert on Nov 1 (was 110 h): framed in a week", "The labor budget is 110 h from the bid.", "The crew's hours against the target are counted once this is set." */
  detail: string
  /** The number the signal counts, or null while the job carries none. */
  counts: number | null
  /** The press's label: Set a target, Change the target. */
  press: string
  /** Whether Back to the budget is offered: only while an expected-hours row is open. */
  clearable: boolean
}

export type BudgetSource = 'bid' | 'typed' | null

export function jobTargetWords(target: ExpectedHoursTarget | null, budgetHours: number | null, budgetSource: BudgetSource): JobTargetWords {
  if (target) {
    return { head: `Target ${Math.round(target.hours)} h`, detail: targetWords({ by: target.by, at: target.at, from: target.from, why: target.why }, target.hours), counts: target.hours, press: 'Change the target', clearable: true }
  }
  const counts = targetOf(null, budgetHours)
  if (counts != null) {
    const from = budgetSource === 'typed' ? 'typed by the office' : budgetSource === 'bid' ? 'from the bid' : 'on the Costs tab'
    return { head: `Target ${Math.round(counts)} h from the labor budget`, detail: `The labor budget is ${Math.round(counts)} h ${from}. Set a target to read a different number here.`, counts, press: 'Set a target', clearable: false }
  }
  return { head: 'No target yet', detail: 'The crew’s hours against the target are counted once this is set.', counts: null, press: 'Set a target', clearable: false }
}

export const WHY_MIN = 3
export const WHY_MAX = 240

/** The editor's check: hours above zero and a reason of three to 240 characters. Null when it may save. */
export function targetDraftProblem(hoursText: string, why: string): string | null {
  const hours = Number(hoursText.replace(/[^0-9.]/g, ''))
  if (!hoursText.trim() || !Number.isFinite(hours) || hours <= 0) return 'Type the hours the job should take.'
  if (hours > 100_000) return 'That is more hours than a job takes.'
  const w = why.trim()
  if (w.length < WHY_MIN) return 'Say why, in a few words. The crew reads it.'
  if (w.length > WHY_MAX) return `Keep the reason under ${WHY_MAX} characters.`
  return null
}

export const parseHours = (hoursText: string): number => Math.round(Number(hoursText.replace(/[^0-9.]/g, '')) * 10) / 10
