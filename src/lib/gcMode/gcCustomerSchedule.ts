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
import { ganttBars, ganttGroups, ganttListGroups, type GanttBar } from './gcGantt'
import { lineStage } from './gcNewProject'
import { SCHEDULE_STAGES } from './gcNewProject'
import { changeOrderDays, projectChangeOrders } from './gcOwnerBilling'
import { customerDecisions } from './gcScheduleWaits'
import { customerContractDays } from './gcChangeOrderDays'

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

/** A customer who is a GC or an owner's rep reads building schedules for a living: they may see every bar (call 3, the owner's OK 2026-10-06). */
export function customerMaySeeEveryBar(project: GcProject): boolean {
  return project.customerRole === 'gc' || project.customerRole === 'ownersRep'
}

/** Every bar as the List view draws it, by stage, today first: the names of the work, no company, no dollars, no spare days. */
export function customerFullChart(state: GcState, project: GcProject) {
  const m = scheduleMeasures(state, project)
  return ganttListGroups(ganttBars(m.items, m.float, new Map(), state.today, project.stage === 'building'), state.today)
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
export const CUSTOMER_WHY: Record<ScheduleMoveReason, string> = {
  weather: 'the weather',
  'trade before': 'the work before it ran long',
  materials: 'materials',
  crew: 'crews',
  customer: 'a decision we were waiting on from you',
  plans: 'a change to the plans',
  inspection: 'an inspection',
  us: 'our own scheduling',
  'change order': 'the change order you signed',
  other: '',
  // A pull (G-37): good news that explains itself, with no company named.
  early: '',
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
    const stage = a?.inspection ? a.inspection.label : a?.added ? a.added.label : (SCHEDULE_STAGES.find((s) => s.key === stageKey)?.label ?? 'The work')
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

/** What we need from the customer, with the day it starts costing time: change orders waiting on their signature, and the decisions they owe (G-74, G-92). */
export function customerAsks(project: GcProject): { words: string; by: string | null }[] {
  const orders = projectChangeOrders(project)
    .filter((co) => co.status === 'sent')
    .map((co) => ({
      words: `Your signature on change order ${co.number}, ${co.description}${changeOrderDays(co) > 0 ? ` (${changeOrderDays(co)} days of schedule)` : ''}, sent ${shortDate(co.sentOn ?? '')}.`,
      by: null,
    }))
  return [...orders, ...customerDecisions(project)]
}

/** The milestones the customer sees: every date the job must meet. */
export function customerMilestones(state: GcState, project: GcProject): MilestoneRow[] {
  return milestoneRows(state, project).sort((a, b) => (a.due < b.due ? -1 : 1))
}

// ---------------------------------------------------------------------------------------------
// The customer's words, in one place (G-21): the portal, the letter and the printed copy read
// these, so the three can never say a stage, a bar or the work done two ways.
// ---------------------------------------------------------------------------------------------

/** Where a stage stands, in the customer's words. */
export const CUSTOMER_STAGE_WORDS: Record<CustomerStage['state'], string> = { done: 'done', underway: 'under way', behind: 'behind', notStarted: 'not started' }

/** What What changed this week says when nothing moved. */
export const CUSTOMER_NOTHING_MOVED = 'Nothing moved. The schedule stands as planned.'

/** "72% of the work is done. We planned 76% by today." Null while the schedule is being drawn. */
export function customerDoneWords(standing: CustomerStanding): string | null {
  return standing.finish ? `${standing.donePct}% of the work is done. We planned ${standing.plannedPct}% by today.` : null
}

/** One bar as a customer reads it: no spare days, so a bar on track says "on plan" and one not begun "not started", in grey. */
export function customerBarWords(bar: GanttBar): { words: string; tone: GanttBar['tone'] } {
  if (bar.status === 'onTrack') return { words: 'on plan', tone: 'grey' }
  if (bar.status === 'notStarted') return { words: 'not started', tone: 'grey' }
  return { words: bar.statusWords, tone: bar.tone }
}

/** Everything the customer's schedule shows, read once: their portal's picture, which the printed copy draws (G-21). */
export interface CustomerSchedulePicture {
  /** Who the customer is, as the letter names them. */
  name: string
  /** A GC or an owner's rep: they may see every bar (call 3). */
  everyBar: boolean
  standing: CustomerStanding
  doneWords: string | null
  /** What their signed change orders did to the contract's finish (G-76), as their portal says it. */
  contractDays: string[]
  stages: CustomerStage[]
  /** Every bar by stage, today first, when they may see every bar (call 5). Empty otherwise. */
  fullChart: ReturnType<typeof customerFullChart>
  milestones: MilestoneRow[]
  changes: string[]
  asks: string[]
}

export function customerSchedulePicture(state: GcState, project: GcProject): CustomerSchedulePicture {
  const standing = customerStanding(state, project)
  const everyBar = customerMaySeeEveryBar(project)
  return {
    name: state.customers.find((c) => c.id === project.customerId)?.name ?? project.owner,
    everyBar,
    standing,
    doneWords: customerDoneWords(standing),
    contractDays: customerContractDays(project),
    stages: customerStages(state, project),
    fullChart: everyBar ? customerFullChart(state, project) : [],
    milestones: customerMilestones(state, project),
    changes: customerChanges(project, state.today),
    asks: customerAsks(project).map((a) => a.words),
  }
}
