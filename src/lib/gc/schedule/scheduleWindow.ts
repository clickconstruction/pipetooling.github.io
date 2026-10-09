/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window's own words (the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). Not a lift: the prototype said
 * these inside its reducer and its forms. A first draft is refused on a lost job and while we bid in
 * the database's own words (`gc_schedule_draft`). It starts on the job's start day, the rough's, or
 * the Monday after next, and its line in the log is the prototype's. The opened bar's card says
 * what the chart's hover card says, with what holds the bar, its parts and its place. A move's,
 * an undo's and a redo's lines in the log (the schedule's PR 8a) are the prototype's too, and so are
 * the job's own work's and a failed inspection's (PR 9a), and a split's, a join's and a new
 * baseline's (PR 9b), with a new wait as the reducer makes it.
 */
import { APP_CALENDAR_TZ } from '../../../utils/dateUtils'
import { addDays } from '../building'
import type { GcProject } from '../types'
import { shortDate, weekdayDate } from '../words'
import { actualWords } from './actualDates'
import { lastFinishDay, type GanttBar } from './gantt'
import { moveActivityName, moveRecord, planMove, spanWords, type MovePlan } from './moves'
import { addedActivityProblem, nextOwnId } from './addedActivity'
import { withNewBaseline } from './baseline'
import { daysBetween, pushAfter, pushedAfterWords } from './network'
import { placeGuess, takesPlace } from './places'
import { mondayOf } from './schedule'
import { movedParts, partFacts, splitParts } from './splitBars'
import type { ActivityPart, InspectionFailure, ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason, ScheduleWait, WaitKind } from './types'
import { nextWaitId, waitKind } from './waits'

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

// ---------------------------------------------------------------------------------------------
// The job's own work and an inspection (PR 9a)
// ---------------------------------------------------------------------------------------------

/**
 * The job's own work put on the chart (G-38), as the prototype's reducer does it (`addScheduleActivity`): a bar that is
 * no trade's line, what it waits on, the bars that wait on it from now on, and what that pushes. The bars come back as
 * the push leaves them, for `addScheduleActivity`'s io, with the reducer's line in the log. Null: its problem
 * (`addedActivityProblem`) or no schedule.
 */
export function ownWorkPress(
  project: GcProject,
  input: { label: string; who: string; start: string; finish: string; after: string[]; holdsUp: string[] },
  by: string,
): { activities: ScheduleActivity[]; words: string } | null {
  const schedule = project.schedule
  const label = input.label.trim()
  const who = input.who.trim()
  if (!schedule || addedActivityProblem(label, who, input.start, input.finish)) return null
  const ids = new Set(schedule.activities.map((a) => a.lineId))
  const lineId = nextOwnId(project)
  const after = [...new Set(input.after)].filter((id) => ids.has(id))
  const holdsUp = new Set([...new Set(input.holdsUp)].filter((id) => ids.has(id) && !after.includes(id)))
  const activity: ScheduleActivity = { lineId, packageId: '', start: input.start, finish: input.finish, after, added: { label, who, doneOn: null } }
  // The lines that wait on it from now on, then what that pushes (the owner, 2026-10-04: what comes after moves out).
  const pushed = pushAfter(project, [...schedule.activities.map((a) => (holdsUp.has(a.lineId) ? { ...a, after: [...a.after, lineId] } : a)), activity], lineId)
  return {
    activities: pushed.activities,
    words: `${by} put ${label} on ${project.name}'s schedule, ${weekdayDate(input.start)} to ${weekdayDate(input.finish)}, ${who}.${holdsUp.size > 0 ? ` ${holdsUp.size} ${holdsUp.size === 1 ? 'activity waits' : 'activities wait'} on it.` : ''}${pushed.moved.length > 0 ? ` ${pushedAfterWords(pushed.moved)}` : ''}`,
  }
}

/** The job's own work taken off the chart, the reducer's line in the log: "Slab cure came off Fair Oaks D's schedule." */
export function ownWorkOffWords(project: GcProject, lineId: string): string {
  const activity = project.schedule?.activities.find((a) => a.lineId === lineId)
  return `${activity?.added?.label ?? moveActivityName(project, lineId)} came off ${project.name}'s schedule.`
}

/**
 * An inspection that did not pass (`failInspection`), on a job being built: the failure, the inspection at its
 * re-inspection day with its days kept, and what waits on it moved out, with the reducer's line in the log. Null: what
 * the reducer refuses (no note, a re-inspection not after today, passed already, not an inspection, not being built).
 *
 * The push is main's own (`pushAfter`): what waits on the inspection moves out, down the line, each gap kept and work
 * already done left alone, as a move pushes. The prototype's reducer pushes with New project's `pushSchedule`, over the
 * whole plan, a wait's gap left out and done work moved: on a real job it would undo days got back and move finished
 * bars. The known difference, the lead's pick (to-dos/gc-mode/mockups/schedule-pr9.md).
 */
export function failInspectionPress(
  project: GcProject,
  lineId: string,
  input: { note: string; packageIds: string[]; reinspectOn: string },
  today: string,
): { failure: InspectionFailure; activities: ScheduleActivity[]; words: string } | null {
  const schedule = project.schedule
  const activity = schedule?.activities.find((a) => a.lineId === lineId)
  const inspection = activity?.inspection
  const note = input.note.trim().replace(/\s+/g, ' ')
  if (project.stage !== 'building' || !schedule || !activity || !inspection || inspection.passedOn) return null
  if (!note || !input.reinspectOn || input.reinspectOn <= today) return null
  const known = new Set(project.packages.map((k) => k.id))
  const packageIds = [...new Set(input.packageIds)].filter((id) => known.has(id))
  const length = daysBetween(activity.start, activity.finish)
  const failure = { on: today, note, packageIds, reinspectOn: input.reinspectOn }
  const again: ScheduleActivity = { ...activity, start: input.reinspectOn, finish: addDays(input.reinspectOn, length), inspection: { ...inspection, failed: [...(inspection.failed ?? []), failure] } }
  const pushed = pushAfter(project, schedule.activities.map((a) => (a.lineId === lineId ? again : a)), lineId)
  const movedOut = pushed.moved.length
  const trades = project.packages.filter((k) => packageIds.includes(k.id)).map((k) => k.trade)
  const whose = trades.length === 0 ? '' : ` It was ${trades.length === 1 ? trades[0] : `${trades.slice(0, -1).join(', ')} and ${trades[trades.length - 1]}`}'s work.`
  return {
    failure,
    activities: pushed.activities,
    words: `The ${inspection.label.toLowerCase()} failed on ${project.name}: ${note.replace(/[.\s]+$/, '')}.${whose} Re-inspection ${weekdayDate(input.reinspectOn)}.${movedOut > 0 ? ` ${movedOut} ${movedOut === 1 ? 'activity after it moves' : 'activities after it move'} out.` : ''}`,
  }
}

// ---------------------------------------------------------------------------------------------
// Waits, parts and the baseline (PR 9b)
// ---------------------------------------------------------------------------------------------

/**
 * Something the work waits on from outside the trades (G-73 to G-75), as the prototype's reducer makes it
 * (`addScheduleWait`): its kind, its name, whose work it is for, who we wait on (the kind's own when left blank), the
 * day it is expected and the day it was asked for, and the lines it holds, known ones only. A delivery starts not
 * shipped. Null: no name, or no day it is expected.
 */
export function newWait(
  project: GcProject,
  input: { kind: WaitKind; title: string; packageId: string | null; who: string; lineIds: string[]; expectedOn: string; askedOn: string | null; note?: string },
): ScheduleWait | null {
  const title = input.title.trim()
  if (!title || !input.expectedOn) return null
  const ids = new Set((project.schedule?.activities ?? []).map((a) => a.lineId))
  const lineIds = [...new Set(input.lineIds)].filter((id) => ids.has(id))
  return {
    id: nextWaitId(project),
    kind: input.kind,
    title,
    packageId: input.packageId,
    who: input.who.trim() || waitKind(input.kind).who,
    lineIds,
    askedOn: input.askedOn ?? null,
    expectedOn: input.expectedOn,
    ...(input.kind === 'delivery' ? { shippedOn: null } : {}),
    doneOn: null,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
}

/**
 * A trade's line split into parts (G-39), as the prototype's reducer does it (`splitActivity`): each part with its name
 * and dates, starting from the line's percent so the line keeps it (`splitParts`), with the reducer's line in the log.
 * Its problem in words when it cannot be split.
 */
export function splitPress(
  project: GcProject,
  lineId: string,
  drafts: { name: string; start: string; finish: string }[],
  pct: number,
  by: string,
): { parts: ActivityPart[]; words: string } | { problem: string } {
  const activity = project.schedule?.activities.find((a) => a.lineId === lineId)
  if (!activity || activity.inspection || activity.added || activity.parts) return { problem: 'Only a trade’s line that is one bar splits into parts.' }
  const made = splitParts(activity, drafts.map((d) => ({ name: d.name.trim(), start: d.start, finish: d.finish })), Math.round(pct))
  if ('problem' in made) return made
  return { parts: made.parts, words: `${by} split ${moveActivityName(project, lineId)} on ${project.name} into ${made.parts.length} parts: ${made.parts.map((x) => x.name).join(', ')}.` }
}

/** A split line made one bar again, the reducer's line in the log (`joinActivity`). */
export function joinWords(project: GcProject, lineId: string, by: string): string {
  return `${by} made ${moveActivityName(project, lineId)} on ${project.name} one bar again.`
}

/**
 * A new baseline after a signed change order (G-41, the reducer's `setScheduleBaseline`): its line in the log, or null
 * when none is taken (no name, or no plan at Start kept yet: `withNewBaseline`). Why ends with its own full stop, which
 * the prototype's line left out.
 */
export function baselinePress(project: GcProject, name: string, why: string, by: string, today: string): string | null {
  const schedule = project.schedule
  if (!schedule || !withNewBaseline(schedule, name, why, by, today)) return null
  const said = why.trim().replace(/[.\s]+$/, '')
  return `${by} set a new baseline on ${project.name}, ${name.trim()}${said ? `: ${said}.` : '.'} The plan at Start is kept.`
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
