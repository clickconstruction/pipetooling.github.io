/**
 * GC mode, the real build, the schedule's PR 1a: days got back, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcRecovery.ts`). The offers (`recoveryOffers`,
 * `recoveryFollowPeople`) read the holds, the late finish and the follow-up sheet, so they stay in
 * the prototype until those reach main (PR 9 of to-dos/gc-mode/SCHEDULE_REAL_BUILD.md). Here: the
 * rules, the move a recovery makes and its words.
 */
import { scheduleFinish } from './moves'
import type { PullLine, PullSpan, PullStay } from './pullEarlier'
import { projectedFinish } from './schedule'
import type { ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './types'
import type { GcProject, GcState, Partner } from '../types'

/** Days the next trade may start before the one ahead of it finishes, side by side. My default. */
export const OVERLAP_DAYS = 3

/** A second crew does the days left in this share of the time: two thirds, not half, since two crews get in each other's way. My default. */
export const SECOND_CREW_SHARE = 2 / 3

/** A bar with fewer days left than this does not split between two crews. */
export const CREW_MIN_DAYS = 3

/** The crew rule, said on every crew offer so nobody takes it for a fact. */
export const CREW_RULE = 'Our rule: a second crew does the days left in two thirds the time.'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** "3 days before TPO membrane finishes": a side-by-side start, the same words on the offer and in the editor. */
export function sideBySideWords(n: number, work: string): string {
  return `${days(n)} before ${work} finishes`
}

/** Who has to agree to an offer: a company we hire, or our own crew (our call). */
export interface RecoveryWho {
  partner: Partner | null
  company: string
  /** "Andre Wallace", or "Our own crew". */
  name: string
  first: string
  phone: string | null
}

export interface RecoveryOffer {
  /** What the reducer re-plans by: `side:<line>:<wait>` or `crew:<line>`. */
  key: string
  how: 'side' | 'crew'
  /** The bar that changes, and its own name: "Sheet metal and flashing". */
  lineId: string
  name: string
  /** Side by side: the work it now starts beside. */
  after?: string
  afterName?: string
  from: PullSpan
  to: PullSpan
  /** Side by side: its gap on that wait before and after. */
  gapWas?: number
  gap?: number
  /** The work right behind it that comes in, and what keeps its dates and why (G-37's rules). */
  pulls: PullLine[]
  stays: PullStay[]
  /** The whole schedule as it would stand. */
  activities: ScheduleActivity[]
  /** The projected finish before and after. */
  finishFrom: string
  finishTo: string
  daysBack: number
  /** Days still past the contract after it. 0: inside. */
  lateAfter: number
  /** What it saves at the contract's fee a day. Null: no fee typed. */
  saves: number | null
  who: RecoveryWho[]
  words: {
    /** "A second crew on Test and balance." */
    title: string
    /** "It would finish Sat Dec 12, not Sun Dec 13. Our rule: …" */
    detail: string
    /** "Cool Breeze Mechanical has to agree: Andre Wallace." */
    who: string
    /** "1 day back brings the finish to Mon Dec 14, still 3 days past the contract." */
    worth: string
  }
  /** The move's sentence, filled in for the window: the office changes it after the call. */
  note: string
}

/** Why a late job has no offer, in a sentence for the card. */
export function recoveryNoneWords(state: GcState, project: GcProject): string {
  const finish = projectedFinish(project, state.today)
  return finish?.from === 'pace' ? "The work's pace sets the finish, not the plan." : "The work on it is held, started, or one trade's own."
}

/**
 * The move one offer saves: its bar's own dates, the work it pulls in riding in `pushed` (so Undo
 * and Redo put them all back), and `recovery` with the gap it changed (so Undo puts that back too).
 */
export function recoveryMove(schedule: ProjectSchedule, offer: RecoveryOffer, why: { reason: ScheduleMoveReason; note: string; by: string }, today: string): ScheduleMove {
  return {
    id: `move-${(schedule.moves ?? []).length + 1}`,
    on: today,
    by: why.by,
    lineId: offer.lineId,
    from: offer.from,
    to: offer.to,
    reason: why.reason,
    note: why.note.trim(),
    pushed: offer.pulls.map((p) => ({ lineId: p.lineId, from: p.from, to: p.to })),
    finishFrom: scheduleFinish(schedule.activities),
    finishTo: scheduleFinish(offer.activities),
    recovery: { how: offer.how, ...(offer.after !== undefined ? { after: offer.after, gapWas: offer.gapWas ?? 0, gap: offer.gap ?? 0 } : {}) },
  }
}
