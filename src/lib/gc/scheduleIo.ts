/**
 * GC mode, the real build, the schedule's PR 6a: the one place the Schedule tab reads the database
 * (to-dos/gc-mode/mockups/schedule-pr6.md on branch spike/gc-mode). It loads one job's schedule rows
 * (the schedule's PRs 2 to 4) in two rounds, the names of the people they name, and the company's
 * templates, and lays them over the board's state through the mapper (`schedule/rows.ts`). The job
 * itself is the board's (`boardProjectFromView`): this never re-reads it. The writes, one function
 * for each press, come with PR 6b. Nothing here decides anything: the kernels in
 * `src/lib/gc/schedule/` do.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { withScheduleRows, type ScheduleRead, type ScheduleRows } from './schedule/rows'
import type { GcState } from './types'

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
