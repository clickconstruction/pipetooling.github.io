/**
 * GC mode, the real build, the schedule's PR 6b: what the schedule's writes send, built from the
 * kernels' records (to-dos/gc-mode/mockups/schedule-pr6.md on branch spike/gc-mode). A press works its
 * answer out in the screen and sends the answer, not the question: the bars as the kernel left them and
 * the move as the kernel recorded it, to the schedule's PR 5 functions
 * (`supabase/migrations/20261008040000_gc_schedule_writes.sql`); and the rows of the plain writes, in
 * the shape the mapper reads back (`rows.ts`). Every key the functions read is a key sent here
 * (`writes.words.test.ts` holds the two together). Pure: the io sends them (`src/lib/gc/scheduleIo.ts`).
 */
import type { Json, TablesInsert, TablesUpdate } from '../../../types/database'
import type { GcProject } from '../types'
import type { ScheduleLetter } from './customerScheduleSend'
import { moveActivityName } from './moves'
import type { PlaceChange } from './places'
import type { TheirDate } from './theirDates'
import type {
  ActivityPart,
  InspectionFailure,
  LookAheadMark,
  ProjectSchedule,
  RoughSchedule,
  ScheduleActivity,
  ScheduleMilestone,
  ScheduleMove,
  ScheduleTemplate,
  ScheduleWait,
  ScheduleWalk,
  ScheduleWhatIf,
} from './types'

/** A row's key. A kernel's own id ("fairoaksd-insp-final", "fsite-1-p1", "move-3") is not one: the write gives it one. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A new row key. The io passes `crypto.randomUUID`; a test passes its own. */
export type NewId = () => string

// ---------------------------------------------------------------------------------------------
// The plan writes (the schedule's PR 5 functions)
// ---------------------------------------------------------------------------------------------

/** What a bar waits on, each with its gap (G-35), as a function reads it. */
export interface RpcWait {
  id: string
  gap: number
}

/** One bar's new plan, as `gc_schedule_set_bars` reads it: its days always, and only the rest that changed. */
export interface RpcBar {
  id: string
  start: string
  finish: string
  /** Null takes the limit off (G-36). */
  notBefore?: string | null
  mustFinishBy?: string | null
  /** The bar's whole list of waits. */
  after?: RpcWait[]
  /** Its parts' days from the line's start (G-39). */
  parts?: { id: string; fromDay: number; days: number }[]
}

function waitsOf(a: ScheduleActivity): RpcWait[] {
  return a.after.map((id) => ({ id, gap: a.lag?.[id] ?? 0 }))
}

function partDaysOf(a: ScheduleActivity): { id: string; fromDay: number; days: number }[] {
  return (a.parts ?? []).map((p) => ({ id: p.id, fromDay: p.from, days: p.days }))
}

/**
 * Every bar whose plan changed from `before` to `after` (the kernel's answer): its new days, and its
 * limits, waits or parts' days when those changed. A bar only in `after` is new and a bar only in
 * `before` is gone: their own presses write them. So a move sends its bar and the bars it pushed, and
 * nothing else, which is what `gc_schedule_move` holds a move to.
 */
export function barsForRpc(before: ScheduleActivity[], after: ScheduleActivity[]): RpcBar[] {
  const was = new Map(before.map((a) => [a.lineId, a]))
  return after.flatMap((a): RpcBar[] => {
    const b = was.get(a.lineId)
    if (!b) return []
    const notBefore = (a.notBefore ?? null) !== (b.notBefore ?? null)
    const mustFinishBy = (a.mustFinishBy ?? null) !== (b.mustFinishBy ?? null)
    const waits = JSON.stringify(waitsOf(a)) !== JSON.stringify(waitsOf(b))
    const parts = JSON.stringify(partDaysOf(a)) !== JSON.stringify(partDaysOf(b))
    if (a.start === b.start && a.finish === b.finish && !notBefore && !mustFinishBy && !waits && !parts) return []
    return [
      {
        id: a.lineId,
        start: a.start,
        finish: a.finish,
        ...(notBefore ? { notBefore: a.notBefore ?? null } : {}),
        ...(mustFinishBy ? { mustFinishBy: a.mustFinishBy ?? null } : {}),
        ...(waits ? { after: waitsOf(a) } : {}),
        ...(parts ? { parts: partDaysOf(a) } : {}),
      },
    ]
  })
}

type Span = { start: string; finish: string }

/** A move as `gc_schedule_move` reads it (`p_move`): the kernel's record, by the bar's id, with the kind's own keys. */
export interface RpcMove {
  activityId: string
  /** The bar's name that day, so the history still reads once the bar is gone. */
  activityName: string
  /** The mover's name, kept only when the server cannot read it. */
  madeByName: string
  reason: string
  note: string
  from: Span
  to: Span
  linksChanged: boolean
  finishFrom: string
  finishTo: string
  pushed: { activityId: string; from: Span; to: Span }[]
  /** The signed change order whose days it put on (G-76). */
  changeOrderId?: string
  /** The trade's late notice it took (G-117). */
  lateNoticeId?: string
  /** A pull (G-37): the lines that finished early, its own first. */
  pullFinished?: string[]
  /** Days got back (G-82): side by side after a wait, with the gap before and after, or a second crew. */
  recovery?: { how: 'side' | 'crew'; afterActivityId?: string; gapWas?: number; gap?: number }
  /** A part's own move (G-39): which, and every part's days before and after. */
  parts?: NonNullable<ScheduleMove['parts']>
}

/**
 * A move the kernel recorded (`moveRecord`, `pullMove`, `recoveryMove`, a part's move, a late notice
 * or a change order taken), as the server keeps it. `project` is the job the move was made on: the
 * bar's name is read from it.
 */
export function moveForRpc(project: GcProject, move: ScheduleMove): RpcMove {
  const r = move.recovery
  return {
    activityId: move.lineId,
    activityName: moveActivityName(project, move.lineId),
    madeByName: move.by,
    reason: move.reason,
    note: move.note.trim(),
    from: move.from,
    to: move.to,
    linksChanged: Boolean(move.linksChanged),
    finishFrom: move.finishFrom,
    finishTo: move.finishTo,
    pushed: move.pushed.map((p) => ({ activityId: p.lineId, from: p.from, to: p.to })),
    ...(move.changeOrderId ? { changeOrderId: move.changeOrderId } : {}),
    ...(move.lateNoticeId ? { lateNoticeId: move.lateNoticeId } : {}),
    ...(move.pull ? { pullFinished: move.pull.finished } : {}),
    ...(r ? { recovery: { how: r.how, ...(r.after !== undefined ? { afterActivityId: r.after, gapWas: r.gapWas ?? 0, gap: r.gap ?? 0 } : {}) } } : {}),
    ...(move.parts ? { parts: move.parts } : {}),
  }
}

/** A part, as `gc_schedule_split` and `gc_schedule_draft` read it. */
export interface RpcPart {
  id: string
  name: string
  fromDay: number
  days: number
  share: number
  pct: number
}

/** A split's parts (`splitParts`), each with a row key. The kernel's own ids (`${lineId}-p1`) are not row keys. */
export function partsForRpc(parts: ActivityPart[], newId: NewId): RpcPart[] {
  return parts.map((p) => ({ id: UUID.test(p.id) ? p.id : newId(), name: p.name, fromDay: p.from, days: p.days, share: p.share, pct: p.pct }))
}

/** One bar of a draw, as `gc_schedule_draft` reads it. */
export interface RpcDraftBar {
  kind: 'line' | 'inspection' | 'added'
  /** A line's: its scope line, which is its id too, and its trade. */
  scopeItemId?: string
  packageId?: string
  /** An inspection's or the job's own work's: its row key and its name. */
  id?: string
  label?: string
  /** The job's own work: whose it is. */
  who?: string
  start: string
  finish: string
  notBefore?: string
  mustFinishBy?: string
  place?: string
  after: RpcWait[]
  parts?: RpcPart[]
}

export interface RpcMilestone {
  id: string
  label: string
  planned: string
  packageId: string | null
  metOn: string | null
}

export interface RpcDraft {
  template?: { id: string }
  bars: RpcDraftBar[]
  milestones: RpcMilestone[]
}

/**
 * A first draft (`draftSchedule`, from a template's lines when it names one) or a file's schedule
 * (`importedSchedule`), as `gc_schedule_draft` reads it. A line's bar keeps its scope line's id. An
 * inspection's or the job's own work's kernel id (`${projectId}-insp-roughin`) gets a row key, and every
 * wait that names it is pointed at the new key; a part and a date to meet get one the same way.
 */
export function draftForRpc(schedule: ProjectSchedule, newId: NewId): RpcDraft {
  // Only an inspection and the job's own work have a kernel id: a line's id is its scope line's.
  const keys = new Map(schedule.activities.filter((a) => (a.inspection || a.added) && !UUID.test(a.lineId)).map((a) => [a.lineId, newId()]))
  const keyOf = (lineId: string): string => keys.get(lineId) ?? lineId
  const bars = schedule.activities.map((a): RpcDraftBar => {
    const own = a.inspection ? { kind: 'inspection' as const, label: a.inspection.label } : a.added ? { kind: 'added' as const, label: a.added.label, who: a.added.who } : null
    return {
      ...(own ? { kind: own.kind, id: keyOf(a.lineId), label: own.label, ...('who' in own ? { who: own.who } : {}) } : { kind: 'line' as const, scopeItemId: a.lineId, packageId: a.packageId }),
      start: a.start,
      finish: a.finish,
      ...(a.notBefore ? { notBefore: a.notBefore } : {}),
      ...(a.mustFinishBy ? { mustFinishBy: a.mustFinishBy } : {}),
      ...(a.place ? { place: a.place } : {}),
      after: a.after.map((id) => ({ id: keyOf(id), gap: a.lag?.[id] ?? 0 })),
      ...(a.parts && a.parts.length > 0 ? { parts: partsForRpc(a.parts, newId) } : {}),
    }
  })
  // The template it was drawn from (G-44), while that template is still kept: a rough's copy outlives it.
  const template = schedule.template && UUID.test(schedule.template.id) ? { template: { id: schedule.template.id } } : {}
  return {
    ...template,
    bars,
    milestones: schedule.milestones.map((m) => ({ id: UUID.test(m.id) ? m.id : newId(), label: m.label, planned: m.planned, packageId: m.packageId, metOn: m.metOn })),
  }
}

/** The job's own work (G-38), as `gc_schedule_add_activity` reads it (`p_bar`). */
export interface RpcAddedBar {
  id: string
  label: string
  who: string
  start: string
  finish: string
  after: RpcWait[]
}

/**
 * The job's own work put on the chart (`addScheduleActivity`): the new bar with a row key, the bars
 * that wait on it from now on, and every other bar the kernel changed (those bars' waits, and what that
 * pushed), each naming the new bar by its row key. Null: `after` has no new bar of the job's own.
 */
export function addedForRpc(before: ScheduleActivity[], after: ScheduleActivity[], newId: NewId): { bar: RpcAddedBar; holdsUp: string[]; bars: RpcBar[] } | null {
  const was = new Set(before.map((a) => a.lineId))
  const added = after.find((a) => a.added && !was.has(a.lineId))
  if (!added?.added) return null
  const kernelId = added.lineId
  const id = UUID.test(kernelId) ? kernelId : newId()
  const keyed = (x: string) => (x === kernelId ? id : x)
  const renamed = after.map((a) => ({
    ...a,
    lineId: keyed(a.lineId),
    after: a.after.map(keyed),
    ...(a.lag ? { lag: Object.fromEntries(Object.entries(a.lag).map(([k, v]) => [keyed(k), v])) } : {}),
  }))
  return {
    bar: { id, label: added.added.label, who: added.added.who, start: added.start, finish: added.finish, after: waitsOf(added) },
    holdsUp: after.filter((a) => a.after.includes(kernelId)).map((a) => a.lineId),
    bars: barsForRpc(before, renamed),
  }
}

/** An inspection that did not pass (`failInspection`), as `gc_schedule_fail_inspection` reads it. Its day is the server's. */
export function failureForRpc(failure: InspectionFailure): { note: string; packageIds: string[]; reinspectOn: string } {
  return { note: failure.note, packageIds: failure.packageIds, reinspectOn: failure.reinspectOn }
}

// ---------------------------------------------------------------------------------------------
// The records that touch several rows (no version)
// ---------------------------------------------------------------------------------------------

/** Where bars' work is (G-83, `placeChanges`), as `gc_schedule_set_places` reads it: each bar's place, null to take it off. */
export function placesForRpc(changes: PlaceChange[]): Record<string, string | null> {
  return Object.fromEntries(changes.map((c) => [c.lineId, c.place]))
}

/**
 * Their dates to meet (G-145), as `gc_schedule_their_dates` reads them: one of ours with the day the
 * kernel gave it (`withTheirDates` took the signed change orders' days off substantial completion),
 * and one of theirs new, by its name and day.
 */
export function theirDatesForRpc(dates: TheirDate[], milestones: ScheduleMilestone[]): { id?: string; label: string; planned: string }[] {
  return dates.map((d) => {
    const ours = d.ours ? milestones.find((m) => m.id === d.ours) : undefined
    return ours ? { id: ours.id, label: ours.label, planned: ours.planned } : { label: d.name.trim(), planned: d.on }
  })
}

/** What the work waits on (G-73 to G-75), as `gc_schedule_add_wait` reads it: the kernel's wait with a row key. */
export function waitForRpc(
  wait: ScheduleWait,
  newId: NewId,
): { id: string; kind: string; title: string; packageId: string | null; who: string; askedOn: string | null; expectedOn: string; note: string | null; activityIds: string[] } {
  return {
    id: UUID.test(wait.id) ? wait.id : newId(),
    kind: wait.kind,
    title: wait.title.trim(),
    packageId: wait.packageId,
    who: wait.who.trim(),
    askedOn: wait.askedOn,
    expectedOn: wait.expectedOn,
    note: wait.note?.trim() || null,
    activityIds: wait.lineIds,
  }
}

// ---------------------------------------------------------------------------------------------
// The plain writes' rows, as the mapper reads them back
// ---------------------------------------------------------------------------------------------

/** A weekly walk (G-52) as its row. Who walked is the signed-in person, by the column's default. */
export function walkRowOf(projectId: string, walk: Pick<ScheduleWalk, 'on' | 'kept' | 'moveIds' | 'skipped' | 'keptEarly'>): TablesInsert<'gc_schedule_walks'> {
  return { project_id: projectId, walked_on: walk.on, kept: walk.kept, move_ids: walk.moveIds, skipped: walk.skipped, kept_early: walk.keptEarly ?? [] }
}

/**
 * The customer's letter as it is kept before it is emailed (G-94, PR 15a), dated the app's day. Who sent it is the
 * signed-in person, by the column's default; `gc-customer-email` writes its log once it goes.
 */
export function scheduleSendRowOf(projectId: string, letter: ScheduleLetter, today: string): TablesInsert<'gc_schedule_sends'> {
  return { project_id: projectId, sent_on: today, sent_to: letter.to, subject: letter.subject, lines: letter.lines }
}

/** A bar's real days (G-55): a day set, null to clear it, unset to leave it. */
export function actualDatesOf(dates: { actualStart?: string | null; actualFinish?: string | null }): TablesUpdate<'gc_schedule_activities'> {
  return {
    ...(dates.actualStart !== undefined ? { actual_start: dates.actualStart } : {}),
    ...(dates.actualFinish !== undefined ? { actual_finish: dates.actualFinish } : {}),
  }
}

/** A date to meet as its row, at a place in the list. A new one's kernel id (`${projectId}-ms-4-dry-in`) gets a row key from the table. */
export function milestoneRowOf(projectId: string, m: ScheduleMilestone, position: number): TablesInsert<'gc_schedule_milestones'> {
  return { ...(UUID.test(m.id) ? { id: m.id } : {}), project_id: projectId, label: m.label.trim(), planned: m.planned, package_id: m.packageId, met_on: m.metOn, position }
}

/** Our superintendent's check of a trade's mark (`verifyLookAhead`): the day, and the correction when there is one. */
export function verifiedMarkOf(mark: LookAheadMark, by: string): TablesUpdate<'gc_schedule_lookahead_marks'> {
  return { verified_on: mark.verifiedOn, verified_done: mark.verifiedDone ?? null, verified_reason: mark.verifiedReason ?? null, verified_by: mark.verifiedOn ? by : null }
}

/** Our own crew's mark (`crewMarkLookAhead`): ours, so it counts as checked the day it is made. It takes the place of any mark that week. */
export function crewMarkRowOf(mark: LookAheadMark, by: string): TablesInsert<'gc_schedule_lookahead_marks'> {
  return {
    activity_id: mark.lineId,
    week_of: mark.weekOf,
    done: mark.done,
    reason: mark.reason ?? null,
    marked_on: mark.markedOn,
    marked_by: by,
    marked_by_company_id: null,
    verified_on: mark.verifiedOn,
    verified_done: null,
    verified_reason: null,
    verified_by: mark.verifiedOn ? by : null,
  }
}

/** A wait's next step (`setScheduleWaitStep`). */
export type WaitStep = 'asked' | 'shipped' | 'done' | 'expected'

/** A wait's step as its row's change: asked, shipped (a delivery), in, or a new expected day with what holds it. */
export function waitStepOf(step: WaitStep, on: string, note?: string): TablesUpdate<'gc_schedule_waits'> {
  if (step === 'asked') return { asked_on: on }
  if (step === 'shipped') return { shipped_on: on }
  if (step === 'done') return { done_on: on }
  return { expected_on: on, ...(note?.trim() ? { note: note.trim() } : {}) }
}

/** The office's push back on a late notice (G-117): the day as drawn is needed, and why. */
export function pushBackOf(on: string, by: string, note: string): TablesUpdate<'gc_schedule_late_notices'> {
  return { pushed_back_on: on, pushed_back_by: by, pushed_back_note: note.trim() }
}

/** A template (G-44, `templateShape` under its name) as its row. Who saved it is the signed-in person, by the column's default. */
export function templateRowOf(t: Omit<ScheduleTemplate, 'id' | 'by'>): TablesInsert<'gc_schedule_templates'> {
  return {
    name: t.name,
    from_project_id: t.from.projectId || null,
    from_name: t.from.name,
    from_done_pct: t.from.donePct,
    saved_on: t.on,
    lines: t.lines as unknown as Json,
    stages: t.stages as unknown as Json,
    weeks: t.weeks,
    aside_on: t.asideOn ?? null,
  }
}

/** The rough while we bid (G-45) as its row, whole: a redraw takes the place of the one before. */
export function roughRowOf(projectId: string, rough: RoughSchedule, by: string): TablesInsert<'gc_rough_schedules'> {
  const kept = rough.kept
  const template = rough.template && rough.like ? rough.template : null
  return {
    project_id: projectId,
    start: rough.start,
    stage_days: rough.days,
    drawn_on: rough.on,
    drawn_by: by,
    kept_on: kept?.on ?? null,
    kept_weeks: kept?.weeks ?? null,
    kept_finish: kept?.finish ?? null,
    kept_at: kept?.at ?? null,
    template_id: template && UUID.test(template.id) ? template.id : null,
    template_name: template?.name ?? null,
    template_used_on: template?.on ?? null,
    template_lines: template ? (rough.like as unknown as Json) : null,
  }
}

/**
 * The person's own what-if copy (G-81, decision 6) as its row: the copy as the kernel keeps it, the
 * real plan it was made from, and the version that plan had.
 */
export function whatIfRowOf(projectId: string, whatIf: ScheduleWhatIf, userId: string, version: number): TablesInsert<'gc_schedule_what_ifs'> {
  return {
    project_id: projectId,
    user_id: userId,
    made_on: whatIf.on,
    base_version: version,
    base: whatIf.base as unknown as Json,
    copy: whatIf.schedule as unknown as Json,
  }
}
