/**
 * GC mode, the real build, the schedule's PR 11: the what-if copy's own presses and words on the Schedule window
 * (to-dos/gc-mode/mockups/schedule-pr11.md on branch spike/gc-mode). Not a lift: `whatIf.ts` stays the prototype's word
 * for word, and this is the window's. A move tried in the copy (call 3), Undo and Redo on the copy's own record, the
 * line over the chart, and Keep's line in the log. The line is the prototype's `whatIfDiff` without its billing half:
 * the money team's bills come from the schedule's money state (16c), so the window hands the sentence in (call 7).
 */
import type { GcProject } from '../types'
import { weekdayDate } from '../words'
import { redoMove, scheduleFinish, undoMove } from './moves'
import { daysBetween } from './network'
import type { ScheduleActivity, ScheduleMove, ScheduleWhatIf } from './types'
import { whatIfProject, whatIfTried } from './whatIf'

type Span = { start: string; finish: string }

const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`

/**
 * The copy with a move tried on it: the bars as the move left them, and the move on the copy's record, newest first.
 * The real schedule is untouched. Null: no copy open.
 */
export function tryInCopy(project: GcProject, move: ScheduleMove, activities: ScheduleActivity[]): ScheduleWhatIf | null {
  const copy = project.whatIf
  if (!copy) return null
  return { ...copy, schedule: { ...copy.schedule, activities, moves: [move, ...(copy.schedule.moves ?? [])] } }
}

/** The copy with its newest standing move put back (G-40), kept on its record as undone. Null: no copy, or nothing to undo. */
export function copyUndone(project: GcProject, moveId: string, by: string, today: string): ScheduleWhatIf | null {
  const copy = whatIfProject(project)
  const schedule = copy ? undoMove(copy, moveId, by, today) : null
  return project.whatIf && schedule ? { ...project.whatIf, schedule } : null
}

/** The copy with its undone move standing again. Null: no copy, or nothing to redo. */
export function copyRedone(project: GcProject, moveId: string): ScheduleWhatIf | null {
  const copy = whatIfProject(project)
  const schedule = copy ? redoMove(copy, moveId) : null
  return project.whatIf && schedule ? { ...project.whatIf, schedule } : null
}

/** The copy against the real schedule, for the line over the chart and Keep. */
export interface WhatIfLine {
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
  /** The line's sentences, in order. */
  words: string[]
}

/**
 * What the copy does against the real schedule. `bills` is the money team's sentence about the bills, from the money
 * state; it is said only when a bar differs, where the prototype said it. Null: no copy, or nothing drawn.
 */
export function whatIfLineWords(project: GcProject, bills: string | null = null): WhatIfLine | null {
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
  const noWhy = tried.filter((m) => m.noWhy).length
  const words = ['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.']
  if (tried.length === 0 && bars.length === 0) {
    words.push('Move a bar to try something.')
  } else {
    words.push(`${tried.length === 1 ? '1 move' : `${tried.length} moves`} tried.`)
    words.push(bars.length === 0 ? 'No bar differs from the real schedule.' : `${bars.length === 1 ? '1 bar differs' : `${bars.length} bars differ`} from the real schedule.`)
    words.push(finishDays === 0 ? `The job still finishes ${weekdayDate(finishCopy)}, as in the real one.` : `The job finishes ${weekdayDate(finishCopy)}, ${days(Math.abs(finishDays))} ${finishDays > 0 ? 'later' : 'sooner'} than the real one.`)
    if (bills && bars.length > 0) words.push(`The bills: ${bills}`)
    if (noWhy > 0) words.push(noWhy === 1 ? '1 move has no reason yet.' : `${noWhy} moves have no reason yet.`)
  }
  return { moves: tried.length, noWhy, bars, finishReal, finishCopy, finishDays, words }
}

/** Keep's line in the log, the prototype's reducer's: "Robert kept a what-if on Fair Oaks D: 2 moves on the schedule, each with its reason." */
export function whatIfKeepWords(project: Pick<GcProject, 'name'>, kept: readonly unknown[], by: string): string {
  return `${by} kept a what-if on ${project.name}: ${kept.length} ${kept.length === 1 ? 'move' : 'moves'} on the schedule, each with its reason.`
}
