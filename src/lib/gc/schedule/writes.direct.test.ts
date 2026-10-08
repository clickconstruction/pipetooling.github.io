/**
 * The schedule's PR 6b: what the writes send. Fair Oaks Shops, Building D from the test state, moved
 * every way the kernels move a bar, gives each move and the bars the kernel left; each must agree the
 * way `gc_schedule_move` holds them to. A first draft gets row keys for its inspections and the job's
 * own work, with every wait pointed at them. The plain writes' rows read back through the mapper as
 * the kernel's records. And every key the schedule's PR 5 functions read is a key sent here.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { GcProject } from '../types'
import { nextOwnId } from './addedActivity'
import { lateNoticeMove } from './lateNotices'
import { moveRecord, planMove, scheduleFinish } from './moves'
import type { PullOffer } from './pullEarlier'
import { pullMove } from './pullEarlier'
import type { RecoveryOffer } from './recovery'
import { recoveryMove } from './recovery'
import { scheduleFieldsFromRows, templatesFromRows, type ScheduleRows } from './rows'
import { daysBetween, pushAfter } from './schedule'
import { scheduleDraft } from './draft'
import { movedParts, splitParts } from './splitBars'
import { templateShape } from './templates'
import { initialGcState } from './testState'
import { withTheirDates } from './theirDates'
import type { ActivityPart, LookAheadMark, ProjectSchedule, RoughSchedule, ScheduleActivity, ScheduleMove, ScheduleWait } from './types'
import { whatIfCopy } from './whatIf'
import {
  UUID,
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
  type RpcBar,
  type RpcMove,
} from './writes'

const ROBERT = '00000000-0000-4000-8000-0000000000aa'
const NAMES = new Map([[ROBERT, 'Robert']])
/** Row keys handed out in order, so a payload reads the same on every run. */
function keys(): () => string {
  let n = 0
  return () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`
}
const at = (n: number) => new Date(Date.UTC(2026, 9, 2, 12, 0, n)).toISOString()

const s = initialGcState()
const today = s.today
const fo = s.projects.find((p) => p.id === 'fairoaksd')!
const sch = fo.schedule!
const job = (schedule: ProjectSchedule): GcProject => ({ ...fo, schedule })
const why = (reason: ScheduleMove['reason'], note = 'The switchgear ships three weeks late.') => ({ reason, note, by: 'Robert' })
const span = (a: { start: string; finish: string }) => ({ start: a.start, finish: a.finish })
/** The bars that wait on a bar. */
const next = (lineId: string, list = sch.activities) => list.filter((b) => b.after.includes(lineId))
/** Bars still ahead that something waits on: a move past them pushes what comes after. */
const ahead = sch.activities.filter((a) => !a.inspection && a.start > today && next(a.lineId).length > 0)
const [first, second, third, fourth] = ahead

/** The schedule's PR 5 "the move and its bars agree", as `gc_schedule_move` checks it before anything changes. */
function agree(move: RpcMove, bars: RpcBar[]): boolean {
  return (
    bars.some((b) => b.id === move.activityId) &&
    bars.every(
      (b) =>
        (b.id === move.activityId && b.start === move.to.start && b.finish === move.to.finish) ||
        move.pushed.some((p) => p.activityId === b.id && p.to.start === b.start && p.to.finish === b.finish),
    ) &&
    move.pushed.every((p) => bars.some((b) => b.id === p.activityId))
  )
}

/** The bars as they stand after a list of bar changes. */
function withBars(list: ScheduleActivity[], changes: Map<string, { start: string; finish: string }>): ScheduleActivity[] {
  return list.map((a) => (changes.has(a.lineId) ? { ...a, ...changes.get(a.lineId)! } : a))
}

/** A pull's offer as `planPull` makes one (it comes to main with the schedule's PR 9): a line finished two days early, the work right behind it in by two. */
function pullOffer(): PullOffer {
  const done = third!
  const to = { start: done.start, finish: addDays(done.finish, -2) }
  const pulls = next(done.lineId).map((b) => ({ lineId: b.lineId, name: b.lineId, trade: '', company: '', from: span(b), to: { start: addDays(b.start, -2), finish: addDays(b.finish, -2) }, days: 2, limit: null, said: '' }))
  const activities = withBars(sch.activities, new Map([[done.lineId, to], ...pulls.map((p) => [p.lineId, p.to] as [string, typeof to])]))
  const words = { finished: [], state: '', detail: [], finish: '', lost: null }
  return {
    finished: [{ lineId: done.lineId, name: done.lineId, trade: '', company: '', planned: span(done), to, finishedOn: to.finish, early: 2 }],
    pulls,
    stays: [],
    activities,
    finishFrom: scheduleFinish(sch.activities),
    finishTo: scheduleFinish(activities),
    finishDays: 0,
    lostDays: 0,
    words,
    note: 'The slab cured two days early.',
    show: 'pull',
  }
}

/** Days got back as `recoveryOffers` makes them (the schedule's PR 9): side by side two days into the work it waits on, or a second crew. */
function recoveryOffer(how: 'side' | 'crew'): RecoveryOffer {
  const bar = fourth!
  const wait = bar.after[0]!
  const to = how === 'side' ? { start: addDays(bar.start, -2), finish: addDays(bar.finish, -2) } : { start: bar.start, finish: addDays(bar.finish, -2) }
  const pulls = next(bar.lineId).map((b) => ({ lineId: b.lineId, name: b.lineId, trade: '', company: '', from: span(b), to: { start: addDays(b.start, -2), finish: addDays(b.finish, -2) }, days: 2, limit: null, said: '' }))
  const moved = withBars(sch.activities, new Map([[bar.lineId, to], ...pulls.map((p) => [p.lineId, p.to] as [string, typeof to])]))
  const activities = how === 'side' ? moved.map((a) => (a.lineId === bar.lineId ? { ...a, lag: { ...(a.lag ?? {}), [wait]: -2 } } : a)) : moved
  return {
    key: `${how}:${bar.lineId}`,
    how,
    lineId: bar.lineId,
    name: bar.lineId,
    ...(how === 'side' ? { after: wait, afterName: wait, gapWas: 0, gap: -2 } : {}),
    from: span(bar),
    to,
    pulls,
    stays: [],
    activities,
    finishFrom: scheduleFinish(sch.activities),
    finishTo: scheduleFinish(activities),
    daysBack: 2,
    lateAfter: 0,
    saves: null,
    who: [],
    words: { title: '', detail: '', who: '', worth: '' },
    note: 'Start the trim side by side with the paint.',
  }
}

/** A line split in two (G-39), as `splitParts` makes it, on a job that has it. */
const line = first!
const split = ((): { parts: ActivityPart[] } => {
  const made = splitParts(line, [
    { name: 'First floor', start: line.start, finish: addDays(line.start, 1) },
    { name: 'Second floor', start: addDays(line.start, 2), finish: line.finish },
  ], 30)
  if ('problem' in made) throw new Error(made.problem)
  return made
})()
const splitJob = job({ ...sch, activities: sch.activities.map((a) => (a.lineId === line.lineId ? { ...a, parts: split.parts } : a)) })
const splitLine = splitJob.schedule!.activities.find((a) => a.lineId === line.lineId)!

/** A part's own move, as the move window makes it: through the line's move when its span changes, then the parts' days. */
function partMove(start: string, finish: string): { project: GcProject; move: ScheduleMove; activities: ScheduleActivity[] } {
  const part = split.parts[1]!
  const moved = movedParts(splitLine, part.id, start, finish)!
  const plan = planMove(splitJob, line.lineId, moved.start, moved.finish, splitLine.after)!
  const offsets = (list: { id: string; from: number; days: number }[]) => list.map((x) => ({ id: x.id, from: x.from, days: x.days }))
  const move = { ...moveRecord(splitJob.schedule!, line.lineId, plan, why('trade before', 'The second floor deck is not poured yet.'), today), parts: { id: part.id, was: offsets(split.parts), now: offsets(moved.parts) } }
  return { project: splitJob, move, activities: plan.activities.map((a) => (a.lineId === line.lineId ? { ...a, parts: moved.parts } : a)) }
}

/** Every kind of move the kernels make, each with the job it was made on and the bars it left. */
function everyMove(): { kind: string; project: GcProject; move: ScheduleMove; activities: ScheduleActivity[] }[] {
  const shift = Math.max(...next(first!.lineId).map((b) => daysBetween(first!.finish, b.start))) + 5
  const drag = planMove(fo, first!.lineId, addDays(first!.start, shift), addDays(first!.finish, shift))!
  // The editor: a new gap on its wait, a day it cannot start before and one it must finish by (G-35, G-36); then one taken off.
  const wait = second!.after[0]!
  const set = planMove(fo, second!.lineId, second!.start, second!.finish, second!.after, { notBefore: second!.start, mustFinishBy: addDays(second!.finish, 3), lag: { [wait]: 1 } })!
  const setJob = job({ ...sch, activities: set.activities })
  const dropped = planMove(setJob, second!.lineId, addDays(second!.start, 1), addDays(second!.finish, 1), second!.after, { notBefore: null })!
  const changeOrder = planMove(fo, second!.lineId, second!.start, addDays(second!.finish, 4))!
  // A trade's late notice (G-117), taken.
  const notice = { id: 'late-1', partnerId: 'p-cool', lineId: first!.lineId, on: today, by: 'Dana at Cool Breeze', started: false, was: span(first!), to: { start: addDays(first!.start, 3), finish: addDays(first!.finish, 3) }, reason: 'materials' as const, note: 'The units ship late.' }
  const noticeJob = job({ ...sch, lateNotices: [notice] })
  const taken = lateNoticeMove(s, noticeJob, notice)!
  const late = planMove(noticeJob, taken.lineId, taken.start, taken.finish, taken.after)!
  const pull = pullOffer()
  const side = recoveryOffer('side')
  const crew = recoveryOffer('crew')
  return [
    { kind: 'a drag', project: fo, move: moveRecord(sch, first!.lineId, drag, why('materials'), today), activities: drag.activities },
    { kind: 'the editor', project: fo, move: moveRecord(sch, second!.lineId, set, why('plans', 'The architect moved the curb.'), today), activities: set.activities },
    { kind: 'a limit taken off', project: setJob, move: moveRecord(setJob.schedule!, second!.lineId, dropped, why('crew', 'The crew is short this week.'), today), activities: dropped.activities },
    { kind: 'a change order', project: fo, move: moveRecord(sch, second!.lineId, changeOrder, why('change order', 'Change order 2 adds four days.'), today, '00000000-0000-4000-8000-00000000c002'), activities: changeOrder.activities },
    { kind: 'a late notice', project: noticeJob, move: moveRecord(noticeJob.schedule!, taken.lineId, late, { ...taken.why, by: 'Robert' }, today, undefined, taken.lateNoticeId), activities: late.activities },
    { kind: 'a pull', project: fo, move: pullMove(sch, pull, why('early', pull.note), today)!, activities: pull.activities },
    { kind: 'days got back side by side', project: fo, move: recoveryMove(sch, side, why('recovery', side.note), today), activities: side.activities },
    { kind: 'a second crew', project: fo, move: recoveryMove(sch, crew, why('recovery', 'A second crew on the trim.'), today), activities: crew.activities },
    { kind: 'a part inside its line', ...partMove(addDays(line.start, 1), line.finish) },
    { kind: 'a part past its line', ...partMove(addDays(line.start, 3), addDays(line.finish, 2)) },
  ]
}
const moves = everyMove()

/** Helotes Dental Office's first draft, as the Draw a first draft button draws it. */
const helotes = s.projects.find((p) => p.id === 'helotes')!
const helotesDraft = scheduleDraft(helotes, '2026-10-12')

describe('the bars a press sends', () => {
  it('gives every bar the kernel moved, at its new dates, and nothing else', () => {
    const drag = moves[0]!
    const bars = barsForRpc(sch.activities, drag.activities)
    const moved = [drag.move.lineId, ...drag.move.pushed.map((p) => p.lineId)]
    expect(drag.move.pushed.length).toBeGreaterThan(0)
    expect(bars.map((b) => b.id).sort()).toEqual([...moved].sort())
    for (const b of bars) {
      const a = drag.activities.find((x) => x.lineId === b.id)!
      expect(b).toEqual({ id: a.lineId, start: a.start, finish: a.finish })
    }
  })

  it('sends a limit, a gap or a part’s days only when it changed, and null to take a limit off', () => {
    const [, editor, dropped] = moves
    const second = editor!.move.lineId
    expect(barsForRpc(sch.activities, editor!.activities).find((b) => b.id === second)).toEqual({
      ...span(editor!.activities.find((a) => a.lineId === second)!),
      id: second,
      notBefore: editor!.activities.find((a) => a.lineId === second)!.notBefore,
      mustFinishBy: editor!.activities.find((a) => a.lineId === second)!.mustFinishBy,
      after: editor!.activities.find((a) => a.lineId === second)!.after.map((id, i) => ({ id, gap: i === 0 ? 1 : 0 })),
    })
    const off = barsForRpc(dropped!.project.schedule!.activities, dropped!.activities).find((b) => b.id === second)!
    expect(off.notBefore).toBeNull()
    expect('mustFinishBy' in off || 'after' in off).toBe(false)
    const part = moves.find((m) => m.kind === 'a part inside its line')!
    expect(barsForRpc(part.project.schedule!.activities, part.activities)).toEqual([
      { ...span(splitLine), id: line.lineId, parts: part.move.parts!.now.map((p) => ({ id: p.id, fromDay: p.from, days: p.days })) },
    ])
  })
})

describe('the move a press sends', () => {
  it('agrees with its bars the way gc_schedule_move holds them, on every kind of move', () => {
    for (const m of moves) {
      const rpc = moveForRpc(m.project, m.move)
      const bars = barsForRpc(m.project.schedule!.activities, m.activities)
      expect(agree(rpc, bars), m.kind).toBe(true)
      expect(rpc.pushed.map((p) => p.activityId), m.kind).toEqual(m.move.pushed.map((p) => p.lineId))
    }
  })

  it('carries each kind’s own keys, and the bar’s name that day', () => {
    const by = (kind: string) => {
      const m = moves.find((x) => x.kind === kind)!
      return moveForRpc(m.project, m.move)
    }
    expect(by('a drag')).toMatchObject({ activityName: 'Roofing · Sheet metal and flashing', madeByName: 'Robert', reason: 'materials', linksChanged: false })
    expect(by('the editor').linksChanged).toBe(true)
    expect(by('a change order').changeOrderId).toBe('00000000-0000-4000-8000-00000000c002')
    expect(by('a late notice').lateNoticeId).toBe('late-1')
    expect(by('a pull').pullFinished).toEqual([third!.lineId])
    expect(by('days got back side by side').recovery).toEqual({ how: 'side', afterActivityId: fourth!.after[0], gapWas: 0, gap: -2 })
    expect(by('a second crew').recovery).toEqual({ how: 'crew' })
    expect(by('a part inside its line').parts?.id).toBe(split.parts[1]!.id)
    // A kind's keys ride only on that kind.
    const plain = by('a drag')
    for (const key of ['changeOrderId', 'lateNoticeId', 'pullFinished', 'recovery', 'parts']) expect(key in plain, key).toBe(false)
  })
})

describe('a first draft', () => {
  const draft = draftForRpc(helotesDraft, keys())
  const barKey = (b: (typeof draft.bars)[number]) => b.scopeItemId ?? b.id ?? ''

  it('gives its inspections row keys and points every wait at them', () => {
    const inspections = draft.bars.filter((b) => b.kind === 'inspection')
    expect(inspections.length).toBe(helotesDraft.activities.filter((a) => a.inspection).length)
    for (const b of inspections) expect(UUID.test(b.id ?? ''), b.label).toBe(true)
    const all = new Set(draft.bars.map(barKey))
    for (const b of draft.bars) for (const w of b.after) expect(all.has(w.id), `${barKey(b)} waits on ${w.id}`).toBe(true)
    // The kernel's own ids are gone, and the waits on an inspection name its new key.
    expect(JSON.stringify(draft)).not.toContain('helotes-insp')
    const rough = helotesDraft.activities.find((a) => a.inspection?.label === 'Rough-in inspection')!
    const key = draft.bars[helotesDraft.activities.indexOf(rough)]!.id
    expect(draft.bars.filter((_, i) => helotesDraft.activities[i]!.after.includes(rough.lineId)).every((b) => b.after.some((w) => w.id === key))).toBe(true)
  })

  it('keeps a line by its scope line and trade, and gives every date to meet a row key', () => {
    const lines = draft.bars.filter((b) => b.kind === 'line')
    expect(lines.map((b) => [b.scopeItemId, b.packageId])).toEqual(helotesDraft.activities.filter((a) => !a.inspection && !a.added).map((a) => [a.lineId, a.packageId]))
    expect(draft.milestones.map((m) => m.label)).toEqual(helotesDraft.milestones.map((m) => m.label))
    expect(draft.milestones.every((m) => UUID.test(m.id))).toBe(true)
    expect('template' in draft).toBe(false)
  })

  it('names the template it was drawn from while that template is kept, with its places and parts', () => {
    const shaped = drawnFromTemplate()
    const sent = draftForRpc(shaped, keys())
    expect(sent.template).toEqual({ id: '00000000-0000-4000-8000-0000000007e1' })
    const placed = sent.bars.find((b) => b.place)
    expect(placed?.place).toBe('Roof')
    const parted = sent.bars.find((b) => b.parts)!
    expect(parted.parts!.map((p) => [p.name, p.fromDay, p.days, p.share, p.pct])).toEqual([
      ['First floor', 0, 2, expect.any(Number), 0],
      ['Second floor', 2, expect.any(Number), expect.any(Number), 0],
    ])
    expect(parted.parts!.every((p) => UUID.test(p.id))).toBe(true)
    // A rough's copy of a template that is gone names no template.
    expect('template' in draftForRpc({ ...shaped, template: { id: '', name: 'Retail shell', on: today } }, keys())).toBe(false)
  })
})

/** Fair Oaks D, a place and a split line on it, saved as a template; Boerne Retail Shell, which has both lines, drawn from it. */
function drawnFromTemplate(): ProjectSchedule {
  const placed = job({ ...splitJob.schedule!, activities: splitJob.schedule!.activities.map((a) => (a.lineId === 'fhvac-1' ? { ...a, place: 'Roof' } : a)) })
  const shape = templateShape(s, placed)!
  const boerne = s.projects.find((p) => p.id === 'boerne')!
  return { ...scheduleDraft(boerne, '2026-11-02', undefined, shape.lines), template: { id: '00000000-0000-4000-8000-0000000007e1', name: 'Retail shell', on: today } }
}

/** The job's own work put on the chart, as `addScheduleActivity` puts it: a bar that holds up `first` from now on. */
function ownWork(): { activities: ScheduleActivity[]; kernelId: string } {
  const lineId = nextOwnId(fo)
  const own: ScheduleActivity = { lineId, packageId: '', start: addDays(first!.start, -2), finish: addDays(first!.start, 1), after: [first!.after[0] ?? sch.activities[0]!.lineId], added: { label: 'Mobilize', who: 'Our own crew', doneOn: null } }
  const pushed = pushAfter(fo, [...sch.activities.map((a) => (a.lineId === first!.lineId ? { ...a, after: [...a.after, lineId] } : a)), own], lineId)
  return { activities: pushed.activities, kernelId: lineId }
}

describe('the job’s own work, an inspection failed, and the records', () => {
  it('puts the job’s own work on with a row key, the bars that wait on it naming the key, and what that pushed', () => {
    const { activities, kernelId } = ownWork()
    const made = addedForRpc(sch.activities, activities, keys())!
    expect(UUID.test(made.bar.id)).toBe(true)
    expect(made.bar).toMatchObject({ label: 'Mobilize', who: 'Our own crew', start: addDays(first!.start, -2), finish: addDays(first!.start, 1) })
    expect(made.holdsUp).toEqual([first!.lineId])
    const holds = made.bars.find((b) => b.id === first!.lineId)!
    expect(holds.after?.map((w) => w.id)).toContain(made.bar.id)
    expect(holds.start > first!.start).toBe(true)
    expect(JSON.stringify(made)).not.toContain(kernelId)
    expect(addedForRpc(sch.activities, sch.activities, keys())).toBeNull()
  })

  it('moves a failed inspection to its re-inspection day with its days kept, as the function checks', () => {
    const insp = sch.activities.find((a) => a.lineId === 'fairoaksd-insp-roughin')!
    // Looked at again the day the work after it was to start: that work moves out.
    const failure = { on: today, note: 'Missing nail plates.', packageIds: ['fsteel'], reinspectOn: next(insp.lineId)[0]!.start }
    const days = daysBetween(insp.start, insp.finish)
    const again = { ...insp, start: failure.reinspectOn, finish: addDays(failure.reinspectOn, days), inspection: { ...insp.inspection!, failed: [failure] } }
    const pushed = pushAfter(fo, sch.activities.map((a) => (a.lineId === insp.lineId ? again : a)), insp.lineId)
    const bars = barsForRpc(sch.activities, pushed.activities)
    expect(bars.find((b) => b.id === insp.lineId)).toEqual({ id: insp.lineId, start: failure.reinspectOn, finish: addDays(failure.reinspectOn, days) })
    // The inspection and what it pushed, nothing else.
    expect(pushed.moved.length).toBeGreaterThan(0)
    expect(bars.map((b) => b.id).sort()).toEqual([insp.lineId, ...pushed.moved.map((m) => m.lineId)].sort())
    expect(failureForRpc(failure)).toEqual({ note: 'Missing nail plates.', packageIds: ['fsteel'], reinspectOn: failure.reinspectOn })
  })

  it('sends a split’s parts with row keys, places by bar, their dates and a wait as the functions read them', () => {
    const parts = partsForRpc(split.parts, keys())
    expect(parts.map((p) => [p.id, p.name, p.fromDay, p.days, p.share, p.pct])).toEqual(split.parts.map((p, i) => [`00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, p.name, p.from, p.days, p.share, p.pct]))
    expect(placesForRpc([{ lineId: first!.lineId, place: 'Roof' }, { lineId: second!.lineId, place: null }])).toEqual({ [first!.lineId]: 'Roof', [second!.lineId]: null })
    const dates = [
      { name: 'Substantial completion', on: '2026-12-18', ours: 'fo-substantial' },
      { name: ' Owner move-in ', on: '2027-01-08', ours: null },
    ]
    const milestones = withTheirDates(fo, dates)!
    expect(theirDatesForRpc(dates, milestones)).toEqual([
      { id: 'fo-substantial', label: 'Substantial completion', planned: milestones.find((m) => m.id === 'fo-substantial')!.planned },
      { label: 'Owner move-in', planned: '2027-01-08' },
    ])
    const wait: ScheduleWait = { ...fo.waits![0]!, who: '  Carrier  ', note: '  ' }
    expect(waitForRpc(wait, keys())).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'delivery',
      title: 'Rooftop units',
      packageId: 'fhvac',
      who: 'Carrier',
      askedOn: '2026-09-01',
      expectedOn: '2026-10-20',
      note: null,
      activityIds: ['fhvac-1'],
    })
  })
})

/** Fair Oaks D's rows, the plan and nothing else yet, the way the tables keep them. */
function baseRows(): ScheduleRows {
  const bars = sch.activities
  return {
    schedule: { version: 4, template_id: null, template_name: null, template_used_on: null },
    activities: bars.map((a, i) => ({
      id: a.lineId,
      kind: a.inspection ? 'inspection' : a.added ? 'added' : 'line',
      position: i,
      package_id: a.inspection || a.added ? null : a.packageId,
      start: a.start,
      finish: a.finish,
      not_before: null,
      must_finish_by: null,
      actual_start: a.actualStart ?? null,
      actual_finish: a.actualFinish ?? null,
      place: null,
      label: a.inspection?.label ?? a.added?.label ?? null,
      passed_on: a.inspection?.passedOn ?? null,
      who: null,
      done_on: null,
    })),
    parts: [],
    links: bars.flatMap((a) => a.after.map((id, i) => ({ from_activity_id: id, to_activity_id: a.lineId, gap: 0, created_at: at(i) }))),
    milestones: sch.milestones.map((m, i) => ({ id: m.id, label: m.label, planned: m.planned, package_id: m.packageId, met_on: m.metOn, position: i })),
    failures: [],
    baselines: [],
    baselineDates: [],
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
  }
}
const readBack = (rows: ScheduleRows) => scheduleFieldsFromRows(rows, NAMES)

describe('the plain writes’ rows read back as the kernel’s records', () => {
  it('keeps a walk', () => {
    const walk = { on: today, kept: [first!.lineId], moveIds: ['00000000-0000-4000-8000-00000000d001'], skipped: 2, keptEarly: [third!.lineId] }
    const r = walkRowOf(fo.id, walk)
    const rows = { ...baseRows(), walks: [{ id: 'w-1', walked_on: r.walked_on, walked_by: ROBERT, kept: r.kept ?? [], move_ids: r.move_ids ?? [], skipped: r.skipped ?? 0, kept_early: r.kept_early ?? [], created_at: at(1) }] }
    expect(readBack(rows).schedule?.walks).toEqual([{ id: 'w-1', by: 'Robert', ...walk }])
    expect(walkRowOf(fo.id, { ...walk, keptEarly: undefined as never }).kept_early).toEqual([])
  })

  it('keeps our crew’s mark, checked the day it is made, and the superintendent’s check of a trade’s mark', () => {
    const plumb = sch.activities.find((a) => a.packageId === 'fplumb')!
    const mark: LookAheadMark = { weekOf: '2026-09-28', lineId: plumb.lineId, packageId: 'fplumb', done: false, reason: 'crew', markedOn: today, verifiedOn: today }
    const r = crewMarkRowOf(mark, ROBERT)
    const row = { activity_id: r.activity_id, week_of: r.week_of, done: r.done, reason: r.reason ?? null, marked_on: r.marked_on, verified_on: r.verified_on ?? null, verified_done: r.verified_done ?? null, verified_reason: r.verified_reason ?? null, created_at: at(2) }
    expect(r).toMatchObject({ marked_by: ROBERT, marked_by_company_id: null, verified_by: ROBERT })
    expect(readBack({ ...baseRows(), marks: [row] }).schedule?.lookAhead).toEqual([mark])
    // A trade's "done" corrected to not done, with why.
    const steel = sch.activities.find((a) => a.packageId === 'fsteel')!
    const theirs = { activity_id: steel.lineId, week_of: '2026-09-28', done: true, reason: null, marked_on: '2026-10-01', verified_on: null, verified_done: null, verified_reason: null, created_at: at(3) }
    const checked: LookAheadMark = { weekOf: '2026-09-28', lineId: steel.lineId, packageId: 'fsteel', done: true, markedOn: '2026-10-01', verifiedOn: today, verifiedDone: false, verifiedReason: 'weather' }
    const v = verifiedMarkOf(checked, ROBERT)
    expect(v.verified_by).toBe(ROBERT)
    const after = { ...theirs, verified_on: v.verified_on ?? null, verified_done: v.verified_done ?? null, verified_reason: v.verified_reason ?? null }
    expect(readBack({ ...baseRows(), marks: [after] }).schedule?.lookAhead).toEqual([checked])
  })

  it('keeps a date to meet set, put last, and a bar’s real days set, cleared or left', () => {
    const m = { id: 'fairoaksd-ms-5-owner-move-in', label: ' Owner move-in ', planned: '2027-01-08', packageId: null, metOn: null }
    const r = milestoneRowOf(fo.id, m, 4)
    expect('id' in r).toBe(false)
    const rows = baseRows()
    const read = readBack({ ...rows, milestones: [...rows.milestones, { id: 'ms-new', label: r.label, planned: r.planned, package_id: r.package_id ?? null, met_on: r.met_on ?? null, position: r.position ?? 0 }] })
    expect(read.schedule?.milestones[(read.schedule?.milestones.length ?? 0) - 1]).toEqual({ ...m, id: 'ms-new', label: 'Owner move-in' })
    expect(milestoneRowOf(fo.id, { ...m, id: '00000000-0000-4000-8000-0000000000f1' }, 0).id).toBe('00000000-0000-4000-8000-0000000000f1')
    expect(actualDatesOf({ actualStart: '2026-09-28' })).toEqual({ actual_start: '2026-09-28' })
    expect(actualDatesOf({ actualFinish: null })).toEqual({ actual_finish: null })
    expect(actualDatesOf({})).toEqual({})
  })

  it('keeps a wait’s steps and the office’s push back on a late notice', () => {
    const w = fo.waits![0]!
    const row = { id: w.id, kind: w.kind, title: w.title, package_id: w.packageId, who: w.who, asked_on: w.askedOn, expected_on: w.expectedOn, shipped_on: null, done_on: null, note: w.note ?? null, created_at: at(4) }
    const step = (change: ReturnType<typeof waitStepOf>) => readBack({ ...baseRows(), waits: [{ ...row, ...change }], waitHolds: w.lineIds.map((id) => ({ wait_id: w.id, activity_id: id })) }).waits?.[0]
    expect(step(waitStepOf('shipped', '2026-10-15'))).toEqual({ ...w, shippedOn: '2026-10-15' })
    expect(step(waitStepOf('done', '2026-10-19'))).toMatchObject({ doneOn: '2026-10-19' })
    expect(step(waitStepOf('expected', '2026-10-27', ' Carrier slipped a week. '))).toMatchObject({ expectedOn: '2026-10-27', note: 'Carrier slipped a week.' })
    expect(waitStepOf('expected', '2026-10-27', '  ')).toEqual({ expected_on: '2026-10-27' })
    const notice = { id: 'late-1', company_id: 'p-cool', activity_id: first!.lineId, sent_on: today, sent_by: 'Dana at Cool Breeze', started: false, was_start: first!.start, was_finish: first!.finish, to_start: addDays(first!.start, 3), to_finish: addDays(first!.finish, 3), reason: 'materials', note: 'The units ship late.', pushed_back_on: null, pushed_back_by: null, pushed_back_note: null, kept_on: null, created_at: at(5) }
    const p = pushBackOf(today, ROBERT, ' We need the day as drawn. ')
    const read = readBack({ ...baseRows(), lateNotices: [{ ...notice, pushed_back_on: p.pushed_back_on ?? null, pushed_back_by: p.pushed_back_by ?? null, pushed_back_note: p.pushed_back_note ?? null }] })
    expect(read.schedule?.lateNotices?.[0]?.pushedBack).toEqual({ on: today, by: 'Robert', note: 'We need the day as drawn.' })
  })

  it('keeps a template, a rough drawn from it, and the person’s own what-if copy', () => {
    const shape = templateShape(s, fo)!
    const t = templateRowOf({ name: 'Retail shell', on: today, ...shape })
    const tid = '00000000-0000-4000-8000-0000000007e1'
    const read = templatesFromRows([{ id: tid, name: t.name, from_project_id: t.from_project_id ?? null, from_name: t.from_name, from_done_pct: t.from_done_pct, saved_on: t.saved_on, saved_by: ROBERT, lines: t.lines, stages: t.stages, weeks: t.weeks, aside_on: t.aside_on ?? null, created_at: at(6) }], NAMES)
    expect(read).toEqual([{ id: tid, name: 'Retail shell', on: today, by: 'Robert', ...shape }])
    const rough: RoughSchedule = { start: '2026-11-02', days: { slab: 6 }, by: 'Robert', on: today, kept: { on: today, weeks: 23, finish: '2027-04-09', at: 'bid' }, template: { id: tid, name: 'Retail shell', on: today }, like: shape.lines }
    const r = roughRowOf(fo.id, rough, ROBERT)
    const rows = { ...baseRows(), rough: { start: r.start, stage_days: r.stage_days, drawn_on: r.drawn_on, drawn_by: r.drawn_by ?? null, kept_on: r.kept_on ?? null, kept_weeks: r.kept_weeks ?? null, kept_finish: r.kept_finish ?? null, kept_at: r.kept_at ?? null, template_id: r.template_id ?? null, template_name: r.template_name ?? null, template_used_on: r.template_used_on ?? null, template_lines: r.template_lines ?? null } }
    expect(readBack(rows).rough).toEqual(rough)
    // A rough on the stage days alone keeps no template.
    expect(roughRowOf(fo.id, { start: '2026-11-02', days: {}, by: 'Robert', on: today }, ROBERT)).toMatchObject({ template_id: null, template_name: null, template_used_on: null, template_lines: null, kept_on: null })
    const copy = whatIfCopy(fo, 'Robert', today)!
    const w = whatIfRowOf(fo.id, copy, ROBERT, 4)
    expect(w).toMatchObject({ user_id: ROBERT, base_version: 4, made_on: today })
    expect(readBack({ ...baseRows(), whatIf: { user_id: w.user_id, made_on: w.made_on, base: w.base, copy: JSON.parse(JSON.stringify(w.copy)) } }).whatIf).toEqual(JSON.parse(JSON.stringify(copy)))
  })
})

// ---------------------------------------------------------------------------------------------
// Every key the functions read is a key sent (the plan's way 1: one contract for the payloads)
// ---------------------------------------------------------------------------------------------

const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_gc_schedule_writes.sql'))
const SQL = file ? readFileSync(join(dir, file), 'utf8') : ''
/** Each function's body, by its name. */
const bodies = new Map([...SQL.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([^)]*\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)].map((m) => [m[1] ?? '', m[2] ?? '']))

/** The keys a function reads from its jsonb: `->> 'k'`, `-> 'k'`, `? 'k'` and each step of `#>> '{a,b}'`. */
function keysRead(body: string): string[] {
  const read = new Set<string>()
  for (const m of body.matchAll(/(?:->>?|\?)\s*'([A-Za-z_]+)'/g)) read.add(m[1] ?? '')
  for (const m of body.matchAll(/#>>\s*'\{([^}]*)\}'/g)) for (const k of (m[1] ?? '').split(',')) if (k.trim()) read.add(k.trim())
  return [...read].sort()
}

/** Every key a payload sends, at any depth. */
function keysSent(v: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) keysSent(x, into)
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) keysSent(x, into.add(k))
  return into
}

describe('every key the schedule’s PR 5 functions read is a key sent', () => {
  const rpcMoves = moves.map((m) => moveForRpc(m.project, m.move))
  const rpcBars = moves.flatMap((m) => barsForRpc(m.project.schedule!.activities, m.activities))
  const { activities: ownBars } = ownWork()
  const added = addedForRpc(sch.activities, ownBars, keys())!
  const drawn = [draftForRpc(helotesDraft, keys()), draftForRpc(drawnFromTemplate(), keys()), draftForRpc(withOwnAndLimits(helotesDraft), keys())]
  const dates = [{ name: 'Substantial completion', on: '2026-12-18', ours: 'fo-substantial' }, { name: 'Owner move-in', on: '2027-01-08', ours: null }]
  /** What each function is sent, through every press that reaches it. */
  const sent: Record<string, unknown[]> = {
    gc_schedule_set_bars: [rpcBars, added.bars],
    gc_schedule_save_move: rpcMoves,
    gc_schedule_put_move: rpcMoves.map((m) => m.parts).filter(Boolean),
    gc_schedule_move: moves.map((m, i) => ({ move: rpcMoves[i], bars: barsForRpc(m.project.schedule!.activities, m.activities) })),
    gc_schedule_draft: drawn,
    gc_schedule_keep_what_if: rpcMoves,
    gc_schedule_split: [partsForRpc(split.parts, keys())],
    gc_schedule_add_activity: [added.bar],
    gc_schedule_fail_inspection: [failureForRpc({ on: today, note: 'Missing nail plates.', packageIds: ['fsteel'], reinspectOn: '2026-10-16' }), rpcBars],
    gc_schedule_their_dates: [theirDatesForRpc(dates, withTheirDates(fo, dates)!)],
    gc_schedule_add_wait: [waitForRpc(fo.waits![0]!, keys())],
  }
  /** Keys a function reads that the server adds itself: Keep stamps each move with its copy's day. */
  const serverAdds: Record<string, string[]> = { gc_schedule_save_move: ['fromWhatIfOn'] }
  /** Functions that read keys from a row of their own, never from a payload. */
  const ownRows = ['gc_schedule_keep_start']

  it('finds the functions', () => {
    expect(bodies.size).toBe(23)
    for (const fn of Object.keys(sent)) expect(bodies.has(fn), fn).toBe(true)
  })

  it('sends each key a function reads, on some press that reaches it', () => {
    for (const [fn, body] of bodies) {
      const read = keysRead(body)
      if (read.length === 0 || ownRows.includes(fn)) continue
      expect(Object.keys(sent), `${fn} reads ${read.join(', ')} and nothing sends it`).toContain(fn)
      const keysOf = keysSent(sent[fn])
      expect(read.filter((k) => !keysOf.has(k) && !(serverAdds[fn] ?? []).includes(k)), fn).toEqual([])
    }
  })
})

/** A draft with the job's own work on it and a bar's limits, the way a file's schedule brings them (G-137). */
function withOwnAndLimits(draft: ProjectSchedule): ProjectSchedule {
  const [a, b] = draft.activities.filter((x) => !x.inspection)
  return {
    ...draft,
    activities: [
      ...draft.activities.map((x) => (x === a ? { ...x, notBefore: x.start, mustFinishBy: addDays(x.finish, 2), lag: x.after[0] ? { [x.after[0]]: 2 } : {} } : x)),
      { lineId: 'helotes-own-1', packageId: '', start: b!.start, finish: b!.start, after: [a!.lineId], added: { label: 'Owner furniture', who: 'The customer', doneOn: null } },
    ],
  }
}
