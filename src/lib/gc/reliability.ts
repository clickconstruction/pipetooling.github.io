/**
 * GC mode, the real build, the Board's B2: how a company answers when asked, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcReliability.ts`).
 */
import { wordRecord } from './followUp'
import type { GcState, Partner } from './types'

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
