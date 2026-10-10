/**
 * GC mode, the real build, the schedule's PR 6a: the mapper (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on
 * branch spike/gc-mode, "A mapper builds it from the rows"; the plan is mockups/schedule-pr6.md). The
 * rows one job's schedule is kept in (the schedule's PRs 2 to 4) read back as the shapes the kernels
 * read, so no kernel changes when the data becomes real. A bar's `lineId` is its row's id: a line's bar
 * takes its scope line's id (the schedule's PR 5, call 6). Who did something is kept as a user id and
 * read back as the name the kernels show. The job itself is the board's (`boardProjectFromView`,
 * `src/lib/gc/boardRows.ts`): the one project mapper. The schedule lays its own fields over it and never
 * builds a project of its own. Nothing here reads the database: the io passes the rows in
 * (`src/lib/gc/scheduleIo.ts`).
 */
import type { GcProject, GcState } from '../types'
import type {
  ActivityPart,
  CrewCount,
  InspectionFailure,
  LateNotice,
  LookAheadMark,
  LookAheadReason,
  ProjectSchedule,
  RoughSchedule,
  ScheduleActivity,
  ScheduleBaseline,
  ScheduleMilestone,
  ScheduleMove,
  ScheduleMoveReason,
  ScheduleSend,
  ScheduleTemplate,
  ScheduleWait,
  ScheduleWalk,
  ScheduleWhatIf,
  TemplateLine,
  TemplateUse,
  WaitKind,
  WhatIfBase,
} from './types'
import { waitKind } from './waits'

/** The rows one job's schedule is kept in (the generated types, trimmed to what the mapper reads). */
export interface ScheduleRows {
  /** The schedule's own row. Null: nothing drawn yet. */
  schedule: { version: number; template_id: string | null; template_name: string | null; template_used_on: string | null } | null
  activities: {
    id: string
    kind: string
    position: number
    package_id: string | null
    start: string
    finish: string
    not_before: string | null
    must_finish_by: string | null
    actual_start: string | null
    actual_finish: string | null
    place: string | null
    label: string | null
    passed_on: string | null
    who: string | null
    done_on: string | null
  }[]
  parts: { id: string; activity_id: string; position: number; name: string; from_day: number; days: number; share: number | string; pct: number | string; actual_start: string | null; actual_finish: string | null }[]
  links: { from_activity_id: string; to_activity_id: string; gap: number; created_at: string }[]
  milestones: { id: string; label: string; planned: string; package_id: string | null; met_on: string | null; position: number }[]
  failures: { activity_id: string; failed_on: string; note: string; package_ids: string[]; reinspect_on: string; created_at: string }[]
  baselines: { id: string; name: string | null; locked_on: string; locked_by: string | null; why: string | null; created_at: string }[]
  baselineDates: { baseline_id: string; activity_id: string; start: string; finish: string }[]
  moves: {
    id: string
    activity_id: string | null
    made_on: string
    made_at: string
    made_by_name: string
    from_start: string
    from_finish: string
    to_start: string
    to_finish: string
    reason: string
    note: string
    links_changed: boolean
    finish_from: string
    finish_to: string
    undone_on: string | null
    undone_by: string | null
    change_order_id: string | null
    late_notice_id: string | null
    pull_finished: string[] | null
    recovery_how: string | null
    recovery_after_activity_id: string | null
    recovery_gap_was: number | null
    recovery_gap: number | null
    from_what_if_on: string | null
    parts: unknown
    schedule_version: number
  }[]
  pushes: { move_id: string; activity_id: string | null; from_start: string; from_finish: string; to_start: string; to_finish: string }[]
  tells: { move_id: string; company_id: string; told_on: string; created_at: string }[]
  answers: { move_id: string; company_id: string; answered_on: string; ok: boolean; day: string | null; note: string | null; created_at: string }[]
  walks: { id: string; walked_on: string; walked_by: string | null; kept: string[]; move_ids: string[]; skipped: number; kept_early: string[]; created_at: string }[]
  marks: { activity_id: string; week_of: string; done: boolean; reason: string | null; marked_on: string; verified_on: string | null; verified_done: boolean | null; verified_reason: string | null; created_at: string }[]
  lateNotices: {
    id: string
    company_id: string
    activity_id: string
    sent_on: string
    sent_by: string
    started: boolean
    was_start: string
    was_finish: string
    to_start: string
    to_finish: string
    reason: string
    note: string
    pushed_back_on: string | null
    pushed_back_by: string | null
    pushed_back_note: string | null
    kept_on: string | null
    created_at: string
  }[]
  waits: { id: string; kind: string; title: string; package_id: string | null; who: string; asked_on: string | null; expected_on: string; shipped_on: string | null; done_on: string | null; note: string | null; created_at: string }[]
  waitHolds: { wait_id: string; activity_id: string }[]
  crewCounts: { package_id: string; company_id: string; week_of: string; count: number; said_on: string; created_at: string }[]
  sends: { id: string; sent_on: string; sent_by: string | null; sent_to: string; subject: string; lines: string[]; created_at: string }[]
  /** The reader's own what-if copy (decision 6). Null: none open. */
  whatIf: { user_id: string; made_on: string; base: unknown; copy: unknown } | null
  /** The rough schedule while we bid (G-45). Null: none drawn. */
  rough: {
    start: string
    stage_days: unknown
    drawn_on: string
    drawn_by: string | null
    kept_on: string | null
    kept_weeks: number | null
    kept_finish: string | null
    kept_at: string | null
    template_id: string | null
    template_name: string | null
    template_used_on: string | null
    template_lines: unknown
  } | null
}

/** A schedule template's row (G-44), company-wide. */
export interface ScheduleTemplateRow {
  id: string
  name: string
  from_project_id: string | null
  from_name: string
  from_done_pct: number | string
  saved_on: string
  saved_by: string | null
  lines: unknown
  stages: unknown
  weeks: number
  aside_on: string | null
  created_at: string
}

/** The names of the people the rows name, by user id. A name the reader may not see reads as empty. */
export type PeopleNames = ReadonlyMap<string, string>

function nameOf(names: PeopleNames, id: string | null): string {
  return id ? (names.get(id) ?? '') : ''
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v
  return n === null || n === undefined || Number.isNaN(n) ? 0 : n
}

const LOOKAHEAD_REASONS: readonly string[] = ['weather', 'trade before', 'materials', 'crew', 'other']

function lookAheadReason(v: string | null): LookAheadReason | undefined {
  return v !== null && LOOKAHEAD_REASONS.includes(v) ? (v as LookAheadReason) : undefined
}

/** Oldest first, by a moment and then by a tiebreak. */
function byMoment<T>(rows: T[], moment: (r: T) => string, tie: (r: T) => number | string = () => 0): T[] {
  return [...rows].sort((a, b) => {
    const m = moment(a).localeCompare(moment(b))
    if (m !== 0) return m
    const ta = tie(a)
    const tb = tie(b)
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })
}

// ---------------------------------------------------------------------------------------------
// The schedule itself
// ---------------------------------------------------------------------------------------------

/**
 * The bars, in their order, each with what it waits on (its waits' rows oldest first, then by the
 * waited-on bar's place in the order), its gaps, limits, real days, place and parts, and an
 * inspection's passes and failures. A wait on a bar that is not here is left out.
 */
function activitiesOf(rows: ScheduleRows): ScheduleActivity[] {
  const bars = [...rows.activities].sort((a, b) => a.position - b.position)
  const position = new Map(bars.map((a, i) => [a.id, i]))
  const links = byMoment(
    rows.links.filter((l) => position.has(l.from_activity_id) && position.has(l.to_activity_id)),
    (l) => l.created_at,
    (l) => position.get(l.from_activity_id) ?? 0,
  )
  return bars.map((r) => {
    const waits = links.filter((l) => l.to_activity_id === r.id)
    const gaps = waits.filter((l) => l.gap !== 0)
    const parts: ActivityPart[] = [...rows.parts]
      .filter((p) => p.activity_id === r.id)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        name: p.name,
        from: p.from_day,
        days: p.days,
        share: num(p.share),
        pct: num(p.pct),
        ...(p.actual_start ? { actualStart: p.actual_start } : {}),
        ...(p.actual_finish ? { actualFinish: p.actual_finish } : {}),
      }))
    const failed: InspectionFailure[] = byMoment(
      rows.failures.filter((f) => f.activity_id === r.id),
      (f) => f.failed_on,
      (f) => f.created_at,
    ).map((f) => ({ on: f.failed_on, note: f.note, packageIds: f.package_ids, reinspectOn: f.reinspect_on }))
    return {
      lineId: r.id,
      packageId: r.kind === 'line' ? (r.package_id ?? '') : '',
      start: r.start,
      finish: r.finish,
      after: waits.map((l) => l.from_activity_id),
      ...(gaps.length > 0 ? { lag: Object.fromEntries(gaps.map((l) => [l.from_activity_id, l.gap])) } : {}),
      ...(r.not_before ? { notBefore: r.not_before } : {}),
      ...(r.must_finish_by ? { mustFinishBy: r.must_finish_by } : {}),
      ...(r.kind === 'inspection'
        ? { inspection: { label: r.label ?? '', ...(r.passed_on ? { passedOn: r.passed_on } : {}), ...(failed.length > 0 ? { failed } : {}) } }
        : {}),
      ...(r.kind === 'added' ? { added: { label: r.label ?? '', who: r.who ?? '', doneOn: r.done_on } } : {}),
      ...(r.actual_start ? { actualStart: r.actual_start } : {}),
      ...(r.actual_finish ? { actualFinish: r.actual_finish } : {}),
      ...(r.place ? { place: r.place } : {}),
      ...(parts.length > 0 ? { parts } : {}),
    }
  })
}

function milestonesOf(rows: ScheduleRows): ScheduleMilestone[] {
  return [...rows.milestones]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ id: m.id, label: m.label, planned: m.planned, packageId: m.package_id, metOn: m.met_on }))
}

/**
 * The plan measured against (the newest baseline) and the ones it retired, oldest first (G-41). The
 * one kept at Start has no name and no one's name on it: the first change after Start kept it, not a
 * person's press.
 */
function baselinesOf(rows: ScheduleRows, names: PeopleNames): { baseline: ScheduleBaseline | null; baselines: ScheduleBaseline[] } {
  const all = byMoment(rows.baselines, (b) => b.created_at, (b) => (b.name === null ? 0 : 1)).map((b): ScheduleBaseline => {
    const by = b.name === null ? '' : nameOf(names, b.locked_by)
    return {
      lockedOn: b.locked_on,
      activities: Object.fromEntries(rows.baselineDates.filter((d) => d.baseline_id === b.id).map((d) => [d.activity_id, { start: d.start, finish: d.finish }])),
      ...(b.name !== null ? { name: b.name } : {}),
      ...(by ? { by } : {}),
      ...(b.why ? { why: b.why } : {}),
    }
  })
  return { baseline: all[all.length - 1] ?? null, baselines: all.slice(0, -1) }
}

/** A move's own record (ScheduleMove), newest first by the version it made and then its moment. */
function movesOf(rows: ScheduleRows, names: PeopleNames): ScheduleMove[] {
  const position = new Map(rows.activities.map((a) => [a.id, a.position]))
  const at = (id: string | null) => (id ? (position.get(id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER)
  return [...rows.moves]
    .sort((a, b) => b.schedule_version - a.schedule_version || b.made_at.localeCompare(a.made_at))
    .map((m) => {
      const pushed = rows.pushes
        .filter((p) => p.move_id === m.id)
        .sort((a, b) => at(a.activity_id) - at(b.activity_id))
        .map((p) => ({ lineId: p.activity_id ?? '', from: { start: p.from_start, finish: p.from_finish }, to: { start: p.to_start, finish: p.to_finish } }))
      const tells = byMoment(rows.tells.filter((t) => t.move_id === m.id), (t) => t.told_on, (t) => t.created_at)
      const answers = byMoment(rows.answers.filter((a) => a.move_id === m.id), (a) => a.created_at).map((a) => ({
        partnerId: a.company_id,
        on: a.answered_on,
        ok: a.ok,
        ...(a.day ? { day: a.day } : {}),
        ...(a.note ? { note: a.note } : {}),
      }))
      const undoneBy = nameOf(names, m.undone_by)
      return {
        id: m.id,
        on: m.made_on,
        by: m.made_by_name,
        lineId: m.activity_id ?? '',
        from: { start: m.from_start, finish: m.from_finish },
        to: { start: m.to_start, finish: m.to_finish },
        reason: m.reason as ScheduleMoveReason,
        note: m.note,
        ...(m.links_changed ? { linksChanged: true } : {}),
        pushed,
        finishFrom: m.finish_from,
        finishTo: m.finish_to,
        ...(m.undone_on ? { undoneOn: m.undone_on, ...(undoneBy ? { undoneBy } : {}) } : {}),
        ...(tells.length > 0 ? { toldOn: tells[0]?.told_on ?? '', toldTo: tells.map((t) => t.company_id) } : {}),
        ...(answers.length > 0 ? { answers } : {}),
        ...(m.change_order_id ? { changeOrderId: m.change_order_id } : {}),
        ...(m.late_notice_id ? { lateNoticeId: m.late_notice_id } : {}),
        ...(m.pull_finished ? { pull: { finished: m.pull_finished } } : {}),
        ...(m.recovery_how === 'side' || m.recovery_how === 'crew'
          ? {
              recovery: {
                how: m.recovery_how,
                ...(m.recovery_after_activity_id ? { after: m.recovery_after_activity_id, gapWas: m.recovery_gap_was ?? 0, gap: m.recovery_gap ?? 0 } : {}),
              },
            }
          : {}),
        ...(m.from_what_if_on ? { fromWhatIf: m.from_what_if_on } : {}),
        ...(m.parts && typeof m.parts === 'object' ? { parts: m.parts as NonNullable<ScheduleMove['parts']> } : {}),
      }
    })
}

function walksOf(rows: ScheduleRows, names: PeopleNames): ScheduleWalk[] {
  return byMoment(rows.walks, (w) => w.walked_on, (w) => w.created_at)
    .reverse()
    .map((w) => ({
      id: w.id,
      on: w.walked_on,
      by: nameOf(names, w.walked_by),
      kept: w.kept,
      moveIds: w.move_ids,
      skipped: w.skipped,
      ...(w.kept_early.length > 0 ? { keptEarly: w.kept_early } : {}),
    }))
}

/** A week's marks, oldest first, each on a bar still here, with that bar's trade. */
function marksOf(rows: ScheduleRows): LookAheadMark[] {
  const bars = new Map(rows.activities.map((a) => [a.id, a]))
  return byMoment(
    rows.marks.filter((k) => bars.has(k.activity_id)),
    (k) => k.created_at,
    (k) => `${k.week_of}|${String(bars.get(k.activity_id)?.position ?? 0).padStart(6, '0')}`,
  ).map((k) => {
    const reason = lookAheadReason(k.reason)
    const verifiedReason = lookAheadReason(k.verified_reason)
    return {
      weekOf: k.week_of,
      lineId: k.activity_id,
      packageId: bars.get(k.activity_id)?.package_id ?? '',
      done: k.done,
      ...(reason ? { reason } : {}),
      markedOn: k.marked_on,
      verifiedOn: k.verified_on,
      ...(k.verified_done !== null ? { verifiedDone: k.verified_done } : {}),
      ...(verifiedReason ? { verifiedReason } : {}),
    }
  })
}

function lateNoticesOf(rows: ScheduleRows, names: PeopleNames): LateNotice[] {
  return byMoment(rows.lateNotices, (n) => n.created_at, (n) => n.sent_on)
    .reverse()
    .map((n) => ({
      id: n.id,
      partnerId: n.company_id,
      lineId: n.activity_id,
      on: n.sent_on,
      by: n.sent_by,
      started: n.started,
      was: { start: n.was_start, finish: n.was_finish },
      to: { start: n.to_start, finish: n.to_finish },
      reason: lookAheadReason(n.reason) ?? 'other',
      note: n.note,
      ...(n.pushed_back_on ? { pushedBack: { on: n.pushed_back_on, by: nameOf(names, n.pushed_back_by), note: n.pushed_back_note ?? '' } } : {}),
      ...(n.kept_on ? { kept: { on: n.kept_on } } : {}),
    }))
}

/** The job's schedule as the kernels keep it (ProjectSchedule). Null: nothing drawn yet. */
export function scheduleFromRows(rows: ScheduleRows, names: PeopleNames): ProjectSchedule | null {
  const header = rows.schedule
  if (!header) return null
  const { baseline, baselines } = baselinesOf(rows, names)
  const moves = movesOf(rows, names)
  const walks = walksOf(rows, names)
  const lateNotices = lateNoticesOf(rows, names)
  const template: TemplateUse | null = header.template_name && header.template_used_on ? { id: header.template_id ?? '', name: header.template_name, on: header.template_used_on } : null
  return {
    activities: activitiesOf(rows),
    milestones: milestonesOf(rows),
    baseline,
    ...(baselines.length > 0 ? { baselines } : {}),
    lookAhead: marksOf(rows),
    ...(moves.length > 0 ? { moves } : {}),
    ...(walks.length > 0 ? { walks } : {}),
    ...(lateNotices.length > 0 ? { lateNotices } : {}),
    ...(template ? { template } : {}),
  }
}

// ---------------------------------------------------------------------------------------------
// The job's other schedule fields
// ---------------------------------------------------------------------------------------------

/** What the work waits on from outside the trades (G-73 to G-75), oldest first. An empty who reads as the kind's own. */
function waitsOf(rows: ScheduleRows): ScheduleWait[] {
  const position = new Map(rows.activities.map((a) => [a.id, a.position]))
  return byMoment(rows.waits, (w) => w.created_at).map((w) => {
    const kind = w.kind as WaitKind
    return {
      id: w.id,
      kind,
      title: w.title,
      packageId: w.package_id,
      who: w.who.trim() || waitKind(kind).who,
      lineIds: rows.waitHolds
        .filter((h) => h.wait_id === w.id && position.has(h.activity_id))
        .sort((a, b) => (position.get(a.activity_id) ?? 0) - (position.get(b.activity_id) ?? 0))
        .map((h) => h.activity_id),
      askedOn: w.asked_on,
      expectedOn: w.expected_on,
      ...(kind === 'delivery' ? { shippedOn: w.shipped_on } : {}),
      doneOn: w.done_on,
      ...(w.note ? { note: w.note } : {}),
    }
  })
}

/** A trade's own word on its people a day (G-142), newest first: the newest for a trade and week counts. */
function crewCountsOf(rows: ScheduleRows): CrewCount[] {
  return byMoment(rows.crewCounts, (c) => c.said_on, (c) => c.created_at)
    .reverse()
    .map((c) => ({ packageId: c.package_id, partnerId: c.company_id, weekOf: c.week_of, count: c.count, on: c.said_on }))
}

/** The customer's schedule as sent on its own (G-94), oldest first. */
function sendsOf(rows: ScheduleRows, names: PeopleNames): ScheduleSend[] {
  return byMoment(rows.sends, (s) => s.created_at).map((s) => ({ id: s.id, on: s.sent_on, by: nameOf(names, s.sent_by), to: s.sent_to, subject: s.subject, lines: s.lines }))
}

/**
 * The reader's own what-if copy (G-81, decision 6), as the kernel kept it. A place is a fact about
 * the work, so each of the copy's bars reads its place from the real bar.
 */
function whatIfOf(rows: ScheduleRows, names: PeopleNames): ScheduleWhatIf | null {
  const w = rows.whatIf
  if (!w || !w.copy || typeof w.copy !== 'object') return null
  const copy = w.copy as ProjectSchedule
  const places = new Map(rows.activities.map((a) => [a.id, a.place]))
  const activities = (copy.activities ?? []).map((a) => {
    const { place: _place, ...rest } = a
    const real = places.has(a.lineId) ? places.get(a.lineId) : a.place
    return real ? { ...rest, place: real } : rest
  })
  return { schedule: { ...copy, activities }, base: (w.base ?? {}) as Record<string, WhatIfBase>, on: w.made_on, by: nameOf(names, w.user_id) }
}

/** The rough schedule while we bid (G-45). */
function roughOf(rows: ScheduleRows, names: PeopleNames): RoughSchedule | null {
  return roughFromRow(rows.rough, names)
}

/**
 * One `gc_rough_schedules` row as the kernels keep the rough (G-45). Exported for the reads that want the rough alone
 * (the schedule's PR 12b): the keep after the Board's bid presses, and Our number's weeks. Null: none drawn.
 */
export function roughFromRow(r: ScheduleRows['rough'], names: PeopleNames): RoughSchedule | null {
  if (!r) return null
  const days = (r.stage_days && typeof r.stage_days === 'object' ? r.stage_days : {}) as Record<string, number>
  return {
    start: r.start,
    days,
    by: nameOf(names, r.drawn_by),
    on: r.drawn_on,
    ...(r.kept_on && r.kept_weeks !== null && r.kept_finish && (r.kept_at === 'bid' || r.kept_at === 'award')
      ? { kept: { on: r.kept_on, weeks: r.kept_weeks, finish: r.kept_finish, at: r.kept_at } }
      : {}),
    ...(r.template_name && r.template_used_on ? { template: { id: r.template_id ?? '', name: r.template_name, on: r.template_used_on } } : {}),
    ...(Array.isArray(r.template_lines) ? { like: r.template_lines as TemplateLine[] } : {}),
  }
}

/** The job's schedule fields as the kernels keep them on `GcProject`. A field with nothing in it is left unset. */
export function scheduleFieldsFromRows(rows: ScheduleRows, names: PeopleNames): Pick<GcProject, 'schedule' | 'waits' | 'scheduleSends' | 'crewCounts' | 'whatIf' | 'rough'> {
  const schedule = scheduleFromRows(rows, names)
  const waits = waitsOf(rows)
  const sends = sendsOf(rows, names)
  const crewCounts = crewCountsOf(rows)
  const whatIf = whatIfOf(rows, names)
  const rough = roughOf(rows, names)
  return {
    ...(schedule ? { schedule } : {}),
    ...(waits.length > 0 ? { waits } : {}),
    ...(sends.length > 0 ? { scheduleSends: sends } : {}),
    ...(crewCounts.length > 0 ? { crewCounts } : {}),
    ...(whatIf ? { whatIf } : {}),
    ...(rough ? { rough } : {}),
  }
}

/** The company's templates (G-44), oldest first. */
export function templatesFromRows(rows: ScheduleTemplateRow[], names: PeopleNames): ScheduleTemplate[] {
  return byMoment(rows, (t) => t.saved_on, (t) => t.created_at).map((t) => ({
    id: t.id,
    name: t.name,
    from: { projectId: t.from_project_id ?? '', name: t.from_name, donePct: num(t.from_done_pct) },
    on: t.saved_on,
    by: nameOf(names, t.saved_by),
    lines: (Array.isArray(t.lines) ? t.lines : []) as TemplateLine[],
    stages: (Array.isArray(t.stages) ? t.stages : []) as { key: string; days: number }[],
    weeks: t.weeks,
    ...(t.aside_on ? { asideOn: t.aside_on } : {}),
  }))
}

// ---------------------------------------------------------------------------------------------
// The job the kernels read
// ---------------------------------------------------------------------------------------------

/** Everything the schedule's kernels take for one job, and the schedule's version beside it. */
export interface ScheduleRead {
  state: GcState
  project: GcProject
  /** The version every plan write sends back (decision 5). Null: nothing drawn yet. */
  version: number | null
}

/**
 * The board's state (`boardStateFromRows`, B3-b) with one job's schedule laid over it: its schedule
 * fields on that project, which the board drew from the one project mapper, and the company's
 * templates on the state. Every other project, and everything else on the state, stays as the board
 * read it. The version rides beside it. Null: no project with that id on the board.
 */
export function withScheduleRows(input: { state: GcState; projectId: string; rows: ScheduleRows; templates: ScheduleTemplateRow[]; names: PeopleNames }): ScheduleRead | null {
  const board = input.state.projects.find((p) => p.id === input.projectId)
  if (!board) return null
  const { schedule: _schedule, waits: _waits, scheduleSends: _sends, crewCounts: _crew, whatIf: _whatIf, rough: _rough, ...rest } = board
  const project: GcProject = { ...rest, ...scheduleFieldsFromRows(input.rows, input.names) }
  const { scheduleTemplates: _templates, ...state } = input.state
  const templates = templatesFromRows(input.templates, input.names)
  return {
    state: {
      ...state,
      projects: input.state.projects.map((p) => (p.id === project.id ? project : p)),
      ...(templates.length > 0 ? { scheduleTemplates: templates } : {}),
    },
    project,
    version: input.rows.schedule?.version ?? null,
  }
}
