/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window's own words (the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). Not a lift: the prototype said
 * these inside its reducer and its forms. A first draft is refused on a lost job and while we bid in
 * the database's own words (`gc_schedule_draft`). It starts on the job's start day, the rough's, or
 * the Monday after next, and its line in the log is the prototype's. The opened bar's card says
 * what the chart's hover card says, with what holds the bar, its parts and its place. A move's,
 * an undo's and a redo's lines in the log (the schedule's PR 8a) are the prototype's too.
 */
import { APP_CALENDAR_TZ } from '../../../utils/dateUtils'
import { addDays } from '../building'
import type { GcProject } from '../types'
import { shortDate, weekdayDate } from '../words'
import { actualWords } from './actualDates'
import { lastFinishDay, type GanttBar } from './gantt'
import { moveActivityName, moveRecord, planMove, spanWords, type MovePlan } from './moves'
import { daysBetween, pushedAfterWords } from './network'
import { placeGuess, takesPlace } from './places'
import { mondayOf } from './schedule'
import { movedParts, partFacts } from './splitBars'
import type { ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './types'

// ---------------------------------------------------------------------------------------------
// The first draft
// ---------------------------------------------------------------------------------------------

/**
 * Why no first draft is drawn on this job, as `gc_schedule_draft` refuses it, or null. A lost job
 * first, as the function checks: the rough schedule is the one to draw while we bid (PR 12's).
 */
export function draftRefusal(project: Pick<GcProject, 'stage' | 'lostOn'>): string | null {
  if (project.lostOn) return 'This job was lost.'
  if (project.stage === 'pursuing') return 'While we bid, the rough schedule is the one to draw.'
  return null
}

/** The day a first draft starts on: the job's start day, the rough's when we bid one (G-45), or the Monday after next. */
export function draftStart(project: Pick<GcProject, 'startDate' | 'rough'>, today: string): string {
  return project.startDate ?? project.rough?.start ?? addDays(mondayOf(today), 7)
}

/** The first draft's line in the schedule's log, as the prototype's reducer wrote it. */
export function draftWords(project: Pick<GcProject, 'name'>, schedule: ProjectSchedule, start: string): string {
  return `Drew a first draft of the schedule on ${project.name}: ${schedule.activities.length} activities from ${weekdayDate(start)}.`
}

// ---------------------------------------------------------------------------------------------
// A move, an undo and a redo: their lines in the log
// ---------------------------------------------------------------------------------------------

/**
 * A move's line in the schedule's log, as the prototype's reducer wrote it: the bar's new days, what
 * it pushed, and who said why. It is the line a second person reads when their own save is refused
 * ("Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Robert: The fixtures ship a week late.").
 */
export function moveWords(project: GcProject, lineId: string, plan: Pick<MovePlan, 'to' | 'pushed'>, why: { by: string; note: string }): string {
  const moved = plan.pushed.map((p) => ({ lineId: p.lineId, label: p.label, start: p.to.start, finish: p.to.finish, days: p.days }))
  return `${moveActivityName(project, lineId)} now runs ${weekdayDate(plan.to.start)} to ${weekdayDate(plan.to.finish)}.${moved.length > 0 ? ` ${pushedAfterWords(moved)}` : ''} ${why.by}: ${why.note.trim()}`
}

/** Undo's line in the log (G-40), as the prototype's reducer wrote it. */
export function undoWords(project: GcProject, move: Pick<ScheduleMove, 'lineId' | 'from'>, by: string): string {
  return `${by} undid a move: ${moveActivityName(project, move.lineId)} is back to ${spanWords(move.from)}.`
}

/** Redo's line in the log (G-40), as the prototype's reducer wrote it. */
export function redoWords(project: GcProject, move: Pick<ScheduleMove, 'lineId' | 'to'>, by: string): string {
  return `${by} put a move back: ${moveActivityName(project, move.lineId)} is ${spanWords(move.to)} again.`
}

/**
 * A part of a split line moved (G-39, the schedule's PR 8b), as the prototype's reducer recorded it
 * (`moveActivityPart`): the line's span becomes its parts' span and moves like any bar, pushes and all.
 * When the span holds, only the part moves, still a move with its reason, and its line in the log names
 * the part. Either way the move keeps the parts' days before and after, for Undo and Redo. Null: nothing
 * moves, or the line's new span cannot be saved.
 */
export function partMovePress(
  project: GcProject,
  lineId: string,
  partId: string,
  start: string,
  finish: string,
  why: { reason: ScheduleMoveReason; note: string; by: string },
  today: string,
): { move: ScheduleMove; activities: ScheduleActivity[]; words: string } | null {
  const schedule = project.schedule
  const activity = schedule?.activities.find((a) => a.lineId === lineId)
  const moved = activity?.parts ? movedParts(activity, partId, start, finish) : null
  if (!schedule || !activity?.parts || !moved) return null
  const offsets = (list: { id: string; from: number; days: number }[]) => list.map((x) => ({ id: x.id, from: x.from, days: x.days }))
  const was = offsets(activity.parts)
  const now = offsets(moved.parts)
  if (JSON.stringify(was) === JSON.stringify(now)) return null
  const plan = planMove(project, lineId, moved.start, moved.finish, activity.after)
  if (!plan || plan.problem) return null
  const move: ScheduleMove = { ...moveRecord(schedule, lineId, plan, why, today), parts: { id: partId, was, now } }
  const activities = plan.activities.map((a) => (a.lineId === lineId ? { ...a, parts: moved.parts } : a))
  const spanMoved = moved.start !== activity.start || moved.finish !== activity.finish
  const words = spanMoved
    ? moveWords(project, lineId, plan, why)
    : `${moveActivityName(project, lineId)}, ${activity.parts.find((x) => x.id === partId)?.name ?? 'a part'} now runs ${weekdayDate(start)} to ${weekdayDate(finish)}. ${why.by}: ${why.note.trim()}`
  return { move, activities, words }
}

/** When a change someone else saved was made, on the company's clock (G-134's refusal): "2:14 pm". Empty for a time it cannot read. */
export function changeTimeWords(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  // ICU puts a narrow no-break space before AM or PM; the refusal reads "2:14 pm".
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
    .format(d)
    .replace(/\s*([AP])M$/i, (_, x: string) => ` ${x.toLowerCase()}m`)
}

// ---------------------------------------------------------------------------------------------
// The opened bar
// ---------------------------------------------------------------------------------------------

/** One line of the opened bar's card: its label, its words, and a colour when the chart gives one. Rows in a run share their label. */
export interface BarCardRow {
  label: string
  words: string
  tone?: 'red' | 'amber' | 'green'
}

/**
 * Another bar as the card names it: an inspection or the job's own work by its name, a trade's
 * line with its trade after it ("Rooftop units in HVAC"). The chart's `ganttNeighbors` puts the
 * trade in parentheses, which the card's plain words leave out.
 */
function barName(b: GanttBar): string {
  const a = b.item.activity
  return a.inspection || a.added ? b.item.label : `${b.item.label} in ${b.item.trade}`
}

/**
 * Everything the opened bar's card says (call 3 of the plan), read only. The days, the work done,
 * the spare days and the real days are the chart's hover card's words. What holds it is the note
 * the chart draws beside it. Then what it waits on and what waits on it, its parts and its place.
 */
export function barCardRows(bar: GanttBar, all: GanttBar[], today: string, building: boolean): BarCardRow[] {
  const a = bar.item.activity
  const rows: BarCardRow[] = []
  const starts = daysBetween(today, a.start)
  rows.push({ label: 'Planned', words: `${weekdayDate(a.start)} to ${weekdayDate(a.finish)}` })
  rows.push({ label: 'Takes', words: `${bar.workDays} ${bar.workDays === 1 ? 'day' : 'days'}${starts > 0 ? `, starts in ${starts}` : ''}` })
  if (bar.holidays.length > 0) rows.push({ label: 'Runs over', words: bar.holidays.join(', ') })
  if (building && !a.inspection) rows.push({ label: 'Done', words: bar.status === 'done' ? '100%' : `${Math.round(bar.item.actual)}%, and the plan has ${Math.round(bar.item.plannedToday)}% by today` })
  if (bar.status !== 'done') {
    rows.push({
      label: 'Spare',
      words: bar.critical ? 'None. A day lost here is a day lost on the finish.' : `${bar.spare} ${bar.spare === 1 ? 'day' : 'days'} before it moves the finish`,
      ...(bar.tight ? { tone: 'red' as const } : {}),
    })
    const last = lastFinishDay(bar)
    if (last) rows.push({ label: 'Can finish by', words: weekdayDate(last), ...(bar.tight ? { tone: 'red' as const } : {}) })
    if (bar.hold) rows.push({ label: 'Held', words: `waits on ${bar.hold.words}${bar.hold.late ? ', late' : ''}`, tone: bar.hold.late ? 'red' : 'amber' })
  }
  if (bar.moved) rows.push({ label: 'At Start', words: `${shortDate(bar.item.baseline.start)} to ${shortDate(bar.item.baseline.finish)}` })
  const really = actualWords(a)
  if (really) rows.push({ label: 'Really', words: really, tone: 'green' })
  const byId = new Map(all.map((b) => [b.id, b]))
  const waitsOn = a.after.flatMap((id) => (byId.get(id) ? [barName(byId.get(id) as GanttBar)] : []))
  const holdsUp = all.filter((b) => b.item.activity.after.includes(bar.id)).map(barName)
  // One row a bar: an inspection can wait on ten, more than a sentence holds.
  for (const name of waitsOn) rows.push({ label: 'Waits on', words: name })
  for (const name of holdsUp) rows.push({ label: 'Holds up', words: name })
  for (const fact of partFacts(a, today)) rows.push({ label: 'Part', words: fact })
  if (takesPlace(a)) {
    const guess = a.place ? null : placeGuess(bar.item.trade, bar.item.label)
    rows.push({ label: 'Place', words: a.place ? a.place : guess ? `${guess.place}, a guess from its ${guess.from}. Nobody has set it yet.` : 'Not set yet.' })
  }
  return rows
}
