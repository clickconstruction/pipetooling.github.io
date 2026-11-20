/**
 * Permit news on Followup (punch list #401, PR 2): the answer on a line. A bid's address can
 * carry a permit, and a person says of it one of two things: it is on the job we bid, or it is
 * another job on the same address. The answers are kept in `bid_permit_answers`, append-only,
 * with who and when. This file folds those rows into the answer that stands for each bid and
 * permit. `bidPermitNews` reads the fold: a permit that is not this job is off the bid, and a
 * line on a permit that is this job is answered. No React, no Supabase.
 */

export type PermitAnswer = 'this_job' | 'not_this_job' | 'taken_back'

/** One row of `bid_permit_answers`. */
export type PermitAnswerRow = {
  id: string
  bid_id: string
  city: string
  permit_number: string
  permit_type: string
  answer: PermitAnswer
  answered_by: string
  answered_at: string
}

/** A permit as an answer names one: the city's own number and type, the way `permitsOnSite` counts a permit once across the two feeds. */
export type PermitRef = { city: string; permit_number: string; permit_type: string }

/** The answer that stands on one bid and permit, with who gave it and when. */
export type StandingAnswer = { answer: 'this_job' | 'not_this_job'; by: string; at: string }

/** Every standing answer, by `permitAnswerKey`. */
export type PermitAnswers = ReadonlyMap<string, StandingAnswer>

export const NO_PERMIT_ANSWERS: PermitAnswers = new Map()

export function permitAnswerKey(bidId: string, permit: PermitRef): string {
  return `${bidId}|${permit.city}|${permit.permit_number}|${permit.permit_type}`
}

/**
 * The rows folded, oldest first so the newest stands. Two saved in one instant are settled by
 * their ids, the way the read orders them. A `taken_back` leaves no answer standing.
 */
export function foldPermitAnswers(rows: readonly PermitAnswerRow[]): Map<string, StandingAnswer> {
  const out = new Map<string, StandingAnswer>()
  const sorted = [...rows].sort((a, b) => a.answered_at.localeCompare(b.answered_at) || a.id.localeCompare(b.id))
  for (const r of sorted) {
    const key = permitAnswerKey(r.bid_id, r)
    if (r.answer === 'taken_back') out.delete(key)
    else out.set(key, { answer: r.answer, by: r.answered_by, at: r.answered_at })
  }
  return out
}
