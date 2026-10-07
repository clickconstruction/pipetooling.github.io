/**
 * GC mode, the real build, the schedule's PR 1a: a pull when work finishes early, moved word for word
 * from the GC mode prototype (branch spike/gc-mode, `gcPullEarlier.ts`). The offer itself (`planPull`,
 * `pullBehind`, `pullHolds`) reads what holds each bar, from RFIs, submittals, the trades' papers,
 * waits, late notices and open date asks, so it stays in the prototype until the holds reach main
 * (PR 9 of to-dos/gc-mode/SCHEDULE_REAL_BUILD.md). Here: the move a pull makes and its words.
 */
import type { ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './types'
import { weekdayDate } from '../words'

/**
 * A bar that starts within this many days after the work it waits on finishes was waiting right
 * behind it: the weekend of a schedule drawn in weekdays, the way the made-up job was drawn. A
 * drafted schedule has no room at all. Further out, the room was drawn on purpose, and a pull
 * leaves it. My default, the lead's OK 2026-10-06.
 */
export const RIGHT_BEHIND_DAYS = 2

/** The soonest a pulled bar can start, in days from today: tomorrow, since today is too late to tell a trade. */
export const PULL_SOONEST_DAYS = 1

export interface PullSpan {
  start: string
  finish: string
}

/** Work that finished before its planned finish. */
export interface PullFinished {
  lineId: string
  /** The line's own name: "Top out", "Rough-in inspection". */
  name: string
  trade: string
  company: string
  planned: PullSpan
  /** Its plan caught up: the same start (or the finish, if that came first), ending the day it really finished. */
  to: PullSpan
  /** Its recorded finish, an inspection's pass, the day it was marked done, or today for a line reported at 100%. */
  finishedOn: string
  /** Days before its planned finish. */
  early: number
}

/** Work that comes in with the press. */
export interface PullLine {
  lineId: string
  name: string
  trade: string
  company: string
  from: PullSpan
  to: PullSpan
  days: number
  /** What stopped it coming in further, when that was not the work before it: "Tomorrow is the soonest it can start." Null: the work before it set the day. */
  limit: string | null
  /** "Rough-in inspection can start Mon Oct 5, 7 days sooner." */
  said: string
}

/** Work right behind an early finish that keeps its dates, and why. */
export interface PullStay {
  lineId: string
  name: string
  trade: string
  company: string
  /** "It waits on submittal 07 62 00-01, which is with us." */
  why: string
  /** The same, by its name: "Sheet metal and flashing waits on submittal 07 62 00-01, which is with us." */
  said: string
  /** A submittal, an RFI or a late wait holds it: the early days are lost unless someone chases it. */
  held: boolean
  /** The office left it out: the trade cannot start sooner. */
  left: boolean
}

export interface PullOffer {
  finished: PullFinished[]
  pulls: PullLine[]
  stays: PullStay[]
  /** The whole schedule as it would stand: the finished lines caught up, the pulls in. */
  activities: ScheduleActivity[]
  finishFrom: string
  finishTo: string
  /** Days the job's last finish moves. Zero or less: a pull never moves it later. */
  finishDays: number
  /** Days tomorrow already cost: the work could have come in this many more had it been pressed sooner. */
  lostDays: number
  words: {
    /** One sentence per finished line: "Top out finished Fri Oct 2, 7 days early." */
    finished: string[]
    /** "1 activity can start 7 days sooner." · "The next work is held, so nothing can start sooner yet." · "Nothing can start sooner yet." */
    state: string
    /** What holds the next work, by name, and for a quiet offer what it still waits on. */
    detail: string[]
    /** "The job still finishes Tue Dec 8." · "The job finishes Fri Dec 4, 4 days sooner." */
    finish: string
    /** "2 of those days are gone already. Each day of waiting costs one more." Null: none lost. */
    lost: string | null
  }
  /** The explanation the press starts with: the finished sentences. */
  note: string
  /** Something to press, something holding the days to chase, or neither (the walk and the editor still say why). */
  show: 'pull' | 'chase' | 'quiet'
}

const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`

const activities = (n: number) => (n === 1 ? '1 activity' : `${n} activities`)

/** The day an activity finished, when it has: its recorded finish, a pass, the day it was marked done, or today for a line reported at 100%. */
export function finishedOn(a: ScheduleActivity, actual: number, today: string): string | null {
  if (a.actualFinish) return a.actualFinish
  if (a.inspection) return a.inspection.passedOn ?? null
  if (a.added) return a.added.doneOn
  if (actual >= 100) return a.finish < today ? a.finish : today
  return null
}

/** What the work right behind a set of sooner finishes would do: what comes in, what keeps its dates and why. */
export interface PullBehind {
  pulls: PullLine[]
  stays: PullStay[]
  /** Days tomorrow already cost: the work could have come in this many more had it been pressed sooner. */
  lostDays: number
}

/**
 * The move the press saves: the first finished line is the move's own, every other date it changes
 * rides in `pushed` (so Undo and Redo put them all back), and `pull` names the finished lines (so
 * Tell the trades skips them and the history says they finished early).
 */
export function pullMove(schedule: ProjectSchedule, offer: PullOffer, why: { reason: ScheduleMoveReason; note: string; by: string }, today: string): ScheduleMove | null {
  const [first, ...rest] = offer.finished
  if (!first || offer.pulls.length === 0) return null
  return {
    id: `move-${(schedule.moves ?? []).length + 1}`,
    on: today,
    by: why.by,
    lineId: first.lineId,
    from: first.planned,
    to: first.to,
    reason: why.reason,
    note: why.note.trim(),
    pushed: [...rest.map((f) => ({ lineId: f.lineId, from: f.planned, to: f.to })), ...offer.pulls.map((p) => ({ lineId: p.lineId, from: p.from, to: p.to }))],
    finishFrom: offer.finishFrom,
    finishTo: offer.finishTo,
    pull: { finished: offer.finished.map((f) => f.lineId) },
  }
}

/** What the line over the chart and the walk say, in order. A held offer leaves out the finish: nothing moves it. */
export function pullSentences(offer: PullOffer): string[] {
  return [...offer.words.finished, offer.words.state, ...offer.words.detail, ...(offer.show === 'pull' ? [offer.words.finish] : []), ...(offer.words.lost ? [offer.words.lost] : [])]
}

/** "1 activity" or "3 activities": what the press pulls, for its button and the log. */
export function pullCountWords(offer: PullOffer): string {
  return activities(offer.pulls.length)
}

/** The chart's ghosts: each pull's sooner days, and the words its hover card reads. */
export function pullGhosts(offer: PullOffer): Map<string, { start: string; finish: string; words: string }> {
  return new Map(offer.pulls.map((p) => [p.lineId, { start: p.to.start, finish: p.to.finish, words: `${weekdayDate(p.to.start)}, ${days(p.days)} sooner. The work before it finished early.` }]))
}

/** What the offer says about one activity, for the walk's box and the opened activity. Null: nothing. */
export function pullWordsFor(offer: PullOffer, lineId: string): string | null {
  const f = offer.finished.find((x) => x.lineId === lineId)
  if (f) return [`It finished ${weekdayDate(f.finishedOn)}, ${days(f.early)} early.`, offer.words.state, ...offer.words.detail].join(' ')
  const p = offer.pulls.find((x) => x.lineId === lineId)
  if (p) return `It can start ${weekdayDate(p.to.start)}, ${days(p.days)} sooner. The work before it finished early.`
  const s = offer.stays.find((x) => x.lineId === lineId)
  if (s) return `The work before it finished early. ${s.why}`
  return null
}
