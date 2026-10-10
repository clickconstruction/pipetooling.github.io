/**
 * GC mode, the schedule's PR 14b: the trade's chart in its portal (G-110; the plan is
 * to-dos/gc-mode/mockups/schedule-pr14b.md on branch spike/gc-mode). Pure: `gc-trade-portal` reads each job's rows with
 * the service role, and this works out the company's chart from them with the generated copy of the kernels
 * (`gcKernels`, call 1), so the office's chart and the trade's read the same bars. Only `portalSchedule`'s answer
 * leaves: the company's own bars and those right before and after them, each by its company's name, dates, percent and
 * days slipped, never a dollar, a note or a contact (call 6). A neighbour's percent is its own report, never the
 * percent we see on a draw we sent it back (gc 3, amendment 1).
 */
import {
  boardStateFromRows,
  gcProjectFromRows,
  portalSchedule,
  withDraws,
  withScheduleRows,
  type BoardRows,
  type CompanyRow,
  type DrawTables,
  type GcProjectRows,
  type GcState,
  type InviteRow,
  type PortalSchedule,
  type ScheduleRows,
  type SowLineRow,
  type SowRow,
} from './gcKernels/index.ts'

/** One job's rows: the project as `gcProjectFromRows` takes it, and the schedule tables the chart reads. */
export interface TradeScheduleJob {
  project: GcProjectRows
  /** The schedule's own row, its bars, what each waits on and the baselines (days slipped). The rest read as none. */
  schedule: Pick<ScheduleRows, 'schedule' | 'activities' | 'links' | 'baselines' | 'baselineDates'> & Partial<ScheduleRows>
}

/** Everything the chart reads for a company, held to its jobs (`portalScheduleJobs`). */
export interface TradeScheduleRows {
  jobs: TradeScheduleJob[]
  /** Each trade's awarded invite on those jobs: who does it. A company that bid and lost is never read. */
  invites: Pick<InviteRow, 'id' | 'package_id' | 'company_id' | 'status' | 'invited_on'>[]
  /** The companies doing those trades, by name alone. */
  companies: Pick<CompanyRow, 'id' | 'name'>[]
  /** Each awarded trade's statement of work and its lines, for the line's name and percent. */
  sows: SowRow[]
  sowLines: SowLineRow[]
  /** Their draws, the draws' lines and the line reports: each line's percent, as `withDraws` lays it. */
  draws: Pick<DrawTables, 'draws' | 'drawLines' | 'reports'>
}

/**
 * The jobs a company sees a chart on (call 3): a trade on it is awarded to the company, through one of the company's
 * own invites, and the job is being built. A job still bidding, in buyout, lost or closed has none.
 */
export function portalScheduleJobs(
  packages: readonly { id: string; project_id: string; awarded_invite_id?: string | null }[],
  companyInviteIds: readonly string[],
  stages: readonly { project_id: string; stage?: string | null }[],
): string[] {
  const mine = new Set(companyInviteIds)
  const building = new Set(stages.filter((g) => g.stage === 'building').map((g) => g.project_id))
  return [...new Set(packages.filter((k) => k.awarded_invite_id && mine.has(k.awarded_invite_id) && building.has(k.project_id)).map((k) => k.project_id))].sort()
}

/**
 * The state with every open send-back taken off the trades that are not the company's (gc 3, amendment 1). A
 * send-back is between us and that trade: on a neighbour's bar its percent would tell another company we doubted the
 * draw, and by how much. A neighbour then reads its own newest report. The company's own trades keep theirs, as its
 * portal already shows our send-back.
 */
export function withoutOthersSendBacks(state: GcState, companyId: string): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      packages: project.packages.map((pkg) => {
        const theirs = pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === companyId)
        if (theirs || !pkg.sow?.sentBack) return pkg
        const { sentBack: _sentBack, ...sow } = pkg.sow
        return { ...pkg, sow }
      }),
    })),
  }
}

/** A company as the board takes it, from its name alone: the chart names a neighbour and nothing else of it. */
function companyRowOf(c: Pick<CompanyRow, 'id' | 'name'>): CompanyRow {
  return { id: c.id, name: c.name, trades: [], contact_name: '', phone: '', email: '', address: '', max_miles: null, license: '', lang: 'en', vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' }
}

/** An awarded invite as the board takes it: who does the trade, and nothing of what it quoted. */
function inviteRowOf(i: TradeScheduleRows['invites'][number]): InviteRow {
  return { ...i, declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: null, exclusion_covers: null, taken_alternates: null }
}

/** A job's schedule rows with every table the chart does not read empty. */
function scheduleRowsOf(s: TradeScheduleJob['schedule']): ScheduleRows {
  return {
    parts: [],
    milestones: [],
    failures: [],
    moves: [],
    pushes: [],
    tells: [],
    answers: [],
    walks: [],
    marks: [],
    lateNotices: [],
    waits: [],
    waitHolds: [],
    crewCounts: [],
    sends: [],
    whatIf: null,
    rough: null,
    ...s,
  }
}

/**
 * The company's chart on each of its jobs being built, by the job's id: `portalSchedule`'s answer and nothing else. A
 * job with no bar of the company's has none.
 */
export function portalSchedulesFromRows(rows: TradeScheduleRows, companyId: string, today: string): Record<string, PortalSchedule> {
  const jobs = rows.jobs.filter((j) => j.project.gc.stage === 'building')
  if (jobs.length === 0) return {}
  const board: BoardRows = {
    today,
    projects: jobs.map((j) => gcProjectFromRows(j.project)),
    boardDates: {},
    customers: [],
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
  const state = withoutOthersSendBacks(withDraws(boardStateFromRows(board), draws), companyId)
  const out: Record<string, PortalSchedule> = {}
  for (const job of jobs) {
    const read = withScheduleRows({ state, projectId: job.project.project.id, rows: scheduleRowsOf(job.schedule), templates: [], names: new Map() })
    const chart = read ? portalSchedule(read.state, companyId, read.project) : null
    if (chart) out[job.project.project.id] = chart
  }
  return out
}
