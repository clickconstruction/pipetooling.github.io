/**
 * GC mode — design spike. Follow up: promised quote days, a company's word record, who to call first.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { AskPromise, FollowUp, FollowUpWhy, PromiseState } from '../gc/followUp'
export { OPEN_WITHIN_DAYS, askPromise, followUps, packageIsOpen, promiseWords, wordRecord } from '../gc/followUp'

