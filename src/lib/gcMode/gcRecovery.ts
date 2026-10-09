/**
 * GC mode design spike: how to get days back, the Gantt's G-82 (`to-dos/gc-mode/GANTT_PLAN.md`,
 * mock-up `to-dos/gc-mode/mockups/G-82.md`). On a job past its contract, the bars on the red chain
 * that could come in, with the days each would give back:
 *
 * - **Side by side**: the next trade starts before the one ahead of it finishes, a gap below zero
 *   on its wait. Two trades, nothing holding the second, no gap there already (cure or lead time).
 * - **A second crew**: the days left done in two thirds the time. A bar has dates and a percent, no
 *   crew, so this is our rule, said on every offer (`CREW_RULE`).
 *
 * Each offer is the schedule as it would stand, the work right behind brought in by G-37's rules
 * (`pullBehind`), and read on the projected finish, so an offer that only moves the plan while the
 * work's pace sets the finish is not offered. Nothing moves until the office saves one: one move,
 * its reason *Getting days back*, its words, Undo and Redo, Tell the trades.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { recoveryFollowPeople, recoveryOffers } from '../gc/schedule/recovery'

export type { RecoveryOffer, RecoveryWho } from '../gc/schedule/recovery'
export { CREW_MIN_DAYS, CREW_RULE, OVERLAP_DAYS, SECOND_CREW_SHARE, recoveryMove, recoveryNoneWords, sideBySideWords } from '../gc/schedule/recovery'
