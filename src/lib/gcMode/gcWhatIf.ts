/**
 * GC mode design spike: a what-if copy of the schedule, the Gantt's G-81
 * (`to-dos/gc-mode/mockups/G-81.md`). G-80 answers "if this one bar slips 5 days". The office's real
 * questions are bigger: what if the roof slips a week and we bring the HVAC crew in early? The copy
 * is the whole schedule, beside the real one and never inside it (`GcProject.whatIf`), to try moves
 * on with Why it moved optional. It is kept as real moves with their reasons, or thrown away.
 * Nothing outside the Schedule tab reads it, so the trades, the customer, Follow up and Needs you
 * never see it.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it. The reducer runs the
 * copy's moves through itself (`inWhatIf`), so this file holds no copy of the move rules.
 */
import type { GcAction, GcProject, GcState, ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason, ScheduleWhatIf, WhatIfBase } from './gcTypes'
import { daysBetween, withBaselineKept } from './gcBuildingSchedule'
import { moveActivityName, moveWhyProblem, scheduleFinish } from './gcScheduleMoves'
import { planBillingShift, shiftWords, type ForecastShift } from './gcBillingForecast'
import { companiesToTell } from './gcTellTrades'
import { weekdayDate } from './gcWords'

/** What a what-if copy takes (G-81): a move, a pull, undo and redo, and days got back (G-82). Everything else records what happened, so it belongs to the real schedule. */
export const WHAT_IF_ACTIONS: GcAction['type'][] = ['setScheduleActivity', 'pullScheduleEarlier', 'undoScheduleMove', 'redoScheduleMove', 'recoverScheduleDays', 'moveActivityPart']

/** The stand-in kept on a move tried with no reason, so the copy's history has it. Keep asks for a real one. */
export const WHAT_IF_NO_WHY: { reason: ScheduleMoveReason; note: string } = { reason: 'other', note: 'No reason yet. Keep asks for one.' }

type Span = { start: string; finish: string }

const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`

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

/** The copy against the real schedule, for the line over the chart and Keep. */
export interface WhatIfDiff {
  /** Moves tried and still standing. */
  moves: number
  /** Of those, tried with no reason yet. */
  noWhy: number
  /** Each bar whose dates differ, with its real dates and the copy's. */
  bars: { lineId: string; real: Span; copy: Span }[]
  finishReal: string
  finishCopy: string
  /** Days the copy's last finish is past the real one's. Negative: sooner. */
  finishDays: number
  /** What the copy does to the bills, the forecast on its dates against the real ones (G-97). */
  billing: ForecastShift[]
  /** The line's sentences, in order. */
  words: string[]
}

export function whatIfDiff(state: GcState, project: GcProject): WhatIfDiff | null {
  const copy = project.whatIf
  const real = project.schedule
  if (!copy || !real) return null
  const tried = whatIfTried(project)
  const realById = new Map(real.activities.map((a) => [a.lineId, a]))
  const bars = copy.schedule.activities.flatMap((c) => {
    const r = realById.get(c.lineId)
    return r && (r.start !== c.start || r.finish !== c.finish) ? [{ lineId: c.lineId, real: { start: r.start, finish: r.finish }, copy: { start: c.start, finish: c.finish } }] : []
  })
  const finishReal = scheduleFinish(real.activities)
  const finishCopy = scheduleFinish(copy.schedule.activities)
  const finishDays = daysBetween(finishReal, finishCopy)
  const billing = bars.length > 0 ? planBillingShift(state, project, { activities: copy.schedule.activities }) : []
  const noWhy = tried.filter((m) => m.noWhy).length
  const words = ['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.']
  if (tried.length === 0 && bars.length === 0) {
    words.push('Move a bar to try something.')
  } else {
    words.push(`${tried.length === 1 ? '1 move' : `${tried.length} moves`} tried.`)
    words.push(bars.length === 0 ? 'No bar differs from the real schedule.' : `${bars.length === 1 ? '1 bar differs' : `${bars.length} bars differ`} from the real schedule.`)
    words.push(finishDays === 0 ? `The job still finishes ${weekdayDate(finishCopy)}, as in the real one.` : `The job finishes ${weekdayDate(finishCopy)}, ${days(Math.abs(finishDays))} ${finishDays > 0 ? 'later' : 'sooner'} than the real one.`)
    const bills = shiftWords(billing, 'will')
    if (bills) words.push(`The bills: ${bills}`)
    if (noWhy > 0) words.push(noWhy === 1 ? '1 move has no reason yet.' : `${noWhy} moves have no reason yet.`)
  }
  return { moves: tried.length, noWhy, bars, finishReal, finishCopy, finishDays, billing, words }
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

/** "2 moves kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told." Null: every kept move's companies were told, or none has any. */
export function whatIfKeptWords(state: GcState, project: GcProject): { words: string; companies: string[] } | null {
  const kept = (project.schedule?.moves ?? []).filter((m) => m.fromWhatIf && !m.undoneOn && !m.toldOn)
  const companies = companiesToTell(state, project, kept).map((c) => c.partner.company)
  if (kept.length === 0 || companies.length === 0) return null
  return { words: `${kept.length === 1 ? '1 move' : `${kept.length} moves`} kept from the what-if. ${andList(companies)} ${companies.length === 1 ? 'has' : 'have'} not been told.`, companies }
}
