import type { Database } from '../../types/database'

/**
 * Pure logic for step commitments — sub work orders on workflow steps
 * (RUN_SUBS_PLAN Phase 2, PR 2.2).
 *
 * The rail merges two sources deliberately kept separate in the DB: the
 * commitment's MONEY lifecycle (draft → offered → accepted → approved →
 * settled) and the step's WORK status (in progress / complete). Balance math
 * reads the linked sub sheet when one exists (post-settlement) so the panel
 * and the Sub Labor ledger can never disagree.
 */

export type StepCommitmentRow = Database['public']['Tables']['step_commitments']['Row']

export type CommitmentRailSegment = {
  key: 'offered' | 'accepted' | 'in_progress' | 'complete' | 'approved' | 'settled'
  label: string
  state: 'done' | 'now' | 'todo'
}

const MONEY_ORDER = ['draft', 'offered', 'accepted', 'approved', 'settled'] as const

function moneyRank(status: string): number {
  const idx = (MONEY_ORDER as readonly string[]).indexOf(status)
  return idx === -1 ? 0 : idx
}

/**
 * Rail for one commitment given its step's work status. Cancelled and
 * declined return empty — the panel renders their banners instead. While a
 * commitment sits at 'offered', the Accepted segment reads "Awaiting answer"
 * (Phase 4: the sub now answers for real).
 */
export function commitmentRail(commitmentStatus: string, stepStatus: string): CommitmentRailSegment[] {
  if (commitmentStatus === 'cancelled' || commitmentStatus === 'declined') return []
  const rank = moneyRank(commitmentStatus)
  const workStarted = stepStatus === 'in_progress' || stepStatus === 'completed' || stepStatus === 'approved'
  const workComplete = stepStatus === 'completed' || stepStatus === 'approved'

  const segs: CommitmentRailSegment[] = [
    { key: 'offered', label: 'Offered', state: rank >= 1 ? 'done' : 'todo' },
    { key: 'accepted', label: commitmentStatus === 'offered' ? 'Awaiting answer' : 'Accepted', state: rank >= 2 ? 'done' : 'todo' },
    { key: 'in_progress', label: 'In progress', state: workComplete ? 'done' : workStarted ? 'now' : 'todo' },
    { key: 'complete', label: 'Complete', state: workComplete ? 'done' : 'todo' },
    { key: 'approved', label: 'Approved', state: rank >= 3 ? 'done' : 'todo' },
    { key: 'settled', label: 'Settled', state: rank >= 4 ? 'done' : 'todo' },
  ]
  // Highlight the front of the money lifecycle when work hasn't taken over.
  if (rank < 3) {
    const nowKey = rank === 0 ? 'offered' : rank === 1 ? 'accepted' : null
    if (nowKey) {
      const seg = segs.find((s) => s.key === nowKey)
      if (seg && seg.state === 'todo') seg.state = 'now'
    }
  } else if (rank === 3) {
    const seg = segs.find((s) => s.key === 'settled')
    if (seg) seg.state = 'now'
  }
  return segs
}

export type CommitmentBalance = {
  agreed: number
  retainageHeld: number
  /** Sum of positive payments on the linked sub sheet. */
  paidToDate: number
  /** Sum of negative payment rows (backcharges), as a positive figure. */
  backcharges: number
  /** amount − retainage − paid + backcharges never below 0. */
  balanceRemaining: number
}

export function commitmentBalance(
  commitment: Pick<StepCommitmentRow, 'amount' | 'retainage_pct'>,
  laborJobPayments: Array<{ amount: number }> | null,
): CommitmentBalance {
  const agreed = Number(commitment.amount) || 0
  const retainagePct = Number(commitment.retainage_pct) || 0
  const retainageHeld = Math.round(agreed * retainagePct) / 100
  let paidToDate = 0
  let backcharges = 0
  for (const p of laborJobPayments ?? []) {
    const n = Number(p.amount) || 0
    if (n >= 0) paidToDate += n
    else backcharges += -n
  }
  const balanceRemaining = Math.max(0, agreed - retainageHeld - paidToDate + backcharges)
  return { agreed, retainageHeld, paidToDate, backcharges, balanceRemaining }
}

/**
 * Transitions the office can take from each money status (superintendents:
 * accept only — enforced by caller). 'withdraw' returns an unanswered offer
 * to draft; 'reoffer' reopens a declined order (new window/amount allowed).
 */
export function nextCommitmentActions(status: string): Array<'offer' | 'accept' | 'withdraw' | 'reoffer' | 'cancel'> {
  switch (status) {
    case 'draft':
      return ['offer', 'cancel']
    case 'offered':
      return ['accept', 'withdraw', 'cancel']
    case 'declined':
      return ['reoffer', 'cancel']
    case 'accepted':
      return ['cancel']
    default:
      return []
  }
}
