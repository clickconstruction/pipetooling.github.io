/**
 * GC mode design spike: the customer's view of the schedule, the Gantt's Phase 3
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-90 to G-92). The same dates as the office's chart, rolled up
 * to the stages of the job: no company names, no dollars, no spare days. What changed since last
 * week in plain words, and what we need from them.
 *
 * Its own file, out of the barrel: it reads the Gantt's groups and the moves.
 */
import type { GcProject, GcState, ScheduleMoveReason } from './gcTypes'
import { daysBetween, milestoneRows, projectedFinish, scheduleMeasures, substantialCompletionOn, type MilestoneRow } from './gcBuildingSchedule'
import { shortDate, weekdayDate } from './gcWords'
import { ganttBars, ganttGroups } from './gcGantt'
import { lineStage } from './gcNewProject'
import { SCHEDULE_STAGES } from './gcNewProject'
import { changeOrderDays, projectChangeOrders } from './gcOwnerBilling'

/** One stage of the job as the customer sees it. */
export interface CustomerStage {
  key: string
  label: string
  start: string
  finish: string
  /** Percent done, weighted by what each line is worth. */
  pct: number
  /** "done", "under way", "behind", "not started", or "this week" for an inspection. */
  state: 'done' | 'underway' | 'behind' | 'notStarted'
}

/** The stages of the job, in the order built, each as one bar. Inspections ride inside their stages' dates; they are not a stage. */
export function customerStages(state: GcState, project: GcProject): CustomerStage[] {
  const m = scheduleMeasures(state, project)
  const bars = ganttBars(m.items, m.float, new Map(), state.today, project.stage === 'building').filter((b) => !b.item.activity.inspection)
  return ganttGroups(bars, 'stage')
    .filter((g) => g.bars.length > 0)
    .map((g) => ({
      key: g.key,
      label: g.title,
      start: g.start,
      finish: g.finish,
      pct: g.pct,
      state: g.pct >= 100 ? 'done' : g.late > 0 ? 'behind' : g.bars.some((b) => b.item.activity.start <= state.today) ? 'underway' : 'notStarted',
    }))
}

/** Where the job stands for the customer: the finish against their contract, work done, the next date they will care about. */
export interface CustomerStanding {
  /** The day we expect to finish. Null: no schedule. */
  finish: string | null
  /** Their contract's day, with signed change orders. */
  contract: string | null
  /** Days the expected finish runs past the contract. Zero: on time or early. */
  late: number
  donePct: number
  plannedPct: number
  /** "We finish Fri Dec 11. Your contract says Dec 11." */
  finishWords: string
  /** The next milestone not met. */
  next: MilestoneRow | null
}

export function customerStanding(state: GcState, project: GcProject): CustomerStanding {
  const m = scheduleMeasures(state, project)
  const finish = projectedFinish(project, state.today)
  const contract = substantialCompletionOn(project)
  const late = finish && contract ? Math.max(0, daysBetween(contract.on, finish.on)) : 0
  const next = m.milestones.filter((r) => !r.milestone.metOn).sort((a, b) => (a.due < b.due ? -1 : 1))[0] ?? null
  const finishWords = !finish
    ? 'The schedule is being drawn.'
    : !contract
      ? `We expect to finish ${weekdayDate(finish.on)}.`
      : late === 0
        ? `We finish ${weekdayDate(finish.on)}. Your contract says ${shortDate(contract.on)}.`
        : `We expect to finish ${weekdayDate(finish.on)}, ${late} ${late === 1 ? 'day' : 'days'} past the ${shortDate(contract.on)} in your contract.`
  return { finish: finish?.on ?? null, contract: contract?.on ?? null, late, donePct: Math.round(m.work.donePct), plannedPct: Math.round(m.work.plannedPct), finishWords, next }
}

/** Why a bar moved, in words for the customer: no company names, no blame by name. */
const CUSTOMER_WHY: Record<ScheduleMoveReason, string> = {
  weather: 'the weather',
  'trade before': 'the work before it ran long',
  materials: 'materials',
  crew: 'crews',
  customer: 'a decision we were waiting on from you',
  plans: 'a change to the plans',
  inspection: 'an inspection',
  us: 'our own scheduling',
  other: '',
}

/** Days since the move counted as "this week" in What changed. */
export const CUSTOMER_CHANGE_DAYS = 7

/**
 * What changed since last week, a sentence per move still standing, with the stage not the
 * company: "The roof is 7 days later than planned, because of the weather. The finish holds at
 * Dec 11." Empty: nothing moved.
 */
export function customerChanges(project: GcProject, today: string): string[] {
  const moves = (project.schedule?.moves ?? []).filter((m) => !m.undoneOn && daysBetween(m.on, today) <= CUSTOMER_CHANGE_DAYS)
  return moves.map((m) => {
    const a = project.schedule?.activities.find((x) => x.lineId === m.lineId)
    const pkg = a ? project.packages.find((k) => k.id === a.packageId) : undefined
    const stageKey = a?.inspection ? 'inspection' : lineStage(pkg?.trade ?? '', a ? lineLabel(project, a.lineId) : '')
    const stage = a?.inspection ? a.inspection.label : (SCHEDULE_STAGES.find((s) => s.key === stageKey)?.label ?? 'The work')
    const days = daysBetween(m.from.finish, m.to.finish)
    const moved = days === 0 ? `${stage} was replanned` : `${stage} is ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days > 0 ? 'later' : 'sooner'} than planned`
    const why = CUSTOMER_WHY[m.reason]
    const finishDays = daysBetween(m.finishFrom, m.finishTo)
    // The finish in days, not a date: the date they see above reads the pace of the work too, and two dates would argue.
    const finish = finishDays === 0 ? 'The finish holds.' : `The finish moves ${Math.abs(finishDays)} ${Math.abs(finishDays) === 1 ? 'day' : 'days'} ${finishDays > 0 ? 'later' : 'sooner'}.`
    return `${moved}${why ? `, because of ${why}` : ''}. ${finish}`
  })
}

function lineLabel(project: GcProject, lineId: string): string {
  for (const pkg of project.packages) {
    const line = [...(pkg.sow?.sov ?? []), ...pkg.scope].find((l) => l.id === lineId)
    if (line) return line.label
  }
  return ''
}

/** What we need from the customer, with the day it starts costing time: change orders waiting on their signature. */
export function customerAsks(project: GcProject): { words: string; by: string | null }[] {
  return projectChangeOrders(project)
    .filter((co) => co.status === 'sent')
    .map((co) => ({
      words: `Your signature on change order ${co.number}, ${co.description}${changeOrderDays(co) > 0 ? ` (${changeOrderDays(co)} days of schedule)` : ''}, sent ${shortDate(co.sentOn ?? '')}.`,
      by: null,
    }))
}

/** The milestones the customer sees: every date the job must meet. */
export function customerMilestones(state: GcState, project: GcProject): MilestoneRow[] {
  return milestoneRows(state, project).sort((a, b) => (a.due < b.due ? -1 : 1))
}
