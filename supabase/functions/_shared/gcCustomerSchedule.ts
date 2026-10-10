/**
 * GC mode, the schedule's PR 15b: the customer's picture in their portal (G-90 to G-93; the plan is
 * to-dos/gc-mode/mockups/schedule-pr15b.md on branch spike/gc-mode). `customer-portal` loads this file with a dynamic
 * import only for a customer with a GC job being built (call 6), reads each job's rows with the service role
 * (`gcScheduleRead.ts`, the `customer` option), and works out the picture with the generated copy of the kernels, so
 * the office's print and the customer's portal read the same schedule. Only `customerPortalSchedule`'s answer leaves:
 * words and dates, never a bar as the office draws it, since a bar carries its company, what its line is worth and its
 * spare days (call 2). A job's change orders are read without their money (`withOfficeChangeOrders`).
 */
import {
  boardStateFromRows,
  customerBarWords,
  customerSchedulePicture,
  gcProjectFromRows,
  lateFinish,
  withDraws,
  withOfficeChangeOrders,
  withScheduleRows,
  type BoardRows,
  type ChangeOrderOfficeRow,
  type CustomerSchedulePicture,
  type DrawTables,
} from './gcKernels/index.ts'
import type { MilestoneRow, MilestoneState } from './gcKernels/lib/gc/schedule/schedule.ts'
import { companyRowOf, inviteRowOf, scheduleRowsOf } from './gcTradePortalSchedule.ts'
import { readScheduleRows, type ScheduleReadRows } from './gcScheduleRead.ts'

/** A date to meet as the customer reads it: its name, its day, and how it stands. */
export type PortalGcScheduleDate = { label: string; due: string; state: MilestoneState; daysLate: number }

/** One stage of the job as one bar. */
export type PortalGcScheduleStage = { label: string; start: string; finish: string; pct: number; state: 'done' | 'underway' | 'behind' | 'notStarted' }

/** One bar of the work, for a GC or an owner's rep: its name, its dates and how it stands in their words. */
export type PortalGcScheduleBar = { label: string; start: string; finish: string; words: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'grey' }

/** One stage's bars, today's stage first, as the office's List view groups them. */
export type PortalGcScheduleGroup = { title: string; start: string; finish: string; now: boolean; open: boolean; bars: PortalGcScheduleBar[] }

/** Everything the customer's portal draws of a job's schedule (call 2): words and dates only. */
export type PortalGcSchedule = {
  today: string
  /** The day we expect to finish, and their contract's day with its signed change orders. Null: not drawn, or none. */
  finish: string | null
  contract: string | null
  /** Days the finish runs past the contract. */
  late: number
  /** "We finish Fri Dec 11. Your contract says Dec 11." */
  finishWords: string
  donePct: number
  plannedPct: number
  /** "72% of the work is done. We planned 76% by today." Null while the schedule is being drawn. */
  doneWords: string | null
  /** The next date to meet not met yet. */
  next: PortalGcScheduleDate | null
  /** What their signed change orders did to the contract's finish, and why a late finish is late, in their words. */
  contractDays: string[]
  lateWords: string[]
  stages: PortalGcScheduleStage[]
  dates: PortalGcScheduleDate[]
  /** A GC or an owner's rep may see every bar. Empty `groups` otherwise. */
  everyBar: boolean
  groups: PortalGcScheduleGroup[]
  /** What changed this week, and what we need from them, as sentences. */
  changes: string[]
  asks: string[]
}

function dateOf(m: MilestoneRow): PortalGcScheduleDate {
  return { label: m.milestone.label, due: m.due, state: m.state, daysLate: m.daysLate }
}

/**
 * The picture as the customer's portal reads it (call 2): each field copied by name, never an object passed through,
 * so a company, a dollar or a spare day can only reach the answer by a line written here.
 */
export function customerPortalSchedule(picture: CustomerSchedulePicture, lateWords: readonly string[], today: string): PortalGcSchedule {
  const s = picture.standing
  return {
    today,
    finish: s.finish,
    contract: s.contract,
    late: s.late,
    finishWords: s.finishWords,
    donePct: s.donePct,
    plannedPct: s.plannedPct,
    doneWords: picture.doneWords,
    next: s.next ? dateOf(s.next) : null,
    contractDays: [...picture.contractDays],
    lateWords: [...lateWords],
    stages: picture.stages.map((g) => ({ label: g.label, start: g.start, finish: g.finish, pct: Math.round(g.pct), state: g.state })),
    dates: picture.milestones.map(dateOf),
    everyBar: picture.everyBar,
    groups: picture.everyBar
      ? picture.fullChart.map(({ group, now, open }) => ({
          title: group.title,
          start: group.start,
          finish: group.finish,
          now,
          open,
          bars: group.bars.map((b) => {
            const said = customerBarWords(b)
            return { label: b.item.label, start: b.item.activity.start, finish: b.item.activity.finish, words: said.words, tone: said.tone }
          }),
        }))
      : [],
    changes: [...picture.changes],
    asks: [...picture.asks],
  }
}

/**
 * The jobs a customer sees a schedule on (call 3): their own GC jobs being built with a schedule drawn. A job in
 * buyout, closed or lost, and a job with nothing drawn, has none.
 */
export function customerPortalJobs(
  projects: readonly { id: string; customer_id: string | null }[],
  stages: readonly { project_id: string; stage?: string | null }[],
  drawn: readonly { project_id: string }[],
  customerId: string,
): string[] {
  const building = new Set(stages.filter((g) => g.stage === 'building').map((g) => g.project_id))
  const withSchedule = new Set(drawn.map((d) => d.project_id))
  return [...new Set(projects.filter((p) => p.customer_id === customerId && building.has(p.id) && withSchedule.has(p.id)).map((p) => p.id))].sort()
}

/** The customer's picture on each job read, by the job's id: `customerPortalSchedule`'s answer and nothing else. */
export function customerSchedulesFromRows(rows: ScheduleReadRows, today: string): Record<string, PortalGcSchedule> {
  const jobs = rows.jobs.filter((j) => j.project.gc.stage === 'building')
  if (jobs.length === 0) return {}
  const board: BoardRows = {
    today,
    projects: jobs.map((j) => gcProjectFromRows(j.project)),
    boardDates: {},
    customers: rows.customer ? [{ id: rows.customer.id, name: rows.customer.name }] : [],
    companies: rows.companies.map(companyRowOf),
    invites: rows.invites.map(inviteRowOf),
    quotes: [],
    contacts: [],
    promises: [],
    promiseMoves: [],
    sows: rows.sows,
    sowLines: rows.sowLines,
  }
  const draws: DrawTables = {
    sows: rows.sows.map((s) => ({ id: s.id, package_id: s.package_id })),
    sowLines: rows.sowLines.map((l) => ({ id: l.id, sow_id: l.sow_id, position: l.position, scope_item_id: l.scope_item_id })),
    ...rows.draws,
    backCharges: [],
    tradeSends: [],
  }
  // As the Schedule window lays them: the change orders' non-money half, then the trades' percents.
  const state = withDraws(withOfficeChangeOrders(boardStateFromRows(board), (rows.changeOrders ?? []) as ChangeOrderOfficeRow[]), draws)
  const out: Record<string, PortalGcSchedule> = {}
  for (const job of jobs) {
    const read = withScheduleRows({ state, projectId: job.project.project.id, rows: scheduleRowsOf(job.schedule), templates: [], names: new Map() })
    if (!read?.project.schedule) continue
    out[job.project.project.id] = customerPortalSchedule(customerSchedulePicture(read.state, read.project), lateFinish(read.state, read.project).customerWords, today)
  }
  return out
}

/**
 * The customer's schedule on each of their GC jobs being built with a schedule drawn (call 3), read and worked out here,
 * by the job's id. A failed read shows no schedule, and the rest of their portal reads as before.
 */
// deno-lint-ignore no-explicit-any
export async function loadCustomerSchedules(admin: any, customerId: string, today: string): Promise<Record<string, PortalGcSchedule>> {
  try {
    const { data: projects } = await admin.from('projects').select('id, customer_id').eq('customer_id', customerId)
    const projectIds = ((projects ?? []) as { id: string }[]).map((p) => p.id)
    if (projectIds.length === 0) return {}
    const [{ data: stages }, { data: drawn }] = await Promise.all([
      admin.from('gc_projects').select('project_id, stage').in('project_id', projectIds),
      admin.from('gc_schedules').select('project_id').in('project_id', projectIds),
    ])
    const jobIds = customerPortalJobs(projects ?? [], stages ?? [], drawn ?? [], customerId)
    if (jobIds.length === 0) return {}
    return customerSchedulesFromRows(await readScheduleRows(admin, jobIds, { customer: { customerId } }), today)
  } catch (e) {
    console.error('customer-portal: the schedule did not read', e)
    return {}
  }
}
