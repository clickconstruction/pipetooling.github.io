/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window's own words (the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). Not a lift: the prototype said
 * these inside its reducer and its forms. A first draft is refused on a lost job and while we bid in
 * the database's own words (`gc_schedule_draft`). It starts on the job's start day, the rough's, or
 * the Monday after next, and its line in the log is the prototype's. The opened bar's card says
 * what the chart's hover card says, with what holds the bar, its parts and its place.
 */
import { addDays } from '../building'
import type { GcProject } from '../types'
import { shortDate, weekdayDate } from '../words'
import { actualWords } from './actualDates'
import { lastFinishDay, type GanttBar } from './gantt'
import { daysBetween } from './network'
import { placeGuess, takesPlace } from './places'
import { mondayOf } from './schedule'
import { partFacts } from './splitBars'
import type { ProjectSchedule } from './types'

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
