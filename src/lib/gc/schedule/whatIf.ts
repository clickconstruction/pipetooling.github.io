/**
 * GC mode, the real build, the schedule's PR 1a: what if (G-81), moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcWhatIf.ts`). A copy to try moves on, what was tried, what the
 * real schedule changed under it, and Keep. Three stay in the prototype: `whatIfDiff` reads the
 * billing forecast, `whatIfKeptWords` reads who to tell, and `WHAT_IF_ACTIONS` is the prototype's
 * reducer's list.
 */
import { moveActivityName, moveWhyProblem } from './moves'
import { withBaselineKept } from './schedule'
import type { ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason, ScheduleWhatIf, WhatIfBase } from './types'
import type { GcProject } from '../types'

/** The stand-in kept on a move tried with no reason, so the copy's history has it. Keep asks for a real one. */
export const WHAT_IF_NO_WHY: { reason: ScheduleMoveReason; note: string } = { reason: 'other', note: 'No reason yet. Keep asks for one.' }

type Span = { start: string; finish: string }

/** "a, b and c" */
function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** An activity's own name, without its trade: "TPO membrane". */
function lineName(project: GcProject, lineId: string): string {
  const name = moveActivityName(project, lineId)
  return name.includes(' · ') ? name.slice(name.indexOf(' · ') + 3) : name
}

/** The planned dates and waits a copy compares, as one record. */
function baseOf(a: ScheduleActivity): WhatIfBase {
  // A split line's parts (G-39) are part of its plan: their days from its start.
  return { start: a.start, finish: a.finish, after: a.after, ...(a.lag ? { lag: a.lag } : {}), ...(a.notBefore ? { notBefore: a.notBefore } : {}), ...(a.mustFinishBy ? { mustFinishBy: a.mustFinishBy } : {}), ...(a.parts ? { parts: a.parts.map((p) => ({ id: p.id, from: p.from, days: p.days })) } : {}) }
}

function sameBase(a: WhatIfBase, b: WhatIfBase): boolean {
  const key = (x: WhatIfBase) => JSON.stringify([x.start, x.finish, x.after, x.lag ?? {}, x.notBefore ?? '', x.mustFinishBy ?? '', x.parts ?? []])
  return key(a) === key(b)
}

/** The copy made from the real schedule: the same activities and milestones, a history of its own, never walked. Null: no schedule. */
export function whatIfCopy(project: GcProject, by: string, today: string): ScheduleWhatIf | null {
  const schedule = project.schedule
  if (!schedule) return null
  return { schedule: { ...schedule, moves: [], walks: [] }, base: Object.fromEntries(schedule.activities.map((a) => [a.lineId, baseOf(a)])), on: today, by }
}

/** The project with the copy as its schedule: what the Schedule tab, the chart, the editor and the pull read while the copy is shown. Null: no copy. */
export function whatIfProject(project: GcProject): GcProject | null {
  return project.whatIf ? { ...project, schedule: project.whatIf.schedule } : null
}

/** The copy's standing moves, oldest first: what Keep puts on the real schedule. */
export function whatIfTried(project: GcProject): ScheduleMove[] {
  return [...(project.whatIf?.schedule.moves ?? [])].filter((m) => !m.undoneOn).reverse()
}

/**
 * The real activities whose planned dates or waits changed since the copy was made, or that came or
 * went. Empty: Keep is safe. A trade's report or an actual date is not a change: neither moves a
 * planned date.
 */
export function whatIfBaseChanges(project: GcProject): { lineId: string; name: string }[] {
  const copy = project.whatIf
  const real = project.schedule?.activities ?? []
  if (!copy) return []
  const changed = real.filter((a) => {
    const was = copy.base[a.lineId]
    return !was || !sameBase(was, baseOf(a))
  })
  const gone = Object.keys(copy.base).filter((id) => !real.some((a) => a.lineId === id))
  return [...changed.map((a) => a.lineId), ...gone].map((lineId) => ({ lineId, name: lineName(project, lineId) }))
}

/** "The real schedule changed since this copy was made. TPO membrane moved there. Throw this copy away and make a new one." */
export function whatIfBaseChangedWords(changes: { name: string }[]): string {
  return `The real schedule changed since this copy was made. ${andList(changes.map((c) => c.name))} moved there. Throw this copy away and make a new one.`
}

/** The real dates under each bar the copy moved: the chart's ghosts while the copy is shown. */
export function whatIfGhosts(project: GcProject): Map<string, Span> {
  const real = new Map((project.schedule?.activities ?? []).map((a) => [a.lineId, a]))
  return new Map(
    (project.whatIf?.schedule.activities ?? []).flatMap((c) => {
      const r = real.get(c.lineId)
      return r && (r.start !== c.start || r.finish !== c.finish) ? [[c.lineId, { start: r.start, finish: r.finish }] as [string, Span]] : []
    }),
  )
}

/**
 * Keep (G-81): the real schedule with the copy's standing moves on it, oldest first, each a real
 * move with its reason, by the person who kept it, today, marked as tried in a what-if first. The
 * real activities take the copy's planned dates and waits; their actual dates and the rest stay.
 * Refused while a move has no reason, or when the real schedule moved since the copy was made:
 * replaying on top would overwrite a move someone else made and explained.
 */
export function keepWhatIf(project: GcProject, whys: Record<string, { reason: ScheduleMoveReason; note: string }>, by: string, today: string): { schedule: ProjectSchedule; kept: ScheduleMove[] } | { problem: string } {
  const copy = project.whatIf
  const real = project.schedule
  if (!copy || !real) return { problem: 'There is no what-if open.' }
  const changes = whatIfBaseChanges(project)
  if (changes.length > 0) return { problem: whatIfBaseChangedWords(changes) }
  const tried = whatIfTried(project)
  if (tried.length === 0) return { problem: 'Nothing was tried in the what-if.' }
  const kept: ScheduleMove[] = []
  for (const [i, m] of tried.entries()) {
    const why = whys[m.id] ?? (m.noWhy ? null : { reason: m.reason, note: m.note })
    if (!why || moveWhyProblem(why.reason, why.note)) return { problem: 'Give each move a reason and a sentence.' }
    // A copy's move is never told, answered or undone; the stand-in goes with the reason.
    const { noWhy: _noWhy, toldOn: _told, toldTo: _to, answers: _answers, undoneOn: _undone, undoneBy: _by, ...rest } = m
    kept.push({ ...rest, id: `move-${(real.moves ?? []).length + i + 1}`, on: today, by, reason: why.reason, note: why.note.trim(), fromWhatIf: copy.on })
  }
  const copyById = new Map(copy.schedule.activities.map((a) => [a.lineId, a]))
  const activities = real.activities.map((a) => {
    const c = copyById.get(a.lineId)
    if (!c || sameBase(baseOf(a), baseOf(c))) return a
    // The limits are set or dropped, never left as undefined keys (exactOptionalPropertyTypes).
    const { lag: _lag, notBefore: _nb, mustFinishBy: _mf, ...rest } = a
    // A split line's parts take the copy's days, and keep the real percents and real days (G-39).
    const days = new Map((c.parts ?? []).map((p) => [p.id, p]))
    const parts = a.parts ? { parts: a.parts.map((p) => ({ ...p, from: days.get(p.id)?.from ?? p.from, days: days.get(p.id)?.days ?? p.days })) } : {}
    return { ...rest, start: c.start, finish: c.finish, after: c.after, ...(c.lag ? { lag: c.lag } : {}), ...(c.notBefore ? { notBefore: c.notBefore } : {}), ...(c.mustFinishBy ? { mustFinishBy: c.mustFinishBy } : {}), ...parts }
  })
  const base = withBaselineKept(project, real)
  // Moves are kept newest first, so the copy's newest is the real schedule's newest and Undo takes it first.
  return { schedule: { ...base, activities, moves: [...[...kept].reverse(), ...(real.moves ?? [])] }, kept }
}
