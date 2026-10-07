/**
 * GC mode, the real build, the schedule's PR 1b: the weekly walk of the schedule, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcScheduleWalk.ts`).
 */
import { addDays } from '../building'
import { onSiteWords } from '../buildingLog'
import type { LostDay } from './daysLost'
import { lostDaysUnanswered, lostDaysWords } from './daysLost'
import type { GanttBar, GanttHold } from './gantt'
import { ganttBars } from './gantt'
import { lateWalkFact } from './lateNotices'
import type { MoveRow } from './moves'
import { moveRows } from './moves'
import { daysBetween, mondayOf, scheduleMeasures } from './schedule'
import type { ScheduleWalk } from './types'
import type { GcProject, GcState } from '../types'
import { shortDate, weekdayDate } from '../words'

/** A schedule not walked in this many days is stale. */
export const WALK_STALE_DAYS = 7

/** Work starting within this many days is on the walk: is it still starting then? */
export const WALK_STARTING_DAYS = 7

export type WalkKind = 'failed' | 'late' | 'due' | 'behind' | 'held' | 'underway' | 'starting'

/** One bar on the walk: why it is here, what we know, and the day its pace points to. */
export interface WalkItem {
  lineId: string
  /** "Roofing · TPO membrane" */
  name: string
  company: string
  kind: WalkKind
  /** The chip: "should be done", "50%, plan 100%", "starts in 3 days". */
  chip: string
  tone: 'red' | 'amber' | 'green' | 'grey'
  start: string
  finish: string
  /** What we know, a sentence each: what was reported, what the log shows, what holds it, its spare days. */
  facts: string[]
  /** The finish its pace so far points to, when that is later than drawn. Null: no pace to read, or on time. */
  paceFinish: string | null
  /** Not started: the walk asks about its start, and a move shifts the whole bar. Started: about its finish. */
  started: boolean
  /** Days the daily log says it lost to the weather that no move has answered (G-58): the walk offers to add them. */
  lostDays: LostDay[]
}

const ORDER: Record<WalkKind, number> = { failed: 0, late: 1, due: 2, behind: 3, held: 4, underway: 5, starting: 6 }

/** The finish a started bar's pace points to: the days it has taken for the percent it has, carried to 100. */
export function paceFinish(start: string, actual: number, today: string): string | null {
  if (actual <= 0 || actual >= 100 || start > today) return null
  const elapsed = daysBetween(start, today) + 1
  return addDays(start, Math.ceil((elapsed * 100) / actual) - 1)
}

function itemOf(project: GcProject, b: GanttBar, today: string): WalkItem | null {
  const a = b.item.activity
  if (b.status === 'done') return null
  const started = a.start <= today
  const startsIn = daysBetween(today, a.start)
  if (!started && startsIn > WALK_STARTING_DAYS && b.status !== 'failed') return null
  const kind: WalkKind =
    b.status === 'failed' ? 'failed' : b.status === 'late' ? 'late' : started && a.finish === today && !a.inspection ? 'due' : b.status === 'behind' ? 'behind' : b.hold ? 'held' : started ? 'underway' : 'starting'
  const pct = `${Math.round(b.item.actual)}%`
  const plan = `${Math.round(b.item.plannedToday)}%`
  // An added activity (G-38) has no percent: it is under way, or done.
  const noReport = Boolean(a.inspection || a.added)
  const chips: Record<WalkKind, string> = {
    failed: 'failed its inspection',
    late: `${b.daysLate} ${b.daysLate === 1 ? 'day' : 'days'} late`,
    due: `due today, ${pct} done`,
    behind: `${pct}, plan ${plan}`,
    held: 'held',
    underway: a.inspection ? 'this week' : a.added ? 'under way' : `${pct}, plan ${plan}`,
    starting: startsIn === 0 ? 'starts today' : `starts in ${startsIn} ${startsIn === 1 ? 'day' : 'days'}`,
  }
  const tones: Record<WalkKind, WalkItem['tone']> = { failed: 'red', late: 'red', due: 'amber', behind: 'amber', held: 'amber', underway: b.status === 'ahead' ? 'green' : 'grey', starting: 'grey' }
  const pace = noReport ? null : paceFinish(a.start, b.item.actual, today)
  const paceLater = pace && pace > a.finish ? pace : null
  const facts: string[] = []
  const fails = a.inspection && !a.inspection.passedOn ? (a.inspection.failed ?? []) : []
  const lastFail = fails[fails.length - 1]
  if (lastFail) facts.push(`It failed ${shortDate(lastFail.on)}: ${lastFail.note} It is seen again ${weekdayDate(lastFail.reinspectOn)}.`)
  if (!noReport && started) facts.push(`${b.item.company} reported ${pct}. The plan has ${plan} by today.`)
  if (a.added && started) facts.push(`${a.added.who}: nobody reports it. Mark it done on the chart when it is.`)
  if (b.item.pkg && started) {
    const log = onSiteWords(project, b.item.pkg.id, mondayOf(today))
    if (log) facts.push(log)
  }
  if (b.hold) facts.push(`It waits on ${b.hold.words}${b.hold.late ? ', which is late' : ''}.`)
  if (paceLater) {
    const over = daysBetween(a.finish, paceLater)
    facts.push(`At this pace it finishes ${weekdayDate(paceLater)}, ${over} ${over === 1 ? 'day' : 'days'} after the day drawn.`)
  }
  // The trade's own word that it will be late, not answered yet (G-117): the walk should not keep as drawn what its trade says will move.
  const lateWord = noReport ? null : lateWalkFact(project, a.lineId, b.item.company, today)
  if (lateWord) facts.push(lateWord)
  if (b.status === 'ahead') facts.push('It is ahead of the plan.')
  const lostDays = a.inspection ? [] : lostDaysUnanswered(project, a.lineId)
  const lost = lostDaysWords(lostDays)
  if (lost) facts.push(lost)
  facts.push(b.critical ? 'It has no spare days: a day lost here is a day lost on the finish.' : `It has ${b.spare} spare ${b.spare === 1 ? 'day' : 'days'} before it moves the finish.`)
  return {
    lineId: a.lineId,
    name: a.inspection || a.added ? b.item.label : `${b.item.trade} · ${b.item.label}`,
    company: b.item.company,
    kind,
    chip: chips[kind],
    tone: tones[kind],
    start: a.start,
    finish: a.finish,
    facts,
    paceFinish: paceLater,
    started,
    lostDays,
  }
}

/**
 * Every bar the walk goes through, the worst news first: failed inspections, late work, work due
 * today, work behind, held work, the rest under way, then what starts within a week. Finished work
 * and work further out are not on it.
 */
export function walkItems(state: GcState, project: GcProject, holds: Map<string, GanttHold>): WalkItem[] {
  if (!project.schedule) return []
  const m = scheduleMeasures(state, project)
  return ganttBars(m.items, m.float, holds, state.today, project.stage === 'building')
    .flatMap((b) => {
      const item = itemOf(project, b, state.today)
      return item ? [item] : []
    })
    .map((item, at) => ({ item, at }))
    .sort((a, b) => ORDER[a.item.kind] - ORDER[b.item.kind] || a.at - b.at)
    .map((x) => x.item)
}

/** Whether the schedule has been walked lately, for the line over the chart. */
export interface WalkStanding {
  last: ScheduleWalk | null
  /** Days since the last walk. Null: never walked. */
  days: number | null
  stale: boolean
  /** The last walk left bars not looked at: walked, but not all of it. */
  partial: boolean
  /** "Walked today by Robert." · "Not walked since Fri Sep 25, 7 days ago." · "Not walked yet." */
  words: string
}

export function walkStanding(project: GcProject, today: string): WalkStanding {
  const last = project.schedule?.walks?.[0] ?? null
  if (!last) return { last: null, days: null, stale: true, partial: false, words: 'Not walked yet. Nobody has checked these dates against the job.' }
  const days = daysBetween(last.on, today)
  const stale = days >= WALK_STALE_DAYS
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${weekdayDate(last.on)}, ${days} days ago`
  return { last, days, stale, partial: last.skipped > 0, words: stale ? `Not walked since ${when}.` : `Walked ${when} by ${last.by}.` }
}

/** What one walk changed, ready to say to the trades and the customer: each move in a sentence, with why. */
export function walkChanges(project: GcProject, moveIds: string[]): MoveRow[] {
  const ids = new Set(moveIds)
  return moveRows(project).filter((r) => ids.has(r.move.id) && !r.move.undoneOn)
}

/** "3 kept as drawn, 2 moved, 1 not looked at." */
export function walkTally(kept: number, moved: number, skipped: number): string {
  return [`${kept} kept as drawn`, `${moved} moved`, ...(skipped > 0 ? [`${skipped} not looked at`] : [])].join(', ') + '.'
}
