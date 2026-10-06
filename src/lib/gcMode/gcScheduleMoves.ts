/**
 * GC mode design spike: moving a bar, the Gantt's Phase 2 (`to-dos/gc-mode/GANTT_PLAN.md`). The
 * owner, 2026-10-05: "anyone on our team may move a bar, when a bar is moved an explanation should
 * be given and recorded with that saved somewhere." So a move is planned first (what it pushes,
 * what it does to the finish), saved only with a reason and their own words, kept on the schedule
 * for good, and the last one can be undone.
 *
 * Its own file, out of the barrel: the reducer reads it, and it reads the schedule.
 */
import type { GcProject, ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, pushAfter, scheduleLinesOf, wouldLoop } from './gcBuildingSchedule'
import { shortDate, weekdayDate } from './gcWords'

/** Why a bar moved, in the order offered. The first four are the look-ahead's own reasons. */
export const MOVE_REASONS: { key: ScheduleMoveReason; label: string }[] = [
  { key: 'weather', label: 'Weather' },
  { key: 'trade before', label: 'The trade before' },
  { key: 'materials', label: 'Materials' },
  { key: 'crew', label: 'Crew' },
  { key: 'customer', label: 'The customer' },
  { key: 'plans', label: 'The plans' },
  { key: 'inspection', label: 'An inspection' },
  { key: 'us', label: 'Us' },
  { key: 'change order', label: 'A change order' },
  // A pull's own reason (G-37): the work before finished early.
  { key: 'early', label: 'Finished early' },
  // Days got back on a late job (G-82): side by side, or a second crew.
  { key: 'recovery', label: 'Getting days back' },
  { key: 'other', label: 'Something else' },
]

export function moveReasonLabel(reason: ScheduleMoveReason): string {
  return MOVE_REASONS.find((r) => r.key === reason)?.label ?? reason
}

/** An explanation is their own words, and more than a word: the least we keep. */
export const MOVE_NOTE_MIN = 8

/** What is wrong with an explanation, or null when it can be saved. */
export function moveWhyProblem(reason: ScheduleMoveReason | null, note: string): string | null {
  if (!reason) return 'Pick why it moved.'
  if (note.trim().length < MOVE_NOTE_MIN) return 'Say what happened, in a sentence.'
  return null
}

/** An activity's name: "Roofing · TPO membrane", or an inspection by its own name. */
export function moveActivityName(project: GcProject, lineId: string): string {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  if (!a) return lineId
  if (a.inspection) return a.inspection.label
  if (a.added) return a.added.label
  const pkg = project.packages.find((k) => k.id === a.packageId)
  const label = pkg ? scheduleLinesOf(pkg).find((l) => l.lineId === lineId)?.label : undefined
  return pkg && label ? `${pkg.trade} · ${label}` : lineId
}

/** The job's last finish: the day the schedule ends as drawn. Empty with no activities. */
export function scheduleFinish(activities: ScheduleActivity[]): string {
  return activities.reduce((last, a) => (a.finish > last ? a.finish : last), '')
}

/** "Sep 21 to Oct 9". */
export function spanWords(span: { start: string; finish: string }): string {
  return `${shortDate(span.start)} to ${shortDate(span.finish)}`
}

/** A move looked at before it is saved: what it pushes and what it does to the finish. */
export interface MovePlan {
  /** Why it cannot be saved, or null. */
  problem: string | null
  /** Nothing about the activity changes. */
  same: boolean
  from: { start: string; finish: string }
  to: { start: string; finish: string }
  linksChanged: boolean
  /** The whole schedule's activities as they would stand. */
  activities: ScheduleActivity[]
  pushed: { lineId: string; label: string; from: { start: string; finish: string }; to: { start: string; finish: string }; days: number }[]
  finishFrom: string
  finishTo: string
  /** Days the job's last finish moves. Positive: later. */
  finishDays: number
  /** "3 activities after it move out. The job finishes Mon Dec 14, 6 days later." */
  words: string
  /** Things to know that do not stop the save: a wait that makes a loop, a finish past the day it must finish by. */
  warnings: string[]
}

/** The limits a form can set with a move (G-35, G-36). Null drops a limit; unset leaves it. */
export interface MoveLimits {
  lag?: Record<string, number>
  notBefore?: string | null
  mustFinishBy?: string | null
}

/** One activity given new dates (and, from the form, new waits): what would happen. Nothing is changed. */
export function planMove(project: GcProject, lineId: string, start: string, finish: string, after?: string[], limits?: MoveLimits): MovePlan | null {
  const schedule = project.schedule
  const activity = schedule?.activities.find((a) => a.lineId === lineId)
  if (!schedule || !activity) return null
  const from = { start: activity.start, finish: activity.finish }
  const to = { start, finish }
  const ids = new Set(schedule.activities.map((a) => a.lineId))
  const waits = after ? [...new Set(after)].filter((id) => id !== lineId && ids.has(id)) : activity.after
  const lag = limits?.lag === undefined ? activity.lag : Object.fromEntries(Object.entries(limits.lag).filter(([id, days]) => waits.includes(id) && Number.isFinite(days) && days !== 0))
  const notBefore = limits?.notBefore === undefined ? activity.notBefore : (limits.notBefore ?? undefined)
  const mustFinishBy = limits?.mustFinishBy === undefined ? activity.mustFinishBy : (limits.mustFinishBy ?? undefined)
  const limitsChanged = JSON.stringify(lag ?? {}) !== JSON.stringify(activity.lag ?? {}) || notBefore !== activity.notBefore || mustFinishBy !== activity.mustFinishBy
  const linksChanged = waits.join() !== activity.after.join() || limitsChanged
  const same = from.start === start && from.finish === finish && !linksChanged
  const problem = !start || !finish ? 'It needs a start and a finish.' : finish < start ? 'It has to finish on or after it starts.' : notBefore && start < notBefore ? `It cannot start before ${weekdayDate(notBefore)}.` : null
  const finishFrom = scheduleFinish(schedule.activities)
  const warnings: string[] = []
  for (const id of waits) if (!activity.after.includes(id) && wouldLoop(schedule.activities, lineId, id)) warnings.push(`${moveActivityName(project, id)} already waits on this, so this makes a loop. Neither can start until one wait is taken off.`)
  if (mustFinishBy && finish > mustFinishBy) warnings.push(`It must finish by ${weekdayDate(mustFinishBy)}. This finish is ${daysBetween(mustFinishBy, finish)} ${daysBetween(mustFinishBy, finish) === 1 ? 'day' : 'days'} past it.`)
  if (problem || same) return { problem, same, from, to, linksChanged, activities: schedule.activities, pushed: [], finishFrom, finishTo: finishFrom, finishDays: 0, words: problem ?? '', warnings }
  const { lag: _lag, notBefore: _nb, mustFinishBy: _mf, ...rest } = activity
  const changed: ScheduleActivity = { ...rest, start, finish, after: waits, ...(lag && Object.keys(lag).length > 0 ? { lag } : {}), ...(notBefore ? { notBefore } : {}), ...(mustFinishBy ? { mustFinishBy } : {}) }
  const result = pushAfter(
    project,
    schedule.activities.map((a) => (a.lineId === lineId ? changed : a)),
    lineId,
  )
  const before = new Map(schedule.activities.map((a) => [a.lineId, a]))
  const pushed = result.moved.map((m) => {
    const was = before.get(m.lineId)
    return { lineId: m.lineId, label: m.label, from: { start: was?.start ?? m.start, finish: was?.finish ?? m.finish }, to: { start: m.start, finish: m.finish }, days: m.days }
  })
  const finishTo = scheduleFinish(result.activities)
  const finishDays = daysBetween(finishFrom, finishTo)
  const pushWords = pushed.length === 0 ? 'Nothing after it moves.' : pushed.length === 1 ? `${pushed[0]?.label} moves out ${pushed[0]?.days} ${pushed[0]?.days === 1 ? 'day' : 'days'}.` : `${pushed.length} activities after it move out.`
  const finishWords =
    finishDays === 0
      ? `The job still finishes ${weekdayDate(finishTo)}.`
      : `The job finishes ${weekdayDate(finishTo)}, ${Math.abs(finishDays)} ${Math.abs(finishDays) === 1 ? 'day' : 'days'} ${finishDays > 0 ? 'later' : 'sooner'}.`
  // A bar pushed past the day it must finish by is worth a word too.
  for (const p of pushed) {
    const a = schedule.activities.find((x) => x.lineId === p.lineId)
    if (a?.mustFinishBy && p.to.finish > a.mustFinishBy) warnings.push(`${p.label} must finish by ${weekdayDate(a.mustFinishBy)}; it would finish ${weekdayDate(p.to.finish)}.`)
  }
  return { problem: null, same: false, from, to, linksChanged, activities: result.activities, pushed, finishFrom, finishTo, finishDays, words: `${pushWords} ${finishWords}`, warnings }
}

/** The record of a planned move, as it is kept on the schedule. */
export function moveRecord(schedule: ProjectSchedule, lineId: string, plan: MovePlan, why: { reason: ScheduleMoveReason; note: string; by: string }, today: string, changeOrderId?: string, lateNoticeId?: string): ScheduleMove {
  return {
    id: `move-${(schedule.moves ?? []).length + 1}`,
    on: today,
    by: why.by,
    lineId,
    from: plan.from,
    to: plan.to,
    reason: why.reason,
    note: why.note.trim(),
    ...(plan.linksChanged ? { linksChanged: true } : {}),
    pushed: plan.pushed.map((p) => ({ lineId: p.lineId, from: p.from, to: p.to })),
    finishFrom: plan.finishFrom,
    finishTo: plan.finishTo,
    ...(changeOrderId ? { changeOrderId } : {}),
    ...(lateNoticeId ? { lateNoticeId } : {}),
  }
}

/** A move for the history list: who and when, what moved, and what it did. */
export interface MoveRow {
  move: ScheduleMove
  /** "Fri Oct 2 · Robert" */
  who: string
  /** "Roofing · TPO membrane moved from Sep 21 to Oct 9, to Sep 28 to Oct 16." */
  what: string
  /** "2 after it moved out. The finish moved 3 days later, to Dec 14." Empty: it moved nothing else. */
  effect: string
  reason: string
  undone: string | null
}

export function moveRows(project: GcProject): MoveRow[] {
  return (project.schedule?.moves ?? []).map((move) => {
    const days = daysBetween(move.finishFrom, move.finishTo)
    const moved = move.from.start !== move.to.start || move.from.finish !== move.to.finish
    const name = moveActivityName(project, move.lineId)
    if (move.pull) return withWhatIfWords(pullRow(project, move, name, days))
    if (move.recovery) return withWhatIfWords(recoveryRow(project, move, name, days))
    const what = moved
      ? `${name} moved from ${spanWords(move.from)}, to ${spanWords(move.to)}.${move.linksChanged ? ' What it waits on changed too.' : ''}`
      : `${name}: what it waits on changed.`
    const pushWords = move.pushed.length === 0 ? '' : move.pushed.length === 1 ? `${moveActivityName(project, move.pushed[0]?.lineId ?? '')} moved out with it.` : `${move.pushed.length} after it moved out.`
    const finishWords = days === 0 ? '' : `The finish moved ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days > 0 ? 'later' : 'sooner'}, to ${shortDate(move.finishTo)}.`
    return withWhatIfWords({
      move,
      who: `${weekdayDate(move.on)} · ${move.by}`,
      what,
      effect: [pushWords, finishWords].filter(Boolean).join(' '),
      reason: moveReasonLabel(move.reason),
      undone: move.undoneOn ? `Undone ${shortDate(move.undoneOn)}${move.undoneBy ? ` by ${move.undoneBy}` : ''}.` : null,
    })
  })
}

/** Days got back (G-82): side by side, or a second crew, then what came in behind it. */
function recoveryRow(project: GcProject, move: ScheduleMove, name: string, days: number): MoveRow {
  const r = move.recovery
  const n = -(r?.gap ?? 0)
  const what =
    r?.how === 'side' && r.after
      ? `${name} now starts ${n} ${n === 1 ? 'day' : 'days'} before ${moveActivityName(project, r.after).replace(/^.* · /, '')} finishes, ${spanWords(move.to)}.`
      : `A second crew on ${name}: it finishes ${weekdayDate(move.to.finish)}, not ${weekdayDate(move.from.finish)}.`
  const pullWords = move.pushed.length === 0 ? '' : move.pushed.length === 1 ? `${moveActivityName(project, move.pushed[0]?.lineId ?? '')} came in behind it.` : `${move.pushed.length} after it came in.`
  const finishWords = days === 0 ? '' : `The finish moved ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days > 0 ? 'later' : 'sooner'}, to ${shortDate(move.finishTo)}.`
  return {
    move,
    who: `${weekdayDate(move.on)} · ${move.by}`,
    what,
    effect: [pullWords, finishWords].filter(Boolean).join(' '),
    reason: moveReasonLabel(move.reason),
    undone: move.undoneOn ? `Undone ${shortDate(move.undoneOn)}${move.undoneBy ? ` by ${move.undoneBy}` : ''}.` : null,
  }
}

/** A move tried in a what-if with no reason yet, or kept from one (G-81): its chip, and a word on its row. Any other row as it was. */
function withWhatIfWords(row: MoveRow): MoveRow {
  const m = row.move
  if (!m.noWhy && !m.fromWhatIf) return row
  return {
    ...row,
    ...(m.noWhy ? { reason: 'No reason yet' } : {}),
    ...(m.fromWhatIf ? { effect: [row.effect, 'Tried in a what-if first.'].filter(Boolean).join(' ') } : {}),
  }
}

/** A pull's row (G-37): what finished early, then what came in after it, not out. */
function pullRow(project: GcProject, move: ScheduleMove, name: string, days: number): MoveRow {
  const finished = move.pull?.finished ?? [move.lineId]
  const early = daysBetween(move.to.finish, move.from.finish)
  const others = finished.length - 1
  const pulled = move.pushed.filter((p) => !finished.includes(p.lineId))
  const them = others > 0 ? 'them' : 'it'
  const pullWords = pulled.length === 0 ? '' : pulled.length === 1 ? `${moveActivityName(project, pulled[0]?.lineId ?? '')} was pulled earlier with ${them}.` : `${pulled.length} after ${them} were pulled earlier.`
  const finishWords = days === 0 ? '' : `The finish moved ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days > 0 ? 'later' : 'sooner'}, to ${shortDate(move.finishTo)}.`
  return {
    move,
    who: `${weekdayDate(move.on)} · ${move.by}`,
    what: others > 0 ? `${name} and ${others} more finished early.` : `${name} finished ${weekdayDate(move.to.finish)}, ${early} ${early === 1 ? 'day' : 'days'} early.`,
    effect: [pullWords, finishWords].filter(Boolean).join(' '),
    reason: moveReasonLabel(move.reason),
    undone: move.undoneOn ? `Undone ${shortDate(move.undoneOn)}${move.undoneBy ? ` by ${move.undoneBy}` : ''}.` : null,
  }
}

/**
 * The move that can be undone: the newest one still standing, and only while every activity it
 * touched still sits where the move left it. Anything moved since would be overwritten, so then
 * there is nothing to undo; move it back by hand, with its own explanation.
 */
export function undoableMove(project: GcProject): ScheduleMove | null {
  const schedule = project.schedule
  const move = (schedule?.moves ?? []).find((m) => !m.undoneOn)
  if (!schedule || !move || move.linksChanged) return null
  const now = new Map(schedule.activities.map((a) => [a.lineId, a]))
  const sits = (lineId: string, to: { start: string; finish: string }) => now.get(lineId)?.start === to.start && now.get(lineId)?.finish === to.finish
  return sits(move.lineId, move.to) && move.pushed.every((p) => sits(p.lineId, p.to)) ? move : null
}

/** The schedule with the undoable move put back, the move kept on the record as undone. Null: nothing to undo. */
export function undoMove(project: GcProject, moveId: string, by: string, today: string): ProjectSchedule | null {
  const schedule = project.schedule
  const move = undoableMove(project)
  if (!schedule || !move || move.id !== moveId) return null
  const back = new Map<string, { start: string; finish: string }>([[move.lineId, move.from], ...move.pushed.map((p) => [p.lineId, p.from] as [string, { start: string; finish: string }])])
  return {
    ...schedule,
    // A side-by-side move (G-82) also puts back the gap it changed on its wait.
    activities: schedule.activities.map((a) => withRecoveryGap(back.has(a.lineId) ? { ...a, ...(back.get(a.lineId) as { start: string; finish: string }) } : a, move, 'gapWas')),
    moves: (schedule.moves ?? []).map((m) => (m.id === move.id ? { ...m, undoneOn: today, undoneBy: by } : m)),
  }
}

/** A side-by-side move's line (G-82) with its gap on the wait set to the move's `gapWas` (undo) or `gap` (redo). Any other activity as it is. */
function withRecoveryGap(a: ScheduleActivity, move: ScheduleMove, which: 'gapWas' | 'gap'): ScheduleActivity {
  const r = move.recovery
  if (!r?.after || a.lineId !== move.lineId) return a
  const days = r[which] ?? 0
  const lag = { ...(a.lag ?? {}) }
  if (days === 0) delete lag[r.after]
  else lag[r.after] = days
  const { lag: _was, ...rest } = a
  return Object.keys(lag).length > 0 ? { ...rest, lag } : rest
}

/**
 * The move that can be put back (G-40): the newest undone move, while every activity it touched
 * still sits where the undo left it and no move made after it still stands. Anything moved since
 * would be overwritten, so then there is nothing to redo.
 */
export function redoableMove(project: GcProject): ScheduleMove | null {
  const schedule = project.schedule
  const moves = schedule?.moves ?? []
  const move = moves.find((m) => m.undoneOn)
  if (!schedule || !move) return null
  // A standing move newer than it (the list is newest first) means the schedule went on without it.
  if (moves.slice(0, moves.indexOf(move)).some((m) => !m.undoneOn)) return null
  const now = new Map(schedule.activities.map((a) => [a.lineId, a]))
  const sits = (lineId: string, at: { start: string; finish: string }) => now.get(lineId)?.start === at.start && now.get(lineId)?.finish === at.finish
  return sits(move.lineId, move.from) && move.pushed.every((p) => sits(p.lineId, p.from)) ? move : null
}

/** The schedule with the undone move put back, the move standing again. Null: nothing to redo. */
export function redoMove(project: GcProject, moveId: string): ProjectSchedule | null {
  const schedule = project.schedule
  const move = redoableMove(project)
  if (!schedule || !move || move.id !== moveId) return null
  const forward = new Map<string, { start: string; finish: string }>([[move.lineId, move.to], ...move.pushed.map((p) => [p.lineId, p.to] as [string, { start: string; finish: string }])])
  return {
    ...schedule,
    activities: schedule.activities.map((a) => withRecoveryGap(forward.has(a.lineId) ? { ...a, ...(forward.get(a.lineId) as { start: string; finish: string }) } : a, move, 'gap')),
    moves: (schedule.moves ?? []).map((m) => {
      if (m.id !== move.id) return m
      const { undoneOn: _on, undoneBy: _by, ...stands } = m
      return stands
    }),
  }
}

/** "If it slips 5 days: nothing else moves." · "If it slips 10 days: 2 after it move out. The job finishes Mon Dec 14, 3 days later." */
export function whatIfSlips(project: GcProject, lineId: string, days: number): string | null {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  if (!a) return null
  const plan = planMove(project, lineId, addDays(a.start, days), addDays(a.finish, days))
  if (!plan || plan.problem) return null
  return `If it slips ${days} ${days === 1 ? 'day' : 'days'}: ${plan.pushed.length === 0 && plan.finishDays === 0 ? 'nothing else moves.' : plan.words}`
}
