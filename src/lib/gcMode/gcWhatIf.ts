/**
 * GC mode design spike: a what-if copy of the schedule, the Gantt's G-81
 * (`to-dos/gc-mode/mockups/G-81.md`). G-80 answers "if this one bar slips 5 days". The office's real
 * questions are bigger: what if the roof slips a week and we bring the HVAC crew in early? The copy
 * is the whole schedule, beside the real one and never inside it (`GcProject.whatIf`), to try moves
 * on with Why it moved optional. It is kept as real moves with their reasons, or thrown away.
 * Nothing outside the Schedule tab reads it, so the trades, the customer, Follow up and Needs you
 * never see it.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it. The reducer runs the
 * copy's moves through itself (`inWhatIf`), so this file holds no copy of the move rules.
 */
import type { GcAction, GcProject, GcState } from './gcTypes'
import { daysBetween } from './gcBuildingSchedule'
import { scheduleFinish } from './gcScheduleMoves'
import { planBillingShift, shiftWords, type ForecastShift } from './gcBillingForecast'
import { companiesToTell } from './gcTellTrades'
import { weekdayDate } from './gcWords'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { whatIfTried } from '../gc/schedule/whatIf'
export { WHAT_IF_NO_WHY, keepWhatIf, whatIfBaseChangedWords, whatIfBaseChanges, whatIfCopy, whatIfGhosts, whatIfProject, whatIfTried } from '../gc/schedule/whatIf'

/** What a what-if copy takes (G-81): a move, a pull, undo and redo, and days got back (G-82). Everything else records what happened, so it belongs to the real schedule. */
export const WHAT_IF_ACTIONS: GcAction['type'][] = ['setScheduleActivity', 'pullScheduleEarlier', 'undoScheduleMove', 'redoScheduleMove', 'recoverScheduleDays', 'moveActivityPart']
type Span = { start: string; finish: string }
const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`
/** "a, b and c" */
function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
/** The copy against the real schedule, for the line over the chart and Keep. */
export interface WhatIfDiff {
  /** Moves tried and still standing. */
  moves: number
  /** Of those, tried with no reason yet. */
  noWhy: number
  /** Each bar whose dates differ, with its real dates and the copy's. */
  bars: { lineId: string; real: Span; copy: Span }[]
  finishReal: string
  finishCopy: string
  /** Days the copy's last finish is past the real one's. Negative: sooner. */
  finishDays: number
  /** What the copy does to the bills, the forecast on its dates against the real ones (G-97). */
  billing: ForecastShift[]
  /** The line's sentences, in order. */
  words: string[]
}
export function whatIfDiff(state: GcState, project: GcProject): WhatIfDiff | null {
  const copy = project.whatIf
  const real = project.schedule
  if (!copy || !real) return null
  const tried = whatIfTried(project)
  const realById = new Map(real.activities.map((a) => [a.lineId, a]))
  const bars = copy.schedule.activities.flatMap((c) => {
    const r = realById.get(c.lineId)
    return r && (r.start !== c.start || r.finish !== c.finish) ? [{ lineId: c.lineId, real: { start: r.start, finish: r.finish }, copy: { start: c.start, finish: c.finish } }] : []
  })
  const finishReal = scheduleFinish(real.activities)
  const finishCopy = scheduleFinish(copy.schedule.activities)
  const finishDays = daysBetween(finishReal, finishCopy)
  const billing = bars.length > 0 ? planBillingShift(state, project, { activities: copy.schedule.activities }) : []
  const noWhy = tried.filter((m) => m.noWhy).length
  const words = ['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.']
  if (tried.length === 0 && bars.length === 0) {
    words.push('Move a bar to try something.')
  } else {
    words.push(`${tried.length === 1 ? '1 move' : `${tried.length} moves`} tried.`)
    words.push(bars.length === 0 ? 'No bar differs from the real schedule.' : `${bars.length === 1 ? '1 bar differs' : `${bars.length} bars differ`} from the real schedule.`)
    words.push(finishDays === 0 ? `The job still finishes ${weekdayDate(finishCopy)}, as in the real one.` : `The job finishes ${weekdayDate(finishCopy)}, ${days(Math.abs(finishDays))} ${finishDays > 0 ? 'later' : 'sooner'} than the real one.`)
    const bills = shiftWords(billing, 'will')
    if (bills) words.push(`The bills: ${bills}`)
    if (noWhy > 0) words.push(noWhy === 1 ? '1 move has no reason yet.' : `${noWhy} moves have no reason yet.`)
  }
  return { moves: tried.length, noWhy, bars, finishReal, finishCopy, finishDays, billing, words }
}
/** "2 moves kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told." Null: every kept move's companies were told, or none has any. */
export function whatIfKeptWords(state: GcState, project: GcProject): { words: string; companies: string[] } | null {
  const kept = (project.schedule?.moves ?? []).filter((m) => m.fromWhatIf && !m.undoneOn && !m.toldOn)
  const companies = companiesToTell(state, project, kept).map((c) => c.partner.company)
  if (kept.length === 0 || companies.length === 0) return null
  return { words: `${kept.length === 1 ? '1 move' : `${kept.length} moves`} kept from the what-if. ${andList(companies)} ${companies.length === 1 ? 'has' : 'have'} not been told.`, companies }
}
