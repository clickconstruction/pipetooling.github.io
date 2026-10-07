/**
 * GC mode design spike: pulling work earlier, the Gantt's G-37 (`to-dos/gc-mode/mockups/G-37.md`).
 * A bar only ever moved later: a move pushes what waits on it out, and nothing comes back in. So a
 * trade that finished a week early gave the job nothing. The week sat as spare days nobody saw.
 *
 * One press catches the plan up with the work that finished early and brings in what was waiting
 * right behind it, by the days that work gave back and never more. It is a move like any other: a
 * reason and a sentence, one record, Undo, and Tell the trades. The owner's call: on a press, never
 * by itself, so the reducer never pulls on its own.
 *
 * Its own file, out of the barrel: the reducer, the Schedule tab and the walk read it.
 */
import type { GcProject, GcState, ScheduleActivity } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, lagOf, scheduleItems, type ScheduleItem } from './gcBuildingSchedule'
import { rfiRows } from './gcBuildingRfis'
import { submittalHolding, submittalState } from './gcBuildingSubmittals'
import { moveActivityName, scheduleFinish } from './gcScheduleMoves'
import { notReadyBars, notReadyWords } from './gcNotReady'
import { openLateNotices } from './gcLateNotices'
import { datesAsksOpen } from './gcTellTrades'
import { waitRows } from './gcScheduleWaits'
import { weekdayDate } from './gcWords'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PullBehind, PullFinished, PullLine, PullOffer, PullSpan, PullStay } from '../gc/schedule/pullEarlier'
import { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn } from '../gc/schedule/pullEarlier'
export type { PullBehind, PullFinished, PullLine, PullOffer, PullSpan, PullStay } from '../gc/schedule/pullEarlier'
export { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn, pullCountWords, pullGhosts, pullMove, pullSentences, pullWordsFor } from '../gc/schedule/pullEarlier'

const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`
const activities = (n: number) => (n === 1 ? '1 activity' : `${n} activities`)
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}
/** The activities in an order where each comes after what it waits on. A loop falls back to the drawn order. */
function waitOrder(list: ScheduleActivity[]): ScheduleActivity[] {
  const byId = new Map(list.map((a) => [a.lineId, a]))
  const order: ScheduleActivity[] = []
  const placed = new Set<string>()
  const place = (a: ScheduleActivity, seen: Set<string>) => {
    if (placed.has(a.lineId) || seen.has(a.lineId)) return
    seen.add(a.lineId)
    for (const id of a.after) {
      const before = byId.get(id)
      if (before) place(before, seen)
    }
    placed.add(a.lineId)
    order.push(a)
  }
  for (const a of list) place(a, new Set())
  return order
}
const SUBMITTAL_WITH: Record<ReturnType<typeof submittalState>, string> = { trade: 'with the trade', us: 'with us', architect: 'with the architect', approved: 'approved' }
/** "a, b and c" */
function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
/**
 * What holds each line, in words for a sentence: an open RFI, a submittal not approved, a delivery,
 * a decision, a permit or the utility that is late, and a trade not ready to start (G-77). The same
 * holds the Schedule tab's chart reads (`holdsOf`, then `withNotReady`), worked out here so the
 * reducer reads them too.
 */
export function pullHolds(state: GcState, project: GcProject): Map<string, string> {
  const holds = new Map<string, string>()
  for (const r of rfiRows(state, project)) {
    if (r.state === 'answered') continue
    for (const h of r.holds) holds.set(h.lineId, `${r.label}, which is ${r.state === 'us' ? 'with us' : 'with the architect'}`)
  }
  for (const a of project.schedule?.activities ?? []) {
    const s = submittalHolding(project, a.lineId)
    if (s) holds.set(a.lineId, `submittal ${s.number}, which is ${SUBMITTAL_WITH[submittalState(s)]}`)
  }
  // Where nothing else holds the line: a wait that is late, the way the chart's holds read it (G-73 to G-75).
  for (const r of waitRows(state, project)) {
    if (r.state === 'done' || !r.late) continue
    for (const h of r.holds) if (!holds.has(h.lineId)) holds.set(h.lineId, `${r.wait.title}, expected ${weekdayDate(r.wait.expectedOn)}`)
  }
  // A trade not ready to start (G-77): its papers first, then anything else that holds the line, the way the chart says it.
  for (const bar of notReadyBars(state, project)) {
    const had = holds.get(bar.lineId)
    holds.set(bar.lineId, had ? andList([...bar.gaps.map((g) => g.noun), had]) : notReadyWords(bar.gaps))
  }
  return holds
}
/**
 * The project's one offer (G-37): every activity that finished early, with its plan caught up,
 * and the work right behind it brought in by the days it gave back. One per project, since two
 * early finishes can each be stopped by the other: neither rough-in alone moves the inspection
 * that waits on both. Null: nothing finished early, or the job is not being built.
 *
 * `leaveOut`: the activities the office unticked. They keep their dates, and so does what waits only on them.
 */
export function planPull(state: GcState, project: GcProject, leaveOut: string[] = []): PullOffer | null {
  const schedule = project.schedule
  if (!schedule || project.stage !== 'building') return null
  const today = state.today
  const list = schedule.activities
  const items = new Map<string, ScheduleItem>(scheduleItems(state, project).map((i) => [i.activity.lineId, i]))
  const who = (lineId: string) => {
    const item = items.get(lineId)
    return { name: item?.label ?? moveActivityName(project, lineId), trade: item?.trade ?? '', company: item?.company ?? '' }
  }
  // An early finish a walk already answered with Keep the dates is left out (`ScheduleWalk.keptEarly`).
  const kept = (lineId: string, on: string) => (schedule.walks ?? []).some((w) => (w.keptEarly ?? []).includes(lineId) && w.on >= on)

  const finished: PullFinished[] = []
  for (const a of list) {
    const on = finishedOn(a, items.get(a.lineId)?.actual ?? 0, today)
    if (!on) continue
    const early = daysBetween(on, a.finish)
    if (early < 1 || kept(a.lineId, on)) continue
    finished.push({ lineId: a.lineId, ...who(a.lineId), planned: { start: a.start, finish: a.finish }, to: { start: a.start < on ? a.start : on, finish: on }, finishedOn: on, early })
  }
  if (finished.length === 0) return null

  // The work right behind each early finish, by the days it gave back (`pullBehind`, which G-82 reads too).
  const span = new Map<string, PullSpan>(finished.map((f) => [f.lineId, f.to]))
  const { pulls, stays, lostDays } = pullBehind(state, project, span, leaveOut)
  for (const p of pulls) span.set(p.lineId, p.to)

  const next = list.map((a) => {
    const s = span.get(a.lineId)
    return s ? { ...a, start: s.start, finish: s.finish } : a
  })
  const finishFrom = scheduleFinish(list)
  const finishTo = scheduleFinish(next)
  const finishDays = daysBetween(finishFrom, finishTo)
  const held = stays.filter((s) => s.held)
  const show: PullOffer['show'] = pulls.length > 0 ? 'pull' : held.length > 0 ? 'chase' : 'quiet'
  const most = pulls.reduce((m, p) => Math.max(m, p.days), 0)
  const same = pulls.every((p) => p.days === most)
  const state_ =
    show === 'pull' ? `${activities(pulls.length)} can start ${same ? '' : 'up to '}${days(most)} sooner.` : show === 'chase' ? 'The next work is held, so nothing can start sooner yet.' : 'Nothing can start sooner yet.'
  const finishedWords = finished.map((f) => `${f.name} finished ${weekdayDate(f.finishedOn)}, ${days(f.early)} early.`)
  return {
    finished,
    pulls,
    stays,
    activities: next,
    finishFrom,
    finishTo,
    finishDays,
    lostDays,
    words: {
      finished: finishedWords,
      state: state_,
      detail: show === 'quiet' ? stays.map((s) => s.said) : held.map((s) => s.said),
      finish: finishDays === 0 ? `The job still finishes ${weekdayDate(finishTo)}.` : `The job finishes ${weekdayDate(finishTo)}, ${days(-finishDays)} sooner.`,
      lost: lostDays > 0 ? `${lostDays === 1 ? 'One of those days is' : `${lostDays} of those days are`} gone already. Each day of waiting costs one more.` : null,
    },
    note: finishedWords.join(' '),
    show,
  }
}
/**
 * The work right behind the seeds, brought in by the days they give back and never more, then what
 * is right behind that (G-37's rules, read by G-82's days back too). `seeds`: lines whose dates
 * change first, with their new dates. Each comes in only if it was waiting right behind, has not
 * started, is not held, and never before tomorrow, its Not before day or a wait's day.
 */
export function pullBehind(state: GcState, project: GcProject, seeds: Map<string, PullSpan>, leaveOut: string[] = []): PullBehind {
  const schedule = project.schedule
  if (!schedule) return { pulls: [], stays: [], lostDays: 0 }
  const today = state.today
  const list = schedule.activities
  const byId = new Map(list.map((a) => [a.lineId, a]))
  const items = new Map<string, ScheduleItem>(scheduleItems(state, project).map((i) => [i.activity.lineId, i]))
  const who = (lineId: string) => {
    const item = items.get(lineId)
    return { name: item?.label ?? moveActivityName(project, lineId), trade: item?.trade ?? '', company: item?.company ?? '' }
  }
  // The dates as they would stand: the seeds, then each pull as it is found.
  const span = new Map<string, PullSpan>(seeds)
  const finishOf = (id: string) => span.get(id)?.finish ?? byId.get(id)?.finish ?? today
  const holds = pullHolds(state, project)
  // A trade's own word that it starts later stands until the office answers it: a late notice from its portal (G-117), or another day asked for (G-113).
  const said = new Map<string, string>()
  for (const n of openLateNotices(project)) if (!n.started) said.set(n.lineId, n.day)
  for (const ask of datesAsksOpen(state, project)) if (ask.day && !said.has(ask.move.lineId)) said.set(ask.move.lineId, ask.day)
  const soonest = addDays(today, PULL_SOONEST_DAYS)
  const pulls: PullLine[] = []
  const stays: PullStay[] = []
  let lostDays = 0

  for (const a of waitOrder(list)) {
    if (seeds.has(a.lineId)) continue
    const waits = a.after.filter((id) => byId.has(id))
    // Only the work right after something that finished early or came in.
    if (!waits.some((id) => span.has(id))) continue
    const at = (id: string, finish: string) => dayNumber(finish) + 1 + lagOf(a, id)
    // The day its waits let it start as drawn, and as they would stand.
    const drawn = Math.max(...waits.map((id) => at(id, byId.get(id)?.finish ?? a.start)))
    const now = Math.max(...waits.map((id) => at(id, finishOf(id))))
    const given = drawn - now
    const room = dayNumber(a.start) - drawn
    const item = items.get(a.lineId)
    const actual = item?.actual ?? 0
    const say = (words: (s: string) => string, held = false, left = false) => {
      const w = who(a.lineId)
      stays.push({ lineId: a.lineId, ...w, why: words('It'), said: words(w.name), held, left })
    }
    if (given <= 0) {
      // Bounded by another wait. Worth a word only when it was waiting right behind.
      if (room <= RIGHT_BEHIND_DAYS) {
        const by = waits.reduce((m, id) => (at(id, finishOf(id)) > at(m, finishOf(m)) ? id : m))
        say((s) => `${s} still waits on ${who(by).name}, which finishes ${weekdayDate(finishOf(by))}.`)
      }
      continue
    }
    if (room > RIGHT_BEHIND_DAYS) {
      say((s) => `${s} was drawn with ${days(room)} of room before it.`)
      continue
    }
    if (leaveOut.includes(a.lineId)) {
      say((s) => `${s} is left out. It keeps its dates.`, false, true)
      continue
    }
    if (actual >= 100) {
      say((s) => `${s} is done.`)
      continue
    }
    if (a.actualStart || actual > 0) {
      say((s) => (a.actualStart ? `${s} started ${weekdayDate(a.actualStart)}.` : `${s} is under way.`))
      continue
    }
    const hold = holds.get(a.lineId)
    if (hold) {
      say((s) => `${s} waits on ${hold}.`, true)
      continue
    }
    const word = said.get(a.lineId)
    if (word) {
      const company = item?.company ?? 'Its trade'
      say((s) => `${company} said ${s === 'It' ? 'it' : s} can start ${weekdayDate(word)}.`, true)
      continue
    }
    const fails = a.inspection && !a.inspection.passedOn ? (a.inspection.failed ?? []) : []
    const lastFail = fails[fails.length - 1]
    if (lastFail) {
      say((s) => `The city sees ${s === 'It' ? 'it' : s} again ${weekdayDate(lastFail.reinspectOn)}.`)
      continue
    }
    // Never before tomorrow, its Not before day (G-36), or the day after what it waits on from outside is expected (G-73 to G-75).
    const floors: { on: string; why: (s: string) => string }[] = [{ on: soonest, why: (s) => `Tomorrow is the soonest ${s === 'It' ? 'it' : s} can start.` }]
    if (a.notBefore) {
      const nb = a.notBefore
      floors.push({ on: nb, why: (s) => `${s} cannot start before ${weekdayDate(nb)}.` })
    }
    for (const w of project.waits ?? []) {
      if (!w.doneOn && w.lineIds.includes(a.lineId)) floors.push({ on: addDays(w.expectedOn, 1), why: (s) => `${s} waits on ${w.title}, expected ${weekdayDate(w.expectedOn)}.` })
    }
    const floor = floors.reduce((m, f) => (f.on > m.on ? f : m))
    const want = addDays(a.start, -given)
    const start = want < floor.on ? floor.on : want
    // The days the early finish freed that tomorrow already took.
    if (want < soonest) lostDays = Math.max(lostDays, Math.min(given, daysBetween(want, soonest)))
    if (start >= a.start) {
      say(floor.why)
      continue
    }
    const n = daysBetween(start, a.start)
    const to = { start, finish: addDays(a.finish, -n) }
    span.set(a.lineId, to)
    const w = who(a.lineId)
    pulls.push({ lineId: a.lineId, ...w, from: { start: a.start, finish: a.finish }, to, days: n, limit: want < floor.on ? floor.why('It') : null, said: `${w.name} can start ${weekdayDate(start)}, ${days(n)} sooner.` })
  }

  return { pulls, stays, lostDays }
}
