/**
 * GC mode — design spike: how dependable a company is, for the order we ask them in (the owner,
 * 2026-10-04, question 7: the trade map lists the most reliable first). Its own file so the map
 * (gcMap) and the bench (gcBench, which imports gcMap) can both read it.
 */
import type { GcState, Partner } from './gcTypes'
import { wordRecord } from './gcFollowUp'

export type AnswerRecord = 'new' | 'reliable' | 'mixed' | 'silent'

/** How a company has answered our asks so far. Two asks is the least we judge on. */
export function answerRecord(partner: Partner): AnswerRecord {
  if (partner.invited < 2) return 'new'
  const rate = partner.bids / partner.invited
  return rate >= 0.75 ? 'reliable' : rate >= 0.4 ? 'mixed' : 'silent'
}

/** Answers when asked, then answers about half the time, then not judged yet, then mostly silent. */
const ANSWER_ORDER: Record<AnswerRecord, number> = { reliable: 0, mixed: 1, new: 2, silent: 3 }

/**
 * Most reliable first: how they answer our asks, then how often their word held (quote dates and
 * other promises), a company we declined last. Negative: `a` comes first. Zero: as reliable.
 */
export function compareReliability(state: GcState, a: Partner, b: Partner): number {
  const declined = Number(a.vetting?.status === 'declined') - Number(b.vetting?.status === 'declined')
  if (declined !== 0) return declined
  const answer = ANSWER_ORDER[answerRecord(a)] - ANSWER_ORDER[answerRecord(b)]
  if (answer !== 0) return answer
  return wordRate(state, b) - wordRate(state, a)
}

/** Kept over made; a company with no promises yet sits in the middle. */
function wordRate(state: GcState, partner: Partner): number {
  const w = wordRecord(state, partner)
  return w.made === 0 ? 0.5 : w.kept / w.made
}
