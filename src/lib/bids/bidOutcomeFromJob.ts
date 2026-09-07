/**
 * A job opened from a bid decides the bid (v2.3069): the DB trigger
 * `jobs_ledger_bid_outcome_from_job` sets `bids.outcome = 'started_or_complete'`
 * the moment a job carries that `bid_id` (insert, or the link changing on
 * update). This is the client half — deciding whether the person who just
 * linked the job should be told, and what the lingering toast says. Pure.
 */
export type BidOutcome = 'won' | 'lost' | 'started_or_complete' | null

export const BID_OUTCOME_DERIVED = 'started_or_complete'
/** The owner asked for a toast that lingers about five seconds. */
export const BID_OUTCOME_DERIVED_TOAST_MS = 5000

export const BID_OUTCOME_LABEL: Record<Exclude<BidOutcome, null>, string> = {
  won: 'Won',
  lost: 'Lost',
  started_or_complete: 'Started or complete',
}

export function normalizeBidOutcome(value: unknown): BidOutcome {
  return value === 'won' || value === 'lost' || value === 'started_or_complete' ? value : null
}

/** Tell the person only when the link actually moved the bid: it read something else before, and reads Started or complete now. */
export function shouldAnnounceDerivedOutcome(before: unknown, after: unknown): boolean {
  return normalizeBidOutcome(before) !== BID_OUTCOME_DERIVED && normalizeBidOutcome(after) === BID_OUTCOME_DERIVED
}

/** "Bid #1842 · Riverside is now Started or complete (was Won) — it has a job." */
export function bidOutcomeDerivedMessage(input: { bidNumber: string | null | undefined; projectName: string | null | undefined; before: unknown }): string {
  const num = (input.bidNumber ?? '').trim()
  const name = (input.projectName ?? '').trim()
  const who = num && name ? `Bid #${num} · ${name}` : num ? `Bid #${num}` : name ? `Bid ${name}` : 'The linked bid'
  const before = normalizeBidOutcome(input.before)
  const was = before ? ` (was ${BID_OUTCOME_LABEL[before]})` : ' (was undecided)'
  return `${who} is now ${BID_OUTCOME_LABEL.started_or_complete}${was} — it has a job.`
}
