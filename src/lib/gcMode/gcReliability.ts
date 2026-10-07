/**
 * GC mode — design spike: how dependable a company is, for the order we ask them in (the owner,
 * 2026-10-04, question 7: the trade map lists the most reliable first). Its own file so the map
 * (gcMap) and the bench (gcBench, which imports gcMap) can both read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { AnswerRecord } from '../gc/reliability'
export { answerRecord, compareReliability } from '../gc/reliability'

