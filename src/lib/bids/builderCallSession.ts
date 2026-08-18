/**
 * Call-session save kernel (v2.1389): one hang-up → one builder contact,
 * a submission entry + last_contact stamp per bid the caller touched,
 * outcome updates for won/lost taps, and the promised next-follow-up date.
 * Pure row-building; the modal performs the writes.
 */

import { bidLossCategoryLabel, type BidLossCategoryKey } from '../bidLossCategories'

export type CallSessionOutcome = 'still_pending' | 'won' | 'lost' | 'rebid'

export type CallSessionBidDecision = {
  bidId: string
  /** null = the bid wasn't discussed; nothing is written for it. */
  outcome: CallSessionOutcome | null
  note: string
  lossReason: string
  /** Structured why-we-lost bucket (v2.1799); only written for 'lost' taps. */
  lossCategory: BidLossCategoryKey | null
}

export type CallSessionWrites = {
  customerContact: {
    customer_id: string
    contact_date: string
    details: string
    contact_method: string
    created_by: string
  }
  bidEntries: Array<{
    bid_id: string
    contact_method: string
    notes: string
    occurred_at: string
    created_by: string
  }>
  bidLastContactUpdates: Array<{ bidId: string; last_contact: string }>
  bidOutcomeUpdates: Array<{ bidId: string; outcome: 'won' | 'lost'; loss_reason: string | null; loss_category: string | null }>
}

export function callSessionOutcomeLabel(d: Pick<CallSessionBidDecision, 'outcome' | 'lossReason' | 'lossCategory'>): string {
  switch (d.outcome) {
    case 'won':
      return 'Marked won on call'
    case 'lost': {
      const parts = [bidLossCategoryLabel(d.lossCategory), d.lossReason.trim() || null].filter(Boolean)
      return parts.length > 0 ? `Marked lost on call — ${parts.join(': ')}` : 'Marked lost on call'
    }
    case 'rebid':
      return 'Rebid / RFQ requested'
    case 'still_pending':
      return 'Still pending'
    default:
      return ''
  }
}

export function buildCallSessionWrites(args: {
  customerId: string
  userId: string
  nowIso: string
  summary: string
  decisions: CallSessionBidDecision[]
}): CallSessionWrites {
  const { customerId, userId, nowIso } = args
  const touched = args.decisions.filter((d) => d.outcome !== null || d.note.trim() !== '')
  const details = args.summary.trim() || `Call session — ${touched.length} bid${touched.length === 1 ? '' : 's'} reviewed`
  return {
    customerContact: {
      customer_id: customerId,
      contact_date: nowIso,
      details,
      contact_method: 'Phone',
      created_by: userId,
    },
    bidEntries: touched.map((d) => {
      const outcomeLabel = callSessionOutcomeLabel(d)
      const note = d.note.trim()
      return {
        bid_id: d.bidId,
        contact_method: 'Phone',
        notes: note && outcomeLabel ? `${outcomeLabel}. ${note}` : note || outcomeLabel,
        occurred_at: nowIso,
        created_by: userId,
      }
    }),
    bidLastContactUpdates: touched.map((d) => ({ bidId: d.bidId, last_contact: nowIso })),
    bidOutcomeUpdates: touched
      .filter((d): d is CallSessionBidDecision & { outcome: 'won' | 'lost' } => d.outcome === 'won' || d.outcome === 'lost')
      .map((d) => ({
        bidId: d.bidId,
        outcome: d.outcome,
        loss_reason: d.outcome === 'lost' ? d.lossReason.trim() || null : null,
        // Won on call clears any stale category from an earlier "lost" call.
        loss_category: d.outcome === 'lost' ? d.lossCategory : null,
      })),
  }
}

/** Quick-pick helpers for the "Next follow-up" row; returns an ISO at 8am local on the target day. */
export function nextFollowupQuickPickIso(pick: 'tomorrow' | 'next-week' | 'two-weeks', now: Date): string {
  const days = pick === 'tomorrow' ? 1 : pick === 'next-week' ? 7 : 14
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 8, 0, 0)
  return d.toISOString()
}
