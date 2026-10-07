/**
 * GC mode design spike: the customer's view of the schedule, the Gantt's Phase 3
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-90 to G-92). The same dates as the office's chart, rolled up
 * to the stages of the job: no company names, no dollars, no spare days. What changed since last
 * week in plain words, and what we need from them.
 *
 * Its own file, out of the barrel: it reads the Gantt's groups and the moves.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CustomerSchedulePicture, CustomerStage, CustomerStanding } from '../gc/schedule/customerSchedule'
export { CUSTOMER_CHANGE_DAYS, CUSTOMER_NOTHING_MOVED, CUSTOMER_STAGE_WORDS, CUSTOMER_WHY, customerAsks, customerBarWords, customerChanges, customerDoneWords, customerFullChart, customerMaySeeEveryBar, customerMilestones, customerSchedulePicture, customerStages, customerStanding } from '../gc/schedule/customerSchedule'

