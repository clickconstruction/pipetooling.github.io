/**
 * GC mode design spike: what the work waits on from outside the trades, the Gantt's Phase 4
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-73 long-lead items, G-74 the customer's decisions, G-75
 * permits and the utility). One record for all four (`ScheduleWait`): who we wait on, the day it
 * is expected, the work that cannot start without it. Each is a row of its own on the chart, and
 * it holds the work it is for when it is expected on or after the day that work starts, or when
 * its day has passed with nothing in. The customer's decisions are what the customer reads under
 * What we need from you.
 *
 * Its own file, out of the barrel: it reads the schedule and the Gantt's hold shape.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { WaitRow, WaitState } from '../gc/schedule/waits'
export { WAIT_KINDS, customerDecisions, nextWaitId, waitCounts, waitHolds, waitKind, waitNextStep, waitRows, waitState, waitWhoDefault } from '../gc/schedule/waits'

