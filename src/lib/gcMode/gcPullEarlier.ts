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
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { planPull, pullBehind, pullHolds } from '../gc/schedule/pullEarlier'

export type { PullBehind, PullFinished, PullLine, PullOffer, PullSpan, PullStay } from '../gc/schedule/pullEarlier'
export { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn, pullCountWords, pullGhosts, pullMove, pullSentences, pullWordsFor } from '../gc/schedule/pullEarlier'
