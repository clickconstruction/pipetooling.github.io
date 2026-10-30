/**
 * GC mode, the schedule's PR 14b: the trade's chart in its portal (G-110; the plan is
 * to-dos/gc-mode/mockups/schedule-pr14b.md on branch spike/gc-mode). Pure: `gc-trade-portal` reads each job's rows with
 * the service role, and this works out the company's chart from them with the generated copy of the kernels
 * (`gcKernels`, call 1), so the office's chart and the trade's read the same bars. Only `portalSchedule`'s answer
 * leaves: the company's own bars and those right before and after them, each by its company's name, dates, percent and
 * days slipped, never a dollar, a note or a contact (call 6). A neighbour's percent is its own report, never the
 * percent we see on a draw we sent it back (gc 3, amendment 1).
 *
 * Since the Portal's P5d-ii (to-dos/gc-mode/mockups/portal-p5d.md), the trade's side of the schedule is worked out on
 * the same state, with the same kernels the office reads: the told moves it answers (G-113), a late door on each of its
 * own bars with its newest notice (G-117), its look-ahead (marks) and its crew counts (G-142), and the home's four
 * schedule to-dos. `lateWaitingFromRows` answers the late door's second look for one day. Each leaves as plain fields,
 * never a `ScheduleRow`, a trade package or another company's notice, mark or count (call 3).
 */
import {
  boardStateFromRows,
  datesNotices,
  gcProjectFromRows,
  lateDoor,
  lateTarget,
  lateWaiting,
  portalCrewAsks,
  portalLateNotice,
  portalLookAhead,
  portalSchedule,
  portalTodos,
  withDraws,
  withScheduleRows,
  type BoardRows,
  type CompanyRow,
  type DrawTables,
  type GcProject,
  type GcProjectRows,
  type GcState,
  type InviteRow,
  type PortalSchedule,
  type PortalTodo,
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
export function companyRowOf(c: Pick<CompanyRow, 'id' | 'name'>): CompanyRow {
  return { id: c.id, name: c.name, trades: [], contact_name: '', phone: '', email: '', address: '', max_miles: null, license: '', lang: 'en', vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' }
}

/** An awarded invite as the board takes it: who does the trade, and nothing of what it quoted. */
export function inviteRowOf(i: TradeScheduleRows['invites'][number]): InviteRow {
  return { ...i, declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: null, exclusion_covers: null, taken_alternates: null }
}

/** A job's schedule rows with every table the chart does not read empty. */
export function scheduleRowsOf(s: TradeScheduleJob['schedule']): ScheduleRows {
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

/** Each job being built, as the office's chart reads it, with the other trades' send-backs taken off (amendment 1). */
function jobStates(rows: TradeScheduleRows, companyId: string, today: string): { projectId: string; state: GcState; project: GcProject }[] {
  const jobs = rows.jobs.filter((j) => j.project.gc.stage === 'building')
  if (jobs.length === 0) return []
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
  return jobs.flatMap((job) => {
    const read = withScheduleRows({ state, projectId: job.project.project.id, rows: scheduleRowsOf(job.schedule), templates: [], names: new Map() })
    return read ? [{ projectId: job.project.project.id, state: read.state, project: read.project }] : []
  })
}

/**
 * The company's chart on each of its jobs being built, by the job's id: `portalSchedule`'s answer and nothing else. A
 * job with no bar of the company's has none.
 */
export function portalSchedulesFromRows(rows: TradeScheduleRows, companyId: string, today: string): Record<string, PortalSchedule> {
  const out: Record<string, PortalSchedule> = {}
  for (const { projectId, state, project } of jobStates(rows, companyId, today)) {
    const chart = portalSchedule(state, companyId, project)
    if (chart) out[projectId] = chart
  }
  return out
}

/** One line a move changed, with its days before and after (punch list #217, outside-13). */
export interface WorkMovedLine {
  lineId: string
  /** The line's own name, without the trade: "Trim and fixtures". */
  work: string
  from: { start: string; finish: string }
  to: { start: string; finish: string }
}

/** A move the company was told of and has not answered (G-113): its message, rebuilt in the company's language today. */
export interface WorkDates {
  moveId: string
  toldOn: string
  subject: string
  /** The message's lines after its greeting, as the email had them. */
  lines: string[]
  /**
   * The lines the move changed, each with its days before and after (punch list #217, outside-13), so the portal can
   * draw the move on the line's own row. Absent from a function deployed before it: the page then keeps the block.
   */
  moves?: WorkMovedLine[]
  /** Why, as the office picked it (`ScheduleMoveReason`), and in its own words. Absent from a function deployed before it. */
  reason?: string
  note?: string
}

/** Where the company's newest notice on a bar stands, as its portal shows it. */
export interface WorkLateNotice {
  id: string
  state: 'open' | 'taken' | 'pushedBack' | 'kept'
  on: string
  toStart: string
  toFinish: string
  reason: string
  note: string
  /** Our push back: the day and why. Never who of ours pressed it. */
  pushedBack: { on: string; note: string } | null
  keptOn: string | null
}

/** One of the company's own bars it may say will be late on (G-117): `lateDoor`'s answer, and its notice. */
export interface WorkLate {
  lineId: string
  start: string
  finish: string
  /** Under way: a notice gives a new finish. Not started: a new start, the bar moving whole. */
  started: boolean
  /** The day a notice would change. */
  day: string
  notice: WorkLateNotice | null
}

/** One bar of the company's look-ahead in a week, with its mark and our check. */
export interface WorkLookItem {
  lineId: string
  packageId: string
  trade: string
  work: string
  start: string
  finish: string
  mark: { done: boolean; reason: string | null; verifiedOn: string | null; verifiedDone: boolean | null; verifiedReason: string | null } | null
  state: 'done' | 'not' | 'waiting' | 'unmarked'
  canMark: boolean
}

export interface WorkLookWeek {
  weekOf: string
  when: 'last' | 'this' | 'next' | 'later'
  items: WorkLookItem[]
}

/** A coming week with the company's work: each of its trades, and the count that stands. */
export interface WorkCrewWeek {
  weekOf: string
  trades: { packageId: string; trade: string; count: number | null }[]
}

/** The trade's side of the schedule on one job (P5d-ii, call 3). */
export interface ScheduleWork {
  dates: WorkDates[]
  late: WorkLate[]
  lookAhead: WorkLookWeek[]
  crew: WorkCrewWeek[]
}

/** The home's to-dos that read the schedule, which the page cannot work out from its slice (call 5). */
const SCHEDULE_TODO = (key: string) => key.startsWith('dates:') || key.startsWith('late:') || key.includes(':lookahead')

/**
 * The company's side of the schedule on each of its jobs being built, by the job's id, and the home's schedule
 * to-dos. A job with nothing to show has no entry.
 */
export function portalScheduleWorkFromRows(rows: TradeScheduleRows, companyId: string, today: string, lang: 'en' | 'es'): { work: Record<string, ScheduleWork>; todos: PortalTodo[] } {
  const work: Record<string, ScheduleWork> = {}
  const todos: PortalTodo[] = []
  for (const { projectId, state, project } of jobStates(rows, companyId, today)) {
    const dates = datesNotices(state, companyId, lang)
      .filter((n) => n.project.id === projectId)
      .map((n) => ({
        moveId: n.move.id,
        toldOn: n.move.toldOn ?? n.move.on,
        subject: n.message.subject,
        lines: n.message.lines.slice(1),
        // Punch list #217 (outside-13): the move's days by line, so the portal can draw it on the line's own row.
        moves: n.lines.map((l) => ({ lineId: l.lineId, work: l.work, from: { ...l.from }, to: { ...l.to } })),
        reason: n.move.reason,
        note: n.move.note,
      }))
    const late = (project.schedule?.activities ?? []).flatMap((a): WorkLate[] => {
      const door = lateDoor(state, project, companyId, a.lineId)
      if (!door) return []
      const shown = portalLateNotice(project, companyId, a.lineId)
      const notice: WorkLateNotice | null = shown
        ? {
            id: shown.notice.id,
            state: shown.state,
            on: shown.notice.on,
            toStart: shown.notice.to.start,
            toFinish: shown.notice.to.finish,
            reason: shown.notice.reason,
            note: shown.notice.note,
            pushedBack: shown.notice.pushedBack ? { on: shown.notice.pushedBack.on, note: shown.notice.pushedBack.note } : null,
            keptOn: shown.notice.kept?.on ?? null,
          }
        : null
      return [{ lineId: a.lineId, start: door.row.activity.start, finish: door.row.activity.finish, started: door.started, day: door.day, notice }]
    })
    const lookAhead = portalLookAhead(state, companyId, project).map((w) => ({
      weekOf: w.weekOf,
      when: w.when,
      items: w.items.map((i) => ({
        lineId: i.row.activity.lineId,
        packageId: i.row.pkg.id,
        trade: i.row.trade,
        work: i.row.label,
        start: i.row.activity.start,
        finish: i.row.activity.finish,
        mark: i.mark
          ? { done: i.mark.done, reason: i.mark.reason ?? null, verifiedOn: i.mark.verifiedOn, verifiedDone: i.mark.verifiedDone ?? null, verifiedReason: i.mark.verifiedReason ?? null }
          : null,
        state: i.state,
        canMark: i.canMark,
      })),
    }))
    const crew = portalCrewAsks(state, companyId, project).map((w) => ({
      weekOf: w.weekOf,
      trades: w.trades.map((t) => ({ packageId: t.packageId, trade: t.trade, count: t.now?.count ?? null })),
    }))
    if (dates.length + late.length + lookAhead.length + crew.length > 0) work[projectId] = { dates, late, lookAhead, crew }
    todos.push(...portalTodos(state, companyId, undefined, lang).filter((t) => t.projectId === projectId && SCHEDULE_TODO(t.key)))
  }
  return { work, todos }
}

/** One bar that waits on the bar a late notice would move, and where it would go: by name, never a price. */
export interface WorkWaiting {
  work: string
  /** Who does it. Null: the company itself. */
  company: string | null
  start: string
  days: number
}

/**
 * The late door's second look (G-117, call 4): what the day picked does to the work waiting directly on one of the
 * company's own bars. Null when the bar is not the company's, has no door, or the day is not after the door's day.
 */
export function lateWaitingFromRows(rows: TradeScheduleRows, companyId: string, today: string, lineId: string, day: string): WorkWaiting[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  for (const { state, project } of jobStates(rows, companyId, today)) {
    const door = lateDoor(state, project, companyId, lineId)
    if (!door) continue
    if (day <= door.day) return null
    return lateWaiting(state, project, lineId, lateTarget(door.row.activity, door.started, day)).map((w) => ({ work: w.work, company: w.company, start: w.start, days: w.days }))
  }
  return null
}
