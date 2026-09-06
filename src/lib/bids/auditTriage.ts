/**
 * Audit-queue triage kernel (v2.2941, LEARNING_PLAN item 5): order PENDING
 * audits by what a verdict unblocks, not by age.
 *
 * The estimator's hours are the robot program's bottleneck. Oldest-first spends
 * them wherever the queue happened to grow; doctrine-at-stake spends them where
 * the audit teaches the most:
 *
 *   1. open questions on the audit, descending — every unanswered question is a
 *      robot (often several) waiting on a ruling; the biggest lever.
 *   2. |delta %| vs our number when priced, descending — a −57% card teaches
 *      more than a −3% card; unpriced/unpaired cards rank after any priced one.
 *   3. age as the tiebreak — older first (the old behavior survives as the
 *      last-resort order).
 *
 * Only the pending group reorders; done/digested keep `sortAuditsForTab`'s
 * order (the caller passes a list that sort already shaped — pending block
 * first — and this function reassembles non-pending rows in their given order).
 */

export type AuditTriageSignals = {
  /** Unanswered robot questions on the audit (openQuestionCount). */
  openQuestions: number
  /** Signed delta % vs our number; null when unpriced or the reference is unknown/sealed. */
  deltaPct: number | null
}

type TriageRow = { requested_at: string } & AuditTriageSignals

/** <0 ⇒ a first. Exported for direct unit testing of the ordering rules. */
export function compareAuditStake(a: TriageRow, b: TriageRow): number {
  if (a.openQuestions !== b.openQuestions) return b.openQuestions - a.openQuestions
  const aDelta = a.deltaPct == null ? -1 : Math.abs(a.deltaPct)
  const bDelta = b.deltaPct == null ? -1 : Math.abs(b.deltaPct)
  if (aDelta !== bDelta) return bDelta - aDelta
  return a.requested_at < b.requested_at ? -1 : a.requested_at > b.requested_at ? 1 : 0
}

/**
 * Reorder ONLY the pending audits by doctrine-at-stake; every other status
 * keeps its relative order after the pending block (matching sortAuditsForTab's
 * pending-first shape).
 */
export function orderPendingByStake<T extends { status: string; requested_at: string }>(
  audits: T[],
  signalsFor: (audit: T) => AuditTriageSignals,
): T[] {
  const pending = audits.filter((a) => a.status === 'pending')
  const rest = audits.filter((a) => a.status !== 'pending')
  const scored = pending
    .map((audit) => ({ audit, row: { requested_at: audit.requested_at, ...signalsFor(audit) } }))
    .sort((a, b) => compareAuditStake(a.row, b.row))
  return [...scored.map((s) => s.audit), ...rest]
}
