/**
 * The schedule's PR 6a: the mapper. Fair Oaks Shops, Building D from the test state, given one of
 * every record the schedule keeps through the kernels, is written as the tables' rows the way the
 * schedule's PR 5 functions write them, and read back equal, field for field. Then the rows read
 * shuffled, a bar taken away, and the rows laid over the board's own job (the one project mapper).
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { GcProject } from '../types'
import { withNewBaseline } from './baseline'
import { moveRecord, planMove, undoMove } from './moves'
import { daysBetween } from './schedule'
import { scheduleFieldsFromRows, templatesFromRows, withScheduleRows, type ScheduleRows, type ScheduleTemplateRow } from './rows'
import { splitParts } from './splitBars'
import { templateShape } from './templates'
import { initialGcState } from './testState'
import type { ProjectSchedule, ScheduleMove, ScheduleTemplate } from './types'
import { whatIfCopy } from './whatIf'

const ROBERT = 'u-robert'
const NAMES = new Map([[ROBERT, 'Robert']])
const idOf = (name: string | undefined): string | null => (name ? (name === 'Robert' ? ROBERT : `u-${name.toLowerCase()}`) : null)
/** A moment, the n-th, so rows written in one order read back in it. */
const at = (n: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, n)).toISOString()

const s = initialGcState()
const today = s.today

/** Fair Oaks D with one of every record the schedule keeps, made through the kernels where a kernel makes it. */
function enriched(): { project: GcProject; templates: ScheduleTemplate[] } {
  const fo = s.projects.find((p) => p.id === 'fairoaksd')!
  let sch: ProjectSchedule = fo.schedule!
  const job = (schedule: ProjectSchedule): GcProject => ({ ...fo, schedule })
  // Bars still ahead that something waits on; a move past the start of what waits on them pushes it.
  const next = (lineId: string) => sch.activities.filter((b) => b.after.includes(lineId))
  const ahead = sch.activities.filter((a) => !a.inspection && a.start > today && next(a.lineId).length > 0)
  const [first, second, third] = ahead
  const past = (lineId: string, finish: string) => Math.max(...next(lineId).map((b) => daysBetween(finish, b.start))) + 5

  // A move with what it pushed, then a second one undone (G-40).
  const shift = past(first!.lineId, first!.finish)
  const plan = planMove(job(sch), first!.lineId, addDays(first!.start, shift), addDays(first!.finish, shift))!
  const moved = moveRecord(sch, first!.lineId, plan, { reason: 'materials', note: 'The switchgear ships three weeks late.', by: 'Robert' }, today)
  sch = { ...sch, activities: plan.activities, moves: [moved] }
  const plan2 = planMove(job(sch), second!.lineId, addDays(second!.start, 2), addDays(second!.finish, 2))!
  sch = { ...sch, activities: plan2.activities, moves: [moveRecord(sch, second!.lineId, plan2, { reason: 'crew', note: 'The crew is short this week.', by: 'Robert' }, today), ...(sch.moves ?? [])] }
  sch = undoMove(job(sch), sch.moves![0]!.id, 'Robert', today)!
  // The first move told to a company, which asked for another day (G-132, G-113).
  sch = {
    ...sch,
    moves: sch.moves!.map((m) => (m.id === moved.id ? { ...m, toldOn: today, toldTo: ['p-cool'], answers: [{ partnerId: 'p-cool', on: today, ok: false, day: '2026-10-20', note: 'We need the Monday.' }] } : m)),
  }
  // A pull (G-37), days got back side by side (G-82) and a part's own move (G-39), as their kernels record them.
  const pull: ScheduleMove = {
    id: 'move-pull', on: today, by: 'Robert', lineId: third!.lineId, from: { start: third!.start, finish: third!.finish }, to: { start: third!.start, finish: addDays(third!.finish, -2) },
    reason: 'early', note: 'The slab cured two days early.', pushed: [], finishFrom: '2026-12-10', finishTo: '2026-12-08', pull: { finished: [third!.lineId] },
  }
  const recovered: ScheduleMove = {
    id: 'move-recover', on: today, by: 'Robert', lineId: second!.lineId, from: { start: second!.start, finish: second!.finish }, to: { start: addDays(second!.start, -2), finish: addDays(second!.finish, -2) },
    reason: 'recovery', note: 'Start the trim side by side with the paint.', pushed: [], finishFrom: '2026-12-08', finishTo: '2026-12-06',
    recovery: { how: 'side', after: first!.lineId, gapWas: 0, gap: -2 },
  }
  // A line split into parts (G-39), as it stands after its move, with a part's own move.
  const line = sch.activities.find((a) => a.lineId === first!.lineId)!
  const split = splitParts(line, [
    { name: 'First floor', start: line.start, finish: addDays(line.start, 1) },
    { name: 'Second floor', start: addDays(line.start, 2), finish: line.finish },
  ], 30)
  if ('problem' in split) throw new Error(split.problem)
  const partMove: ScheduleMove = {
    id: 'move-part', on: today, by: 'Robert', lineId: first!.lineId, from: { start: first!.start, finish: first!.finish }, to: { start: first!.start, finish: first!.finish },
    reason: 'trade before', note: 'The second floor deck is not poured yet.', pushed: [], finishFrom: '2026-12-06', finishTo: '2026-12-06',
    parts: { id: split.parts[1]!.id, was: split.parts.map((p) => ({ id: p.id, from: p.from, days: p.days })), now: split.parts.map((p, i) => ({ id: p.id, from: p.from + (i === 1 ? 1 : 0), days: p.days })) },
  }
  sch = { ...sch, moves: [partMove, recovered, pull, ...(sch.moves ?? [])] }
  // The bars' own records: parts, limits, a gap, real days and a place; an inspection passed and one failed; the job's own work.
  const [rough, final] = sch.activities.filter((a) => a.inspection)
  sch = {
    ...sch,
    activities: [
      ...sch.activities.map((a) => {
        if (a.lineId === first!.lineId) return { ...a, parts: split.parts.map((p, i) => (i === 0 ? { ...p, actualStart: '2026-07-06' } : p)) }
        if (a.lineId === second!.lineId) return { ...a, notBefore: a.start, mustFinishBy: addDays(a.finish, 5), place: 'Level 2', ...(a.after[0] ? { lag: { [a.after[0]]: 2 } } : {}) }
        if (a.lineId === third!.lineId) return { ...a, actualStart: '2026-09-28', actualFinish: '2026-10-01' }
        if (a.lineId === rough!.lineId) return { ...a, inspection: { ...a.inspection!, passedOn: '2026-09-15', failed: [{ on: '2026-09-08', note: 'Missing nail plates.', packageIds: [a.packageId || fo.packages[0]!.id], reinspectOn: '2026-09-15' }] } }
        if (a.lineId === final!.lineId) return { ...a, inspection: { ...a.inspection!, failed: [{ on: '2026-09-30', note: 'Panel labels missing.', packageIds: [], reinspectOn: '2026-10-06' }] } }
        return a
      }),
      { lineId: 'fairoaksd-own-1', packageId: '', start: '2026-07-01', finish: '2026-07-02', after: [], added: { label: 'Mobilize', who: 'Our own crew', doneOn: '2026-07-02' } },
    ],
  }
  // A new baseline after a signed change order (G-41): the one at Start stays.
  sch = withNewBaseline(sch, 'After change order 1', 'The curb was signed.', 'Robert', today)!
  // Two walks, two late notices (one pushed back, then kept), and the template the draft came from.
  sch = {
    ...sch,
    walks: [
      { id: 'walk-2', on: today, by: 'Robert', kept: [third!.lineId], moveIds: [moved.id], skipped: 1, keptEarly: [third!.lineId] },
      { id: 'walk-1', on: '2026-09-25', by: 'Robert', kept: [first!.lineId], moveIds: [], skipped: 0 },
    ],
    lateNotices: [
      { id: 'late-2', partnerId: 'p-cool', lineId: second!.lineId, on: today, by: 'Dana at Cool Breeze', started: false, was: { start: second!.start, finish: second!.finish }, to: { start: addDays(second!.start, 4), finish: addDays(second!.finish, 4) }, reason: 'materials', note: 'The units ship late.', pushedBack: { on: today, by: 'Robert', note: 'We need the day as drawn.' }, kept: { on: today } },
      { id: 'late-1', partnerId: 'p-cool', lineId: first!.lineId, on: '2026-09-20', by: 'Dana at Cool Breeze', started: true, was: { start: first!.start, finish: first!.finish }, to: { start: first!.start, finish: addDays(first!.finish, 2) }, reason: 'crew', note: 'Two men out sick.' },
    ],
    template: { id: 'tpl-1', name: 'Retail shell', on: '2026-06-20' },
  }
  const project: GcProject = {
    ...fo,
    schedule: sch,
    crewCounts: [
      { packageId: fo.packages[0]!.id, partnerId: 'p-cool', weekOf: '2026-10-05', count: 6, on: today },
      { packageId: fo.packages[0]!.id, partnerId: 'p-cool', weekOf: '2026-10-05', count: 8, on: '2026-09-30' },
    ],
    scheduleSends: [{ id: 'send-1', on: '2026-09-30', by: 'Robert', to: 'Cibolo Creek Partners', subject: 'Your schedule for Fair Oaks Shops, Building D', lines: ['Here is where the job stands.', 'Substantial completion is Fri Dec 11.'] }],
  }
  // The reader's own what-if copy with a move tried in it (G-81), and a rough drawn from the template (G-44, G-45).
  const copy = whatIfCopy(project, 'Robert', today)!
  const tried: ScheduleMove = { ...pull, id: 'move-1', noWhy: true }
  const template: ScheduleTemplate = { id: 'tpl-1', name: 'Retail shell', on: '2026-06-20', by: 'Robert', ...templateShape(s, fo)! }
  return {
    project: {
      ...project,
      whatIf: { ...copy, schedule: { ...copy.schedule, moves: [tried] } },
      rough: { start: '2026-06-15', days: { slab: 6 }, by: 'Robert', on: '2026-05-01', kept: { on: '2026-05-20', weeks: 23, finish: '2026-12-01', at: 'award' }, template: { id: 'tpl-1', name: 'Retail shell', on: '2026-05-01' }, like: template.lines },
    },
    templates: [template],
  }
}

/** The job's schedule fields written as the tables' rows, the way the schedule's PR 5 functions and the plain writes keep them. */
function rowsOf(project: GcProject, version: number): ScheduleRows {
  const sch = project.schedule!
  const bars = sch.activities
  let n = 0
  const moves = sch.moves ?? []
  const baselines = [...(sch.baselines ?? []), ...(sch.baseline ? [sch.baseline] : [])].map((b, i) => ({ b, id: `b-${i}` }))
  const waits = project.waits ?? []
  return {
    schedule: { version, template_id: sch.template?.id ?? null, template_name: sch.template?.name ?? null, template_used_on: sch.template?.on ?? null },
    activities: bars.map((a, i) => ({
      id: a.lineId,
      kind: a.inspection ? 'inspection' : a.added ? 'added' : 'line',
      position: i,
      package_id: a.inspection || a.added ? null : a.packageId,
      start: a.start,
      finish: a.finish,
      not_before: a.notBefore ?? null,
      must_finish_by: a.mustFinishBy ?? null,
      actual_start: a.actualStart ?? null,
      actual_finish: a.actualFinish ?? null,
      place: a.place ?? null,
      label: a.inspection?.label ?? a.added?.label ?? null,
      passed_on: a.inspection?.passedOn ?? null,
      who: a.added?.who ?? null,
      done_on: a.added?.doneOn ?? null,
    })),
    parts: bars.flatMap((a) => (a.parts ?? []).map((p, i) => ({ id: p.id, activity_id: a.lineId, position: i, name: p.name, from_day: p.from, days: p.days, share: String(p.share), pct: p.pct, actual_start: p.actualStart ?? null, actual_finish: p.actualFinish ?? null }))),
    links: bars.flatMap((a) => a.after.map((id) => ({ from_activity_id: id, to_activity_id: a.lineId, gap: a.lag?.[id] ?? 0, created_at: at(n++) }))),
    milestones: sch.milestones.map((m, i) => ({ id: m.id, label: m.label, planned: m.planned, package_id: m.packageId, met_on: m.metOn, position: i })),
    failures: bars.flatMap((a) => (a.inspection?.failed ?? []).map((f) => ({ activity_id: a.lineId, failed_on: f.on, note: f.note, package_ids: f.packageIds, reinspect_on: f.reinspectOn, created_at: at(n++) }))),
    baselines: baselines.map(({ b, id }) => ({ id, name: b.name ?? null, locked_on: b.lockedOn, locked_by: idOf(b.by) ?? ROBERT, why: b.why ?? null, created_at: at(n++) })),
    baselineDates: baselines.flatMap(({ b, id }) => Object.entries(b.activities).map(([activity, d]) => ({ baseline_id: id, activity_id: activity, start: d.start, finish: d.finish }))),
    moves: moves.map((m, i) => ({
      id: m.id,
      activity_id: m.lineId,
      made_on: m.on,
      made_at: at(100 - i),
      made_by_name: m.by,
      from_start: m.from.start,
      from_finish: m.from.finish,
      to_start: m.to.start,
      to_finish: m.to.finish,
      reason: m.reason,
      note: m.note,
      links_changed: Boolean(m.linksChanged),
      finish_from: m.finishFrom,
      finish_to: m.finishTo,
      undone_on: m.undoneOn ?? null,
      undone_by: idOf(m.undoneBy),
      change_order_id: m.changeOrderId ?? null,
      late_notice_id: m.lateNoticeId ?? null,
      pull_finished: m.pull?.finished ?? null,
      recovery_how: m.recovery?.how ?? null,
      recovery_after_activity_id: m.recovery?.after ?? null,
      recovery_gap_was: m.recovery?.gapWas ?? null,
      recovery_gap: m.recovery?.gap ?? null,
      from_what_if_on: m.fromWhatIf ?? null,
      parts: m.parts ?? null,
      schedule_version: version - i,
    })),
    pushes: moves.flatMap((m) => m.pushed.map((p) => ({ move_id: m.id, activity_id: p.lineId, from_start: p.from.start, from_finish: p.from.finish, to_start: p.to.start, to_finish: p.to.finish }))),
    tells: moves.flatMap((m) => (m.toldTo ?? []).map((company) => ({ move_id: m.id, company_id: company, told_on: m.toldOn ?? '', created_at: at(n++) }))),
    answers: moves.flatMap((m) => (m.answers ?? []).map((a) => ({ move_id: m.id, company_id: a.partnerId, answered_on: a.on, ok: a.ok, day: a.day ?? null, note: a.note ?? null, created_at: at(n++) }))),
    walks: [...(sch.walks ?? [])].reverse().map((w) => ({ id: w.id, walked_on: w.on, walked_by: idOf(w.by), kept: w.kept, move_ids: w.moveIds, skipped: w.skipped, kept_early: w.keptEarly ?? [], created_at: at(n++) })),
    marks: sch.lookAhead.map((k) => ({ activity_id: k.lineId, week_of: k.weekOf, done: k.done, reason: k.reason ?? null, marked_on: k.markedOn, verified_on: k.verifiedOn, verified_done: k.verifiedDone ?? null, verified_reason: k.verifiedReason ?? null, created_at: at(n++) })),
    lateNotices: [...(sch.lateNotices ?? [])].reverse().map((l) => ({
      id: l.id, company_id: l.partnerId, activity_id: l.lineId, sent_on: l.on, sent_by: l.by, started: l.started,
      was_start: l.was.start, was_finish: l.was.finish, to_start: l.to.start, to_finish: l.to.finish, reason: l.reason, note: l.note,
      pushed_back_on: l.pushedBack?.on ?? null, pushed_back_by: idOf(l.pushedBack?.by), pushed_back_note: l.pushedBack?.note ?? null, kept_on: l.kept?.on ?? null, created_at: at(n++),
    })),
    waits: waits.map((w) => ({ id: w.id, kind: w.kind, title: w.title, package_id: w.packageId, who: w.who, asked_on: w.askedOn, expected_on: w.expectedOn, shipped_on: w.shippedOn ?? null, done_on: w.doneOn, note: w.note ?? null, created_at: at(n++) })),
    waitHolds: waits.flatMap((w) => w.lineIds.map((id) => ({ wait_id: w.id, activity_id: id }))),
    crewCounts: [...(project.crewCounts ?? [])].reverse().map((c) => ({ package_id: c.packageId, company_id: c.partnerId, week_of: c.weekOf, count: c.count, said_on: c.on, created_at: at(n++) })),
    sends: (project.scheduleSends ?? []).map((x) => ({ id: x.id, sent_on: x.on, sent_by: idOf(x.by), sent_to: x.to, subject: x.subject, lines: x.lines, created_at: at(n++) })),
    whatIf: project.whatIf ? { user_id: idOf(project.whatIf.by) ?? ROBERT, made_on: project.whatIf.on, base: project.whatIf.base, copy: project.whatIf.schedule } : null,
    rough: project.rough
      ? {
          start: project.rough.start, stage_days: project.rough.days, drawn_on: project.rough.on, drawn_by: idOf(project.rough.by),
          kept_on: project.rough.kept?.on ?? null, kept_weeks: project.rough.kept?.weeks ?? null, kept_finish: project.rough.kept?.finish ?? null, kept_at: project.rough.kept?.at ?? null,
          template_id: project.rough.template?.id ?? null, template_name: project.rough.template?.name ?? null, template_used_on: project.rough.template?.on ?? null, template_lines: project.rough.like ?? null,
        }
      : null,
  }
}

function templateRowsOf(templates: ScheduleTemplate[]): ScheduleTemplateRow[] {
  return templates.map((t, i) => ({ id: t.id, name: t.name, from_project_id: t.from.projectId, from_name: t.from.name, from_done_pct: String(t.from.donePct), saved_on: t.on, saved_by: idOf(t.by), lines: t.lines, stages: t.stages, weeks: t.weeks, aside_on: t.asideOn ?? null, created_at: at(200 + i) }))
}

/** What the mapper should read back: the job's schedule fields, a wait's bars in the bars' order (a hold row keeps no order of its own). */
function expectedFields(project: GcProject) {
  const order = new Map(project.schedule!.activities.map((a, i) => [a.lineId, i]))
  return {
    schedule: project.schedule,
    waits: project.waits?.map((w) => ({ ...w, lineIds: [...w.lineIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) })),
    scheduleSends: project.scheduleSends,
    crewCounts: project.crewCounts,
    whatIf: project.whatIf,
    rough: project.rough,
  }
}

describe('the schedule read back from its rows', () => {
  it('reads Fair Oaks D, with one of every record, back equal, field for field', () => {
    const { project } = enriched()
    const sch = project.schedule!
    // The test holds what it means to: every kind of record is there.
    expect([sch.moves?.length, sch.baselines?.length, sch.walks?.length, sch.lateNotices?.length, project.waits?.length, project.crewCounts?.length]).toEqual([5, 1, 2, 2, 3, 2])
    expect(sch.moves?.some((m) => m.undoneOn), 'a move undone').toBe(true)
    expect(sch.moves?.some((m) => m.pushed.length > 0), 'a move that pushed').toBe(true)
    expect(sch.moves?.some((m) => m.answers), 'a move told and answered').toBe(true)
    expect(scheduleFieldsFromRows(rowsOf(project, 12), NAMES)).toEqual(expectedFields(project))
  })

  it('reads the same whatever order the rows come in', () => {
    const { project } = enriched()
    const rows = rowsOf(project, 12)
    const shuffled = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Array.isArray(v) ? [...v].reverse() : v])) as unknown as ScheduleRows
    expect(scheduleFieldsFromRows(shuffled, NAMES)).toEqual(scheduleFieldsFromRows(rows, NAMES))
  })

  it('leaves out what names a bar that is gone, never guessing', () => {
    const { project } = enriched()
    const rows = rowsOf(project, 12)
    const gone = project.schedule!.activities.find((a) => project.schedule!.activities.some((b) => b.after.includes(a.lineId)) && project.schedule!.lookAhead.some((k) => k.lineId === a.lineId))!
    const read = scheduleFieldsFromRows({ ...rows, activities: rows.activities.filter((a) => a.id !== gone.lineId) }, NAMES)
    expect(read.schedule!.activities.some((a) => a.lineId === gone.lineId || a.after.includes(gone.lineId))).toBe(false)
    expect(read.schedule!.lookAhead.some((k) => k.lineId === gone.lineId)).toBe(false)
  })

  it('reads the plan at Start with no one’s name on it, and a name the reader may not see as empty', () => {
    const { project } = enriched()
    const read = scheduleFieldsFromRows(rowsOf(project, 12), new Map())
    expect(read.schedule!.baselines?.[0]?.by).toBeUndefined()
    expect(read.schedule!.baseline?.by).toBeUndefined()
    expect(read.schedule!.walks?.[0]?.by).toBe('')
  })

  it('reads nothing drawn as no schedule, and the templates oldest first', () => {
    const empty: ScheduleRows = { ...rowsOf(enriched().project, 1), schedule: null, waits: [], waitHolds: [], crewCounts: [], sends: [], whatIf: null, rough: null }
    expect(scheduleFieldsFromRows(empty, NAMES)).toEqual({})
    const { templates } = enriched()
    expect(templatesFromRows(templateRowsOf(templates), NAMES)).toEqual(templates)
  })
})

describe('the schedule laid over the board’s own job', () => {
  it('lays the rows over that job, and leaves every other project as the board read it', () => {
    const { project, templates } = enriched()
    // The test state stands in for the board's state (boardStateFromRows): one GcState, each job from the one mapper.
    const board = initialGcState()
    const read = withScheduleRows({ state: board, projectId: 'fairoaksd', rows: rowsOf(project, 12), templates: templateRowsOf(templates), names: NAMES })!
    expect(read.version).toBe(12)
    expect(read.project).toEqual({ ...board.projects.find((p) => p.id === 'fairoaksd'), ...expectedFields(project) })
    expect(read.state.projects.find((p) => p.id === 'fairoaksd')).toBe(read.project)
    for (const p of board.projects.filter((x) => x.id !== 'fairoaksd')) expect(read.state.projects.find((x) => x.id === p.id)).toBe(p)
    expect(read.state.scheduleTemplates).toEqual(templates)
    expect(read.state.partners).toBe(board.partners)
  })

  it('reads a job with nothing drawn as having no schedule, whatever the board held', () => {
    const board = initialGcState()
    const nothing: ScheduleRows = { ...rowsOf(enriched().project, 1), schedule: null, waits: [], waitHolds: [], crewCounts: [], sends: [], whatIf: null, rough: null }
    const read = withScheduleRows({ state: board, projectId: 'fairoaksd', rows: nothing, templates: [], names: NAMES })!
    expect(read.version).toBeNull()
    expect([read.project.schedule, read.project.waits, read.project.scheduleSends, read.project.crewCounts, read.project.whatIf, read.project.rough]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined])
    expect(read.state.scheduleTemplates).toBeUndefined()
  })

  it('reads nothing for a job the board does not have', () => {
    expect(withScheduleRows({ state: initialGcState(), projectId: 'nowhere', rows: rowsOf(enriched().project, 1), templates: [], names: NAMES })).toBeNull()
  })
})
