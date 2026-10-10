/**
 * GC mode, the real build, the schedule's PRs 6a and 6b: the one place the Schedule tab reads and
 * writes the database (to-dos/gc-mode/mockups/schedule-pr6.md on branch spike/gc-mode). It loads one
 * job's schedule rows (the schedule's PRs 2 to 4) in two rounds, the names of the people they name,
 * and the company's templates, and lays them over the board's state through the mapper
 * (`schedule/rows.ts`). The job itself is the board's (`boardProjectFromView`): this never re-reads
 * it. Each press has one function here. It sends the kernel's answer (`schedule/writes.ts`) and returns
 * the job read back. Nothing here decides anything: the kernels in `src/lib/gc/schedule/` do. Since the schedule's
 * PR 9d, the window reads the job's submittals and RFIs over the board first (`loadScheduleWithHolds`), so their holds
 * stop a pull as they hold a start. Since the schedule's PR 16a, it reads the job's daily logs and our crew's clock-ins
 * too, for whoever may (`ScheduleReads`), so the log against the chart, the days lost, the crew projection, people on
 * site and the walk's lost days read them (to-dos/gc-mode/mockups/schedule-pr16.md).
 */
import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import type { PlaceChange } from './schedule/places'
import { withScheduleRows, type ScheduleRead, type ScheduleRows } from './schedule/rows'
import { withRfis } from './rfiRows'
import { withCrewClockIns, withDailyLogs } from './dailyLogRows'
import { loadGcCrewOnSite, loadGcDailyLogs } from './dailyLogIo'
import { withOfficeChangeOrders } from './changeOrderOfficeRows'
import { loadGcChangeOrdersOffice } from './changeOrderOfficeIo'
import { withDraws, withTradeChanges } from './drawRows'
import { loadGcDraws } from './drawsIo'
import { loadGcBillingRows, loadGcChangeOrders } from './gcIo'
import type { ScheduleMoney } from './scheduleMoney'
import { loadGcRfis } from './rfisIo'
import { withSubmittals } from './submittalRows'
import { loadGcSubmittals } from './submittalsIo'
import { TEMPLATE_NAME_TAKEN, cleanTemplateName, templateNameProblem, templateSaveProblem, templateShape } from './schedule/templates'
import type { TheirDate } from './schedule/theirDates'
import type { MovedLine } from './schedule/tellTrades'
import type {
  ActivityPart,
  InspectionFailure,
  LookAheadMark,
  ProjectSchedule,
  RoughSchedule,
  ScheduleActivity,
  ScheduleMilestone,
  ScheduleMove,
  ScheduleWait,
  ScheduleWalk,
  ScheduleWhatIf,
} from './schedule/types'
import {
  actualDatesOf,
  addedForRpc,
  barsForRpc,
  crewMarkRowOf,
  draftForRpc,
  failureForRpc,
  milestoneRowOf,
  moveForRpc,
  partsForRpc,
  placesForRpc,
  pushBackOf,
  roughRowOf,
  templateRowOf,
  theirDatesForRpc,
  verifiedMarkOf,
  waitForRpc,
  waitStepOf,
  walkRowOf,
  whatIfRowOf,
  type WaitStep,
} from './schedule/writes'
import type { GcProject, GcState } from './types'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** A row that may not be there (a schedule not drawn, no copy open), or the read's problem thrown. */
function maybe<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T | null {
  if (result.error) checkSupabaseError(result, operation)
  return result.data
}

/** Ids a `.in()` filter takes at once, so a long schedule never makes a request line too long. */
const IN_CHUNK = 100

/** Every row of a table whose key is in `ids`, read a hundred ids at a time. None: no read. */
async function rowsIn<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: SupabaseResultError | null; status?: number }>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...taken(await read(ids.slice(i, i + IN_CHUNK)), operation))
  return out
}

/** What one reader may read over the schedule (the schedule's PR 16): the page says, from the role, and memoizes it. */
export interface ScheduleReads {
  /** The job's daily logs and our crew's clock-ins: Building's, so `canUseGcBuilding`. */
  logs?: boolean
  /** The company's day, the clock-ins' last day. */
  today?: string
  /** The money team's: Ask for the days drafts a change order (PR 16b-ii), and the money lines read the bills (16c). */
  money?: boolean
  /** The trades' reported percents on their bars (16c): the draws gate, `canUseGcBuilding || canSeeGcMoney` (O9). */
  draws?: boolean
}

/**
 * The board with what the schedule reads over it, before its own rows: the job's daily logs with our crew's clock-ins
 * laid in (U8's `withDailyLogs`, then `withCrewClockIns`, as the log window lays them), its change orders' non-money
 * half through `gc_change_orders_office` (PR 16b-ii; the view returns none to anyone outside the office), then its
 * submittals and RFIs. A reader without `logs` reads no logs, and its logs read empty as before.
 */
export async function scheduleHoldsState(state: GcState, projectId: string, reads: ScheduleReads = {}): Promise<GcState> {
  const startedOn = state.projects.find((p) => p.id === projectId)?.startedOn ?? null
  const packageIds = state.projects.find((p) => p.id === projectId)?.packages.map((k) => k.id) ?? []
  const [submittals, rfis, changeOrders, draws, logs, clockIns] = await Promise.all([
    loadGcSubmittals([projectId]),
    loadGcRfis([projectId]),
    loadGcChangeOrdersOffice([projectId]),
    reads.draws ? loadGcDraws(packageIds) : Promise.resolve(null),
    reads.logs ? loadGcDailyLogs([projectId]) : Promise.resolve(null),
    reads.logs && startedOn && reads.today ? loadGcCrewOnSite(projectId, startedOn, reads.today) : Promise.resolve([]),
  ])
  const logged = logs ? withCrewClockIns(withDailyLogs(state, logs), clockIns) : state
  const ordered = withOfficeChangeOrders(logged, changeOrders)
  // A hired trade's reported percent and our sent-back percent on its bar (16c), behind the draws gate.
  const drawn = draws ? withTradeChanges(withDraws(ordered, draws), draws) : ordered
  return withRfis(withSubmittals(drawn, submittals), rfis)
}

/**
 * What the money team's lines read beside the chart (16c): the customer's bills, the full change orders and the trades'
 * money. Only for `reads.money`; the money team reads the change orders' table, which the office's view leaves out.
 */
export async function loadScheduleMoney(projectId: string, packageIds: string[]): Promise<ScheduleMoney> {
  const [bills, changeOrders, draws] = await Promise.all([loadGcBillingRows([projectId]), loadGcChangeOrders([projectId]), loadGcDraws(packageIds)])
  return { bills, changeOrders, draws }
}

/**
 * One job's schedule with what it reads over the board (catch 2 of the schedule's PR 9, `mockups/schedule-pr9.md`, and
 * its PR 16): the job's daily logs, submittals and RFIs laid over the board as their own windows read them, then the
 * schedule. Building's tables are a dev's until its door, so anyone else reads none and their holds read empty.
 */
export async function loadScheduleWithHolds(state: GcState, projectId: string, reads: ScheduleReads = {}): Promise<ScheduleRead | null> {
  return loadSchedule(await scheduleHoldsState(state, projectId, reads), projectId)
}

/**
 * One job's schedule laid over the board's state (`boardStateFromRows`), with the version every plan
 * write sends back (decision 5). The reader's own what-if copy is the only one its policy lets it see
 * (decision 6). Null: no project with that id on the board.
 */
export async function loadSchedule(state: GcState, projectId: string): Promise<ScheduleRead | null> {
  const id = projectId
  const [header, activities, links, milestones, baselines, moves, walks, lateNotices, waits, holds, crewCounts, sends, whatIf, rough, templates] = await Promise.all([
    supabase.from('gc_schedules').select('version, template_id, template_name, template_used_on').eq('project_id', id).maybeSingle(),
    supabase.from('gc_schedule_activities').select('*').eq('project_id', id).order('position'),
    supabase.from('gc_schedule_links').select('*').eq('project_id', id),
    supabase.from('gc_schedule_milestones').select('*').eq('project_id', id).order('position'),
    supabase.from('gc_schedule_baselines').select('*').eq('project_id', id).order('created_at'),
    supabase.from('gc_schedule_moves').select('*').eq('project_id', id),
    supabase.from('gc_schedule_walks').select('*').eq('project_id', id),
    supabase.from('gc_schedule_late_notices').select('*').eq('project_id', id),
    supabase.from('gc_schedule_waits').select('*').eq('project_id', id),
    supabase.from('gc_schedule_wait_holds').select('*').eq('project_id', id),
    supabase.from('gc_schedule_crew_counts').select('*').eq('project_id', id),
    supabase.from('gc_schedule_sends').select('*').eq('project_id', id),
    supabase.from('gc_schedule_what_ifs').select('*').eq('project_id', id).maybeSingle(),
    supabase.from('gc_rough_schedules').select('*').eq('project_id', id).maybeSingle(),
    supabase.from('gc_schedule_templates').select('*'),
  ])
  const activityRows = taken(activities, 'load the schedule')
  const moveRows = taken(moves, 'load the schedule’s moves')
  const baselineRows = taken(baselines, 'load the baselines')
  const barIds = activityRows.map((a) => a.id)
  const moveIds = moveRows.map((m) => m.id)
  const [parts, failures, marks, baselineDates, pushes, tells, answers] = await Promise.all([
    rowsIn(barIds, (c) => supabase.from('gc_schedule_activity_parts').select('*').in('activity_id', c), 'load the parts'),
    rowsIn(barIds, (c) => supabase.from('gc_schedule_inspection_failures').select('*').in('activity_id', c), 'load the inspections that failed'),
    rowsIn(barIds, (c) => supabase.from('gc_schedule_lookahead_marks').select('*').in('activity_id', c), 'load the look-ahead marks'),
    rowsIn(baselineRows.map((b) => b.id), (c) => supabase.from('gc_schedule_baseline_dates').select('*').in('baseline_id', c), 'load the baselines'),
    rowsIn(moveIds, (c) => supabase.from('gc_schedule_move_pushes').select('*').in('move_id', c), 'load the schedule’s moves'),
    rowsIn(moveIds, (c) => supabase.from('gc_schedule_move_tells').select('*').in('move_id', c), 'load who was told'),
    rowsIn(moveIds, (c) => supabase.from('gc_schedule_move_answers').select('*').in('move_id', c), 'load the answers'),
  ])
  const rows: ScheduleRows = {
    schedule: maybe(header, 'load the schedule'),
    activities: activityRows,
    parts,
    links: taken(links, 'load what the work waits on'),
    milestones: taken(milestones, 'load the dates to meet'),
    failures,
    baselines: baselineRows,
    baselineDates,
    moves: moveRows,
    pushes,
    tells,
    answers,
    walks: taken(walks, 'load the walks'),
    marks,
    lateNotices: taken(lateNotices, 'load the late notices'),
    waits: taken(waits, 'load what the work waits on'),
    waitHolds: taken(holds, 'load what the work waits on'),
    crewCounts: taken(crewCounts, 'load the crew counts'),
    sends: taken(sends, 'load the schedules sent'),
    whatIf: maybe(whatIf, 'load the what-if copy'),
    rough: maybe(rough, 'load the rough schedule'),
  }
  const templateRows = taken(templates, 'load the templates')
  // Who did what is kept as a user id; the kernels show a name.
  const people = new Set<string>()
  for (const id of [
    ...rows.baselines.map((b) => b.locked_by),
    ...rows.moves.map((m) => m.undone_by),
    ...rows.walks.map((w) => w.walked_by),
    ...rows.lateNotices.map((n) => n.pushed_back_by),
    ...rows.sends.map((x) => x.sent_by),
    rows.whatIf?.user_id ?? null,
    rows.rough?.drawn_by ?? null,
    ...templateRows.map((t) => t.saved_by),
  ]) {
    if (id) people.add(id)
  }
  const named = await rowsIn([...people], (c) => supabase.from('users').select('id, name').in('id', c), 'load the names')
  const names = new Map(named.map((u) => [u.id, u.name ?? '']))
  return withScheduleRows({ state, projectId, rows, templates: templateRows, names })
}

// ---------------------------------------------------------------------------------------------
// The writes: one function for each press, each returning the job read back
// ---------------------------------------------------------------------------------------------

/**
 * What every plan write sends besides its answer (decision 5): the version of the schedule the press
 * read, and its words, the line the press makes for the log. A stale version is refused with
 * `SCHEDULE_CHANGED` and every change since: the thrown `DatabaseError` is read by `scheduleChangedRefusal`.
 */
export interface SchedulePress {
  version: number
  words: string
}

/** A new row key. */
const newId = () => crypto.randomUUID()

/** The words a write says when what it changes is gone: someone else took it off since the read. */
const GONE = 'It is not on this schedule any more. Reload the schedule and try again.'

/** The job as the state the press read has it: what the answer was worked out from. */
function jobOf(state: GcState, projectId: string): GcProject {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('That job is not on the board. Reload the board and try again.')
  return project
}

/** The bars as the press read them: what `barsForRpc` measures the answer against. */
function barsOf(state: GcState, projectId: string): ScheduleActivity[] {
  return jobOf(state, projectId).schedule?.activities ?? []
}

/** The signed-in person: who a record names where its column has no default. */
async function signedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sign in first.')
  return id
}

/** A write that changes one row by its key: refused in plain words when the row is gone. */
function changedOne(result: { data: { id?: string }[] | null; error: SupabaseResultError | null; status?: number }, operation: string, gone = GONE): void {
  checkSupabaseError(result, operation)
  if (result.data.length === 0) throw new Error(gone)
}

/** A template's name the table refused: a second person saved the same name at the same moment. */
function nameTaken(error: SupabaseResultError | null): boolean {
  return error?.code === '23505' && error.message.includes('gc_schedule_templates_name_once')
}

// The plan writes: each checks and bumps the version (the schedule's PR 5).

/**
 * The first draft (`draftSchedule`, from a template's lines when it names one) or a file's schedule
 * (`importedSchedule`). A first draft reads no version. A file's schedule in place of one drawn before
 * Start sends the version it read.
 */
export async function drawSchedule(state: GcState, projectId: string, press: { version: number | null; words: string }, schedule: ProjectSchedule): Promise<ScheduleRead | null> {
  // The generated type cannot say a first draft sends no version: the function takes null as "none".
  taken(await supabase.rpc('gc_schedule_draft', { p_project_id: projectId, p_version: press.version as number, p_words: press.words, p_draft: draftForRpc(schedule, newId) as unknown as Json }), 'draw the schedule')
  return loadSchedule(state, projectId)
}

/**
 * A move with why, of any kind: a drag, the editor, a part's own move, a pull, days got back, a late
 * notice or a change order taken. `move` is the kernel's record and `activities` the bars as the
 * kernel left them; the bars the press read are the state's.
 */
export async function saveScheduleMove(state: GcState, projectId: string, press: SchedulePress, move: ScheduleMove, activities: ScheduleActivity[]): Promise<ScheduleRead | null> {
  const project = jobOf(state, projectId)
  taken(
    await supabase.rpc('gc_schedule_move', {
      p_project_id: projectId,
      p_version: press.version,
      p_words: press.words,
      p_move: moveForRpc(project, move) as unknown as Json,
      p_bars: barsForRpc(barsOf(state, projectId), activities) as unknown as Json,
    }),
    'save the move',
  )
  return loadSchedule(state, projectId)
}

/** Undo (G-40): the newest standing move put back, from its own record on the server. */
export async function undoScheduleMove(state: GcState, projectId: string, press: SchedulePress, moveId: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_undo', { p_project_id: projectId, p_version: press.version, p_move_id: moveId, p_words: press.words }), 'undo the move')
  return loadSchedule(state, projectId)
}

/** Redo (G-40): the newest undone move put forward again. */
export async function redoScheduleMove(state: GcState, projectId: string, press: SchedulePress, moveId: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_redo', { p_project_id: projectId, p_version: press.version, p_move_id: moveId, p_words: press.words }), 'put the move back')
  return loadSchedule(state, projectId)
}

/** Keep (G-81): `keepWhatIf`'s answer, its moves oldest first and the real bars as the copy left them. The copy goes. */
export async function keepScheduleWhatIf(state: GcState, projectId: string, press: SchedulePress, kept: { schedule: ProjectSchedule; kept: ScheduleMove[] }): Promise<ScheduleRead | null> {
  const project = jobOf(state, projectId)
  taken(
    await supabase.rpc('gc_schedule_keep_what_if', {
      p_project_id: projectId,
      p_version: press.version,
      p_words: press.words,
      p_moves: kept.kept.map((m) => moveForRpc(project, m)) as unknown as Json,
      p_bars: barsForRpc(barsOf(state, projectId), kept.schedule.activities) as unknown as Json,
    }),
    'keep the what-if',
  )
  return loadSchedule(state, projectId)
}

/** A new baseline after a signed change order (G-41): the plan as it stands, named, with why. */
export async function setScheduleBaseline(state: GcState, projectId: string, press: SchedulePress, name: string, why: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_baseline', { p_project_id: projectId, p_version: press.version, p_name: name, p_why: why, p_words: press.words }), 'set the new baseline')
  return loadSchedule(state, projectId)
}

/** A trade's line split into parts (G-39, `splitParts`). */
export async function splitScheduleBar(state: GcState, projectId: string, press: SchedulePress, activityId: string, parts: ActivityPart[]): Promise<ScheduleRead | null> {
  taken(
    await supabase.rpc('gc_schedule_split', { p_project_id: projectId, p_version: press.version, p_activity_id: activityId, p_parts: partsForRpc(parts, newId) as unknown as Json, p_words: press.words }),
    'split the bar',
  )
  return loadSchedule(state, projectId)
}

/** A split line made one bar again (G-39). */
export async function joinScheduleBar(state: GcState, projectId: string, press: SchedulePress, activityId: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_join', { p_project_id: projectId, p_version: press.version, p_activity_id: activityId, p_words: press.words }), 'make the bar one again')
  return loadSchedule(state, projectId)
}

/** The job's own work on the chart (G-38): `activities` are the bars as the kernel left them, the new one among them. */
export async function addScheduleActivity(state: GcState, projectId: string, press: SchedulePress, activities: ScheduleActivity[]): Promise<ScheduleRead | null> {
  const made = addedForRpc(barsOf(state, projectId), activities, newId)
  if (!made) throw new Error('There is no new work to put on the chart.')
  taken(
    await supabase.rpc('gc_schedule_add_activity', {
      p_project_id: projectId,
      p_version: press.version,
      p_bar: made.bar as unknown as Json,
      p_holds_up: made.holdsUp,
      p_bars: made.bars as unknown as Json,
      p_words: press.words,
    }),
    'put the work on the chart',
  )
  return loadSchedule(state, projectId)
}

/** The job's own work taken off the chart (G-38). */
export async function removeScheduleActivity(state: GcState, projectId: string, press: SchedulePress, activityId: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_remove_activity', { p_project_id: projectId, p_version: press.version, p_activity_id: activityId, p_words: press.words }), 'take the work off the chart')
  return loadSchedule(state, projectId)
}

/** An inspection that did not pass: the failure, and the bars as the kernel left them (the inspection at its re-inspection day, what that pushed). */
export async function failScheduleInspection(
  state: GcState,
  projectId: string,
  press: SchedulePress,
  activityId: string,
  failure: InspectionFailure,
  activities: ScheduleActivity[],
): Promise<ScheduleRead | null> {
  taken(
    await supabase.rpc('gc_schedule_fail_inspection', {
      p_project_id: projectId,
      p_version: press.version,
      p_activity_id: activityId,
      p_failure: failureForRpc(failure) as unknown as Json,
      p_bars: barsForRpc(barsOf(state, projectId), activities) as unknown as Json,
      p_words: press.words,
    }),
    'record the inspection',
  )
  return loadSchedule(state, projectId)
}

// The records that touch several rows: no version (decision 9).

/** Where bars' work is (G-83, `placeChanges`). */
export async function setSchedulePlaces(state: GcState, projectId: string, changes: PlaceChange[]): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_set_places', { p_project_id: projectId, p_places: placesForRpc(changes) }), 'keep the places')
  return loadSchedule(state, projectId)
}

/** An inspection passed today, and a date to meet of the same name met. */
export async function passScheduleInspection(state: GcState, projectId: string, activityId: string): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_pass_inspection', { p_project_id: projectId, p_activity_id: activityId }), 'record the inspection')
  return loadSchedule(state, projectId)
}

/**
 * The companies told of moves (Tell the trades, the schedule's PR 13b): once `gc-trade-email` has sent one company its
 * dates, its tells, each move's lines it was shown, and the send's log row. A row already there stays, so a press again
 * after a send that went records it once. A record: no version. Answers how many rows it added.
 */
export async function recordScheduleTells(projectId: string, companyId: string, emailSendLogId: string | null, tells: { moveId: string; shown: MovedLine[] }[]): Promise<number> {
  return taken(
    await supabase.rpc('gc_schedule_record_tells', {
      p_project_id: projectId,
      p_company_id: companyId,
      // Null when the send kept no log row: the column takes it.
      p_email_send_log_id: emailSendLogId as unknown as string,
      p_tells: tells as unknown as Json,
    }),
    'record who was told',
  )
}

/** Their dates to meet from a file (G-145): the ticked dates, and the dates to meet as `withTheirDates` left them. */
export async function takeTheirDates(state: GcState, projectId: string, dates: TheirDate[], milestones: ScheduleMilestone[]): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_their_dates', { p_project_id: projectId, p_dates: theirDatesForRpc(dates, milestones) as unknown as Json }), 'take their dates')
  return loadSchedule(state, projectId)
}

/** What the work waits on from outside the trades (G-73 to G-75), as the kernel made it. */
export async function addScheduleWait(state: GcState, projectId: string, wait: ScheduleWait): Promise<ScheduleRead | null> {
  taken(await supabase.rpc('gc_schedule_add_wait', { p_project_id: projectId, p_wait: waitForRpc(wait, newId) as unknown as Json }), 'add what the work waits on')
  return loadSchedule(state, projectId)
}

// The plain writes: one row each, under the tables' policies (decision 9).

/** A weekly walk (G-52): what was kept as drawn, the moves made on it, what was not looked at. */
export async function recordScheduleWalk(state: GcState, projectId: string, walk: Pick<ScheduleWalk, 'on' | 'kept' | 'moveIds' | 'skipped' | 'keptEarly'>): Promise<ScheduleRead | null> {
  taken(await supabase.from('gc_schedule_walks').insert(walkRowOf(projectId, walk)), 'keep the walk')
  return loadSchedule(state, projectId)
}

/** A bar's real days (G-55, after `actualProblem`): a day set, null to clear it, unset to leave it. */
export async function setActualDates(state: GcState, projectId: string, activityId: string, dates: { actualStart?: string | null; actualFinish?: string | null }): Promise<ScheduleRead | null> {
  const change = actualDatesOf(dates)
  if (Object.keys(change).length > 0) {
    changedOne(await supabase.from('gc_schedule_activities').update(change).eq('project_id', projectId).eq('id', activityId).select('id'), 'keep the real days')
  }
  return loadSchedule(state, projectId)
}

/** The job's own work done on a day, or not done after all (null). */
export async function setOwnWorkDone(state: GcState, projectId: string, activityId: string, on: string | null): Promise<ScheduleRead | null> {
  changedOne(await supabase.from('gc_schedule_activities').update({ done_on: on }).eq('project_id', projectId).eq('id', activityId).eq('kind', 'added').select('id'), 'mark the work done')
  return loadSchedule(state, projectId)
}

/** A date to meet set: one of the job's changed, or a new one put last. */
export async function setScheduleMilestone(state: GcState, projectId: string, milestone: ScheduleMilestone): Promise<ScheduleRead | null> {
  const known = (state.projects.find((p) => p.id === projectId)?.schedule?.milestones ?? []).some((m) => m.id === milestone.id)
  if (known) {
    const { project_id: _project, position: _position, id: _id, ...change } = milestoneRowOf(projectId, milestone, 0)
    changedOne(await supabase.from('gc_schedule_milestones').update(change).eq('project_id', projectId).eq('id', milestone.id).select('id'), 'keep the date to meet')
  } else {
    const last = taken(await supabase.from('gc_schedule_milestones').select('position').eq('project_id', projectId).order('position', { ascending: false }).limit(1), 'keep the date to meet')
    taken(await supabase.from('gc_schedule_milestones').insert(milestoneRowOf(projectId, milestone, (last[0]?.position ?? -1) + 1)), 'keep the date to meet')
  }
  return loadSchedule(state, projectId)
}

/** A date to meet taken off. */
export async function removeScheduleMilestone(state: GcState, projectId: string, milestoneId: string): Promise<ScheduleRead | null> {
  changedOne(await supabase.from('gc_schedule_milestones').delete().eq('project_id', projectId).eq('id', milestoneId).select('id'), 'take the date off')
  return loadSchedule(state, projectId)
}

/** Our superintendent's check of a trade's mark, as the kernel made it: once, the correction when there is one. */
export async function verifyLookAhead(state: GcState, projectId: string, mark: LookAheadMark): Promise<ScheduleRead | null> {
  const by = await signedIn()
  changedOne(
    await supabase.from('gc_schedule_lookahead_marks').update(verifiedMarkOf(mark, by)).eq('activity_id', mark.lineId).eq('week_of', mark.weekOf).is('verified_on', null).select('id'),
    'check the mark',
    'That mark was checked already. Reload the schedule to see it.',
  )
  return loadSchedule(state, projectId)
}

/** Our own crew's mark for a week, which counts as checked: it takes the place of any mark that week. */
export async function crewMarkLookAhead(state: GcState, projectId: string, mark: LookAheadMark): Promise<ScheduleRead | null> {
  const by = await signedIn()
  taken(await supabase.from('gc_schedule_lookahead_marks').upsert(crewMarkRowOf(mark, by), { onConflict: 'activity_id,week_of' }), 'keep the mark')
  return loadSchedule(state, projectId)
}

/** A wait's next step: asked, shipped, in, or a new expected day with what holds it. */
export async function setScheduleWaitStep(state: GcState, projectId: string, waitId: string, step: WaitStep, on: string, note?: string): Promise<ScheduleRead | null> {
  changedOne(await supabase.from('gc_schedule_waits').update(waitStepOf(step, on, note)).eq('project_id', projectId).eq('id', waitId).select('id'), 'keep the step')
  return loadSchedule(state, projectId)
}

/** A wait taken off the schedule, with the bars it held. */
export async function removeScheduleWait(state: GcState, projectId: string, waitId: string): Promise<ScheduleRead | null> {
  changedOne(await supabase.from('gc_schedule_waits').delete().eq('project_id', projectId).eq('id', waitId).select('id'), 'take the wait off')
  return loadSchedule(state, projectId)
}

/** The office's push back on an open late notice (G-117), today, in the person's words. */
export async function pushBackLateNotice(state: GcState, projectId: string, noticeId: string, note: string): Promise<ScheduleRead | null> {
  const by = await signedIn()
  changedOne(
    await supabase.from('gc_schedule_late_notices').update(pushBackOf(state.today, by, note)).eq('project_id', projectId).eq('id', noticeId).is('pushed_back_on', null).select('id'),
    'push back',
    'That notice was answered already. Reload the schedule to see it.',
  )
  return loadSchedule(state, projectId)
}

/** A job being built saved as a template (G-44), under its name: `templateSaveProblem` first, then the table's own word. */
export async function saveScheduleTemplate(state: GcState, projectId: string, name: string): Promise<ScheduleRead | null> {
  const project = jobOf(state, projectId)
  const problem = templateSaveProblem(state, project, name)
  const shape = templateShape(state, project)
  if (problem || !shape) throw new Error(problem ?? 'Draw the schedule first.')
  const result = await supabase.from('gc_schedule_templates').insert(templateRowOf({ name: cleanTemplateName(name), on: state.today, ...shape }))
  if (nameTaken(result.error)) throw new Error(TEMPLATE_NAME_TAKEN)
  taken(result, 'save the template')
  return loadSchedule(state, projectId)
}

/** A template's new name. The jobs drawn from it keep the name they were drawn with. */
export async function renameScheduleTemplate(state: GcState, projectId: string, templateId: string, name: string): Promise<ScheduleRead | null> {
  const problem = templateNameProblem(state, name, templateId)
  if (problem) throw new Error(problem)
  const result = await supabase.from('gc_schedule_templates').update({ name: cleanTemplateName(name) }).eq('id', templateId).select('id')
  if (nameTaken(result.error)) throw new Error(TEMPLATE_NAME_TAKEN)
  changedOne(result, 'rename the template', 'That template is gone. Reload to see the templates kept.')
  return loadSchedule(state, projectId)
}

/** A template set aside, so it is not offered, or brought back. */
export async function setAsideScheduleTemplate(state: GcState, projectId: string, templateId: string, aside: boolean): Promise<ScheduleRead | null> {
  changedOne(
    await supabase.from('gc_schedule_templates').update({ aside_on: aside ? state.today : null }).eq('id', templateId).select('id'),
    aside ? 'set the template aside' : 'bring the template back',
    'That template is gone. Reload to see the templates kept.',
  )
  return loadSchedule(state, projectId)
}

/** The rough while we bid (G-45), drawn or drawn again, as the kernel made it. */
export async function setRoughSchedule(state: GcState, projectId: string, rough: RoughSchedule): Promise<ScheduleRead | null> {
  const by = await signedIn()
  taken(await supabase.from('gc_rough_schedules').upsert({ ...roughRowOf(projectId, rough, by), updated_at: new Date().toISOString() }, { onConflict: 'project_id' }), 'keep the rough schedule')
  return loadSchedule(state, projectId)
}

/** The person's own what-if copy made (G-81, `whatIfCopy`), with the version of the plan it copied. */
export async function startWhatIf(state: GcState, projectId: string, version: number, whatIf: ScheduleWhatIf): Promise<ScheduleRead | null> {
  const by = await signedIn()
  taken(await supabase.from('gc_schedule_what_ifs').insert(whatIfRowOf(projectId, whatIf, by, version)), 'make the what-if copy')
  return loadSchedule(state, projectId)
}

/** A move tried in the person's own copy: the copy as the kernel left it. */
export async function tryInWhatIf(state: GcState, projectId: string, whatIf: ScheduleWhatIf): Promise<ScheduleRead | null> {
  const by = await signedIn()
  changedOne(
    await supabase.from('gc_schedule_what_ifs').update({ copy: whatIf.schedule as unknown as Json, updated_at: new Date().toISOString() }).eq('project_id', projectId).eq('user_id', by).select('project_id'),
    'try it in the what-if',
    'There is no what-if open.',
  )
  return loadSchedule(state, projectId)
}

/** The person's own copy thrown away. The real schedule stays as it is. */
export async function throwAwayWhatIf(state: GcState, projectId: string): Promise<ScheduleRead | null> {
  const by = await signedIn()
  taken(await supabase.from('gc_schedule_what_ifs').delete().eq('project_id', projectId).eq('user_id', by), 'throw the what-if away')
  return loadSchedule(state, projectId)
}
